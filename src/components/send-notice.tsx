import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ScenarioCode } from "@/lib/auth-config";
import { useLoginWindow } from "@/lib/login-window";
import { useSite, type SiteContent } from "@/lib/site-store";
import { useWallet } from "@/lib/store";

function noticeCopy(code: ScenarioCode, site: SiteContent) {
  if (code === "F20") return { title: site.noticeF20Title, body: site.noticeF20Body };
  if (code === "K20") return { title: site.noticeK20Title, body: site.noticeK20Body };
  return { title: site.noticeT20Title, body: site.noticeT20Body };
}

export function SendNotice({
  open,
  onContinue,
}: {
  open: boolean;
  onContinue: () => void;
}) {
  const walletScenario = useWallet((s) => s.scenario);
  const lockedScenario = useLoginWindow((s) => s.lockedScenario);
  const scenario = (lockedScenario ?? walletScenario ?? "T20") as ScenarioCode;
  const site = useSite();
  const copy = noticeCopy(scenario, site);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onContinue();
      }}
    >
      <DialogContent className="overflow-hidden rounded-2xl p-0 sm:max-w-md">
        <div className="h-1 bg-primary" />
        <div className="px-6 pt-7 pb-7 sm:px-8">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] font-medium tracking-[0.18em] text-primary">
              {scenario}
            </span>
            <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-primary">
              <ShieldCheck className="size-5" />
            </span>
          </div>
          <p className="mt-6 text-[11px] font-medium tracking-[0.2em] text-muted uppercase">Transfer notice</p>
          <DialogTitle className="mt-2 font-display text-2xl leading-tight font-semibold tracking-tight">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">
            {copy.body}
          </DialogDescription>
          <Button type="button" variant="solid" size="lg" className="mt-8 w-full rounded-full" onClick={onContinue}>
            {site.noticeCta}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
