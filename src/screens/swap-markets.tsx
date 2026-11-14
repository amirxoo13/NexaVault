import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChartColumn, ChevronDown, Rocket, Search, Star } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { formatPct, formatUsd } from "@/lib/format";
import {
  fetchCategoryMarkets,
  fetchSearchMarkets,
  fetchTopTraded,
  fetchTrendingMarkets,
  type MarketCoin,
} from "@/lib/prices";
import { loadPredictions, type PredictionMarket } from "@/lib/predictions";
import { cn } from "@/lib/utils";

const STAR_KEY = "trust-market-stars";

type Board = "trending" | "meme" | "bstocks" | "stocks" | "ondo" | "predictions";
type Network = "all" | "bitcoin" | "ethereum" | "bnb" | "solana" | "tron";
type WindowKey = "1h" | "24h" | "7d";

const NETWORKS: { id: Network; label: string; category: string | null }[] = [
  { id: "all", label: "All networks", category: null },
  { id: "bitcoin", label: "Bitcoin", category: "bitcoin-ecosystem" },
  { id: "ethereum", label: "Ethereum", category: "ethereum-ecosystem" },
  { id: "bnb", label: "BNB Chain", category: "binance-smart-chain" },
  { id: "solana", label: "Solana", category: "solana-ecosystem" },
  { id: "tron", label: "Tron", category: "tron-ecosystem" },
];

const MEME_NETWORK: Partial<Record<Network, string>> = {
  bitcoin: "bitcoin-meme",
  bnb: "four-meme-ecosystem",
  solana: "solana-meme-coins",
  tron: "tron-meme",
};

const BOARDS: { id: Board; label: string; category: string | null }[] = [
  { id: "trending", label: "Trending", category: null },
  { id: "bstocks", label: "bStocks", category: "bstocks-ecosystem" },
  { id: "stocks", label: "Stock tokens", category: "tokenized-stock" },
  { id: "ondo", label: "Ondo", category: "ondo-tokenized-assets" },
];

