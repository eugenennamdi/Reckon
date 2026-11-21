import { NextResponse } from "next/server";
import { getChainReader } from "@/lib/reckon/chain";
import {
  ELITE_BRIER,
  MIN_COMPETITIVE_ROUNDS,
  MIN_REVEAL_RATE_BPS,
  MIN_VERIFIED_BRIER,
  isDeployedAddress,
} from "@/lib/reckon/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");

  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.trunc(offsetRaw) : 0;
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.trunc(limitRaw)))
    : 50;

  const chain = getChainReader();
  const coreAddress = chain.getCoreAddress();
  const registryAddress = chain.getRegistryAddress();

  const [leaderboard, providerData] = await Promise.all([
    chain.getLeaderboard(offset, limit),
    chain.getProviders(0, 100),
  ]);

  return NextResponse.json({
    serverTime: Math.floor(Date.now() / 1000),
    coreAddress,
    registryAddress,
    deployed: isDeployedAddress(coreAddress),
    verificationThresholds: {
      minVerifiedBrier: MIN_VERIFIED_BRIER,
      eliteBrier: ELITE_BRIER,
      minCompetitiveRounds: MIN_COMPETITIVE_ROUNDS,
      minRevealRateBps: MIN_REVEAL_RATE_BPS,
    },
    totalAgents: leaderboard.totalAgents,
    agents: leaderboard.agents,
    totalProviders: providerData.totalProviders,
    providers: providerData.providers,
  });
}
