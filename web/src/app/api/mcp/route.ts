import { NextResponse } from "next/server";
import { encodeFunctionData, getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { reckonCoreAbi } from "@/lib/abi";
import { getChainReader } from "@/lib/reckon/chain";
import { computeCommitment, currentEpochId, epochTiming } from "@/lib/reckon/commitment";
import {
  BSC_CHAIN_ID,
  ELITE_BRIER,
  FEEDS,
  MIN_COMPETITIVE_ROUNDS,
  MIN_REVEAL_RATE_BPS,
  MIN_VERIFIED_BRIER,
  STAKE_TIERS,
  findStablecoin,
  isDeployedAddress,
} from "@/lib/reckon/constants";
import { computeIntegrityCheck } from "@/lib/x402/attestation";
import { checkRateLimit, extractClientIp } from "@/lib/x402/rateLimit";
import { getSignalStore } from "@/lib/x402/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "reckon-mcp",
  version: "1.0.0",
};

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: McpToolDefinition[] = [
  {
    name: "reckon_get_rounds",
    description:
      "Read live Chainlink BSC prices and canonical 4-hour forecast rounds (BNB/USD, BTC/USD, ETH/USD across Starter/Standard/Pro tiers). Optionally pass an agent EVM address to include their entries and active pending/unclaimed rounds.",
    inputSchema: {
      type: "object",
      properties: {
        epochs: {
          type: "integer",
          minimum: 1,
          maximum: 6,
          default: 4,
          description: "Number of recent 4-hour UTC epochs to inspect (default 4: OPEN, LOCKED, REVEAL, CLAIMABLE).",
        },
        beforeEpoch: {
          type: "integer",
          minimum: 1,
          description: "Optional anchor epoch ID for older history pagination.",
        },
        agent: {
          type: "string",
          description: "Optional 0x EVM wallet address (never a handle) to query agent commitments and unclaimed rounds.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "reckon_get_leaderboard",
    description:
      "Read globally ranked Agent ID forecasters on BNB Smart Chain ordered by on-chain Brier score (0.7600 Verified / 0.7800 Elite thresholds) and registered x402 signal providers.",
    inputSchema: {
      type: "object",
      properties: {
        offset: { type: "integer", minimum: 0, default: 0 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "reckon_get_signals",
    description:
      "Read x402-gated forecast signal listings published by Verified Agent ID forecasters with live anti-fraud integrity tags (PENDING_REVEAL, MATCH, MISMATCH, NO_REVEAL). Pre-resolve signal payloads remain redacted until paid via x402.",
    inputSchema: {
      type: "object",
      properties: {
        feedId: { type: "integer", enum: [0, 1, 2], description: "0=BNB/USD, 1=BTC/USD, 2=ETH/USD" },
        roundId: { type: "integer", minimum: 1 },
        integrity: { type: "string", enum: ["PENDING_REVEAL", "MATCH", "MISMATCH", "NO_REVEAL"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "reckon_prepare_commit",
    description:
      "Prepare an unsigned ReckonCore.commitEpoch(...) calldata bundle and exact `baw contract-call preview` CLI command for a 4-hour forecast slot. Never executes transactions or stores keys. For maximum salt privacy, compute `commitment` locally with `skills/reckon/scripts/reckon-cli.mjs prepare-commit` and pass `commitment` directly.",
    inputSchema: {
      type: "object",
      required: ["feedId", "tierId"],
      properties: {
        feedId: { type: "integer", enum: [0, 1, 2], description: "0=BNB/USD, 1=BTC/USD, 2=ETH/USD" },
        tierId: {
          type: "integer",
          enum: [0, 1, 2],
          description: "0=0.002 BNB (Starter), 1=0.005 BNB (Standard), 2=0.01 BNB (Pro)",
        },
        epochId: { type: "integer", minimum: 1, description: "Optional target 4h epoch ID (defaults to current OPEN epoch)." },
        commitment: {
          type: "string",
          description: "Preferred: precomputed bytes32 commitment hash from local `reckon-cli.mjs prepare-commit` (keeps salt strictly off-server).",
        },
        agent: {
          type: "string",
          description: "Optional 0x wallet address for `--from` in `baw contract-call preview`, and required if computing commitment here instead of passing `commitment`.",
        },
        probBps: {
          type: "integer",
          minimum: 100,
          maximum: 9900,
          description: "Forecast probability in basis points (100..9900), required only if `commitment` is omitted.",
        },
        salt: {
          type: "string",
          description: "32-byte 0x hex salt, required only if `commitment` is omitted.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "reckon_prepare_settle",
    description:
      "Compute Chainlink historical round brackets for a LOCKED or REVEAL round and return unsigned fixStrike/settleOracle/fixAndSettleOracle calldata + exact `baw contract-call preview` CLI command.",
    inputSchema: {
      type: "object",
      required: ["roundId"],
      properties: {
        roundId: { type: "integer", minimum: 1, description: "On-chain ReckonCore roundId." },
        agent: {
          type: "string",
          description: "Optional 0x caller address for `--from` in `baw contract-call preview`.",
        },
      },
      additionalProperties: false,
    },
  },
];

function jsonRpcOk(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

function toolResult(data: unknown, isError = false) {
  return {
    isError,
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function buildBawContractCallPreview(from: string, to: Address, valueWei: string, data: Hex): string {
  return `baw contract-call preview --binanceChainId ${BSC_CHAIN_ID} --from ${from} --to ${to} --value ${valueWei} --inputData ${data} --json`;
}

async function executeTool(name: string, args: Record<string, unknown>) {
  const chain = getChainReader();
  const coreAddress = chain.getCoreAddress();
  const registryAddress = chain.getRegistryAddress();
  const nowSec = Math.floor(Date.now() / 1000);

  if (name === "reckon_get_rounds") {
    const epochsRaw = Number(args.epochs ?? 4);
    const epochsCount = Number.isInteger(epochsRaw) ? Math.max(1, Math.min(6, epochsRaw)) : 4;
    const currEpoch = currentEpochId(nowSec);

    let anchorEpoch = currEpoch;
    if (args.beforeEpoch !== undefined) {
      const parsed = Number(args.beforeEpoch);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return toolResult({ error: "beforeEpoch must be a positive integer" }, true);
      }
      anchorEpoch = Math.min(currEpoch, parsed);
    }

    let agent: Address | undefined;
    if (args.agent !== undefined && args.agent !== "") {
      if (typeof args.agent !== "string" || !isAddress(args.agent)) {
        return toolResult({ error: "agent must be a valid 0x EVM address (handle lookup is prohibited)" }, true);
      }
      agent = getAddress(args.agent);
    }

    const epochIds: number[] = [];
    for (let i = 0; i < epochsCount; i++) {
      if (anchorEpoch - i >= 1) epochIds.push(anchorEpoch - i);
    }

    const [prices, rounds, pendingRounds] = await Promise.all([
      chain.getLivePrices(),
      chain.getCanonicalRounds({ epochIds, agent }),
      agent ? chain.getAgentPendingRounds(agent) : Promise.resolve([]),
    ]);

    return toolResult({
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

  if (name === "reckon_get_leaderboard") {
    const offsetRaw = Number(args.offset ?? 0);
    const limitRaw = Number(args.limit ?? 25);
    const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const limit = Number.isInteger(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;

    const [leaderboard, providers] = await Promise.all([
      chain.getLeaderboard(offset, limit),
      chain.getProviders(0, 100),
    ]);

    return toolResult({
      serverTime: nowSec,
      coreAddress,
      registryAddress,
      verificationThresholds: {
        minVerifiedBrier: MIN_VERIFIED_BRIER,
        eliteBrier: ELITE_BRIER,
        minCompetitiveRounds: MIN_COMPETITIVE_ROUNDS,
        minRevealRateBps: MIN_REVEAL_RATE_BPS,
      },
      totalAgents: leaderboard.totalAgents,
      agents: leaderboard.agents,
      totalProviders: providers.totalProviders,
      providers: providers.providers,
    });
  }

  if (name === "reckon_get_signals") {
    const store = getSignalStore();
    const all = await store.listSignals();
    const feedFilter = args.feedId !== undefined ? Number(args.feedId) : null;
    const roundFilter = args.roundId !== undefined ? Number(args.roundId) : null;
    const integrityFilter = typeof args.integrity === "string" ? args.integrity : null;

    const filtered = all.filter((s) => {
      if (feedFilter !== null && s.feedId !== feedFilter) return false;
      if (roundFilter !== null && s.roundId !== roundFilter) return false;
      return true;
    });

    const enriched = await Promise.all(
      filtered.map(async (sig) => {
        const [profile, roundAndEntry, purchaseCount] = await Promise.all([
          chain.getEffectiveProfile(sig.seller),
          chain.getRoundAndEntry(sig.roundId, sig.seller),
          store.getPurchaseCount(sig.id),
        ]);
        const round = roundAndEntry.round;
        const roundState = round?.state ?? "NONE";
        const integrity = computeIntegrityCheck({
          claimedProbBps: sig.claimedProbBps,
          roundState,
          entry: roundAndEntry.entry,
        });
        const isPreResolve =
          roundState === "OPEN" || roundState === "LOCKED" || (round ? nowSec < round.resolveTime : false);
        const coin = findStablecoin(sig.preferredToken);

        return {
          id: sig.id,
          seller: sig.seller,
          handle: profile.handle,
          isVerified: profile.isVerified,
          meanBrier: profile.meanBrier,
          bssPct: profile.bssPct,
          roundId: sig.roundId,
          feedId: sig.feedId,
          feedSymbol: (FEEDS[sig.feedId] ?? FEEDS[0]).symbol,
          epochId: sig.epochId,
          tierId: sig.tierId,
          tierLabel: (STAKE_TIERS[sig.tierId] ?? STAKE_TIERS[0]).label,
          roundState,
          resolveTime: round?.resolveTime ?? null,
          title: sig.title,
          summary: sig.summary,
          priceAtomic: sig.priceAtomic,
          preferredTokenSymbol: coin?.symbol ?? "USD1",
          thesisHash: sig.thesisHash,
          purchaseCount,
          claimedProbRedacted: isPreResolve,
          claimedProbBps: isPreResolve ? null : sig.claimedProbBps,
          integrity,
          endpointUrl: `/api/signals/${sig.id}`,
        };
      }),
    );

    const signals = integrityFilter
      ? enriched.filter((item) => item.integrity.status === integrityFilter)
      : enriched;

    return toolResult({
      serverTime: nowSec,
      riskNotice: "Forecasts are probabilistic opinions and do not guarantee trading profits.",
      signals,
    });
  }

  if (name === "reckon_prepare_commit") {
    const feedId = Number(args.feedId);
    const tierId = Number(args.tierId);
    if (!Number.isInteger(feedId) || feedId < 0 || feedId > 2) {
      return toolResult({ error: "feedId must be 0, 1, or 2" }, true);
    }
    if (!Number.isInteger(tierId) || tierId < 0 || tierId > 2) {
      return toolResult({ error: "tierId must be 0, 1, or 2" }, true);
    }
    const epochId = args.epochId !== undefined ? Number(args.epochId) : currentEpochId(nowSec);
    if (!Number.isInteger(epochId) || epochId < 1) {
      return toolResult({ error: "epochId must be a positive integer" }, true);
    }

    let commitment: Hex;
    let privacyNote: string;
    if (typeof args.commitment === "string" && isHex(args.commitment) && args.commitment.length === 66) {
      commitment = args.commitment as Hex;
      privacyNote = "Client-supplied commitment hash used; secret salt never left local device.";
    } else {
      if (typeof args.agent !== "string" || !isAddress(args.agent)) {
        return toolResult(
          { error: "Provide precomputed bytes32 `commitment` (recommended) or valid `agent` + `probBps` + `salt`." },
          true,
        );
      }
      const probBps = Number(args.probBps);
      if (!Number.isInteger(probBps) || probBps < 100 || probBps > 9900) {
        return toolResult({ error: "probBps must be an integer between 100 and 9900" }, true);
      }
      if (typeof args.salt !== "string" || !isHex(args.salt) || args.salt.length !== 66) {
        return toolResult({ error: "salt must be a 32-byte 0x-prefixed hex string" }, true);
      }
      commitment = computeCommitment({
        chainId: BSC_CHAIN_ID,
        coreAddress,
        feedId,
        epochId,
        tierId,
        agent: getAddress(args.agent),
        probBps,
        salt: args.salt as Hex,
      });
      privacyNote =
        "WARNING: For real-money commits, generate salt locally via `skills/reckon/scripts/reckon-cli.mjs prepare-commit` so the salt never traverses an API.";
    }

    const tier = STAKE_TIERS[tierId];
    const feed = FEEDS[feedId];
    const schedule = epochTiming(epochId);
    const calldata = encodeFunctionData({
      abi: reckonCoreAbi,
      functionName: "commitEpoch",
      args: [feedId, BigInt(epochId), tierId, commitment],
    });

    const fromAddr =
      typeof args.agent === "string" && isAddress(args.agent) ? getAddress(args.agent) : "<WALLET_ADDRESS>";

    return toolResult({
      action: "commitEpoch",
      chainId: BSC_CHAIN_ID,
      to: coreAddress,
      deployed: isDeployedAddress(coreAddress),
      valueWei: tier.stakeWei.toString(),
      stakeBnb: tier.stakeBnb,
      feed: feed.symbol,
      tier: tier.label,
      epochId,
      schedule,
      commitment,
      calldata,
      bawPreviewCommand: buildBawContractCallPreview(fromAddr, coreAddress, tier.stakeWei.toString(), calldata),
      confirmationPolicy:
        "RED_LINE_2: Run `baw contract-call preview`, show parsed calldata, valueWei/BNB, balanceChanges, allowanceChanges, and risks to the user, and obtain explicit human confirmation before running `baw contract-call execute --requestId <ID> --json`. Abort on code 351803.",
      privacyNote,
    });
  }

  if (name === "reckon_prepare_settle") {
    const roundId = Number(args.roundId);
    if (!Number.isInteger(roundId) || roundId < 1) {
      return toolResult({ error: "roundId must be a positive integer" }, true);
    }
    const fromAddr =
      typeof args.agent === "string" && isAddress(args.agent) ? getAddress(args.agent) : "<WALLET_ADDRESS>";
    const { round } = await chain.getRoundAndEntry(roundId);
    if (!round) {
      return toolResult({ error: `Round ${roundId} not found` }, true);
    }
    if (nowSec < round.commitEnd) {
      return toolResult({ error: "Round commitEnd has not been reached yet" }, true);
    }

    const strikeBracket = round.strikeFixed
      ? null
      : await chain.findChainlinkBracket(round.feedId, round.commitEnd);
    const resolveBracket =
      nowSec >= round.resolveTime && !round.oracleSettled
        ? await chain.findChainlinkBracket(round.feedId, round.resolveTime)
        : null;

    let functionName: "fixStrike" | "settleOracle" | "fixAndSettleOracle" | null = null;
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
        args: [BigInt(roundId), BigInt(strikeBracket.roundId), BigInt(strikeBracket.nextRoundId)],
      });
    } else if (resolveBracket) {
      functionName = "settleOracle";
      calldata = encodeFunctionData({
        abi: reckonCoreAbi,
        functionName,
        args: [BigInt(roundId), BigInt(resolveBracket.roundId), BigInt(resolveBracket.nextRoundId)],
      });
    }

    return toolResult({
      roundId,
      feedId: round.feedId,
      strikeFixed: round.strikeFixed,
      oracleSettled: round.oracleSettled,
      strikeBracket,
      resolveBracket,
      functionName,
      to: coreAddress,
      valueWei: "0",
      calldata,
      bawPreviewCommand: calldata ? buildBawContractCallPreview(fromAddr, coreAddress, "0", calldata) : null,
      confirmationPolicy:
        "RED_LINE_2: Run `baw contract-call preview`, show parsed details to the user, and obtain explicit human confirmation before running `baw contract-call execute --requestId <ID> --json`.",
    });
  }

  return null;
}

export async function GET() {
  return NextResponse.json({
    protocol: "model-context-protocol",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http-jsonrpc",
    endpoint: "/api/mcp",
    serverInfo: SERVER_INFO,
    safetyGuarantees: [
      "Read-only queries and unsigned calldata preparation only; never holds private keys or broadcasts transactions.",
      "Zero handle-to-address lookup tools (preserves Agent ID owner privacy).",
      "All write actions emit explicit `baw contract-call preview` commands requiring human confirmation.",
    ],
    tools: TOOLS,
  });
}

export async function POST(request: Request) {
  const ip = extractClientIp(request.headers);
  const limit = checkRateLimit(`mcp:ip:${ip}`, 60, 60_000);
  if (!limit.allowed) {
    return jsonRpcError(null, -32029, "Rate limit exceeded for MCP endpoint", 429);
  }

  let body: {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonRpcError(null, -32700, "Parse error: invalid JSON", 400);
  }

  if (!body || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return jsonRpcError(body?.id ?? null, -32600, "Invalid JSON-RPC 2.0 request", 400);
  }

  const id = body.id ?? null;

  if (body.method === "initialize") {
    return jsonRpcOk(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }

  if (body.method === "notifications/initialized") {
    return NextResponse.json({ jsonrpc: "2.0", result: {} }, { status: 202 });
  }

  if (body.method === "ping") {
    return jsonRpcOk(id, {});
  }

  if (body.method === "tools/list") {
    return jsonRpcOk(id, { tools: TOOLS });
  }

  if (body.method === "tools/call") {
    const params = body.params as { name?: unknown; arguments?: unknown } | undefined;
    if (!params || typeof params.name !== "string") {
      return jsonRpcError(id, -32602, "Invalid params: missing tool name");
    }
    const toolArgs =
      params.arguments && typeof params.arguments === "object" && !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};
    try {
      const outcome = await executeTool(params.name, toolArgs);
      if (!outcome) {
        return jsonRpcError(id, -32601, `Unknown MCP tool: ${params.name}`);
      }
      return jsonRpcOk(id, outcome);
    } catch (err) {
      return jsonRpcOk(
        id,
        toolResult({ error: err instanceof Error ? err.message : "MCP tool execution failed" }, true),
      );
    }
  }

  return jsonRpcError(id, -32601, `Method not found: ${body.method}`);
}
