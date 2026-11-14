import { COINS, type CoinMeta } from "@/lib/coins";

export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change24h: number;
  change1h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  sparkline: number[];
  high24h: number;
  low24h: number;
  rank: number;
}

export interface ChartPoint {
  t: number;
  p: number;
}

const CACHE_MS = 45_000;

interface CacheEntry<T> {
  at: number;
  data: T;
}

let marketsCache: CacheEntry<MarketCoin[]> | null = null;
const chartCache = new Map<string, CacheEntry<ChartPoint[]>>();

const FALLBACK_STATS: Record<
  string,
  { price: number; change24h: number; supply: number; volume24h: number; rank: number }
> = {
  bitcoin: { price: 91420, change24h: 2.34, supply: 19_780_000, volume24h: 38_400_000_000, rank: 1 },
  ethereum: { price: 2518.97, change24h: 1.82, supply: 120_420_000, volume24h: 19_200_000_000, rank: 2 },
  tether: { price: 1.0, change24h: 0.01, supply: 142_800_000_000, volume24h: 64_500_000_000, rank: 3 },
  solana: { price: 188.4, change24h: 4.15, supply: 474_000_000, volume24h: 5_800_000_000, rank: 4 },
  binancecoin: { price: 624.5, change24h: 0.94, supply: 144_000_000, volume24h: 1_650_000_000, rank: 5 },
  ripple: { price: 1.48, change24h: 3.12, supply: 56_900_000_000, volume24h: 4_200_000_000, rank: 6 },
  "usd-coin": { price: 1.0, change24h: 0.0, supply: 39_500_000_000, volume24h: 8_100_000_000, rank: 7 },
  dogecoin: { price: 0.365, change24h: 5.4, supply: 146_800_000_000, volume24h: 4_900_000_000, rank: 8 },
  cardano: { price: 0.98, change24h: -1.15, supply: 35_750_000_000, volume24h: 1_420_000_000, rank: 9 },
  tron: { price: 0.204, change24h: 1.25, supply: 86_350_000_000, volume24h: 980_000_000, rank: 10 },
  "the-open-network": { price: 5.62, change24h: 2.08, supply: 2_545_000_000, volume24h: 340_000_000, rank: 11 },
  "avalanche-2": { price: 38.9, change24h: 2.75, supply: 409_000_000, volume24h: 890_000_000, rank: 12 },
  chainlink: { price: 18.25, change24h: 1.64, supply: 626_800_000, volume24h: 610_000_000, rank: 13 },
  sui: { price: 3.38, change24h: 6.2, supply: 2_845_000_000, volume24h: 1_750_000_000, rank: 14 },
  polkadot: { price: 7.45, change24h: -0.68, supply: 1_510_000_000, volume24h: 420_000_000, rank: 15 },
  litecoin: { price: 96.8, change24h: 1.12, supply: 75_200_000, volume24h: 680_000_000, rank: 16 },
  near: { price: 6.18, change24h: 3.45, supply: 1_218_000_000, volume24h: 510_000_000, rank: 17 },
  uniswap: { price: 11.4, change24h: 0.85, supply: 600_400_000, volume24h: 390_000_000, rank: 18 },
  "matic-network": { price: 0.54, change24h: -0.92, supply: 8_240_000_000, volume24h: 290_000_000, rank: 19 },
  cosmos: { price: 7.82, change24h: 1.4, supply: 390_900_000, volume24h: 240_000_000, rank: 20 },
};

function makeSparkline(id: string, price: number, change24h: number, count = 28): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  const startPrice = price / (1 + change24h / 100 || 1);
  const volatility = id === "tether" || id === "usd-coin" ? 0.0006 : 0.018;
  const pts: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    const wave = Math.sin(t * Math.PI * 3 + (seed % 7)) * volatility + Math.cos(t * Math.PI * 5 + (seed % 11)) * (volatility * 0.5);
    const base = startPrice + (price - startPrice) * t;
    const p = i === count - 1 ? price : Math.max(price * 0.05, base * (1 + wave));
    pts.push(Number(p.toPrecision(6)));
  }
  return pts;
}

function makeFallbackChart(id: string, days: number): ChartPoint[] {
  const cached = marketsCache?.data.find((m) => m.id === id);
  const stat = FALLBACK_STATS[id];
  const price = cached?.price ?? stat?.price ?? 1;
  const change = cached?.change24h ?? stat?.change24h ?? 0;
  const count = days <= 1 ? 48 : days <= 7 ? 84 : 90;
  const now = Date.now();
  const stepMs = (days * 24 * 60 * 60 * 1000) / count;
  const spark = makeSparkline(`${id}:${days}`, price, change * Math.min(3, Math.sqrt(days)), count);
  return spark.map((p, i) => ({
    t: Math.round(now - (count - 1 - i) * stepMs),
    p,
  }));
}

