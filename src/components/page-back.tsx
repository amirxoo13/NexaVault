import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageBack({
  to,
  label = "Back",
  className,
}: {
  to: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx;
        if (typeof idx === "number" && idx > 0) {
          router.history.back();
          return;
        }
        void router.navigate({ to });
      }}
      className={cn(
        "inline-flex h-11 items-center gap-2 text-sm text-muted transition-colors duration-150 hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}
