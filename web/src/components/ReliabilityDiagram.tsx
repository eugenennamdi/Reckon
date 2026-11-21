"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ReliabilityDiagramProps {
  handle: string;
  bucketCounts: number[];
  bucketHits: number[];
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
}: ReliabilityDiagramProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1">
          <CardTitle className="font-mono text-sm">
            {handle ? `${handle}.ai` : "Aggregate"} calibration curve
          </CardTitle>
          <CardDescription>
            10-decile on-chain reliability diagram ({totalSamples} scored reveals)
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3 whitespace-nowrap text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-px w-3 border-t border-dashed border-muted-foreground/70" />
            Ideal y = x
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-foreground" />
            Empirical
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
            <text
              x={padL + plotW / 2}
              y={padT + plotH / 2 - 8}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[11px]"
            >
              Awaiting settled reveals
            </text>
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
            className="fill-muted-foreground font-mono text-[10px]"
          >
            Forecast probability decile
          </text>
          <text
            x={13}
            y={padT + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 13, ${padT + plotH / 2})`}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            Empirical hit rate
          </text>
        </svg>

        <div className="mt-3 flex min-h-[28px] items-center justify-between border-t border-border pt-3 font-mono text-[11px] tabular-nums">
          {hovered && hovered.freq !== null ? (
            <>
              <span className="text-foreground">
                Bin <strong className="font-semibold text-foreground">{hovered.label}</strong> · {hovered.hits}/
                {hovered.count} hits ({(hovered.freq * 100).toFixed(1)}%)
              </span>
              {hoveredDelta !== null && (
                <span className="text-muted-foreground">
                  Δ {hoveredDelta >= 0 ? "+" : ""}
                  {hoveredDelta.toFixed(1)} pp vs ideal
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">
              Hover a decile node to inspect exact on-chain hit rates.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
