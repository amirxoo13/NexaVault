import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-xl bg-input px-3.5 text-sm text-foreground shadow-border outline-none transition-[box-shadow] duration-150 placeholder:text-muted focus-visible:shadow-[0_0_0_1.5px_var(--color-primary)] disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
