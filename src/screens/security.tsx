import { MarketingShell } from "@/components/marketing-shell";
import { useSite } from "@/lib/site-store";

export function SecurityScreen() {
  const site = useSite();
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{site.securityPageTitle}</h1>
        <p className="mt-3 text-muted">{site.securityPageSub}</p>
        <div className="mt-10 space-y-4">
          {[
            { t: site.security1t, d: site.security1d },
            { t: site.security2t, d: site.security2d },
            { t: site.security3t, d: site.security3d },
          ].map((item) => (
            <div key={item.t} className="rounded-xl bg-card p-6 shadow-border">
              <h2 className="font-display text-lg font-semibold">{item.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.d}</p>
            </div>
          ))}
          <p className="pt-4 text-sm text-muted">{site.footerLegal}</p>
        </div>
      </div>
    </MarketingShell>
  );
}
