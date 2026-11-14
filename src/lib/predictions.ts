import { createServerFn } from "@tanstack/react-start";

export interface PredictionMarket {
  id: string;
  question: string;
  slug: string;
  image: string;
  yes: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  change1d: number;
  change1w: number;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

export const loadPredictions = createServerFn({ method: "GET" }).handler(async (): Promise<PredictionMarket[]> => {
  const res = await fetch("https://gamma-api.polymarket.com/markets?closed=false&limit=40", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Predictions HTTP ${res.status}`);
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];
  const out: PredictionMarket[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || row.active === false || row.closed === true) continue;
    const question = typeof row.question === "string" ? row.question : "";
    if (!question) continue;
    let yes = num(row.lastTradePrice);
    if (!yes && typeof row.outcomePrices === "string") {
      try {
        const prices = JSON.parse(row.outcomePrices) as unknown;
        if (Array.isArray(prices)) yes = num(prices[0]);
      } catch {
        yes = 0;
      }
    }
    const events = Array.isArray(row.events) ? row.events : [];
    const event = asRecord(events[0]);
    const slug = typeof event?.slug === "string" ? event.slug : typeof row.slug === "string" ? row.slug : "";
    if (!slug) continue;
    out.push({
      id: String(row.id ?? slug),
      question,
      slug,
      image: typeof row.image === "string" ? row.image : typeof row.icon === "string" ? row.icon : "",
      yes,
      volume24h: num(row.volume24hr),
      volume7d: num(row.volume1wk),
      volume30d: num(row.volume1mo),
      change1d: num(row.oneDayPriceChange) * 100,
      change1w: num(row.oneWeekPriceChange) * 100,
    });
  }
  return out.sort((a, b) => b.volume24h - a.volume24h).slice(0, 30);
});
