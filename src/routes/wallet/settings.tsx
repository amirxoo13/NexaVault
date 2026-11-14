import { createFileRoute } from "@tanstack/react-router";
import { WalletSettingsScreen } from "@/screens/wallet-settings";

export const Route = createFileRoute("/wallet/settings")({ component: WalletSettingsScreen });
