import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium tracking-tight whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border-strong bg-secondary text-foreground",
        secondary: "border-border bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        positive: "border-foreground/20 bg-foreground/[0.06] text-foreground",
        warning: "border-border-strong bg-secondary text-foreground/85",
        info: "border-border bg-secondary/80 text-foreground/80",
        destructive: "border-destructive/30 bg-destructive/[0.08] text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
