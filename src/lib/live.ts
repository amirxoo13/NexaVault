import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADMIN_ACCOUNT } from "@/lib/auth-config";
import { useWallet } from "@/lib/store";

const eventInput = z.object({
  kind: z.enum(["open", "tap", "action"]),
  label: z.string().min(1).max(600),
});

const pushInput = z.object({
  sessionId: z.string().min(4).max(40),
  role: z.enum(["guest", "client", "admin"]),
  who: z.string().min(1).max(80),
  path: z.string().min(1).max(200),
  device: z.string().min(1).max(40),
  browser: z.string().max(40).default(""),
  os: z.string().max(40).default(""),
  viewport: z.string().max(24).default(""),
  lang: z.string().max(20).default(""),
  mode: z.string().max(24).default(""),
  startedAt: z.number().min(0).max(9e15).default(0),
  pageAt: z.number().min(0).max(9e15).default(0),
  scenario: z.string().max(8).default(""),
  email: z.string().max(80).default(""),
  events: z.array(eventInput).max(20),
});

export const pushLive = createServerFn({ method: "POST" })
  .validator(pushInput)
  .handler(async ({ data }) => {
    const { writeLive } = await import("./live-send");
    return writeLive(data);
  });

export const loadLive = createServerFn({ method: "POST" })
  .validator(z.object({ proof: z.string().max(200) }))
  .handler(async ({ data }) => {
    if (data.proof !== ADMIN_ACCOUNT.password) {
      return {
        ok: false as const,
        error: "denied" as const,
        now: Date.now(),
        online: [],
        recent: [],
        events: [],
        hour: { actions: 0, opens: 0, taps: 0, sessions: 0 },
      };
    }
    const { readLive } = await import("./live-send");
    return readLive();
  });

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/login": "Login",
  "/features": "Features",
  "/security": "Security",
  "/markets": "Markets",
  "/studio": "Control panel",
  "/wallet": "Wallet",
  "/wallet/": "Wallet",
  "/wallet/send": "Send",
  "/wallet/receive": "Receive",
  "/wallet/swap": "Swap",
  "/wallet/markets": "Markets",
  "/wallet/perps": "Perps",
  "/wallet/buy": "Buy",
  "/wallet/activity": "Activity",
  "/wallet/profile": "Profile",
  "/wallet/settings": "Settings",
  "/wallet/ethereum": "Ethereum account",
};

export function pageName(path: string) {
  if (path.startsWith("/wallet/asset/")) {
    const id = path.split("/").pop() || "asset";
    return `Asset ${id}`;
  }
  return PAGE_NAMES[path] ?? path;
}

type Queued = { kind: "open" | "tap" | "action"; label: string };

const queue: Queued[] = [];
let sending = false;
let lastPath = "";
let pageAt = 0;

function sessionId() {
  const key = "trust-live-sid";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return "guest-session";
  }
}

function startedAt() {
  const key = "trust-live-started";
  try {
    const existing = Number(sessionStorage.getItem(key));
    if (existing) return existing;
    const now = Date.now();
    sessionStorage.setItem(key, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function browserName(ua: string) {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/crios/i.test(ua)) return "Chrome";
  if (/fxios/i.test(ua)) return "Firefox";
  if (/samsungbrowser/i.test(ua)) return "Samsung";
  if (/chrome|chromium/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "Browser";
}

function osName(ua: string) {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/mac os/i.test(ua)) return "macOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function deviceName(ua: string) {
  if (/ipad/i.test(ua)) return "iPad";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? "Android" : "Android tablet";
  return "Desktop";
}

function identity(path: string) {
  const wallet = useWallet.getState();
  const role: "admin" | "client" | "guest" =
    wallet.role === "admin" ? "admin" : wallet.role === "client" ? "client" : "guest";
  const name = [wallet.profile.firstName, wallet.profile.lastName].filter(Boolean).join(" ").trim();
  const email = role === "client" ? wallet.accountEmail || wallet.profile.email || "" : "";
  const who = role === "admin" ? "Admin" : role === "client" ? email || name || "Client" : "Guest";
  const cleanPath = path.slice(0, 200) || "/";
  if (cleanPath !== lastPath) {
    lastPath = cleanPath;
    pageAt = Date.now();
  } else if (!pageAt) {
    pageAt = Date.now();
  }
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return {
    sessionId: sessionId(),
    role,
    who: who.slice(0, 80),
    path: cleanPath,
    device: deviceName(ua),
    browser: browserName(ua),
    os: osName(ua),
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    lang: (navigator.language || "").slice(0, 20),
    mode: standalone ? "Installed app" : "Browser",
    startedAt: startedAt(),
    pageAt,
    scenario: role === "client" ? wallet.scenario || "" : "",
    email: email.slice(0, 80),
  };
}

async function flush(path: string) {
  if (typeof window === "undefined" || sending) return;
  sending = true;
  const events = queue.splice(0, 20);
  try {
    await pushLive({ data: { ...identity(path), events } });
  } catch {
    // The next heartbeat tries again with whatever happens next.
  } finally {
    sending = false;
  }
}

export function track(kind: Queued["kind"], label: string) {
  if (typeof window === "undefined") return;
  const text = label.replace(/[ \t]+/g, " ").trim().slice(0, 600);
  if (!text) return;
  const last = queue[queue.length - 1];
  if (last && last.kind === kind && last.label === text) return;
  queue.push({ kind, label: text });
  if (queue.length >= 8) void flush(window.location.pathname || "/");
}

export function beat(path: string) {
  void flush(path || "/");
}
