import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  ADMIN_ACCOUNT,
  CLIENT_ACCOUNT,
  type ScenarioCode,
  type UserRole,
} from "@/lib/auth-config";
import { generateAddress } from "@/lib/addresses";
import { COINS, STARTER_HOLDINGS, BALANCE_EPOCH, getCoin, swapFeeRate } from "@/lib/coins";
import { hasAdminProof, grantAdminProof, clearAdminProof } from "@/lib/admin-proof";
import { clearSavedLogin, clearSessionUnlock, useDeviceAuth } from "@/lib/device-lock";
import { useLoginWindow } from "@/lib/login-window";

export type TxType = "send" | "receive" | "swap" | "buy";
export type TxStatus = "pending" | "confirmed" | "failed";

/** Real wall-clock wait before an Ethereum → Bitcoin swap settles. */
export const ETH_BTC_SWAP_MS = 21 * 24 * 60 * 60 * 1000;

export interface Holding {
  id: string;
  amount: number;
}

export interface Transaction {
  id: string;
  hash: string;
  type: TxType;
  status: TxStatus;
  timestamp: number;
  symbol: string;
  coinId: string;
  amount: number;
  usdValue: number;
  fromAddress?: string;
  toAddress?: string;
  toSymbol?: string;
  toCoinId?: string;
  toAmount?: number;
  fee: number;
  feeSymbol: string;
  note?: string;
  /** The other account in an internal transfer. Never set on the primary wallet. */
  peerEmail?: string;
  /** Absolute time an Ethereum → Bitcoin swap becomes spendable. */
  settlesAt?: number;
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  phone: string;
  nationalId: string;
  licensePhoto: string | null;
}

export interface WalletAddresses {
  [chain: string]: string;
}

export type LoginError = "invalid";

interface WalletState {
  hydrated: boolean;
  authenticated: boolean;
  role: UserRole | null;
  scenario: ScenarioCode | null;
  /** Email used to sign in. Kept off the shared profile so each login stays distinct. */
  accountEmail: string;
  accountToken: string;
  hideBalances: boolean;
  addresses: WalletAddresses;
  holdings: Holding[];
  transactions: Transaction[];
  profile: Profile;
  /** 0 until the saved wallet is rewritten to the current balance set. */
  balanceEpoch: number;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: LoginError }>;
  logout: () => void;
  toggleHideBalances: () => void;
  setProfile: (profile: Profile) => void;
  clearScenario: () => void;
  setHolding: (coinId: string, amount: number) => void;
  credit: (coinId: string, amount: number) => void;
  debit: (coinId: string, amount: number) => boolean;
  addTx: (tx: Omit<Transaction, "id" | "hash" | "timestamp" | "status"> & { status?: TxStatus }) => Transaction;
  simulateIncoming: (coinId: string, amount: number) => Transaction | null;
  send: (opts: {
    coinId: string;
    amount: number;
    toAddress: string;
    usdValue: number;
  }) => { ok: true; tx: Transaction } | { ok: false; error: string };
  swap: (opts: {
    fromId: string;
    toId: string;
    fromAmount: number;
    toAmount: number;
    usdValue: number;
  }) => { ok: true; tx: Transaction } | { ok: false; error: string };
  settleDueSwaps: () => void;
  cancelSwap: (id: string) => { ok: true } | { ok: false; error: "forbidden" | "missing" | "already" | "spent" };
  buy: (opts: {
    coinId: string;
    amount: number;
    usdValue: number;
  }) => { ok: true; tx: Transaction } | { ok: false; error: string };
}

export function ensureWalletAddresses(addresses: WalletAddresses): WalletAddresses {
  let missing = false;
  for (const coin of COINS) {
    if (!addresses[coin.chain]) {
      missing = true;
      break;
    }
  }
  if (!missing) return addresses;
  const out = { ...addresses };
  for (const coin of COINS) {
    if (!out[coin.chain]) out[coin.chain] = generateAddress(coin.kind);
  }
  return out;
}

