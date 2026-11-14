import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Plus } from "lucide-react";
import { WalletShell } from "@/components/wallet-shell";
import { formatAmount, formatDuration, formatTime, formatUsdFull } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useWallet, type TxType } from "@/lib/store";
import { cn } from "@/lib/utils";

const icons: Record<TxType, typeof ArrowUpRight> = {
  send: ArrowUpRight,
  receive: ArrowDownLeft,
  swap: ArrowLeftRight,
  buy: Plus,
};

export function WalletActivityScreen() {
  const txs = useWallet((s) => s.transactions);
  const copy = t();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <WalletShell title={copy.wallet.activity}>
      <div className="mx-auto w-full max-w-xl px-4 py-8">
        <h1 className="font-display text-xl font-semibold">{copy.wallet.activity}</h1>
        {txs.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted">{copy.wallet.historyEmpty}</p>
        ) : (
          <div className="mt-6 divide-y divide-border">
            {txs.map((tx) => {
              const Icon = icons[tx.type];
              const positive = tx.type === "receive" || tx.type === "buy";
              return (
                <div key={tx.id} className="flex items-start gap-3 py-4">
                  <span className="flex size-10 items-center justify-center rounded-full bg-card-elevated">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="capitalize">{tx.type}</p>
                      <p className={cn("tabular", positive ? "text-success" : "text-foreground")}>
                        {positive ? "+" : "−"}
                        {formatAmount(tx.amount)} {tx.symbol}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted">
                      <span>{formatTime(tx.timestamp)}</span>
                      <span>{formatUsdFull(tx.usdValue)}</span>
                    </div>
                    {tx.type === "swap" && tx.toSymbol ? (
                      <p className="mt-1 text-xs text-muted">
                        → {formatAmount(tx.toAmount ?? 0, 6)} {tx.toSymbol}
                        {tx.status === "pending" && tx.settlesAt
                          ? ` · Pending ${formatDuration(tx.settlesAt - now)}`
                          : tx.status === "failed"
                            ? " · Cancelled"
                            : ""}
                      </p>
                    ) : null}
                    {tx.status === "pending" && tx.settlesAt && tx.type !== "swap" ? (
                      <p className="mt-1 text-xs text-muted">Pending · {formatDuration(Math.max(0, tx.settlesAt - now))}</p>
                    ) : null}
                    {tx.type === "receive" && tx.fromAddress ? (
                      <p className="mt-1 font-mono text-[11px] break-all text-muted">From {tx.fromAddress}</p>
                    ) : tx.toAddress ? (
                      <p className="mt-1 font-mono text-[11px] break-all text-muted">{tx.toAddress}</p>
                    ) : null}
                    {tx.fee ? (
                      <p className="mt-1 text-[11px] text-muted">
                        Fee {formatAmount(tx.fee)} {tx.feeSymbol || tx.symbol}
                      </p>
                    ) : null}
                    <p className="mt-1 break-all font-mono text-[10px] text-muted">{tx.hash}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-8 text-center text-sm">
          <Link to="/wallet" className="text-muted hover:text-foreground">
            ← {copy.wallet.home}
          </Link>
        </p>
      </div>
    </WalletShell>
  );
}
