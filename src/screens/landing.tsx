import { Link } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/marketing-shell";
import { PhonePreview } from "@/components/phone-preview";
import { Button } from "@/components/ui/button";
import { CoinIcon } from "@/components/coin-icon";
import { COINS } from "@/lib/coins";
import { useSite } from "@/lib/site-store";
import { useWallet } from "@/lib/store";

const featured = ["bitcoin", "ethereum", "solana", "binancecoin", "sui"];

export function LandingScreen() {
  const authenticated = useWallet((s) => s.authenticated);
  const hydrated = useWallet((s) => s.hydrated);
  const site = useSite();
  const walletTo = hydrated && authenticated ? "/wallet" : "/login";

  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_-10%,rgb(16_185_129/0.16),transparent_55%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-24">
          <div className="stagger-in">
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{site.heroKicker}</p>
            <h1 className="mt-4 font-display text-3xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
              {site.heroTitleA}
              <span className="mt-1 block text-muted">{site.heroTitleB}</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{site.heroSub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="solid" size="lg" className="rounded-full px-6">
                <Link to={walletTo}>
                  {site.heroCta}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                <Link to="/markets">{site.heroSecondary}</Link>
              </Button>
            </div>
          </div>
          {site.heroImage ? (
            <img
              src={site.heroImage}
              alt=""
              className="mx-auto w-full max-w-md rounded-2xl object-cover shadow-float outline outline-1 -outline-offset-1 outline-white/10"
            />
          ) : (
            <PhonePreview />
          )}
        </div>
      </section>

      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {[
            { n: site.statUsersN, l: site.statUsersL },
            { n: site.statChainsN, l: site.statChainsL },
            { n: site.statAssetsN, l: site.statAssetsL },
            { n: site.statAuditsN, l: site.statAuditsL },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{s.n}</p>
              <p className="mt-1 text-sm text-muted">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{site.assetsTitle}</h2>
          <p className="mt-3 text-muted">{site.assetsSub}</p>
        </div>
        {site.aboutImage ? (
          <img
            src={site.aboutImage}
            alt=""
            className="mt-8 max-h-80 w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-white/10"
          />
        ) : null}
        <div className="mt-10 overflow-hidden rounded-xl bg-card shadow-border">
          {featured.map((id) => {
            const coin = COINS.find((c) => c.id === id)!;
            return (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CoinIcon id={coin.id} symbol={coin.symbol} />
                  <div>
                    <p className="font-medium">{coin.chainName}</p>
                    <p className="text-xs text-muted">{coin.symbol}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Buy", "Send", "Swap", "Earn"].map((a) => (
                    <span key={a} className="rounded-full px-3 py-1.5 text-xs text-muted shadow-border">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{site.securityTitle}</h2>
          <p className="mt-3 max-w-2xl text-muted">{site.securitySub}</p>
          {site.securityImage ? (
            <img
              src={site.securityImage}
              alt=""
              className="mt-8 max-h-72 w-full rounded-xl object-cover outline outline-1 -outline-offset-1 outline-white/10"
            />
          ) : null}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, t: site.security1t, d: site.security1d },
              { icon: LockKeyhole, t: site.security2t, d: site.security2d },
              { icon: ScanSearch, t: site.security3t, d: site.security3d },
            ].map((item) => (
              <div key={item.t} className="rounded-xl bg-card-elevated p-6 shadow-border">
                <item.icon className="size-5 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold">{item.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="rounded-2xl bg-card px-6 py-12 shadow-border sm:px-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{site.onestopTitle}</h2>
          <p className="mt-3 max-w-xl text-muted">{site.onestopSub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="solid" size="lg" className="rounded-full px-6">
              <Link to={walletTo}>{site.heroCta}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-6">
              <Link to="/features">Features</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
