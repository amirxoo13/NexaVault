import { create } from "zustand";
import { BALANCE_EPOCH, STARTER_HOLDINGS } from "@/lib/coins";
import { CLIENT_ACCOUNT } from "@/lib/auth-config";
import { hasAdminProof, adminProof } from "@/lib/admin-proof";
import { SITE_DEFAULTS, renameAurexToTrust, useSite, type SiteContent } from "@/lib/site-store";
import { useLoginWindow } from "@/lib/login-window";
import { ensureWalletAddresses, useWallet, type Holding, type Profile } from "@/lib/store";
import type { CloudLogin, CloudSnapshot, CloudWallet } from "@/lib/cloud-state";

type CloudPhase = "boot" | "live" | "local";

export const useCloud = create<{ phase: CloudPhase; lastSaved: number | null }>(() => ({
  phase: "boot",
  lastSaved: null,
}));

let ready = false;
let applying = false;
let pushing = false;
let pendingForce = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let unsubSite: (() => void) | undefined;
let unsubWallet: (() => void) | undefined;
let unsubLogin: (() => void) | undefined;
let visBound = false;
let pollId: number | undefined;
let onVis: (() => void) | undefined;
let lastSiteKey = "";
let lastWalletKey = "";
let lastLoginKey = "";
let lastUpdatedAt: string | null = null;
let quietUntil = 0;
let inflight: Promise<void> | null = null;
let holdPush = false;

export function setHoldPush(next: boolean) {
  holdPush = next;
}

function isPrivateClient() {
  const wallet = useWallet.getState();
  return (
    wallet.role === "client" &&
    Boolean(wallet.accountEmail) &&
    wallet.accountEmail.trim().toLowerCase() !== CLIENT_ACCOUNT.email.toLowerCase()
  );
}

function blankPrivateState() {
  const email = useWallet.getState().accountEmail;
  useWallet.setState({
    holdings: STARTER_HOLDINGS.map((holding) => ({ id: holding.id, amount: 0 })),
    transactions: [],
    addresses: {},
    scenario: null,
    profile: {
      firstName: "",
      lastName: "",
      email,
      address: "",
      phone: "",
      nationalId: "",
      licensePhoto: null,
    },
    balanceEpoch: BALANCE_EPOCH,
  });
}

async function pullPrivateWallet() {
  const wallet = useWallet.getState();
  if (!wallet.accountToken) {
    useWallet.setState({ authenticated: false, role: null, accountToken: "" });
    blankPrivateState();
    return;
  }
  const { loadPrivateWallet } = await import("@/lib/user-wallet");
  const res = await loadPrivateWallet({ data: { email: wallet.accountEmail, token: wallet.accountToken } });
  if (!res.ok || !res.wallet) return;
  applying = true;
  try {
    useWallet.setState({
      profile: res.wallet.profile,
      holdings: res.wallet.holdings,
      transactions: res.wallet.transactions,
      addresses: ensureWalletAddresses(res.wallet.addresses),
      scenario: res.wallet.scenario ?? null,
      balanceEpoch: BALANCE_EPOCH,
    });
    lastWalletKey = JSON.stringify(walletSnapshot());
  } finally {
    applying = false;
  }
}

function siteSnapshot(): SiteContent {
  const s = useSite.getState();
  const { hydrated, patch, reset, ...rest } = s;
  void hydrated;
  void patch;
  void reset;
  return rest;
}

function walletSnapshot(): CloudWallet {
  const s = useWallet.getState();
  return {
    profile: s.profile,
    holdings: s.holdings,
    transactions: s.transactions,
    addresses: s.addresses,
    scenario: s.scenario,
    balanceEpoch: s.balanceEpoch,
  };
}

function loginSnapshot(): CloudLogin {
  const s = useLoginWindow.getState();
  return { startedAt: s.startedAt, lockedScenario: s.lockedScenario };
}

function isDefaultSite(site: SiteContent) {
  return (
    site.brandName === SITE_DEFAULTS.brandName &&
    !site.logo &&
    !site.heroImage &&
    site.heroTitleA === SITE_DEFAULTS.heroTitleA &&
    site.heroSub === SITE_DEFAULTS.heroSub
  );
}

