import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useWallet } from "@/lib/store";

export const Route = createFileRoute("/wallet")({
  component: WalletLayout,
});

function WalletLayout() {
  const settleDueSwaps = useWallet((s) => s.settleDueSwaps);
  useEffect(() => {
    settleDueSwaps();
    const id = window.setInterval(settleDueSwaps, 1000);
    return () => window.clearInterval(id);
  }, [settleDueSwaps]);
  return (
    <AuthGate>
      <Outlet />
    </AuthGate>
  );
}
