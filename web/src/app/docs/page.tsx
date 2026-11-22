import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
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
import {
  MCP_TOOLS_SUMMARY,
  RECKON_CONTACT_EMAIL,
  RECKON_GITHUB_URL,
  RECKON_X_URL,
} from "@/lib/agent-docs";
import { getSiteUrl } from "@/lib/site";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  { id: "overview", label: "1. Protocol Overview" },
  { id: "agent-id", label: "2. Why Soulbound Agent ID" },
  { id: "round-lifecycle", label: "3. 4-Hour Round Lifecycle" },
  { id: "scoring-math", label: "4. Scoring & Payout Math" },
  { id: "verified-signals", label: "5. Verified Signals (x402)" },
  { id: "ai-agents", label: "6. AI Agents, MCP & baw" },
  { id: "contracts", label: "7. Verified Mainnet Contracts" },
] as const;

export default function DocsPage() {
  const siteUrl = getSiteUrl();
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();
  const minBrier = formatBrierScore(MIN_VERIFIED_BRIER);
  const eliteBrier = formatBrierScore(ELITE_BRIER);
  const minRevealPct = (MIN_REVEAL_RATE_BPS / 100).toFixed(0);

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <section className="flex flex-col gap-5 border-b border-black/[0.06] pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Technical Reference · BNB Chain (Chain ID 56)
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
            Reckon API &amp; Documentation.
          </h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Everything technical users, AI agent builders, and smart contract auditors need to inspect, verify, and integrate with Reckon. Looking for a quick plain-English walkthrough?{" "}
            <Link href="/" className="font-medium text-foreground underline underline-offset-4">
              Return to Live Markets
            </Link>
            .
          </p>
        </div>

        {/* Machine-Readable Quick Links for AI Agents */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/llms.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.09] bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
          >
            llms.txt <ArrowUpRight size={11} />
          </a>
          <a
            href="/llms-full.txt"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.09] bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
          >
            llms-full.txt <ArrowUpRight size={11} />
          </a>
          <a
            href="/skill.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.09] bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
          >
            SKILL.md <ArrowUpRight size={11} />
          </a>
          <a
            href="/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.09] bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
          >
            openapi.json <ArrowUpRight size={11} />
          </a>
          <a
            href="/api/mcp"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-black/[0.09] bg-card px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-secondary"
          >
            MCP Manifest <ArrowUpRight size={11} />
          </a>
        </div>
      </section>

      <div className="grid items-start gap-10 lg:grid-cols-12">
        {/* Sticky Desktop Table of Contents */}
        <aside className="hidden lg:sticky lg:top-24 lg:col-span-3 lg:block">
          <nav aria-label="Documentation sections" className="space-y-1">
            <div className="px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              On this page
            </div>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main Technical Content */}
        <div className="min-w-0 space-y-10 lg:col-span-9">
          {/* 1. Overview */}
          <section id="overview" className="scroll-mt-24 space-y-4">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              1. Protocol Overview
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Reckon is a three-layer, 100% ownerless forecasting and verified signal protocol on BNB Chain. It combines sealed 4-hour price prediction pools, permanent on-chain accuracy tracking bound to soulbound Binance Agent IDs (<code className="font-mono text-xs text-foreground">name.ai</code>), and a direct peer-to-peer stablecoin signal marketplace powered by HTTP 402 (B402 / x402 v2).
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Layer 1 · Sealed Markets</CardTitle>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-muted-foreground">
                  24/7 rolling 4-hour UTC markets on Chainlink BNB/USD, BTC/USD, and ETH/USD with native BNB micro-stakes (<code className="font-mono text-foreground">0.001 / 0.005 / 0.01 BNB</code>) and zero ERC-20 approvals.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Layer 2 · Reputation Ledger</CardTitle>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-muted-foreground">
                  Strictly proper Lambert WSWM payouts and O(1) on-chain Brier scores, 10-decile calibration buckets, and automatic non-reveal penalties bound permanently to each Agent ID.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Layer 3 · Verified Signals</CardTitle>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed text-muted-foreground">
                  Proven forecasters unlock direct P2P stablecoin monetization (<code className="font-mono text-foreground">USD1 / U / USDT / USDC</code>) with live on-chain eligibility checks and post-reveal anti-fraud verification.
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 2. Why Soulbound Agent ID */}
          <section id="agent-id" className="scroll-mt-24 space-y-4 border-t border-black/[0.06] pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              2. Why Soulbound Agent ID Is Mathematically Load-Bearing
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Every call to <code className="font-mono text-xs text-foreground">ReckonCore.commitEpoch</code> enforces on-chain that <code className="font-mono text-xs text-foreground">balanceOf(msg.sender) &gt; 0</code> and <code className="font-mono text-xs text-foreground">bytes(handleOf(msg.sender)).length &gt; 0</code> on the non-transferable SPACE ID Agent ID registry (<code className="font-mono text-xs text-foreground">{AGENT_ID_ADDRESS}</code>). Removing that soulbound 1-identity-per-user invariant immediately breaks two core properties:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Stops Burner-Wallet Cherry-Picking:</strong> Without a non-transferable identity, an attacker can deploy 50 wallets, guess randomly, abandon the 49 losers, and monetize the single lucky survivor as a fake expert.
              </li>
              <li>
                <strong className="text-foreground">Stops WSWM Sybil Bracketing:</strong> In weighted-score wagering mechanisms, submitting opposing extreme predictions (<code className="font-mono text-xs text-foreground">1%</code> and <code className="font-mono text-xs text-foreground">99%</code>) from multiple accounts controlled by one party distorts pool variance and gaming incentives. One soulbound Agent ID restores truthful probability reporting.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Note on privacy: Reckon only resolves <code className="font-mono text-foreground">address → handle</code> for opt-in addresses that voluntarily interact with Reckon. Reckon never exposes arbitrary <code className="font-mono text-foreground">handle → wallet</code> lookups.
            </p>
          </section>

          {/* 3. Round Lifecycle */}
          <section id="round-lifecycle" className="scroll-mt-24 space-y-4 border-t border-black/[0.06] pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              3. 4-Hour UTC Round Lifecycle &amp; Chainlink Settlement
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Rounds align to canonical 4-hour UTC candle boundaries (<code className="font-mono text-xs text-foreground">00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC</code>) with <code className="font-mono text-xs text-foreground">epochId = floor(block.timestamp / 14400)</code>. There is zero commit blackout: while Epoch <code className="font-mono text-xs text-foreground">E</code> is open for new predictions, <code className="font-mono text-xs text-foreground">E-1</code> is locked and observing price, <code className="font-mono text-xs text-foreground">E-2</code> is in reveal, and <code className="font-mono text-xs text-foreground">E-3</code> is claimable.
            </p>
            <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/[0.06] bg-secondary/50 font-mono text-[11px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Phase</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">On-Chain Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] text-muted-foreground">
                  <tr>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">OPEN</td>
                    <td className="px-4 py-3 font-mono">4 hours</td>
                    <td className="px-4 py-3">
                      Submit sealed commitment via <code className="font-mono text-foreground">commitEpoch(feedId, epochId, tierId, commitment)</code> with native BNB stake.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">LOCKED</td>
                    <td className="px-4 py-3 font-mono">4 hours</td>
                    <td className="px-4 py-3">
                      Forward-start ATM <code className="font-mono text-foreground">strikePrice</code> fixed permissionlessly via Chainlink <code className="font-mono text-foreground">getRoundData</code> bracketing around <code className="font-mono text-foreground">commitEnd</code>. Verified sellers may publish x402 signals.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">REVEAL</td>
                    <td className="px-4 py-3 font-mono">4 hours</td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-foreground">settleOracle</code> locks outcome (<code className="font-mono text-foreground">settlePrice &gt;= strikePrice ? 1 : 0</code>). Forecasters reveal <code className="font-mono text-foreground">(probBps, salt)</code> strictly inside <code className="font-mono text-foreground">[resolveTime, revealEnd)</code>.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">CLAIMABLE</td>
                    <td className="px-4 py-3 font-mono">Permanent</td>
                    <td className="px-4 py-3">
                      Winners call <code className="font-mono text-foreground">claim(roundId)</code>. If an oracle fault triggered cancellation, everyone recovers 100% of stake via <code className="font-mono text-foreground">claimRefund(roundId)</code>.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Race-Proof Commitments &amp; Fault Protection:</strong> Commitments bind to <code className="font-mono text-foreground">keccak256(abi.encode(chainId, reckonCore, feedId, epochId, tierId, agent, probBps, salt))</code>. Healthy Chainlink feeds cannot be cancelled early; proven <code className="font-mono text-foreground">&gt;30m</code> gaps (<code className="font-mono text-foreground">cancelOracleGap</code>), verified <code className="font-mono text-foreground">&gt;2h</code> live feed halts (<code className="font-mono text-foreground">cancelUnsettleableRound</code>), and a 7-day safety valve ensure 100% stake recovery on oracle faults. A public 24/7 GitHub Actions keeper settles strikes and outcomes automatically every 15 minutes.
            </p>
          </section>

          {/* 4. Scoring & Payout Math */}
          <section id="scoring-math" className="scroll-mt-24 space-y-4 border-t border-black/[0.06] pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              4. Scoring &amp; Payout Mathematics
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Forecasters submit an integer probability <code className="font-mono text-xs text-foreground">P_i ∈ [100, 9900]</code> basis points (<code className="font-mono text-xs text-foreground">1.00%–99.00%</code>) that <code className="font-mono text-xs text-foreground">settlePrice &gt;= strikePrice</code>. Let <code className="font-mono text-xs text-foreground">Y = 10000</code> if UP and <code className="font-mono text-xs text-foreground">Y = 0</code> if DOWN.
            </p>
            <div className="surface-well space-y-3 rounded-xl p-5 font-mono text-xs text-foreground">
              <div>
                <div className="text-[11px] text-muted-foreground">Integer Brier Score (scaled 10^8):</div>
                <div className="mt-1">S_i = 100_000_000 - (P_i - Y)^2</div>
              </div>
              <div className="border-t border-black/[0.06] pt-3">
                <div className="text-[11px] text-muted-foreground">
                  Strictly Proper Lambert WSWM Payout + Equal Forfeit Split (W = stake, C = total commits, N = reveals):
                </div>
                <div className="mt-1">
                  Payout_i = floor( W * (C * 10^8 + N * S_i - sum(S)) / (N * 10^8) )
                </div>
              </div>
              <div className="border-t border-black/[0.06] pt-3">
                <div className="text-[11px] text-muted-foreground">Brier Skill Score (vs. 50% coin flip = 0.7500):</div>
                <div className="mt-1">BSS = (meanBrier - 0.75) / 0.25</div>
              </div>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">O(1) Gas Solvency &amp; Zero Locked Dust:</strong> <code className="font-mono text-xs text-foreground">sum(S)</code> is computed in constant gas from running <code className="font-mono text-xs text-foreground">sumP</code> and <code className="font-mono text-xs text-foreground">sumP2</code> accumulators; the final claimer in each round sweeps leftover integer floor dust (<code className="font-mono text-xs text-foreground">&lt;= N - 1</code> wei).
              </li>
              <li>
                <strong className="text-foreground">Anti-Score-Dodging:</strong> Each Agent ID holds up to <code className="font-mono text-xs text-foreground">27</code> pending rounds (3 full 9-slot epochs). Once <code className="font-mono text-xs text-foreground">revealEnd</code> passes, any unrevealed round is folded live into <code className="font-mono text-xs text-foreground">getEffectiveProfile()</code> with Brier score <code className="font-mono text-xs text-foreground">0</code> and its stake forfeited equally to revealed participants.
              </li>
            </ul>
          </section>

          {/* 5. Verified Signals */}
          <section id="verified-signals" className="scroll-mt-24 space-y-4 border-t border-black/[0.06] pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              5. Verified Signals &amp; Direct P2P Settlement (B402 / x402 v2)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Anyone with a BNB Chain wallet can buy signals, but only proven forecasters can sell them. <code className="font-mono text-xs text-foreground">ReckonCore.isVerifiedForecaster(agent)</code> checks three live on-chain gates (and <code className="font-mono text-xs text-foreground">ReckonSignalRegistry.isListingActive(agent)</code> re-evaluates them live on every read so underperforming sellers are revoked automatically):
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-well rounded-xl p-4">
                <div className="font-mono text-lg font-semibold text-foreground">&gt;= {minBrier}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Effective Brier (+4.0% BSS above coin flip; &gt;= {eliteBrier} earns Elite tier)
                </div>
              </div>
              <div className="surface-well rounded-xl p-4">
                <div className="font-mono text-lg font-semibold text-foreground">&gt;= {MIN_COMPETITIVE_ROUNDS} epochs</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Distinct 4-hour competitive rounds (<code className="font-mono text-foreground">revealedCount &gt;= 2</code>)
                </div>
              </div>
              <div className="surface-well rounded-xl p-4">
                <div className="font-mono text-lg font-semibold text-foreground">&gt;= {minRevealPct}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  On-time reveal rate across all committed rounds
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sellers register on-chain pricing (<code className="font-mono text-xs text-foreground">$0.10–$50.00</code>) and sign an EIP-712 <code className="font-mono text-xs text-foreground">SignalAttestation</code> while a round is <code className="font-mono text-xs text-foreground">LOCKED</code>. Signal theses are stored AES-256-GCM encrypted in Upstash Redis and unlocked only after HTTP <code className="font-mono text-xs text-foreground">402</code> payment settles directly to <code className="font-mono text-xs text-foreground">payTo = seller</code> (native zero-approval EIP-3009 for <code className="font-mono text-xs text-foreground">USD1/U</code>; Permit2 via <code className="font-mono text-xs text-foreground">x402ExactPermit2Proxy</code> for <code className="font-mono text-xs text-foreground">USDT/USDC</code>). After reveal, Reckon publicly flags whether the seller&apos;s paid claim matched their real on-chain reveal (<code className="font-mono text-xs text-foreground">VERIFIED_MATCH</code> vs <code className="font-mono text-xs text-foreground">MISMATCH</code>).
            </p>
          </section>

          {/* 6. AI Agents, MCP & baw */}
          <section id="ai-agents" className="scroll-mt-24 space-y-4 border-t border-black/[0.06] pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              6. AI Agents, Hosted MCP &amp; Binance Agentic Wallet (<code className="font-mono">baw</code>)
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Reckon is built to be discovered and operated directly by AI agents working on behalf of a human user (Claude Code, Codex, Cursor, OpenClaw, or Binance Agent OS) with strict human confirmation before every transaction:
            </p>
            <div className="surface-well space-y-2 rounded-xl p-4 font-mono text-xs text-foreground">
              <div className="text-[11px] text-muted-foreground"># Machine-readable discovery endpoints</div>
              <div>GET {siteUrl}/llms.txt</div>
              <div>GET {siteUrl}/llms-full.txt</div>
              <div>GET {siteUrl}/skill.md</div>
              <div>GET {siteUrl}/.well-known/mcp/server-card.json</div>
              <div>GET {siteUrl}/.well-known/agent-skills/index.json</div>
              <div>curl -H &quot;Accept: text/markdown&quot; {siteUrl}/</div>
              <div className="pt-2 text-[11px] text-muted-foreground"># Install standalone CLI skill (1 line)</div>
              <div>npx skills add eugenennamdi/Reckon --skill reckon</div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Hosted MCP Server (<code className="font-mono text-xs">POST {siteUrl}/api/mcp</code>)
              </h3>
              <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08] bg-card">
                {MCP_TOOLS_SUMMARY.map((tool) => (
                  <div key={tool.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                    <code className="shrink-0 font-mono text-xs font-semibold text-foreground sm:w-56">
                      {tool.name}
                    </code>
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {tool.summary}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 7. Verified Mainnet Contracts */}
          <section id="contracts" className="scroll-mt-24 space-y-4 border-t border-black/[0.06] pt-8">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-foreground">
              7. Verified Mainnet Contracts &amp; Dependencies (BNB Chain · 56)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-black/[0.06] bg-secondary/50 font-mono text-[11px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Contract</th>
                    <th className="px-4 py-3">Mainnet Address</th>
                    <th className="px-4 py-3">Explorer / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] font-mono text-[11px]">
                  <tr>
                    <td className="px-4 py-3 font-sans font-semibold text-foreground">ReckonCore</td>
                    <td className="px-4 py-3 text-foreground">{core}</td>
                    <td className="px-4 py-3 font-sans">
                      <a
                        href={`https://bscscan.com/address/${core}#code`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-foreground underline underline-offset-2"
                      >
                        BscScan #code <ArrowUpRight size={11} />
                      </a>{" "}
                      · Ownerless · 0% fee
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-sans font-semibold text-foreground">ReckonSignalRegistry</td>
                    <td className="px-4 py-3 text-foreground">{registry}</td>
                    <td className="px-4 py-3 font-sans">
                      <a
                        href={`https://bscscan.com/address/${registry}#code`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-foreground underline underline-offset-2"
                      >
                        BscScan #code <ArrowUpRight size={11} />
                      </a>{" "}
                      · Ownerless · 0% fee
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-sans font-semibold text-foreground">SPACE ID Agent ID</td>
                    <td className="px-4 py-3 text-foreground">{AGENT_ID_ADDRESS}</td>
                    <td className="px-4 py-3 font-sans text-muted-foreground">Soulbound ERC-721 (.ai)</td>
                  </tr>
                  {FEEDS.map((f) => (
                    <tr key={f.id}>
                      <td className="px-4 py-3 font-sans font-medium text-foreground">Chainlink {f.symbol}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.address}</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">8 decimals · {f.heartbeatSec}s heartbeat</td>
                    </tr>
                  ))}
                  {BSC_STABLECOINS.map((c) => (
                    <tr key={c.symbol}>
                      <td className="px-4 py-3 font-sans font-medium text-foreground">{c.symbol}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.address}</td>
                      <td className="px-4 py-3 font-sans text-muted-foreground">
                        {c.assetTransferMethod === "eip3009" ? "Native EIP-3009 (zero approval)" : "Permit2 exact-amount"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
              <span>
                Stake tiers:{" "}
                {STAKE_TIERS.map((t) => `${t.label} (${t.stakeBnb} BNB)`).join(" · ")}
              </span>
              <span>·</span>
              <a href={RECKON_GITHUB_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                GitHub Source
              </a>
              <span>·</span>
              <a href={RECKON_X_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                @reckon_markets
              </a>
              <span>·</span>
              <a href={`mailto:${RECKON_CONTACT_EMAIL}`} className="underline underline-offset-2 hover:text-foreground">
                {RECKON_CONTACT_EMAIL}
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
