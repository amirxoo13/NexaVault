import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister();
      });
      return;
    }
    const url = `${import.meta.env.BASE_URL}sw.js?v=8`;
    void navigator.serviceWorker
      .register(url)
      .then((reg) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (sessionStorage.getItem("aurex-sw-reloaded") === "1") return;
          sessionStorage.setItem("aurex-sw-reloaded", "1");
          window.location.reload();
        });
        void reg.update();
      })
      .catch(() => undefined);
  }, []);
  return null;
}