function holdingsLookStarter(holdings: Holding[]) {
  if (holdings.length !== STARTER_HOLDINGS.length) return false;
  const map = new Map(holdings.map((h) => [h.id, h.amount]));
  return STARTER_HOLDINGS.every((h) => map.get(h.id) === h.amount);
}

function localLooksEmpty(w: CloudWallet) {
  const p = w.profile;
  const profileEmpty = !p.firstName && !p.lastName && !p.nationalId && !p.phone && !p.address && !p.licensePhoto;
  const zero = w.holdings.every((holding) => holding.amount === 0);
  return profileEmpty && zero && w.transactions.length === 0;
}

function hasCustomWallet(w: CloudWallet) {
  const p = w.profile;
  return Boolean(
    p.firstName ||
      p.lastName ||
      p.licensePhoto ||
      p.nationalId ||
      p.phone ||
      p.address ||
      (w.transactions && w.transactions.length) ||
      (w.holdings.length > 0 && !holdingsLookStarter(w.holdings)),
  );
}

function hasMeaningfulWallet(w: CloudWallet) {
  return hasCustomWallet(w) || Boolean(w.scenario);
}

function actorOf() {
  if (hasAdminProof()) return "admin" as const;
  const role = useWallet.getState().role;
  return role === "client" ? ("client" as const) : ("public" as const);
}

async function cloudApi() {
  return import("@/lib/cloud-state");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

let lastSession = "";

function sessionKey() {
  const wallet = useWallet.getState();
  return `${wallet.role ?? ""}:${wallet.accountEmail.trim().toLowerCase()}`;
}

/** Load the wallet that belongs to whoever is signed in, even if the site itself did not change. */
export async function reloadSessionWallet() {
  if (!ready) return;
  if (isPrivateClient()) {
    await pullPrivateWallet();
    lastSession = sessionKey();
    return;
  }
  const api = await cloudApi();
  const remote = await withTimeout(api.loadAppState(), 20000);
  lastUpdatedAt = remote.updatedAt;
  applyRemote(remote.site, remote.wallet, remote.login);
  lastSession = sessionKey();
  useCloud.setState({ phase: "live" });
}

function rememberLocal() {
  lastSiteKey = JSON.stringify(siteSnapshot());
  lastWalletKey = JSON.stringify(walletSnapshot());
  lastLoginKey = JSON.stringify(loginSnapshot());
}

async function pushToCloud(forceLogin = false) {
  if (forceLogin) pendingForce = true;
  if (!ready || applying || pushing || holdPush) return;
  pushing = true;
  const force = pendingForce;
  pendingForce = false;
  try {
    const actor = actorOf();
    const site = siteSnapshot();
    const wallet = walletSnapshot();
    const login = loginSnapshot();
    const siteKey = JSON.stringify(site);
    const walletKey = JSON.stringify(wallet);
    const loginKey = JSON.stringify(login);
    const siteChanged = siteKey !== lastSiteKey;
    const walletChanged = walletKey !== lastWalletKey;
    const loginChanged = loginKey !== lastLoginKey || force;
    if (!siteChanged && !walletChanged && !loginChanged) return;

    if (isPrivateClient()) {
      if (!walletChanged) return;
      const { savePrivateWallet } = await import("@/lib/user-wallet");
      const current = useWallet.getState();
      const saved = await savePrivateWallet({
        data: { email: current.accountEmail, token: current.accountToken, wallet },
      });
      if (saved.ok && saved.wallet) {
        applying = true;
        try {
          useWallet.setState({
            profile: saved.wallet.profile,
            holdings: saved.wallet.holdings,
            transactions: saved.wallet.transactions,
            addresses: ensureWalletAddresses(saved.wallet.addresses),
            balanceEpoch: BALANCE_EPOCH,
          });
        } finally {
          applying = false;
        }
      }
      lastWalletKey = JSON.stringify(walletSnapshot());
      useCloud.setState({ phase: "live", lastSaved: Date.now() });
      return;
    }

    const canSite = actor === "admin" && siteChanged;
    const canWallet =
      ((actor === "admin" && walletChanged && !localLooksEmpty(wallet)) ||
        (actor === "client" && walletChanged && hasCustomWallet(wallet)));
    if (!canSite && !canWallet && !loginChanged) return;

    const api = await cloudApi();
    const res = await api.saveAppState({
      data: {
        actor,
        proof: actor === "admin" ? adminProof() : undefined,
        site: canSite ? site : undefined,
        wallet: canWallet ? wallet : undefined,
        login: loginChanged ? login : undefined,
        forceLogin: force && actor === "admin",
      },
    });
    if (res.wallet && actor !== "admin") {
      applying = true;
      try {
        useWallet.setState({
          profile: res.wallet.profile,
          holdings: res.wallet.holdings,
          transactions: res.wallet.transactions,
          addresses: ensureWalletAddresses(res.wallet.addresses),
          scenario: res.wallet.scenario ?? useWallet.getState().scenario,
          balanceEpoch: typeof res.wallet.balanceEpoch === "number" ? res.wallet.balanceEpoch : BALANCE_EPOCH,
        });
      } finally {
        applying = false;
      }
    }
    lastSiteKey = siteKey;
    lastWalletKey = JSON.stringify(walletSnapshot());
    lastLoginKey = loginKey;
    if (res.updatedAt) lastUpdatedAt = res.updatedAt;
    quietUntil = Date.now() + 1500;
    useCloud.setState({ phase: "live", lastSaved: Date.now() });
  } catch (err) {
    console.warn("[aurex] cloud save failed", err);
    useCloud.setState({ phase: "local" });
  } finally {
    pushing = false;
    if (pendingForce) void pushToCloud(true);
  }
}

function schedulePush() {
  if (!ready || applying) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushToCloud();
  }, 250);
}

