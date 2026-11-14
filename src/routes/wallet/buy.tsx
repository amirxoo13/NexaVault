import { createFileRoute } from "@tanstack/react-router";
import { WalletBuyScreen } from "@/screens/wallet-buy";

export const Route = createFileRoute("/wallet/buy")({ component: WalletBuyScreen });
