"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ChartLineUp,
  Coins,
  LockSimple,
  Minus,
  Plus,
  Question,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "reckon:onboarding:v1";

const STEPS = [
  {
    icon: LockSimple,
    title: "Seal a prediction",
    body: "Pick BNB, BTC, or ETH, set your confidence from 1% to 99%, and stake from 0.001 BNB. Your call stays private until the 4-hour round closes.",
  },
  {
    icon: ChartLineUp,
    title: "Reveal and earn from accuracy",
    body: "Once the 4-hour price settles, reveal your call. Higher accuracy earns a larger share of the pool, and every result stays permanently on your .ai identity.",
  },
  {
    icon: Coins,
    title: "Unlock verified signals",
    body: "Forecasters with a proven on-chain track record can publish live analysis and receive stablecoin payments directly to their wallet, with 0% protocol fee.",
  },
] as const;

const FAQ_ITEMS = [
  {
    q: "Why do I need an Agent ID (.ai) to forecast?",
    a: "Each person can claim only one non-transferable .ai Agent ID. That prevents spinning up disposable wallets to fake winning streaks or play both sides of the same pool — keeping every leaderboard score honest.",
  },
  {
    q: "How do I get an Agent ID and enable Developer Mode?",
    a: "Open the Binance App → Wallet → Agentic Wallet → Claim Agent ID (name.ai). To sign forecasts from the baw CLI or an AI agent, turn on Developer Mode in Agentic Wallet Settings.",
  },
  {
    q: "Can I use MetaMask, Rabby, or another browser wallet?",
    a: "Yes. Any BNB Chain wallet can browse markets, check the leaderboard, and buy verified signals. Submitting forecasts requires a wallet holding an Agent ID via the Agentic Wallet (baw) tab or an Agent ID wallet.",
  },
  {
    q: "What happens if I miss the reveal window?",
    a: "You have a full 4-hour window to reveal after the closing price settles. Missing it forfeits that round's stake to forecasters who revealed and records a 0 score so bad predictions cannot be hidden.",
  },
  {
    q: "Can my AI agent use Reckon for me?",
    a: "Yes. Point your agent at reckon.markets/llms.txt or connect our hosted MCP server at reckon.markets/api/mcp. Agents always preview transactions and ask for your confirmation before signing.",
  },
  {
    q: "Who holds user funds? Is Reckon affiliated with Binance?",
    a: "Nobody controls user funds — both smart contracts are 100% ownerless, immutable, verified on BscScan, and charge 0% fee. Reckon is an independent open-source protocol and is not affiliated with or endorsed by Binance.",
  },
] as const;

export function OnboardingModalTrigger() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"guide" | "faq">("guide");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (pathname !== "/") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = window.setTimeout(() => setOpen(true), 250);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Ignore storage access restrictions (e.g. private mode).
    }
  }, [pathname]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "dismissed");
      } catch {
        // ignore
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTab("guide");
          setOpen(true);
        }}
        aria-label="How Reckon works and FAQ"
        className="pressable inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-black/[0.08] bg-card px-2.5 text-xs font-medium text-muted-foreground shadow-[0_1px_1px_rgba(0,0,0,0.02)] hover:border-border-strong hover:text-foreground"
      >
        <Question size={14} weight="regular" />
        <span className="hidden sm:inline">How it works</span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-h-[88dvh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[490px]"
        >
          {/* Clean Editorial Header */}
          <div className="border-b border-black/[0.06] px-7 pt-7 pb-5 pr-12">
            <DialogTitle className="text-[20px] font-semibold tracking-[-0.03em] leading-tight text-foreground">
              How Reckon works
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Sealed 4-hour price forecasts with permanent on-chain track records.
            </DialogDescription>

            <div className="mt-4 inline-flex items-center gap-0.5 rounded-full bg-black/[0.045] p-1">
              <button
                type="button"
                onClick={() => setTab("guide")}
                className={`pressable rounded-full px-3.5 py-1 text-xs font-medium ${
                  tab === "guide"
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setTab("faq")}
                className={`pressable rounded-full px-3.5 py-1 text-xs font-medium ${
                  tab === "faq"
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                FAQ
              </button>
            </div>
          </div>

          {/* Open White Canvas — Hairline Dividers Only */}
          {tab === "guide" ? (
            <div className="divide-y divide-black/[0.06] px-7 py-2">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex items-start gap-4 py-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F4F5] text-foreground ring-1 ring-inset ring-black/[0.05]">
                      <Icon size={16} weight="duotone" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-black/[0.06] px-7 py-2">
              {FAQ_ITEMS.map((item, idx) => {
                const expanded = openFaq === idx;
                return (
                  <div key={item.q} className="py-3.5">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(expanded ? null : idx)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-4 text-left text-[13.5px] font-medium tracking-[-0.01em] text-foreground"
                    >
                      <span>{item.q}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {expanded ? <Minus size={13} weight="bold" /> : <Plus size={13} weight="bold" />}
                      </span>
                    </button>
                    {expanded && (
                      <p className="mt-2 pr-6 text-[13px] leading-[1.6] text-muted-foreground">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Calm 2-Action Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] bg-[#FAFAFB] px-7 py-4">
            <Link
              href="/docs"
              onClick={() => handleOpenChange(false)}
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Technical docs</span>
              <ArrowRight
                size={12}
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>

            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => handleOpenChange(false)}
              className="h-9 rounded-lg px-5 text-xs font-medium"
            >
              Get started
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
