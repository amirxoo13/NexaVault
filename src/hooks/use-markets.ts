import { useQuery } from "@tanstack/react-query";
import { fetchChart, fetchMarkets, marketMap, type MarketCoin } from "@/lib/prices";

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: fetchMarkets,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 2,
  });
}

export function useMarketMap(): Record<string, MarketCoin> {
  const q = useMarkets();
  return q.data ? marketMap(q.data) : {};
}

export function useChart(id: string, days: number) {
  return useQuery({
    queryKey: ["chart", id, days],
    queryFn: () => fetchChart(id, days),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 1,
  });
}
