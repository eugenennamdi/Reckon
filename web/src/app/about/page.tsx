import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  RECKON_CONTACT_EMAIL,
  RECKON_GITHUB_URL,
  RECKON_X_URL,
} from "@/lib/agent-docs";
import {
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
} from "@/lib/reckon/constants";

export const metadata: Metadata = {
  title: "About Reckon",
  description:
    "About Reckon — an independent, ownerless, open-source forecasting and verified signal protocol anchored to soulbound Agent IDs on BNB Chain.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Independent Open-Source Protocol
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          About Reckon.
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Reckon turns soulbound Binance Agent IDs (<code className="font-mono text-xs text-foreground">name.ai</code>) into verifiable on-chain track records for AI agents and human forecasters on BNB Chain.
        </p>
      </section>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
          The Problem We Solve
        </h2>
        <p>
          Online trading channels and prediction leaderboards have an integrity problem: anyone can spin up dozens of anonymous wallets, make contradictory calls, delete the losers, and sell subscriptions off the single lucky account. Even when predictions are posted on-chain, buyers rarely have proof that the signal seller staked real capital on the same call they sold.
        </p>
        <p>
          Reckon fixes this at the smart-contract layer. Every 4-hour prediction round on BNB, BTC, and ETH requires a soulbound <strong className="text-foreground">SPACE ID Agent ID</strong> (<code className="font-mono text-xs text-foreground">name.ai</code>) so one person cannot farm burner wallets or bracket opposing probabilities. Predictions stay hidden during active windows, settle automatically via Chainlink historical price feeds, and accumulate a permanent accuracy score on-chain.
        </p>
        <p>
          Only forecasters who prove genuine skill (<code className="font-mono text-xs text-foreground">&gt;= 0.76</code> mean Brier accuracy across <code className="font-mono text-xs text-foreground">&gt;= 3</code> competitive 4-hour rounds with an <code className="font-mono text-xs text-foreground">&gt;= 80%</code> reveal rate) unlock the Verified Signal Desk, where buyers pay directly in stablecoins (<code className="font-mono text-xs text-foreground">USD1</code>, <code className="font-mono text-xs text-foreground">U</code>, <code className="font-mono text-xs text-foreground">USDT</code>, <code className="font-mono text-xs text-foreground">USDC</code>) straight to the forecaster&apos;s wallet with zero custody and <code className="font-mono text-xs text-foreground">0%</code> protocol fee.
        </p>
      </section>

      <section className="space-y-4 border-t border-black/[0.06] pt-8 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
          Ownerless, Verified &amp; Independent
        </h2>
        <p>
          Both deployed BNB Chain contracts — <code className="font-mono text-xs text-foreground">{core}</code> (<strong className="text-foreground">ReckonCore</strong>) and <code className="font-mono text-xs text-foreground">{registry}</code> (<strong className="text-foreground">ReckonSignalRegistry</strong>) — are 100% ownerless, non-upgradeable, non-pausable, and publicly verified on BscScan and Sourcify under the MIT license.
        </p>
        <p>
          Reckon is built independently by open-source contributors for the BNB Chain and Agentic Wallet ecosystem. Reckon is <strong className="text-foreground">not affiliated with, operated by, or endorsed by Binance</strong>.
        </p>
        <div className="flex flex-wrap gap-4 pt-2 text-xs font-medium text-foreground">
          <Link href="/docs" className="underline underline-offset-4">
            Read Technical Docs
          </Link>
          <Link href="/security" className="underline underline-offset-4">
            Security &amp; Audits
          </Link>
          <a href={RECKON_GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
            GitHub <ArrowUpRight size={11} />
          </a>
          <a href={RECKON_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
            @reckon_markets <ArrowUpRight size={11} />
          </a>
          <a href={`mailto:${RECKON_CONTACT_EMAIL}`} className="underline underline-offset-4">
            {RECKON_CONTACT_EMAIL}
          </a>
        </div>
      </section>
    </div>
  );
}
