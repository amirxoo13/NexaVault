import * as webpush from "web-push";
import { getSql } from "@/lib/db";
import { COINS } from "@/lib/coins";
import { fetchMarkets, type MarketCoin } from "@/lib/prices";
import { ADMIN_ACCOUNT } from "@/lib/auth-config";
import { formatAmount, formatUsdFull, shortAddress } from "@/lib/format";

const PRICE_MS = 4 * 60 * 60 * 1000;
const BALANCE_MS = 2 * 60 * 60 * 1000;
const ROW = "aurex";

async function ensureSchema() {
  const sql = await getSql();
  await sql.query(
    `create table if not exists push_config (
      id text primary key,
      public_key text not null,
      private_key text not null,
      last_price_at bigint not null default 0,
      last_balance_at bigint not null default 0
    )`,
  );
  await sql.query(
    `create table if not exists push_subs (
      endpoint text primary key,
      p256dh text not null,
      auth text not null,
      created_at timestamptz not null default now()
    )`,
  );
  await sql.query("alter table push_subs add column if not exists email text");
}

type Keys = { publicKey: string; privateKey: string };

async function keys(): Promise<Keys> {
  await ensureSchema();
  const sql = await getSql();
  const existing = await sql.query<{ public_key: string; private_key: string }>(
    "select public_key, private_key from push_config where id = $1",
    [ROW],
  );
  if (existing[0]) return { publicKey: existing[0].public_key, privateKey: existing[0].private_key };
  const made = webpush.generateVAPIDKeys();
  await sql.query(
    "insert into push_config (id, public_key, private_key) values ($1, $2, $3) on conflict (id) do nothing",
    [ROW, made.publicKey, made.privateKey],
  );
  const again = await sql.query<{ public_key: string; private_key: string }>(
    "select public_key, private_key from push_config where id = $1",
    [ROW],
  );
  return { publicKey: again[0].public_key, privateKey: again[0].private_key };
}

function arm(publicKey: string, privateKey: string) {
  webpush.setVapidDetails("mailto:amir.behi2333@gmail.com", publicKey, privateKey);
}

export async function publicPushKey() {
  const k = await keys();
  return { publicKey: k.publicKey };
}

export async function saveSub(data: { endpoint: string; keys: { p256dh: string; auth: string }; email?: string }) {
  await keys();
  const sql = await getSql();
  const email = (data.email ?? "").trim().toLowerCase();
  await sql.query(
    `insert into push_subs (endpoint, p256dh, auth, email)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, email = case when excluded.email = '' then push_subs.email else excluded.email end`,
    [data.endpoint, data.keys.p256dh, data.keys.auth, email],
  );
  return { ok: true as const };
}

export async function removeSub(endpoint: string) {
  const sql = await getSql();
  await sql.query("delete from push_subs where endpoint = $1", [endpoint]);
  return { ok: true as const };
}

type HoldingRow = { id: string; amount: number };

async function readHoldings(): Promise<HoldingRow[]> {
  const sql = await getSql();
  const rows = await sql.query<{ wallet_json: string }>("select wallet_json from app_state where id = $1", [ROW]);
  const raw = rows[0]?.wallet_json;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { holdings?: unknown };
    if (!Array.isArray(parsed.holdings)) return [];
    const out: HoldingRow[] = [];
    for (const item of parsed.holdings) {
      if (!item || typeof item !== "object") continue;
      const row = item as { id?: unknown; amount?: unknown };
      const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
      if (typeof row.id !== "string" || !Number.isFinite(amount) || amount <= 0) continue;
      out.push({ id: row.id, amount });
    }
    return out;
  } catch {
    return [];
  }
}

function pct(n: number): string {
  const v = n.toFixed(2);
  return n > 0 ? `+${v}%` : `${v}%`;
}

function priceNote(markets: MarketCoin[], holdings: HoldingRow[]): { title: string; body: string } {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const order = ["bitcoin", "ethereum", ...holdings.map((h) => h.id), "solana", "binancecoin", "tether"];
  const picked: MarketCoin[] = [];
  for (const id of order) {
    const m = byId.get(id);
    if (!m || picked.some((p) => p.id === m.id)) continue;
    picked.push(m);
    if (picked.length === 4) break;
  }
  const body = picked.map((m) => `${m.symbol} ${formatUsdFull(m.price)} ${pct(m.change24h)}`).join(" · ");
  return { title: "Prices", body: body || "Prices are unavailable." };
}

function balanceNote(markets: MarketCoin[], holdings: HoldingRow[]): { title: string; body: string } {
  const byId = new Map(markets.map((m) => [m.id, m]));
  const coinById = new Map(COINS.map((c) => [c.id, c]));
  let total = 0;
  const parts: string[] = [];
  for (const h of holdings) {
    const coin = coinById.get(h.id);
    const market = byId.get(h.id);
    const price = market?.price ?? (h.id === "tether" || h.id === "usd-coin" ? 1 : 0);
    total += h.amount * price;
    parts.push(`${coin?.symbol ?? h.id} ${formatAmount(h.amount)}`);
  }
  return {
    title: `Wallet ${formatUsdFull(total)}`,
    body: parts.slice(0, 4).join(" · ") || "No tokens in the wallet.",
  };
}

