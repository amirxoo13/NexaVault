import { randomBytes, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { COIN_BY_ID } from "@/lib/coins";
import { generateAddress } from "@/lib/addresses";
import { ADMIN_ACCOUNT, CLIENT_ACCOUNT } from "@/lib/auth-config";
import { sessionMatches } from "@/lib/accounts-send";
import { ensureUserWallet, listUserWallets, loadUserWallet, putUserWallet } from "@/lib/user-wallet-send";
import type { CloudWallet } from "@/lib/cloud-state";
import type { Transaction } from "@/lib/store";
import { SEND_PIPELINE_MS } from "@/lib/send-pipeline";

const PRIMARY = CLIENT_ACCOUNT.email.toLowerCase();
const ADMIN = ADMIN_ACCOUNT.email.toLowerCase();
const ROW_ID = "aurex";

async function ensureSessions() {
  const sql = await getSql();
  await sql.query(
    `create table if not exists wallet_sessions (
      email text primary key,
      token text not null,
      wallet_email text not null
    )`,
  );
}

function sameToken(stored: string, token: string) {
  if (!stored || stored.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
}

export async function issueWalletSession(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const allowed =
    (normalized === PRIMARY && password === CLIENT_ACCOUNT.password) ||
    (normalized === ADMIN && password === ADMIN_ACCOUNT.password);
  if (!allowed) return { ok: false as const };
  await ensureSessions();
  const token = randomBytes(24).toString("hex");
  const sql = await getSql();
  await sql.query(
    `insert into wallet_sessions (email, token, wallet_email) values ($1, $2, $3)
     on conflict (email) do update set token = excluded.token, wallet_email = excluded.wallet_email`,
    [normalized, token, PRIMARY],
  );
  return { ok: true as const, token };
}

export async function walletEmailFor(actorEmail: string, token: string) {
  const email = actorEmail.trim().toLowerCase();
  if (email === PRIMARY || email === ADMIN) {
    if (!token || token.length < 20) return PRIMARY;
    await ensureSessions();
    const sql = await getSql();
    const rows = await sql.query<{ token: string; wallet_email: string }>(
      "select token, wallet_email from wallet_sessions where email = $1",
      [email],
    );
    if (!rows[0]) return PRIMARY;
    return sameToken(rows[0].token, token) ? rows[0].wallet_email : PRIMARY;
  }
  if (!token || token.length < 20) return null;
  if (await sessionMatches(email, token)) return email;
  await ensureSessions();
  const sql = await getSql();
  const rows = await sql.query<{ token: string; wallet_email: string }>(
    "select token, wallet_email from wallet_sessions where email = $1",
    [email],
  );
  if (!rows[0] || !sameToken(rows[0].token, token)) return null;
  return rows[0].wallet_email;
}

async function loadShared(): Promise<CloudWallet | null> {
  const sql = await getSql();
  const rows = await sql.query<{ wallet_json: string }>("select wallet_json from app_state where id = $1", [ROW_ID]);
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].wallet_json) as CloudWallet;
  } catch {
    return null;
  }
}

async function saveShared(wallet: CloudWallet) {
  const sql = await getSql();
  await sql.query("update app_state set wallet_json = $1, updated_at = now() where id = $2", [
    JSON.stringify(wallet),
    ROW_ID,
  ]);
}

async function loadByEmail(email: string): Promise<CloudWallet | null> {
  if (email === PRIMARY) return loadShared();
  return loadUserWallet(email);
}

async function saveByEmail(email: string, wallet: CloudWallet) {
  if (email === PRIMARY) {
    await saveShared(wallet);
    return;
  }
  await putUserWallet(email, wallet);
}

function sameAddress(left: string, right: string) {
  if (left === right) return true;
  if (left.startsWith("0x") && right.startsWith("0x")) return left.toLowerCase() === right.toLowerCase();
  return false;
}

