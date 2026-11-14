import { createFileRoute } from "@tanstack/react-router";
import { WelcomeScreen } from "@/screens/welcome";

export const Route = createFileRoute("/")({ component: WelcomeScreen });