function readStars(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STAR_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function changeOf(coin: MarketCoin, windowKey: WindowKey): number {
  if (windowKey === "1h") return coin.change1h;
  if (windowKey === "7d") return coin.change7d;
  return coin.change24h;
}

function Spark({ points, up }: { points: number[]; up: boolean }) {
  const sample = points.length > 24 ? points.filter((_, i) => i % Math.ceil(points.length / 24) === 0) : points;
  if (sample.length < 2) return <span className="inline-block h-8 w-16" />;
  const min = Math.min(...sample);
  const max = Math.max(...sample);
  const span = max - min || 1;
  const d = sample
    .map((p, i) => {
      const x = (i / (sample.length - 1)) * 64;
      const y = 28 - ((p - min) / span) * 24;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 64 32" className="h-7 w-12 shrink-0" aria-hidden>
      <path d={d} fill="none" stroke={up ? "#3dd68c" : "#ef5b6a"} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

async function loadBoard(board: Board, network: Network): Promise<MarketCoin[]> {
  if (board === "meme") {
    const memeChain = network !== "all" ? MEME_NETWORK[network] : null;
    return fetchCategoryMarkets(memeChain ?? "meme-token");
  }
  if (network !== "all") {
    const category = NETWORKS.find((n) => n.id === network)?.category;
    if (category) return fetchCategoryMarkets(category);
  }
  if (board === "trending") return fetchTrendingMarkets();
  const category = BOARDS.find((b) => b.id === board)?.category;
  return fetchCategoryMarkets(category ?? "meme-token");
}

export function SwapMarkets({ onSwap }: { onSwap: () => void }) {
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board>("trending");
  const [network, setNetwork] = useState<Network>("all");
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [volumeAsc, setVolumeAsc] = useState(false);
  const [starsOnly, setStarsOnly] = useState(false);
  const [stars, setStars] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<"network" | "window" | null>(null);

  useEffect(() => {
    setStars(readStars());
  }, []);

  const top = useQuery({ queryKey: ["top-traded"], queryFn: fetchTopTraded, staleTime: 60_000 });
  const searching = query.trim().length >= 2;
  const coins = useQuery({
    queryKey: ["swap-board", board, network],
    queryFn: () => loadBoard(board, network),
    enabled: board !== "predictions" && !searching,
    staleTime: 60_000,
  });
  const found = useQuery({
    queryKey: ["swap-search", query.trim().toLowerCase()],
    queryFn: () => fetchSearchMarkets(query),
    enabled: searching && board !== "predictions",
    staleTime: 30_000,
  });
  const predictions = useQuery({
    queryKey: ["predictions"],
    queryFn: () => loadPredictions(),
    enabled: board === "predictions",
    staleTime: 60_000,
  });

  function toggleStar(id: string) {
    setStars((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(STAR_KEY, JSON.stringify(next));
      return next;
    });
  }

  const rows = useMemo(() => {
    const source = searching ? (found.data ?? []) : (coins.data ?? []);
    const q = query.trim().toLowerCase();
    let list = source.filter((c) => {
      if (starsOnly && !stars.includes(c.id)) return false;
      if (!searching && q && !`${c.name} ${c.symbol}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => (volumeAsc ? a.volume24h - b.volume24h : b.volume24h - a.volume24h));
    return list;
  }, [searching, found.data, coins.data, query, starsOnly, stars, volumeAsc]);

  const predictionRows = useMemo(() => {
    let list = predictions.data ?? [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.question.toLowerCase().includes(q));
    if (starsOnly) list = list.filter((p) => stars.includes(p.id));
    const volume = (p: PredictionMarket) => (windowKey === "7d" ? p.volume7d : windowKey === "1h" ? p.volume24h : p.volume24h);
    return [...list].sort((a, b) => (volumeAsc ? volume(a) - volume(b) : volume(b) - volume(a)));
  }, [predictions.data, query, starsOnly, stars, volumeAsc, windowKey]);

  function openCoin(id: string) {
    void navigate({ to: "/wallet/asset/$id", params: { id } });
  }

  const loading = board === "predictions" ? predictions.isLoading : searching ? found.isLoading : coins.isLoading;
  const error = board === "predictions" ? predictions.isError : searching ? found.isError : coins.isError;
  const networkLabel = NETWORKS.find((n) => n.id === network)?.label ?? "Network";

  return (
    <div className="mx-auto w-full max-w-md overflow-x-clip px-4 pt-3 pb-36">
      <div className="flex items-center justify-between">
        <div className="size-11" />
        <h1 className="font-display text-xl font-semibold">Markets</h1>
        <button
          type="button"
          aria-label="Search"
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setQuery("");
          }}
          className="flex size-11 items-center justify-center rounded-full bg-card text-foreground"
        >
          <Search className="size-5" />
        </button>
      </div>

      {searchOpen ? (
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or symbol"
          className="mt-3 h-11 w-full rounded-full bg-card px-4 text-sm outline-none"
        />
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setBoard("predictions");
            setNetwork("all");
            setMenu(null);
          }}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-2xl bg-card text-sm font-medium",
            board === "predictions" && "ring-1 ring-primary",
          )}
        >
          <ChartColumn className="size-5" />
          Predictions
        </button>
        <button
          type="button"
          onClick={() => {
            setBoard("meme");
            setMenu(null);
          }}
          className={cn(
            "flex h-14 items-center justify-center gap-2 rounded-2xl bg-card text-sm font-medium",
            board === "meme" && "ring-1 ring-primary",
          )}
        >
          <Rocket className="size-5" />
          Meme Rush
        </button>
      </div>

      <h2 className="mt-6 text-lg font-semibold">Top traded (24h)</h2>
      <div className="scroll-x mt-3 flex gap-3 pb-1">
        {(top.data ?? []).slice(0, 8).map((coin) => {
          const up = coin.change24h >= 0;
          return (
            <button
              key={coin.id}
              type="button"
              onClick={() => openCoin(coin.id)}
              className="w-36 shrink-0 rounded-2xl bg-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{coin.name}</span>
                <CoinIcon id={coin.id} symbol={coin.symbol} image={coin.image} size={28} />
              </div>
              <p className="mt-6 text-lg font-semibold tabular">{formatUsd(coin.price, true)}</p>
              <p className={cn("mt-1 text-sm tabular", up ? "text-success" : "text-danger")}>{formatPct(coin.change24h)}</p>
            </button>
          );
        })}
        {top.isLoading ? <div className="h-36 w-40 shrink-0 animate-pulse rounded-2xl bg-card" /> : null}
      </div>
      {top.isError ? <p className="mt-2 text-sm text-danger">Live prices are unavailable right now.</p> : null}

      <div className="scroll-x mt-4 flex gap-2 pb-1">
        <button
          type="button"
          aria-label="Favorites"
          onClick={() => setStarsOnly((v) => !v)}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full bg-card",
            starsOnly && "bg-primary text-primary-fg",
          )}
        >
          <Star className={cn("size-4", starsOnly && "fill-current")} />
        </button>
        {BOARDS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setBoard(item.id);
              setNetwork("all");
              setMenu(null);
            }}
            className={cn(
              "h-10 shrink-0 rounded-full bg-card px-4 text-sm",
              board === item.id && "bg-accent-soft text-primary shadow-border",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative mt-3 flex max-w-full flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMenu((m) => (m === "network" ? null : "network"))}
          className="flex h-9 items-center gap-1 rounded-full bg-card px-3 text-sm"
        >
          {network === "all" ? "Network" : networkLabel}
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setVolumeAsc((v) => !v)}
          className="flex h-9 items-center gap-1 rounded-full bg-card px-3 text-sm"
        >
          Volume {volumeAsc ? "↑" : "↓"}
        </button>
        <button
          type="button"
          onClick={() => setMenu((m) => (m === "window" ? null : "window"))}
          className="flex h-9 items-center gap-1 rounded-full bg-card px-3 text-sm"
        >
          {windowKey}
          <ChevronDown className="size-4" />
        </button>
        {menu === "network" ? (
          <div className="absolute top-11 left-0 z-20 w-44 rounded-xl bg-card p-1 shadow-border">
            {NETWORKS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setNetwork(item.id);
                  if (item.id !== "all" && board !== "meme" && board !== "predictions") setBoard("trending");
                  setMenu(null);
                }}
                className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm", network === item.id && "bg-card-elevated")}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
        {menu === "window" ? (
          <div className="absolute top-11 right-0 z-20 w-28 rounded-xl bg-card p-1 shadow-border">
            {(["1h", "24h", "7d"] as WindowKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setWindowKey(item);
                  setMenu(null);
                }}
                className={cn("block w-full rounded-lg px-3 py-2 text-left text-sm", windowKey === item && "bg-card-elevated")}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-danger">Could not load live market data.</p> : null}
      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      ) : board === "predictions" ? (
        <div className="mt-2">
          {predictionRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {starsOnly ? "No starred predictions yet." : "No open prediction markets matched."}
            </p>
          ) : (
            predictionRows.map((item) => {
              const change = windowKey === "7d" ? item.change1w : item.change1d;
              const up = change >= 0;
              const volume = windowKey === "7d" ? item.volume7d : windowKey === "1h" ? item.volume24h : item.volume24h;
              return (
                <div key={item.id} className="flex min-w-0 items-center gap-2 border-b border-border py-2.5">
                  <button type="button" aria-label="Star" onClick={() => toggleStar(item.id)} className="text-muted">
                    <Star className={cn("size-4", stars.includes(item.id) && "fill-current text-foreground")} />
                  </button>
                  <a
                    href={`https://polymarket.com/event/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    {item.image ? (
                      <img src={item.image} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <span className="size-10 rounded-full bg-card" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.question}</span>
                      <span className="block text-xs text-muted">Yes {Math.round(item.yes * 100)}% · Vol {formatUsd(volume)}</span>
                    </span>
                    <span className={cn("text-sm tabular", up ? "text-success" : "text-danger")}>{formatPct(change)}</span>
                  </a>
                </div>
              );
            })
          )}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {starsOnly ? "No starred assets yet. Star a coin to keep it here." : "No assets matched."}
        </p>
      ) : (
        <div className="mt-2">
          {rows.map((coin) => {
            const change = changeOf(coin, windowKey);
            const up = change >= 0;
            return (
              <div key={coin.id} className="flex min-w-0 items-center gap-2 border-b border-border py-2.5">
                <button type="button" onClick={() => openCoin(coin.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <CoinIcon id={coin.id} symbol={coin.symbol} image={coin.image} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{coin.symbol}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {formatUsd(coin.marketCap)} MCap · {formatUsd(coin.volume24h)} Vol
                    </span>
                  </span>
                </button>
                <Spark points={coin.sparkline} up={up} />
                <button type="button" onClick={() => openCoin(coin.id)} className="w-[4.5rem] shrink-0 overflow-hidden text-right">
                  <span className="block truncate text-sm font-semibold tabular">{formatUsd(coin.price, true)}</span>
                  <span className={cn("block truncate text-xs tabular", up ? "text-success" : "text-danger")}>{formatPct(change)}</span>
                </button>
                <button type="button" aria-label={`Star ${coin.symbol}`} onClick={() => toggleStar(coin.id)} className="shrink-0 text-muted">
                  <Star className={cn("size-4", stars.includes(coin.id) && "fill-current text-foreground")} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[4.75rem] z-30 px-4 md:bottom-6">
        <button
          type="button"
          onClick={onSwap}
          className="mx-auto block h-12 w-full max-w-md rounded-full bg-primary text-sm font-semibold text-primary-fg shadow-[0_8px_24px_rgb(16_185_129/0.25)]"
        >
          Swap
        </button>
      </div>
    </div>
  );
}
