import { createFileRoute } from "@tanstack/react-router";
import { SecurityScreen } from "@/screens/security";

export const Route = createFileRoute("/security")({ component: SecurityScreen });