function ownsAddress(wallet: CloudWallet | null, address: string) {
  if (!wallet?.addresses) return false;
  return Object.values(wallet.addresses).some((value) => sameAddress(value, address));
}

function addressOn(wallet: CloudWallet, chain: string, kind: Parameters<typeof generateAddress>[0]) {
  const current = wallet.addresses?.[chain] || "";
  if (current) return current;
  const created = generateAddress(kind);
  wallet.addresses = { ...(wallet.addresses ?? {}), [chain]: created };
  return created;
}

async function knownEmail(email: string) {
  if (email === PRIMARY || email === ADMIN) return true;
  const sql = await getSql();
  const rows = await sql.query<{ email: string }>("select email from app_accounts where email = $1", [email]);
  return Boolean(rows[0]);
}

async function resolveRecipient(to: string): Promise<{ email: string; wallet: CloudWallet } | null> {
  const raw = to.trim();
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    const walletEmail = email === ADMIN ? PRIMARY : email;
    if (!(await knownEmail(email))) return null;
    const wallet = walletEmail === PRIMARY ? await loadShared() : await ensureUserWallet(walletEmail);
    if (!wallet) return null;
    return { email: walletEmail, wallet };
  }
  const shared = await loadShared();
  if (ownsAddress(shared, raw)) return { email: PRIMARY, wallet: shared as CloudWallet };
  const people = await listUserWallets();
  const hit = people.find((person) => ownsAddress(person.wallet, raw));
  if (!hit) return null;
  return { email: hit.email, wallet: hit.wallet };
}

function holdingOf(wallet: CloudWallet, coinId: string) {
  return wallet.holdings?.find((holding) => holding.id === coinId)?.amount ?? 0;
}

function addHolding(wallet: CloudWallet, coinId: string, delta: number) {
  const holdings = (wallet.holdings ?? []).map((holding) => ({ ...holding }));
  const index = holdings.findIndex((holding) => holding.id === coinId);
  const next = Math.max(0, (index >= 0 ? holdings[index].amount : 0) + delta);
  if (index >= 0) holdings[index] = { id: coinId, amount: next };
  else holdings.push({ id: coinId, amount: next });
  wallet.holdings = holdings;
}

function txId() {
  return randomBytes(8).toString("hex");
}

export async function lookupPlatformUser(actorEmail: string, token: string, to: string, coinId?: string) {
  const sender = await walletEmailFor(actorEmail, token);
  if (!sender) return { ok: false as const, error: "auth" as const };
  const found = await resolveRecipient(to);
  if (!found) return { ok: true as const, found: false as const };
  const coin = coinId ? COIN_BY_ID[coinId] : undefined;
  const name = [found.wallet.profile?.firstName, found.wallet.profile?.lastName].filter(Boolean).join(" ").trim();
  return {
    ok: true as const,
    found: true as const,
    email: found.email,
    name,
    self: found.email === sender,
    address: coin ? found.wallet.addresses?.[coin.chain] || "" : "",
  };
}

