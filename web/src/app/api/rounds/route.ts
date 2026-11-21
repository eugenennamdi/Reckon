import { NextResponse } from "next/server";
import { encodeFunctionData, getAddress, isAddress, type Address, type Hex } from "viem";
import { reckonCoreAbi } from "@/lib/abi";
import { getChainReader } from "@/lib/reckon/chain";
import { currentEpochId } from "@/lib/reckon/commitment";
import { isDeployedAddress } from "@/lib/reckon/constants";
import { checkRateLimit, extractClientIp } from "@/lib/x402/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chain = getChainReader();
  const coreAddress = chain.getCoreAddress();
  const registryAddress = chain.getRegistryAddress();
  const nowSec = Math.floor(Date.now() / 1000);
  const currEpoch = currentEpochId(nowSec);

  const bracketPreviewParam = url.searchParams.get("bracketPreview");
  const bracketRoundParam = url.searchParams.get("bracketForRoundId");
  if (bracketPreviewParam === "1" || bracketRoundParam !== null) {
    const ip = extractClientIp(request.headers);
    const limit = checkRateLimit(`rounds:bracket:${ip}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded for Chainlink bracket queries", resetAt: limit.resetAt },
        { status: 429 },
      );
    }
  }

  if (bracketPreviewParam === "1") {
    const feedId = Number(url.searchParams.get("feedId") ?? "0");
    const roundId = Number(url.searchParams.get("roundId") ?? "1");
    const commitEnd = Number(url.searchParams.get("commitEnd") ?? String(nowSec - 14400));
    const resolveTime = Number(url.searchParams.get("resolveTime") ?? String(nowSec - 600));
    if (!Number.isInteger(feedId) || feedId < 0 || feedId > 2) {
      return NextResponse.json({ error: "Invalid feedId (expected 0, 1, or 2)" }, { status: 400 });
    }
    if (!Number.isInteger(roundId) || roundId <= 0 || !Number.isFinite(commitEnd) || !Number.isFinite(resolveTime)) {
      return NextResponse.json({ error: "Invalid bracketPreview parameters" }, { status: 400 });
    }
    try {
      const [strikeBracket, resolveBracket] = await Promise.all([
        chain.findChainlinkBracket(feedId, commitEnd),
        chain.findChainlinkBracket(feedId, resolveTime),
      ]);
      const calldata = encodeFunctionData({
        abi: reckonCoreAbi,
        functionName: "fixAndSettleOracle",
        args: [
          BigInt(roundId),
          BigInt(strikeBracket.roundId),
          BigInt(strikeBracket.nextRoundId),
          BigInt(resolveBracket.roundId),
          BigInt(resolveBracket.nextRoundId),
        ],
      });
      return NextResponse.json({
        roundId,
        feedId,
        commitEnd,
        resolveTime,
        strikeBracket,
        resolveBracket,
        functionName: "fixAndSettleOracle",
        calldata,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to compute Chainlink bracket preview" },
        { status: 502 },
      );
    }
  }

  if (bracketRoundParam !== null) {
    const roundId = Number(bracketRoundParam);
    if (!Number.isInteger(roundId) || roundId <= 0) {
      return NextResponse.json({ error: "Invalid bracketForRoundId" }, { status: 400 });
    }
    const { round } = await chain.getRoundAndEntry(roundId);
    if (!round) {
      return NextResponse.json({ error: `Round ${roundId} not found` }, { status: 404 });
    }
    if (nowSec < round.commitEnd) {
      return NextResponse.json({ error: "Round commitEnd not reached yet" }, { status: 409 });
    }

    try {
      const strikeBracket = round.strikeFixed
        ? null
        : await chain.findChainlinkBracket(round.feedId, round.commitEnd);
      const resolveBracket =
        nowSec >= round.resolveTime && !round.oracleSettled
          ? await chain.findChainlinkBracket(round.feedId, round.resolveTime)
          : null;

      let functionName: "fixStrike" | "fixAndSettleOracle" | "settleOracle" | null = null;
      let calldata: Hex | null = null;
      if (strikeBracket && resolveBracket) {
        functionName = "fixAndSettleOracle";
        calldata = encodeFunctionData({
          abi: reckonCoreAbi,
          functionName,
          args: [
            BigInt(roundId),
            BigInt(strikeBracket.roundId),
            BigInt(strikeBracket.nextRoundId),
            BigInt(resolveBracket.roundId),
            BigInt(resolveBracket.nextRoundId),
          ],
        });
      } else if (strikeBracket) {
        functionName = "fixStrike";
        calldata = encodeFunctionData({
          abi: reckonCoreAbi,
          functionName,
          args: [
            BigInt(roundId),
            BigInt(strikeBracket.roundId),
            BigInt(strikeBracket.nextRoundId),
          ],
        });
      } else if (resolveBracket) {
        functionName = "settleOracle";
        calldata = encodeFunctionData({
          abi: reckonCoreAbi,
          functionName,
          args: [
            BigInt(roundId),
            BigInt(resolveBracket.roundId),
            BigInt(resolveBracket.nextRoundId),
          ],
        });
      }

      return NextResponse.json({
        roundId,
        feedId: round.feedId,
        strikeFixed: round.strikeFixed,
        oracleSettled: round.oracleSettled,
        strikeBracket,
        resolveBracket,
        functionName,
        calldata,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to find Chainlink bracket" },
        { status: 502 },
      );
    }
  }

  const epochsCountRaw = Number(url.searchParams.get("epochs") ?? "4");
  const epochsCount = Number.isFinite(epochsCountRaw)
    ? Math.max(1, Math.min(6, Math.trunc(epochsCountRaw)))
    : 4;

  const beforeEpochParam = url.searchParams.get("beforeEpoch");
  let anchorEpoch = currEpoch;
  if (beforeEpochParam !== null && beforeEpochParam !== "") {
    const parsed = Number(beforeEpochParam);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json({ error: "Invalid beforeEpoch parameter" }, { status: 400 });
    }
    anchorEpoch = Math.min(currEpoch, parsed);
  }

  const agentParam = url.searchParams.get("agent");
  let agent: Address | undefined;
  if (agentParam) {
    if (!isAddress(agentParam)) {
      return NextResponse.json({ error: "Invalid agent EVM address" }, { status: 400 });
    }
    agent = getAddress(agentParam);
  }

  const epochIds: number[] = [];
  for (let i = 0; i < epochsCount; i++) {
    const candidate = anchorEpoch - i;
    if (candidate >= 1) epochIds.push(candidate);
  }

  const [prices, rounds, pendingRounds] = await Promise.all([
    chain.getLivePrices(),
    chain.getCanonicalRounds({ epochIds, agent }),
    agent ? chain.getAgentPendingRounds(agent) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    serverTime: nowSec,
    currentEpochId: currEpoch,
    anchorEpochId: anchorEpoch,
    coreAddress,
    registryAddress,
    deployed: isDeployedAddress(coreAddress),
    prices,
    rounds,
    pendingRounds,
  });
}
