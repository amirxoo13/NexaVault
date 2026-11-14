import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  History,
  Infinity as InfinityIcon,
  LogOut,
  Scan,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { WalletShell } from "@/components/wallet-shell";
import { useMarketMap, useMarkets } from "@/hooks/use-markets";
import { COINS, COIN_BY_ID, usdPrice } from "@/lib/coins";
import { formatAmount, formatPct, formatUsd, formatUsdFull } from "@/lib/format";
import { t } from "@/lib/i18n";
import { hasAdminProof } from "@/lib/admin-proof";
import { loadPerpMarkets } from "@/lib/perps-feed";
import { useSite } from "@/lib/site-store";
import { useWallet } from "@/lib/store";
import { cn } from "@/lib/utils";

const WATCH_KEY = "trust-home-watch";
const DEFAULT_WATCH = ["solana", "binancecoin", "bitcoin", "ethereum"];

function rowTitle(id: string, name: string) {
  if (id === "tether") return "Tether USDT";
  if (id === "tron") return "Tron";
  return name;
}

function readWatch(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || "null") as unknown;
    const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string" && Boolean(COIN_BY_ID[id])) : [];
    return ids.length ? ids : DEFAULT_WATCH;
  } catch {
    return DEFAULT_WATCH;
  }
}

function formatMove(value: number): { text: string; tone: "up" | "down" | "flat" } {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-6) return { text: "$0.00", tone: "flat" };
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  const body = abs.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
  return { text: `${value > 0 ? "+" : "-"}${body}`, tone: value > 0 ? "up" : "down" };
}

function formatHeaderMove(usd: number, pct: number): string {
  const money = Math.abs(usd) < 0.005 ? "$0.00" : `${usd < 0 ? "-" : "+"}${formatUsdFull(Math.abs(usd))}`;
  const pctText = `${pct < 0 ? "-" : "+"}${Math.abs(pct).toFixed(2)}%`;
  return `${money} (${pctText})`;
}

