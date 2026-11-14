import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";
import { ADMIN_ACCOUNT, CLIENT_ACCOUNT } from "@/lib/auth-config";

const scrypt = promisify(scryptCb);

async function ensureSchema() {
  const sql = await getSql();
  await sql.query(
    `create table if not exists app_accounts (
      email text primary key,
      password_hash text not null,
      created_at bigint not null
    )`,
  );
  await sql.query(`alter table app_accounts add column if not exists session_token text not null default ''`);
}

function reserved(email: string) {
  return email === ADMIN_ACCOUNT.email.toLowerCase() || email === CLIENT_ACCOUNT.email.toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [kind, salt, hex] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hex) return false;
  const expected = Buffer.from(hex, "hex");
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

export async function createAccount(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return { ok: false as const, error: "invalid" as const };
  if (password.length < 8 || password.length > 80) return { ok: false as const, error: "weak" as const };
  if (reserved(normalized)) return { ok: false as const, error: "taken" as const };
  await ensureSchema();
  const sql = await getSql();
  const existing = await sql.query<{ email: string }>("select email from app_accounts where email = $1", [normalized]);
  if (existing.length) return { ok: false as const, error: "taken" as const };
  await sql.query("insert into app_accounts (email, password_hash, created_at) values ($1, $2, $3)", [
    normalized,
    await hashPassword(password),
    Date.now(),
  ]);
  return { ok: true as const };
}

export async function matchAccount(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (reserved(normalized)) return { ok: false as const };
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ password_hash: string }>(
    "select password_hash from app_accounts where email = $1",
    [normalized],
  );
  if (!rows[0]) return { ok: false as const };
  const valid = await verifyPassword(password, rows[0].password_hash);
  if (!valid) return { ok: false as const };
  const token = randomBytes(24).toString("hex");
  await sql.query("update app_accounts set session_token = $1 where email = $2", [token, normalized]);
  return { ok: true as const, token };
}

export async function sessionMatches(email: string, token: string) {
  if (!token || token.length < 20) return false;
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ session_token: string }>("select session_token from app_accounts where email = $1", [
    email.trim().toLowerCase(),
  ]);
  const stored = rows[0]?.session_token || "";
  if (!stored || stored.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
}

export async function readAccounts() {
  await ensureSchema();
  const sql = await getSql();
  const rows = await sql.query<{ email: string; created_at: number }>(
    "select email, created_at from app_accounts order by created_at desc",
  );
  return rows.map((row) => ({ email: row.email, createdAt: Number(row.created_at) || 0 }));
}

export async function deleteAccount(email: string) {
  const normalized = email.trim().toLowerCase();
  await ensureSchema();
  const sql = await getSql();
  await sql.query("delete from app_accounts where email = $1", [normalized]);
  return { ok: true as const };
}
