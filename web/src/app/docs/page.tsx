import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  AGENT_ID_ADDRESS,
  BSC_STABLECOINS,
  ELITE_BRIER,
  FEEDS,
  MIN_COMPETITIVE_ROUNDS,
  MIN_REVEAL_RATE_BPS,
  MIN_VERIFIED_BRIER,
  STAKE_TIERS,
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
} from "@/lib/reckon/constants";
import { formatBrierScore } from "@/lib/reckon/commitment";
import { MCP_TOOLS_SUMMARY } from "@/lib/agent-docs";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Reckon API & Technical Documentation",
  description:
    "Complete Reckon Protocol API, MCP server, and technical documentation on BNB Chain: 4-hour commit-reveal lifecycle, Lambert WSWM scoring, soulbound Agent ID verification, B402/x402 signals, OpenAPI spec, and verified mainnet contracts.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Reckon API & Technical Documentation · Reckon",
    description:
      "Architecture, scoring math, Chainlink oracle settlement, Agentic Wallet CLI, OpenAPI & MCP server reference, and verified BNB Chain contracts.",
    url: "/docs",
  },
};

const TOC = [
  { num: "01", id: "overview", label: "Protocol overview" },
  { num: "02", id: "agent-id", label: "Soulbound Agent ID" },
  { num: "03", id: "round-lifecycle", label: "4-hour round lifecycle" },
  { num: "04", id: "scoring-math", label: "Scoring & payout math" },
  { num: "05", id: "verified-signals", label: "Verified signals (x402)" },
  { num: "06", id: "ai-agents", label: "AI agents, MCP & baw" },
  { num: "07", id: "contracts", label: "Mainnet contracts" },
] as const;

const MACHINE_LINKS = [
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/llms-full.txt", label: "llms-full.txt" },
  { href: "/skill.md", label: "SKILL.md" },
  { href: "/openapi.json", label: "openapi.json" },
  { href: "/api/mcp", label: "MCP API" },
] as const;

