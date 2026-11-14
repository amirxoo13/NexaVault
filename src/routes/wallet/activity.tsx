import { createFileRoute } from "@tanstack/react-router";
import { WalletActivityScreen } from "@/screens/wallet-activity";

export const Route = createFileRoute("/wallet/activity")({ component: WalletActivityScreen });
