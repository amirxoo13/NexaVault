import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, LockKeyhole, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { LogoMark, LogoWord } from "@/components/logo";
import { enrollFingerprint, hasFingerprint, verifyFingerprint } from "@/lib/device-lock";

const PASSCODE_KEY = "trust-passcode";

export function WelcomeScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"home" | "create" | "confirm">("home");
  const [first, setFirst] = useState("");
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);

  function press(digit: string) {
    setCode((current) => {
      if (current.length >= 6) return current;
      const next = current + digit;
      if (next.length === 6) window.setTimeout(() => finish(next), 120);
      return next;
    });
  }

  function finish(next: string) {
    if (step === "create") {
      setFirst(next);
      setCode("");
      setStep("confirm");
      return;
    }
    if (next !== first) {
      setShake(true);
      setCode("");
      window.setTimeout(() => setShake(false), 400);
      toast.error("Passcodes do not match. Try again.");
      return;
    }
    localStorage.setItem(PASSCODE_KEY, next);
    sessionStorage.setItem("trust-after-passcode", "1");
    void navigate({ to: "/login" });
  }

  async function fingerprint() {
    try {
      const ok = hasFingerprint() ? await verifyFingerprint() : await enrollFingerprint();
      if (!ok) {
        toast.error("Biometric verification was not accepted.");
        return;
      }
      toast.success(hasFingerprint() ? "Biometric unlock ready." : "Biometric credential saved.");
    } catch {
      toast.error("Biometrics unavailable on this device. Use your 6-digit PIN.");
    }
  }

  if (step === "home") {
    return (
      <main
        className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 text-foreground"
        style={{
          background:
            "radial-gradient(650px circle at 50% 18%, rgb(16 185 129 / 0.22), transparent 60%), linear-gradient(180deg, #06090e 0%, #09131c 55%, #06090e 100%)",
          paddingTop: "calc(var(--safe-top) + 18px)",
          paddingBottom: "calc(var(--safe-bottom) + 22px)",
        }}
      >
        <header className="mx-auto flex w-full max-w-md items-center justify-between">
          <LogoWord />
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] text-primary shadow-border">
            <Sparkles className="size-3" />
            v4.2
          </span>
        </header>

        <div className="mx-auto my-auto flex w-full max-w-md flex-col items-center py-6 text-center">
          <img
            src="/welcome-cube.jpg"
            alt=""
            className="mx-auto w-full max-w-[16rem] rounded-3xl object-contain shadow-float shadow-border"
          />

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: ShieldCheck, text: "Zero-Knowledge" },
              { icon: Wallet, text: "110+ Chains" },
              { icon: LockKeyhole, text: "Local Enclave" },
            ].map((badge) => (
              <span
                key={badge.text}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs text-muted shadow-border"
              >
                <badge.icon className="size-3.5 text-primary" />
                {badge.text}
              </span>
            ))}
          </div>

          <h1 className="mt-6 font-display text-[2.05rem] leading-[1.12] font-bold tracking-tight">
            Sovereign control of
            <br />
            your digital wealth
          </h1>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Instant multi-chain routing, live perpetual futures, and hardware-encrypted keys on your device.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <button
            type="button"
            className="h-14 w-full rounded-2xl bg-primary font-display text-[16px] font-semibold text-primary-fg shadow-[0_12px_32px_rgb(16_185_129/0.3)] transition-transform active:scale-[0.98]"
            onClick={() => {
              setStep("create");
              setCode("");
              setFirst("");
            }}
          >
            Initialize New Vault
          </button>
          <button
            type="button"
            className="mt-3 h-14 w-full rounded-2xl bg-card font-display text-[16px] font-semibold text-foreground shadow-border transition-colors hover:bg-card-elevated"
            onClick={() => void navigate({ to: "/login" })}
          >
            Access Existing Vault
          </button>
          <p className="mt-4 text-center text-[12px] leading-relaxed text-muted">
            By continuing, you acknowledge our{" "}
            <a href="/security" className="font-medium text-primary hover:underline">
              Security Charter
            </a>{" "}
            and{" "}
            <a href="/security" className="font-medium text-primary hover:underline">
              Privacy Architecture
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  const title = step === "confirm" ? "Verify Vault PIN" : "Configure Vault PIN";
  const hint =
    step === "confirm"
      ? "Re-enter your 6-digit security PIN to lock enclave."
      : "Set a 6-digit security PIN to encrypt local operations on this device.";

  return (
    <main
      className="flex min-h-dvh flex-col text-foreground"
      style={{
        background:
          "radial-gradient(500px circle at 50% 0%, rgb(16 185 129 / 0.16), transparent 60%), #06090e",
        paddingTop: "calc(var(--safe-top) + 10px)",
        paddingBottom: "calc(var(--safe-bottom) + 18px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-xl bg-card text-muted shadow-border hover:text-foreground"
          onClick={() => setStep("home")}
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-mono text-xs tracking-widest text-primary uppercase">ENCLAVE PIN</span>
        <div className="size-10" />
      </div>

      <div className="mx-auto mt-8 flex flex-col items-center px-6 text-center">
        <LogoMark size={42} />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">{hint}</p>

        <div className={`mt-7 flex justify-center gap-2.5 ${shake ? "animate-pulse" : ""}`}>
          {Array.from({ length: 6 }, (_, i) => {
            const filled = Boolean(code[i]);
            return (
              <span
                key={i}
                className={`flex size-12 items-center justify-center rounded-xl font-mono text-xl font-bold transition-all ${
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
      </div>

      <div className="mx-auto mt-auto grid w-full max-w-xs grid-cols-3 gap-3 px-4 pt-8 text-center font-display text-2xl font-semibold">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            className="flex h-15 items-center justify-center rounded-2xl bg-card/80 shadow-border transition-colors active:bg-accent-soft active:text-primary"
            onClick={() => press(digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="flex h-15 items-center justify-center rounded-2xl bg-card/40 text-primary shadow-border"
          onClick={() => void fingerprint()}
          aria-label="Fingerprint"
        >
          <Fingerprint />
        </button>
        <button
          type="button"
          className="flex h-15 items-center justify-center rounded-2xl bg-card/80 shadow-border transition-colors active:bg-accent-soft active:text-primary"
          onClick={() => press("0")}
        >
          0
        </button>
        <button
          type="button"
          className="flex h-15 items-center justify-center rounded-2xl bg-card/40 text-base text-muted shadow-border hover:text-foreground"
          onClick={() => setCode((c) => c.slice(0, -1))}
          aria-label="Delete"
        >
          ⌫
        </button>
      </div>
    </main>
  );
}

function Fingerprint() {
  return (
    <svg viewBox="0 0 48 48" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M16 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <path d="M14 24c.4 6 2.2 10 4.6 13" />
      <path d="M24 18v14c0 3.2-1.2 6.2-2.6 8" />
      <path d="M30 20c1 6 .2 11-2 16" />
      <path d="M20 24c.3 5 .2 9-1.2 13" />
      <path d="M18 16c1.6-2.2 4-3.4 6.6-3.4 4.6 0 8.4 3.6 8.4 8.2 0 4.2-.6 7.4-1.8 11" />
    </svg>
  );
}
