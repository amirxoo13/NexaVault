import { create } from "zustand";

const PASSCODE_KEY = "trust-passcode";
const LOGIN_KEY = "trust-saved-login";
const BIO_KEY = "trust-webauthn";
const UNLOCK_KEY = "trust-device-unlocked";

export type LockPurpose = "unlock" | "transaction" | "setup";

type Pending = {
  purpose: LockPurpose;
  resolve: (ok: boolean) => void;
};

type DeviceAuthState = {
  pending: Pending | null;
  request: (purpose: LockPurpose) => Promise<boolean>;
  finish: (ok: boolean) => void;
};

export const useDeviceAuth = create<DeviceAuthState>((set, get) => ({
  pending: null,
  request: (purpose) =>
    new Promise((resolve) => {
      const current = get().pending;
      if (current) current.resolve(false);
      set({ pending: { purpose, resolve } });
    }),
  finish: (ok) => {
    const current = get().pending;
    if (!current) return;
    set({ pending: null });
    current.resolve(ok);
  },
}));

export function getPasscode() {
  try {
    return localStorage.getItem(PASSCODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPasscode(code: string) {
  localStorage.setItem(PASSCODE_KEY, code);
}

export function saveLogin(email: string, password: string) {
  localStorage.setItem(LOGIN_KEY, JSON.stringify({ email: email.trim().toLowerCase(), password }));
}

export function getSavedLogin(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; password?: string };
    if (!parsed.email || !parsed.password) return null;
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export function clearSavedLogin() {
  localStorage.removeItem(LOGIN_KEY);
}

export function sessionUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSessionUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export function clearSessionUnlock() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

function bytesToB64(bytes: Uint8Array) {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}

function b64ToBytes(value: string) {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function hasFingerprint() {
  try {
    return Boolean(localStorage.getItem(BIO_KEY));
  } catch {
    return false;
  }
}

export async function enrollFingerprint() {
  if (!window.PublicKeyCredential || !navigator.credentials) return false;
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "NexaVault" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "trust-wallet",
        displayName: "NexaVault",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  });
  if (!cred || !("rawId" in cred)) return false;
  const rawId = (cred as PublicKeyCredential).rawId;
  localStorage.setItem(BIO_KEY, bytesToB64(new Uint8Array(rawId)));
  return true;
}

export async function verifyFingerprint() {
  const stored = localStorage.getItem(BIO_KEY);
  if (!stored || !window.PublicKeyCredential || !navigator.credentials) return false;
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: b64ToBytes(stored) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return Boolean(cred);
}

export function requestDeviceAuth(purpose: LockPurpose = "transaction") {
  return useDeviceAuth.getState().request(purpose);
}
