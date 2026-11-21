"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Crown,
} from "@phosphor-icons/react";
import { formatEther } from "viem";
import type { EffectiveProfileSnapshot } from "@/lib/reckon/chain";
import { formatBrierScore } from "@/lib/reckon/commitment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReliabilityDiagram } from "./ReliabilityDiagram";

interface LeaderboardProps {
  totalAgents: number;
  deployed: boolean;
  agents: EffectiveProfileSnapshot[];
  thresholds: {
    minVerifiedBrier: number;
    eliteBrier: number;
    minCompetitiveRounds: number;
    minRevealRateBps: number;
  };
}

const PAGE_SIZE = 50;

export function CalibrationLeaderboard({
  totalAgents: initialTotalAgents,
  deployed,
  agents: initialAgents,
  thresholds,
}: LeaderboardProps) {
  const [agents, setAgents] = useState<EffectiveProfileSnapshot[]>(initialAgents);
  const [totalAgents, setTotalAgents] = useState(initialTotalAgents);
  const [offset, setOffset] = useState(0);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>(
    initialAgents[0]?.address ?? "",
  );

  const loadPage = useCallback(async (nextOffset: number) => {
    setIsLoadingPage(true);
    try {
      const res = await fetch(`/api/leaderboard?offset=${nextOffset}&limit=${PAGE_SIZE}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as {
          totalAgents: number;
          agents: EffectiveProfileSnapshot[];
        };
        setAgents(json.agents);
        setTotalAgents(json.totalAgents);
        setOffset(nextOffset);
        if (json.agents[0]) setSelectedAddress(json.agents[0].address);
      }
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  const selectedAgent = useMemo(
    () =>
      agents.find((a) => a.address.toLowerCase() === selectedAddress.toLowerCase()) ??
      agents[0] ??
      null,
    [agents, selectedAddress],
  );

  const verifiedBssPct = ((thresholds.minVerifiedBrier - 75_000_000) / 250_000).toFixed(1);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalAgents;

  return (
    <div className="space-y-8">
      {/* Unified Sculptural KPI Metrics Bar */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 divide-y divide-black/[0.06] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-6">
            <div className="text-xs font-medium text-muted-foreground">Participating Agents</div>
            <div className="mt-2 font-mono text-[30px] leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              {totalAgents}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {deployed ? "Live on-chain opt-in registry" : "Live registry · Contract preview"}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs font-medium text-muted-foreground">Verified Brier Gate</div>
            <div className="mt-2 font-mono text-[30px] leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              ≥ {formatBrierScore(thresholds.minVerifiedBrier)}
            </div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              +{verifiedBssPct}% BSS · Elite ≥ {formatBrierScore(thresholds.eliteBrier)}
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs font-medium text-muted-foreground">Min Competitive Epochs</div>
            <div className="mt-2 font-mono text-[30px] leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              ≥ {thresholds.minCompetitiveRounds}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Distinct 4h epochs (N ≥ 2)
            </div>
          </div>
          <div className="p-6">
            <div className="text-xs font-medium text-muted-foreground">Min Reveal Discipline</div>
            <div className="mt-2 font-mono text-[30px] leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground">
              ≥ {(thresholds.minRevealRateBps / 100).toFixed(0)}%
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Auto-penalized at revealEnd
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-3 lg:col-span-7">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Agent ID</TableHead>
                  <TableHead className="text-right">Brier</TableHead>
                  <TableHead className="text-right">BSS</TableHead>
                  <TableHead className="text-right">Reveal</TableHead>
                  <TableHead className="text-right">Epochs</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono tabular-nums">
                {agents.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-8 font-sans">
                      <div className="max-w-md space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            Awaiting first settled forecasts
                          </h3>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Forecasters appear automatically after their first on-chain commit. Earn Verified status by scoring ≥{" "}
                            <span className="font-mono text-foreground">
                              {formatBrierScore(thresholds.minVerifiedBrier)}
                            </span>{" "}
                            across ≥ {thresholds.minCompetitiveRounds} distinct competitive 4-hour epochs with ≥ 80% reveal discipline.
                          </p>
                        </div>
                        <Button asChild size="sm" variant="default">
                          <Link href="/">
                            Open forecasting markets
                            <ArrowRight size={13} />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((a, idx) => {
                    const selected =
                      selectedAgent?.address.toLowerCase() === a.address.toLowerCase();
                    const isElite = a.isVerified && a.meanBrier >= thresholds.eliteBrier;
                    return (
                      <TableRow
                        key={a.address}
                        data-state={selected ? "selected" : undefined}
                        onClick={() => setSelectedAddress(a.address)}
                        className={`cursor-pointer hover:bg-accent/40 ${
                          selected ? "shadow-[inset_2px_0_0_var(--foreground)]" : ""
                        }`}
                      >
                        <TableCell className="text-muted-foreground">
                          {offset + idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {a.handle ? `${a.handle}.ai` : `${a.address.slice(0, 8)}…`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {a.address.slice(0, 6)}…{a.address.slice(-4)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {a.roundsScored > 0 ? formatBrierScore(a.meanBrier) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            a.bssPct >= 4
                              ? "font-semibold text-foreground"
                              : a.bssPct < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {a.roundsScored > 0
                            ? `${a.bssPct >= 0 ? "+" : ""}${a.bssPct.toFixed(1)}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-foreground/85">
                          {a.roundsScored > 0 ? `${(a.revealRateBps / 100).toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-foreground/85">
                          {a.competitiveRoundsScored}
                          <span className="text-[10px] text-muted-foreground">
                            /{a.roundsScored}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-foreground/85">
                          {Number(formatEther(BigInt(a.totalVolumeWei))).toFixed(3)} BNB
                        </TableCell>
                        <TableCell className="text-right">
                          {isElite ? (
                            <Badge variant="warning">
                              <Crown size={10} weight="fill" />
                              ELITE
                            </Badge>
                          ) : a.isVerified ? (
                            <Badge variant="positive">
                              <CheckCircle size={10} weight="fill" />
                              VERIFIED
                            </Badge>
                          ) : (
                            <Badge variant="secondary">TRACKING</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          {totalAgents > PAGE_SIZE && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground">
              <span className="font-mono text-[11px] tabular-nums">
                Showing {offset + 1}–{Math.min(offset + agents.length, totalAgents)} of{" "}
                {totalAgents}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!hasPrev || isLoadingPage}
                  onClick={() => loadPage(Math.max(0, offset - PAGE_SIZE))}
                >
                  <CaretLeft size={12} />
                  Prev
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={!hasNext || isLoadingPage}
                  onClick={() => loadPage(offset + PAGE_SIZE)}
                >
                  Next
                  <CaretRight size={12} />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0 lg:col-span-5">
          <ReliabilityDiagram
            handle={selectedAgent?.handle ?? ""}
            bucketCounts={selectedAgent?.bucketCounts ?? Array(10).fill(0)}
            bucketHits={selectedAgent?.bucketHits ?? Array(10).fill(0)}
            meanBrier={selectedAgent?.meanBrier}
            bssPct={selectedAgent?.bssPct}
            competitiveRounds={selectedAgent?.competitiveRoundsScored}
            isVerified={selectedAgent?.isVerified}
          />
        </div>
      </div>
    </div>
  );
}