function buildFallbackMarkets(catalog: CoinMeta[] = COINS): MarketCoin[] {
  return catalog.map((coin, i) => {
    const stat = FALLBACK_STATS[coin.id] ?? {
      price: 1,
      change24h: 0,
      supply: 100_000_000,
      volume24h: 50_000_000,
      rank: i + 1,
    };
    const price = stat.price;
    const change = stat.change24h;
    return {
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      price,
      change24h: change,
      change1h: Number((change * 0.18).toFixed(2)),
      change7d: Number((change * 2.4).toFixed(2)),
      marketCap: price * stat.supply,
      volume24h: stat.volume24h,
      sparkline: makeSparkline(coin.id, price, change),
      high24h: price * (1 + Math.max(0.008, Math.abs(change) / 100)),
      low24h: price * (1 - Math.max(0.008, Math.abs(change) / 100)),
      rank: stat.rank,
    };
  });
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fromCoinGecko(raw: unknown): MarketCoin[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: MarketCoin[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (!r) continue;
    const id = String(r.id ?? "");
    const stat = FALLBACK_STATS[id];
    const price = num(r.current_price, stat?.price ?? 0);
    const change24h = num(r.price_change_percentage_24h, stat?.change24h ?? 0);
    const spark = asRecord(r.sparkline_in_7d);
    const rawSpark = Array.isArray(spark?.price)
      ? (spark.price as unknown[]).map((x) => num(x)).filter((n) => n > 0)
      : [];
    const sparkline = rawSpark.length >= 2 ? rawSpark : makeSparkline(id, price || 1, change24h);
    out.push({
      id,
      symbol: String(r.symbol ?? "").toUpperCase(),
      name: String(r.name ?? ""),
      image: String(r.image ?? ""),
      price,
      change24h,
      change1h: num(r.price_change_percentage_1h_in_currency, Number((change24h * 0.18).toFixed(2))),
      change7d: num(r.price_change_percentage_7d_in_currency, Number((change24h * 2.2).toFixed(2))),
      marketCap: num(r.market_cap) || (stat ? price * stat.supply : 0),
      volume24h: num(r.total_volume) || (stat?.volume24h ?? 0),
      sparkline,
      high24h: num(r.high_24h, price * 1.015),
      low24h: num(r.low_24h, price * 0.985),
      rank: num(r.market_cap_rank, stat?.rank ?? 99),
    });
  }
  return out.length ? out : null;
}

function fromBinance(raw: unknown, catalog: CoinMeta[]): MarketCoin[] | null {
  if (!Array.isArray(raw)) return null;
  const bySymbol = new Map<string, Record<string, unknown>>();
  for (const item of raw) {
    const r = asRecord(item);
    if (!r) continue;
    bySymbol.set(String(r.symbol ?? ""), r);
  }
  const out: MarketCoin[] = [];
  catalog.forEach((coin, i) => {
    const stat = FALLBACK_STATS[coin.id];
    const pair = coin.binance && coin.binance !== "USDTTRY" ? coin.binance : `${coin.symbol}USDT`;
    const row = bySymbol.get(pair) ?? (coin.symbol === "USDT" ? null : bySymbol.get(`${coin.symbol}USDT`));
    const price = coin.symbol === "USDT" || coin.symbol === "USDC" ? 1 : num(row?.lastPrice, stat?.price ?? 0);
    const change = coin.symbol === "USDT" || coin.symbol === "USDC" ? 0.01 : num(row?.priceChangePercent, stat?.change24h ?? 0);
    if (price <= 0 && coin.symbol !== "USDT" && coin.symbol !== "USDC") return;
    const finalPrice = price || 1;
    const supply = stat?.supply ?? 100_000_000;
    const vol = num(row?.quoteVolume) || (stat?.volume24h ?? 50_000_000);
    out.push({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      price: finalPrice,
      change24h: change,
      change1h: Number((change * 0.2).toFixed(2)),
      change7d: Number((change * 2.1).toFixed(2)),
      marketCap: finalPrice * supply,
      volume24h: vol,
      sparkline: makeSparkline(coin.id, finalPrice, change),
      high24h: num(row?.highPrice, finalPrice * 1.012),
      low24h: num(row?.lowPrice, finalPrice * 0.988),
      rank: stat?.rank ?? i + 1,
    });
  });
  return out.length ? out : null;
}

export async function fetchMarkets(): Promise<MarketCoin[]> {
  if (marketsCache && Date.now() - marketsCache.at < CACHE_MS) {
    return marketsCache.data;
  }
  const ids = COINS.map((c) => c.id).join(",");
  try {
    const gecko = await getJson(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`,
    );
    const parsed = fromCoinGecko(gecko);
    if (parsed) {
      marketsCache = { at: Date.now(), data: parsed };
      return parsed;
    }
  } catch {
    /* fall through */
  }
  try {
    const binance = await getJson("https://api.binance.com/api/v3/ticker/24hr");
    const parsed = fromBinance(binance, COINS);
    if (parsed) {
      marketsCache = { at: Date.now(), data: parsed };
      return parsed;
    }
  } catch {
    /* fall through */
  }
  if (marketsCache) return marketsCache.data;
  const fallback = buildFallbackMarkets(COINS);
  marketsCache = { at: Date.now(), data: fallback };
  return fallback;
}

export async function fetchChart(id: string, days: number): Promise<ChartPoint[]> {
  const key = `${id}:${days}`;
  const hit = chartCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  try {
    const raw = await getJson(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
    );
    const rec = asRecord(raw);
    const prices = rec && Array.isArray(rec.prices) ? rec.prices : [];
    const points: ChartPoint[] = [];
    for (const row of prices) {
      if (!Array.isArray(row) || row.length < 2) continue;
      points.push({ t: num(row[0]), p: num(row[1]) });
    }
    if (points.length) {
      chartCache.set(key, { at: Date.now(), data: points });
      return points;
    }
  } catch {
    /* fall through */
  }

  const coin = COINS.find((c) => c.id === id);
  const symbol = coin?.binance ?? (coin ? `${coin.symbol}USDT` : null);
  if (symbol && symbol !== "USDTTRY") {
    const interval = days <= 1 ? "15m" : days <= 7 ? "1h" : days <= 30 ? "4h" : "1d";
    const limit = days <= 1 ? 96 : days <= 7 ? 168 : days <= 30 ? 180 : 180;
    try {
      const raw = await getJson(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      );
      if (Array.isArray(raw)) {
        const points: ChartPoint[] = [];
        for (const row of raw) {
          if (!Array.isArray(row)) continue;
          points.push({ t: num(row[0]), p: num(row[4]) });
        }
        if (points.length) {
          chartCache.set(key, { at: Date.now(), data: points });
          return points;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const prev = chartCache.get(key);
  if (prev) return prev.data;
  const fallback = makeFallbackChart(id, days);
  chartCache.set(key, { at: Date.now(), data: fallback });
  return fallback;
}

export function marketMap(list: MarketCoin[]): Record<string, MarketCoin> {
  const map: Record<string, MarketCoin> = {};
  for (const m of list) {
    map[m.id] = m;
    map[m.symbol.toUpperCase()] = m;
  }
  return map;
}

const BOARD_MS = 60_000;
const boardCache = new Map<string, CacheEntry<MarketCoin[]>>();

async function geckoMarkets(params: string): Promise<MarketCoin[]> {
  const hit = boardCache.get(params);
  if (hit && Date.now() - hit.at < BOARD_MS) return hit.data;
  try {
    const raw = await getJson(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&sparkline=true&price_change_percentage=1h,24h,7d&${params}`,
    );
    const parsed = fromCoinGecko(raw) ?? [];
    if (parsed.length) {
      boardCache.set(params, { at: Date.now(), data: parsed });
      return parsed;
    }
  } catch {
    /* fallback below */
  }
  return fetchMarkets();
}

export function fetchTopTraded(): Promise<MarketCoin[]> {
  return geckoMarkets("order=volume_desc&per_page=12&page=1");
}

export function fetchCategoryMarkets(category: string): Promise<MarketCoin[]> {
  return geckoMarkets(`category=${encodeURIComponent(category)}&order=volume_desc&per_page=40&page=1`);
}

export async function fetchTrendingMarkets(): Promise<MarketCoin[]> {
  const key = "trending";
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_MS) return hit.data;
  try {
    const raw = await getJson("https://api.coingecko.com/api/v3/search/trending");
    const rec = asRecord(raw);
    const coins = Array.isArray(rec?.coins) ? rec.coins : [];
    const ids: string[] = [];
    for (const item of coins) {
      const row = asRecord(item);
      const coin = asRecord(row?.item);
      if (typeof coin?.id === "string") ids.push(coin.id);
    }
    if (ids.length) {
      const list = await geckoMarkets(`ids=${ids.join(",")}&order=market_cap_desc&per_page=20&page=1`);
      boardCache.set(key, { at: Date.now(), data: list });
      return list;
    }
  } catch {
    /* fallback below */
  }
  return fetchMarkets();
}