function applyRemote(site: Partial<SiteContent> | null, wallet: CloudWallet | null, login: CloudLogin | null) {
  applying = true;
  try {
    if (site && Object.keys(site).length) {
      useSite.setState(renameAurexToTrust({ ...SITE_DEFAULTS, ...site }));
    }
    if (wallet) {
      const remoteEpoch =
        typeof (wallet as { balanceEpoch?: unknown }).balanceEpoch === "number"
          ? (wallet as { balanceEpoch: number }).balanceEpoch
          : 0;
      const next: {
        profile?: Profile;
        holdings?: Holding[];
        transactions?: CloudWallet["transactions"];
        addresses?: CloudWallet["addresses"];
        scenario?: CloudWallet["scenario"];
        balanceEpoch?: number;
      } = {
        holdings:
          remoteEpoch === BALANCE_EPOCH && Array.isArray(wallet.holdings)
            ? wallet.holdings
            : STARTER_HOLDINGS.map((h) => ({ ...h })),
        balanceEpoch: BALANCE_EPOCH,
        addresses: ensureWalletAddresses({
          ...useWallet.getState().addresses,
          ...(wallet.addresses ?? {}),
        }),
      };
      if (wallet.profile) next.profile = wallet.profile;
      if (Array.isArray(wallet.transactions)) next.transactions = wallet.transactions;
      if ("scenario" in wallet) next.scenario = wallet.scenario ?? null;
      useWallet.setState(next);
    }
    if (login) {
      useLoginWindow.setState({
        startedAt: login.startedAt ?? null,
        lockedScenario: login.lockedScenario ?? null,
      });
    }
    rememberLocal();
  } finally {
    applying = false;
  }
}

function subscribe() {
  if (!unsubSite) unsubSite = useSite.subscribe(schedulePush);
  if (!unsubWallet) unsubWallet = useWallet.subscribe(schedulePush);
  if (!unsubLogin) unsubLogin = useLoginWindow.subscribe(schedulePush);
}

function startListeners() {
  subscribe();
  if (typeof window === "undefined" || visBound) return;
  visBound = true;
  onVis = () => {
    if (document.visibilityState === "visible") void pullFromCloud(true);
  };
  window.addEventListener("focus", onVis);
  document.addEventListener("visibilitychange", onVis);
  pollId = window.setInterval(() => {
    void pullFromCloud();
  }, 4000);
}

export function stopListeners() {
  /* Keep the shared poll alive for the life of the tab. */
}

