import { Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing-shell";
import { CoinIcon } from "@/components/coin-icon";
import { useMarkets } from "@/hooks/use-markets";
import { getCoin } from "@/lib/coins";
import { formatPct, formatUsd } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function MarketsScreen({ embedded = false }: { embedded?: boolean }) {
  const copy = t();
  const q = useMarkets();
  const body = (
    <div className={embedded ? "px-4 py-6 md:px-8" : "mx-auto max-w-6xl px-4 py-12"}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{copy.markets.title}</h1>
          <p className="mt-2 text-sm text-muted">{copy.markets.sub}</p>
        </div>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-primary">
          {q.isFetching ? "…" : copy.markets.live}
        </span>
      </div>
      {q.isError ? <p className="mt-4 text-sm text-danger">{copy.markets.error}</p> : null}
      <div className="mt-8 overflow-hidden rounded-xl bg-card shadow-border">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 border-b border-border px-4 py-3 text-xs text-muted sm:grid">
          <span>Asset</span>
          <span className="text-end">{copy.markets.price}</span>
          <span className="text-end">{copy.markets.change}</span>
          <span className="text-end">{copy.markets.cap}</span>
        </div>
        {(q.data ?? []).map((m) => {
          const up = m.change24h >= 0;
          const meta = getCoin(m.id);
          const name = m.id === "tether" ? (meta?.name ?? "Tether TRC20") : m.name;
          const symbol = m.id === "tether" ? "USDT · TRC20" : m.symbol;
          const inner = (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div className="flex items-center gap-3">
                <CoinIcon id={m.id} symbol={m.symbol} image={m.image} />
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted">{symbol}</p>
                </div>
              </div>
              <p className="text-end text-sm tabular">{formatUsd(m.price, true)}</p>
              <p className={cn("hidden text-end text-sm tabular sm:block", up ? "text-success" : "text-danger")}>
                {formatPct(m.change24h)}
              </p>
              <p className="hidden text-end text-sm text-muted tabular sm:block">{formatUsd(m.marketCap)}</p>
            </div>
          );
          return embedded ? (
            <Link key={m.id} to="/wallet/asset/$id" params={{ id: m.id }} className="block border-b border-border last:border-b-0 hover:bg-card-elevated">
              {inner}
            </Link>
          ) : (
            <div key={m.id} className="border-b border-border last:border-b-0">
              {inner}
            </div>
          );
        })}
        {q.isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-card-elevated" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (embedded) return body;
  return <MarketingShell>{body}</MarketingShell>;
}
