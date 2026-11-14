const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const usdFine = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 6,
});

export function formatUsd(value: number, fine = false): string {
  if (!Number.isFinite(value)) return "$0.00";
  if (fine && Math.abs(value) < 1) return usdFine.format(value);
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return usd.format(value);
}

export function formatUsdFull(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  if (Math.abs(value) < 0.01 && value !== 0) return usdFine.format(value);
  return usd.format(value);
}

export function formatAmount(value: number, max = 8): string {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  const str = value.toFixed(max).replace(/\.?0+$/, "");
  return str;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0.00%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function shortAddress(address: string, left = 6, right = 4): string {
  if (address.length <= left + right + 3) return address;
  return `${address.slice(0, left)}…${address.slice(-right)}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomBase58(length: number): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (const n of arr) out += alphabet[n % alphabet.length];
  return out;
}
