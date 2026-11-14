import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useWallet } from "@/lib/store";

export interface PerpPosition {
  id: string;
  coin: string;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  margin: number;
  entry: number;
  size: number;
  liq: number;
  openedAt: number;
  status: "open" | "closed";
  closedAt?: number;
  closePrice?: number;
  pnl?: number;
  reason?: "closed" | "liquidated";
}

interface PerpsState {
  balance: number;
  positions: PerpPosition[];
  deposit: (amount: number) => { ok: true } | { ok: false; error: "amount" | "insufficient" };
  withdraw: (amount: number) => { ok: true } | { ok: false; error: "amount" | "insufficient" };
  open: (opts: {
    coin: string;
    symbol: string;
    side: "long" | "short";
    leverage: number;
    margin: number;
    price: number;
    maxLeverage: number;
  }) => { ok: true; id: string } | { ok: false; error: "amount" | "price" | "leverage" | "insufficient" };
  close: (id: string, price: number) => { ok: true; pnl: number } | { ok: false; error: "missing" | "price" };
  mark: (mids: Record<string, number>) => void;
}

const FEE = 0.00045;

function id(): string {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function liqPrice(entry: number, leverage: number, side: "long" | "short"): number {
  const move = (1 / leverage) * 0.9;
  return side === "long" ? entry * (1 - move) : entry * (1 + move);
}

export function positionPnl(p: Pick<PerpPosition, "side" | "entry" | "size">, price: number): number {
  return p.side === "long" ? (price - p.entry) * p.size : (p.entry - price) * p.size;
}

export const usePerps = create<PerpsState>()(
  persist(
    (set, get) => ({
      balance: 0,
      positions: [],
      deposit: (amount) => {
        if (!(amount > 0) || !Number.isFinite(amount)) return { ok: false, error: "amount" };
        const ok = useWallet.getState().debit("tether", amount);
        if (!ok) return { ok: false, error: "insufficient" };
        set((s) => ({ balance: s.balance + amount }));
        return { ok: true };
      },
      withdraw: (amount) => {
        if (!(amount > 0) || !Number.isFinite(amount)) return { ok: false, error: "amount" };
        if (get().balance + 1e-8 < amount) return { ok: false, error: "insufficient" };
        set((s) => ({ balance: Math.max(0, s.balance - amount) }));
        useWallet.getState().credit("tether", amount);
        return { ok: true };
      },
      open: ({ coin, symbol, side, leverage, margin, price, maxLeverage }) => {
        if (!(margin > 0) || !Number.isFinite(margin)) return { ok: false, error: "amount" };
        if (!(price > 0)) return { ok: false, error: "price" };
        const lev = Math.min(Math.max(1, Math.round(leverage)), Math.max(1, maxLeverage));
        const notional = margin * lev;
        const fee = notional * FEE;
        if (get().balance + 1e-8 < margin + fee) return { ok: false, error: "insufficient" };
        const size = notional / price;
        const row: PerpPosition = {
          id: id(),
          coin,
          symbol,
          side,
          leverage: lev,
          margin,
          entry: price,
          size,
          liq: liqPrice(price, lev, side),
          openedAt: Date.now(),
          status: "open",
        };
        set((s) => ({
          balance: s.balance - margin - fee,
          positions: [row, ...s.positions].slice(0, 100),
        }));
        return { ok: true, id: row.id };
      },
      close: (pid, price) => {
        const row = get().positions.find((p) => p.id === pid && p.status === "open");
        if (!row) return { ok: false, error: "missing" };
        if (!(price > 0)) return { ok: false, error: "price" };
        const pnl = Math.max(-row.margin, positionPnl(row, price));
        set((s) => ({
          balance: s.balance + row.margin + pnl,
          positions: s.positions.map((p) =>
            p.id === pid ? { ...p, status: "closed", closedAt: Date.now(), closePrice: price, pnl, reason: "closed" } : p,
          ),
        }));
        return { ok: true, pnl };
      },
      mark: (mids) => {
        set((s) => {
          let changed = false;
          const positions = s.positions.map((p) => {
            if (p.status !== "open") return p;
            const price = mids[p.coin];
            if (!(price > 0)) return p;
            const hit = p.side === "long" ? price <= p.liq : price >= p.liq;
            if (!hit) return p;
            changed = true;
            return {
              ...p,
              status: "closed" as const,
              closedAt: Date.now(),
              closePrice: p.liq,
              pnl: -p.margin,
              reason: "liquidated" as const,
            };
          });
          return changed ? { positions } : s;
        });
      },
    }),
    {
      name: "trust-perps",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ balance: s.balance, positions: s.positions }),
    },
  ),
);

export const PERP_FEE = FEE;
