import { createServerFn } from "@tanstack/react-start";

export interface PerpMarket {
  coin: string;
  symbol: string;
  maxLeverage: number;
  mark: number;
  change24h: number;
  volume: number;
  spark: number[];
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function info(body: unknown): Promise<unknown> {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Perps HTTP ${res.status}`);
  return res.json();
}

function readBook(raw: unknown, dex: string): PerpMarket[] {
  if (!Array.isArray(raw) || raw.length < 2) return [];
  const meta = raw[0] as { universe?: { name?: string; maxLeverage?: number }[] };
  const ctxs = raw[1] as { markPx?: string; prevDayPx?: string; dayNtlVlm?: string }[];
  const universe = Array.isArray(meta?.universe) ? meta.universe : [];
  const out: PerpMarket[] = [];
  universe.forEach((u, i) => {
    const ctx = ctxs[i];
    if (!u?.name || !ctx) return;
    const mark = num(ctx.markPx);
    const prev = num(ctx.prevDayPx);
    if (mark <= 0) return;
    const name = u.name;
    const symbol = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
    out.push({
      coin: dex ? name : name,
      symbol,
      maxLeverage: Math.max(1, Math.round(num(u.maxLeverage) || 1)),
      mark,
      change24h: prev > 0 ? ((mark - prev) / prev) * 100 : 0,
      volume: num(ctx.dayNtlVlm),
      spark: [],
    });
  });
  return out;
}

async function spark(coin: string): Promise<number[]> {
  const end = Date.now();
  const start = end - 24 * 60 * 60 * 1000;
  try {
    const raw = await info({ type: "candleSnapshot", req: { coin, interval: "1h", startTime: start, endTime: end } });
    if (!Array.isArray(raw)) return [];
    return raw.map((row) => num((row as { c?: string }).c)).filter((n) => n > 0);
  } catch {
    return [];
  }
}

export const loadPerpMarkets = createServerFn({ method: "GET" }).handler(async (): Promise<PerpMarket[]> => {
  const [main, xyz] = await Promise.all([
    info({ type: "metaAndAssetCtxs" }),
    info({ type: "metaAndAssetCtxs", dex: "xyz" }),
  ]);
  const markets = [...readBook(main, ""), ...readBook(xyz, "xyz")].sort((a, b) => b.volume - a.volume);
  const top = markets.slice(0, 8);
  const lines = await Promise.all(top.map((m) => spark(m.coin)));
  const byCoin = new Map(top.map((m, i) => [m.coin, lines[i]]));
  return markets.map((m) => ({ ...m, spark: byCoin.get(m.coin) ?? [] }));
});

export const loadPerpMids = createServerFn({ method: "GET" }).handler(async (): Promise<Record<string, number>> => {
  const [main, xyz] = await Promise.all([
    info({ type: "allMids" }),
    info({ type: "allMids", dex: "xyz" }),
  ]);
  const out: Record<string, number> = {};
  for (const book of [main, xyz]) {
    if (!book || typeof book !== "object") continue;
    for (const [key, value] of Object.entries(book as Record<string, unknown>)) {
      const price = num(value);
      if (price > 0) out[key] = price;
    }
  }
  return out;
});
