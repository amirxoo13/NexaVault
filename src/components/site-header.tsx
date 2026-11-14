import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoWord } from "@/components/logo";
import { hasAdminProof } from "@/lib/admin-proof";
import { useSite } from "@/lib/site-store";
import { useWallet } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const authenticated = useWallet((s) => s.authenticated);
  const hydrated = useWallet((s) => s.hydrated);
  const role = useWallet((s) => s.role);
  const site = useSite();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const links = [
    { to: "/markets", label: site.navMarkets },
    { to: "/features", label: site.navFeatures },
    { to: "/security", label: site.navSecurity },
  ];

  return (
    <header className="sticky top-[var(--safe-top)] z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="min-w-0">
          <LogoWord className="truncate" />
        </Link>
        <nav className="hidden items-center gap-2 rounded-full bg-card px-2 py-1 text-sm text-muted shadow-border md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium transition-colors duration-150 hover:text-foreground",
                path === l.to && "bg-accent-soft text-primary",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {hydrated && authenticated && role === "admin" && hasAdminProof() ? (
            <Link
              to="/studio"
              className="hidden h-9 items-center gap-1.5 rounded-xl bg-card px-3 text-xs font-medium text-primary shadow-border sm:inline-flex"
            >
              <SlidersHorizontal className="size-3.5" />
              Studio
            </Link>
          ) : null}
          <Button asChild size="sm" variant="default" className="rounded-xl px-4 font-semibold">
            <Link to={hydrated && authenticated ? "/wallet" : "/login"}>
              {hydrated && authenticated ? site.navOpenWallet : site.navLogin}
            </Link>
          </Button>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl bg-card shadow-border md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-card-elevated"
              >
                {l.label}
              </Link>
            ))}
            {hydrated && authenticated && role === "admin" && hasAdminProof() ? (
              <Link
                to="/studio"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium text-primary hover:bg-card-elevated"
              >
                Control panel
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