export default function DocsPage() {
  const siteUrl = getSiteUrl();
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();
  const minBrier = formatBrierScore(MIN_VERIFIED_BRIER);
  const eliteBrier = formatBrierScore(ELITE_BRIER);
  const minRevealPct = (MIN_REVEAL_RATE_BPS / 100).toFixed(0);

  return (
    <div className="space-y-12">
      {/* Clean Editorial Header — Zero Orphan Pill Wrapping */}
      <section className="space-y-5 border-b border-black/[0.06] pb-9">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
            Reckon API &amp; Documentation.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Technical reference for developers, AI agent builders, and smart contract auditors.{" "}
            <Link
              href="/"
              className="group inline-flex items-center gap-1 font-medium text-foreground transition-opacity hover:opacity-75"
            >
              <span>Return to live markets</span>
              <ArrowRight
                size={13}
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>
          </p>
        </div>

        {/* Single-Row Machine-Readable Endpoint Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {MACHINE_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-black/[0.08] bg-card px-3 py-1.5 font-mono text-[11.5px] font-medium text-foreground/85 transition-colors hover:border-black/20 hover:text-foreground"
            >
              <span>{item.label}</span>
              <ArrowUpRight size={11} className="text-muted-foreground" />
            </a>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-12 lg:grid-cols-12">
        {/* Quiet Sticky Desktop Table of Contents */}
        <aside className="hidden lg:sticky lg:top-24 lg:col-span-3 lg:block">
          <nav aria-label="Documentation sections" className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              On this page
            </div>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-baseline gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
              >
                <span className="font-mono text-[11px] text-muted-foreground/60">
                  {item.num}
                </span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Main Technical Content */}
        <div className="min-w-0 space-y-14 lg:col-span-9">
          {/* 01. Overview */}
          <section id="overview" className="scroll-mt-24 space-y-5">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">01</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                Protocol overview
              </h2>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              Reckon is a three-layer, ownerless forecasting and verified signal protocol on BNB Chain. It combines sealed 4-hour price prediction pools, permanent on-chain accuracy tracking bound to soulbound Binance Agent IDs (<code className="font-mono text-[12.5px] text-foreground">name.ai</code>), and a direct peer-to-peer stablecoin signal marketplace powered by HTTP 402 (B402 / x402 v2).
            </p>
            <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="grid divide-y divide-black/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-6">
                  <div className="font-mono text-[11px] text-muted-foreground">Layer 1</div>
                  <h3 className="mt-2 text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    Sealed markets
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    24/7 rolling 4-hour UTC markets on Chainlink BNB/USD, BTC/USD, and ETH/USD with native BNB stakes (<code className="font-mono text-[11.5px] text-foreground">0.001 / 0.005 / 0.01</code>) and zero ERC-20 approvals.
                  </p>
                </div>
                <div className="p-6">
                  <div className="font-mono text-[11px] text-muted-foreground">Layer 2</div>
                  <h3 className="mt-2 text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    Reputation ledger
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    Strictly proper Lambert WSWM payouts, O(1) on-chain Brier scores, 10-decile reliability buckets, and automatic non-reveal penalties bound permanently to each Agent ID.
                  </p>
                </div>
                <div className="p-6">
                  <div className="font-mono text-[11px] text-muted-foreground">Layer 3</div>
                  <h3 className="mt-2 text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    Verified signals
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    Proven forecasters unlock direct P2P stablecoin monetization (<code className="font-mono text-[11.5px] text-foreground">USD1 / U / USDT / USDC</code>) with live on-chain gating and post-reveal anti-fraud verification.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 02. Why Soulbound Agent ID */}
          <section id="agent-id" className="scroll-mt-24 space-y-5 border-t border-black/[0.06] pt-10">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">02</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                Why soulbound Agent ID is mathematically load-bearing
              </h2>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              Every call to <code className="font-mono text-[12.5px] text-foreground">ReckonCore.commitEpoch</code> verifies on-chain that <code className="font-mono text-[12.5px] text-foreground">balanceOf(msg.sender) &gt; 0</code> and <code className="font-mono text-[12.5px] text-foreground">bytes(handleOf(msg.sender)).length &gt; 0</code> on the non-transferable SPACE ID Agent ID registry (<code className="font-mono text-[12.5px] text-foreground">{AGENT_ID_ADDRESS}</code>). Removing that one-identity-per-person invariant breaks two core properties:
            </p>
            <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="grid divide-y divide-black/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="p-6">
                  <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    Stops burner-wallet cherry-picking
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    Without a non-transferable identity, an attacker can spin up 50 wallets, guess randomly, discard the 49 losers, and sell signals off the single lucky account.
                  </p>
                </div>
                <div className="p-6">
                  <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    Stops WSWM Sybil bracketing
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    In weighted-score wagering mechanisms, bracketing opposing extremes (<code className="font-mono text-[11.5px] text-foreground">1%</code> and <code className="font-mono text-[11.5px] text-foreground">99%</code>) across multiple wallets distorts pool variance. One soulbound identity preserves truthful reporting.
                  </p>
                </div>
              </div>
              <div className="border-t border-black/[0.06] bg-[#FAFAFB] px-6 py-3.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Privacy boundary:</span> Reckon resolves{" "}
                <code className="font-mono text-foreground">address → handle</code> strictly for opt-in addresses interacting with Reckon contracts, and never exposes arbitrary{" "}
                <code className="font-mono text-foreground">handle → wallet</code> lookups.
              </div>
            </div>
          </section>

          {/* 03. Round Lifecycle */}
          <section id="round-lifecycle" className="scroll-mt-24 space-y-5 border-t border-black/[0.06] pt-10">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">03</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                4-hour UTC round lifecycle &amp; Chainlink settlement
              </h2>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              Rounds align to canonical 4-hour UTC candle boundaries (<code className="font-mono text-[12.5px] text-foreground">00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC</code>) with <code className="font-mono text-[12.5px] text-foreground">epochId = floor(block.timestamp / 14400)</code>. There is zero commit blackout: while Epoch <code className="font-mono text-[12.5px] text-foreground">E</code> is open, <code className="font-mono text-[12.5px] text-foreground">E−1</code> is locked, <code className="font-mono text-[12.5px] text-foreground">E−2</code> is in reveal, and <code className="font-mono text-[12.5px] text-foreground">E−3</code> is claimable.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-black/[0.06] bg-[#FAFAFB] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Phase</th>
                    <th className="px-5 py-3.5">Window</th>
                    <th className="px-5 py-3.5">On-chain action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] text-muted-foreground">
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-foreground">OPEN</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs">4 hours</td>
                    <td className="px-5 py-3.5 leading-relaxed">
                      Submit sealed commitment via <code className="font-mono text-xs text-foreground">commitEpoch(feedId, epochId, tierId, commitment)</code> with native BNB stake.
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-foreground">LOCKED</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs">4 hours</td>
                    <td className="px-5 py-3.5 leading-relaxed">
                      Forward-start ATM <code className="font-mono text-xs text-foreground">strikePrice</code> is fixed permissionlessly via Chainlink <code className="font-mono text-xs text-foreground">getRoundData</code> bracketing around <code className="font-mono text-xs text-foreground">commitEnd</code>. Verified sellers may publish x402 signals.
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-foreground">REVEAL</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs">4 hours</td>
                    <td className="px-5 py-3.5 leading-relaxed">
                      <code className="font-mono text-xs text-foreground">settleOracle</code> locks outcome (<code className="font-mono text-xs text-foreground">settlePrice ≥ strikePrice ? 1 : 0</code>). Forecasters reveal <code className="font-mono text-xs text-foreground">(probBps, salt)</code> strictly inside <code className="font-mono text-xs text-foreground">[resolveTime, revealEnd)</code>.
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-foreground">CLAIMABLE</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs">Permanent</td>
                    <td className="px-5 py-3.5 leading-relaxed">
                      Winners call <code className="font-mono text-xs text-foreground">claim(roundId)</code>. If an oracle fault triggered cancellation, everyone recovers 100% of stake via <code className="font-mono text-xs text-foreground">claimRefund(roundId)</code>.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[13px] leading-[1.65] text-muted-foreground">
              <strong className="font-semibold text-foreground">Race-proof commitments &amp; oracle escape hatch:</strong> Commitments bind to <code className="font-mono text-xs text-foreground">keccak256(abi.encode(chainId, reckonCore, feedId, epochId, tierId, agent, probBps, salt))</code>. Healthy Chainlink feeds cannot be cancelled early; proven <code className="font-mono text-xs text-foreground">&gt;30m</code> gaps (<code className="font-mono text-xs text-foreground">cancelOracleGap</code>), verified <code className="font-mono text-xs text-foreground">&gt;2h</code> live halts (<code className="font-mono text-xs text-foreground">cancelUnsettleableRound</code>), and a 7-day emergency fallback ensure 100% stake refunds on oracle faults. A public 24/7 GitHub Actions keeper settles strikes and outcomes automatically every 15 minutes.
            </p>
          </section>

          {/* 04. Scoring & Payout Math */}
          <section id="scoring-math" className="scroll-mt-24 space-y-5 border-t border-black/[0.06] pt-10">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">04</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                Scoring &amp; payout mathematics
              </h2>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              Forecasters submit an integer probability <code className="font-mono text-[12.5px] text-foreground">Pᵢ ∈ [100, 9900]</code> basis points (<code className="font-mono text-[12.5px] text-foreground">1.00%–99.00%</code>) that <code className="font-mono text-[12.5px] text-foreground">settlePrice ≥ strikePrice</code>. Let <code className="font-mono text-[12.5px] text-foreground">Y = 10000</code> if UP and <code className="font-mono text-[12.5px] text-foreground">Y = 0</code> if DOWN.
            </p>
            <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-[#FAFAFB]">
              <div className="divide-y divide-black/[0.06] font-mono text-xs text-foreground">
                <div className="overflow-x-auto px-6 py-4">
                  <div className="font-sans text-[11.5px] text-muted-foreground">
                    Integer Brier score (scaled 10⁸)
                  </div>
                  <div className="mt-1.5 whitespace-nowrap text-[13px] font-medium">
                    Sᵢ = 10⁸ − (Pᵢ − Y)²
                  </div>
                </div>
                <div className="overflow-x-auto px-6 py-4">
                  <div className="font-sans text-[11.5px] text-muted-foreground">
                    Strictly proper Lambert WSWM payout + equal forfeit split (W = stake, C = commits, N = reveals)
                  </div>
                  <div className="mt-1.5 whitespace-nowrap text-[13px] font-medium">
                    Payoutᵢ = floor( W · (C · 10⁸ + N · Sᵢ − ΣS) / (N · 10⁸) )
                  </div>
                </div>
                <div className="overflow-x-auto px-6 py-4">
                  <div className="font-sans text-[11.5px] text-muted-foreground">
                    Brier Skill Score (vs. 50% coin flip = 0.7500)
                  </div>
                  <div className="mt-1.5 whitespace-nowrap text-[13px] font-medium">
                    BSS = (meanBrier − 0.75) / 0.25
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="grid divide-y divide-black/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="p-6">
                  <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    O(1) gas solvency &amp; zero dust
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    <code className="font-mono text-xs text-foreground">ΣS</code> is evaluated in constant gas via running <code className="font-mono text-xs text-foreground">sumP</code> and <code className="font-mono text-xs text-foreground">sumP2</code> accumulators; the final claimer sweeps leftover integer floor dust (<code className="font-mono text-xs text-foreground">≤ N − 1</code> wei) so <code className="font-mono text-xs text-foreground">remainingPool</code> zeroes out exactly.
                  </p>
                </div>
                <div className="p-6">
                  <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    Anti-score-dodging
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                    Each Agent ID holds up to <code className="font-mono text-xs text-foreground">27</code> pending rounds (3 full 9-slot epochs, auto-flushed on commit). After <code className="font-mono text-xs text-foreground">revealEnd</code>, any missed reveal folds live into <code className="font-mono text-xs text-foreground">getEffectiveProfile()</code> as <code className="font-mono text-xs text-foreground">0</code> Brier.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 05. Verified Signals */}
          <section id="verified-signals" className="scroll-mt-24 space-y-5 border-t border-black/[0.06] pt-10">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">05</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                Verified signals &amp; direct P2P settlement (B402 / x402 v2)
              </h2>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              Any BNB Chain wallet can buy signals, while selling is gated live on-chain by <code className="font-mono text-[12.5px] text-foreground">ReckonCore.isVerifiedForecaster(agent)</code>. <code className="font-mono text-[12.5px] text-foreground">ReckonSignalRegistry.isListingActive(agent)</code> re-evaluates all three thresholds on every read so underperforming sellers are revoked automatically:
            </p>
            <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="grid divide-y divide-black/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <div className="p-6">
                  <div className="font-mono text-xl font-semibold tracking-[-0.02em] text-foreground">
                    ≥ {minBrier}
                  </div>
                  <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    Effective Brier (+4.0% BSS above coin flip; ≥ {eliteBrier} earns Elite)
                  </div>
                </div>
                <div className="p-6">
                  <div className="font-mono text-xl font-semibold tracking-[-0.02em] text-foreground">
                    ≥ {MIN_COMPETITIVE_ROUNDS} epochs
                  </div>
                  <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    Distinct 4-hour competitive rounds (<code className="font-mono text-[11.5px] text-foreground">revealedCount ≥ 2</code>)
                  </div>
                </div>
                <div className="p-6">
                  <div className="font-mono text-xl font-semibold tracking-[-0.02em] text-foreground">
                    ≥ {minRevealPct}%
                  </div>
                  <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    On-time reveal rate across all committed rounds
                  </div>
                </div>
              </div>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              Sellers set pricing (<code className="font-mono text-[12.5px] text-foreground">$0.10–$50.00</code>) on-chain and sign an EIP-712 <code className="font-mono text-[12.5px] text-foreground">SignalAttestation</code> while a round is <code className="font-mono text-[12.5px] text-foreground">LOCKED</code>. Signal theses are stored AES-256-GCM encrypted in Upstash Redis and unlocked only after HTTP <code className="font-mono text-[12.5px] text-foreground">402</code> payment settles directly to <code className="font-mono text-[12.5px] text-foreground">payTo = seller</code> (native zero-approval EIP-3009 for <code className="font-mono text-[12.5px] text-foreground">USD1 / U</code>; Permit2 via <code className="font-mono text-[12.5px] text-foreground">x402ExactPermit2Proxy</code> for <code className="font-mono text-[12.5px] text-foreground">USDT / USDC</code>). After reveal, Reckon flags whether the sold claim matched the seller&apos;s on-chain reveal (<code className="font-mono text-[12.5px] text-foreground">VERIFIED_MATCH</code> vs <code className="font-mono text-[12.5px] text-foreground">MISMATCH</code>).
            </p>
          </section>

          {/* 06. AI Agents, MCP & baw */}
          <section id="ai-agents" className="scroll-mt-24 space-y-5 border-t border-black/[0.06] pt-10">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">06</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                AI agents, hosted MCP &amp; Binance Agentic Wallet (<code className="font-mono">baw</code>)
              </h2>
            </div>
            <p className="max-w-3xl text-[14px] leading-[1.65] text-muted-foreground">
              AI agents working for a human user (Claude Code, Codex, Cursor, OpenClaw, or Binance Agent OS) can discover Reckon automatically, read Markdown natively, and prepare unsigned calldata — always previewing transactions for explicit human confirmation before execution:
            </p>
            <div className="overflow-x-auto rounded-2xl border border-black/[0.07] bg-[#FAFAFB] p-6 font-mono text-xs leading-6 text-foreground">
              <div className="text-[11px] text-muted-foreground"># Machine-readable discovery endpoints</div>
              <div>GET {siteUrl}/llms.txt</div>
              <div>GET {siteUrl}/llms-full.txt</div>
              <div>GET {siteUrl}/skill.md</div>
              <div>GET {siteUrl}/openapi.json</div>
              <div>GET {siteUrl}/.well-known/api-catalog</div>
              <div>GET {siteUrl}/.well-known/mcp/server-card.json</div>
              <div>GET {siteUrl}/.well-known/agent-skills/index.json</div>
              <div>curl -H &quot;Accept: text/markdown&quot; {siteUrl}/</div>
              <div className="pt-3 text-[11px] text-muted-foreground"># Install standalone CLI skill</div>
              <div>npx skills add eugenennamdi/Reckon --skill reckon</div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                Hosted MCP server (<code className="font-mono text-xs">POST {siteUrl}/api/mcp</code>)
              </h3>
              <div className="divide-y divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                {MCP_TOOLS_SUMMARY.map((tool) => (
                  <div
                    key={tool.name}
                    className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-5"
                  >
                    <code className="shrink-0 font-mono text-xs font-semibold text-foreground sm:w-56">
                      {tool.name}
                    </code>
                    <span className="text-[13px] leading-relaxed text-muted-foreground">
                      {tool.summary}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 07. Verified Mainnet Contracts */}
          <section id="contracts" className="scroll-mt-24 space-y-5 border-t border-black/[0.06] pt-10">
            <div className="space-y-2">
              <div className="font-mono text-xs text-muted-foreground/70">07</div>
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
                Verified mainnet contracts &amp; dependencies
              </h2>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/[0.06] bg-[#FAFAFB] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Contract</th>
                    <th className="px-5 py-3.5">Mainnet address</th>
                    <th className="px-5 py-3.5">Verification &amp; notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] font-mono text-[11.5px]">
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-sans font-semibold text-foreground">
                      ReckonCore
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground">{core}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-sans text-muted-foreground">
                      <a
                        href={`https://bscscan.com/address/${core}#code`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 font-medium text-foreground transition-opacity hover:opacity-70"
                      >
                        <span>BscScan</span>
                        <ArrowUpRight size={11} />
                      </a>
                      {" · "}
                      <a
                        href={`https://repo.sourcify.dev/56/${core}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 font-medium text-foreground transition-opacity hover:opacity-70"
                      >
                        <span>Sourcify</span>
                        <ArrowUpRight size={11} />
                      </a>
                      {" · Ownerless · 0% fee"}
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-sans font-semibold text-foreground">
                      ReckonSignalRegistry
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground">{registry}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-sans text-muted-foreground">
                      <a
                        href={`https://bscscan.com/address/${registry}#code`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 font-medium text-foreground transition-opacity hover:opacity-70"
                      >
                        <span>BscScan</span>
                        <ArrowUpRight size={11} />
                      </a>
                      {" · "}
                      <a
                        href={`https://repo.sourcify.dev/56/${registry}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 font-medium text-foreground transition-opacity hover:opacity-70"
                      >
                        <span>Sourcify</span>
                        <ArrowUpRight size={11} />
                      </a>
                      {" · Ownerless · 0% fee"}
                    </td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-sans font-semibold text-foreground">
                      SPACE ID Agent ID
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground">{AGENT_ID_ADDRESS}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-sans text-muted-foreground">
                      Soulbound ERC-721 (.ai)
                    </td>
                  </tr>
                  {FEEDS.map((f) => (
                    <tr key={f.id}>
                      <td className="whitespace-nowrap px-5 py-3.5 font-sans font-medium text-foreground">
                        Chainlink {f.symbol}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{f.address}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-sans text-muted-foreground">
                        8 decimals · {f.heartbeatSec}s heartbeat
                      </td>
                    </tr>
                  ))}
                  {BSC_STABLECOINS.map((c) => (
                    <tr key={c.symbol}>
                      <td className="whitespace-nowrap px-5 py-3.5 font-sans font-medium text-foreground">
                        {c.symbol}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{c.address}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-sans text-muted-foreground">
                        {c.assetTransferMethod === "eip3009"
                          ? "Native EIP-3009 (zero approval)"
                          : "Permit2 exact-amount"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Stake tiers: {STAKE_TIERS.map((t) => `${t.label} (${t.stakeBnb} BNB)`).join(" · ")}.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
