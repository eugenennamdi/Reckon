import type { Metadata } from "next";
import {
  ArrowUpRight,
  CheckCircle,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react/dist/ssr";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Security & Compliance",
  description:
    "Zero-owner immutable smart contract verification, strictly proper Lambert WSWM mechanism proofs, BSC Mainnet oracle dependencies, and all 9 Safety Red Lines.",
  alternates: { canonical: "/security" },
  openGraph: {
    title: "Security & Compliance · Reckon",
    description:
      "Ownerless smart contract permission matrix, Lambert WSWM settlement proofs, and 9 Safety Red Lines verification on BNB Smart Chain.",
    url: "/security",
  },
};

const RED_LINES = [
  {
    num: 1,
    title: "No Web Agentic Wallet QR Login or Server Sessions",
    detail:
      "Web terminal connects strictly via injected EVM wallets (wagmi/viem EIP-6963). Binance Agentic Wallet automation runs locally via the official baw CLI in skills/reckon/SKILL.md and unsigned calldata preparation via /api/mcp.",
  },
  {
    num: 2,
    title: "No Bypassing Transaction Confirmations",
    detail:
      "Every state-changing action previews via baw contract-call preview, baw sign-message preview, or baw x402-payment preview, renders parsed calldata, value, simulation diffs, and risks, and waits for explicit human confirmation.",
  },
  {
    num: 3,
    title: "No Unauthorized Transfers or Silent Unlimited Approvals",
    detail:
      "Layer 1 uses native BNB (allowanceChanges: [], zero ERC-20 approve() calls). Layer 3 prioritizes zero-approval EIP-3009 stablecoins (USD1, U) and explicitly flags Permit2 approvals (USDT, USDC).",
  },
  {
    num: 4,
    title: "Open-Source & Verified Contracts with Minimal Permissions",
    detail:
      "Both ReckonCore.sol and ReckonSignalRegistry.sol are 100% ownerless, non-upgradeable, non-pausable, and enforce 0% protocol fees with zero admin withdrawals.",
  },
  {
    num: 5,
    title: "No Binance or BNB Brand Impersonation",
    detail:
      "Independent open-source protocol named Reckon; explicitly non-affiliated with and unendorsed by Binance.",
  },
  {
    num: 6,
    title: "Zero Collection of Sensitive Credentials",
    detail:
      "Zero seed phrases, private keys, API keys, or pairing codes collected. Commit salts are generated via CSPRNG client-side and persisted locally (~/.reckon/salts.json mode 0600 or append-only browser localStorage).",
  },
  {
    num: 7,
    title: "Zero Return or Profit Promises",
    detail:
      "Automated compliance lint (npm run check:compliance) forbids return-promise language across web/, skills/, contracts/README.md, README.md, and SECURITY.md.",
  },
  {
    num: 8,
    title: "Mandatory Financial Risk Warnings",
    detail:
      "Prominent risk disclosures directly inside the forecasting execution ticket, x402 signal settlement inspector, pre-commit recovery confirmation modal, global footer, SKILL.md, and /api/mcp.",
  },
  {
    num: 9,
    title: "No Arbitrary Handle-to-Wallet Lookup Tool",
    detail:
      "Zero forward handle lookup UI/API/MCP endpoints. Leaderboards display opt-in Reckon participants exclusively via ReckonCore.getAgents(offset, limit) and ReckonSignalRegistry.getProviders(offset, limit).",
  },
] as const;

