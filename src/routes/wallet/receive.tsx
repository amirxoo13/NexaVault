import { createFileRoute } from "@tanstack/react-router";
import { WalletReceiveScreen } from "@/screens/wallet-receive";

export const Route = createFileRoute("/wallet/receive")({ component: WalletReceiveScreen });
