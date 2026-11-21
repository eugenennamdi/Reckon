"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Copy,
  Info,
  Key,
  Lightning,
  LockSimple,
  Robot,
  Scales,
  TerminalWindow,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { encodeFunctionData, formatEther, getAddress, isAddress, type Address, type Hex } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { agentIdAbi, reckonCoreAbi } from "@/lib/abi";
import type { LiveFeedPrice, RoundSnapshot } from "@/lib/reckon/chain";
import {
  encodeRecoveryToken,
  epochTiming,
  formatUsdPrice8,
  type SaltRecoveryRecord,
} from "@/lib/reckon/commitment";
import {
  AGENT_ID_ADDRESS,
  BSC_CHAIN_ID,
  EPOCH_DURATION,
  FEEDS,
  MAX_PROB_BPS,
  MIN_PROB_BPS,
  STAKE_TIERS,
  type RoundStateName,
} from "@/lib/reckon/constants";
import {
  createSaltRecord,
  findSaltForSlot,
  importRecoveryInput,
  saveSaltRecord,
} from "@/lib/salts-browser";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AssetIcon } from "./AssetIcon";
import { BawCommandDrawer } from "./BawCommandDrawer";
import { SaltRecoveryModal } from "./SaltRecoveryModal";

interface RoundsApiResponse {
  serverTime: number;
  currentEpochId: number;
  anchorEpochId?: number;
  coreAddress: Address;
  registryAddress: Address;
  deployed: boolean;
  prices: LiveFeedPrice[];
  rounds: RoundSnapshot[];
  pendingRounds?: RoundSnapshot[];
}

interface BracketResponse {
  roundId: number;
  strikeFixed: boolean;
  oracleSettled: boolean;
  strikeBracket: { roundId: string; nextRoundId: string; price8?: string } | null;
  resolveBracket: { roundId: string; nextRoundId: string; price8?: string } | null;
  functionName?: "fixStrike" | "fixAndSettleOracle" | "settleOracle" | null;
  calldata?: Hex | null;
}

const PROB_PRESETS = [15, 35, 50, 65, 85] as const;

const FEED_SUBTITLES: Record<string, string> = {
  "BNB/USD": "BNB Chain · Chainlink Oracle",
  "BTC/USD": "Bitcoin · Chainlink Oracle",
  "ETH/USD": "Ethereum · Chainlink Oracle",
};

function stateBadgeVariant(state: RoundStateName): BadgeProps["variant"] {
  switch (state) {
    case "OPEN":
    case "CLAIMABLE":
      return "positive";
    case "LOCKED":
    case "AWAITING_ORACLE":
      return "warning";
    case "REVEAL":
      return "info";
    case "CANCELLED_ORACLE":
      return "destructive";
    default:
      return "secondary";
  }
}

function PhaseIndicator({ state }: { state: RoundStateName }) {
  if (state === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
        OPEN
      </span>
    );
  }
  if (state === "CLAIMABLE") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-foreground">
        <span className="h-1.5 w-1.5 rotate-45 bg-foreground" />
        CLAIMABLE
      </span>
    );
  }
  if (state === "CANCELLED_ORACLE") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        CANCELLED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <span
        className={`h-1.5 w-1.5 rounded-full border ${
          state === "REVEAL"
            ? "border-foreground/70 bg-foreground/25"
            : "border-muted-foreground/60 bg-transparent"
        }`}
      />
      {state === "AWAITING_ORACLE" ? "AWAITING" : state}
    </span>
  );
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function computeBrierNumeric(probBps: number, outcome: 0 | 1): number {
  const y = outcome === 1 ? 10_000 : 0;
  const diff = probBps - y;
  return (100_000_000 - diff * diff) / 100_000_000;
}

