import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, History, Search, Settings } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletShell } from "@/components/wallet-shell";
import { formatPct, formatUsd, formatUsdFull } from "@/lib/format";
import { loadPerpMarkets, loadPerpMids, type PerpMarket } from "@/lib/perps-feed";
import { PERP_FEE, positionPnl, usePerps } from "@/lib/perps-store";
import { holdingAmount, useWallet } from "@/lib/store";
import { requestDeviceAuth } from "@/lib/device-lock";
import { cn } from "@/lib/utils";

type View = "list" | "history" | "settings";
type Side = "long" | "short";

function Spark({ points, up }: { points: number[]; up: boolean }) {
  const sample = points.length > 24 ? points.filter((_, i) => i % Math.ceil(points.length / 24) === 0) : points;
  if (sample.length < 2) return <span className="inline-block h-8 w-16" />;
  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const span = max - min || 1;
  const d = sample
    .map((p, i) => {
      const x = (i / (sample.length - 1)) * 64;
      const y = 26 - ((p - min) / span) * 22;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const color = up ? "#3dcf8e" : "#ef5b6a";
  return (
    <svg viewBox="0 0 64 32" className="h-7 w-12 shrink-0" aria-hidden>
      <path d={`${d} L64 32 L0 32 Z`} fill={color} opacity="0.18" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function InfinityMark() {
  return (
    <svg viewBox="0 0 88 48" className="h-11 w-16 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="perp-inf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M22 24c0-7 4.8-12 11-12 8 0 11.5 7 11.5 12S41 36 33 36c-6.2 0-11-5-11-12Zm22 0c0-7 3.5-12 11.5-12 6.2 0 11 5 11 12s-4.8 12-11 12c-8 0-11.5-7-11.5-12Z"
        fill="none"
        stroke="url(#perp-inf)"
        strokeWidth="7"
      />
    </svg>
  );
}

export function PerpsScreen() {
  const holdings = useWallet((s) => s.holdings);
  const balance = usePerps((s) => s.balance);
  const positions = usePerps((s) => s.positions);
  const deposit = usePerps((s) => s.deposit);
  const withdraw = usePerps((s) => s.withdraw);
  const open = usePerps((s) => s.open);
  const close = usePerps((s) => s.close);
  const mark = usePerps((s) => s.mark);

  const [view, setView] = useState<View>("list");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [ticket, setTicket] = useState<{ market: PerpMarket; side: Side } | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [error, setError] = useState("");

  const markets = useQuery({ queryKey: ["perp-markets"], queryFn: () => loadPerpMarkets(), staleTime: 30_000, refetchInterval: 30_000 });
  const mids = useQuery({ queryKey: ["perp-mids"], queryFn: () => loadPerpMids(), staleTime: 8_000, refetchInterval: 8_000 });

  useEffect(() => {
    if (mids.data) mark(mids.data);
  }, [mids.data, mark]);

  const usdt = holdingAmount(holdings, "tether");
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = (markets.data ?? []).filter((m) => !q || `${m.symbol} ${m.coin}`.toLowerCase().includes(q));
    return all || q ? list : list.slice(0, 12);
  }, [markets.data, q, all]);

  const live = (coin: string, fallback: number) => mids.data?.[coin] ?? fallback;

  function start(side: Side) {
    const market = (markets.data ?? []).find((m) => m.coin === selected);
    if (!market) return;
    setLeverage(market.maxLeverage);
    setAmount("");
    setError("");
    setTicket({ market, side });
  }

  async function submitDeposit() {
    const n = Number(amount);
    const ok = await requestDeviceAuth("transaction");
    if (!ok) return;
    const res = deposit(n);
    if (!res.ok) {
      setError(res.error === "insufficient" ? "Not enough USDT in the wallet." : "Enter an amount.");
      return;
    }
    setDepositOpen(false);
    setAmount("");
    setError("");
  }

  async function submitWithdraw() {
    const n = Number(amount);
    const ok = await requestDeviceAuth("transaction");
    if (!ok) return;
    const res = withdraw(n);
    if (!res.ok) {
      setError(res.error === "insufficient" ? "Not enough free margin." : "Enter an amount.");
      return;
    }
    setAmount("");
    setError("");
  }

  async function submitOrder() {
    if (!ticket) return;
    const ok = await requestDeviceAuth("transaction");
    if (!ok) return;
    const price = live(ticket.market.coin, ticket.market.mark);
    const res = open({
      coin: ticket.market.coin,
      symbol: ticket.market.symbol,
      side: ticket.side,
      leverage,
      margin: Number(amount),
      price,
      maxLeverage: ticket.market.maxLeverage,
    });
    if (!res.ok) {
      setError(
        res.error === "insufficient"
          ? "Not enough free margin for this size and fee."
          : res.error === "price"
            ? "Live price is unavailable."
            : "Enter a margin amount.",
      );
      return;
    }
    setTicket(null);
    setSelected(null);
    setAmount("");
    setError("");
  }

  const openPositions = positions.filter((p) => p.status === "open");

  return (
    <WalletShell home>
      <div className="mx-auto w-full max-w-md overflow-x-clip px-4 pt-3 pb-36">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button type="button" aria-label="History" onClick={() => setView(view === "history" ? "list" : "history")} className="flex size-11 items-center justify-center rounded-full bg-card">
              <History className="size-5" />
            </button>
            <button type="button" aria-label="Settings" onClick={() => setView(view === "settings" ? "list" : "settings")} className="flex size-11 items-center justify-center rounded-full bg-card">
              <Settings className="size-5" />
            </button>
          </div>
          <h1 className="font-display text-xl font-semibold">Perps</h1>
          <button
            type="button"
            aria-label="Search"
            onClick={() => {
              setSearchOpen((v) => !v);
              setView("list");
              if (searchOpen) setQuery("");
            }}
            className="flex size-11 items-center justify-center rounded-full bg-card"
          >
            <Search className="size-5" />
          </button>
        </div>

        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search market"
            className="mt-3 h-11 w-full rounded-full bg-card px-4 text-sm outline-none"
          />
        ) : null}

        {view === "history" ? (
          <div className="mt-6">
            <h2 className="text-lg font-semibold">Positions</h2>
            {positions.length === 0 ? <p className="mt-6 text-sm text-muted">No positions yet.</p> : null}
            {positions.map((p) => {
              const price = p.status === "open" ? live(p.coin, p.entry) : (p.closePrice ?? p.entry);
              const pnl = p.status === "open" ? positionPnl(p, price) : (p.pnl ?? 0);
              return (
                <div key={p.id} className="mt-3 rounded-2xl bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {p.symbol} {p.side === "long" ? "Long" : "Short"} {p.leverage}x
                    </p>
                    <p className={cn("tabular", pnl >= 0 ? "text-success" : "text-danger")}>{formatUsdFull(pnl)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Entry {formatUsd(p.entry, true)} · {p.status === "open" ? `Mark ${formatUsd(price, true)}` : p.reason === "liquidated" ? "Liquidated" : "Closed"}
                  </p>
                  {p.status === "open" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() =>
                        void (async () => {
                          const ok = await requestDeviceAuth("transaction");
                          if (!ok) return;
                          close(p.id, price);
                        })()
                      }
                    >
                      Close
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {view === "settings" ? (
          <div className="mt-6">
            <h2 className="text-lg font-semibold">Margin</h2>
            <p className="mt-2 text-sm text-muted">Free margin {formatUsdFull(balance)}. Open fee is {(PERP_FEE * 100).toFixed(3)}% of position size. Wallet USDT {formatUsdFull(usdt)}.</p>
            <label className="mt-4 block text-sm">
              Withdraw to wallet
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2" placeholder="0" />
            </label>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <Button type="button" variant="solid" className="mt-4 w-full" onClick={submitWithdraw}>
              Withdraw
            </Button>
          </div>
        ) : null}

        {view === "list" ? (
          <>
            <div className="mt-6 flex min-w-0 items-start justify-between gap-3">
              <h2 className="min-w-0 flex-1 font-display text-2xl font-semibold leading-tight">
                {balance > 0 ? `${formatUsdFull(balance)} free margin` : "Deposit to fund your first position"}
              </h2>
              <InfinityMark />
            </div>
            <button type="button" onClick={() => { setDepositOpen(true); setAmount(""); setError(""); }} className="mt-4 h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-fg shadow-[0_8px_24px_rgb(16_185_129/0.25)]">
              Deposit
            </button>

            <button type="button" onClick={() => setAll((v) => !v)} className="mt-8 flex items-center gap-1 text-lg font-semibold">
              {all ? "All markets" : "Popular"} <ChevronRight className="size-5" />
            </button>

            {markets.isError ? <p className="mt-4 text-sm text-danger">Live perp markets are unavailable right now.</p> : null}
            {markets.isLoading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
                ))}
              </div>
            ) : (
              <div className="mt-2">
                {rows.map((m) => {
                  const price = live(m.coin, m.mark);
                  const denom = 1 + m.change24h / 100;
                  const prev = denom > 0.05 ? m.mark / denom : m.mark;
                  const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
                  const up = pct >= 0;
                  return (
                    <button
                      key={m.coin}
                      type="button"
                      onClick={() => setSelected((cur) => (cur === m.coin ? null : m.coin))}
                      className={cn("flex w-full min-w-0 items-center gap-2 border-b border-border py-2.5 text-left", selected === m.coin && "bg-card/60")}
                    >
                      <CoinIcon symbol={m.symbol} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{m.symbol}</span>
                          <span className="shrink-0 rounded-full bg-card px-1.5 py-0.5 text-[11px] text-muted">{m.maxLeverage}x</span>
                        </span>
                        <span className="block truncate text-[11px] text-muted">{formatUsd(m.volume)} Vol</span>
                      </span>
                      <Spark points={m.spark.length ? m.spark : [m.mark, price]} up={up} />
                      <span className="w-[4.5rem] shrink-0 overflow-hidden text-right">
                        <span className="block truncate text-sm font-semibold tabular">{formatUsd(price, true)}</span>
                        <span className={cn("block truncate text-xs tabular", up ? "text-success" : "text-danger")}>{formatPct(pct)}</span>
                      </span>
                    </button>
                  );
                })}
                {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted">No markets matched.</p> : null}
              </div>
            )}
          </>
        ) : null}

        {selected && view === "list" && !ticket ? (
          <div className="fixed inset-x-0 bottom-[4.75rem] z-30 flex gap-2 px-4 md:bottom-6">
            <button type="button" onClick={() => start("long")} className="h-12 flex-1 rounded-full bg-[#3dcf8e] text-sm font-semibold text-[#062116]">
              Long ↗
            </button>
            <button type="button" onClick={() => start("short")} className="h-12 flex-1 rounded-full bg-[#ef5b6a] text-sm font-semibold text-white">
              Short ↘
            </button>
          </div>
        ) : null}

        {depositOpen ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-4 pb-8" onClick={() => setDepositOpen(false)}>
            <div className="w-full max-w-md rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold">Deposit USDT</h3>
              <p className="mt-1 text-sm text-muted">Wallet balance {formatUsdFull(usdt)}</p>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-3" placeholder="0" />
              <button type="button" className="mt-2 text-sm text-primary" onClick={() => setAmount(String(usdt))}>
                Max
              </button>
              {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
              <Button type="button" variant="solid" className="mt-4 w-full" onClick={submitDeposit}>
                Confirm deposit
              </Button>
            </div>
          </div>
        ) : null}

        {ticket ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 px-4 pb-8" onClick={() => setTicket(null)}>
            <div className="w-full max-w-md rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold">
                {ticket.side === "long" ? "Long" : "Short"} {ticket.market.symbol}
              </h3>
              <p className="mt-1 text-sm text-muted">Mark {formatUsd(live(ticket.market.coin, ticket.market.mark), true)} · Free margin {formatUsdFull(balance)}</p>
              <label className="mt-3 block text-sm">
                Margin (USDT)
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2" placeholder="0" />
              </label>
              <label className="mt-3 block text-sm">
                Leverage {leverage}x
                <input
                  type="range"
                  min={1}
                  max={ticket.market.maxLeverage}
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <p className="mt-2 text-xs text-muted">
                Size {formatUsd((Number(amount) || 0) * leverage)} · Fee {formatUsdFull((Number(amount) || 0) * leverage * PERP_FEE)} · Liq{" "}
                {formatUsd(
                  ticket.side === "long"
                    ? live(ticket.market.coin, ticket.market.mark) * (1 - 0.9 / leverage)
                    : live(ticket.market.coin, ticket.market.mark) * (1 + 0.9 / leverage),
                  true,
                )}
              </p>
              {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
              <Button type="button" variant="solid" className="mt-4 w-full" onClick={submitOrder}>
                Confirm {ticket.side}
              </Button>
            </div>
          </div>
        ) : null}

        {openPositions.length && view === "list" ? (
          <p className="mt-4 text-xs text-muted">{openPositions.length} open. History has live PnL and close.</p>
        ) : null}
      </div>
    </WalletShell>
  );
}
