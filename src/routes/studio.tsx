import { createFileRoute } from "@tanstack/react-router";
import { AdminGate } from "@/components/admin-gate";
import { StudioScreen } from "@/screens/studio";

export const Route = createFileRoute("/studio")({
  component: () => (
    <AdminGate>
      <StudioScreen />
    </AdminGate>
  ),
});
