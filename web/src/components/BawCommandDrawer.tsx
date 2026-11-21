"use client";

import { useState } from "react";
import { CaretDown, Check, Copy, TerminalWindow } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface BawCommandDrawerProps {
  title: string;
  commands: Array<{ label: string; command: string }>;
}

export function BawCommandDrawer({ title, commands }: BawCommandDrawerProps) {
  const [open, setOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = async (text: string, idx: number, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      toast.success("Copied CLI command", { description: label });
      setTimeout(() => setCopiedIdx(null), 1600);
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="surface-card overflow-hidden rounded-2xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="pressable flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-xs font-medium text-foreground/90 hover:bg-secondary/60"
        >
          <span className="flex items-center gap-2.5 truncate">
            <TerminalWindow size={15} weight="duotone" className="shrink-0 text-foreground/75" />
            <span className="truncate">
              Agentic Wallet (<code className="font-mono text-[11px] text-foreground">baw</code> CLI)
              <span className="ml-1.5 text-muted-foreground">· {title}</span>
            </span>
          </span>
          <CaretDown
            size={14}
            className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease-out)] ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border px-4 py-3.5">
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
          Enforces{" "}
          <code className="font-mono text-foreground/90">
            preview → human confirm → execute
          </code>{" "}
          locally via{" "}
          <code className="font-mono text-foreground/90">
            skills/reckon/scripts/reckon-cli.mjs
          </code>
          .
        </p>

        <div className="space-y-3">
          {commands.map((item, idx) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {item.label}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => handleCopy(item.command, idx, item.label)}
                  className="h-6 px-2 text-[11px]"
                >
                  {copiedIdx === idx ? (
                    <>
                      <Check size={12} weight="bold" className="text-foreground" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-foreground/90">
                {item.command}
              </pre>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
