import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/screens/login";

export const Route = createFileRoute("/login")({ component: LoginScreen });
