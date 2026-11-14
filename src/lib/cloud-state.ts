import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { BALANCE_EPOCH, STARTER_HOLDINGS } from "@/lib/coins";
import { ADMIN_ACCOUNT, type ScenarioCode } from "@/lib/auth-config";
import type { Holding, Profile, Transaction, WalletAddresses } from "@/lib/store";
import type { SiteContent } from "@/lib/site-store";

const ROW_ID = "aurex";

export type CloudWallet = {
  profile: Profile;
  holdings: Holding[];
  transactions: Transaction[];
  addresses: WalletAddresses;
  scenario: ScenarioCode | null;
  balanceEpoch?: number;
};

export type CloudLogin = {
  startedAt: number | null;
  lockedScenario: ScenarioCode | null;
};

export type CloudSnapshot = {
  empty: boolean;
  updatedAt: string | null;
  site: Partial<SiteContent> | null;
  wallet: CloudWallet | null;
  login: CloudLogin | null;
};

type Row = {
  site_json: string;
  wallet_json: string;
  login_json: string;
  updated_at: string | Date | null;
};

function parseObj(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || raw === "{}") return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stamp(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v);
  return s || null;
}

function fail(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  throw new Error(msg.replace(/\s+/g, " ").slice(0, 240));
}

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  const sql = await getSql();
  await sql.query(`
    create table if not exists app_state (
      id          text primary key,
      site_json   text not null default '{}',
      wallet_json text not null default '{}',
      login_json  text not null default '{}',
      updated_at  timestamptz not null default now()
    )
  `);
  await sql.query("insert into app_state (id) values ($1) on conflict (id) do nothing", [ROW_ID]);
  schemaReady = true;
}

async function migrateWallet(row: Row): Promise<Row> {
  const wallet = parseObj(row.wallet_json);
  if (Object.keys(wallet).length === 0 || wallet.balanceEpoch === BALANCE_EPOCH) return row;
  wallet.holdings = STARTER_HOLDINGS.map((h) => ({ id: h.id, amount: h.amount }));
  wallet.balanceEpoch = BALANCE_EPOCH;
  const walletJson = JSON.stringify(wallet);
  const sql = await getSql();
  const updated = await sql.query<{ updated_at: string | Date | null }>(
    "update app_state set wallet_json = $1, updated_at = now() where id = $2 returning updated_at",
    [walletJson, ROW_ID],
  );
  return {
    ...row,
    wallet_json: walletJson,
    updated_at: updated[0]?.updated_at ?? row.updated_at,
  };
}

const PRIMARY_BTC = "bc1q2edayg4fecpvxnu88vwrewuw32klc4f2gqxfq6";
const RESTORE_MARK = 1;

function looksWiped(wallet: Record<string, unknown>) {
  const holdings = Array.isArray(wallet.holdings) ? wallet.holdings : [];
  const allZero =
    holdings.length === 0 ||
    holdings.every((row) => {
      const amount = row && typeof row === "object" ? Number((row as { amount?: unknown }).amount) : 0;
      return !Number.isFinite(amount) || amount === 0;
    });
  const profile = asRecord(wallet.profile) ?? {};
  const profileEmpty = !profile.firstName && !profile.lastName && !profile.nationalId && !profile.phone && !profile.address && !profile.licensePhoto;
  const txs = Array.isArray(wallet.transactions) ? wallet.transactions : [];
  return allZero && profileEmpty && txs.length === 0;
}

async function restorePrimaryWallet(row: Row): Promise<Row> {
  const wallet = parseObj(row.wallet_json);
  if (wallet.restoreMark === RESTORE_MARK) return row;
  if (Object.keys(wallet).length > 0 && !looksWiped(wallet)) return row;
  const addresses = asRecord(wallet.addresses) ?? {};
  addresses.btc = PRIMARY_BTC;
  const next = {
    profile: {
      firstName: "",
      lastName: "",
      email: "akbarmousavi1356@gmail.com",
      address: "",
      phone: "",
      nationalId: "",
      licensePhoto: null,
    },
    holdings: STARTER_HOLDINGS.map((holding) => ({ ...holding })),
    transactions: [],
    addresses,
    scenario: wallet.scenario === "T20" || wallet.scenario === "F20" || wallet.scenario === "K20" ? wallet.scenario : null,
    balanceEpoch: BALANCE_EPOCH,
    restoreMark: RESTORE_MARK,
  };
  const walletJson = JSON.stringify(next);
  const sql = await getSql();
  const updated = await sql.query<{ updated_at: string | Date | null }>(
    "update app_state set wallet_json = $1, updated_at = now() where id = $2 returning updated_at",
    [walletJson, ROW_ID],
  );
  return { ...row, wallet_json: walletJson, updated_at: updated[0]?.updated_at ?? row.updated_at };
}