export async function transferToUser(input: {
  actorEmail: string;
  token: string;
  coinId: string;
  amount: number;
  to: string;
  usdValue: number;
}) {
  const senderEmail = await walletEmailFor(input.actorEmail, input.token);
  if (!senderEmail) return { ok: false as const, error: "auth" as const };
  const coin = COIN_BY_ID[input.coinId];
  if (!coin) return { ok: false as const, error: "asset" as const };
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e12) {
    return { ok: false as const, error: "amount" as const };
  }
  const sender = await loadByEmail(senderEmail);
  if (!sender) return { ok: false as const, error: "wallet" as const };
  const recipient = await resolveRecipient(input.to);
  if (!recipient) return { ok: false as const, error: "user" as const };
  if (recipient.email === senderEmail) return { ok: false as const, error: "self" as const };
  if (holdingOf(sender, coin.id) + 1e-12 < input.amount + coin.fee) {
    return { ok: false as const, error: "insufficient" as const };
  }

  const hash = `0x${randomBytes(32).toString("hex")}`;
  const stamp = Date.now();
  const fromAddress = addressOn(sender, coin.chain, coin.kind);
  const toAddress = addressOn(recipient.wallet, coin.chain, coin.kind);
  addHolding(sender, coin.id, -(input.amount + coin.fee));
  addHolding(recipient.wallet, coin.id, input.amount);
  const sent: Transaction = {
    id: txId(),
    hash,
    type: "send",
    status: "confirmed",
    timestamp: stamp,
    symbol: coin.symbol,
    coinId: coin.id,
    amount: input.amount,
    usdValue: Number.isFinite(input.usdValue) ? input.usdValue : 0,
    fromAddress,
    toAddress,
    fee: coin.fee,
    feeSymbol: coin.symbol,
  };
  const received: Transaction = {
    id: txId(),
    hash,
    type: "receive",
    status: "confirmed",
    timestamp: stamp,
    symbol: coin.symbol,
    coinId: coin.id,
    amount: input.amount,
    usdValue: Number.isFinite(input.usdValue) ? input.usdValue : 0,
    fromAddress,
    toAddress,
    fee: 0,
    feeSymbol: coin.symbol,
    note: "Incoming transfer",
  };
  sender.transactions = [sent, ...(sender.transactions ?? [])].slice(0, 200);
  recipient.wallet.transactions = [received, ...(recipient.wallet.transactions ?? [])].slice(0, 200);
  await saveByEmail(senderEmail, sender);
  await saveByEmail(recipient.email, recipient.wallet);
  const { notifyMovement } = await import("./push-send");
  const move = {
    symbol: coin.symbol,
    amount: input.amount,
    usd: Number.isFinite(input.usdValue) ? input.usdValue : 0,
    network: coin.chainName,
    hash,
  };
  await notifyMovement({ ...move, emails: [senderEmail], direction: "sent", counterparty: toAddress, account: senderEmail }).catch(() => undefined);
  await notifyMovement({ ...move, emails: [recipient.email], direction: "received", counterparty: fromAddress, account: recipient.email }).catch(() => undefined);
  return { ok: true as const, hash, wallet: sender, toEmail: recipient.email };
}

let transferChain: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = transferChain.then(fn, fn);
  transferChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function dueTransfer(tx: Transaction, now: number) {
  return (
    tx.status === "pending" &&
    (tx.type === "send" || tx.type === "receive") &&
    typeof tx.settlesAt === "number" &&
    tx.settlesAt <= now
  );
}

async function confirmPeer(email: string, hash: string) {
  if (!email) return;
  const peer = await loadByEmail(email);
  if (!peer) return;
  let changed = false;
  for (const tx of peer.transactions ?? []) {
    if (tx.hash !== hash || tx.status !== "pending") continue;
    if (tx.type !== "send" && tx.type !== "receive") continue;
    if (tx.type === "receive") addHolding(peer, tx.coinId, tx.amount);
    tx.status = "confirmed";
    changed = true;
    const coin = COIN_BY_ID[tx.coinId];
    const { notifyMovement } = await import("./push-send");
    await notifyMovement({
      emails: [email],
      direction: tx.type === "receive" ? "received" : "sent",
      symbol: tx.symbol,
      amount: tx.amount,
      usd: tx.usdValue,
      counterparty: tx.type === "receive" ? tx.fromAddress || "" : tx.toAddress || "",
      network: coin?.chainName ?? "",
      hash: tx.hash,
      account: email,
    }).catch(() => undefined);
  }
  if (changed) await saveByEmail(email, peer);
}

export async function startPlatformSend(input: {
  actorEmail: string;
  token: string;
  coinId: string;
  amount: number;
  to: string;
  usdValue: number;
}) {
  return serial(() => startPlatformSendNow(input));
}

