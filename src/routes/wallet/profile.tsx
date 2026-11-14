import { createFileRoute } from "@tanstack/react-router";
import { WalletProfileScreen } from "@/screens/wallet-profile";

export const Route = createFileRoute("/wallet/profile")({ component: WalletProfileScreen });