async function claim(column: "last_price_at" | "last_balance_at", waitMs: number, force: boolean): Promise<boolean> {
  const sql = await getSql();
  const now = Date.now();
  if (force) {
    await sql.query(`update push_config set ${column} = $1 where id = $2`, [now, ROW]);
    return true;
  }
  const rows = await sql.query(
    `update push_config set ${column} = $1 where id = $2 and ${column} <= $3 returning id`,
    [now, ROW, now - waitMs],
  );
  return rows.length > 0;
}

async function release(column: "last_price_at" | "last_balance_at") {
  const sql = await getSql();
  await sql.query(`update push_config set ${column} = 0 where id = $1`, [ROW]);
}

type Sub = { endpoint: string; p256dh: string; auth: string; email?: string | null };

async function deliver(subs: Sub[], note: { title: string; body: string; tag: string; url?: string }) {
  if (!subs.length) return { devices: 0, sent: 0, failed: 0, lastStatus: 0 };
  const sql = await getSql();
  const k = await keys();
  arm(k.publicKey, k.privateKey);
  const payload = JSON.stringify({ ...note, url: note.url || "/wallet/activity" });
  let sent = 0;
  let failed = 0;
  let lastStatus = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 * 60 * 12, urgency: "high" },
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      const status = (err as { statusCode?: number }).statusCode ?? 0;
      lastStatus = status;
      if (status === 404 || status === 410) {
        await sql.query("delete from push_subs where endpoint = $1", [sub.endpoint]);
      }
    }
  }
  return { devices: subs.length, sent, failed, lastStatus };
}

async function subsFor(emails: string[]) {
  const sql = await getSql();
  const want = new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  const rows = await sql.query<Sub>("select endpoint, p256dh, auth, email from push_subs");
  return rows.filter((row) => row.email && want.has(row.email.toLowerCase()));
}

async function broadcast(note: { title: string; body: string; tag: string; url?: string }) {
  const sql = await getSql();
  const subs = await sql.query<Sub>("select endpoint, p256dh, auth, email from push_subs");
  return deliver(subs, note);
}

export async function notifyMovement(input: {
  emails: string[];
  direction: "sent" | "received";
  symbol: string;
  amount: number;
  usd: number;
  counterparty: string;
  network: string;
  hash: string;
  account?: string;
}) {
  await keys();
  const amount = formatAmount(input.amount);
  const title = input.direction === "sent" ? `Sent ${amount} ${input.symbol}` : `Received ${amount} ${input.symbol}`;
  const who = input.direction === "sent" ? "To" : "From";
  const party = input.counterparty.includes("@") ? input.counterparty : shortAddress(input.counterparty, 8, 6);
  const body = [input.usd > 0 ? formatUsdFull(input.usd) : "", `${who} ${party}`, input.network].filter(Boolean).join(" · ");
  const tag = `trust-${input.direction}-${input.hash || Date.now()}`;
  const own = await deliver(await subsFor(input.emails), { title, body, tag, url: "/wallet/activity" });
  const admin = ADMIN_ACCOUNT.email.toLowerCase();
  const already = input.emails.some((email) => email.trim().toLowerCase() === admin);
  if (already) return own;
  const adminBody = [input.account, body].filter(Boolean).join(" · ");
  const copy = await deliver(await subsFor([admin]), {
    title,
    body: adminBody,
    tag: `${tag}-admin`,
    url: "/wallet/activity",
  });
  return { devices: own.devices + copy.devices, sent: own.sent + copy.sent, failed: own.failed + copy.failed, lastStatus: own.lastStatus || copy.lastStatus };
}

export async function sendCustomNotice(title: string, body: string) {
  await keys();
  return broadcast({
    title: title.trim() || "NexaVault",
    body: body.trim(),
    tag: `trust-note-${Date.now()}`,
  });
}

export async function dispatchAlerts(force = false): Promise<{
  price: boolean;
  balance: boolean;
  sent: number;
  devices: number;
  failed: number;
  lastStatus: number;
}> {
  await keys();
  const sql = await getSql();
  const count = await sql.query<{ n: number }>("select count(*)::int as n from push_subs");
  const devices = Number(count[0]?.n ?? 0);
  if (!devices) return { price: false, balance: false, sent: 0, devices: 0, failed: 0, lastStatus: 0 };

  const sendPrice = await claim("last_price_at", PRICE_MS, force);
  const sendBalance = await claim("last_balance_at", BALANCE_MS, force);
  if (!sendPrice && !sendBalance) {
    return { price: false, balance: false, sent: 0, devices, failed: 0, lastStatus: 0 };
  }

  let markets: MarketCoin[];
  try {
    markets = await fetchMarkets();
  } catch {
    if (sendPrice) await release("last_price_at");
    if (sendBalance) await release("last_balance_at");
    return { price: false, balance: false, sent: 0, devices, failed: 0, lastStatus: 0 };
  }
  const holdings = await readHoldings();
  let sent = 0;
  let failed = 0;
  let lastStatus = 0;
  if (sendPrice) {
    const res = await broadcast({ ...priceNote(markets, holdings), tag: "trust-prices" });
    sent += res.sent;
    failed += res.failed;
    lastStatus = res.lastStatus || lastStatus;
    if (res.sent === 0) await release("last_price_at");
  }
  if (sendBalance) {
    const res = await broadcast({ ...balanceNote(markets, holdings), tag: "trust-balance" });
    sent += res.sent;
    failed += res.failed;
    lastStatus = res.lastStatus || lastStatus;
    if (res.sent === 0) await release("last_balance_at");
  }
  return { price: sendPrice, balance: sendBalance, sent, devices, failed, lastStatus };
}