async function startPlatformSendNow(input: {
  actorEmail: string;
  token: string;
  coinId: string;
  amount: number;
  to: string;
  usdValue: number;
}) {
  const senderEmail = await walletEmailFor(input.actorEmail, input.token);
  if (!senderEmail) return { ok: false as const, error: "auth" as const };
  const coin = COIN_BY_ID[input.coinId];
  if (!coin) return { ok: false as const, error: "asset" as const };
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1e12) {
    return { ok: false as const, error: "amount" as const };
  }
  const sender = await loadByEmail(senderEmail);
  if (!sender) return { ok: false as const, error: "wallet" as const };
  const recipient = await resolveRecipient(input.to);
  if (!recipient) return { ok: false as const, error: "user" as const };
  if (recipient.email === senderEmail) return { ok: false as const, error: "self" as const };
  if (holdingOf(sender, coin.id) + 1e-12 < input.amount + coin.fee) {
    return { ok: false as const, error: "insufficient" as const };
  }
  const fromAddress = addressOn(sender, coin.chain, coin.kind);
  const toAddress = addressOn(recipient.wallet, coin.chain, coin.kind);

  const hash = `0x${randomBytes(32).toString("hex")}`;
  const stamp = Date.now();
  const settlesAt = stamp + SEND_PIPELINE_MS;
  addHolding(sender, coin.id, -(input.amount + coin.fee));
  const sent: Transaction = {
    id: txId(),
    hash,
    type: "send",
    status: "pending",
    timestamp: stamp,
    symbol: coin.symbol,
    coinId: coin.id,
    amount: input.amount,
    usdValue: Number.isFinite(input.usdValue) ? input.usdValue : 0,
    fromAddress,
    toAddress,
    fee: coin.fee,
    feeSymbol: coin.symbol,
    settlesAt,
    peerEmail: recipient.email,
  };
  const received: Transaction = {
    id: txId(),
    hash,
    type: "receive",
    status: "pending",
    timestamp: stamp,
    symbol: coin.symbol,
    coinId: coin.id,
    amount: input.amount,
    usdValue: sent.usdValue,
    fromAddress,
    toAddress,
    fee: 0,
    feeSymbol: coin.symbol,
    note: "Incoming transfer",
    settlesAt,
    peerEmail: senderEmail,
  };
  sender.transactions = [sent, ...(sender.transactions ?? [])].slice(0, 200);
  recipient.wallet.transactions = [received, ...(recipient.wallet.transactions ?? [])].slice(0, 200);
  await saveByEmail(senderEmail, sender);
  await saveByEmail(recipient.email, recipient.wallet);
  return { ok: true as const, hash, settlesAt, startedAt: stamp, wallet: sender, toEmail: recipient.email };
}

export async function settlePrivate(email: string): Promise<CloudWallet | null> {
  return serial(() => settlePrivateNow(email));
}

async function settlePrivateNow(email: string): Promise<CloudWallet | null> {
  const wallet = await loadByEmail(email);
  if (!wallet) return null;
  const now = Date.now();
  const due = (wallet.transactions ?? []).filter((tx) => dueTransfer(tx, now));
  if (!due.length) return wallet;
  for (const tx of wallet.transactions ?? []) {
    if (!dueTransfer(tx, now)) continue;
    if (tx.type === "receive") addHolding(wallet, tx.coinId, tx.amount);
    tx.status = "confirmed";
  }
  await saveByEmail(email, wallet);
  const { notifyMovement } = await import("./push-send");
  for (const tx of due) {
    if (tx.peerEmail && tx.peerEmail !== PRIMARY) await confirmPeer(tx.peerEmail, tx.hash);
    const coin = COIN_BY_ID[tx.coinId];
    await notifyMovement({
      emails: [email],
      direction: tx.type === "receive" ? "received" : "sent",
      symbol: tx.symbol,
      amount: tx.amount,
      usd: tx.usdValue,
      counterparty: tx.type === "receive" ? tx.fromAddress || "" : tx.toAddress || "",
      network: coin?.chainName ?? "",
      hash: tx.hash,
      account: email,
    }).catch(() => undefined);
  }
  return loadByEmail(email);
}