export async function fetchSearchMarkets(query: string): Promise<MarketCoin[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const key = `search:${q.toLowerCase()}`;
  const hit = boardCache.get(key);
  if (hit && Date.now() - hit.at < BOARD_MS) return hit.data;
  try {
    const raw = await getJson(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`);
    const rec = asRecord(raw);
    const coins = Array.isArray(rec?.coins) ? rec.coins : [];
    const ids: string[] = [];
    for (const item of coins) {
      const row = asRecord(item);
      if (typeof row?.id === "string") ids.push(row.id);
      if (ids.length >= 15) break;
    }
    if (ids.length) {
      const list = await geckoMarkets(`ids=${ids.join(",")}&order=market_cap_desc&per_page=15&page=1`);
      boardCache.set(key, { at: Date.now(), data: list });
      return list;
    }
  } catch {
    /* fallback below */
  }
  const all = await fetchMarkets();
  const low = q.toLowerCase();
  return all.filter((m) => m.name.toLowerCase().includes(low) || m.symbol.toLowerCase().includes(low));
}

export async function fetchCoinMarket(id: string): Promise<MarketCoin | null> {
  const list = await geckoMarkets(`ids=${encodeURIComponent(id)}&order=market_cap_desc&per_page=1&page=1`);
  return list.find((m) => m.id === id) ?? list[0] ?? null;
}
