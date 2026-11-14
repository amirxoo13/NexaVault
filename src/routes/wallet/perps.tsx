import { createFileRoute } from "@tanstack/react-router";
import { PerpsScreen } from "@/screens/perps";

export const Route = createFileRoute("/wallet/perps")({ component: PerpsScreen });
