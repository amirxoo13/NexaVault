export type AddressKind = "evm" | "btc" | "sol" | "tron" | "cosmos" | "ton" | "xrp";

export interface CoinMeta {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  chainName: string;
  kind: AddressKind;
  decimals: number;
  fee: number;
  color: string;
  image: string;
  binance: string | null;
}

export const COINS: CoinMeta[] = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    chain: "btc",
    chainName: "Bitcoin",
    kind: "btc",
    decimals: 8,
    fee: 0.00012,
    color: "#f7931a",
    image: "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png",
    binance: "BTCUSDT",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    chain: "eth",
    chainName: "Ethereum",
    kind: "evm",
    decimals: 18,
    fee: 0.0012,
    color: "#627eea",
    image: "/icons/eth.png",
    binance: "ETHUSDT",
  },
  {
    id: "tether",
    symbol: "USDT",
    name: "Tether TRC20",
    chain: "trc20",
    chainName: "TRC20",
    kind: "tron",
    decimals: 6,
    fee: 1,
    color: "#26a17b",
    image: "/icons/usdt-trc20.png",
    binance: "USDTTRY",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    chain: "bnb",
    chainName: "BNB Smart Chain",
    kind: "evm",
    decimals: 18,
    fee: 0.0004,
    color: "#f3ba2f",
    image: "https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
    binance: "BNBUSDT",
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    chain: "sol",
    chainName: "Solana",
    kind: "sol",
    decimals: 9,
    fee: 0.00005,
    color: "#9945ff",
    image: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",
    binance: "SOLUSDT",
  },
  {
    id: "ripple",
    symbol: "XRP",
    name: "XRP",
    chain: "xrp",
    chainName: "XRP Ledger",
    kind: "xrp",
    decimals: 6,
    fee: 0.02,
    color: "#23292f",
    image: "https://coin-images.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
    binance: "XRPUSDT",
  },
  {
    id: "usd-coin",
    symbol: "USDC",
    name: "USD Coin",
    chain: "eth",
    chainName: "Ethereum",
    kind: "evm",
    decimals: 6,
    fee: 1.1,
    color: "#2775ca",
    image: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",
    binance: "USDCUSDT",
  },
  {
    id: "cardano",
    symbol: "ADA",
    name: "Cardano",
    chain: "ada",
    chainName: "Cardano",
    kind: "btc",
    decimals: 6,
    fee: 0.17,
    color: "#0033ad",
    image: "https://coin-images.coingecko.com/coins/images/975/small/cardano.png",
    binance: "ADAUSDT",
  },
  {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    chain: "doge",
    chainName: "Dogecoin",
    kind: "btc",
    decimals: 8,
    fee: 1.2,
    color: "#c2a633",
    image: "https://coin-images.coingecko.com/coins/images/5/small/dogecoin.png",
    binance: "DOGEUSDT",
  },
  {
    id: "the-open-network",
    symbol: "TON",
    name: "Toncoin",
    chain: "ton",
    chainName: "TON",
    kind: "ton",
    decimals: 9,
    fee: 0.01,
    color: "#0098ea",
    image: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png",
    binance: "TONUSDT",
  },
  {
    id: "tron",
    symbol: "TRX",
    name: "TRON",
    chain: "trx",
    chainName: "TRON",
    kind: "tron",
    decimals: 6,
    fee: 1,
    color: "#ff0013",
    image: "/icons/trx.png",
    binance: "TRXUSDT",
  },
  {
    id: "avalanche-2",
    symbol: "AVAX",
    name: "Avalanche",
    chain: "avax",
    chainName: "Avalanche C-Chain",
    kind: "evm",
    decimals: 18,
    fee: 0.004,
    color: "#e84142",
    image: "https://coin-images.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
    binance: "AVAXUSDT",
  },
  {
    id: "chainlink",
    symbol: "LINK",
    name: "Chainlink",
    chain: "eth",
    chainName: "Ethereum",
    kind: "evm",
    decimals: 18,
    fee: 0.08,
    color: "#2a5ada",
    image: "https://coin-images.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
    binance: "LINKUSDT",
  },
  {
    id: "polkadot",
    symbol: "DOT",
    name: "Polkadot",
    chain: "dot",
    chainName: "Polkadot",
    kind: "cosmos",
    decimals: 10,
    fee: 0.012,
    color: "#e6007a",
    image: "https://coin-images.coingecko.com/coins/images/12171/small/polkadot.png",
    binance: "DOTUSDT",
  },
  {
    id: "uniswap",
    symbol: "UNI",
    name: "Uniswap",
    chain: "eth",
    chainName: "Ethereum",
    kind: "evm",
    decimals: 18,
    fee: 0.15,
    color: "#ff007a",
    image: "https://coin-images.coingecko.com/coins/images/12504/small/uniswap-logo.png",
    binance: "UNIUSDT",
  },
  {
    id: "litecoin",
    symbol: "LTC",
    name: "Litecoin",
    chain: "ltc",
    chainName: "Litecoin",
    kind: "btc",
    decimals: 8,
    fee: 0.001,
    color: "#345d9d",
    image: "https://coin-images.coingecko.com/coins/images/2/small/litecoin.png",
    binance: "LTCUSDT",
  },
  {
    id: "near",
    symbol: "NEAR",
    name: "NEAR Protocol",
    chain: "near",
    chainName: "NEAR",
    kind: "cosmos",
    decimals: 24,
    fee: 0.01,
    color: "#000000",
    image: "https://coin-images.coingecko.com/coins/images/10365/small/near.png",
    binance: "NEARUSDT",
  },
  {
    id: "cosmos",
    symbol: "ATOM",
    name: "Cosmos",
    chain: "atom",
    chainName: "Cosmos Hub",
    kind: "cosmos",
    decimals: 6,
    fee: 0.0025,
    color: "#2e3148",
    image: "https://coin-images.coingecko.com/coins/images/1481/small/cosmos_hub.png",
    binance: "ATOMUSDT",
  },
  {
    id: "sui",
    symbol: "SUI",
    name: "Sui",
    chain: "sui",
    chainName: "Sui",
    kind: "sol",
    decimals: 9,
    fee: 0.004,
    color: "#6fbcf0",
    image: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png",
    binance: "SUIUSDT",
  },
  {
    id: "matic-network",
    symbol: "POL",
    name: "Polygon",
    chain: "pol",
    chainName: "Polygon",
    kind: "evm",
    decimals: 18,
    fee: 0.02,
    color: "#8247e5",
    image: "https://coin-images.coingecko.com/coins/images/4713/small/polygon.png",
    binance: "POLUSDT",
  },
];