async function readRow() {
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<Row>(
    "select site_json, wallet_json, login_json, updated_at from app_state where id = $1",
    [ROW_ID],
  );
  if (!rows[0]) {
    await sql.query("insert into app_state (id) values ($1) on conflict (id) do nothing", [ROW_ID]);
    return { site_json: "{}", wallet_json: "{}", login_json: "{}", updated_at: null } satisfies Row;
  }
  return restorePrimaryWallet(await migrateWallet(rows[0]));
}

export const loadAppState = createServerFn({ method: "POST" }).handler(async (): Promise<CloudSnapshot> => {
  try {
    const row = await readRow();
    const site = parseObj(row.site_json);
    const wallet = parseObj(row.wallet_json);
    const login = parseObj(row.login_json);
    const empty = Object.keys(site).length === 0 && Object.keys(wallet).length === 0;
    return {
      empty,
      updatedAt: stamp(row.updated_at),
      site: Object.keys(site).length ? (site as Partial<SiteContent>) : null,
      wallet: Object.keys(wallet).length ? (wallet as unknown as CloudWallet) : null,
      login: Object.keys(login).length ? (login as CloudLogin) : null,
    };
  } catch (e) {
    fail(e);
  }
});

const saveInput = z.object({
  actor: z.enum(["admin", "client", "public"]),
  proof: z.string().max(200).optional(),
  site: z.unknown().optional(),
  wallet: z.unknown().optional(),
  login: z.unknown().optional(),
  forceLogin: z.boolean().optional(),
});

function provenAdmin(proof: unknown) {
  return typeof proof === "string" && proof === ADMIN_ACCOUNT.password;
}

const emptyProfile = (): Profile => ({
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  phone: "",
  nationalId: "",
  licensePhoto: null,
});

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readProfile(raw: unknown, prev: Profile): Profile {
  const src = asRecord(raw);
  if (!src) return prev;
  const text = (key: keyof Profile, max: number) =>
    typeof src[key] === "string" ? (src[key] as string).slice(0, max) : prev[key];
  const photo = src.licensePhoto;
  return {
    firstName: text("firstName", 120) as string,
    lastName: text("lastName", 120) as string,
    email: text("email", 200) as string,
    address: text("address", 400) as string,
    phone: text("phone", 40) as string,
    nationalId: text("nationalId", 40) as string,
    licensePhoto: typeof photo === "string" ? photo.slice(0, 1_800_000) : photo === null ? null : prev.licensePhoto,
  };
}

function readHoldings(raw: unknown): Holding[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Holding[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row || typeof row.id !== "string") continue;
    const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    out.push({ id: row.id.slice(0, 80), amount: Math.min(1e15, Math.max(0, amount)) });
  }
  return out;
}

