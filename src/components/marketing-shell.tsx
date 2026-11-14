import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { PageBack } from "@/components/page-back";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function MarketingShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const showBack = path !== "/" && path !== "";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      {showBack ? (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <PageBack to="/" />
        </div>
      ) : null}
      {children}
      <SiteFooter />
    </div>
  );
}
