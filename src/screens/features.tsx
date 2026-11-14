import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, LineChart, Shield } from "lucide-react";
import { MarketingShell } from "@/components/marketing-shell";
import { t } from "@/lib/i18n";
import { useSite } from "@/lib/site-store";

export function FeaturesScreen() {
  const copy = t();
  const featuresTitle = useSite((s) => s.featuresTitle);
  const featuresSub = useSite((s) => s.featuresSub);
  const items = [
    { icon: ArrowUpRight, t: copy.wallet.send, d: "Send crypto to any compatible address. Network fees are shown before you confirm." },
    { icon: ArrowDownLeft, t: copy.wallet.receive, d: "Share your address or QR code to receive funds on the selected network." },
    { icon: ArrowLeftRight, t: copy.wallet.swap, d: "Swap at a live market rate with a 0.3% fee, both balances update immediately." },
    { icon: CreditCard, t: copy.wallet.buy, d: "Buy crypto with a card. The amount is credited to this wallet." },
    { icon: LineChart, t: copy.markets.title, d: "Live prices and charts from public market APIs." },
    { icon: Shield, t: copy.profile.title, d: "Keep your identity details with this wallet: name, address, phone, ID photo." },
  ];
  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{featuresTitle}</h1>
        <p className="mt-3 max-w-xl text-muted">{featuresSub}</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.t} className="rounded-xl bg-card p-6 shadow-border">
              <item.icon className="size-5 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">{item.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.d}</p>
            </div>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
