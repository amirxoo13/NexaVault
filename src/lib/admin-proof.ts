import { ADMIN_ACCOUNT } from "@/lib/auth-config";

const KEY = "aurex-admin-proof";

/** Set only after the admin password is typed correctly. Not derived from the client role flag. */
export function grantAdminProof(password: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, password);
}

export function clearAdminProof() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function adminProof(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function hasAdminProof() {
  return adminProof() === ADMIN_ACCOUNT.password;
}
