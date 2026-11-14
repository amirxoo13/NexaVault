import { useEffect } from "react";
import { runDueAlerts, savePushSubscription } from "@/lib/push";
import { useWallet } from "@/lib/store";

/** Ask the server to send any alert that is already due while this phone is open. */
export function AlertScheduler() {
  const email = useWallet((s) => s.accountEmail);
  useEffect(() => {
    if (!email || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      const json = sub?.toJSON();
      if (!json?.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
      await savePushSubscription({
        data: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }, email },
      });
    });
  }, [email]);

  useEffect(() => {
    const tick = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      void runDueAlerts({ data: { force: false } }).catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 15 * 60 * 1000);
    const onShow = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return null;
}