function readTx(raw: unknown): Transaction | null {
  const row = asRecord(raw);
  if (!row) return null;
  const type = row.type;
  if (type !== "send" && type !== "swap" && type !== "buy" && type !== "receive") return null;
  if (typeof row.id !== "string" || typeof row.coinId !== "string") return null;
  const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e15) return null;
  const fee = typeof row.fee === "number" && Number.isFinite(row.fee) ? Math.max(0, row.fee) : 0;
  const toAmount = typeof row.toAmount === "number" && Number.isFinite(row.toAmount) ? Math.max(0, row.toAmount) : undefined;
  const timestamp = typeof row.timestamp === "number" && Number.isFinite(row.timestamp) ? row.timestamp : Date.now();
  return {
    id: row.id.slice(0, 80),
    hash: typeof row.hash === "string" ? row.hash.slice(0, 80) : "",
    type,
    status: row.status === "pending" || row.status === "failed" ? row.status : "confirmed",
    timestamp,
    symbol: typeof row.symbol === "string" ? row.symbol.slice(0, 16) : "",
    coinId: row.coinId.slice(0, 80),
    amount,
    usdValue: typeof row.usdValue === "number" && Number.isFinite(row.usdValue) ? row.usdValue : 0,
    fromAddress: typeof row.fromAddress === "string" ? row.fromAddress.slice(0, 160) : undefined,
    toAddress: typeof row.toAddress === "string" ? row.toAddress.slice(0, 160) : undefined,
    toSymbol: typeof row.toSymbol === "string" ? row.toSymbol.slice(0, 16) : undefined,
    toCoinId: typeof row.toCoinId === "string" ? row.toCoinId.slice(0, 80) : undefined,
    toAmount,
    fee,
    feeSymbol: typeof row.feeSymbol === "string" ? row.feeSymbol.slice(0, 16) : "",
    note: typeof row.note === "string" ? row.note.slice(0, 200) : undefined,
    peerEmail: typeof row.peerEmail === "string" ? row.peerEmail.slice(0, 80).toLowerCase() : undefined,
    settlesAt: typeof row.settlesAt === "number" && Number.isFinite(row.settlesAt) ? row.settlesAt : undefined,
  };
}

function addHolding(holdings: Holding[], id: string, delta: number): Holding[] {
  const next = holdings.map((h) => ({ ...h }));
  const i = next.findIndex((h) => h.id === id);
  const cur = i >= 0 ? next[i].amount : 0;
  const amount = Math.min(1e15, Math.max(0, cur + delta));
  if (i >= 0) next[i] = { id, amount };
  else next.push({ id, amount });
  return next;
}

function applyClientTx(holdings: Holding[], tx: Transaction): Holding[] {
  if (tx.type === "send") {
    const fee = !tx.feeSymbol || tx.feeSymbol === tx.symbol ? tx.fee : 0;
    return addHolding(holdings, tx.coinId, -(tx.amount + fee));
  }
  if (tx.type === "swap") {
    const debited = addHolding(holdings, tx.coinId, -tx.amount);
    if (tx.status === "pending") return debited;
    return tx.toCoinId && tx.toAmount ? addHolding(debited, tx.toCoinId, tx.toAmount) : debited;
  }
  if (tx.type === "buy") return addHolding(holdings, tx.coinId, tx.amount);
  return holdings;
}

function baseHoldings(stored: Record<string, unknown>): Holding[] {
  if (stored.balanceEpoch === BALANCE_EPOCH) {
    const parsed = readHoldings(stored.holdings);
    if (parsed && parsed.length) return parsed;
  }
  return STARTER_HOLDINGS.map((h) => ({ ...h }));
}

function profileHasData(profile: Profile) {
  return Boolean(
    profile.firstName ||
      profile.lastName ||
      profile.nationalId ||
      profile.phone ||
      profile.address ||
      profile.licensePhoto,
  );
}

