import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  AGENT_ID_ADDRESS,
  BSC_STABLECOINS,
  FEEDS,
  PERMIT2_ADDRESS,
  RISK_DISCLOSURE,
  X402_EXACT_PERMIT2_PROXY,
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
  isDeployedAddress,
} from "@/lib/reckon/constants";

export const metadata: Metadata = {
  title: "Security & Compliance",
  description:
    "Zero-owner immutable smart contract verification, strictly proper Lambert WSWM mechanism proofs, BNB Chain oracle dependencies, and all 9 Safety Red Lines.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Security & Compliance · Reckon",
    description:
      "Ownerless smart contract permission matrix, Lambert WSWM settlement proofs, and 9 Safety Red Lines verification on BNB Chain.",
    url: "/security",
  },
};

const RED_LINES = [
  {
    num: "01",
    title: "No web Agentic Wallet QR login or server sessions",
    detail:
      "The web app uses standard client-side EVM wallet connections with zero server-side sessions and zero Agentic Wallet pairing codes or QR sign-in. Local automation runs via the official baw CLI and unsigned calldata preparation.",
  },
  {
    num: "02",
    title: "No bypassing transaction confirmations",
    detail:
      "Every state-changing action previews via baw contract-call, sign-message, or x402-payment preview, displays parsed calldata, amounts, simulation diffs, and risks, and waits for explicit human confirmation.",
  },
  {
    num: "03",
    title: "No unauthorized transfers or silent approvals",
    detail:
      "Layer 1 forecasting uses native BNB (allowanceChanges: [], zero ERC-20 approvals). Layer 3 prioritizes zero-approval EIP-3009 stablecoins (USD1, U) and explicitly flags Permit2 approvals for USDT and USDC.",
  },
  {
    num: "04",
    title: "Open-source, verified, ownerless contracts",
    detail:
      "Both ReckonCore.sol and ReckonSignalRegistry.sol are 100% ownerless, non-upgradeable, non-pausable, publicly verified on BscScan and Sourcify, and enforce 0% protocol fee with zero admin withdrawals.",
  },
  {
    num: "05",
    title: "No Binance or BNB brand impersonation",
    detail:
      "Independent open-source protocol named Reckon; explicitly non-affiliated with and unendorsed by Binance across app copy, domain, X handle, and documentation.",
  },
  {
    num: "06",
    title: "Zero collection of sensitive credentials",
    detail:
      "Zero seed phrases, private keys, API secrets, or wallet pairing codes are ever requested or collected. Prediction salts are generated client-side and persisted locally (~/.reckon/salts.json mode 0600 or browser localStorage).",
  },
  {
    num: "07",
    title: "Zero return or profit promises",
    detail:
      "Automated CI compliance linting (npm run check:compliance) forbids return-promise language across web/, skills/, docs/, agents/, contracts/README.md, README.md, and SECURITY.md.",
  },
  {
    num: "08",
    title: "Mandatory financial risk warnings",
    detail:
      "Clear risk disclosures appear inside the forecasting ticket, x402 signal settlement inspector, pre-commit recovery confirmation modal, global footer, SKILL.md, and /api/mcp.",
  },
  {
    num: "09",
    title: "No arbitrary handle-to-wallet lookup",
    detail:
      "Zero forward handle lookup UI, API, or MCP endpoints. Leaderboards display opt-in Reckon participants exclusively via ReckonCore.getAgents(offset, limit) and ReckonSignalRegistry.getProviders(offset, limit).",
  },
] as const;

