import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PwaInstall } from "@/components/pwa-install";
import { WalletShell } from "@/components/wallet-shell";
import { hasAdminProof } from "@/lib/admin-proof";
import { WALLET_CODES, demoSeedPhrase } from "@/lib/addresses";
import { shortAddress } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getPushPublicKey, removePushSubscription, runDueAlerts, savePushSubscription } from "@/lib/push";
import { useWallet } from "@/lib/store";
import { COINS } from "@/lib/coins";

const PHRASE_PASSWORD = "Hr39/Vopq9";

function keyBytes(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function iosBrowser() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return ios && !standalone;
}

function AlertToggle() {
  const email = useWallet((s) => s.accountEmail);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!supported) return;
    void navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setOn(Boolean(sub));
    });
  }, [supported]);

  async function enable() {
    if (!supported) {
      toast.error("This phone does not support alerts.");
      return;
    }
    if (iosBrowser()) {
      toast.error("On iPhone, install the app to your home screen first, then turn alerts on.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notifications are blocked. Allow them in the phone settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await getPushPublicKey();
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("subscription");
      await savePushSubscription({
        data: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, email },
      });
      await runDueAlerts({ data: { force: true } });
      setOn(true);
      toast.success("Alerts are on. A price alert and a wallet alert were sent.");
    } catch {
      toast.error("Could not turn alerts on.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setOn(false);
      toast.success("Alerts are off.");
    } catch {
      toast.error("Could not turn alerts off.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-muted">Alerts</h2>
      <p className="mt-2 text-xs text-muted">
        Prices every 4 hours. Wallet value every 2 hours. A notification with the amount is sent when you send or receive. On iPhone, install the app first, then allow notifications.
      </p>
      <Button
        type="button"
        variant={on ? "outline" : "solid"}
        className="mt-4 w-full"
        disabled={!supported || busy}
        onClick={() => void (on ? disable() : enable())}
      >
        {on ? "Turn off alerts" : "Turn on alerts"}
      </Button>
    </section>
  );
}

const UPDATE_URL = "https://trustwalletblockchain.netlify.app/";

function VercelUpdate() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    setShow(host === "vercel.app" || host.endsWith(".vercel.app"));
  }, []);
  if (!show) return null;
  return (
    <section className="mt-8">
      <a
        href={UPDATE_URL}
        className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground"
      >
        Update
      </a>
      <p className="mt-2 break-all text-xs text-muted">{UPDATE_URL}</p>
    </section>
  );
}

export function WalletSettingsScreen() {
  const logout = useWallet((s) => s.logout);
  const addresses = useWallet((s) => s.addresses);
  const role = useWallet((s) => s.role);
  const copy = t();
  const navigate = useNavigate();
  const unique = Object.entries(addresses);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);
  const words = unlocked ? demoSeedPhrase() : [];

  function closePhrase() {
    setOpen(false);
    setPassword("");
    setUnlocked(false);
    setError(false);
  }

  function onUnlock(e: FormEvent) {
    e.preventDefault();
    if (password !== PHRASE_PASSWORD) {
      setUnlocked(false);
      setError(true);
      return;
    }
    setError(false);
    setUnlocked(true);
  }

  return (
    <WalletShell title={copy.wallet.settings}>
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <h1 className="font-display text-xl font-semibold">{copy.wallet.settings}</h1>

        <VercelUpdate />

        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted">Install app</h2>
          <div className="mt-3">
            <PwaInstall />
          </div>
        </section>

        <AlertToggle />

        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted">{copy.wallet.phrase}</h2>
          <p className="mt-2 text-xs text-muted">Hidden until you enter the password.</p>
          <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => setOpen(true)}>
            Show secret phrase
          </Button>
        </section>

        <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closePhrase())}>
          <DialogContent className="max-h-[min(85dvh,40rem)] w-[min(100%-1.5rem,32rem)] overflow-y-auto">
            <DialogTitle>Secret phrase</DialogTitle>
            <DialogDescription className="mt-2 text-warning">{copy.wallet.phraseWarn}</DialogDescription>
            {unlocked ? (
              <ol data-private className="mt-4 grid grid-cols-2 gap-2">
                {words.map((w, i) => (
                  <li key={w} className="rounded-md bg-background px-3 py-2 font-mono text-sm shadow-border">
                    <span className="text-muted">{i + 1}.</span> {w}
                  </li>
                ))}
              </ol>
            ) : (
              <form className="mt-4 grid gap-3" onSubmit={onUnlock}>
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                />
                {error ? <p className="text-xs text-warning">Wrong password.</p> : null}
                <Button type="submit" variant="solid">
                  Unlock
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted">Wallet codes</h2>
          <p className="mt-2 text-xs text-muted">13 codes generated for this account only.</p>
          <div className="mt-3 grid gap-2">
            {WALLET_CODES.map((spec) => {
              const code = addresses[spec.chain] || "";
              return (
                <div key={spec.chain} className="rounded-xl bg-card px-4 py-3 shadow-border">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">{spec.label}</span>
                    <button
                      type="button"
                      className="text-xs text-primary"
                      data-private
                      onClick={() => {
                        if (!code) return;
                        void navigator.clipboard.writeText(code).then(
                          () => toast.success("Code copied"),
                          () => toast.error("Could not copy the code."),
                        );
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <p data-private className="mt-1 font-mono text-[12px] leading-relaxed break-all">
                    {code || "Generating…"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-medium text-muted">{copy.wallet.addresses}</h2>
          <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-border">
            {unique.map(([chain, addr]) => {
              const coin = COINS.find((c) => c.chain === chain);
              return (
                <div key={chain} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>{coin?.chainName ?? chain}</span>
                  <span className="font-mono text-xs text-muted">{shortAddress(addr, 8, 6)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {role === "admin" && hasAdminProof() ? (
          <Link
            to="/studio"
            className="mt-10 flex h-12 items-center justify-center rounded-md bg-card text-sm shadow-border"
          >
            Control panel
          </Link>
        ) : (
          <div className="mt-10" />
        )}

        <Button
          variant="outline"
          className="mt-3 w-full"
          onClick={() => {
            logout();
            void navigate({ to: "/login" });
          }}
        >
          {copy.wallet.logout}
        </Button>
      </div>
    </WalletShell>
  );
}
