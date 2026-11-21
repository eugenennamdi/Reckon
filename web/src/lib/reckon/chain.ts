import { createPublicClient, fallback, http, type Address, type Hex, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import {
  agentIdAbi,
  aggregatorV3Abi,
  reckonCoreAbi,
  reckonSignalRegistryAbi,
} from "@/lib/abi";
import {
  AGENT_ID_ADDRESS,
  BSC_RPC_URLS,
  FEEDS,
  ROUND_STATES,
  STAKE_TIERS,
  ZERO_ADDRESS,
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
  isDeployedAddress,
  type RoundStateName,
} from "./constants";
import {
  brierSkillScorePct,
  epochTiming,
  virtualRoundState,
} from "./commitment";

export interface LiveFeedPrice {
  feedId: 0 | 1 | 2;
  symbol: string;
  base: string;
  address: Address;
  roundId: string;
  answer8: string;
  updatedAt: number;
}

export interface RoundSnapshot {
  roundId: number;
  feedId: number;
  feedSymbol: string;
  epochId: number;
  tierId: number;
  tierLabel: string;
  stakeWei: string;
  stakeBnb: string;
  state: RoundStateName;
  instantiated: boolean;
  openTime: number;
  commitEnd: number;
  resolveTime: number;
  revealEnd: number;
  committedCount: number;
  revealedCount: number;
  claimedCount: number;
  remainingPoolWei: string;
  strikeFixed: boolean;
  oracleSettled: boolean;
  oracleCancelled: boolean;
  outcome: 0 | 1;
  strikePrice8: string;
  settlePrice8: string;
  sumP: string;
  sumP2: string;
  agentEntry?: {
    committed: boolean;
    commitment?: Hex;
    revealed: boolean;
    claimed: boolean;
    probBps: number;
    claimableWei: string;
    previewPayoutWei: string;
  };
}

export interface EntrySnapshot {
  committed: boolean;
  commitment: Hex;
  probBps: number;
  revealed: boolean;
  claimed: boolean;
  profileFlushed: boolean;
}

export interface EffectiveProfileSnapshot {
  address: Address;
  handle: string;
  handleHash: Hex;
  roundsCommitted: number;
  roundsRevealed: number;
  roundsScored: number;
  competitiveRoundsScored: number;
  roundsMissed: number;
  firstActiveAt: number;
  cumulativeBrier: string;
  totalVolumeWei: string;
  meanBrier: number;
  bssPct: number;
  revealRateBps: number;
  isVerified: boolean;
  bucketCounts: number[];
  bucketHits: number[];
}

export interface SignalProviderSnapshot {
  agent: Address;
  handle: string;
  endpointUrl: string;
  bio: string;
  paymentToken: Address;
  priceAtomic: string;
  updatedAt: number;
  listingActive: boolean;
  meanBrier: number;
  bssPct: number;
  revealRateBps: number;
  competitiveRoundsScored: number;
}

export interface ChainlinkBracketResult {
  roundId: string;
  nextRoundId: string;
  price8: string;
  updatedAt: number;
}

export interface ChainReader {
  getCoreAddress(): Address;
  getRegistryAddress(): Address;
  getPublicClient(): PublicClient;
  getLivePrices(): Promise<LiveFeedPrice[]>;
  getCanonicalRounds(params: {
    epochIds: number[];
    agent?: Address;
  }): Promise<RoundSnapshot[]>;
  getAgentPendingRounds(agent: Address): Promise<RoundSnapshot[]>;
  getRoundAndEntry(
    roundId: number,
    agent?: Address,
  ): Promise<{ round: RoundSnapshot | null; entry: EntrySnapshot | null }>;
  isVerifiedForecaster(agent: Address): Promise<boolean>;
  hasCommitted(roundId: number, agent: Address): Promise<boolean>;
  getEffectiveProfile(agent: Address): Promise<EffectiveProfileSnapshot>;
  getHandleOf(agent: Address): Promise<string>;
  getLeaderboard(offset: number, limit: number): Promise<{
    totalAgents: number;
    agents: EffectiveProfileSnapshot[];
  }>;
  getProviders(offset: number, limit: number): Promise<{
    totalProviders: number;
    providers: SignalProviderSnapshot[];
  }>;
  findChainlinkBracket(feedId: number, targetTime: number): Promise<ChainlinkBracketResult>;
}

const ZERO_HEX = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

interface CacheEntry<T> {
  freshUntil: number;
  staleUntil: number;
  value: T;
}

export class BscChainReader implements ChainReader {
  private readonly client: PublicClient;
  // ponytail: bounded in-memory SWR cache per server instance (12s fresh, 5m stale-while-revalidate); swap to Vercel Runtime Cache / Redis for multi-region consistency.
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly ttlMs = 12_000;
  private readonly staleWindowMs = 300_000;

  constructor() {
    this.client = createPublicClient({
      chain: bsc,
      transport: fallback(BSC_RPC_URLS.map((url) => http(url, { timeout: 3_000 }))),
    });
  }

  getCoreAddress(): Address {
    return getReckonCoreAddress();
  }

  getRegistryAddress(): Address {
    return getReckonSignalRegistryAddress();
  }

  getPublicClient(): PublicClient {
    return this.client;
  }

  private refreshKey<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fn()
      .then((value) => {
        const now = Date.now();
        if (this.cache.size > 250) {
          this.cache.clear();
        }
        this.cache.set(key, {
          freshUntil: now + ttlMs,
          staleUntil: now + Math.max(ttlMs, this.staleWindowMs),
          value,
        });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  private async cached<T>(key: string, fn: () => Promise<T>, ttlMs = this.ttlMs): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key) as CacheEntry<T> | undefined;
    if (hit) {
      if (hit.freshUntil > now) {
        return hit.value;
      }
      if (hit.staleUntil > now) {
        // Stale-while-revalidate: return immediately, refresh in background
        void this.refreshKey(key, fn, ttlMs).catch(() => {});
        return hit.value;
      }
    }
    return this.refreshKey(key, fn, ttlMs);
  }

  async getLivePrices(): Promise<LiveFeedPrice[]> {
    return this.cached("livePrices", async () => {
      const results = await this.client.multicall({
        contracts: FEEDS.map((f) => ({
          address: f.address,
          abi: aggregatorV3Abi,
          functionName: "latestRoundData" as const,
        })),
        allowFailure: true,
      });

      return FEEDS.map((f, idx) => {
        const res = results[idx];
        if (res?.status === "success" && Array.isArray(res.result)) {
          const [roundId, answer, , updatedAt] = res.result as readonly [
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
          ];
          return {
            feedId: f.id,
            symbol: f.symbol,
            base: f.base,
            address: f.address,
            roundId: roundId.toString(),
            answer8: answer.toString(),
            updatedAt: Number(updatedAt),
          };
        }
        return {
          feedId: f.id,
          symbol: f.symbol,
          base: f.base,
          address: f.address,
          roundId: "0",
          answer8: "0",
          updatedAt: 0,
        };
      });
    }, 10_000);
  }

  async getCanonicalRounds(params: {
    epochIds: number[];
    agent?: Address;
  }): Promise<RoundSnapshot[]> {
    const core = this.getCoreAddress();
    const nowSec = Math.floor(Date.now() / 1000);
    const agentKey = params.agent?.toLowerCase() ?? "anon";
    const cacheKey = `rounds:${core}:${params.epochIds.join(",")}:${agentKey}`;

    return this.cached(cacheKey, async () => {
      const slots: Array<{ epochId: number; feedId: 0 | 1 | 2; tierId: 0 | 1 | 2 }> = [];
      for (const epochId of params.epochIds) {
        for (const feed of FEEDS) {
          for (const tier of STAKE_TIERS) {
            slots.push({ epochId, feedId: feed.id, tierId: tier.id });
          }
        }
      }

      if (!isDeployedAddress(core)) {
        return slots.map((s) => this.buildVirtualRound(s.feedId, s.epochId, s.tierId, nowSec));
      }

      const keyCalls = slots.map((s) => ({
        address: core,
        abi: reckonCoreAbi,
        functionName: "roundKey" as const,
        args: [s.feedId, BigInt(s.epochId), s.tierId] as const,
      }));
      const keyRes = await this.client.multicall({ contracts: keyCalls, allowFailure: true });
      const roundKeys = keyRes.map((r) => (r.status === "success" ? (r.result as Hex) : ZERO_HEX));

      const idRes = await this.client.multicall({
        contracts: roundKeys.map((k) => ({
          address: core,
          abi: reckonCoreAbi,
          functionName: "roundIdByKey" as const,
          args: [k] as const,
        })),
        allowFailure: true,
      });

      const roundIds = idRes.map((r) => (r.status === "success" ? Number(r.result as bigint) : 0));
      const activeIndices = roundIds
        .map((id, idx) => ({ id, idx }))
        .filter((x) => x.id > 0);

      const roundDataMap = new Map<number, RoundSnapshot>();

      if (activeIndices.length > 0) {
        const detailCalls = activeIndices.flatMap(({ id }) => {
          const base = [
            {
              address: core,
              abi: reckonCoreAbi,
              functionName: "getRound" as const,
              args: [BigInt(id)] as const,
            },
            {
              address: core,
              abi: reckonCoreAbi,
              functionName: "roundState" as const,
              args: [BigInt(id)] as const,
            },
          ];
          if (params.agent) {
            return [
              ...base,
              {
                address: core,
                abi: reckonCoreAbi,
                functionName: "getEntry" as const,
                args: [BigInt(id), params.agent] as const,
              },
              {
                address: core,
                abi: reckonCoreAbi,
                functionName: "claimablePayout" as const,
                args: [BigInt(id), params.agent] as const,
              },
              {
                address: core,
                abi: reckonCoreAbi,
                functionName: "previewPayout" as const,
                args: [BigInt(id), params.agent] as const,
              },
            ];
          }
          return base;
        });

        const stride = params.agent ? 5 : 2;
        const details = await this.client.multicall({ contracts: detailCalls, allowFailure: true });

        activeIndices.forEach(({ id, idx }, pos) => {
          const slot = slots[idx];
          const baseOffset = pos * stride;
          const rRes = details[baseOffset];
          const sRes = details[baseOffset + 1];
          if (rRes?.status !== "success" || sRes?.status !== "success") return;

          const r = rRes.result as unknown as RawRoundStruct;
          const stateIdx = Number(sRes.result as number | bigint);
          const feed = FEEDS[slot.feedId];
          const tier = STAKE_TIERS[slot.tierId];

          const snap: RoundSnapshot = {
            roundId: id,
            feedId: slot.feedId,
            feedSymbol: feed.symbol,
            epochId: slot.epochId,
            tierId: slot.tierId,
            tierLabel: tier.label,
            stakeWei: r.stakeAmount.toString(),
            stakeBnb: tier.stakeBnb,
            state: ROUND_STATES[stateIdx] ?? "NONE",
            instantiated: true,
            openTime: Number(r.openTime),
            commitEnd: Number(r.commitEnd),
            resolveTime: Number(r.resolveTime),
            revealEnd: Number(r.revealEnd),
            committedCount: Number(r.committedCount),
            revealedCount: Number(r.revealedCount),
            claimedCount: Number(r.claimedCount),
            remainingPoolWei: r.remainingPool.toString(),
            strikeFixed: Boolean(r.strikeFixed),
            oracleSettled: Boolean(r.oracleSettled),
            oracleCancelled: Boolean(r.oracleCancelled),
            outcome: Number(r.outcome) === 1 ? 1 : 0,
            strikePrice8: r.strikePrice.toString(),
            settlePrice8: r.settlePrice.toString(),
            sumP: r.sumP.toString(),
            sumP2: r.sumP2.toString(),
          };

          if (params.agent) {
            const eRes = details[baseOffset + 2];
            const cRes = details[baseOffset + 3];
            const pRes = details[baseOffset + 4];
            if (eRes?.status === "success") {
              const e = eRes.result as unknown as RawEntryStruct;
              snap.agentEntry = {
                committed: e.commitment !== ZERO_HEX,
                commitment: e.commitment,
                revealed: Boolean(e.revealed),
                claimed: Boolean(e.claimed),
                probBps: Number(e.probBps),
                claimableWei: cRes?.status === "success" ? (cRes.result as bigint).toString() : "0",
                previewPayoutWei: pRes?.status === "success" ? (pRes.result as bigint).toString() : "0",
              };
            }
          }

          roundDataMap.set(idx, snap);
        });
      }

      return slots.map(
        (s, idx) =>
          roundDataMap.get(idx) ?? this.buildVirtualRound(s.feedId, s.epochId, s.tierId, nowSec),
      );
    });
  }

  private buildVirtualRound(
    feedId: 0 | 1 | 2,
    epochId: number,
    tierId: 0 | 1 | 2,
    nowSec: number,
  ): RoundSnapshot {
    const feed = FEEDS[feedId];
    const tier = STAKE_TIERS[tierId];
    const t = epochTiming(epochId);
    // Uninstantiated epochs past commitEnd can never be created on-chain, so report NONE.
    const state: RoundStateName =
      nowSec >= t.commitEnd ? "NONE" : virtualRoundState(epochId, nowSec);
    return {
      roundId: 0,
      feedId,
      feedSymbol: feed.symbol,
      epochId,
      tierId,
      tierLabel: tier.label,
      stakeWei: tier.stakeWei.toString(),
      stakeBnb: tier.stakeBnb,
      state,
      instantiated: false,
      openTime: t.openTime,
      commitEnd: t.commitEnd,
      resolveTime: t.resolveTime,
      revealEnd: t.revealEnd,
      committedCount: 0,
      revealedCount: 0,
      claimedCount: 0,
      remainingPoolWei: "0",
      strikeFixed: false,
      oracleSettled: false,
      oracleCancelled: false,
      outcome: 0,
      strikePrice8: "0",
      settlePrice8: "0",
      sumP: "0",
      sumP2: "0",
    };
  }

  async getAgentPendingRounds(agent: Address): Promise<RoundSnapshot[]> {
    const core = this.getCoreAddress();
    if (!isDeployedAddress(core)) {
      return [];
    }
    return this.cached(`pending:${core}:${agent.toLowerCase()}`, async () => {
      const idsRaw = await this.client.readContract({
        address: core,
        abi: reckonCoreAbi,
        functionName: "getPendingRounds",
        args: [agent],
      });
      const roundIds = [...new Set((idsRaw as readonly bigint[]).map((id) => Number(id)))].filter(
        (id) => id > 0,
      );
      if (roundIds.length === 0) return [];

      const calls = roundIds.flatMap((id) => [
        {
          address: core,
          abi: reckonCoreAbi,
          functionName: "getRound" as const,
          args: [BigInt(id)] as const,
        },
        {
          address: core,
          abi: reckonCoreAbi,
          functionName: "roundState" as const,
          args: [BigInt(id)] as const,
        },
        {
          address: core,
          abi: reckonCoreAbi,
          functionName: "getEntry" as const,
          args: [BigInt(id), agent] as const,
        },
        {
          address: core,
          abi: reckonCoreAbi,
          functionName: "claimablePayout" as const,
          args: [BigInt(id), agent] as const,
        },
        {
          address: core,
          abi: reckonCoreAbi,
          functionName: "previewPayout" as const,
          args: [BigInt(id), agent] as const,
        },
      ]);

      const details = await this.client.multicall({ contracts: calls, allowFailure: true });
      const out: RoundSnapshot[] = [];
      for (let i = 0; i < roundIds.length; i++) {
        const base = i * 5;
        const rRes = details[base];
        const sRes = details[base + 1];
        if (rRes?.status !== "success" || sRes?.status !== "success") continue;
        const r = rRes.result as unknown as RawRoundStruct;
        if (Number(r.openTime) === 0) continue;
        const feed = FEEDS[Number(r.feedId)] ?? FEEDS[0];
        const tier = STAKE_TIERS[Number(r.tierId)] ?? STAKE_TIERS[0];
        const stateIdx = Number(sRes.result as number | bigint);
        const snap: RoundSnapshot = {
          roundId: roundIds[i],
          feedId: Number(r.feedId),
          feedSymbol: feed.symbol,
          epochId: Number(r.epochId),
          tierId: Number(r.tierId),
          tierLabel: tier.label,
          stakeWei: r.stakeAmount.toString(),
          stakeBnb: tier.stakeBnb,
          state: ROUND_STATES[stateIdx] ?? "NONE",
          instantiated: true,
          openTime: Number(r.openTime),
          commitEnd: Number(r.commitEnd),
          resolveTime: Number(r.resolveTime),
          revealEnd: Number(r.revealEnd),
          committedCount: Number(r.committedCount),
          revealedCount: Number(r.revealedCount),
          claimedCount: Number(r.claimedCount),
          remainingPoolWei: r.remainingPool.toString(),
          strikeFixed: Boolean(r.strikeFixed),
          oracleSettled: Boolean(r.oracleSettled),
          oracleCancelled: Boolean(r.oracleCancelled),
          outcome: Number(r.outcome) === 1 ? 1 : 0,
          strikePrice8: r.strikePrice.toString(),
          settlePrice8: r.settlePrice.toString(),
          sumP: r.sumP.toString(),
          sumP2: r.sumP2.toString(),
        };
        const eRes = details[base + 2];
        const cRes = details[base + 3];
        const pRes = details[base + 4];
        if (eRes?.status === "success") {
          const e = eRes.result as unknown as RawEntryStruct;
          snap.agentEntry = {
            committed: e.commitment !== ZERO_HEX,
            commitment: e.commitment,
            revealed: Boolean(e.revealed),
            claimed: Boolean(e.claimed),
            probBps: Number(e.probBps),
            claimableWei: cRes?.status === "success" ? (cRes.result as bigint).toString() : "0",
            previewPayoutWei: pRes?.status === "success" ? (pRes.result as bigint).toString() : "0",
          };
        }
        out.push(snap);
      }
      out.sort((a, b) => b.roundId - a.roundId);
      return out;
    });
  }

  async getRoundAndEntry(
    roundId: number,
    agent?: Address,
  ): Promise<{ round: RoundSnapshot | null; entry: EntrySnapshot | null }> {
    const core = this.getCoreAddress();
    if (!isDeployedAddress(core) || roundId <= 0) {
      return { round: null, entry: null };
    }
    const calls = [
      {
        address: core,
        abi: reckonCoreAbi,
        functionName: "getRound" as const,
        args: [BigInt(roundId)] as const,
      },
      {
        address: core,
        abi: reckonCoreAbi,
        functionName: "roundState" as const,
        args: [BigInt(roundId)] as const,
      },
      ...(agent
        ? [
            {
              address: core,
              abi: reckonCoreAbi,
              functionName: "getEntry" as const,
              args: [BigInt(roundId), agent] as const,
            },
          ]
        : []),
    ];
    const res = await this.client.multicall({ contracts: calls, allowFailure: true });
    if (res[0]?.status !== "success" || res[1]?.status !== "success") {
      return { round: null, entry: null };
    }
    const r = res[0].result as unknown as RawRoundStruct;
    if (Number(r.openTime) === 0) {
      return { round: null, entry: null };
    }
    const feed = FEEDS[Number(r.feedId)] ?? FEEDS[0];
    const tier = STAKE_TIERS[Number(r.tierId)] ?? STAKE_TIERS[0];
    const stateIdx = Number(res[1].result as number | bigint);

    const round: RoundSnapshot = {
      roundId,
      feedId: Number(r.feedId),
      feedSymbol: feed.symbol,
      epochId: Number(r.epochId),
      tierId: Number(r.tierId),
      tierLabel: tier.label,
      stakeWei: r.stakeAmount.toString(),
      stakeBnb: tier.stakeBnb,
      state: ROUND_STATES[stateIdx] ?? "NONE",
      instantiated: true,
      openTime: Number(r.openTime),
      commitEnd: Number(r.commitEnd),
      resolveTime: Number(r.resolveTime),
      revealEnd: Number(r.revealEnd),
      committedCount: Number(r.committedCount),
      revealedCount: Number(r.revealedCount),
      claimedCount: Number(r.claimedCount),
      remainingPoolWei: r.remainingPool.toString(),
      strikeFixed: Boolean(r.strikeFixed),
      oracleSettled: Boolean(r.oracleSettled),
      oracleCancelled: Boolean(r.oracleCancelled),
      outcome: Number(r.outcome) === 1 ? 1 : 0,
      strikePrice8: r.strikePrice.toString(),
      settlePrice8: r.settlePrice.toString(),
      sumP: r.sumP.toString(),
      sumP2: r.sumP2.toString(),
    };

    let entry: EntrySnapshot | null = null;
    if (agent && res[2]?.status === "success") {
      const e = res[2].result as unknown as RawEntryStruct;
      entry = {
        committed: e.commitment !== ZERO_HEX,
        commitment: e.commitment,
        probBps: Number(e.probBps),
        revealed: Boolean(e.revealed),
        claimed: Boolean(e.claimed),
        profileFlushed: Boolean(e.profileFlushed),
      };
    }

    return { round, entry };
  }

  async isVerifiedForecaster(agent: Address): Promise<boolean> {
    const core = this.getCoreAddress();
    if (!isDeployedAddress(core)) return false;
    return this.cached(`verified:${core}:${agent.toLowerCase()}`, async () => {
      const res = await this.client.readContract({
        address: core,
        abi: reckonCoreAbi,
        functionName: "isVerifiedForecaster",
        args: [agent],
      });
      return Boolean(res);
    });
  }

  async hasCommitted(roundId: number, agent: Address): Promise<boolean> {
    const core = this.getCoreAddress();
    if (!isDeployedAddress(core) || roundId <= 0) return false;
    const res = await this.client.readContract({
      address: core,
      abi: reckonCoreAbi,
      functionName: "hasCommitted",
      args: [BigInt(roundId), agent],
    });
    return Boolean(res);
  }

  async getHandleOf(agent: Address): Promise<string> {
    return this.cached(`handle:${agent.toLowerCase()}`, async () => {
      const res = await this.client.readContract({
        address: AGENT_ID_ADDRESS,
        abi: agentIdAbi,
        functionName: "handleOf",
        args: [agent],
      });
      return String(res ?? "");
    }, 60_000);
  }

  async getEffectiveProfile(agent: Address): Promise<EffectiveProfileSnapshot> {
    const core = this.getCoreAddress();
    if (!isDeployedAddress(core)) {
      const handle = await this.getHandleOf(agent).catch(() => "");
      return emptyProfile(agent, handle);
    }

    return this.cached(`profile:${core}:${agent.toLowerCase()}`, async () => {
      const [profileRes, handleRes] = await this.client.multicall({
        contracts: [
          {
            address: core,
            abi: reckonCoreAbi,
            functionName: "getEffectiveProfile",
            args: [agent],
          },
          {
            address: AGENT_ID_ADDRESS,
            abi: agentIdAbi,
            functionName: "handleOf",
            args: [agent],
          },
        ],
        allowFailure: true,
      });

      const handle = handleRes.status === "success" ? String(handleRes.result ?? "") : "";
      if (profileRes.status !== "success") {
        return emptyProfile(agent, handle);
      }
      return mapEffectiveProfile(agent, handle, profileRes.result as unknown as RawEffectiveProfile);
    });
  }

  async getLeaderboard(
    offset: number,
    limit: number,
  ): Promise<{ totalAgents: number; agents: EffectiveProfileSnapshot[] }> {
    const core = this.getCoreAddress();
    if (!isDeployedAddress(core)) {
      return { totalAgents: 0, agents: [] };
    }

    // ponytail: ranks up to 500 registered agents globally in-memory before slicing [offset..offset+limit];
    // upgrade to an off-chain indexer when totalAgents > 500.
    const ranked = await this.cached(`leaderboard:ranked:${core}`, async () => {
      const totalRaw = await this.client.readContract({
        address: core,
        abi: reckonCoreAbi,
        functionName: "agentCount",
      });
      const totalAgents = Number(totalRaw);
      if (totalAgents === 0) {
        return { totalAgents: 0, agents: [] as EffectiveProfileSnapshot[] };
      }

      const maxScan = Math.min(totalAgents, 500);
      const pageCalls = [];
      for (let start = 0; start < maxScan; start += 100) {
        pageCalls.push({
          address: core,
          abi: reckonCoreAbi,
          functionName: "getAgents" as const,
          args: [BigInt(start), BigInt(Math.min(100, maxScan - start))] as const,
        });
      }
      const pageRes = await this.client.multicall({ contracts: pageCalls, allowFailure: true });
      const addresses: Address[] = [];
      for (const item of pageRes) {
        if (item.status === "success" && Array.isArray(item.result)) {
          addresses.push(...(item.result as readonly Address[]));
        }
      }
      if (addresses.length === 0) {
        return { totalAgents, agents: [] as EffectiveProfileSnapshot[] };
      }

      const agents: EffectiveProfileSnapshot[] = [];
      for (let chunkStart = 0; chunkStart < addresses.length; chunkStart += 50) {
        const chunk = addresses.slice(chunkStart, chunkStart + 50);
        const calls = chunk.flatMap((addr) => [
          {
            address: core,
            abi: reckonCoreAbi,
            functionName: "getEffectiveProfile" as const,
            args: [addr] as const,
          },
          {
            address: AGENT_ID_ADDRESS,
            abi: agentIdAbi,
            functionName: "handleOf" as const,
            args: [addr] as const,
          },
        ]);

        const res = await this.client.multicall({ contracts: calls, allowFailure: true });
        for (let i = 0; i < chunk.length; i++) {
          const pRes = res[i * 2];
          const hRes = res[i * 2 + 1];
          const handle = hRes?.status === "success" ? String(hRes.result ?? "") : "";
          if (pRes?.status === "success") {
            agents.push(
              mapEffectiveProfile(
                chunk[i],
                handle,
                pRes.result as unknown as RawEffectiveProfile,
              ),
            );
          }
        }
      }

      agents.sort((a, b) => {
        if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
        if (b.meanBrier !== a.meanBrier) return b.meanBrier - a.meanBrier;
        return b.competitiveRoundsScored - a.competitiveRoundsScored;
      });

      return { totalAgents, agents };
    });

    return {
      totalAgents: ranked.totalAgents,
      agents: ranked.agents.slice(offset, offset + limit),
    };
  }

  async getProviders(
    offset: number,
    limit: number,
  ): Promise<{ totalProviders: number; providers: SignalProviderSnapshot[] }> {
    const registry = this.getRegistryAddress();
    if (!isDeployedAddress(registry)) {
      return { totalProviders: 0, providers: [] };
    }

    return this.cached(`providers:${registry}:${offset}:${limit}`, async () => {
      const [totalRaw, listRaw] = await this.client.multicall({
        contracts: [
          { address: registry, abi: reckonSignalRegistryAbi, functionName: "providerCount" },
          {
            address: registry,
            abi: reckonSignalRegistryAbi,
            functionName: "getProviders",
            args: [BigInt(offset), BigInt(limit)],
          },
        ],
        allowFailure: false,
      });

      const totalProviders = Number(totalRaw);
      const rows = listRaw as unknown as readonly RawProviderView[];
      const providers: SignalProviderSnapshot[] = rows.map((p) => {
        const meanBrier = Number(p.meanBrier);
        return {
          agent: p.agent,
          handle: p.handle,
          endpointUrl: p.endpointUrl,
          bio: p.bio,
          paymentToken: p.paymentToken,
          priceAtomic: p.priceAtomic.toString(),
          updatedAt: Number(p.updatedAt),
          listingActive: Boolean(p.listingActive),
          meanBrier,
          bssPct: p.competitiveRoundsScored > 0 ? brierSkillScorePct(meanBrier) : 0,
          revealRateBps: Number(p.revealRateBps),
          competitiveRoundsScored: Number(p.competitiveRoundsScored),
        };
      });

      return { totalProviders, providers };
    });
  }

  /**
   * Interpolation-seeded 16-way multicall search over historical Chainlink aggregator rounds
   * within the active phase to bracket `targetTime` (`round.updatedAt <= targetTime < next.updatedAt`).
   * Converges in 2-4 RPC calls total (safe against public BSC RPC rate limits) and caches 1h.
   */
  async findChainlinkBracket(feedId: number, targetTime: number): Promise<ChainlinkBracketResult> {
    const feed = FEEDS[feedId];
    if (!feed) {
      throw new Error(`Invalid feedId ${feedId}`);
    }

    return this.cached(
      `bracket:${feedId}:${targetTime}`,
      async () => {
        const [latestId, latestAns, , latestUpdatedAt] = await this.client.readContract({
          address: feed.address,
          abi: aggregatorV3Abi,
          functionName: "latestRoundData",
        });

        const latestUpdatedSec = Number(latestUpdatedAt);
        if (latestUpdatedSec <= targetTime) {
          throw new Error(
            `Chainlink feed ${feed.symbol} has not yet updated past targetTime ${targetTime} (latest=${latestUpdatedSec})`,
          );
        }

        const phase = latestId >> 64n;
        const latestAggRound = latestId & ((1n << 64n) - 1n);
        const samplePrior = latestAggRound > 100n ? latestAggRound - 100n : 1n;

        let secPerRound = feed.heartbeatSec > 45 ? 60 : 32;
        if (samplePrior < latestAggRound) {
          try {
            const [, , , priorUpdatedAt] = await this.client.readContract({
              address: feed.address,
              abi: aggregatorV3Abi,
              functionName: "getRoundData",
              args: [(phase << 64n) | samplePrior],
            });
            const dtSample = latestUpdatedSec - Number(priorUpdatedAt);
            if (Number(priorUpdatedAt) > 0 && dtSample > 0) {
              secPerRound = Math.max(
                5,
                Math.min(600, dtSample / Number(latestAggRound - samplePrior)),
              );
            }
          } catch {
            // keep nominal fallback
          }
        }

        const searchInPhase = async (
          phaseId: bigint,
          phaseLatestAgg: bigint,
          phaseLatestUpdatedSec: number,
        ): Promise<ChainlinkBracketResult | null> => {
          const dt = Math.max(1, phaseLatestUpdatedSec - targetTime);
          const maxSpan = BigInt(Math.ceil(dt / 5) + 1200);
          let lo = phaseLatestAgg > maxSpan ? phaseLatestAgg - maxSpan : 1n;
          let hi = phaseLatestAgg;

          const estOffset = BigInt(Math.round(dt / secPerRound));
          const rawEst = phaseLatestAgg > estOffset ? phaseLatestAgg - estOffset : 1n;
          const est = rawEst < lo ? lo : rawEst > hi ? hi : rawEst;

          const probeBatch = async (candidates: bigint[]): Promise<void> => {
            const unique = [...new Set(candidates.map((c) => (c < lo ? lo : c > hi ? hi : c)))]
              .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            if (unique.length === 0) return;

            const res = await this.client.multicall({
              contracts: unique.map((agg) => ({
                address: feed.address,
                abi: aggregatorV3Abi,
                functionName: "getRoundData" as const,
                args: [(phaseId << 64n) | agg] as const,
              })),
              allowFailure: true,
            });

            for (let i = 0; i < unique.length; i++) {
              const item = res[i];
              if (item?.status !== "success" || !Array.isArray(item.result)) continue;
              const uAt = Number((item.result as readonly unknown[])[3]);
              if (uAt <= 0) continue;
              if (uAt <= targetTime) {
                if (unique[i] > lo) lo = unique[i];
              } else if (unique[i] < hi) {
                hi = unique[i];
                break;
              }
            }
          };

          await probeBatch([
            lo,
            est - 1024n,
            est - 256n,
            est - 64n,
            est - 16n,
            est - 4n,
            est,
            est + 4n,
            est + 16n,
            est + 64n,
            est + 256n,
            est + 1024n,
            hi,
          ]);

          for (let iter = 0; iter < 8 && hi - lo > 16n; iter++) {
            const span = hi - lo;
            const probes: bigint[] = [];
            for (let k = 1n; k <= 15n; k++) {
              probes.push(lo + (span * k) / 16n);
            }
            await probeBatch(probes);
          }

          const scanCount = Math.min(64, Number(hi - lo) + 1);
          const scanIds: bigint[] = [];
          for (let i = 0; i < scanCount; i++) {
            scanIds.push(lo + BigInt(i));
          }

          const scanRes = await this.client.multicall({
            contracts: scanIds.map((agg) => ({
              address: feed.address,
              abi: aggregatorV3Abi,
              functionName: "getRoundData" as const,
              args: [(phaseId << 64n) | agg] as const,
            })),
            allowFailure: true,
          });

          for (let i = 0; i < scanIds.length - 1; i++) {
            const cur = scanRes[i];
            const nxt = scanRes[i + 1];
            if (cur?.status !== "success" || nxt?.status !== "success") continue;
            const [curId, curAns, , curUAt] = cur.result as readonly [
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
            ];
            const [nxtId, nxtAns, , nxtUAt] = nxt.result as readonly [
              bigint,
              bigint,
              bigint,
              bigint,
              bigint,
            ];
            if (
              curAns > 0n &&
              nxtAns > 0n &&
              Number(curUAt) > 0 &&
              Number(curUAt) <= targetTime &&
              Number(nxtUAt) > targetTime
            ) {
              return {
                roundId: curId.toString(),
                nextRoundId: nxtId.toString(),
                price8: curAns.toString(),
                updatedAt: Number(curUAt),
              };
            }
          }
          return null;
        };

        const foundInCurrent = await searchInPhase(phase, latestAggRound, latestUpdatedSec);
        if (foundInCurrent) return foundInCurrent;

        // Phase-rollover fallback: if round 1 of `phase` is already after `targetTime`, step into `phase - 1`.
        if (phase > 1n) {
          const prevPhase = phase - 1n;
          try {
            const [firstCurId, firstCurAns, , firstCurUAt] = await this.client.readContract({
              address: feed.address,
              abi: aggregatorV3Abi,
              functionName: "getRoundData",
              args: [(phase << 64n) | 1n],
            });
            if (firstCurAns > 0n && Number(firstCurUAt) > targetTime) {
              // Locate last existing round of prevPhase via exponential probe + binary search
              let step = 1n;
              let lastGood = 0n;
              let lastGoodAns = 0n;
              let lastGoodUAt = 0;
              while (step <= 1_000_000n) {
                try {
                  const [, ans, , uAt] = await this.client.readContract({
                    address: feed.address,
                    abi: aggregatorV3Abi,
                    functionName: "getRoundData",
                    args: [(prevPhase << 64n) | step],
                  });
                  if (Number(uAt) > 0 && ans > 0n) {
                    lastGood = step;
                    lastGoodAns = ans;
                    lastGoodUAt = Number(uAt);
                    step *= 2n;
                    continue;
                  }
                } catch {
                  // upper bound reached
                }
                break;
              }
              if (lastGood > 0n) {
                let pLo = lastGood;
                let pHi = step;
                while (pLo + 1n < pHi) {
                  const mid = pLo + (pHi - pLo) / 2n;
                  try {
                    const [, ans, , uAt] = await this.client.readContract({
                      address: feed.address,
                      abi: aggregatorV3Abi,
                      functionName: "getRoundData",
                      args: [(prevPhase << 64n) | mid],
                    });
                    if (Number(uAt) > 0 && ans > 0n) {
                      pLo = mid;
                      lastGoodAns = ans;
                      lastGoodUAt = Number(uAt);
                      continue;
                    }
                  } catch {
                    // does not exist
                  }
                  pHi = mid;
                }
                if (lastGoodUAt > 0 && lastGoodUAt <= targetTime) {
                  return {
                    roundId: ((prevPhase << 64n) | pLo).toString(),
                    nextRoundId: firstCurId.toString(),
                    price8: lastGoodAns.toString(),
                    updatedAt: lastGoodUAt,
                  };
                }
                const foundInPrev = await searchInPhase(prevPhase, pLo, lastGoodUAt);
                if (foundInPrev) return foundInPrev;
              }
            }
          } catch {
            // fall through to error
          }
        }

        throw new Error(
          `Unable to bracket targetTime=${targetTime} on ${feed.symbol} (latest=${latestAns.toString()})`,
        );
      },
      3_600_000,
    );
  }
}

interface RawRoundStruct {
  feedId: number;
  tierId: number;
  outcome: number;
  strikeFixed: boolean;
  oracleSettled: boolean;
  oracleCancelled: boolean;
  epochId: bigint;
  openTime: bigint;
  commitEnd: bigint;
  resolveTime: bigint;
  revealEnd: bigint;
  committedCount: number;
  revealedCount: number;
  claimedCount: number;
  stakeAmount: bigint;
  remainingPool: bigint;
  strikePrice: bigint;
  settlePrice: bigint;
  sumP: bigint;
  sumP2: bigint;
}

interface RawEntryStruct {
  commitment: Hex;
  probBps: number;
  revealed: boolean;
  claimed: boolean;
  profileFlushed: boolean;
}

interface RawEffectiveProfile {
  handleHash: Hex;
  roundsCommitted: number;
  roundsRevealed: number;
  roundsScored: number;
  competitiveRoundsScored: number;
  roundsMissed: number;
  firstActiveAt: bigint;
  cumulativeBrier: bigint;
  totalVolumeWei: bigint;
  meanBrier: bigint;
  revealRateBps: bigint;
  isVerified: boolean;
  bucketCounts: readonly bigint[];
  bucketHits: readonly bigint[];
}

interface RawProviderView {
  agent: Address;
  handle: string;
  endpointUrl: string;
  bio: string;
  paymentToken: Address;
  priceAtomic: bigint;
  updatedAt: bigint;
  listingActive: boolean;
  meanBrier: bigint;
  revealRateBps: bigint;
  competitiveRoundsScored: number;
}

function emptyProfile(address: Address, handle: string): EffectiveProfileSnapshot {
  return {
    address,
    handle,
    handleHash: ZERO_HEX,
    roundsCommitted: 0,
    roundsRevealed: 0,
    roundsScored: 0,
    competitiveRoundsScored: 0,
    roundsMissed: 0,
    firstActiveAt: 0,
    cumulativeBrier: "0",
    totalVolumeWei: "0",
    meanBrier: 0,
    bssPct: 0,
    revealRateBps: 0,
    isVerified: false,
    bucketCounts: Array(10).fill(0),
    bucketHits: Array(10).fill(0),
  };
}

function mapEffectiveProfile(
  address: Address,
  handle: string,
  p: RawEffectiveProfile,
): EffectiveProfileSnapshot {
  const roundsScored = Number(p.roundsScored);
  const meanBrier = Number(p.meanBrier);
  return {
    address,
    handle,
    handleHash: p.handleHash,
    roundsCommitted: Number(p.roundsCommitted),
    roundsRevealed: Number(p.roundsRevealed),
    roundsScored,
    competitiveRoundsScored: Number(p.competitiveRoundsScored),
    roundsMissed: Number(p.roundsMissed),
    firstActiveAt: Number(p.firstActiveAt),
    cumulativeBrier: p.cumulativeBrier.toString(),
    totalVolumeWei: p.totalVolumeWei.toString(),
    meanBrier,
    bssPct: roundsScored > 0 ? brierSkillScorePct(meanBrier) : 0,
    revealRateBps: Number(p.revealRateBps),
    isVerified: Boolean(p.isVerified),
    bucketCounts: p.bucketCounts.map((v) => Number(v)),
    bucketHits: p.bucketHits.map((v) => Number(v)),
  };
}

const globalForReckon = globalThis as typeof globalThis & {
  __reckonChainReader?: ChainReader | null;
};

export function getChainReader(): ChainReader {
  if (!globalForReckon.__reckonChainReader) {
    globalForReckon.__reckonChainReader = new BscChainReader();
  }
  return globalForReckon.__reckonChainReader;
}

export function setChainReaderForTests(reader: ChainReader | null): void {
  globalForReckon.__reckonChainReader = reader;
}

export const SYSTEM_ZERO_ADDRESS = ZERO_ADDRESS;
