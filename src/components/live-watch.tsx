import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { beat, pageName, track } from "@/lib/live";

/** Reports the current page and taps so the control panel can show them live. */
export function LiveWatch() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    track("open", `Opened ${pageName(path)}`);
    beat(path);
  }, [path]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-private]")) return;
      const el = target.closest("a,button,[role='button']");
      if (!el || el.closest("[data-private]")) return;
      const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!label || label.length > 80) return;
      track("tap", label);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") beat(path);
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [path]);

  useEffect(() => {
    const onHide = () => {
      track("action", document.visibilityState === "hidden" ? "Backgrounded the app" : "Returned to the app");
      if (document.visibilityState === "visible") beat(path);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [path]);

  return null;
}
