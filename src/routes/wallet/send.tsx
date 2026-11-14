import { createFileRoute } from "@tanstack/react-router";
import { WalletSendScreen } from "@/screens/wallet-send";

export const Route = createFileRoute("/wallet/send")({ component: WalletSendScreen });
