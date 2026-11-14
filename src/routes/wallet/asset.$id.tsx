import { createFileRoute } from "@tanstack/react-router";
import { WalletAssetScreen } from "@/screens/wallet-asset";

export const Route = createFileRoute("/wallet/asset/$id")({
  component: AssetPage,
});

function AssetPage() {
  const { id } = Route.useParams();
  return <WalletAssetScreen id={id} />;
}
