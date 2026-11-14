import { createFileRoute } from "@tanstack/react-router";

async function tick() {
  try {
    const { dispatchAlerts } = await import("@/lib/push-send");
    const result = await dispatchAlerts(false);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[alerts]", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/notify")({
  server: {
    handlers: {
      GET: () => tick(),
      POST: () => tick(),
    },
  },
});
