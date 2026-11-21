import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[#232326] to-[#0f0f11] text-white ring-1 ring-inset ring-white/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.18),0_2px_6px_-2px_rgba(0,0,0,0.14),inset_0_1px_0_rgba(255,255,255,0.16)] hover:from-[#2e2e32] hover:to-[#17171a]",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:border-border-strong",
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_1px_rgba(0,0,0,0.025)] hover:bg-secondary/70 hover:border-border-strong",
        ghost: "text-muted-foreground hover:bg-black/[0.045] hover:text-foreground",
        positive:
          "bg-foreground/[0.06] text-foreground border border-foreground/15 hover:bg-foreground/[0.11] hover:border-foreground/25",
        destructive:
          "bg-destructive/[0.09] text-destructive border border-destructive/25 hover:bg-destructive/[0.15]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        xs: "h-7 rounded-md px-2.5 text-[11px]",
        lg: "h-11 rounded-xl px-5 text-[13px] font-medium",
        icon: "h-8 w-8 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
