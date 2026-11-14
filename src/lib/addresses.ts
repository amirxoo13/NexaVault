import type { AddressKind, CoinMeta } from "@/lib/coins";
import { randomBase58, randomHex } from "@/lib/format";

export function generateAddress(kind: AddressKind): string {
  switch (kind) {
    case "evm":
      return `0x${randomHex(20)}`;
    case "btc":
      return `bc1q${randomHex(16).slice(0, 31)}`;
    case "sol":
      return randomBase58(44);
    case "tron":
      return `T${randomBase58(33)}`;
    case "cosmos":
      return `cosmos1${randomHex(20).slice(0, 38)}`;
    case "ton":
      return `UQ${randomBase58(46)}`;
    case "xrp":
      return `r${randomBase58(33)}`;
    default:
      return `0x${randomHex(20)}`;
  }
}

export function validateAddress(address: string, kind: AddressKind): boolean {
  const a = address.trim();
  if (!a) return false;
  switch (kind) {
    case "evm":
      return /^0x[a-fA-F0-9]{40}$/.test(a);
    case "btc":
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a);
    case "sol":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
    case "tron":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
    case "cosmos":
      return /^[a-z0-9]{10,90}$/.test(a);
    case "ton":
      return /^(UQ|EQ)[A-Za-z0-9_-]{46,48}$/.test(a);
    case "xrp":
      return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a);
    default:
      return a.length > 12;
  }
}

export function addressHint(coin: CoinMeta): string {
  switch (coin.kind) {
    case "evm":
      return "0x…  (42 characters)";
    case "btc":
      return "bc1… or 1… / 3…";
    case "sol":
      return "Base58, 32–44 characters";
    case "tron":
      return "Starts with T";
    case "ton":
      return "Starts with UQ or EQ";
    case "xrp":
      return "Starts with r";
    default:
      return "Network address";
  }
}

export const WALLET_CODES: { chain: string; label: string; kind: AddressKind }[] = [
  { chain: "btc", label: "Bitcoin", kind: "btc" },
  { chain: "eth", label: "Ethereum", kind: "evm" },
  { chain: "trc20", label: "USDT TRC20", kind: "tron" },
  { chain: "bnb", label: "BNB Smart Chain", kind: "evm" },
  { chain: "sol", label: "Solana", kind: "sol" },
  { chain: "xrp", label: "XRP", kind: "xrp" },
  { chain: "ada", label: "Cardano", kind: "btc" },
  { chain: "doge", label: "Dogecoin", kind: "btc" },
  { chain: "ton", label: "TON", kind: "ton" },
  { chain: "trx", label: "TRON", kind: "tron" },
  { chain: "avax", label: "Avalanche", kind: "evm" },
  { chain: "ltc", label: "Litecoin", kind: "btc" },
  { chain: "pol", label: "Polygon", kind: "evm" },
];

export function generateWalletCodes(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of WALLET_CODES) out[spec.chain] = generateAddress(spec.kind);
  return out;
}

const SEED_WORDS = [
  "unfold",
  "unusual",
  "fever",
  "magnet",
  "olive",
  "garden",
  "crane",
  "silk",
  "voyage",
  "habit",
  "cedar",
  "pulse",
] as const;

export function demoSeedPhrase(): string[] {
  return [...SEED_WORDS];
}
