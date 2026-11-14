import { useEffect, useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { AddressQr } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { WalletShell } from "@/components/wallet-shell";
import { COINS, getCoin } from "@/lib/coins";
import { t } from "@/lib/i18n";
import { useWallet } from "@/lib/store";
import { track } from "@/lib/live";
import { toast } from "sonner";

export function WalletReceiveScreen() {
  const addresses = useWallet((s) => s.addresses);
  const copy = t();
  const [coinId, setCoinId] = useState("tether");
  const [copied, setCopied] = useState(false);
  const coin = getCoin(coinId) ?? COINS[1];
  const address = addresses[coin.chain] ?? "";

  useEffect(() => {
    if (!address) return;
    track("action", `Viewing receive address\n${coin.symbol} · ${coin.chainName}\n${address}`);
  }, [address, coin.symbol, coin.chainName]);

  const uniqueChains = useMemo(() => {
    const seen = new Set<string>();
    const list = COINS.filter((c) => {
      if (seen.has(c.chain)) return false;
      seen.add(c.chain);
      return true;
    });
    return list.sort((a, b) => Number(b.id === "tether") - Number(a.id === "tether"));
  }, []);

  async function copyAddr() {
    try {
      await navigator.clipboard.writeText(address);
      track("action", `Copied receive address\n${coin.symbol} · ${coin.chainName}\n${address}`);
      setCopied(true);
      toast.success(copy.wallet.copied);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <WalletShell title={copy.wallet.receive}>
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="font-display text-xl font-semibold">{copy.wallet.receive}</h1>
        <label className="mt-6 block">
          <span className="text-xs font-medium text-muted">Network</span>
          <select
            value={coinId}
            onChange={(e) => setCoinId(e.target.value)}
            className="mt-2 h-12 w-full rounded-md bg-input px-3 text-sm text-foreground shadow-border"
          >
            {uniqueChains.map((c) => (
              <option key={c.chain} value={c.id}>
                {c.chainName} · {c.symbol}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-8 flex flex-col items-center rounded-xl bg-card px-5 py-8 shadow-border">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <CoinIcon id={coin.id} symbol={coin.symbol} size={24} />
            {coin.chainName}
          </div>
          {address ? <AddressQr value={address} size={200} /> : null}
          <p className="mt-5 text-center text-xs text-muted">
            {copy.wallet.qrHint} {coin.chainName}. Another user on this platform can also send to this address or to your sign-in email.
          </p>
          <p className="mt-4 max-w-full break-all text-center font-mono text-xs leading-relaxed">{address}</p>
          <div className="mt-5 flex w-full gap-2">
            <Button variant="solid" className="flex-1" onClick={() => void copyAddr()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? copy.wallet.copied : copy.wallet.copy}
            </Button>
          </div>
        </div>
      </div>
    </WalletShell>
  );
}
