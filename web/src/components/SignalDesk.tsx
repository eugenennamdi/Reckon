"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Broadcast,
  Check,
  CheckCircle,
  Copy,
  LockKeyOpen,
  PaperPlaneTilt,
  ShieldCheck,
  TerminalWindow,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { parseUnits, type Address, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
import { reckonCoreAbi, reckonSignalRegistryAbi } from "@/lib/abi";
import type { RoundSnapshot, SignalProviderSnapshot } from "@/lib/reckon/chain";
import { currentEpochId, formatAtomicUsd, formatBrierScore } from "@/lib/reckon/commitment";
import {
  BSC_CHAIN_ID,
  BSC_STABLECOINS,
  FEEDS,
  MAX_PROB_BPS,
  MIN_PROB_BPS,
  PERMIT2_ADDRESS,
  X402_EXACT_PERMIT2_PROXY,
  findStablecoin,
  isDeployedAddress,
} from "@/lib/reckon/constants";
import { findSaltForSlot } from "@/lib/salts-browser";
import type { IntegrityCheckResult } from "@/lib/x402/attestation";
import type { X402PaymentRequired } from "@/lib/x402/protocol";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface CatalogSignalItem {
  id: string;
  seller: Address;
  handle: string;
  isVerified: boolean;
  meanBrier: number;
  bssPct: number;
  revealRateBps: number;
  competitiveRoundsScored: number;
  roundId: number;
  feedId: number;
  feedSymbol: string;
  epochId: number;
  tierId: number;
  tierLabel: string;
  roundState: string;
  resolveTime: number | null;
  outcome: 0 | 1 | null;
  title: string;
  summary: string;
  priceAtomic: string;
  preferredToken: Address;
  preferredTokenSymbol: string;
  thesisHash: Hex;
  createdAt: string;
  purchaseCount: number;
  claimedProbRedacted: boolean;
  claimedProbBps: number | null;
  integrity: IntegrityCheckResult;
  endpointUrl: string;
}

interface SignalDeskProps {
  coreAddress: Address;
  registryAddress: Address;
  initialFacilitatorMode: string;
  initialSignals: CatalogSignalItem[];
  initialProviders: SignalProviderSnapshot[];
}

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function integrityVariant(status: IntegrityCheckResult["status"]): BadgeProps["variant"] {
  switch (status) {
    case "VERIFIED_MATCH":
      return "positive";
    case "MISMATCH":
      return "destructive";
    case "UNREVEALED":
      return "warning";
    case "ORACLE_CANCELLED":
      return "secondary";
    default:
      return "info";
  }
}

function formatFacilitatorLabel(mode: string): string {
  if (mode === "binance-b402") return "Binance B402";
  if (mode === "self-hosted-bsc") return "x402 v2 · Self-Hosted";
  return mode;
}

function encodeB64(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

export function SignalDesk({
  coreAddress,
  registryAddress,
  initialFacilitatorMode,
  initialSignals,
  initialProviders,
}: SignalDeskProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient({ chainId: BSC_CHAIN_ID });
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [tab, setTab] = useState<"feed" | "providers" | "publish">("feed");
  const [signals, setSignals] = useState<CatalogSignalItem[]>(initialSignals);
  const [providers, setProviders] = useState<SignalProviderSnapshot[]>(initialProviders);
  const [facilitatorMode, setFacilitatorMode] = useState(initialFacilitatorMode);
  const [origin, setOrigin] = useState("https://reckon.local");
  const [copiedCli, setCopiedCli] = useState(false);

  // Unlock inspector state
  const [activeSignal, setActiveSignal] = useState<CatalogSignalItem | null>(null);
  const [paymentChallenge, setPaymentChallenge] = useState<X402PaymentRequired | null>(null);
  const [paymentTokenSymbol, setPaymentTokenSymbol] = useState<"USD1" | "U" | "USDT" | "USDC">(
    "USD1",
  );
  const [unlockedResult, setUnlockedResult] = useState<{
    thesis: string;
    claimedProbBps: number;
    txHash: string;
    mode: string;
  } | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Publish Signal form
  const [pubRoundId, setPubRoundId] = useState("1");
  const [pubFeedId, setPubFeedId] = useState(0);
  const [pubEpochId, setPubEpochId] = useState("");
  const [pubTierId, setPubTierId] = useState(0);
  const [pubProbPct, setPubProbPct] = useState(72);
  const [pubPriceUsd, setPubPriceUsd] = useState("0.50");
  const [pubToken, setPubToken] = useState<"USD1" | "U" | "USDT" | "USDC">("USD1");
  const [pubTitle, setPubTitle] = useState("");
  const [pubSummary, setPubSummary] = useState("");
  const [pubThesis, setPubThesis] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [lockedAgentRounds, setLockedAgentRounds] = useState<RoundSnapshot[]>([]);

  // Provider listing form
  const [regUrl, setRegUrl] = useState("");
  const [regPriceUsd, setRegPriceUsd] = useState("0.50");
  const [regToken, setRegToken] = useState<"USD1" | "U" | "USDT" | "USDC">("USD1");
  const [regBio, setRegBio] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (window.location.protocol === "https:") {
      setRegUrl(`${window.location.origin}/api/signals`);
    }
    setPubEpochId(String(currentEpochId()));
  }, []);

  const applyLockedRoundSelection = useCallback(
    (r: RoundSnapshot) => {
      setPubRoundId(String(r.roundId));
      setPubEpochId(String(r.epochId));
      setPubFeedId(r.feedId);
      setPubTierId(r.tierId);
      if (address) {
        const match = findSaltForSlot({
          agent: address,
          coreAddress,
          feedId: r.feedId,
          epochId: r.epochId,
          tierId: r.tierId,
          commitment: r.agentEntry?.commitment,
        });
        if (match) {
          setPubProbPct(Number((match.probBps / 100).toFixed(2)));
        }
      }
    },
    [address, coreAddress],
  );

  useEffect(() => {
    if (!address) {
      setLockedAgentRounds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rounds?epochs=4&agent=${address}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          rounds?: RoundSnapshot[];
          pendingRounds?: RoundSnapshot[];
        };
        const merged = new Map<number, RoundSnapshot>();
        for (const r of [...(json.pendingRounds ?? []), ...(json.rounds ?? [])]) {
          if (r.roundId > 0 && r.state === "LOCKED" && r.agentEntry?.committed) {
            merged.set(r.roundId, r);
          }
        }
        const list = [...merged.values()].sort((a, b) => b.roundId - a.roundId);
        if (!cancelled) {
          setLockedAgentRounds(list);
          if (list[0]) applyLockedRoundSelection(list[0]);
        }
      } catch {
        // ignore transient network errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, applyLockedRoundSelection]);

  const { data: isVerified } = useReadContract({
    address: coreAddress,
    abi: reckonCoreAbi,
    functionName: "isVerifiedForecaster",
    args: address ? [address] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(address && isDeployedAddress(coreAddress)) },
  });

  const refreshAll = useCallback(async () => {
    const [sigRes, lbRes] = await Promise.all([
      fetch("/api/signals", { cache: "no-store" }),
      fetch("/api/leaderboard", { cache: "no-store" }),
    ]);
    if (sigRes.ok) {
      const sj = (await sigRes.json()) as {
        facilitatorMode: string;
        signals: CatalogSignalItem[];
      };
      setSignals(sj.signals);
      setFacilitatorMode(sj.facilitatorMode);
    }
    if (lbRes.ok) {
      const lj = (await lbRes.json()) as { providers: SignalProviderSnapshot[] };
      setProviders(lj.providers);
    }
  }, []);

  const openUnlockDrawer = async (sig: CatalogSignalItem) => {
    setActiveSignal(sig);
    setUnlockedResult(null);
    setUnlockError(null);
    setPaymentChallenge(null);
    const preferred = findStablecoin(sig.preferredToken);
    if (preferred) setPaymentTokenSymbol(preferred.symbol);

    try {
      const res = await fetch(`/api/signals/${sig.id}`, { cache: "no-store" });
      const body = (await res.json()) as X402PaymentRequired;
      setPaymentChallenge(body);
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Failed to fetch 402 payment challenge");
    }
  };

  const handleBrowserX402Pay = async () => {
    if (!activeSignal || !paymentChallenge || !address) return;
    setIsPaying(true);
    setUnlockError(null);

    try {
      const coin = findStablecoin(paymentTokenSymbol)!;
      const req = paymentChallenge.accepts.find(
        (a) => a.asset.toLowerCase() === coin.address.toLowerCase(),
      );
      if (!req) {
        throw new Error(`Token ${coin.symbol} not listed in 402 accepts[]`);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const amountBig = BigInt(req.amount);
      let envelope: Record<string, unknown>;

      const transferMethod = req.extra.assetTransferMethod ?? coin.assetTransferMethod;
      if (transferMethod === "eip3009") {
        const rand = new Uint8Array(32);
        crypto.getRandomValues(rand);
        const nonce = `0x${Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
        const validAfter = BigInt(Math.max(0, nowSec - 15));
        const validBefore = BigInt(nowSec + 300);

        const sig = await signTypedDataAsync({
          domain: {
            name: req.extra.name,
            version: req.extra.version,
            chainId: BSC_CHAIN_ID,
            verifyingContract: coin.address,
          },
          types: {
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
          primaryType: "TransferWithAuthorization",
          message: {
            from: address,
            to: req.payTo,
            value: amountBig,
            validAfter,
            validBefore,
            nonce,
          },
        });

        envelope = {
          x402Version: 2,
          accepted: req,
          payload: {
            signature: sig,
            authorization: {
              from: address,
              to: req.payTo,
              value: amountBig.toString(),
              validAfter: validAfter.toString(),
              validBefore: validBefore.toString(),
              nonce,
            },
          },
        };
      } else {
        if (publicClient) {
          const allowance = await publicClient.readContract({
            address: coin.address,
            abi: ERC20_APPROVE_ABI,
            functionName: "allowance",
            args: [address, PERMIT2_ADDRESS],
          });
          if (allowance < amountBig) {
            const approveToast = toast.loading(`Approving exact ${coin.symbol} for Permit2…`);
            const approveHash = await writeContractAsync({
              address: coin.address,
              abi: ERC20_APPROVE_ABI,
              functionName: "approve",
              args: [PERMIT2_ADDRESS, amountBig],
              chainId: BSC_CHAIN_ID,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            toast.success("Permit2 allowance confirmed", { id: approveToast });
          }
        }

        const rand = new Uint8Array(8);
        crypto.getRandomValues(rand);
        const nonce = BigInt(
          `0x${Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("")}`,
        );
        const validAfter = BigInt(Math.max(0, nowSec - 15));
        const deadline = BigInt(nowSec + 300);

        const sig = await signTypedDataAsync({
          domain: {
            name: "Permit2",
            chainId: BSC_CHAIN_ID,
            verifyingContract: PERMIT2_ADDRESS,
          },
          types: {
            PermitWitnessTransferFrom: [
              { name: "permitted", type: "TokenPermissions" },
              { name: "spender", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
              { name: "witness", type: "Witness" },
            ],
            TokenPermissions: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            Witness: [
              { name: "to", type: "address" },
              { name: "validAfter", type: "uint256" },
            ],
          },
          primaryType: "PermitWitnessTransferFrom",
          message: {
            permitted: {
              token: coin.address,
              amount: amountBig,
            },
            spender: req.extra.spenderAddress ?? X402_EXACT_PERMIT2_PROXY,
            nonce,
            deadline,
            witness: {
              to: req.payTo,
              validAfter,
            },
          },
        });

        envelope = {
          x402Version: 2,
          accepted: req,
          payload: {
            signature: sig,
            permit2Authorization: {
              permitted: {
                token: coin.address,
                amount: amountBig.toString(),
              },
              from: address,
              spender: req.extra.spenderAddress ?? X402_EXACT_PERMIT2_PROXY,
              nonce: nonce.toString(),
              deadline: deadline.toString(),
              witness: {
                to: req.payTo,
                validAfter: validAfter.toString(),
              },
            },
          },
        };
      }

      const paidRes = await fetch(`/api/signals/${activeSignal.id}`, {
        headers: { "PAYMENT-SIGNATURE": encodeB64(envelope) },
      });
      const paidJson = (await paidRes.json()) as {
        error?: string;
        signal?: { thesis: string; claimedProbBps: number };
        receipt?: { txHash: string; facilitatorMode: string };
      };
      if (!paidRes.ok || !paidJson.signal || !paidJson.receipt) {
        throw new Error(paidJson.error || `HTTP ${paidRes.status}`);
      }

      setUnlockedResult({
        thesis: paidJson.signal.thesis,
        claimedProbBps: paidJson.signal.claimedProbBps,
        txHash: paidJson.receipt.txHash,
        mode: paidJson.receipt.facilitatorMode,
      });
      toast.success("Signal unlocked via x402 v2", {
        description: `tx ${paidJson.receipt.txHash}`,
      });
      await refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment signing or settlement failed";
      setUnlockError(msg);
      toast.error("Signal unlock failed", { description: msg });
    } finally {
      setIsPaying(false);
    }
  };

  const handlePublishSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setIsPublishing(true);

    try {
      const roundId = Number(pubRoundId);
      const epochId = Number(pubEpochId);
      const claimedProbBps = Math.max(
        MIN_PROB_BPS,
        Math.min(MAX_PROB_BPS, Math.round(pubProbPct * 100)),
      );
      const priceAtomic = parseUnits(pubPriceUsd, 18).toString();
      const issuedAt = Math.floor(Date.now() / 1000);
      const { keccak256, toBytes } = await import("viem");
      const thesisHash = keccak256(toBytes(pubThesis.trim()));

      const signature = await signTypedDataAsync({
        domain: {
          name: "ReckonSignal",
          version: "1",
          chainId: BSC_CHAIN_ID,
          verifyingContract: coreAddress,
        },
        types: {
          SignalAttestation: [
            { name: "chainId", type: "uint256" },
            { name: "coreAddress", type: "address" },
            { name: "feedId", type: "uint8" },
            { name: "epochId", type: "uint64" },
            { name: "tierId", type: "uint8" },
            { name: "roundId", type: "uint64" },
            { name: "seller", type: "address" },
            { name: "claimedProbBps", type: "uint16" },
            { name: "thesisHash", type: "bytes32" },
            { name: "issuedAt", type: "uint64" },
          ],
        },
        primaryType: "SignalAttestation",
        message: {
          chainId: BigInt(BSC_CHAIN_ID),
          coreAddress,
          feedId: pubFeedId,
          epochId: BigInt(epochId),
          tierId: pubTierId,
          roundId: BigInt(roundId),
          seller: address,
          claimedProbBps,
          thesisHash,
          issuedAt: BigInt(issuedAt),
        },
      });

      const res = await fetch("/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: pubTitle,
          summary: pubSummary,
          thesis: pubThesis,
          priceAtomic,
          preferredToken: pubToken,
          attestation: {
            chainId: BSC_CHAIN_ID,
            coreAddress,
            feedId: pubFeedId,
            epochId,
            tierId: pubTierId,
            roundId,
            seller: address,
            claimedProbBps,
            thesisHash,
            issuedAt,
          },
          signature,
        }),
      });
      const json = (await res.json()) as { error?: string; endpointUrl?: string };
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      toast.success("Attested signal published", {
        description: json.endpointUrl,
      });
      setPubTitle("");
      setPubSummary("");
      setPubThesis("");
      setTab("feed");
      await refreshAll();
    } catch (err) {
      toast.error("Publish failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRegisterProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !isDeployedAddress(registryAddress)) return;
    const toastId = toast.loading("Registering listing on ReckonSignalRegistry…");
    try {
      const coin = findStablecoin(regToken)!;
      const priceAtomic = parseUnits(regPriceUsd, 18);
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: reckonSignalRegistryAbi,
        functionName: "registerSignal",
        args: [regUrl.trim(), priceAtomic, coin.address, regBio.trim()],
        chainId: BSC_CHAIN_ID,
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success("Provider listing updated on-chain", {
        id: toastId,
        description: `tx ${hash}`,
      });
      await refreshAll();
    } catch (err) {
      toast.error("Registration failed", {
        id: toastId,
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const cliSnippet = activeSignal
    ? `node skills/reckon/scripts/reckon-cli.mjs x402-inspect \\\n  --url ${origin}/api/signals/${activeSignal.id} --json\n# Preview options[] + needApproveFirst in baw, confirm, then:\nbaw x402-payment sign --paymentId <UUID> --selectedIndex 1 --json`
    : "";

  const handleCopyCli = async () => {
    if (!cliSnippet) return;
    await navigator.clipboard.writeText(cliSnippet);
    setCopiedCli(true);
    toast.success("Copied x402 CLI command");
    setTimeout(() => setCopiedCli(false), 1500);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="feed">
            <Broadcast size={14} weight="duotone" />
            Catalog ({signals.length})
          </TabsTrigger>
          <TabsTrigger value="providers">
            <UsersThree size={14} weight="duotone" />
            Providers ({providers.length})
          </TabsTrigger>
          <TabsTrigger value="publish">
            <PaperPlaneTilt size={14} weight="duotone" />
            Publish attestation
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Settlement</span>
          <Badge variant="default" className="rounded-md font-sans text-[11px] font-medium">
            {formatFacilitatorLabel(facilitatorMode)}
          </Badge>
        </div>
      </div>

      {/* CATALOG TAB */}
      <TabsContent value="feed" className="mt-0">
        <div className="grid items-start gap-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-7">
            {signals.length === 0 ? (
              <Card className="p-6">
                <div className="max-w-lg space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                      Awaiting verified forecaster attestations
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Forecasters scoring{" "}
                      <span className="font-mono font-medium text-foreground">≥ 0.7600 Brier</span>{" "}
                      across <span className="font-mono font-medium text-foreground">≥ 3</span> distinct competitive 4-hour epochs can publish EIP-712 attested theses during active{" "}
                      <span className="font-mono font-medium text-foreground">LOCKED</span> rounds for direct peer-to-peer x402 v2 settlement.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="default">
                      <Link href="/">
                        Build track record
                        <ArrowRight size={13} />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/security">Review x402 security</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              signals.map((sig) => {
                const isSelected = activeSignal?.id === sig.id;
                return (
                  <Card
                    key={sig.id}
                    className={`p-4 transition-[border-color,background-color] duration-150 ${
                      isSelected ? "border-foreground/45 bg-accent/55" : "hover:border-border-strong"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                          <span className="font-semibold text-foreground">
                            {sig.handle ? `${sig.handle}.ai` : `${sig.seller.slice(0, 8)}…`}
                          </span>
                          <span className="text-border-strong">·</span>
                          <span className="font-medium tabular-nums text-foreground/85">
                            {formatBrierScore(sig.meanBrier)} ({sig.bssPct >= 0 ? "+" : ""}
                            {sig.bssPct.toFixed(1)}% BSS)
                          </span>
                          <span className="text-border-strong">·</span>
                          <span className="text-muted-foreground">
                            {sig.feedSymbol} · Round #{sig.roundId}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold tracking-tight text-foreground">
                          {sig.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {sig.summary}
                        </p>
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <div className="text-sm font-semibold text-foreground">
                          ${formatAtomicUsd(sig.priceAtomic)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {sig.preferredTokenSymbol}
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <Badge variant={integrityVariant(sig.integrity.status)}>
                            {sig.integrity.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {sig.claimedProbRedacted ? (
                          <span>Probability sealed until resolveTime</span>
                        ) : (
                          <span>
                            Claimed {(Number(sig.claimedProbBps ?? 0) / 100).toFixed(2)}%
                            {sig.integrity.onChainRevealedProbBps !== null &&
                              ` · On-chain ${(
                                sig.integrity.onChainRevealedProbBps / 100
                              ).toFixed(2)}%`}
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="xs"
                        variant={isSelected ? "default" : "secondary"}
                        onClick={() => openUnlockDrawer(sig)}
                      >
                        <LockKeyOpen size={13} />
                        Inspect / Unlock
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Right: Sticky x402 Settlement Inspector */}
          <div className="min-w-0 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            {activeSignal ? (
              <Card className="surface-elevated">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="default">HTTP 402 · x402 v2</Badge>
                    <Badge variant={integrityVariant(activeSignal.integrity.status)}>
                      {activeSignal.integrity.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">{activeSignal.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 font-mono text-[11px]">
                    <ShieldCheck size={13} className="shrink-0 text-foreground/75" />
                    <span className="truncate">payTo: {activeSignal.seller}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {unlockedResult ? (
                    <div className="space-y-3 rounded-lg border border-border-strong bg-secondary/55 p-3.5 text-xs">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          <CheckCircle size={13} weight="fill" />
                          Unlocked ({unlockedResult.mode})
                        </span>
                        <span className="font-semibold text-foreground">
                          {(unlockedResult.claimedProbBps / 100).toFixed(2)}%
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-foreground/95">
                        {unlockedResult.thesis}
                      </p>
                      <div className="border-t border-border pt-2 font-mono text-[10px] break-all text-muted-foreground">
                        Settlement tx: {unlockedResult.txHash}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-foreground">
                          BSC settlement stablecoin
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {BSC_STABLECOINS.map((c) => {
                            const selected = paymentTokenSymbol === c.symbol;
                            return (
                              <button
                                key={c.symbol}
                                type="button"
                                onClick={() => setPaymentTokenSymbol(c.symbol)}
                                className={`pressable rounded-md border px-3 py-2 text-left ${
                                  selected
                                    ? "border-border-strong bg-accent text-foreground"
                                    : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground"
                                }`}
                              >
                                <div className="font-mono text-xs font-semibold text-foreground">
                                  {c.symbol}
                                </div>
                                <div className="mt-0.5 text-[10px] text-muted-foreground">
                                  {c.assetTransferMethod === "eip3009"
                                    ? "EIP-3009 · 0 approvals"
                                    : "Permit2 · 1st-time approve"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {unlockError && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                          <WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />
                          <span>{unlockError}</span>
                        </div>
                      )}

                      {!isConnected ? (
                        <Button
                          type="button"
                          size="lg"
                          variant="default"
                          onClick={() => openConnectModal?.()}
                          className="w-full"
                        >
                          Connect wallet to unlock
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="lg"
                          variant="default"
                          disabled={isPaying || !paymentChallenge}
                          onClick={handleBrowserX402Pay}
                          className="w-full"
                        >
                          {isPaying
                            ? "Signing & settling…"
                            : `Pay $${formatAtomicUsd(activeSignal.priceAtomic)} ${paymentTokenSymbol}`}
                        </Button>
                      )}

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <TerminalWindow size={13} className="text-foreground/75" />
                            Unlock via <code className="font-mono text-foreground">baw</code> CLI
                          </span>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={handleCopyCli}
                            className="h-6 px-2 text-[11px]"
                          >
                            {copiedCli ? (
                              <>
                                <Check size={12} className="text-foreground" />
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
                        <pre className="overflow-x-auto rounded-md border border-border bg-background p-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {cliSnippet}
                        </pre>
                      </div>
                    </>
                  )}
                  <p className="border-t border-black/[0.06] pt-3 text-[11px] leading-relaxed text-muted-foreground">
                    Signal purchases do not ensure accuracy or profit. Smart contract &amp; oracle risks apply; not financial advice — DYOR.{" "}
                    <Link
                      href="/security"
                      className="font-medium text-foreground/80 underline decoration-black/20 underline-offset-2 hover:text-foreground"
                    >
                      Risk model
                    </Link>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="space-y-4 p-6">
                <div className="space-y-1.5">
                  <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                    x402 Settlement Inspector
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Select any signal listing on the left to inspect its HTTP 402 payment challenge, verify direct peer-to-peer recipient settlement, and unlock via EVM wallet or{" "}
                    <code className="font-mono text-foreground">baw</code> CLI.
                  </p>
                </div>
                <p className="border-t border-black/[0.06] pt-3.5 text-[11px] leading-relaxed text-muted-foreground">
                  Signal purchases do not ensure accuracy or profit. Smart contract &amp; oracle risks apply; not financial advice — always DYOR.{" "}
                  <Link
                    href="/security"
                    className="font-medium text-foreground/80 underline decoration-black/20 underline-offset-2 hover:text-foreground"
                  >
                    Security &amp; risks
                  </Link>
                </p>
              </Card>
            )}
          </div>
        </div>
      </TabsContent>

      {/* PROVIDERS TAB */}
      <TabsContent value="providers" className="mt-0">
        <div className="grid items-start gap-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-7">
            {providers.length === 0 ? (
              <Card className="p-6">
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                    No on-chain signal providers registered yet
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Once an Agent ID earns Verified status on{" "}
                    <span className="font-mono text-foreground">ReckonCore</span>, register an HTTPS x402 endpoint on{" "}
                    <span className="font-mono text-foreground">ReckonSignalRegistry</span> using the form on the right.
                  </p>
                </div>
              </Card>
            ) : (
              providers.map((p) => (
                <Card key={p.agent} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {p.handle}.ai
                    </span>
                    <Badge variant={p.listingActive ? "positive" : "secondary"}>
                      {p.listingActive ? "ACTIVE VERIFIED" : "INACTIVE"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                    <span>
                      Brier <strong className="text-foreground">{formatBrierScore(p.meanBrier)}</strong>
                    </span>
                    <span>Reveal {(p.revealRateBps / 100).toFixed(1)}%</span>
                    <span>Epochs {p.competitiveRoundsScored}</span>
                    <span>Price ${formatAtomicUsd(p.priceAtomic)}</span>
                  </div>
                </Card>
              ))
            )}
          </div>

          <Card className="lg:col-span-5">
            <CardHeader className="border-b border-black/[0.06] pb-4">
              <CardTitle>Register provider listing</CardTitle>
              <CardDescription>
                Verified Forecaster status is enforced live on-chain via ReckonCore.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleRegisterProvider} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="reg-url" className="block text-xs font-medium text-foreground/90">
                    HTTPS signal endpoint
                  </label>
                  <Input
                    id="reg-url"
                    type="url"
                    required
                    value={regUrl}
                    onChange={(e) => setRegUrl(e.target.value)}
                    placeholder="https://your-host/api/signals"
                    className="font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="reg-price" className="block text-xs font-medium text-foreground/90">
                      Price (USD)
                    </label>
                    <Input
                      id="reg-price"
                      type="text"
                      required
                      value={regPriceUsd}
                      onChange={(e) => setRegPriceUsd(e.target.value)}
                      placeholder="0.50"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground/90">
                      Preferred token
                    </label>
                    <Select
                      value={regToken}
                      onValueChange={(v) => setRegToken(v as typeof regToken)}
                    >
                      <SelectTrigger className="w-full font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BSC_STABLECOINS.map((c) => (
                          <SelectItem key={c.symbol} value={c.symbol} className="font-mono text-xs">
                            {c.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reg-bio" className="block text-xs font-medium text-foreground/90">
                    Methodology bio (max 280 chars)
                  </label>
                  <Textarea
                    id="reg-bio"
                    rows={3}
                    required
                    maxLength={280}
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder="Describe your forecasting methodology and data inputs…"
                  />
                </div>

                {!isConnected ? (
                  <Button
                    type="button"
                    size="default"
                    variant="default"
                    onClick={() => openConnectModal?.()}
                    className="w-full"
                  >
                    Connect wallet to register
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="default"
                    variant="default"
                    disabled={!isVerified || isWriting}
                    className="w-full"
                  >
                    {isVerified ? "Register on-chain" : "Requires Verified Forecaster status"}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* PUBLISH TAB */}
      <TabsContent value="publish" className="mt-0">
        <div className="grid items-start gap-8 lg:grid-cols-12">
          <Card className="min-w-0 lg:col-span-7">
            <CardHeader className="border-b border-black/[0.06] pb-4">
              <CardTitle>Publish attested signal</CardTitle>
              <CardDescription>
                Sign an EIP-712 attestation for an active{" "}
                <span className="font-mono text-foreground">LOCKED</span> round. Claimed probability is audited automatically against your on-chain reveal.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5">
              <form onSubmit={handlePublishSignal} className="space-y-5">
                {isConnected && (
                  <div className="surface-well space-y-2 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        Active LOCKED rounds ({lockedAgentRounds.length})
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Auto-fills coordinates &amp; local salt
                      </span>
                    </div>
                    {lockedAgentRounds.length === 0 ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        No active <span className="font-mono text-foreground">LOCKED</span> commitments detected for this wallet. Commit during any 4-hour{" "}
                        <span className="font-mono text-foreground">OPEN</span> window, or enter coordinates below.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {lockedAgentRounds.map((r) => {
                          const active = String(r.roundId) === pubRoundId;
                          return (
                            <Button
                              key={r.roundId}
                              type="button"
                              size="xs"
                              variant={active ? "default" : "outline"}
                              onClick={() => applyLockedRoundSelection(r)}
                              className="font-mono"
                            >
                              Round #{r.roundId} · {r.feedSymbol} · {r.stakeBnb} BNB
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <label htmlFor="pub-round" className="block text-xs font-medium text-foreground/90">
                      Round ID
                    </label>
                    <Input
                      id="pub-round"
                      type="number"
                      required
                      value={pubRoundId}
                      onChange={(e) => setPubRoundId(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="pub-epoch" className="block text-xs font-medium text-foreground/90">
                      Epoch ID
                    </label>
                    <Input
                      id="pub-epoch"
                      type="number"
                      required
                      value={pubEpochId}
                      onChange={(e) => setPubEpochId(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground/90">Feed</label>
                    <Select
                      value={String(pubFeedId)}
                      onValueChange={(v) => setPubFeedId(Number(v))}
                    >
                      <SelectTrigger className="w-full font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEEDS.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)} className="font-mono text-xs">
                            {f.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-foreground/90">Stake tier</label>
                    <Select
                      value={String(pubTierId)}
                      onValueChange={(v) => setPubTierId(Number(v))}
                    >
                      <SelectTrigger className="w-full font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0" className="font-mono text-xs">
                          0.002 BNB
                        </SelectItem>
                        <SelectItem value="1" className="font-mono text-xs">
                          0.005 BNB
                        </SelectItem>
                        <SelectItem value="2" className="font-mono text-xs">
                          0.01 BNB
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="pub-prob" className="block text-xs font-medium text-foreground/90">
                    Claimed probability (%)
                  </label>
                  <Input
                    id="pub-prob"
                    type="number"
                    min={1}
                    max={99}
                    step={0.5}
                    value={pubProbPct}
                    onChange={(e) => setPubProbPct(Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="pub-price" className="block text-xs font-medium text-foreground/90">
                    Price (USD, ≥ $0.10)
                  </label>
                  <Input
                    id="pub-price"
                    type="text"
                    required
                    value={pubPriceUsd}
                    onChange={(e) => setPubPriceUsd(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground/90">
                    Preferred token
                  </label>
                  <Select
                    value={pubToken}
                    onValueChange={(v) => setPubToken(v as typeof pubToken)}
                  >
                    <SelectTrigger className="w-full font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BSC_STABLECOINS.map((c) => (
                        <SelectItem key={c.symbol} value={c.symbol} className="font-mono text-xs">
                          {c.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pub-title" className="block text-xs font-medium text-foreground/90">
                  Headline
                </label>
                <Input
                  id="pub-title"
                  type="text"
                  required
                  minLength={4}
                  maxLength={120}
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="e.g. BNB 4H orderbook skew & basis regime"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pub-summary" className="block text-xs font-medium text-foreground/90">
                  Public preview summary
                </label>
                <Input
                  id="pub-summary"
                  type="text"
                  maxLength={280}
                  value={pubSummary}
                  onChange={(e) => setPubSummary(e.target.value)}
                  placeholder="Visible before payment — do not leak your sealed probability"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="pub-thesis" className="block text-xs font-medium text-foreground/90">
                  Full thesis (AES-256-GCM encrypted at rest)
                </label>
                <Textarea
                  id="pub-thesis"
                  rows={4}
                  required
                  minLength={20}
                  maxLength={4000}
                  value={pubThesis}
                  onChange={(e) => setPubThesis(e.target.value)}
                  placeholder="Detailed probabilistic thesis unlocked only after verified x402 settlement…"
                />
              </div>

                {!isConnected ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="default"
                    onClick={() => openConnectModal?.()}
                    className="w-full"
                  >
                    Connect wallet to publish
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    variant="default"
                    disabled={!isVerified || isPublishing}
                    className="w-full"
                  >
                    {isPublishing
                      ? "Signing EIP-712 attestation…"
                      : isVerified
                        ? "Sign EIP-712 attestation & publish"
                        : "Requires Verified Forecaster status"}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Right: Consistent 5-col Eligibility & Settlement Guide (zero layout jump) */}
          <Card className="min-w-0 lg:sticky lg:top-24 lg:col-span-5">
            <CardHeader className="border-b border-black/[0.06] pb-4">
              <CardTitle>Publishing eligibility</CardTitle>
              <CardDescription>
                Live on-chain requirements verified before listing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 text-xs">
              <div className="divide-y divide-black/[0.06]">
                <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="text-muted-foreground">Wallet connected</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-foreground">
                    {isConnected ? (
                      <>
                        <CheckCircle size={13} weight="fill" />
                        Ready
                      </>
                    ) : (
                      <span className="text-muted-foreground">Required</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-muted-foreground">Verified Forecaster (≥ 0.7600)</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-foreground">
                    {isVerified ? (
                      <>
                        <CheckCircle size={13} weight="fill" />
                        Verified
                      </>
                    ) : (
                      <span className="text-muted-foreground">Pending track record</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5 last:pb-0">
                  <span className="text-muted-foreground">Active LOCKED commitment</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-foreground">
                    {lockedAgentRounds.length > 0 ? (
                      <>
                        <CheckCircle size={13} weight="fill" />
                        {lockedAgentRounds.length} active
                      </>
                    ) : (
                      <span className="text-muted-foreground">None detected</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="surface-well space-y-1.5 rounded-xl p-4 text-[11px] leading-relaxed text-muted-foreground">
                <div className="font-medium text-foreground">Anti-bluffing audit</div>
                <p>
                  Your signed probability stays redacted while the round is{" "}
                  <span className="font-mono text-foreground">LOCKED</span> and is automatically audited against your on-chain reveal after settlement.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
