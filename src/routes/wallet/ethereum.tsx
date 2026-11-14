import { createFileRoute } from "@tanstack/react-router";
import { EthAccountScreen } from "@/screens/eth-account";

export const Route = createFileRoute("/wallet/ethereum")({ component: EthAccountScreen });
