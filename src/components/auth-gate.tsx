import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogoMark } from "@/components/logo";
import { markSessionUnlocked, requestDeviceAuth, sessionUnlocked } from "@/lib/device-lock";
import { useSite } from "@/lib/site-store";
import { useWallet } from "@/lib/store";

export function AuthGate({ children }: { children: ReactNode }) {
  const hydrated = useWallet((s) => s.hydrated);
  const authenticated = useWallet((s) => s.authenticated);
  const brandName = useSite((s) => s.brandName);
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(() => sessionUnlocked());
  const asked = useRef(false);

  useEffect(() => {
    if (hydrated && !authenticated) {
      void navigate({ to: "/login" });
    }
  }, [hydrated, authenticated, navigate]);

  useEffect(() => {
    if (!hydrated || !authenticated) return;
    if (sessionUnlocked()) {
      setUnlocked(true);
      return;
    }
    if (asked.current) return;
    asked.current = true;
    void requestDeviceAuth("unlock").then((ok) => {
      if (!ok) {
        asked.current = false;
        sessionStorage.setItem("trust-email-login", "1");
        useWallet.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      markSessionUnlocked();
      setUnlocked(true);
    });
  }, [hydrated, authenticated, navigate]);

  if (!hydrated || !authenticated || !unlocked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
        <LogoMark size={44} />
        <p className="font-display text-sm font-semibold text-muted">{brandName}</p>
      </div>
    );
  }

  return <>{children}</>;
}