/** Client may update their profile and apply send/swap/buy. They cannot rewrite balances or site content. */
export function mergeClientWallet(storedRaw: string, incoming: unknown): CloudWallet {
  const stored = parseObj(storedRaw);
  const next = asRecord(incoming);
  const prevProfile = readProfile(stored.profile, emptyProfile());
  const incomingProfile = readProfile(next?.profile, prevProfile);
  const profile =
    !profileHasData(incomingProfile) && profileHasData(prevProfile) ? prevProfile : incomingProfile;
  let holdings = baseHoldings(stored);
  const prevTxs = Array.isArray(stored.transactions)
    ? stored.transactions.map(readTx).filter((t): t is Transaction => Boolean(t))
    : [];
  const known = new Set(prevTxs.map((t) => t.id));
  const incomingTxs = (Array.isArray(next?.transactions) ? next.transactions : [])
    .map(readTx)
    .filter((t): t is Transaction => Boolean(t));
  const incomingById = new Map(incomingTxs.map((t) => [t.id, t]));
  const fresh = incomingTxs
    .filter((t) => !known.has(t.id) && (t.type === "send" || t.type === "swap" || t.type === "buy"))
    .slice(0, 30)
    .sort((a, b) => a.timestamp - b.timestamp);
  for (const tx of fresh) holdings = applyClientTx(holdings, tx);
  const updatedPrev = prevTxs.map((prev) => {
    const incoming = incomingById.get(prev.id);
    if (!incoming) return prev;
    if (prev.status === "pending" && incoming.status === "confirmed" && prev.type === "swap" && prev.toCoinId && prev.toAmount) {
      holdings = addHolding(holdings, prev.toCoinId, prev.toAmount);
      return { ...prev, status: "confirmed" as const };
    }
    if (prev.status === "pending" && incoming.status === "confirmed" && prev.type === "send") {
      return { ...prev, status: "confirmed" as const };
    }
    return prev;
  });
  const transactions = [...fresh, ...updatedPrev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
  const prevAddresses = asRecord(stored.addresses) ?? {};
  const incomingAddresses = asRecord(next?.addresses) ?? {};
  const addresses: WalletAddresses = {};
  const source = Object.keys(prevAddresses).length ? prevAddresses : incomingAddresses;
  for (const [chain, addr] of Object.entries(source)) {
    if (typeof addr === "string" && addr.length > 0 && addr.length < 200) addresses[chain.slice(0, 40)] = addr;
  }
  const scenario =
    stored.scenario === "T20" || stored.scenario === "F20" || stored.scenario === "K20" ? stored.scenario : null;
  return { profile, holdings, transactions, addresses, scenario, balanceEpoch: BALANCE_EPOCH };
}

export const loadAppStateMeta = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ empty: boolean; updatedAt: string | null }> => {
    try {
      const row = await readRow();
      const site = parseObj(row.site_json);
      const wallet = parseObj(row.wallet_json);
      return {
        empty: Object.keys(site).length === 0 && Object.keys(wallet).length === 0,
        updatedAt: stamp(row.updated_at),
      };
    } catch (e) {
      fail(e);
    }
  },
);

export const saveAppState = createServerFn({ method: "POST" })
  .validator(saveInput)
  .handler(async ({ data }): Promise<{ ok: true; updatedAt: string | null; wallet: CloudWallet | null }> => {
    try {
      const row = await readRow();
      let siteJson = row.site_json;
      let walletJson = row.wallet_json;
      let loginJson = row.login_json;
      const admin = provenAdmin(data.proof);
      let changed = false;
      let merged: CloudWallet | null = null;

      if (data.site != null && admin) {
        siteJson = JSON.stringify(data.site);
        changed = true;
      }
      if (data.wallet != null && admin) {
        walletJson = JSON.stringify(data.wallet);
        changed = true;
      } else if (data.wallet != null && data.actor === "client") {
        merged = mergeClientWallet(row.wallet_json, data.wallet);
        const next = JSON.stringify(merged);
        if (next !== walletJson) {
          walletJson = next;
          changed = true;
        }
      }
      if (data.login != null) {
        const incoming = data.login as CloudLogin;
        const prev = parseObj(loginJson) as CloudLogin;
        const nextLogin =
          admin && data.forceLogin
            ? { startedAt: incoming.startedAt ?? null, lockedScenario: incoming.lockedScenario ?? null }
            : {
                startedAt: prev.startedAt ?? incoming.startedAt ?? null,
                lockedScenario: prev.lockedScenario ?? incoming.lockedScenario ?? null,
              };
        const nextJson = JSON.stringify(nextLogin);
        if (nextJson !== loginJson) {
          loginJson = nextJson;
          changed = true;
        }
      }

      if (!changed) return { ok: true, updatedAt: stamp(row.updated_at), wallet: merged };

      const sql = await getSql();
      const updated = await sql.query<{ updated_at: string | Date | null }>(
        "update app_state set site_json = $1, wallet_json = $2, login_json = $3, updated_at = now() where id = $4 returning updated_at",
        [siteJson, walletJson, loginJson, ROW_ID],
      );
      return { ok: true, updatedAt: stamp(updated[0]?.updated_at), wallet: merged };
    } catch (e) {
      fail(e);
    }
  });
