import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogoMark } from "@/components/logo";
import { hasAdminProof } from "@/lib/admin-proof";
import { useSite } from "@/lib/site-store";
import { useWallet } from "@/lib/store";

export function AdminGate({ children }: { children: ReactNode }) {
  const hydrated = useWallet((s) => s.hydrated);
  const authenticated = useWallet((s) => s.authenticated);
  const role = useWallet((s) => s.role);
  const brandName = useSite((s) => s.brandName);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hydrated) return;
    if (!authenticated) {
      void navigate({ to: "/login" });
      return;
    }
    if (role !== "admin" || !hasAdminProof()) {
      void navigate({ to: "/wallet" });
    }
  }, [hydrated, authenticated, role, navigate]);

  if (!hydrated || !authenticated || role !== "admin" || !hasAdminProof()) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
        <LogoMark size={44} />
        <p className="font-display text-sm font-semibold text-muted">{brandName}</p>
      </div>
    );
  }

  return <>{children}</>;
}
