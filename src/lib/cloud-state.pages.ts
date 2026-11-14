/** GitHub Pages has no server functions — localStorage only. */
export type CloudWallet = {
  profile: unknown;
  holdings: unknown[];
  transactions: unknown[];
  addresses: Record<string, string>;
  scenario: string | null;
  balanceEpoch?: number;
};

export type CloudLogin = {
  startedAt: number | null;
  lockedScenario: string | null;
};

export type CloudSnapshot = {
  empty: boolean;
  updatedAt: string | null;
  site: Record<string, unknown> | null;
  wallet: CloudWallet | null;
  login: CloudLogin | null;
};

export async function loadAppState(): Promise<CloudSnapshot> {
  return { empty: true, updatedAt: null, site: null, wallet: null, login: null };
}

export async function loadAppStateMeta(): Promise<{ empty: boolean; updatedAt: string | null }> {
  return { empty: true, updatedAt: null };
}

export async function saveAppState(): Promise<{ ok: true; updatedAt: string | null; wallet: null }> {
  return { ok: true, updatedAt: null, wallet: null };
}
