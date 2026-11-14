import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ScenarioCode } from "@/lib/auth-config";

interface LoginWindowState {
  hydrated: boolean;
  startedAt: number | null;
  lockedScenario: ScenarioCode | null;
  lockScenario: (code: ScenarioCode) => void;
  clearLockedScenario: () => void;
}

export const useLoginWindow = create<LoginWindowState>()(
  persist(
    (set) => ({
      hydrated: false,
      startedAt: null,
      lockedScenario: null,
      lockScenario: (code) => set({ lockedScenario: code }),
      clearLockedScenario: () => set({ lockedScenario: null }),
    }),
    {
      name: "aurex-login-window",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        ...((persisted as object) ?? {}),
      }),
      partialize: (s) => ({ startedAt: s.startedAt, lockedScenario: s.lockedScenario }),
      onRehydrateStorage: () => () => {
        /* hydrated is set after cloud sync */
      },
    },
  ),
);
