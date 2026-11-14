import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LogoWord } from "@/components/logo";
import { t } from "@/lib/i18n";
import { useSite } from "@/lib/site-store";

export function SiteFooter() {
  const copy = t();
  const site = useSite();
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <LogoWord />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{site.tagline}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] text-primary">
            <ShieldCheck className="size-3.5" />
            LOCAL ENCLAVE VERIFIED
          </div>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold tracking-wider text-primary uppercase">{copy.footer.product}</p>
          <div className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
            <Link to="/markets" className="hover:text-foreground">
              {site.navMarkets}
            </Link>
            <Link to="/features" className="hover:text-foreground">
              {site.navFeatures}
            </Link>
            <Link to="/security" className="hover:text-foreground">
              {site.navSecurity}
            </Link>
          </div>
        </div>
        <div>
          <p className="font-mono text-xs font-semibold tracking-wider text-primary uppercase">{copy.footer.company}</p>
          <div className="mt-3 flex flex-col gap-2.5 text-sm text-muted">
            <Link to="/login" className="hover:text-foreground">
              {site.navOpenWallet}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-xs text-muted">{site.footerLegal}</p>
      </div>
    </footer>
  );
}
