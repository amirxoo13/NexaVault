import type { ReactNode } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock3,
  Infinity as InfinityIcon,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import { LogoMark, LogoWord } from "@/components/logo";
import { AlertScheduler } from "@/components/alert-scheduler";
import { SendSettler } from "@/components/send-settler";
import { t } from "@/lib/i18n";
import { useSite } from "@/lib/site-store";
import { hasAdminProof } from "@/lib/admin-proof";
import { useWallet } from "@/lib/store";
import { cn } from "@/lib/utils";

export function WalletShell({
  children,
  title,
  home = false,
}: {
  children: ReactNode;
  title?: string;
  home?: boolean;
}) {
  const logout = useWallet((s) => s.logout);
  const copy = t();
  const site = useSite();
  const role = useWallet((s) => s.role);
  const navigate = useNavigate();
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isHome = path === "/wallet" || path === "/wallet/";
  const backTo = isHome ? "/" : "/wallet";

  function goBack() {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) {
      router.history.back();
      return;
    }
    void navigate({ to: backTo });
  }

  function openSearch() {
    sessionStorage.setItem("aurex-open-find", "1");
    if (!isHome) {
      void navigate({ to: "/wallet" });
      return;
    }
    window.dispatchEvent(new Event("aurex-find"));
  }

  const items = [
    { to: "/wallet", icon: Wallet, label: site.tabHome, match: (p: string) => p === "/wallet" || p === "/wallet/" },
    { to: "/wallet/markets", icon: TrendingUp, label: site.tabMarkets, match: (p: string) => p.startsWith("/wallet/markets") },
    { to: "/wallet/perps", icon: InfinityIcon, label: "Perps", match: (p: string) => p.startsWith("/wallet/perps") },
    { to: "/wallet/activity", icon: Clock3, label: site.tabActivity, match: (p: string) => p.startsWith("/wallet/activity") },
    { to: "/wallet/profile", icon: UserRound, label: site.tabProfile, match: (p: string) => p.startsWith("/wallet/profile") },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AlertScheduler />
      <SendSettler />
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-e border-border bg-card/60 px-4 py-6 backdrop-blur-xl md:flex">
          <div className="flex items-center justify-between px-2">
            <Link to="/wallet">
              <LogoWord />
            </Link>
          </div>

          <button
            type="button"
            onClick={openSearch}
            className="mt-6 flex h-10 w-full items-center gap-2.5 rounded-xl bg-input px-3 text-xs text-muted shadow-border transition-colors hover:text-foreground"
          >
            <Search className="size-4 text-primary" />
            <span>{copy.wallet.search}</span>
          </button>

          <p className="mt-6 px-2 font-mono text-[10px] font-semibold tracking-[0.18em] text-muted uppercase">
            Command Deck
          </p>
          <nav className="mt-2 flex flex-1 flex-col gap-1.5">
            {items.map((item) => {
              const active = item.match(path);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-accent-soft text-primary shadow-[inset_0_0_0_1px_rgb(16_185_129/0.32)]"
                      : "text-muted hover:bg-card-elevated hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1.5 rounded-2xl bg-card-elevated/80 p-2 shadow-border">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-primary">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span className="truncate font-mono">ENCLAVE ACTIVE</span>
              <Sparkles className="ms-auto size-3" />
            </div>
            {role === "admin" && hasAdminProof() ? (
              <Link
                to="/studio"
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-muted transition-colors hover:bg-card hover:text-foreground",
                  path.startsWith("/studio") && "bg-accent-soft text-primary",
                )}
                aria-label="Control panel"
              >
                <SlidersHorizontal className="size-4" />
                <span>Studio Control</span>
              </Link>
            ) : null}
            <Link
              to="/wallet/settings"
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-muted transition-colors hover:bg-card hover:text-foreground",
                path.startsWith("/wallet/settings") && "bg-accent-soft text-primary",
              )}
            >
              <Settings className="size-4" />
              <span>{copy.wallet.settings}</span>
            </Link>
            <button
              type="button"
              className="flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
              onClick={() => {
                logout();
                void navigate({ to: "/login" });
              }}
              aria-label={copy.wallet.logout}
            >
              <LogOut className="size-4" />
              <span>{copy.wallet.logout}</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-8">
          {!home && title ? (
            <div className="sticky top-[var(--safe-top)] z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-xl">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-muted shadow-border hover:text-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <p className="truncate font-display text-base font-semibold">{title}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label={copy.wallet.search}
                  className="inline-flex size-9 items-center justify-center rounded-xl bg-card text-muted shadow-border hover:text-foreground md:hidden"
                >
                  <Search className="size-4" />
                </button>
                {role === "admin" && hasAdminProof() ? (
                  <Link
                    to="/studio"
                    className="inline-flex size-9 items-center justify-center rounded-xl bg-accent-soft text-primary shadow-border"
                    aria-label="Control panel"
                  >
                    <SlidersHorizontal className="size-4" />
                  </Link>
                ) : null}
                <LogoMark size={26} className="md:hidden" />
              </div>
            </div>
          ) : null}
          <div className="flex-1">{children}</div>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-1.5"><div className="grid flex-1 grid-cols-5 gap-1">
          {items.map((item) => {
            const active = item.match(path);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                  active ? "bg-accent-soft text-primary" : "text-muted hover:text-foreground",
                )}
              >
                <item.icon className={cn("size-4", active && "text-primary")} strokeWidth={active ? 2.2 : 1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={openSearch}
          aria-label={copy.wallet.search}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-border"
        >
          <Search className="size-4" />
        </button></div>
      </nav>
    </div>
  );
}
