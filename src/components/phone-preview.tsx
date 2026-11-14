import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, CreditCard, History, Scan, Shield } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";

const rows = [
  { id: "tether", symbol: "USDT", name: "Tether USDT", amt: "37,500", usd: "$37,500.00" },
  { id: "tron", symbol: "TRX", name: "Tron", amt: "0", usd: "$0.00" },
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", amt: "0", usd: "$0.00" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", amt: "0", usd: "$0.00" },
];

export function PhonePreview() {
  return (
    <div className="phone-frame relative mx-auto w-[310px] shrink-0">
      <div className="absolute -inset-8 rounded-[3rem] bg-primary/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.2rem] bg-background shadow-float ring-1 ring-primary/25">
        <div className="mx-auto mt-2.5 h-3.5 w-20 rounded-full bg-card-elevated" />
        <div className="px-4 pt-3 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex h-8 items-center gap-1.5 rounded-xl bg-card ps-1.5 pe-2.5 shadow-border">
              <span className="flex size-5 items-center justify-center rounded-lg bg-primary text-primary-fg">
                <Shield className="size-3" />
              </span>
              <span className="font-display text-[10px] font-semibold">Primary Vault #1</span>
            </div>
            <div className="flex gap-1.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-card shadow-border">
                <History className="size-3.5 text-muted" />
              </span>
              <span className="flex size-8 items-center justify-center rounded-xl bg-card shadow-border">
                <Scan className="size-3.5 text-muted" />
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-gradient-to-br from-[#10231f] to-[#0d131c] p-3.5 shadow-border">
            <p className="font-mono text-[9px] tracking-wider text-muted uppercase">NET PORTFOLIO</p>
            <p className="mt-1 font-display text-[26px] leading-none font-bold tracking-tight tabular">$37,500.00</p>
            <p className="mt-1.5 inline-block rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10px] text-success tabular">
              +$0.00 (+0.00%)
            </p>
            <div className="mt-3.5 grid grid-cols-4 gap-1.5">
              {[
                { icon: ArrowUpRight, label: "Send", hot: true },
                { icon: ArrowDownLeft, label: "Receive", hot: false },
                { icon: ArrowLeftRight, label: "Swap", hot: false },
                { icon: CreditCard, label: "Buy", hot: false },
              ].map((a) => (
                <div key={a.label} className="flex flex-col items-center gap-1">
                  <div
                    className={
                      a.hot
                        ? "flex size-10 items-center justify-center rounded-xl bg-primary text-primary-fg"
                        : "flex size-10 items-center justify-center rounded-xl bg-card-elevated"
                    }
                  >
                    <a.icon className="size-4" />
                  </div>
                  <span className="text-[9px] font-semibold">{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-0.5 font-display text-xs font-bold">
            Vault Assets <ChevronRight className="size-3 text-primary" />
          </p>
          <div className="mt-2 space-y-2">
            {rows.map((r) => (
              <div key={r.symbol} className="flex items-center gap-2.5 rounded-xl bg-card px-2.5 py-2 shadow-border">
                <CoinIcon id={r.id} symbol={r.symbol} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[11px] font-semibold">{r.name}</p>
                  <p className="font-mono text-[9px] text-muted tabular">
                    {r.amt} {r.symbol}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-mono text-[11px] font-semibold tabular">{r.usd}</p>
                  <p className="font-mono text-[9px] text-muted tabular">$0.00</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
