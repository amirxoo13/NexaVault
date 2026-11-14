import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WalletShell } from "@/components/wallet-shell";
import { SwapMarkets } from "@/screens/swap-markets";

export const Route = createFileRoute("/wallet/markets")({
  component: WalletMarketsPage,
});

function WalletMarketsPage() {
  const navigate = useNavigate();
  return (
    <WalletShell home>
      <SwapMarkets onSwap={() => void navigate({ to: "/wallet/swap" })} />
    </WalletShell>
  );
}
