import { getSql } from "@/lib/db";
import { BALANCE_EPOCH, COINS } from "@/lib/coins";
import { generateAddress, generateWalletCodes } from "@/lib/addresses";
import { mergeClientWallet, type CloudWallet } from "@/lib/cloud-state";
import { sessionMatches } from "@/lib/accounts-send";
import type { WalletAddresses } from "@/lib/store";

async function ensureSchema() {
  const sql = await getSql();
  await sql.query(
    `create table if not exists user_wallets (
      email text primary key,
      wallet_json text not null,
      updated_at timestamptz not null default now()
    )`,
  );
}

function freshWallet(email: string): CloudWallet {
  const addresses: WalletAddresses = { ...generateWalletCodes() };
  for (const coin of COINS) {
    if (!addresses[coin.chain]) addresses[coin.chain] = generateAddress(coin.kind);
  }
  return {
    profile: {
      firstName: "",
      lastName: "",
      email,
      address: "",
      phone: "",
      nationalId: "",
      licensePhoto: null,
    },
    holdings: COINS.map((coin) => ({ id: coin.id, amount: 0 })),
    transactions: [],
    addresses,
    scenario: null,
    balanceEpoch: BALANCE_EPOCH,
  };
}

export async function loadUserWallet(email: string): Promise<CloudWallet | null> {
  const normalized = email.trim().toLowerCase();
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ wallet_json: string }>("select wallet_json from user_wallets where email = $1", [
    normalized,
  ]);
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].wallet_json) as CloudWallet;
  } catch {
    return null;
  }
}

export async function putUserWallet(email: string, wallet: CloudWallet) {
  const normalized = email.trim().toLowerCase();
  await ensureSchema();
  const sql = await getSql();
  const json = JSON.stringify(wallet);
  const rows = await sql.query<{ email: string }>("select email from user_wallets where email = $1", [normalized]);
  if (rows[0]) {
    await sql.query("update user_wallets set wallet_json = $1, updated_at = now() where email = $2", [json, normalized]);
  } else {
    await sql.query("insert into user_wallets (email, wallet_json) values ($1, $2)", [normalized, json]);
  }
}

export async function listUserWallets(): Promise<{ email: string; wallet: CloudWallet }[]> {
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ email: string; wallet_json: string }>("select email, wallet_json from user_wallets");
  const out: { email: string; wallet: CloudWallet }[] = [];
  for (const row of rows) {
    try {
      out.push({ email: row.email, wallet: JSON.parse(row.wallet_json) as CloudWallet });
    } catch {
      /* skip a broken row */
    }
  }
  return out;
}

export async function ensureUserWallet(email: string): Promise<CloudWallet> {
  const existing = await loadUserWallet(email);
  if (existing) return existing;
  const created = freshWallet(email.trim().toLowerCase());
  await putUserWallet(email, created);
  return created;
}

export async function readPrivateWallet(email: string, token: string) {
  const normalized = email.trim().toLowerCase();
  if (!(await sessionMatches(normalized, token))) return { ok: false as const, wallet: null };
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ wallet_json: string }>("select wallet_json from user_wallets where email = $1", [
    normalized,
  ]);
  if (!rows[0]) {
    const created = freshWallet(normalized);
    await sql.query("insert into user_wallets (email, wallet_json) values ($1, $2)", [
      normalized,
      JSON.stringify(created),
    ]);
    return { ok: true as const, wallet: created };
  }
  const wallet = JSON.parse(rows[0].wallet_json) as CloudWallet;
  const { settlePrivate } = await import("./transfer-send");
  const settled = await settlePrivate(normalized);
  return { ok: true as const, wallet: settled ?? wallet };
}

export async function writePrivateWallet(email: string, token: string, incoming: unknown) {
  const normalized = email.trim().toLowerCase();
  if (!(await sessionMatches(normalized, token))) return { ok: false as const, wallet: null };
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ wallet_json: string }>("select wallet_json from user_wallets where email = $1", [
    normalized,
  ]);
  const base = rows[0]?.wallet_json ?? JSON.stringify(freshWallet(normalized));
  const wallet = mergeClientWallet(base, incoming);
  wallet.profile = { ...wallet.profile, email: wallet.profile.email || normalized };
  wallet.holdings = wallet.holdings.map((holding) => ({ ...holding, amount: Math.max(0, holding.amount) }));
  const json = JSON.stringify(wallet);
  if (rows[0]) {
    await sql.query("update user_wallets set wallet_json = $1, updated_at = now() where email = $2", [json, normalized]);
  } else {
    await sql.query("insert into user_wallets (email, wallet_json) values ($1, $2)", [normalized, json]);
  }
  return { ok: true as const, wallet };
}
