import { cn } from "@/lib/utils";
import { useSite } from "@/lib/site-store";

export function LogoMark({ className, size = 30 }: { className?: string; size?: number }) {
  const logo = useSite((s) => s.logo);
  if (logo) {
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-xl object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#10b981] via-[#059669] to-[#06b6d4] p-1.5 shadow-[0_0_20px_rgb(16_185_129/0.35)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 32 32" className="h-full w-full" fill="none" aria-hidden="true">
        <path
          d="M16 2.5 28 9.4v13.2L16 29.5 4 22.6V9.4L16 2.5Z"
          stroke="#04130d"
          strokeWidth="2.4"
          fill="rgb(4 19 13 / 0.22)"
        />
        <path
          d="M10.5 21V11l11 10V11"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function LogoWord({ className }: { className?: string }) {
  const brandName = useSite((s) => s.brandName);
  return (
    <span className={cn("flex items-center gap-2.5 font-display text-[16px] font-bold tracking-tight", className)}>
      <LogoMark />
      <span className="truncate">{brandName}</span>
      <span className="rounded-md bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
        OS
      </span>
    </span>
  );
}