function hexId(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function txHash(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return `0x${Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const emptyProfile = (email = ""): Profile => ({
  firstName: "",
  lastName: "",
  email,
  address: "",
  phone: "",
  nationalId: "",
  licensePhoto: null,
});

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      authenticated: false,
      role: null,
      scenario: null,
      accountEmail: "",
      accountToken: "",
      hideBalances: false,
      addresses: {},
      holdings: STARTER_HOLDINGS.map((h) => ({ ...h })),
      transactions: [],
      profile: emptyProfile(),
      balanceEpoch: 0,
      login: async (email, password) => {
        const e = email.trim().toLowerCase();
        const p = password;

        if (e === ADMIN_ACCOUNT.email.toLowerCase() && p === ADMIN_ACCOUNT.password) {
          grantAdminProof(p);
          const { issueWalletSession } = await import("@/lib/transfer");
          const { setHoldPush, reloadSessionWallet } = await import("@/lib/cloud-sync");
          const session = await issueWalletSession({ data: { email: e, password: p } }).catch(() => null);
          setHoldPush(true);
          set((s) => ({
            authenticated: true,
            role: "admin",
            accountEmail: e,
            accountToken: session?.ok ? session.token : "",
            addresses: ensureWalletAddresses(s.addresses),
          }));
          try {
            await reloadSessionWallet();
          } finally {
            setHoldPush(false);
          }
          return { ok: true };
        }

        if (e === CLIENT_ACCOUNT.email.toLowerCase() && p === CLIENT_ACCOUNT.password) {
          clearAdminProof();
          const { issueWalletSession } = await import("@/lib/transfer");
          const { setHoldPush, reloadSessionWallet } = await import("@/lib/cloud-sync");
          const session = await issueWalletSession({ data: { email: e, password: p } }).catch(() => null);
          setHoldPush(true);
          set((s) => ({
            authenticated: true,
            role: "client",
            accountEmail: e,
            accountToken: session?.ok ? session.token : "",
            addresses: ensureWalletAddresses({}),
            holdings: [],
            transactions: [],
            profile: {
              ...emptyProfile(),
              email: CLIENT_ACCOUNT.email,
            },
          }));
          try {
            await reloadSessionWallet();
          } finally {
            setHoldPush(false);
          }
          return { ok: true };
        }

        const { loginAccount } = await import("@/lib/accounts");
        const registered = await loginAccount({ data: { email: e, password: p } });
        if (registered.ok) {
          clearAdminProof();
          set({
            authenticated: true,
            role: "client",
            accountEmail: e,
            accountToken: registered.token,
            scenario: null,
            holdings: COINS.map((coin) => ({ id: coin.id, amount: 0 })),
            transactions: [],
            addresses: {},
            profile: emptyProfile(e),
            balanceEpoch: BALANCE_EPOCH,
          });
          return { ok: true };
        }

        return { ok: false, error: "invalid" };
      },
      logout: () => {
        clearAdminProof();
        clearSavedLogin();
        clearSessionUnlock();
        try {
          sessionStorage.setItem("trust-email-login", "1");
        } catch {
          /* ignore */
        }
        if (useDeviceAuth.getState().pending) useDeviceAuth.getState().finish(false);
        set({ authenticated: false, role: null, accountToken: "" });
      },
      toggleHideBalances: () => set((s) => ({ hideBalances: !s.hideBalances })),
      setProfile: (profile) => set({ profile }),
      clearScenario: () => {
        if (!hasAdminProof()) return;
        useLoginWindow.getState().clearLockedScenario();
        set({ scenario: null });
      },
      setHolding: (coinId, amount) => {
        if (!hasAdminProof()) return;
        const n = Number(amount);
        const value = Number.isFinite(n) && n > 0 ? n : 0;
        set((s) => {
          const holdings = s.holdings.some((h) => h.id === coinId)
            ? s.holdings.map((h) => (h.id === coinId ? { ...h, amount: value } : h))
            : [...s.holdings, { id: coinId, amount: value }];
          return { holdings };
        });
      },
      credit: (coinId, amount) => {
        if (amount <= 0) return;
        set((s) => {
          const holdings = s.holdings.map((h) => ({ ...h }));
          const i = holdings.findIndex((h) => h.id === coinId);
          if (i >= 0) holdings[i] = { ...holdings[i], amount: holdings[i].amount + amount };
          else holdings.push({ id: coinId, amount });
          return { holdings };
        });
      },
      debit: (coinId, amount) => {
        const h = get().holdings.find((x) => x.id === coinId);
        if (!h || h.amount + 1e-12 < amount) return false;
        set((s) => ({
          holdings: s.holdings.map((x) =>
            x.id === coinId ? { ...x, amount: Math.max(0, x.amount - amount) } : x,
          ),
        }));
        return true;
      },
      addTx: (partial) => {
        const tx: Transaction = {
          ...partial,
          id: hexId(),
          hash: txHash(),
          timestamp: Date.now(),
          status: partial.status ?? "confirmed",
        };
        set((s) => ({ transactions: [tx, ...s.transactions].slice(0, 200) }));
        return tx;
      },
      simulateIncoming: (coinId, amount) => {
        if (!hasAdminProof()) return null;
        const coin = getCoin(coinId);
        if (!coin || amount <= 0) return null;
        get().credit(coinId, amount);
        return get().addTx({
          type: "receive",
          coinId,
          symbol: coin.symbol,
          amount,
          usdValue: 0,
          toAddress: get().addresses[coin.chain],
          fromAddress: generateAddress(coin.kind),
          fee: 0,
          feeSymbol: coin.symbol,
          note: "Incoming transfer",
        });
      },
      send: ({ coinId, amount, toAddress, usdValue }) => {
        const coin = getCoin(coinId);
        if (!coin) return { ok: false, error: "unknown_asset" };
        const fee = coin.fee;
        const total = amount + fee;
        const holding = get().holdings.find((h) => h.id === coinId);
        if (!holding || holding.amount < total) return { ok: false, error: "insufficient" };
        get().debit(coinId, total);
        const tx = get().addTx({
          type: "send",
          coinId,
          symbol: coin.symbol,
          amount,
          usdValue,
          fromAddress: get().addresses[coin.chain],
          toAddress,
          fee,
          feeSymbol: coin.symbol,
        });
        return { ok: true, tx };
      },
      swap: ({ fromId, toId, fromAmount, toAmount, usdValue }) => {
        const from = getCoin(fromId);
        const to = getCoin(toId);
        if (!from || !to) return { ok: false, error: "unknown_asset" };
        if (fromId === toId) return { ok: false, error: "same_asset" };
        const fee = fromAmount * swapFeeRate(fromId, toId);
        const holding = get().holdings.find((h) => h.id === fromId);
        if (!holding || holding.amount + 1e-12 < fromAmount) return { ok: false, error: "insufficient" };
        get().debit(fromId, fromAmount);
        const delayed = fromId === "ethereum" && toId === "bitcoin";
        if (!delayed) get().credit(toId, toAmount);
        const tx = get().addTx({
          type: "swap",
          coinId: fromId,
          symbol: from.symbol,
          amount: fromAmount,
          usdValue,
          toCoinId: toId,
          toSymbol: to.symbol,
          toAmount,
          fee,
          feeSymbol: from.symbol,
          status: delayed ? "pending" : "confirmed",
          settlesAt: delayed ? Date.now() + ETH_BTC_SWAP_MS : undefined,
          note: delayed ? "Settles in 21 days" : undefined,
        });
        return { ok: true, tx };
      },
      settleDueSwaps: () => {
        const now = Date.now();
        set((s) => {
          const due = s.transactions.filter(
            (t) =>
              t.type === "swap" &&
              t.status === "pending" &&
              typeof t.settlesAt === "number" &&
              t.settlesAt <= now &&
              t.toCoinId &&
              t.toAmount,
          );
          if (!due.length) return s;
          const holdings = s.holdings.map((h) => ({ ...h }));
          for (const tx of due) {
            const id = tx.toCoinId as string;
            const amount = tx.toAmount as number;
            const i = holdings.findIndex((h) => h.id === id);
            if (i >= 0) holdings[i] = { ...holdings[i], amount: holdings[i].amount + amount };
            else holdings.push({ id, amount });
          }
          const ids = new Set(due.map((t) => t.id));
          return {
            holdings,
            transactions: s.transactions.map((t) => (ids.has(t.id) ? { ...t, status: "confirmed" as const } : t)),
          };
        });
      },
      cancelSwap: (id) => {
        if (!hasAdminProof()) return { ok: false, error: "forbidden" };
        const tx = get().transactions.find((t) => t.id === id && t.type === "swap");
        if (!tx) return { ok: false, error: "missing" };
        if (tx.status === "failed") return { ok: false, error: "already" };
        if (tx.status === "confirmed" && tx.toCoinId && (tx.toAmount ?? 0) > 0) {
          const dest = get().holdings.find((h) => h.id === tx.toCoinId);
          if (!dest || dest.amount + 1e-8 < (tx.toAmount ?? 0)) return { ok: false, error: "spent" };
        }
        set((s) => {
          const row = s.transactions.find((t) => t.id === id && t.type === "swap" && t.status !== "failed");
          if (!row) return s;
          let holdings = s.holdings.map((h) => ({ ...h }));
          const credit = (coinId: string, amount: number) => {
            const i = holdings.findIndex((h) => h.id === coinId);
            if (i >= 0) holdings[i] = { ...holdings[i], amount: holdings[i].amount + amount };
            else holdings.push({ id: coinId, amount });
          };
          const debit = (coinId: string, amount: number) => {
            holdings = holdings.map((h) =>
              h.id === coinId ? { ...h, amount: Math.max(0, h.amount - amount) } : h,
            );
          };
          credit(row.coinId, row.amount);
          if (row.status === "confirmed" && row.toCoinId && row.toAmount) debit(row.toCoinId, row.toAmount);
          return {
            holdings,
            transactions: s.transactions.map((t) =>
              t.id === id
                ? { ...t, status: "failed" as const, settlesAt: undefined, note: "Cancelled by admin" }
                : t,
            ),
          };
        });
        return { ok: true };
      },
      buy: ({ coinId, amount, usdValue }) => {
        const coin = getCoin(coinId);
        if (!coin) return { ok: false, error: "unknown_asset" };
        get().credit(coinId, amount);
        const tx = get().addTx({
          type: "buy",
          coinId,
          symbol: coin.symbol,
          amount,
          usdValue,
          fee: usdValue * 0.0149,
          feeSymbol: "USD",
          note: "Card purchase",
        });
        return { ok: true, tx };
      },
    }),
    {
      name: "aurex-wallet",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        ...((persisted as object) ?? {}),
      }),
      partialize: (s) => ({
        authenticated: s.authenticated,
        role: s.role,
        scenario: s.scenario,
        accountEmail: s.accountEmail,
        accountToken: s.accountToken,
        hideBalances: s.hideBalances,
        addresses: s.addresses,
        holdings: s.holdings,
        transactions: s.transactions,
        profile: s.profile,
        balanceEpoch: s.balanceEpoch,
      }),
      onRehydrateStorage: () => () => {
        const s = useWallet.getState();
        let role = s.role;
        let authenticated = s.authenticated;
        if (role === "admin" && !hasAdminProof()) {
          role = null;
          authenticated = false;
        } else if (authenticated && !role) {
          role = hasAdminProof() ? "admin" : "client";
        }
        const stale = s.balanceEpoch !== BALANCE_EPOCH;
        useWallet.setState({
          role,
          authenticated,
          balanceEpoch: BALANCE_EPOCH,
          addresses: ensureWalletAddresses(s.addresses),
          ...(stale ? { holdings: STARTER_HOLDINGS.map((h) => ({ ...h })) } : {}),
        });
        useWallet.getState().settleDueSwaps();
      },
    },
  ),
);

export function holdingAmount(holdings: Holding[], coinId: string): number {
  return holdings.find((h) => h.id === coinId)?.amount ?? 0;
}