export default function SecurityPage() {
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();

  const contracts = [
    {
      name: "ReckonCore (Layers 1 & 2)",
      address: isDeployedAddress(core) ? core : "Pending deployment",
      deployed: isDeployedAddress(core),
      codeHash: true,
      notes:
        "Ownerless, immutable, 0% fee, 24/7 rolling 4h commit-reveal, 27-slot pending cap, 0.7600 Verified / 0.7800 Elite.",
    },
    {
      name: "ReckonSignalRegistry (Layer 3)",
      address: isDeployedAddress(registry) ? registry : "Pending deployment",
      deployed: isDeployedAddress(registry),
      codeHash: true,
      notes:
        "Ownerless opt-in metadata registry ($0.10–$50.00 bounds) gated live by isVerifiedForecaster().",
    },
    {
      name: "SPACE ID Agent ID (HandleRegistry)",
      address: AGENT_ID_ADDRESS,
      deployed: true,
      codeHash: false,
      notes: "Soulbound, non-transferable, non-burnable 1-per-account identity gate.",
    },
    {
      name: "Canonical Permit2 & x402ExactPermit2Proxy",
      addresses: [
        { label: "Permit2", value: PERMIT2_ADDRESS },
        { label: "Proxy", value: X402_EXACT_PERMIT2_PROXY },
      ],
      address: PERMIT2_ADDRESS,
      deployed: true,
      codeHash: false,
      notes: "Exact-amount Permit2 x402 v2 settlement for USDT & USDC (USD1 & U use zero-approval EIP-3009).",
    },
    {
      name: "Agent OS / MCP Endpoint",
      address: "/api/mcp",
      deployed: true,
      codeHash: false,
      notes: "JSON-RPC 2.0 read-only queries & unsigned calldata preparation (zero server signing, zero handle lookup).",
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          Security &amp; compliance.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Zero-owner immutable contracts, strictly proper settlement math, verified mainnet dependencies, and all nine protocol safety guarantees.
        </p>
      </section>

      {/* Permission Matrix */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
            Smart contract permission matrix
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Both deployed contracts have zero privileged admin roles and zero upgrade paths.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-black/[0.06] bg-[#FAFAFB] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th className="px-6 py-3.5">Contract</th>
                <th className="px-6 py-3.5">Owner / Admin</th>
                <th className="px-6 py-3.5">Upgrade Proxy</th>
                <th className="px-6 py-3.5">Admin Withdraw</th>
                <th className="px-6 py-3.5">Pause / Freeze</th>
                <th className="px-6 py-3.5 text-right">Protocol Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05] font-mono text-[12px] tabular-nums">
              {[
                { name: "ReckonCore.sol", withdraw: "No" },
                { name: "ReckonSignalRegistry.sol", withdraw: "No (0 custody)" },
              ].map((row) => (
                <tr key={row.name}>
                  <td className="whitespace-nowrap px-6 py-4 font-semibold text-foreground">
                    {row.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground">None</td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground">No</td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground">{row.withdraw}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-foreground">No</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-foreground">
                    0%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unified 2-Column Architecture: Settlement Math + Mainnet Dependencies */}
      <section className="overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="grid divide-y divide-black/[0.06] lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Left: Mechanism & Oracle Safeguards */}
          <div className="flex flex-col justify-between lg:col-span-5">
            <div className="space-y-5 p-7">
              <div className="space-y-1">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                  Strictly proper Lambert WSWM (EC 2008)
                </h2>
                <p className="text-xs text-muted-foreground">
                  O(1) on-chain settlement via running sumP and sumP2 accumulators
                </p>
              </div>

              <p className="text-[13px] leading-[1.6] text-muted-foreground">
                For integer probability{" "}
                <span className="font-mono text-xs text-foreground">Pᵢ ∈ [100, 9900]</span> and binary Chainlink outcome{" "}
                <span className="font-mono text-xs text-foreground">Y ∈ &#123;0, 10000&#125;</span>, integer Brier score is{" "}
                <span className="font-mono text-xs text-foreground">Sᵢ = 10⁸ − (Pᵢ − Y)²</span>:
              </p>

              <pre className="overflow-x-auto rounded-xl border border-black/[0.06] bg-[#FAFAFB] px-4 py-3.5 font-mono text-[11.5px] font-medium text-foreground">
                {`Payoutᵢ = floor(W · (C · 10⁸ + N · Sᵢ − ΣS) / (N · 10⁸))`}
              </pre>

              <p className="text-[13px] leading-[1.6] text-muted-foreground">
                Reporting true belief <span className="font-mono text-xs text-foreground">p = q</span> is the unique dominant strategy for all{" "}
                <span className="font-mono text-xs text-foreground">N ≥ 2</span>. The final claimer sweeps at most{" "}
                <span className="font-mono text-xs text-foreground">N − 1</span> wei floor dust so{" "}
                <code className="font-mono text-xs text-foreground">remainingPool</code> reaches exactly zero.
              </p>
            </div>

            {/* Clean Hairline Safeguard Rows (Zero Nested Gray Boxes) */}
            <div className="divide-y divide-black/[0.06] border-t border-black/[0.06] bg-[#FAFAFB]">
              <div className="px-7 py-4">
                <div className="font-mono text-[11.5px] font-semibold text-foreground">
                  4h / 4h / 4h UTC grid
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Zero commit blackouts. Up to 27 simultaneous active slots (3 full 9-slot epochs) auto-flushed on commit.
                </p>
              </div>
              <div className="px-7 py-4">
                <div className="font-mono text-[11.5px] font-semibold text-foreground">
                  0.7600 Verified / 0.7800 Elite
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Blocks 50% coin-flip farming (0.7500) and requires ≥ 3 distinct competitive epochs plus ≥ 80% reveal rate.
                </p>
              </div>
              <div className="px-7 py-4">
                <div className="font-mono text-[11.5px] font-semibold text-foreground">
                  3-path grief-proof oracle escape hatch
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Healthy feeds cannot be cancelled early. 100% refunds unlock via{" "}
                  <code className="font-mono text-[11px] text-foreground">cancelOracleGap</code> (&gt;30m gap across phase rollovers),{" "}
                  <code className="font-mono text-[11px] text-foreground">cancelUnsettleableRound</code> (2h live halt), or a 7-day fallback.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Verified Mainnet Dependencies */}
          <div className="flex flex-col justify-between lg:col-span-7">
            <div className="p-7">
              <div className="space-y-1">
                <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                  Verified contract &amp; oracle dependencies
                </h2>
                <p className="text-xs text-muted-foreground">
                  Canonical addresses deployed on BNB Chain (Chain ID 56)
                </p>
              </div>

              <div className="mt-5 divide-y divide-black/[0.06]">
                {contracts.map((c) => (
                  <div key={c.name} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-semibold text-foreground">{c.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {c.deployed ? "Mainnet" : "Pending"}
                      </span>
                    </div>
                    {"addresses" in c && c.addresses ? (
                      <div className="mt-1.5 space-y-1 font-mono text-[11.5px]">
                        {c.addresses.map((entry) => (
                          <div key={entry.label} className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">{entry.label}:</span>
                            <a
                              href={`https://bscscan.com/address/${entry.value}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 break-all text-foreground/85 transition-colors hover:text-foreground"
                            >
                              <span>{entry.value}</span>
                              <ArrowUpRight size={11} className="shrink-0 text-muted-foreground" />
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 break-all font-mono text-[11.5px] text-muted-foreground">
                        {c.deployed && c.address.startsWith("0x") && c.address.length === 42 ? (
                          <a
                            href={`https://bscscan.com/address/${c.address}${c.codeHash ? "#code" : ""}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-foreground/85 transition-colors hover:text-foreground"
                          >
                            <span>{c.address}</span>
                            <ArrowUpRight size={11} className="shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <a
                            href={c.address}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-foreground/85 transition-colors hover:text-foreground"
                          >
                            <span>{c.address}</span>
                            <ArrowUpRight size={11} className="shrink-0 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {c.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-black/[0.06] bg-[#FAFAFB] px-7 py-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <div>
                Chainlink feeds:{" "}
                {FEEDS.map((f) => `${f.symbol} (${f.address.slice(0, 8)}…)`).join(" · ")}
              </div>
              <div className="mt-1">
                x402 tokens:{" "}
                {BSC_STABLECOINS.map((s) => `${s.symbol} [${s.assetTransferMethod}]`).join(" · ")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9 Safety Red Lines — Unified Hairline 3x3 Architectural Grid (Zero Icons) */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              Nine safety red lines
            </h2>
            <p className="text-[13px] text-muted-foreground">
              Enforced across smart contracts, web interface, Agentic Wallet skills, and CI checks.
            </p>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            CI compliance verified
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="grid gap-px md:grid-cols-3">
            {RED_LINES.map((line) => (
              <article key={line.num} className="bg-card p-6 sm:p-7">
                <div className="font-mono text-xs font-medium text-muted-foreground/70">
                  {line.num}
                </div>
                <h3 className="mt-3 text-[14px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
                  {line.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                  {line.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Calm Risk Disclosure Panel (Zero Decorative Shield Icon) */}
      <section className="rounded-2xl border border-black/[0.07] bg-[#FAFAFB] px-7 py-5">
        <h2 className="text-[13px] font-semibold text-foreground">
          Financial, oracle &amp; smart contract risk disclosure
        </h2>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">
          {RISK_DISCLOSURE.replace(/^Risk Warning:\s*/i, "")}
        </p>
      </section>
    </div>
  );
}
