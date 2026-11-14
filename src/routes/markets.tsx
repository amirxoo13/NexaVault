import { createFileRoute } from "@tanstack/react-router";
import { MarketsScreen } from "@/screens/markets";

export const Route = createFileRoute("/markets")({ component: MarketsScreen });
