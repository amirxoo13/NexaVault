import { getSql } from "@/lib/db";
import { BALANCE_EPOCH, COINS, STARTER_HOLDINGS } from "@/lib/coins";
import { CLIENT_ACCOUNT, type ScenarioCode } from "@/lib/auth-config";
import { ensureUserWallet, putUserWallet } from "@/lib/user-wallet-send";
import type { CloudWallet } from "@/lib/cloud-state";
import type { Holding, Profile, WalletAddresses } from "@/lib/store";

const PRIMARY = CLIENT_ACCOUNT.email.toLowerCase();
const ROW_ID = "aurex";

const emptyProfile = (email: string): Profile => ({
  firstName: "",
  lastName: "",
  email,
  address: "",
  phone: "",
  nationalId: "",
  licensePhoto: null,
});

function cleanProfile(raw: Profile, email: string): Profile {
  const text = (value: string, max: number) => value.trim().slice(0, max);
  return {
    firstName: text(raw.firstName || "", 120),
    lastName: text(raw.lastName || "", 120),
    email: text(raw.email || email, 120),
    address: text(raw.address || "", 240),
    phone: text(raw.phone || "", 40),
    nationalId: text(raw.nationalId || "", 40),
    licensePhoto: typeof raw.licensePhoto === "string" && raw.licensePhoto.startsWith("data:image/") ? raw.licensePhoto.slice(0, 1_500_000) : null,
  };
}

function cleanHoldings(raw: Holding[]): Holding[] {
  const map = new Map(raw.map((row) => [row.id, Number(row.amount)]));
  return COINS.map((coin) => {
    const amount = map.get(coin.id);
    return { id: coin.id, amount: Number.isFinite(amount) ? Math.min(1e15, Math.max(0, amount as number)) : 0 };
  });
}

function cleanAddresses(raw: WalletAddresses): WalletAddresses {
  const out: WalletAddresses = {};
  for (const [chain, addr] of Object.entries(raw)) {
    if (typeof addr === "string" && addr.trim()) out[chain.slice(0, 40)] = addr.trim().slice(0, 180);
  }
  return out;
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

export async function adminReadWallet(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized === PRIMARY) {
    const wallet = await loadShared();
    return (
      wallet ?? {
        profile: emptyProfile(PRIMARY),
        holdings: STARTER_HOLDINGS.map((row) => ({ ...row })),
        transactions: [],
        addresses: { btc: "bc1q2edayg4fecpvxnu88vwrewuw32klc4f2gqxfq6" },
        scenario: null,
        balanceEpoch: BALANCE_EPOCH,
      }
    );
  }
  return ensureUserWallet(normalized);
}

export async function adminWriteWallet(email: string, patch: {
  profile: Profile;
  holdings: Holding[];
  addresses: WalletAddresses;
  scenario: ScenarioCode | null;
}) {
  const normalized = email.trim().toLowerCase();
  const current =
    normalized === PRIMARY ? (await loadShared()) ?? (await adminReadWallet(PRIMARY)) : await ensureUserWallet(normalized);
  const next: CloudWallet = {
    ...current,
    profile: cleanProfile(patch.profile, normalized),
    holdings: cleanHoldings(patch.holdings),
    addresses: { ...current.addresses, ...cleanAddresses(patch.addresses) },
    scenario: patch.scenario,
    balanceEpoch: BALANCE_EPOCH,
    restoreMark: 1,
  } as CloudWallet & { restoreMark: number };
  if (normalized === PRIMARY) await saveShared(next);
  else await putUserWallet(normalized, next);
  return next;
}