/** Isolated 1-second ticking clock so parent RoundsTerminal never re-renders on timer ticks. */
function EpochClockCard({
  currentEpochId,
  serverTime,
}: {
  currentEpochId: number;
  serverTime: number;
}) {
  const [nowSec, setNowSec] = useState(serverTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timing = useMemo(() => epochTiming(currentEpochId), [currentEpochId]);
  const nextBoundary = (currentEpochId + 1) * EPOCH_DURATION;
  const remaining = Math.max(0, Math.min(timing.commitEnd, nextBoundary) - nowSec);
  const elapsedPct =
    (Math.max(0, Math.min(EPOCH_DURATION, EPOCH_DURATION - remaining)) / EPOCH_DURATION) * 100;

  return (
    <div className="surface-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Active UTC Window
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
              Epoch #{currentEpochId}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              OPEN
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Commit closes
          </div>
          <div className="mt-0.5 font-mono text-2xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
            {formatCountdown(remaining)}
          </div>
        </div>
      </div>

      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-black/[0.07]">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out"
          style={{ width: `${elapsedPct.toFixed(1)}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-black/[0.06] pt-3.5 font-mono">
        {[
          { epoch: currentEpochId, phase: "OPEN", active: true },
          { epoch: currentEpochId - 1, phase: "LOCKED", active: false },
          { epoch: currentEpochId - 2, phase: "REVEAL", active: false },
          { epoch: currentEpochId - 3, phase: "CLAIM", active: false },
        ].map((step) => (
          <div key={step.epoch} className="min-w-0">
            <div
              className={`truncate text-[10px] tabular-nums ${
                step.active ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              #{step.epoch}
            </div>
            <div
              className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                step.active ? "font-medium text-foreground" : "text-muted-foreground/75"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  step.active
                    ? "bg-foreground"
                    : step.phase === "CLAIM"
                      ? "border border-muted-foreground/50 bg-transparent"
                      : "bg-foreground/30"
                }`}
              />
              <span className="truncate">{step.phase}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoundsTerminal({ initialData }: { initialData: RoundsApiResponse }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient({ chainId: BSC_CHAIN_ID });
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [data, setData] = useState<RoundsApiResponse>(initialData);
  const [viewMode, setViewMode] = useState<"markets" | "ledger">("markets");
  const [beforeEpoch, setBeforeEpoch] = useState<number | null>(null);
  const [feedFilter, setFeedFilter] = useState<number | "all">("all");
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const first = initialData.rounds[0];
    return first ? `${first.epochId}:${first.feedId}:${first.tierId}` : "";
  });

  const [probPct, setProbPct] = useState<number>(65);
  const [execMode, setExecMode] = useState<"baw" | "browser">("baw");
  const [agentWalletInput, setAgentWalletInput] = useState<string>("");
  const [generatedBawBundle, setGeneratedBawBundle] = useState<{
    slotKey: string;
    agent: Address;
    probBps: number;
    recoveryToken: string;
    previewCommand: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pendingSaltRecord, setPendingSaltRecord] = useState<SaltRecoveryRecord | null>(null);
  const [manualRevealToken, setManualRevealToken] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [saltRefreshTick, setSaltRefreshTick] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("reckon:agentic-wallet-address");
      if (saved && isAddress(saved)) setAgentWalletInput(saved);
    } catch {
      // ignore storage errors
    }
  }, []);

  const parsedBawAddress: Address | undefined = useMemo(() => {
    const trimmed = agentWalletInput.trim();
    if (!isAddress(trimmed)) return undefined;
    try {
      return getAddress(trimmed);
    } catch {
      return undefined;
    }
  }, [agentWalletInput]);

  const { data: agentIdBalance } = useReadContract({
    address: AGENT_ID_ADDRESS,
    abi: agentIdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const hasAgentId = typeof agentIdBalance === "bigint" && agentIdBalance > 0n;

  const { data: bawAgentIdBalance } = useReadContract({
    address: AGENT_ID_ADDRESS,
    abi: agentIdAbi,
    functionName: "balanceOf",
    args: parsedBawAddress ? [parsedBawAddress] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(parsedBawAddress) },
  });
  const { data: bawAgentHandleRaw } = useReadContract({
    address: AGENT_ID_ADDRESS,
    abi: agentIdAbi,
    functionName: "handleOf",
    args: parsedBawAddress ? [parsedBawAddress] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(parsedBawAddress) },
  });
  const bawHasAgentId =
    typeof bawAgentIdBalance === "bigint" &&
    bawAgentIdBalance > 0n &&
    typeof bawAgentHandleRaw === "string" &&
    bawAgentHandleRaw.length > 0;
  const bawAgentHandle = typeof bawAgentHandleRaw === "string" ? bawAgentHandleRaw : "";

  useEffect(() => {
    if (isConnected && hasAgentId) {
      setExecMode("browser");
    }
  }, [isConnected, hasAgentId]);

  const activeQueryAgent = address ?? parsedBawAddress;

  const refreshRounds = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ epochs: "4" });
      if (activeQueryAgent) qs.set("agent", activeQueryAgent);
      if (beforeEpoch !== null) qs.set("beforeEpoch", String(beforeEpoch));
      const res = await fetch(`/api/rounds?${qs.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as RoundsApiResponse;
        setData(next);
      }
    } catch {
      // ignore transient network errors on background poll
    }
  }, [activeQueryAgent, beforeEpoch]);

  useEffect(() => {
    // Skip redundant immediate fetch on initial SSR hydration unless wallet or epoch page changed
    if (activeQueryAgent || beforeEpoch !== null) {
      void refreshRounds();
    }
    const poll = setInterval(refreshRounds, 15_000);
    return () => clearInterval(poll);
  }, [activeQueryAgent, beforeEpoch, refreshRounds]);

  const pendingRounds = useMemo(() => data.pendingRounds ?? [], [data.pendingRounds]);

  // Live current-epoch rounds grouped by the 3 Chainlink feeds
  const activeFeedGroups = useMemo(() => {
    return FEEDS.map((feed) => {
      const price = data.prices.find((p) => p.feedId === feed.id);
      const tiers = STAKE_TIERS.map((tier) => {
        const round = data.rounds.find(
          (r) =>
            r.epochId === data.currentEpochId &&
            r.feedId === feed.id &&
            r.tierId === tier.id,
        );
        return { tier, round };
      });
      const totalCommits = tiers.reduce((acc, t) => acc + (t.round?.committedCount ?? 0), 0);
      return { feed, price, tiers, totalCommits };
    });
  }, [data.prices, data.rounds, data.currentEpochId]);

  const ledgerRounds = useMemo(
    () =>
      data.rounds.filter((r) => {
        if (feedFilter !== "all" && r.feedId !== feedFilter) return false;
        return true;
      }),
    [data.rounds, feedFilter],
  );

  const selectedRound = useMemo(() => {
    return (
      data.rounds.find((r) => `${r.epochId}:${r.feedId}:${r.tierId}` === selectedKey) ??
      pendingRounds.find((r) => `${r.epochId}:${r.feedId}:${r.tierId}` === selectedKey) ??
      data.rounds[0]
    );
  }, [data.rounds, pendingRounds, selectedKey]);

  const selectedFeedPrice = useMemo(() => {
    if (!selectedRound) return null;
    return data.prices.find((p) => p.feedId === selectedRound.feedId) ?? null;
  }, [data.prices, selectedRound]);

  const savedSalt = useMemo(() => {
    if (!selectedRound || !activeQueryAgent) return null;
    void saltRefreshTick;
    return findSaltForSlot({
      agent: activeQueryAgent,
      coreAddress: data.coreAddress,
      feedId: selectedRound.feedId,
      epochId: selectedRound.epochId,
      tierId: selectedRound.tierId,
      commitment: selectedRound.agentEntry?.commitment,
    });
  }, [selectedRound, activeQueryAgent, data.coreAddress, saltRefreshTick]);

  const probBps = Math.max(
    MIN_PROB_BPS,
    Math.min(MAX_PROB_BPS, Math.round(probPct * 100)),
  );
  const brierIfYes = computeBrierNumeric(probBps, 1);
  const brierIfNo = computeBrierNumeric(probBps, 0);

  const waitAndRefresh = async (hash: Hex, successMsg: string) => {
    const toastId = toast.loading("Awaiting BSC finality…", {
      description: `tx ${hash.slice(0, 14)}…${hash.slice(-6)}`,
    });
    try {
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      toast.success(successMsg, {
        id: toastId,
        description: `tx ${hash}`,
      });
      await refreshRounds();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transaction confirmation failed", {
        id: toastId,
      });
    }
  };

  const handleOpenCommitModal = () => {
    if (!selectedRound || !address) return;
    if (!data.deployed) {
      toast.error("ReckonCore mainnet deployment is pending sync");
      return;
    }
    const record = createSaltRecord({
      chainId: BSC_CHAIN_ID,
      coreAddress: data.coreAddress,
      agent: address,
      feedId: selectedRound.feedId,
      epochId: selectedRound.epochId,
      tierId: selectedRound.tierId,
      roundId: selectedRound.roundId,
      probBps,
    });
    saveSaltRecord(record);
    setSaltRefreshTick((t) => t + 1);
    setPendingSaltRecord(record);
  };

  const handleExecuteCommit = async () => {
    if (!pendingSaltRecord || !selectedRound) return;
    try {
      const hash = await writeContractAsync({
        address: data.coreAddress,
        abi: reckonCoreAbi,
        functionName: "commitEpoch",
        args: [
          pendingSaltRecord.feedId,
          BigInt(pendingSaltRecord.epochId),
          pendingSaltRecord.tierId,
          pendingSaltRecord.commitment,
        ],
        value: BigInt(selectedRound.stakeWei),
        chainId: BSC_CHAIN_ID,
      });
      setPendingSaltRecord(null);
      await waitAndRefresh(hash, "Forecast committed on-chain");
    } catch (err) {
      toast.error("Commit rejected or failed", {
        description: err instanceof Error ? err.message : "Unknown wallet error",
      });
    }
  };

  const handleReveal = async () => {
    if (!selectedRound || !address) return;
    let record = savedSalt;
    if (!record && manualRevealToken.trim()) {
      try {
        record = importRecoveryInput(manualRevealToken);
        setSaltRefreshTick((t) => t + 1);
      } catch (err) {
        toast.error("Invalid recovery token", {
          description: err instanceof Error ? err.message : "Check RKN1 format",
        });
        return;
      }
    }
    if (!record) {
      toast.error("No local salt found for this slot", {
        description: "Paste your RKN1 recovery string or import a JSON backup.",
      });
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: data.coreAddress,
        abi: reckonCoreAbi,
        functionName: "reveal",
        args: [BigInt(selectedRound.roundId), record.probBps, record.salt],
        chainId: BSC_CHAIN_ID,
      });
      await waitAndRefresh(hash, "Forecast revealed on-chain");
    } catch (err) {
      toast.error("Reveal failed", {
        description: err instanceof Error ? err.message : "Transaction reverted",
      });
    }
  };

  const handlePermissionlessSettle = async (round: RoundSnapshot) => {
    const toastId = toast.loading("Resolving Chainlink historical round bracket…");
    try {
      const res = await fetch(`/api/rounds?bracketForRoundId=${round.roundId}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const bracket = (await res.json()) as BracketResponse;
      toast.dismiss(toastId);

      let hash: Hex;
      if (round.state === "LOCKED" && !round.strikeFixed && bracket.strikeBracket) {
        hash = await writeContractAsync({
          address: data.coreAddress,
          abi: reckonCoreAbi,
          functionName: "fixStrike",
          args: [
            BigInt(round.roundId),
            BigInt(bracket.strikeBracket.roundId),
            BigInt(bracket.strikeBracket.nextRoundId),
          ],
          chainId: BSC_CHAIN_ID,
        });
        await waitAndRefresh(hash, "Forward-start ATM strike fixed");
      } else if (!round.strikeFixed && bracket.strikeBracket && bracket.resolveBracket) {
        hash = await writeContractAsync({
          address: data.coreAddress,
          abi: reckonCoreAbi,
          functionName: "fixAndSettleOracle",
          args: [
            BigInt(round.roundId),
            BigInt(bracket.strikeBracket.roundId),
            BigInt(bracket.strikeBracket.nextRoundId),
            BigInt(bracket.resolveBracket.roundId),
            BigInt(bracket.resolveBracket.nextRoundId),
          ],
          chainId: BSC_CHAIN_ID,
        });
        await waitAndRefresh(hash, "Strike fixed and oracle settled");
      } else if (round.strikeFixed && bracket.resolveBracket) {
        hash = await writeContractAsync({
          address: data.coreAddress,
          abi: reckonCoreAbi,
          functionName: "settleOracle",
          args: [
            BigInt(round.roundId),
            BigInt(bracket.resolveBracket.roundId),
            BigInt(bracket.resolveBracket.nextRoundId),
          ],
          chainId: BSC_CHAIN_ID,
        });
        await waitAndRefresh(hash, "Oracle settled");
      } else {
        throw new Error("Required Chainlink round bracket is not yet available");
      }
    } catch (err) {
      toast.error("Oracle settlement failed", {
        id: toastId,
        description: err instanceof Error ? err.message : "Could not settle round",
      });
    }
  };

  const handleClaim = async (round: RoundSnapshot, refund: boolean) => {
    try {
      const hash = await writeContractAsync({
        address: data.coreAddress,
        abi: reckonCoreAbi,
        functionName: refund ? "claimRefund" : "claim",
        args: [BigInt(round.roundId)],
        chainId: BSC_CHAIN_ID,
      });
      await waitAndRefresh(
        hash,
        refund ? "100% stake refund claimed" : "Lambert WSWM payout claimed",
      );
    } catch (err) {
      toast.error("Claim failed", {
        description: err instanceof Error ? err.message : "Transaction reverted",
      });
    }
  };

  const handleImportSubmit = () => {
    try {
      const rec = importRecoveryInput(importInput);
      setSaltRefreshTick((t) => t + 1);
      setImportOpen(false);
      setImportInput("");
      toast.success("Salt backup restored", {
        description: `Epoch #${rec.epochId} · ${FEEDS[rec.feedId]?.symbol ?? "Feed"} · ${(
          rec.probBps / 100
        ).toFixed(2)}%`,
      });
    } catch (err) {
      toast.error("Failed to parse salt backup", {
        description: err instanceof Error ? err.message : "Invalid JSON or RKN1 token",
      });
    }
  };

  const handleCopyText = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      toast.success("Copied to clipboard", { description: label });
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const handleAgentWalletChange = (val: string) => {
    setAgentWalletInput(val);
    setGeneratedBawBundle(null);
    const trimmed = val.trim();
    if (isAddress(trimmed)) {
      try {
        window.localStorage.setItem("reckon:agentic-wallet-address", getAddress(trimmed));
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleGenerateBawCommit = () => {
    if (!selectedRound || !parsedBawAddress) return;
    if (!data.deployed) {
      toast.error("ReckonCore mainnet deployment is pending sync");
      return;
    }
    const record = createSaltRecord({
      chainId: BSC_CHAIN_ID,
      coreAddress: data.coreAddress,
      agent: parsedBawAddress,
      feedId: selectedRound.feedId,
      epochId: selectedRound.epochId,
      tierId: selectedRound.tierId,
      roundId: selectedRound.roundId,
      probBps,
    });
    saveSaltRecord(record);
    setSaltRefreshTick((t) => t + 1);
    const inputData = encodeFunctionData({
      abi: reckonCoreAbi,
      functionName: "commitEpoch",
      args: [record.feedId, BigInt(record.epochId), record.tierId, record.commitment],
    });
    const previewCommand = `baw contract-call preview --binanceChainId ${BSC_CHAIN_ID} --from ${parsedBawAddress} --to ${data.coreAddress} --value ${selectedRound.stakeWei} --inputData ${inputData} --json`;
    setGeneratedBawBundle({
      slotKey: `${selectedRound.epochId}:${selectedRound.feedId}:${selectedRound.tierId}`,
      agent: parsedBawAddress,
      probBps,
      recoveryToken: encodeRecoveryToken(record),
      previewCommand,
    });
    toast.success("Local salt saved & baw preview ready", {
      description: "Back up the RKN1 token before executing in baw.",
    });
  };

  const handleCopyAgentPrompt = async () => {
    if (!selectedRound) return;
    const appOrigin =
      typeof window !== "undefined" ? window.location.origin : "https://reckon.markets";
    const prompt = [
      `Use Reckon (skill: \`npx skills add eugenennamdi/Reckon --skill reckon\` or MCP: ${appOrigin}/api/mcp) with my Binance Agentic Wallet (\`baw\`).`,
      `1. Run preflight (\`baw wallet status\`, \`baw wallet address\`, \`baw wallet agent-id\`, \`baw wallet settings\`).`,
      `2. Forecast ${probPct.toFixed(1)}% (${probBps} bps) on ${selectedRound.feedSymbol} Epoch #${selectedRound.epochId} (${selectedRound.tierLabel}, ${selectedRound.stakeBnb} BNB).`,
      `3. Persist the commit salt locally before signing, run \`baw contract-call preview\`, show me the parsed calldata, value, allowanceChanges, and risks, and WAIT for my explicit confirmation before running \`baw contract-call execute\`.`,
    ].join("\n");
    await handleCopyText("agent-prompt", prompt, "AI Agent prompt (OpenClaw / Claude / Cursor)");
  };

  const bawCommands = useMemo(() => {
    if (!selectedRound) return [];
    const agentPlaceholder = parsedBawAddress ?? address ?? "<YOUR_AGENT_WALLET>";
    const corePlaceholder = data.deployed ? data.coreAddress : "<RECKON_CORE_ADDRESS>";
    const appOrigin =
      typeof window !== "undefined" ? window.location.origin : "https://reckon.markets";
    const cmds = [
      {
        label: "1. Install skill (1-line) or connect MCP",
        command: `npx skills add eugenennamdi/Reckon --skill reckon\n# Hosted MCP (8 zero-clone tools): ${appOrigin}/api/mcp`,
      },
      {
        label: "2. Preflight check (Agent ID + Developer Mode)",
        command: "node skills/reckon/scripts/reckon-cli.mjs preflight --json",
      },
      {
        label: "3. Prepare commit & persist salt (mode 0600)",
        command: `node skills/reckon/scripts/reckon-cli.mjs prepare-commit --feed ${selectedRound.feedId} --tier ${selectedRound.tierId} --prob-bps ${probBps} --epoch ${selectedRound.epochId} --agent ${agentPlaceholder} --core ${corePlaceholder} --json`,
      },
    ];
    if (selectedRound.roundId > 0) {
      cmds.push({
        label: "4. Reveal forecast after resolveTime",
        command: `node skills/reckon/scripts/reckon-cli.mjs prepare-reveal --round-id ${selectedRound.roundId} --feed ${selectedRound.feedId} --epoch ${selectedRound.epochId} --tier ${selectedRound.tierId} --agent ${agentPlaceholder} --core ${corePlaceholder} --json`,
      });
    }
    return cmds;
  }, [selectedRound, parsedBawAddress, address, data.deployed, data.coreAddress, probBps]);

  return (
    <div className="space-y-10">
      {/* Editorial Hero + Sculptural Live Epoch Instrument */}
      <section className="grid gap-8 border-b border-black/[0.06] pb-9 lg:grid-cols-12 lg:items-center">
        <div className="space-y-3.5 lg:col-span-7">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
            Calibrated forecasting markets.
          </h1>

          <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Seal probabilistic beliefs on live Chainlink feeds, earn permanent on-chain Brier scores bound to soulbound Agent ID, and monetize verified signals via x402.
          </p>
        </div>

        {/* Right: Sculptural Live Epoch Cadence Module */}
        <div className="lg:col-span-5">
          <EpochClockCard
            currentEpochId={data.currentEpochId}
            serverTime={data.serverTime}
          />
        </div>
      </section>

      {/* Active & Unclaimed Positions Tray (only when connected & non-empty) */}
      {isConnected && pendingRounds.length > 0 && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <div className="space-y-0.5">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle size={15} weight="fill" className="text-foreground" />
                Active &amp; unclaimed positions
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Loaded directly from{" "}
                <code className="font-mono text-[11px] text-foreground">
                  ReckonCore.getPendingRounds()
                </code>{" "}
                ({pendingRounds.length} / 27 slots).
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {pendingRounds.map((pr) => {
                const pKey = `${pr.epochId}:${pr.feedId}:${pr.tierId}`;
                const isSel =
                  selectedRound &&
                  `${selectedRound.epochId}:${selectedRound.feedId}:${selectedRound.tierId}` === pKey;
                const claimable = BigInt(pr.agentEntry?.claimableWei ?? "0");
                return (
                  <button
                    key={pr.roundId}
                    type="button"
                    onClick={() => setSelectedKey(pKey)}
                    className={`pressable flex items-center justify-between rounded-xl px-3.5 py-3 text-left font-mono text-xs ${
                      isSel
                        ? "bg-foreground text-background"
                        : "surface-well text-foreground hover:bg-accent"
                    }`}
                  >
                    <div>
                      <div className="font-semibold">
                        {pr.feedSymbol} · {pr.stakeBnb} BNB
                      </div>
                      <div
                        className={`mt-0.5 text-[10px] ${
                          isSel ? "text-background/70" : "text-muted-foreground"
                        }`}
                      >
                        Epoch #{pr.epochId} · Round #{pr.roundId}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-medium uppercase">{pr.state}</span>
                      {claimable > 0n && (
                        <div className="mt-0.5 text-[10px] font-semibold tabular-nums">
                          +{Number(formatEther(claimable)).toFixed(5)} BNB
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Workspace: Full-Width Toolbar + Flush 2-Column Grid */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.045] p-1 ring-1 ring-black/[0.04]">
              <button
                type="button"
                onClick={() => {
                  setViewMode("markets");
                  setBeforeEpoch(null);
                }}
                className={`pressable rounded-full px-4 py-1.5 text-xs font-medium ${
                  viewMode === "markets"
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Live Markets (3)
              </button>
              <button
                type="button"
                onClick={() => setViewMode("ledger")}
                className={`pressable rounded-full px-4 py-1.5 text-xs font-medium ${
                  viewMode === "ledger"
                    ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Epoch Ledger
              </button>
            </div>

            {viewMode === "ledger" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex items-center gap-0.5 rounded-full bg-black/[0.045] p-0.5">
                  {[
                    { id: "all" as const, label: "All" },
                    ...FEEDS.map((f) => ({ id: f.id, label: f.symbol.split("/")[0] })),
                  ].map((f) => (
                    <button
                      key={String(f.id)}
                      type="button"
                      onClick={() => setFeedFilter(f.id)}
                      className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        feedFilter === f.id
                          ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.07)]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const anchor = beforeEpoch ?? data.currentEpochId;
                    setBeforeEpoch(Math.max(1, anchor - 4));
                  }}
                >
                  <CaretLeft size={12} />
                  Older
                </Button>
                {beforeEpoch !== null && (
                  <>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        const next = beforeEpoch + 4;
                        setBeforeEpoch(next >= data.currentEpochId ? null : next);
                      }}
                    >
                      Newer
                      <CaretRight size={12} />
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      className="rounded-full"
                      onClick={() => setBeforeEpoch(null)}
                    >
                      <ArrowCounterClockwise size={12} />
                      Live
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setImportOpen(true)}
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <UploadSimple size={13} />
            Restore salt backup
          </Button>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-12">
          {/* Left: Interactive Market Instruments / Epoch Ledger */}
          <div className="min-w-0 lg:col-span-7">

          {viewMode === "markets" ? (
            <div className="space-y-4">
              {activeFeedGroups.map(({ feed, price, tiers, totalCommits }) => {
                const isSelectedFeed =
                  selectedRound?.feedId === feed.id &&
                  selectedRound?.epochId === data.currentEpochId;
                const answer8 = price?.answer8 ?? "0";
                const updatedAt = price?.updatedAt ?? 0;

                return (
                  <div
                    key={feed.id}
                    className={`rounded-2xl p-6 transition-[border-color,box-shadow] duration-200 ${
                      isSelectedFeed
                        ? "surface-elevated ring-1 ring-black/15"
                        : "surface-card hover:border-border-strong"
                    }`}
                  >
                    {/* Instrument Header: Asset Emblem + Spot Price */}
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const defaultTier = isSelectedFeed ? selectedRound?.tierId ?? 0 : 0;
                          setSelectedKey(`${data.currentEpochId}:${feed.id}:${defaultTier}`);
                        }}
                        className="flex min-w-0 items-center gap-3.5 text-left"
                      >
                        <AssetIcon symbol={feed.symbol} size="lg" active={isSelectedFeed} />
                        <div className="min-w-0">
                          <span className="text-base font-semibold tracking-[-0.02em] text-foreground">
                            {feed.symbol}
                          </span>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {FEED_SUBTITLES[feed.symbol] ?? "Chainlink Oracle"}
                            {totalCommits > 0 && (
                              <>
                                {" · "}
                                <span className="font-mono text-[11px]">
                                  {totalCommits} {totalCommits === 1 ? "commit" : "commits"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="shrink-0 text-right">
                        <div className="font-mono text-xl font-semibold tracking-[-0.03em] tabular-nums text-foreground sm:text-2xl">
                          {answer8 !== "0" ? `$${formatUsdPrice8(answer8)}` : "—"}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {updatedAt > 0
                            ? `${Math.max(0, data.serverTime - updatedAt)}s ago`
                            : "Syncing…"}
                        </div>
                      </div>
                    </div>

                    {/* Inline 3-Tier Stake Selector — crisp recessed wells */}
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-black/[0.06] pt-4">
                      {tiers.map(({ tier, round }) => {
                        const slotKey = `${data.currentEpochId}:${feed.id}:${tier.id}`;
                        const isSelTier =
                          selectedRound &&
                          `${selectedRound.epochId}:${selectedRound.feedId}:${selectedRound.tierId}` ===
                            slotKey;
                        const committed = Boolean(round?.agentEntry?.committed);
                        const commits = round?.committedCount ?? 0;

                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => setSelectedKey(slotKey)}
                            className={`pressable rounded-xl px-3.5 py-2.5 text-left ${
                              isSelTier
                                ? "bg-foreground text-background shadow-[0_2px_6px_rgba(0,0,0,0.16)]"
                                : "surface-well text-foreground hover:bg-black/[0.065]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`text-[11px] font-medium ${
                                  isSelTier ? "text-background/75" : "text-muted-foreground"
                                }`}
                              >
                                {tier.label}
                              </span>
                              {committed ? (
                                <CheckCircle
                                  size={12}
                                  weight="fill"
                                  className={isSelTier ? "text-background" : "text-foreground"}
                                />
                              ) : commits > 0 ? (
                                <span
                                  className={`font-mono text-[10px] tabular-nums ${
                                    isSelTier ? "text-background/70" : "text-muted-foreground"
                                  }`}
                                >
                                  {commits} {commits === 1 ? "commit" : "commits"}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 font-mono text-[13px] font-semibold tabular-nums">
                              {tier.stakeBnb} BNB
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Market</TableHead>
                    <TableHead>Epoch</TableHead>
                    <TableHead>Stake</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Strike / Settle</TableHead>
                    <TableHead className="text-right">Pool</TableHead>
                    <TableHead className="text-right">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="font-mono tabular-nums">
                  {ledgerRounds.map((r) => {
                    const key = `${r.epochId}:${r.feedId}:${r.tierId}`;
                    const isSel =
                      selectedRound &&
                      `${selectedRound.epochId}:${selectedRound.feedId}:${selectedRound.tierId}` ===
                        key;
                    return (
                      <TableRow
                        key={key}
                        data-state={isSel ? "selected" : undefined}
                        onClick={() => setSelectedKey(key)}
                        className={`cursor-pointer hover:bg-secondary/70 ${
                          isSel ? "shadow-[inset_2px_0_0_var(--foreground)]" : ""
                        }`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <AssetIcon symbol={r.feedSymbol} size="sm" active={Boolean(isSel)} />
                            <div>
                              <div className="font-sans text-xs font-semibold text-foreground">
                                {r.feedSymbol}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{r.tierLabel}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground/90">#{r.epochId}</TableCell>
                        <TableCell className="text-foreground/90">{r.stakeBnb} BNB</TableCell>
                        <TableCell>
                          <PhaseIndicator state={r.state} />
                        </TableCell>
                        <TableCell className="text-foreground/90">
                          {r.strikeFixed ? (
                            `$${formatUsdPrice8(r.strikePrice8)}`
                          ) : (
                            <span className="font-sans text-[11px] text-muted-foreground">
                              ATM at close
                            </span>
                          )}
                          {r.oracleSettled && (
                            <div className="text-[10px] text-muted-foreground">
                              → ${formatUsdPrice8(r.settlePrice8)}{" "}
                              <span
                                className={
                                  r.outcome === 1
                                    ? "font-semibold text-foreground"
                                    : "text-muted-foreground"
                                }
                              >
                                ({r.outcome === 1 ? "YES" : "NO"})
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-foreground/90">
                          {r.committedCount}
                          <span className="text-muted-foreground">/{r.revealedCount}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.agentEntry?.committed ? (
                            r.agentEntry.claimed ? (
                              <span className="text-[11px] text-muted-foreground">Claimed</span>
                            ) : BigInt(r.agentEntry.claimableWei) > 0n ? (
                              <span className="text-[11px] font-semibold text-foreground">
                                +{Number(formatEther(BigInt(r.agentEntry.claimableWei))).toFixed(5)}
                              </span>
                            ) : r.agentEntry.revealed ? (
                              <span className="text-[11px] text-foreground">
                                {(r.agentEntry.probBps / 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-[11px] text-foreground/80">Committed</span>
                            )
                          ) : (
                            <span className="font-sans text-[11px] text-muted-foreground/70">
                              {isSel ? "Selected" : "Inspect"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {/* Right: Sculptural Morpho-Grade Sticky Execution Panel */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          {selectedRound && (
            <div className="surface-elevated rounded-2xl p-6">
              {/* Ticket Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AssetIcon symbol={selectedRound.feedSymbol} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                        {selectedRound.feedSymbol}
                      </h2>
                      <span className="font-mono text-xs text-muted-foreground">
                        {selectedRound.stakeBnb} BNB
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      Epoch #{selectedRound.epochId}
                      {selectedRound.roundId > 0 ? ` · Round #${selectedRound.roundId}` : ""}
                      {selectedFeedPrice?.answer8 && selectedFeedPrice.answer8 !== "0"
                        ? ` · Spot $${formatUsdPrice8(selectedFeedPrice.answer8)}`
                        : ""}
                    </div>
                  </div>
                </div>

                <Badge variant={stateBadgeVariant(selectedRound.state)} className="rounded-full px-2.5">
                  {selectedRound.state}
                </Badge>
              </div>

              {/* OPEN: Sculptural Probability Instrument */}
              {selectedRound.state === "OPEN" && (
                <div className="mt-5 space-y-5">
                  <div className="surface-well rounded-xl p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span>P(Resolve ≥ Strike)</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="About Lambert WSWM scoring"
                              className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Info size={13} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Strictly proper Lambert WSWM (EC 2008): reporting your true subjective probability uniquely maximizes expected payout.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        YES {probPct.toFixed(1)}% · NO {(100 - probPct).toFixed(1)}%
                      </span>
                    </div>

                    {/* Monumental Tabular Probability Readout */}
                    <div className="mt-2 font-mono text-[44px] leading-none font-semibold tracking-[-0.045em] tabular-nums text-foreground">
                      {probPct.toFixed(1)}
                      <span className="ml-0.5 text-2xl font-medium text-muted-foreground">%</span>
                    </div>

                    <div className="mt-5 space-y-2">
                      <Slider
                        aria-label="Forecast probability percentage"
                        min={1}
                        max={99}
                        step={0.5}
                        value={[probPct]}
                        onValueChange={(vals) => {
                          if (typeof vals[0] === "number") setProbPct(vals[0]);
                        }}
                      />
                      <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground/70">
                        <span>1%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>99%</span>
                      </div>
                    </div>

                    {/* Floating white chips on alabaster well */}
                    <div className="mt-4 grid grid-cols-5 gap-1.5">
                      {PROB_PRESETS.map((preset) => {
                        const active = Math.abs(probPct - preset) < 0.01;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setProbPct(preset)}
                            className={`pressable rounded-lg py-1.5 font-mono text-[11px] font-medium tabular-nums ${
                              active
                                ? "bg-foreground text-background shadow-[0_1px_3px_rgba(0,0,0,0.18)]"
                                : "bg-card text-muted-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:text-foreground"
                            }`}
                          >
                            {preset}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visual Quadratic Brier Payoff Comparison (Hairline-separated columns) */}
                  <div className="grid grid-cols-2 divide-x divide-black/[0.07]">
                    <div className="space-y-1.5 pr-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">Brier if YES</span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                          {brierIfYes.toFixed(4)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.07]">
                        <div
                          className="h-full rounded-full bg-foreground transition-[width] duration-150 ease-out"
                          style={{ width: `${(brierIfYes * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 pl-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">Brier if NO</span>
                        <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">
                          {brierIfNo.toFixed(4)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.07]">
                        <div
                          className="h-full rounded-full bg-foreground/35 transition-[width] duration-150 ease-out"
                          style={{ width: `${(brierIfNo * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Clean Hairline Protocol Spec List (no nested box) */}
              <div className="mt-5 space-y-2.5 border-t border-black/[0.06] pt-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Resolution rule</span>
                  <span className="font-mono text-[11px] text-foreground">
                    Price(resolve) ≥ Strike
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Forward ATM strike</span>
                  <span className="font-mono text-[11px] tabular-nums text-foreground">
                    {selectedRound.strikeFixed
                      ? `$${formatUsdPrice8(selectedRound.strikePrice8)}`
                      : "Fixed at commit close"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Scoring · Fee</span>
                  <span className="font-mono text-[11px] text-foreground">
                    Lambert WSWM · 0.00%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Pool commits / reveals</span>
                  <span className="font-mono text-[11px] tabular-nums text-foreground">
                    {selectedRound.committedCount} / {selectedRound.revealedCount}
                  </span>
                </div>
              </div>

              {/* Action CTA Section */}
              <div className="mt-5 space-y-3">
                {selectedRound.state === "OPEN" && (
                  <div className="space-y-3">
                    {/* Execution Mode Switcher: Binance Agentic Wallet (baw) vs Standard Browser Wallet */}
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.045] p-1">
                      <button
                        type="button"
                        onClick={() => setExecMode("baw")}
                        className={`pressable inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium ${
                          execMode === "baw"
                            ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <TerminalWindow size={13} weight="duotone" />
                        Agentic Wallet (baw)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExecMode("browser")}
                        className={`pressable inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium ${
                          execMode === "browser"
                            ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LockSimple size={13} weight="duotone" />
                        Browser Wallet
                      </button>
                    </div>

                    {execMode === "baw" ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor="baw-agent-address"
                              className="text-[11px] font-medium text-muted-foreground"
                            >
                              Agentic Wallet address (BNB Chain)
                            </label>
                            {parsedBawAddress &&
                              (bawHasAgentId ? (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-foreground">
                                  <CheckCircle size={12} weight="fill" />
                                  {bawAgentHandle}.ai
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  No Agent ID found
                                </span>
                              ))}
                          </div>
                          <Input
                            id="baw-agent-address"
                            value={agentWalletInput}
                            onChange={(e) => handleAgentWalletChange(e.target.value)}
                            placeholder="0x… (from `baw wallet address --json`)"
                            className="bg-card font-mono text-[11px]"
                          />
                        </div>

                        <Button
                          type="button"
                          size="lg"
                          variant="default"
                          disabled={!data.deployed || !parsedBawAddress || !bawHasAgentId}
                          onClick={handleGenerateBawCommit}
                          className="w-full"
                        >
                          <TerminalWindow size={15} weight="bold" />
                          {!data.deployed
                            ? `Mainnet deployment pending (${selectedRound.stakeBnb} BNB)`
                            : !parsedBawAddress
                              ? `Enter Agentic Wallet address · ${selectedRound.stakeBnb} BNB`
                              : !bawHasAgentId
                                ? "Address requires soulbound Agent ID"
                                : `Generate baw commit · ${selectedRound.stakeBnb} BNB`}
                        </Button>

                        {generatedBawBundle &&
                          generatedBawBundle.slotKey ===
                            `${selectedRound.epochId}:${selectedRound.feedId}:${selectedRound.tierId}` && (
                            <div className="surface-well space-y-2.5 rounded-xl p-3.5 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-foreground">
                                  1. Save reveal backup token (local salt)
                                </span>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() =>
                                    handleCopyText(
                                      "baw-token",
                                      generatedBawBundle.recoveryToken,
                                      "Reveal backup token (RKN1)",
                                    )
                                  }
                                >
                                  {copiedField === "baw-token" ? (
                                    <Check size={12} weight="bold" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                  {copiedField === "baw-token" ? "Copied" : "Copy token"}
                                </Button>
                              </div>
                              <pre className="overflow-x-auto rounded-lg border border-black/[0.06] bg-card p-2 font-mono text-[10px] text-foreground/85">
                                {generatedBawBundle.recoveryToken}
                              </pre>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="font-medium text-foreground">
                                  2. Preview in baw (verify before execute)
                                </span>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() =>
                                    handleCopyText(
                                      "baw-cmd",
                                      generatedBawBundle.previewCommand,
                                      "baw contract-call preview command",
                                    )
                                  }
                                >
                                  {copiedField === "baw-cmd" ? (
                                    <Check size={12} weight="bold" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                  {copiedField === "baw-cmd" ? "Copied" : "Copy cmd"}
                                </Button>
                              </div>
                              <pre className="overflow-x-auto rounded-lg border border-black/[0.06] bg-card p-2 font-mono text-[10px] leading-relaxed text-foreground/90">
                                {generatedBawBundle.previewCommand}
                              </pre>
                              <p className="text-[10px] leading-relaxed text-muted-foreground">
                                Confirm <code className="font-mono text-foreground">allowanceChanges: []</code>, then run{" "}
                                <code className="font-mono text-foreground">
                                  baw contract-call execute --requestId &lt;ID&gt; --json
                                </code>
                                .
                              </p>
                            </div>
                          )}

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCopyAgentPrompt}
                          className="w-full"
                        >
                          {copiedField === "agent-prompt" ? (
                            <Check size={14} weight="bold" />
                          ) : (
                            <Robot size={14} weight="duotone" />
                          )}
                          {copiedField === "agent-prompt"
                            ? "Prompt copied for your AI agent"
                            : "Copy prompt for AI agent (OpenClaw / Claude / MCP)"}
                        </Button>
                      </div>
                    ) : !isConnected ? (
                      <Button
                        type="button"
                        size="lg"
                        variant="default"
                        onClick={() => openConnectModal?.()}
                        className="w-full"
                      >
                        Connect wallet to forecast
                      </Button>
                    ) : !hasAgentId ? (
                      <div className="surface-well flex items-start gap-2.5 rounded-xl p-3.5 text-xs leading-relaxed text-muted-foreground">
                        <WarningCircle
                          size={15}
                          weight="fill"
                          className="mt-0.5 shrink-0 text-foreground"
                        />
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">
                            No Agent ID on this browser wallet
                          </div>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Binance Agent IDs live on your isolated Agentic Wallet. Switch to{" "}
                            <button
                              type="button"
                              onClick={() => setExecMode("baw")}
                              className="font-medium text-foreground underline underline-offset-2"
                            >
                              Agentic Wallet (baw)
                            </button>{" "}
                            above to generate a zero-clone commit command.
                          </p>
                        </div>
                      </div>
                    ) : selectedRound.agentEntry?.committed ? (
                      <div className="flex items-center gap-2 rounded-xl bg-secondary p-3.5 text-xs font-medium text-foreground">
                        <CheckCircle size={15} weight="fill" className="shrink-0" />
                        <span>Committed for this slot. Reveal opens after resolveTime.</span>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="lg"
                        variant="default"
                        disabled={isWriting || !data.deployed}
                        onClick={handleOpenCommitModal}
                        className="w-full"
                      >
                        <LockSimple size={15} weight="bold" />
                        {data.deployed
                          ? `Seal ${probPct.toFixed(1)}% · Commit ${selectedRound.stakeBnb} BNB`
                          : `Mainnet deployment pending (${selectedRound.stakeBnb} BNB)`}
                      </Button>
                    )}
                  </div>
                )}

                {selectedRound.state === "LOCKED" && (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Forecasts are sealed for the 4-hour observation window. Anyone can permissionlessly lock the Chainlink{" "}
                      <code className="font-mono text-foreground">commitEnd</code> ATM strike once published.
                    </p>
                    {selectedRound.instantiated && !selectedRound.strikeFixed && (
                      <Button
                        type="button"
                        size="lg"
                        variant="secondary"
                        disabled={isWriting || !isConnected}
                        onClick={() => handlePermissionlessSettle(selectedRound)}
                        className="w-full"
                      >
                        <Lightning size={15} weight="duotone" />
                        Fix Chainlink ATM strike
                      </Button>
                    )}
                  </div>
                )}

                {(selectedRound.state === "REVEAL" ||
                  selectedRound.state === "AWAITING_ORACLE") && (
                  <div className="space-y-3">
                    {selectedRound.instantiated && !selectedRound.oracleSettled && (
                      <Button
                        type="button"
                        size="lg"
                        variant="secondary"
                        disabled={isWriting || !isConnected}
                        onClick={() => handlePermissionlessSettle(selectedRound)}
                        className="w-full"
                      >
                        <Scales size={15} weight="duotone" />
                        {selectedRound.strikeFixed
                          ? "Settle Chainlink oracle"
                          : "Fix strike & settle oracle"}
                      </Button>
                    )}

                    {selectedRound.state === "REVEAL" &&
                      selectedRound.agentEntry?.committed &&
                      !selectedRound.agentEntry.revealed && (
                        <div className="surface-well space-y-3 rounded-xl p-4">
                          {savedSalt ? (
                            <div className="flex items-center gap-2 font-mono text-xs text-foreground">
                              <Key size={14} weight="duotone" />
                              <span>
                                Local salt ready: {(savedSalt.probBps / 100).toFixed(2)}%
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <label
                                htmlFor="manual-reveal-token"
                                className="block text-[11px] font-medium text-foreground/90"
                              >
                                Recovery token
                              </label>
                              <Input
                                id="manual-reveal-token"
                                value={manualRevealToken}
                                onChange={(e) => setManualRevealToken(e.target.value)}
                                placeholder="Paste RKN1-… string"
                                className="bg-card font-mono text-[11px]"
                              />
                            </div>
                          )}
                          <Button
                            type="button"
                            size="lg"
                            variant="default"
                            disabled={isWriting || !isConnected}
                            onClick={handleReveal}
                            className="w-full"
                          >
                            Reveal forecast on-chain
                          </Button>
                        </div>
                      )}
                  </div>
                )}

                {(selectedRound.state === "CLAIMABLE" ||
                  selectedRound.state === "NO_REVEALS" ||
                  selectedRound.state === "CANCELLED_ORACLE") && (
                  <div className="space-y-2.5">
                    {selectedRound.agentEntry &&
                    BigInt(selectedRound.agentEntry.claimableWei) > 0n ? (
                      <Button
                        type="button"
                        size="lg"
                        variant="default"
                        disabled={isWriting || !isConnected}
                        onClick={() =>
                          handleClaim(selectedRound, selectedRound.state !== "CLAIMABLE")
                        }
                        className="w-full"
                      >
                        {selectedRound.state === "CLAIMABLE"
                          ? `Claim ${Number(
                              formatEther(BigInt(selectedRound.agentEntry.claimableWei)),
                            ).toFixed(5)} BNB`
                          : `Claim 100% refund (${selectedRound.stakeBnb} BNB)`}
                      </Button>
                    ) : (
                      <p className="surface-well rounded-xl p-3.5 font-mono text-[11px] text-muted-foreground">
                        {selectedRound.agentEntry?.claimed
                          ? `Claimed · Historical WSWM payout: ${Number(
                              formatEther(BigInt(selectedRound.agentEntry.previewPayoutWei)),
                            ).toFixed(5)} BNB`
                          : "No claimable balance for connected wallet in this round."}
                      </p>
                    )}
                  </div>
                )}

                <p className="border-t border-black/[0.06] pt-3.5 text-left text-[11px] leading-relaxed text-muted-foreground">
                  Stakes are at risk of loss; missing the 4h reveal forfeits 100% and records{" "}
                  <code className="font-mono text-foreground/80">0.0000</code> Brier. Smart contract &amp; oracle risks apply — DYOR.{" "}
                  <Link
                    href="/security"
                    className="font-medium text-foreground/80 underline decoration-black/20 underline-offset-2 hover:text-foreground"
                  >
                    Risk model
                  </Link>
                </p>
              </div>
            </div>
          )}

          <BawCommandDrawer
            title={selectedRound ? `${selectedRound.feedSymbol} #${selectedRound.epochId}` : "Round"}
            commands={bawCommands}
          />
        </div>
        </div>
      </section>

      {pendingSaltRecord && (
        <SaltRecoveryModal
          record={pendingSaltRecord}
          isSubmitting={isWriting}
          onCancel={() => setPendingSaltRecord(null)}
          onConfirmSign={handleExecuteCommit}
        />
      )}

      {/* Import Salt Recovery Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restore salt backup</DialogTitle>
            <DialogDescription>
              Paste your <code className="font-mono text-foreground">RKN1-…</code> recovery token or downloaded JSON file. Stored exclusively in local browser storage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label
              htmlFor="import-salt-textarea"
              className="block text-xs font-medium text-foreground/90"
            >
              Recovery token or JSON payload
            </label>
            <Textarea
              id="import-salt-textarea"
              rows={5}
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder='RKN1-… or {"version":1,...}'
              className="font-mono text-[11px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={!importInput.trim()}
              onClick={handleImportSubmit}
            >
              Restore salt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
