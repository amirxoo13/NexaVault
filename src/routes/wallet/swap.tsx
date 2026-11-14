import { createFileRoute } from "@tanstack/react-router";
import { WalletSwapScreen } from "@/screens/wallet-swap";

export const Route = createFileRoute("/wallet/swap")({ component: WalletSwapScreen });
