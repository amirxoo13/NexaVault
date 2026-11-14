import { createFileRoute } from "@tanstack/react-router";
import { WalletHomeScreen } from "@/screens/wallet-home";

export const Route = createFileRoute("/wallet/")({ component: WalletHomeScreen });