export function WalletHomeScreen() {
  const holdings = useWallet((s) => s.holdings);
  const hide = useWallet((s) => s.hideBalances);
  const toggle = useWallet((s) => s.toggleHideBalances);
  const role = useWallet((s) => s.role);
  const logout = useWallet((s) => s.logout);
  const site = useSite();
  const navigate = useNavigate();
  const copy = t();
  const markets = useMarketMap();
  const q = useMarkets();
  const perps = useQuery({ queryKey: ["home-perps"], queryFn: () => loadPerpMarkets(), staleTime: 30_000 });
  const [qtext, setQtext] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [watch, setWatch] = useState<string[]>(DEFAULT_WATCH);
  const [editingWatch, setEditingWatch] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);

  const walletLabel = site.walletName.trim() === "Main Wallet" ? "Primary Vault #1" : site.walletName;

  useEffect(() => {
    setWatch(readWatch());
  }, []);

  useEffect(() => {
    function open() {
      setSearchOpen(true);
      setShowAll(true);
      queueMicrotask(() => findRef.current?.focus());
    }
    if (sessionStorage.getItem("aurex-open-find") === "1") {
      sessionStorage.removeItem("aurex-open-find");
      open();
    }
    window.addEventListener("aurex-find", open);
    return () => window.removeEventListener("aurex-find", open);
  }, []);

  const rows = useMemo(() => {
    const list = holdings
      .map((h) => {
        const meta = COIN_BY_ID[h.id];
        const m = markets[h.id];
        const price = usdPrice(h.id, m?.price);
        const usd = h.amount * price;
        const change = m?.change24h ?? 0;
        return {
          ...h,
          meta,
          price,
          usd,
          change,
          delta: h.amount === 0 ? 0 : (usd * change) / 100,
          image: m?.image ?? meta?.image,
        };
      })
      .filter((r) => r.meta);
    const pin = (id: string) => (id === "bitcoin" ? 0 : id === "ethereum" ? 1 : 2);
    return list.sort((a, b) => {
      const aHeld = a.amount > 1e-12 ? 0 : 1;
      const bHeld = b.amount > 1e-12 ? 0 : 1;
      if (aHeld !== bHeld) return aHeld - bHeld;
      if (aHeld === 0 && b.usd !== a.usd) return b.usd - a.usd;
      const byPin = pin(a.id) - pin(b.id);
      if (byPin !== 0) return byPin;
      return a.meta!.symbol.localeCompare(b.meta!.symbol);
    });
  }, [holdings, markets]);

  const total = rows.reduce((s, r) => s + r.usd, 0);
  const changeUsd = rows.reduce((s, r) => s + r.delta, 0);
  const base = total - changeUsd;
  const changePct = base !== 0 ? (changeUsd / base) * 100 : 0;
  const query = qtext.trim().toLowerCase();
  const filtered = query
    ? rows.filter((r) => r.meta!.name.toLowerCase().includes(query) || r.meta!.symbol.toLowerCase().includes(query))
    : rows;
  const visible = query || showAll ? filtered : filtered.slice(0, 4);
  const balanceText = hide ? "••••••" : q.isLoading && total === 0 ? "—" : formatUsdFull(total);

  const actions = [
    { to: "/wallet/send", icon: ArrowUpRight, label: site.actionSend, hot: true },
    { to: "/wallet/receive", icon: ArrowDownLeft, label: site.actionReceive, hot: false },
    { to: "/wallet/swap", icon: ArrowLeftRight, label: site.tabSwap, hot: false },
    { to: "/wallet/buy", icon: CreditCard, label: site.actionBuy, hot: false },
  ] as const;

  function ask() {
    const s = question.trim().toLowerCase();
    if (!s) {
      setAnswer("Ask about your vault valuation, token balances, swap fees, or perpetuals.");
      return;
    }
    if (s.includes("balance") || s.includes("total") || s.includes("worth") || s.includes("wallet") || s.includes("vault")) {
      setAnswer(`${walletLabel} net valuation is ${formatUsdFull(total)}. 24h delta: ${formatHeaderMove(changeUsd, changePct)}.`);
      return;
    }
    const hit = rows.find((r) => s.includes(r.meta!.symbol.toLowerCase()) || s.includes(r.meta!.name.toLowerCase()));
    if (hit) {
      setAnswer(
        `${rowTitle(hit.id, hit.meta!.name)}: ${formatAmount(hit.amount)} ${hit.meta!.symbol} (${formatUsdFull(hit.usd)}). Spot ${formatUsd(hit.price, true)} · 24h ${formatPct(hit.change)}.`,
      );
      return;
    }
    if (s.includes("fee") || s.includes("swap")) {
      setAnswer("Standard cross-asset swap fee is 0.3%. Same-chain stablecoin routing is 0%. ETH → BTC settles in 21 real days.");
      return;
    }
    if (s.includes("send")) {
      setAnswer("Open Send, choose an asset from your vault, enter or scan the recipient address, and authorize.");
      return;
    }
    if (s.includes("perp") || s.includes("long") || s.includes("short")) {
      setAnswer("Perps uses USDT margin from your vault. Deposit USDT to open leveraged long or short positions.");
      return;
    }
    setAnswer(`Vault valuation is ${formatUsdFull(total)}. Ask about any token ticker, swap fees, transfers, or perps.`);
  }

  function toggleWatch(id: string) {
    setWatch((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const saved = next.length ? next : DEFAULT_WATCH;
      localStorage.setItem(WATCH_KEY, JSON.stringify(saved));
      return saved;
    });
  }

  return (
    <WalletShell home>
      <div className="mx-auto w-full max-w-2xl overflow-x-clip px-4 pt-4 pb-8">
        <div className="flex items-center justify-between gap-2">
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className="flex h-11 max-w-full items-center gap-2.5 rounded-2xl bg-card ps-2 pe-3.5 shadow-border transition-colors hover:bg-card-elevated"
              aria-expanded={menu}
              aria-label={`${walletLabel} ${balanceText}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg">
                <Shield className="size-4" strokeWidth={2.2} />
              </span>
              <span className="truncate font-display text-sm font-semibold tabular">{balanceText}</span>
              <ChevronDown className="size-4 text-muted" />
            </button>
            {menu ? (
              <>
                <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close menu" onClick={() => setMenu(false)} />
                <div className="absolute top-12 left-0 z-50 w-60 rounded-2xl bg-card p-2 shadow-float shadow-border">
                  <p className="px-3 py-2 font-mono text-xs text-muted uppercase">{walletLabel}</p>
                  <Link to="/wallet/profile" onClick={() => setMenu(false)} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-card-elevated">
                    <UserRound className="size-4 text-primary" />
                    {site.tabProfile}
                  </Link>
                  <Link to="/wallet/settings" onClick={() => setMenu(false)} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-card-elevated">
                    <Settings className="size-4 text-primary" />
                    {copy.wallet.settings}
                  </Link>
                  <button type="button" onClick={toggle} className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-card-elevated">
                    {hide ? <Eye className="size-4 text-primary" /> : <EyeOff className="size-4 text-primary" />}
                    {hide ? copy.wallet.show : copy.wallet.hide}
                  </button>
                  {role === "admin" && hasAdminProof() ? (
                    <Link to="/studio" onClick={() => setMenu(false)} className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm hover:bg-card-elevated">
                      <SlidersHorizontal className="size-4 text-primary" />
                      Control panel
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="mt-1 flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-danger hover:bg-danger/10"
                    onClick={() => {
                      logout();
                      void navigate({ to: "/login" });
                    }}
                  >
                    <LogOut className="size-4" />
                    {copy.wallet.logout}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((v) => !v);
                setShowAll(true);
              }}
              aria-label={copy.wallet.search}
              className="flex size-10 items-center justify-center rounded-xl bg-card text-muted shadow-border hover:text-foreground"
            >
              <Search className="size-4" />
            </button>
            <Link
              to="/wallet/activity"
              aria-label={copy.wallet.activity}
              className="flex size-10 items-center justify-center rounded-xl bg-card text-muted shadow-border hover:text-foreground"
            >
              <History className="size-4" />
            </Link>
            <Link
              to="/wallet/receive"
              aria-label={site.actionReceive}
              className="flex size-10 items-center justify-center rounded-xl bg-card text-muted shadow-border hover:text-foreground"
            >
              <Scan className="size-4" />
            </Link>
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#10231f] via-[#0d1520] to-[#0d131c] p-6 shadow-float shadow-border">
          <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-wider text-muted uppercase">{copy.wallet.balance}</span>
            <button
              type="button"
              onClick={toggle}
              className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs text-muted hover:text-foreground"
            >
              {hide ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              <span>{hide ? "Show" : "Hide"}</span>
            </button>
          </div>

          <p className="mt-2 max-w-full overflow-hidden font-display text-[clamp(2.2rem,10vw,3rem)] leading-none font-bold tracking-tight text-ellipsis tabular">
            {balanceText}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium tabular",
                changeUsd >= 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
              )}
            >
              {hide ? "••••" : formatHeaderMove(changeUsd, changePct)}
            </span>
            <span className="text-xs text-muted">24h portfolio delta</span>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-2.5">
            {actions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 transition-transform active:scale-95",
                  a.hot
                    ? "bg-primary text-primary-fg shadow-[0_8px_24px_rgb(16_185_129/0.3)]"
                    : "bg-card/85 text-foreground shadow-border hover:bg-card-elevated",
                )}
              >
                <a.icon className="size-5" strokeWidth={2.1} />
                <span className="max-w-full truncate text-xs font-semibold">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <Link
          to="/wallet/swap"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-border transition-colors hover:bg-card-elevated"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-primary">
              <DollarSign className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">0% Protocol Fee on Stablecoin Swaps</p>
              <p className="truncate text-xs text-muted">Instant same-chain routing across supported networks</p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted" />
        </Link>

        <div className="mt-7 flex items-center justify-between">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="flex items-center gap-1.5 font-display text-lg font-bold">
            <span>Tokens</span>
            <ChevronRight className="size-4 text-primary" />
          </button>
          <span className="font-mono text-xs text-muted">{filtered.length} assets</span>
        </div>

        {searchOpen ? (
          <input
            ref={findRef}
            value={qtext}
            onChange={(e) => setQtext(e.target.value)}
            placeholder={copy.wallet.search}
            className="mt-3 h-11 w-full rounded-xl bg-input px-4 text-sm shadow-border outline-none placeholder:text-muted focus-visible:shadow-[0_0_0_1px_var(--color-primary)]"
          />
        ) : null}

        <div className="mt-3 grid gap-2">
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-card py-10 text-center text-sm text-muted shadow-border">{copy.wallet.empty}</p>
          ) : (
            visible.map((r) => {
              const move = formatMove(r.delta);
              return (
                <Link
                  key={r.id}
                  to="/wallet/asset/$id"
                  params={{ id: r.id }}
                  className="flex min-w-0 items-center gap-3.5 rounded-2xl bg-card px-4 py-3 shadow-border transition-colors hover:bg-card-elevated"
                >
                  <CoinIcon id={r.id} symbol={r.meta!.symbol} image={r.image} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold">{rowTitle(r.id, r.meta!.name)}</p>
                    <p className="truncate font-mono text-xs text-muted tabular">
                      {hide ? "••" : formatAmount(r.amount)} {r.meta!.symbol}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-mono font-semibold tabular">{hide ? "••" : formatUsdFull(r.usd)}</p>
                    <p
                      className={cn(
                        "font-mono text-xs tabular",
                        move.tone === "up" && "text-success",
                        move.tone === "down" && "text-danger",
                        move.tone === "flat" && "text-muted",
                      )}
                    >
                      {hide ? "" : move.text}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {!query && !showAll && filtered.length > 4 ? (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-card text-xs font-semibold text-primary shadow-border hover:bg-card-elevated"
          >
            View all
            <ChevronRight className="size-4" />
          </button>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <Link to="/wallet/perps" className="flex items-center gap-1.5 font-display text-lg font-bold">
            <InfinityIcon className="size-4 text-primary" />
            <span>Perps</span>
            <ChevronRight className="size-4 text-primary" />
          </Link>
        </div>
        <div className="scroll-x mt-3 flex gap-3 pb-1">
          {(perps.data ?? []).slice(0, 8).map((m) => (
            <Link
              key={m.coin}
              to="/wallet/perps"
              className="w-40 shrink-0 rounded-2xl bg-card p-3.5 shadow-border transition-colors hover:bg-card-elevated"
            >
              <div className="flex items-center justify-between">
                <CoinIcon symbol={m.symbol} size={32} />
                <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                  {m.maxLeverage}x
                </span>
              </div>
              <p className="mt-3 font-display font-semibold">{m.symbol}</p>
              <p className="mt-0.5 font-mono text-xs text-muted">{formatUsd(m.volume)} Vol</p>
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAskOpen(true)}
          className="mt-6 flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#0d2720] to-[#0f1c29] p-3.5 shadow-border"
        >
          <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-fg">
              <Sparkles className="size-4" />
            </span>
            <span className="truncate">{site.brandName} AI</span>
          </span>
          <span className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-card/80 px-3 text-xs font-medium text-primary shadow-border">
            Ask anything
            <ChevronRight className="size-3.5" />
          </span>
        </button>

        <div className="mt-8 flex items-center justify-between">
          <button type="button" onClick={() => setEditingWatch(true)} className="flex items-center gap-1.5 font-display text-lg font-bold">
            <span>Watchlist</span>
            <ChevronRight className="size-4 text-primary" />
          </button>
          <button
            type="button"
            onClick={() => setEditingWatch(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-card px-3 text-xs font-medium text-muted shadow-border hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5" />
            Customize
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          {watch.map((id) => {
            const meta = COIN_BY_ID[id];
            const m = markets[id];
            if (!meta) return null;
            const price = usdPrice(id, m?.price);
            const up = (m?.change24h ?? 0) >= 0;
            return (
              <Link
                key={id}
                to="/wallet/asset/$id"
                params={{ id }}
                className="flex min-w-0 items-center gap-3.5 rounded-2xl bg-card px-4 py-3 shadow-border transition-colors hover:bg-card-elevated"
              >
                <CoinIcon id={id} symbol={meta.symbol} image={m?.image ?? meta.image} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-semibold">{meta.symbol}</span>
                  <span className="block truncate text-xs text-muted">
                    {m?.marketCap ? `${formatUsd(m.marketCap)} MCap` : "Live price"}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block font-mono font-semibold tabular">{formatUsd(price, true)}</span>
                  <span className={cn("font-mono text-xs tabular", up ? "text-success" : "text-danger")}>
                    {formatPct(m?.change24h ?? 0)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {askOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm" onClick={() => setAskOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-float shadow-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="font-display font-bold">{site.brandName} AI</h3>
            </div>
            <p className="mt-1 text-xs text-muted">Answers use this vault and live market prices.</p>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything"
                className="h-11 min-w-0 flex-1 rounded-xl bg-input px-3.5 text-sm shadow-border outline-none"
              />
              <button type="submit" className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">
                Ask
              </button>
            </form>
            {answer ? <p className="mt-3 rounded-xl bg-input p-3 text-sm leading-relaxed text-foreground">{answer}</p> : null}
          </div>
        </div>
      ) : null}

      {editingWatch ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm" onClick={() => setEditingWatch(false)}>
          <div className="max-h-[70dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-card p-5 shadow-float shadow-border" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold">Customize watchlist</h3>
            <div className="mt-3 divide-y divide-border">
              {COINS.map((coin) => {
                const on = watch.includes(coin.id);
                return (
                  <button key={coin.id} type="button" onClick={() => toggleWatch(coin.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <CoinIcon id={coin.id} symbol={coin.symbol} image={coin.image} size={32} />
                    <span className="min-w-0 flex-1 truncate font-medium">{coin.symbol}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-xs", on ? "bg-accent-soft text-primary" : "text-muted")}>
                      {on ? "On" : "Off"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setEditingWatch(false)} className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-fg">
              Done
            </button>
          </div>
        </div>
      ) : null}
    </WalletShell>
  );
}
