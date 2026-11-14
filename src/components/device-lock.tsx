import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/logo";
import {
  enrollFingerprint,
  getPasscode,
  hasFingerprint,
  setPasscode,
  useDeviceAuth,
  verifyFingerprint,
} from "@/lib/device-lock";
import { useSite } from "@/lib/site-store";

export function DeviceLockHost() {
  const pending = useDeviceAuth((s) => s.pending);
  const finish = useDeviceAuth((s) => s.finish);
  const brandName = useSite((s) => s.brandName);
  const [phase, setPhase] = useState<"enter" | "create" | "confirm">("enter");
  const [code, setCode] = useState("");
  const [first, setFirst] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!pending) return;
    setCode("");
    setFirst("");
    setShake(false);
    setPhase(getPasscode() && pending.purpose !== "setup" ? "enter" : "create");
  }, [pending]);

  if (!pending) return null;

  function fail(message: string) {
    setShake(true);
    setCode("");
    window.setTimeout(() => setShake(false), 400);
    toast.error(message);
  }

  function finishCode(next: string) {
    if (phase === "create") {
      setFirst(next);
      setCode("");
      setPhase("confirm");
      return;
    }
    if (phase === "confirm") {
      if (next !== first) {
        fail("Passcodes do not match. Try again.");
        return;
      }
      setPasscode(next);
      finish(true);
      return;
    }
    if (next !== getPasscode()) {
      fail("Invalid security PIN.");
      return;
    }
    finish(true);
  }

  function press(digit: string) {
    setCode((current) => {
      if (current.length >= 6) return current;
      const next = current + digit;
      if (next.length === 6) window.setTimeout(() => finishCode(next), 80);
      return next;
    });
  }

  async function fingerprint() {
    try {
      const ok = hasFingerprint() ? await verifyFingerprint() : await enrollFingerprint();
      if (!ok) {
        toast.error("Biometric scan rejected. Enter your 6-digit PIN.");
        return;
      }
      if (!getPasscode()) {
        toast.success("Biometrics enabled. Complete your 6-digit PIN setup.");
        return;
      }
      finish(true);
    } catch {
      toast.error("Biometrics unavailable on this device. Use your PIN.");
    }
  }

  const title =
    phase === "confirm"
      ? "Confirm Security PIN"
      : phase === "create"
        ? "Create Security PIN"
        : pending.purpose === "transaction"
          ? "Authorize Transaction"
          : "Unlock Vault Enclave";
  const hint =
    phase === "confirm"
      ? "Re-enter your 6-digit PIN to confirm."
      : phase === "create"
        ? "Choose a 6-digit PIN or register biometric access."
        : "Authenticate via biometrics or your 6-digit PIN.";

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center text-foreground"
      style={{
        background:
          "radial-gradient(600px circle at 50% 10%, rgb(16 185 129 / 0.18), transparent 60%), #06090e",
        paddingTop: "calc(var(--safe-top) + 24px)",
        paddingBottom: "calc(var(--safe-bottom) + 20px)",
      }}
    >
      <div className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 shadow-border">
        <ShieldCheck className="size-4 text-primary" />
        <span className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          {brandName}
        </span>
      </div>

      <div className="mt-7 flex flex-col items-center px-4 text-center">
        <LogoMark size={44} />
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 max-w-[18rem] text-sm text-muted">{hint}</p>
      </div>

      <div className={`mt-7 flex justify-center gap-2.5 px-4 ${shake ? "animate-pulse" : ""}`}>
        {Array.from({ length: 6 }, (_, i) => {
          const filled = Boolean(code[i]);
          return (
            <span
              key={i}
              className={`flex size-11 items-center justify-center rounded-xl font-mono text-lg font-bold transition-all ${
                filled
                  ? "bg-accent-soft text-primary shadow-[0_0_0_1.5px_var(--color-primary)]"
                  : "bg-card text-muted shadow-border"
              }`}
            >
              {filled ? "●" : ""}
            </span>
          );
        })}
      </div>

      <div className="mt-auto grid w-full max-w-xs grid-cols-3 gap-3 px-6 text-center font-display text-2xl font-semibold">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            className="flex h-14 items-center justify-center rounded-2xl bg-card/85 shadow-border active:bg-accent-soft active:text-primary"
            onClick={() => press(digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="flex h-14 items-center justify-center rounded-2xl bg-card/40 text-primary shadow-border"
          onClick={() => void fingerprint()}
          aria-label="Fingerprint"
        >
          <svg viewBox="0 0 48 48" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M16 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            <path d="M14 24c.4 6 2.2 10 4.6 13" />
            <path d="M24 18v14c0 3.2-1.2 6.2-2.6 8" />
            <path d="M30 20c1 6 .2 11-2 16" />
            <path d="M20 24c.3 5 .2 9-1.2 13" />
            <path d="M18 16c1.6-2.2 4-3.4 6.6-3.4 4.6 0 8.4 3.6 8.4 8.2 0 4.2-.6 7.4-1.8 11" />
          </svg>
        </button>
        <button
          type="button"
          className="flex h-14 items-center justify-center rounded-2xl bg-card/85 shadow-border active:bg-accent-soft active:text-primary"
          onClick={() => press("0")}
        >
          0
        </button>
        <button
          type="button"
          className="flex h-14 items-center justify-center rounded-2xl bg-card/40 text-base text-muted shadow-border hover:text-foreground"
          onClick={() => setCode((c) => c.slice(0, -1))}
          aria-label="Delete"
        >
          ⌫
        </button>
      </div>

      {pending.purpose === "transaction" ? (
        <button type="button" className="mt-4 text-sm font-medium text-muted hover:text-foreground" onClick={() => finish(false)}>
          Cancel authorization
        </button>
      ) : pending.purpose === "unlock" ? (
        <button type="button" className="mt-4 text-sm font-medium text-muted hover:text-foreground" onClick={() => finish(false)}>
          Switch vault account
        </button>
      ) : (
        <div className="mt-4 h-5" />
      )}
    </div>
  );
}