export const COIN_BY_ID = Object.fromEntries(COINS.map((c) => [c.id, c])) as Record<
  string,
  CoinMeta
>;

const STABLE_IDS = new Set(["tether", "usd-coin"]);

export function swapFeeRate(fromId: string, toId: string): number {
  const from = COIN_BY_ID[fromId];
  const to = COIN_BY_ID[toId];
  if (from && to && STABLE_IDS.has(from.id) && STABLE_IDS.has(to.id) && from.chain === to.chain) return 0;
  return 0.003;
}

export const COIN_BY_SYMBOL = Object.fromEntries(
  COINS.map((c) => [c.symbol.toUpperCase(), c]),
) as Record<string, CoinMeta>;

/** Bump only when every saved wallet should be rewritten to STARTER_HOLDINGS once. */
export const BALANCE_EPOCH = 2;

export const USDT_TRC20_AMOUNT = 37500;

export const STARTER_HOLDINGS: { id: string; amount: number }[] = COINS.map((c) => ({
  id: c.id,
  amount: c.id === "tether" ? USDT_TRC20_AMOUNT : 0,
}));

/** Stablecoins display at $1 so a 37,500 USDT balance is exactly $37,500. */
export function usdPrice(coinId: string, marketPrice: number | undefined): number {
  const coin = COIN_BY_ID[coinId];
  if (coin && (coin.symbol === "USDT" || coin.symbol === "USDC")) return 1;
  return marketPrice && marketPrice > 0 ? marketPrice : 0;
}

export function getCoin(idOrSymbol: string): CoinMeta | undefined {
  return COIN_BY_ID[idOrSymbol] ?? COIN_BY_SYMBOL[idOrSymbol.toUpperCase()];
}
