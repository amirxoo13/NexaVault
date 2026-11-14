import { createFileRoute } from "@tanstack/react-router";
import { FeaturesScreen } from "@/screens/features";

export const Route = createFileRoute("/features")({ component: FeaturesScreen });
