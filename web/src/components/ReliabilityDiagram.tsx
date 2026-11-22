"use client";

import { useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReliabilityDiagramProps {
  handle: string;
  bucketCounts: number[];
  bucketHits: number[];
  meanBrier?: number;
  bssPct?: number;
  competitiveRounds?: number;
  isVerified?: boolean;
}

const DECILES = [
  { idx: 0, label: "1–9%", mid: 0.05 },
  { idx: 1, label: "10–19%", mid: 0.15 },
  { idx: 2, label: "20–29%", mid: 0.25 },
  { idx: 3, label: "30–39%", mid: 0.35 },
  { idx: 4, label: "40–49%", mid: 0.45 },
  { idx: 5, label: "50–59%", mid: 0.55 },
  { idx: 6, label: "60–69%", mid: 0.65 },
  { idx: 7, label: "70–79%", mid: 0.75 },
  { idx: 8, label: "80–89%", mid: 0.85 },
  { idx: 9, label: "90–99%", mid: 0.95 },
];

export function ReliabilityDiagram({
  handle,
  bucketCounts,
  bucketHits,
  meanBrier,
  bssPct,
  competitiveRounds,
  isVerified,
}: ReliabilityDiagramProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const shareUrl = (() => {
    if (!handle || typeof meanBrier !== "number" || meanBrier <= 0) return null;
    const brierStr = (meanBrier / 100_000_000).toFixed(4);
    const bssStr =
      typeof bssPct === "number" ? `${bssPct >= 0 ? "+" : ""}${bssPct.toFixed(1)}% BSS` : "";
    const statusLabel = isVerified ? "Verified Forecaster" : "On-Chain Track Record";
    const text = [
      `${handle}.ai — ${statusLabel} on @reckon_markets (BNB Chain)`,
      `Brier ${brierStr}${bssStr ? ` (${bssStr})` : ""}${competitiveRounds ? ` · ${competitiveRounds} competitive 4h epochs` : ""}`,
      `Ownerless, immutable, soulbound Agent ID calibration.`,
      `#BinanceWalletHackathon #AgenticWallet`,
    ].join("\n");
    const appOrigin =
      typeof window !== "undefined" ? window.location.origin : "https://reckon.markets";
    return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${appOrigin}/leaderboard`)}`;
  })();

  const width = 460;
  const height = 310;
  const padL = 44;
  const padR = 18;
  const padT = 18;
  const padB = 42;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const toX = (p: number) => padL + p * plotW;
  const toY = (p: number) => padT + (1 - p) * plotH;

  const maxCount = Math.max(1, ...bucketCounts);
  const totalSamples = bucketCounts.reduce((acc, c) => acc + c, 0);

  const points = DECILES.map((d) => {
    const count = bucketCounts[d.idx] ?? 0;
    const hits = bucketHits[d.idx] ?? 0;
    const freq = count > 0 ? hits / count : null;
    return { ...d, count, hits, freq };
  });

  const activePoints = points.filter((p) => p.freq !== null);
  const pathD = activePoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.mid).toFixed(1)} ${toY(p.freq!).toFixed(1)}`)
    .join(" ");

  const areaD =
    activePoints.length >= 2
      ? `${pathD} L ${toX(activePoints[activePoints.length - 1].mid).toFixed(1)} ${toY(0).toFixed(1)} L ${toX(activePoints[0].mid).toFixed(1)} ${toY(0).toFixed(1)} Z`
      : "";

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null;
  const hoveredDelta =
    hovered && hovered.freq !== null ? (hovered.freq - hovered.mid) * 100 : null;

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-black/[0.06] pb-4">
        <div className="space-y-1">
          <CardTitle className="text-[15px] font-semibold tracking-[-0.015em]">
            {handle ? `${handle}.ai` : "Aggregate"} accuracy
          </CardTitle>
          <CardDescription className="text-xs">
            Predicted confidence vs. actual outcomes ({totalSamples}{" "}
            {totalSamples === 1 ? "reveal" : "reveals"})
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-px w-3 border-t border-dashed border-muted-foreground/70" />
            Perfect
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            Actual
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full overflow-visible">
          <defs>
            <linearGradient id="reckon-cal-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={padL}
                y1={toY(tick)}
                x2={width - padR}
                y2={toY(tick)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <line
                x1={toX(tick)}
                y1={padT}
                x2={toX(tick)}
                y2={height - padB}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={toY(tick) + 3}
                textAnchor="end"
                className="fill-muted-foreground font-mono text-[9.5px]"
              >
                {Math.round(tick * 100)}%
              </text>
              <text
                x={toX(tick)}
                y={height - padB + 15}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[9.5px]"
              >
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}

          {/* Volume histogram along baseline */}
          {points.map((p) => {
            if (p.count === 0) return null;
            const barH = (p.count / maxCount) * 44;
            const barW = plotW / 14;
            return (
              <rect
                key={`bar-${p.idx}`}
                x={toX(p.mid) - barW / 2}
                y={height - padB - barH}
                width={barW}
                height={barH}
                fill="var(--foreground)"
                fillOpacity={hoveredIdx === p.idx ? 0.18 : 0.08}
                rx={2}
              />
            );
          })}

          {/* Ideal calibration reference */}
          <line
            x1={toX(0)}
            y1={toY(0)}
            x2={toX(1)}
            y2={toY(1)}
            stroke="var(--muted-foreground)"
            strokeOpacity="0.45"
            strokeDasharray="4 4"
            strokeWidth="1.25"
          />

          {activePoints.length === 0 && (
            <g>
              <rect
                x={padL + plotW / 2 - 86}
                y={padT + plotH / 2 - 14}
                width={172}
                height={26}
                rx={6}
                fill="var(--card)"
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={padL + plotW / 2}
                y={padT + plotH / 2 + 3}
                textAnchor="middle"
                className="fill-muted-foreground font-sans text-[11px] font-medium"
              >
                No revealed predictions yet
              </text>
            </g>
          )}

          {areaD && <path d={areaD} fill="url(#reckon-cal-fill)" />}

          {activePoints.length >= 2 && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map((p) => {
            if (p.freq === null) return null;
            const cx = toX(p.mid);
            const cy = toY(p.freq);
            const isHovered = hoveredIdx === p.idx;
            return (
              <g
                key={p.idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(p.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle cx={cx} cy={cy} r={12} fill="transparent" />
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={9}
                    fill="var(--foreground)"
                    fillOpacity="0.14"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : 4}
                  fill="var(--foreground)"
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          <text
            x={padL + plotW / 2}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-sans text-[10px]"
          >
            Predicted confidence
          </text>
          <text
            x={13}
            y={padT + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 13, ${padT + plotH / 2})`}
            className="fill-muted-foreground font-sans text-[10px]"
          >
            Actual win rate
          </text>
        </svg>

        <div className="mt-3 flex min-h-[28px] flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-3 text-[11.5px] tabular-nums">
          {hovered && hovered.freq !== null ? (
            <>
              <span className="font-mono text-foreground">
                {hovered.label} · {hovered.hits}/{hovered.count} right ({(hovered.freq * 100).toFixed(1)}%)
              </span>
              {hoveredDelta !== null && (
                <span className="font-mono text-muted-foreground">
                  {hoveredDelta >= 0 ? "+" : ""}
                  {hoveredDelta.toFixed(1)} pp vs perfect
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              Hover any point to compare predicted confidence against actual outcomes.
            </span>
          )}
          {shareUrl && (
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground/85 transition-colors hover:text-foreground"
            >
              <span>Share scorecard on X</span>
              <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