export default function SecurityPage() {
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();

  const contracts = [
    {
      name: "ReckonCore (Layers 1 & 2)",
      address: isDeployedAddress(core) ? core : "Pending Mainnet Deployment",
      deployed: isDeployedAddress(core),
      notes:
        "Ownerless, immutable, 0% fee, 24/7 4H rolling commit-reveal (4h/4h/4h), max 27 pending rounds, 0.7600 Verified / 0.7800 Elite Brier.",
    },
    {
      name: "ReckonSignalRegistry (Layer 3)",
      address: isDeployedAddress(registry) ? registry : "Pending Mainnet Deployment",
      deployed: isDeployedAddress(registry),
      notes:
        "Ownerless opt-in metadata registry ($0.10–$50.00 price bounds) gated live by isVerifiedForecaster().",
    },
    {
      name: "SPACE ID Agent ID (HandleRegistry)",
      address: AGENT_ID_ADDRESS,
      deployed: true,
      notes: "Soulbound, non-transferable, non-burnable 1-per-account identity gate.",
    },
    {
      name: "Canonical Permit2 / x402ExactPermit2Proxy",
      addresses: [
        { label: "Permit2", value: PERMIT2_ADDRESS },
        { label: "x402ExactPermit2Proxy", value: X402_EXACT_PERMIT2_PROXY },
      ],
      address: PERMIT2_ADDRESS,
      deployed: true,
      notes: "Used for USDT/USDC Permit2 x402 v2 settlement (USD1 & U use zero-approval EIP-3009).",
    },
    {
      name: "Agent OS / MCP Endpoint",
      address: "/api/mcp",
      deployed: true,
      notes: "JSON-RPC 2.0 read-only & unsigned calldata preparation (zero server signing, zero handle lookup).",
    },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          Security &amp; compliance.
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Zero-owner smart contract immutability, strictly proper Lambert WSWM settlement proofs, verified BNB Chain dependencies, and all 9 Safety Red Lines.
        </p>
      </section>

      {/* Permission Matrix */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>Smart contract permission matrix</CardTitle>
          <CardDescription>
            Both deployed contracts have zero privileged admin roles and zero upgrade paths.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Contract</TableHead>
              <TableHead>Owner / Admin</TableHead>
              <TableHead>Upgrade Proxy</TableHead>
              <TableHead>Admin Withdraw</TableHead>
              <TableHead>Pause / Freeze</TableHead>
              <TableHead className="text-right">Protocol Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="font-mono text-xs">
            {[
              { name: "ReckonCore.sol", withdraw: "No" },
              { name: "ReckonSignalRegistry.sol", withdraw: "No (0 custody)" },
            ].map((row) => (
              <TableRow key={row.name}>
                <TableCell className="font-semibold text-foreground">{row.name}</TableCell>
                <TableCell className="text-foreground">None</TableCell>
                <TableCell className="text-foreground">No</TableCell>
                <TableCell className="text-foreground">{row.withdraw}</TableCell>
                <TableCell className="text-foreground">No</TableCell>
                <TableCell className="text-right font-semibold text-foreground">0%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mechanism + Dependencies */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader className="border-b border-black/[0.06] pb-4">
            <CardTitle>Strictly proper Lambert WSWM (EC 2008)</CardTitle>
            <CardDescription>
              O(1) on-chain settlement via running sumP and sumP2 accumulators
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-5 pt-5 text-xs leading-relaxed text-muted-foreground">
            <div className="space-y-4">
              <p>
                For integer probability{" "}
                <span className="font-mono text-foreground">Pᵢ ∈ [100, 9900]</span> and binary Chainlink outcome{" "}
                <span className="font-mono text-foreground">Y ∈ &#123;0, 10000&#125;</span>, integer Brier score is{" "}
                <span className="font-mono text-foreground">Sᵢ = 10⁸ − (Pᵢ − Y)²</span>:
              </p>
              <pre className="surface-well overflow-x-auto rounded-xl p-4 font-mono text-[11px] font-medium text-foreground">
                {`Payoutᵢ = floor(W · (C · 10⁸ + N · Sᵢ − ΣS) / (N · 10⁸))`}
              </pre>
              <p>
                Reporting true belief{" "}
                <span className="font-mono text-foreground">p = q</span> is the unique dominant strategy for all{" "}
                <span className="font-mono text-foreground">N ≥ 2</span>. The final claimer sweeps at most{" "}
                <span className="font-mono text-foreground">N − 1</span> wei floor dust so{" "}
                <code className="font-mono text-foreground">remainingPool</code> reaches exactly zero.
              </p>
            </div>

            <div className="space-y-3 border-t border-black/[0.06] pt-4">
              <div className="text-xs font-semibold text-foreground">
                24/7 rolling cadence &amp; oracle safeguards
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="surface-well rounded-xl p-3.5">
                  <div className="font-mono text-[11px] font-medium text-foreground">
                    4h / 4h / 4h UTC Grid
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Zero commit blackouts. Up to 27 simultaneous active slots (3 full 9-slot epochs) auto-flushed on commit.
                  </p>
                </div>
                <div className="surface-well rounded-xl p-3.5">
                  <div className="font-mono text-[11px] font-medium text-foreground">
                    0.7600 Verified / 0.7800 Elite
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Blocks 50% coin-flip farming (0.7500) and requires ≥ 3 distinct competitive epochs + ≥ 80% reveal discipline.
                  </p>
                </div>
              </div>
              <div className="surface-well rounded-xl p-3.5">
                <div className="font-mono text-[11px] font-medium text-foreground">
                  3-Path Grief-Proof Oracle Escape Hatch
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Healthy feeds cannot be cancelled early. Penalty-free 100% refunds unlock via{" "}
                  <code className="font-mono text-foreground/90">cancelOracleGap</code> (&gt;30m gap across phase rollovers),{" "}
                  <code className="font-mono text-foreground/90">cancelUnsettleableRound</code> (verified 2h feed halt), or a 7-day emergency fallback.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader className="border-b border-black/[0.06] pb-4">
            <CardTitle>BNB Chain contract &amp; oracle dependencies</CardTitle>
            <CardDescription>Verified addresses on BNB Chain (Chain ID 56)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-5">
            <div className="divide-y divide-black/[0.06]">
              {contracts.map((c) => (
                <div key={c.name} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{c.name}</span>
                    {c.deployed ? (
                      <Badge variant="positive" className="rounded-full">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="rounded-full">
                        Pending
                      </Badge>
                    )}
                  </div>
                  {"addresses" in c && c.addresses ? (
                    <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                      {c.addresses.map((entry) => (
                        <div key={entry.label} className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{entry.label}:</span>
                          <a
                            href={`https://bscscan.com/address/${entry.value}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 break-all text-foreground/85 underline-offset-2 transition-[color] duration-150 hover:text-foreground hover:underline"
                          >
                            <span>{entry.value}</span>
                            <ArrowUpRight size={11} className="shrink-0" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      {c.deployed && c.address.startsWith("0x") && c.address.length === 42 ? (
                        <a
                          href={`https://bscscan.com/address/${c.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-foreground/85 underline-offset-2 transition-[color] duration-150 hover:text-foreground hover:underline"
                        >
                          <span>{c.address}</span>
                          <ArrowUpRight size={11} className="shrink-0" />
                        </a>
                      ) : (
                        c.address
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {c.notes}
                  </p>
                </div>
              ))}
            </div>

            <div className="surface-well rounded-xl p-3.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
              <div>
                Chainlink feeds:{" "}
                {FEEDS.map((f) => `${f.symbol} (${f.address.slice(0, 8)}…)`).join(" · ")}
              </div>
              <div className="mt-1">
                x402 tokens:{" "}
                {BSC_STABLECOINS.map((s) => `${s.symbol} [${s.assetTransferMethod}]`).join(" · ")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 9 Safety Red Lines */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} weight="duotone" className="text-foreground" />
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
              9 Safety Red Lines verification
            </h2>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            Automated CI compliance verified
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {RED_LINES.map((line) => (
            <Card key={line.num} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold tracking-tight text-foreground/30">
                  {String(line.num).padStart(2, "0")}
                </span>
                <CheckCircle size={15} weight="fill" className="text-foreground" />
              </div>
              <h3 className="mt-3 text-[13px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                {line.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {line.detail}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Financial Risk Disclosure */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <ShieldWarning size={18} weight="duotone" className="mt-0.5 shrink-0 text-foreground" />
          <div className="space-y-1">
            <h2 className="text-xs font-semibold text-foreground">
              Financial, oracle &amp; smart contract risk disclosure
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {RISK_DISCLOSURE.replace(/^Risk Warning:\s*/i, "")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
