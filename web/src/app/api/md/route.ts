import { NextResponse } from "next/server";
import {
  buildAgentLinkHeader,
  buildPageMarkdown,
  type LiveMarkdownContext,
} from "@/lib/agent-docs";
import { getChainReader } from "@/lib/reckon/chain";
import { currentEpochId } from "@/lib/reckon/commitment";
import { getSiteUrl } from "@/lib/site";
import { getFacilitatorMode } from "@/lib/x402/facilitator";
import { getSignalStore } from "@/lib/x402/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path") || "/";
  const normalized = rawPath === "/" ? "/" : rawPath.replace(/\/+$/, "");
  const siteUrl = getSiteUrl();

  const live: LiveMarkdownContext = {};
  try {
    const chain = getChainReader();
    if (normalized === "/") {
      live.currentEpochId = currentEpochId(Math.floor(Date.now() / 1000));
      live.prices = await withTimeout(chain.getLivePrices(), 2500, []);
    } else if (normalized === "/leaderboard") {
      const lb = await withTimeout(chain.getLeaderboard(0, 20), 2500, {
        totalAgents: 0,
        agents: [],
      });
      live.totalAgents = lb.totalAgents;
      live.agents = lb.agents;
    } else if (normalized === "/signals") {
      live.facilitatorMode = getFacilitatorMode();
      try {
        const list = await withTimeout(getSignalStore().listSignals(), 2500, []);
        live.signalCount = list.length;
      } catch {
        live.signalCount = 0;
      }
    }
  } catch {
    // Serve static markdown fallback even if RPC is momentarily slow.
  }

  const { status, markdown } = buildPageMarkdown(rawPath, siteUrl, live);
  return new NextResponse(markdown, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept, rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
      Link: buildAgentLinkHeader(siteUrl),
      "Cache-Control":
        status === 200
          ? "public, s-maxage=30, stale-while-revalidate=60"
          : "no-store",
    },
  });
}