async function pullFromCloud(force = false) {
  if (!ready || applying || pushing) return;
  if (!force && (timer || Date.now() < quietUntil)) return;
  if (!force && typeof document !== "undefined" && document.visibilityState === "hidden") return;
  try {
    const api = await cloudApi();
    const sessionChanged = sessionKey() !== lastSession;
    lastSession = sessionKey();
    if (isPrivateClient()) {
      const meta = await withTimeout(api.loadAppStateMeta(), 8000);
      if (!(meta.updatedAt && meta.updatedAt === lastUpdatedAt)) {
        const remote: CloudSnapshot = await withTimeout(api.loadAppState(), 8000);
        lastUpdatedAt = remote.updatedAt ?? meta.updatedAt;
        if (remote.site) applyRemote(remote.site, null, null);
      }
      await pullPrivateWallet();
      useCloud.setState({ phase: "live" });
      return;
    }
    const meta = await withTimeout(api.loadAppStateMeta(), 8000);
    if (meta.empty) return;
    if (!sessionChanged && meta.updatedAt && meta.updatedAt === lastUpdatedAt) return;
    const remote: CloudSnapshot = await withTimeout(api.loadAppState(), 8000);
    if (remote.empty) return;
    lastUpdatedAt = remote.updatedAt ?? meta.updatedAt;
    applyRemote(remote.site, remote.wallet, remote.login);
    useCloud.setState({ phase: "live" });
  } catch (err) {
    console.warn("[aurex] cloud pull failed", err);
  }
}

export async function syncFromCloud(): Promise<() => void> {
  if (ready) {
    startListeners();
    return stopListeners;
  }
  if (inflight) {
    await inflight;
    startListeners();
    return stopListeners;
  }
  inflight = (async () => {
    try {
      const api = await cloudApi();
      const remote = await withTimeout(api.loadAppState(), 12000);
      if (isPrivateClient()) {
        blankPrivateState();
        if (!remote.empty && remote.site) applyRemote(remote.site, null, null);
        await pullPrivateWallet();
        ready = true;
        quietUntil = Date.now() + 800;
        useCloud.setState({ phase: "live" });
        startListeners();
        return;
      }
      if (remote.empty) {
        rememberLocal();
        const site = siteSnapshot();
        const wallet = walletSnapshot();
        const shouldSeed = !isDefaultSite(site) || hasMeaningfulWallet(wallet) || Boolean(loginSnapshot().startedAt);
        ready = true;
        if (shouldSeed) {
          const actor = actorOf();
          try {
            const res = await api.saveAppState({
              data: {
                actor,
                proof: actor === "admin" ? adminProof() : undefined,
                site: actor === "admin" && !isDefaultSite(site) ? site : undefined,
                wallet: hasMeaningfulWallet(wallet) && actor !== "public" ? wallet : undefined,
                login: loginSnapshot(),
                forceLogin: actor === "admin",
              },
            });
            if (res.updatedAt) lastUpdatedAt = res.updatedAt;
            rememberLocal();
            useCloud.setState({ phase: "live", lastSaved: Date.now() });
          } catch (err) {
            console.warn("[aurex] cloud seed failed", err);
            useCloud.setState({ phase: "local" });
          }
        } else {
          useCloud.setState({ phase: "live" });
        }
        quietUntil = Date.now() + 800;
        startListeners();
        return;
      }
      lastUpdatedAt = remote.updatedAt;
      applyRemote(remote.site, remote.wallet, remote.login);
      ready = true;
      quietUntil = Date.now() + 800;
      useCloud.setState({ phase: "live" });
      startListeners();
    } catch (err) {
      console.warn("[aurex] cloud load failed", err);
      ready = true;
      rememberLocal();
      useCloud.setState({ phase: "local" });
      startListeners();
    }
  })();
  try {
    await inflight;
    return stopListeners;
  } finally {
    inflight = null;
  }
}

export async function refreshCloud() {
  await pullFromCloud(true);
}

export function saveCloudNow(forceLogin = false) {
  if (!ready) return;
  if (timer) {
    clearTimeout(timer);
    timer = undefined;
  }
  void pushToCloud(forceLogin);
}
