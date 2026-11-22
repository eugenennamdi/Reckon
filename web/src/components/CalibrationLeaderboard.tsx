"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
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

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < totalAgents;

  return (
    <div className="space-y-8">
      {/* Unified Sculptural KPI Metrics Bar */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 divide-y divide-black/[0.06] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-4 sm:p-6">
            <div className="text-xs font-medium text-muted-foreground">Forecasters</div>
            <div className="mt-2 font-mono text-2xl leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground sm:text-[30px]">
              {totalAgents}
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              {deployed ? "On-chain .ai identities" : "Contract preview"}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="text-xs font-medium text-muted-foreground">Verified score</div>
            <div className="mt-2 font-mono text-2xl leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground sm:text-[30px]">
              ≥ {formatBrierScore(thresholds.minVerifiedBrier)}
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              76%+ accuracy · Elite ≥ {formatBrierScore(thresholds.eliteBrier)}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="text-xs font-medium text-muted-foreground">Competitive rounds</div>
            <div className="mt-2 font-mono text-2xl leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground sm:text-[30px]">
              ≥ {thresholds.minCompetitiveRounds}
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              Distinct 4-hour rounds
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="text-xs font-medium text-muted-foreground">Reveal rate</div>
            <div className="mt-2 font-mono text-2xl leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground sm:text-[30px]">
              ≥ {(thresholds.minRevealRateBps / 100).toFixed(0)}%
            </div>
            <div className="mt-2 text-[11.5px] text-muted-foreground">
              On-time reveals required
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
                  <TableHead>Forecaster</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">Skill</TableHead>
                  <TableHead className="text-right">Reveal</TableHead>
                  <TableHead className="text-right">Rounds</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="font-mono tabular-nums">
                {agents.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-8 font-sans">
                      <div className="max-w-md space-y-4">
                        <div className="space-y-1.5">
                          <h3 className="text-[15px] font-semibold text-foreground">
                            No scored forecasters yet
                          </h3>
                          <p className="text-[13px] leading-relaxed text-muted-foreground">
                            Forecasters appear automatically after their first prediction. Earn Verified status by maintaining ≥{" "}
                            <span className="font-mono text-foreground">
                              {formatBrierScore(thresholds.minVerifiedBrier)}
                            </span>{" "}
                            across ≥ {thresholds.minCompetitiveRounds} competitive 4-hour rounds with an 80%+ reveal rate.
                          </p>
                        </div>
                        <Button asChild size="sm" variant="default">
                          <Link href="/">
                            Open markets
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
                    const hasReveals = a.roundsRevealed > 0;
                    return (
                      <TableRow
                        key={a.address}
                        data-state={selected ? "selected" : undefined}
                        onClick={() => setSelectedAddress(a.address)}
                        className={`cursor-pointer transition-colors hover:bg-[#FAFAFB] ${
                          selected ? "bg-[#FAFAFB]" : ""
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
                            !hasReveals
                              ? "text-muted-foreground"
                              : a.bssPct >= 4
                                ? "font-semibold text-foreground"
                                : a.bssPct < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {hasReveals
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
                            <Badge variant="warning" className="font-sans text-[11px] font-medium">
                              Elite
                            </Badge>
                          ) : a.isVerified ? (
                            <Badge variant="positive" className="font-sans text-[11px] font-medium">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-sans text-[11px] font-medium">
                              Tracking
                            </Badge>
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
