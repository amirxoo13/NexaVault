import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[opacity,transform,background-color,box-shadow,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-fg shadow-[0_8px_24px_rgb(16_185_129/0.25)] hover:bg-primary-hover",
        solid: "bg-primary text-primary-fg shadow-[0_8px_24px_rgb(16_185_129/0.25)] hover:bg-primary-hover",
        secondary: "bg-card-elevated text-foreground shadow-border hover:shadow-border-hover",
        outline: "bg-card/60 text-foreground shadow-border hover:bg-card-elevated",
        ghost: "bg-transparent text-foreground hover:bg-card",
        danger: "bg-danger text-white hover:opacity-90",
        muted: "bg-accent-soft text-primary hover:opacity-90",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-5 text-base",
        icon: "size-11",
        pill: "h-11 px-5 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
