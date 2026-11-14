import { useEffect } from "react";
import { syncFromCloud } from "@/lib/cloud-sync";
import { useLoginWindow } from "@/lib/login-window";
import { useSite } from "@/lib/site-store";
import { useWallet } from "@/lib/store";

function markHydrated() {
  useWallet.setState({ hydrated: true });
  useSite.setState({ hydrated: true });
  useLoginWindow.setState({ hydrated: true });
}

export function PersistHydrate() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Promise.all([
          useWallet.persist.rehydrate(),
          useSite.persist.rehydrate(),
          useLoginWindow.persist.rehydrate(),
        ]);
        if (cancelled) return;
        await syncFromCloud();
      } catch {
        /* localStorage still works */
      } finally {
        if (!cancelled) markHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
