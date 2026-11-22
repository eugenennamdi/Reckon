"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CaretDown,
  ChartLineUp,
  Coins,
  LockSimple,
  Question,
  Robot,
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
    num: "01",
    icon: LockSimple,
    title: "Seal a 4-hour prediction",
    body: "Pick BNB, BTC, or ETH, choose your confidence (1%–99%), and stake 0.001 BNB (~$0.55) with your Binance Agent ID (name.ai). Your prediction stays hidden until prices settle.",
  },
  {
    num: "02",
    icon: ChartLineUp,
    title: "Reveal & earn from accuracy",
    body: "After the 4-hour price settles on Chainlink, reveal your prediction. Better-calibrated forecasters win a larger share of the BNB pool (0% fee), and your score stays permanently on your .ai ID.",
  },
  {
    num: "03",
    icon: Coins,
    title: "Sell or buy verified signals",
    body: "Forecasters who prove real skill (76%+ accuracy across 3+ competitive rounds and 80%+ reveals) unlock the Signal Desk and get paid directly in USD1, USDT, or USDC.",
  },
] as const;

const FAQ_ITEMS = [
  {
    q: "Why do I need a Binance Agent ID (name.ai) to forecast?",
    a: "Each person can only claim one non-transferable Agent ID. That stops anyone from spinning up 100 burner wallets to fake a winning streak or bet both sides of the same pool — making every leaderboard score real.",
  },
  {
    q: "How do I get an Agent ID and turn on Developer Mode?",
    a: "Open the Binance App → Wallet → Agentic Wallet → Claim Agent ID (name.ai). To sign forecasts from the baw CLI or an AI agent, open Agentic Wallet Settings → Developer Mode and confirm in-app.",
  },
  {
    q: "Can I use MetaMask, Rabby, or a regular browser wallet?",
    a: "Yes — any BNB Chain wallet can browse markets, inspect the leaderboard, and buy verified signals on the Signal Desk. Submitting forecasts requires a wallet that holds an Agent ID (via the Agentic Wallet baw tab or an Agent ID wallet).",
  },
  {
    q: "What happens if I forget to reveal my prediction?",
    a: "After the 4-hour observation window ends, you have a full 4-hour window to reveal. Missing it forfeits that round's stake to forecasters who revealed and scores 0 so nobody can hide bad calls.",
  },
  {
    q: "Can my AI agent forecast or check rounds for me?",
    a: "Yes. Point your AI agent (Claude, Codex, Cursor, OpenClaw, or Agent OS) at https://reckon.markets/llms.txt or connect our hosted MCP server at https://reckon.markets/api/mcp. Agents always preview transactions and ask for your confirmation before spending.",
  },
  {
    q: "Who controls the funds? Is Reckon affiliated with Binance?",
    a: "Nobody controls the funds — both smart contracts are 100% ownerless, immutable, verified on BscScan, and charge 0% protocol fee. Reckon is an independent open-source protocol on BNB Chain and is not affiliated with or endorsed by Binance.",
  },
] as const;

export function OnboardingModalTrigger() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"guide" | "faq">("guide");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const timer = window.setTimeout(() => setOpen(true), 250);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // Ignore storage access restrictions (e.g. private mode).
    }
  }, []);

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
          className="max-h-[88dvh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[540px]"
        >
          {/* Header */}
          <div className="border-b border-black/[0.06] px-6 pt-6 pb-4 pr-12">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Welcome to Reckon · BNB Chain
            </div>
            <DialogTitle className="mt-1.5 text-xl font-semibold tracking-[-0.03em] text-foreground">
              Predict 4-hour prices. Prove your skill.
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Sealed crypto forecasting powered by soulbound <code className="font-mono text-foreground">.ai</code> Agent IDs — ownerless, immutable, and 0% protocol fee.
            </DialogDescription>

            {/* Clean Segmented Tabs */}
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
                How it works
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
                FAQ ({FAQ_ITEMS.length})
              </button>
            </div>
          </div>

          {/* Body */}
          {tab === "guide" ? (
            <div className="space-y-4 px-6 py-5">
              <div className="space-y-3">
                {STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.num}
                      className="surface-well flex items-start gap-3.5 rounded-xl p-3.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                        <Icon size={15} weight="duotone" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                            {step.num}
                          </span>
                          <h3 className="text-[13px] font-semibold text-foreground">
                            {step.title}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-black/[0.07] bg-card px-4 py-3">
                <Robot size={16} weight="duotone" className="mt-0.5 shrink-0 text-foreground" />
                <div className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Using an AI agent?</strong> Tell it to read{" "}
                  <code className="font-mono text-[11px] text-foreground">reckon.markets/llms.txt</code>{" "}
                  or connect MCP at{" "}
                  <code className="font-mono text-[11px] text-foreground">reckon.markets/api/mcp</code>.
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-black/[0.06] px-6 py-2">
              {FAQ_ITEMS.map((item, idx) => {
                const expanded = openFaq === idx;
                return (
                  <div key={item.q} className="py-3">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(expanded ? null : idx)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-3 text-left text-[13px] font-medium text-foreground"
                    >
                      <span>{item.q}</span>
                      <CaretDown
                        size={13}
                        className={`shrink-0 text-muted-foreground transition-transform duration-150 ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {expanded && (
                      <p className="mt-2 pr-5 text-xs leading-relaxed text-muted-foreground">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] bg-[#FAFAFB] px-6 py-4">
            <Link
              href="/docs"
              onClick={() => handleOpenChange(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Read technical docs</span>
              <ArrowRight size={12} />
            </Link>

            <div className="flex items-center gap-2">
              {tab === "guide" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTab("faq")}
                  className="h-8 rounded-lg text-xs"
                >
                  View FAQ
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => handleOpenChange(false)}
                className="h-8 rounded-lg px-4 text-xs"
              >
                Explore markets
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
