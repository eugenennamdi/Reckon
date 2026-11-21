"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "bg-popover text-popover-foreground border border-border-strong shadow-lg rounded-lg font-sans text-xs",
          title: "text-foreground font-medium",
          description: "text-muted-foreground font-mono text-[11px] break-all",
          actionButton: "bg-primary text-primary-foreground font-medium",
          cancelButton: "bg-secondary text-secondary-foreground",
          closeButton: "bg-popover border-border text-muted-foreground hover:text-foreground",
        },
      }}
    />
  );
}
