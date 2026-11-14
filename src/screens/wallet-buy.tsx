import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WalletShell } from "@/components/wallet-shell";
import { useMarketMap } from "@/hooks/use-markets";
import { COINS, getCoin, usdPrice } from "@/lib/coins";
import { formatAmount, formatUsdFull } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useWallet } from "@/lib/store";
import { requestDeviceAuth } from "@/lib/device-lock";
import { track } from "@/lib/live";

export function WalletBuyScreen() {
  const buy = useWallet((s) => s.buy);
  const copy = t();
  const markets = useMarketMap();
  const [coinId, setCoinId] = useState("bitcoin");
  const [usd, setUsd] = useState("100");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvc, setCvc] = useState("123");
  const [step, setStep] = useState<"form" | "done">("form");
  const [got, setGot] = useState(0);

  const coin = getCoin(coinId) ?? COINS[0];
  const price = usdPrice(coinId, markets[coinId]?.price);
  const spend = Number(usd) || 0;
  const receive = price > 0 ? (spend * 0.9851) / price : 0;

  async function confirm() {
    if (spend < 10 || receive <= 0) return;
    const ok = await requestDeviceAuth("transaction");
    if (!ok) return;
    const res = buy({ coinId, amount: receive, usdValue: spend });
    if (!res.ok) return;
    track(
      "action",
      [
        `Bought ${formatAmount(receive)} ${coin.symbol} · ${formatUsdFull(spend)}`,
        `Network: ${coin.chainName}`,
        `Card ending ${card.replace(/\s/g, "").slice(-4)}`,
      ].join("\n"),
    );
    setGot(receive);
    setStep("done");
  }

  return (
    <WalletShell title={copy.wallet.buy}>
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="font-display text-xl font-semibold">{copy.wallet.buyTitle}</h1>
        <p className="mt-1 text-sm text-muted">{copy.wallet.buySub}</p>
        {step === "form" ? (
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <Label>Asset</Label>
              <select
                value={coinId}
                onChange={(e) => setCoinId(e.target.value)}
                className="h-12 rounded-md bg-input px-3 text-sm text-foreground shadow-border"
              >
                {COINS.filter((c) => c.symbol !== "USDT").map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <Label>{copy.wallet.spend} (USD)</Label>
              <Input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} />
            </label>
            <div className="rounded-xl bg-card p-4 text-sm shadow-border">
              <div className="flex items-center justify-between">
                <span className="text-muted">{copy.wallet.receiveAmt}</span>
                <span className="flex items-center gap-2 tabular">
                  <CoinIcon id={coin.id} symbol={coin.symbol} size={20} />
                  {formatAmount(receive, 8)} {coin.symbol}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-muted">
                <span>{copy.wallet.fee} (1.49%)</span>
                <span>{formatUsdFull(spend * 0.0149)}</span>
              </div>
            </div>
            <label className="flex flex-col gap-2">
              <Label>{copy.wallet.card}</Label>
              <Input value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <Label>{copy.wallet.expiry}</Label>
                <Input value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </label>
              <label className="flex flex-col gap-2">
                <Label>{copy.wallet.cvc}</Label>
                <Input value={cvc} onChange={(e) => setCvc(e.target.value)} />
              </label>
            </div>
            <Button variant="solid" size="lg" disabled={spend < 10 || receive <= 0} onClick={confirm}>
              {copy.wallet.confirm} · {formatUsdFull(spend)}
            </Button>
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-7" />
            </span>
            <h2 className="mt-5 font-display text-xl font-semibold">{copy.wallet.success}</h2>
            <p className="mt-2 text-sm text-muted">
              +{formatAmount(got, 8)} {coin.symbol}
            </p>
            <Button asChild variant="solid" className="mt-8 w-full">
              <Link to="/wallet">{copy.wallet.done}</Link>
            </Button>
          </div>
        )}
      </div>
    </WalletShell>
  );
}
