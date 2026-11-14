import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const ios =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (standalone) setInstalled(true);
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return <p className="text-sm text-muted">This wallet is installed on your home screen.</p>;
  }

  if (deferred) {
    return (
      <Button
        type="button"
        variant="solid"
        className="w-full"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        Add to Home Screen
      </Button>
    );
  }

  if (ios) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        On iPhone: tap Share, then <span className="text-foreground">Add to Home Screen</span>.
      </p>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-muted">
      Use your browser menu and choose <span className="text-foreground">Install app</span> or{" "}
      <span className="text-foreground">Add to Home Screen</span>.
    </p>
  );
}
