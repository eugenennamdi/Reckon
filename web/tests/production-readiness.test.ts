import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { decodeFunctionData, encodeFunctionData, getAddress, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { reckonCoreAbi } from "@/lib/abi";
import { BscChainReader } from "@/lib/reckon/chain";
import { BSC_CHAIN_ID, BSC_STABLECOINS } from "@/lib/reckon/constants";
import { buildSignalAttestationTypedData, hashThesis } from "@/lib/x402/attestation";
import {
  UpstashRedisSignalStore,
  getSignalStore,
  getSignalStoreBackendName,
  setSignalStoreForTests,
} from "@/lib/x402/store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SYNC_SCRIPT = path.join(REPO_ROOT, "scripts/sync-deployment.mjs");
const SELLER = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

function createMockUpstashFetch() {
  const kv = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const lists = new Map<string, string[]>();

  const fetchImpl = (async (_url: string | URL, init?: RequestInit) => {
    const cmd = JSON.parse(String(init?.body || "[]")) as Array<string | number>;
    const op = String(cmd[0]).toUpperCase();
    let result: unknown = null;

    if (op === "SET") {
      const key = String(cmd[1]);
      const val = String(cmd[2]);
      const hasNx = cmd.slice(3).some((x) => String(x).toUpperCase() === "NX");
      if (hasNx && kv.has(key)) {
        result = null;
      } else {
        kv.set(key, val);
        result = "OK";
      }
    } else if (op === "GET") {
      result = kv.get(String(cmd[1])) ?? null;
    } else if (op === "DEL") {
      result = kv.delete(String(cmd[1])) ? 1 : 0;
    } else if (op === "HSET") {
      const hkey = String(cmd[1]);
      const field = String(cmd[2]);
      const val = String(cmd[3]);
      if (!hashes.has(hkey)) hashes.set(hkey, new Map());
      hashes.get(hkey)!.set(field, val);
      result = 1;
    } else if (op === "HGET") {
      result = hashes.get(String(cmd[1]))?.get(String(cmd[2])) ?? null;
    } else if (op === "HMGET") {
      const h = hashes.get(String(cmd[1]));
      result = cmd.slice(2).map((f) => h?.get(String(f)) ?? null);
    } else if (op === "LPUSH") {
      const lkey = String(cmd[1]);
      if (!lists.has(lkey)) lists.set(lkey, []);
      lists.get(lkey)!.unshift(String(cmd[2]));
      result = lists.get(lkey)!.length;
    } else if (op === "RPUSH") {
      const lkey = String(cmd[1]);
      if (!lists.has(lkey)) lists.set(lkey, []);
      lists.get(lkey)!.push(String(cmd[2]));
      result = lists.get(lkey)!.length;
    } else if (op === "LRANGE") {
      const arr = lists.get(String(cmd[1])) ?? [];
      const start = Number(cmd[2]);
      const stop = Number(cmd[3]);
      result = arr.slice(start, stop + 1);
    } else if (op === "LLEN") {
      result = (lists.get(String(cmd[1])) ?? []).length;
    }

    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return { fetchImpl, hashes };
}

describe("Production-Readiness: Persistent Store, Deployment Sync & Keeperless Bracket", () => {
  const prevRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevRedisTok = process.env.UPSTASH_REDIS_REST_TOKEN;
  let tmpDir: string | null = null;

  beforeEach(() => {
    setSignalStoreForTests(null);
  });

  afterEach(() => {
    setSignalStoreForTests(null);
    if (prevRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = prevRedisUrl;
    if (prevRedisTok === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = prevRedisTok;
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it("auto-selects UpstashRedisSignalStore when env vars are set and encrypts theses + locks nonces", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    getSignalStore();
    assert.equal(getSignalStoreBackendName(), "encrypted-json");

    setSignalStoreForTests(null);
    process.env.UPSTASH_REDIS_REST_URL = "https://mock-upstash.local";
    process.env.UPSTASH_REDIS_REST_TOKEN = "mock-token";
    getSignalStore();
    assert.equal(getSignalStoreBackendName(), "upstash-redis");

    const { fetchImpl, hashes } = createMockUpstashFetch();
    const store = new UpstashRedisSignalStore({
      url: "https://mock-upstash.local",
      token: "mock-token",
      encryptionKey: "upstash-test-secret",
      fetchImpl,
    });

    const thesis = "BNB/USD cross-exchange funding basis and liquidity tilt positive.";
    const nowSec = Math.floor(Date.now() / 1000);
    const attestation = {
      chainId: BSC_CHAIN_ID,
      coreAddress: "0x1111111111111111111111111111111111111111" as Address,
      feedId: 0,
      epochId: 83000,
      tierId: 0,
      roundId: 4,
      seller: SELLER.address,
      claimedProbBps: 7400,
      thesisHash: hashThesis(thesis),
      issuedAt: nowSec,
    };
    const signature = await SELLER.signTypedData(buildSignalAttestationTypedData(attestation));

    const created = await store.createSignal({
      seller: SELLER.address,
      roundId: 4,
      feedId: 0,
      epochId: 83000,
      tierId: 0,
      coreAddress: attestation.coreAddress,
      title: "BNB Basis Tilt",
      summary: "Encrypted Upstash signal test",
      priceAtomic: "500000000000000000",
      preferredToken: BSC_STABLECOINS[0].address,
      claimedProbBps: 7400,
      thesis,
      thesisHash: attestation.thesisHash,
      attestation,
      signature,
    });

    const rawStored = hashes.get("reckon:v1:signals")?.get(created.id) ?? "";
    assert.equal(rawStored.includes(thesis), false, "Plaintext thesis must never sit unencrypted in Redis");
    assert.equal(store.decryptThesis(created), thesis);

    const fetched = await store.findBySellerAndRound(SELLER.address, 4);
    assert.equal(fetched?.id, created.id);
    const listed = await store.listSignals();
    assert.equal(listed.length, 1);

    await assert.rejects(() =>
      store.createSignal({
        seller: SELLER.address,
        roundId: 4,
        feedId: 0,
        epochId: 83000,
        tierId: 0,
        coreAddress: attestation.coreAddress,
        title: "Dup",
        summary: "Dup",
        priceAtomic: "500000000000000000",
        preferredToken: BSC_STABLECOINS[0].address,
        claimedProbBps: 7400,
        thesis,
        thesisHash: attestation.thesisHash,
        attestation,
        signature,
      }),
    );

    assert.equal(await store.tryClaimNonce("n1"), true);
    assert.equal(await store.tryClaimNonce("n1"), false);
    await store.releaseNonce("n1");
    assert.equal(await store.tryClaimNonce("n1"), true);

    await store.recordPurchase({
      signalId: created.id,
      payer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      payTo: SELLER.address,
      asset: BSC_STABLECOINS[0].address,
      amountAtomic: "500000000000000000",
      txHash: `0x${"aa".repeat(32)}` as Hex,
      facilitatorMode: "self-hosted-bsc",
    });
    assert.equal(await store.getPurchaseCount(created.id), 1);
  });

  it("syncs mainnet deployment addresses idempotently across all 5 target files", () => {
    const syncDir = fs.mkdtempSync(path.join(os.tmpdir(), "reckon-sync-"));
    tmpDir = syncDir;
    const relFiles = [
      "web/.env.example",
      "web/src/lib/reckon/constants.ts",
      "skills/reckon/scripts/reckon-cli.mjs",
      "skills/reckon/SKILL.md",
      "README.md",
    ];
    for (const rel of relFiles) {
      const dst = path.join(syncDir, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(REPO_ROOT, rel), dst);
    }

    const core1 = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
    const reg1 = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
    const res1 = JSON.parse(
      execFileSync(
        "node",
        [SYNC_SCRIPT, "--root", syncDir, "--core", core1.toLowerCase(), "--registry", reg1.toLowerCase()],
        { encoding: "utf8" },
      ),
    ) as { ok: boolean; coreAddress: string; registryAddress: string };

    assert.equal(res1.ok, true);
    assert.equal(res1.coreAddress, core1);
    assert.equal(res1.registryAddress, reg1);

    for (const rel of relFiles) {
      const content = fs.readFileSync(path.join(syncDir, rel), "utf8");
      assert.ok(content.includes(core1), `${rel} must contain checksummed ReckonCore`);
      assert.ok(content.includes(reg1), `${rel} must contain checksummed ReckonSignalRegistry`);
      assert.equal(content.includes("<RECKON_CORE_ADDRESS>"), false);
      assert.equal(content.includes("<RECKON_SIGNAL_REGISTRY_ADDRESS>"), false);
    }

    // Re-run with new addresses -> confirms clean replacement without duplicate blocks
    const core2 = getAddress("0xcccccccccccccccccccccccccccccccccccccccc");
    const reg2 = getAddress("0xdddddddddddddddddddddddddddddddddddddddd");
    execFileSync("node", [SYNC_SCRIPT, "--root", syncDir, "--core", core2, "--registry", reg2], {
      encoding: "utf8",
    });

    for (const rel of relFiles) {
      const content = fs.readFileSync(path.join(syncDir, rel), "utf8");
      assert.ok(content.includes(core2), `${rel} must update to new ReckonCore`);
      assert.ok(content.includes(reg2), `${rel} must update to new ReckonSignalRegistry`);
      assert.equal(content.includes(core1), false, `${rel} must not retain stale core1`);
      assert.equal(content.includes(reg1), false, `${rel} must not retain stale reg1`);
    }

    // Reject zero address and identical addresses
    assert.throws(() =>
      execFileSync(
        "node",
        [SYNC_SCRIPT, "--root", syncDir, "--core", "0x0000000000000000000000000000000000000000", "--registry", reg2],
        { stdio: "pipe" },
      ),
    );
    assert.throws(() =>
      execFileSync("node", [SYNC_SCRIPT, "--root", syncDir, "--core", core2, "--registry", core2], {
        stdio: "pipe",
      }),
    );
  });

  it("finds Chainlink bracket in <= 4 multicalls over 10,000 rounds and builds fixAndSettleOracle calldata", async () => {
    const reader = new BscChainReader();
    const phase = 3n;
    const latestAgg = 10_000n;
    const baseTime = 1_795_000_000;
    const stepSec = 30;
    let multicallCount = 0;

    const fakeRound = (agg: bigint) => {
      const id = (phase << 64n) | agg;
      const uAt = BigInt(baseTime + Number(agg) * stepSec);
      const ans = 59_000_000_000n + agg * 1000n;
      return [id, ans, uAt - 5n, uAt, id] as const;
    };

    // Patch underlying publicClient methods with deterministic synthetic Chainlink history
    const client = reader.getPublicClient() as unknown as {
      readContract: (p: { functionName: string; args?: readonly [bigint] }) => Promise<unknown>;
      multicall: (p: {
        contracts: Array<{ functionName: string; args?: readonly [bigint] }>;
      }) => Promise<Array<{ status: "success"; result: unknown }>>;
    };

    client.readContract = async (p) => {
      if (p.functionName === "latestRoundData") return fakeRound(latestAgg);
      if (p.functionName === "getRoundData" && p.args) {
        const agg = p.args[0] & ((1n << 64n) - 1n);
        return fakeRound(agg);
      }
      throw new Error(`Unexpected readContract ${p.functionName}`);
    };

    client.multicall = async (p) => {
      multicallCount++;
      return p.contracts.map((c) => {
        const agg = c.args![0] & ((1n << 64n) - 1n);
        return { status: "success" as const, result: fakeRound(agg) };
      });
    };

    const commitEnd = baseTime + 5_432 * stepSec + 11;
    const resolveTime = baseTime + 5_912 * stepSec + 17;

    const strike = await reader.findChainlinkBracket(0, commitEnd);
    const strikeCalls = multicallCount;
    assert.ok(strikeCalls <= 4, `Expected <= 4 multicalls, got ${strikeCalls}`);
    assert.equal(strike.roundId, ((phase << 64n) | 5432n).toString());
    assert.equal(strike.nextRoundId, ((phase << 64n) | 5433n).toString());

    const resolve = await reader.findChainlinkBracket(0, resolveTime);
    const calldata = encodeFunctionData({
      abi: reckonCoreAbi,
      functionName: "fixAndSettleOracle",
      args: [
        1n,
        BigInt(strike.roundId),
        BigInt(strike.nextRoundId),
        BigInt(resolve.roundId),
        BigInt(resolve.nextRoundId),
      ],
    });
    const decoded = decodeFunctionData({ abi: reckonCoreAbi, data: calldata });
    assert.equal(decoded.functionName, "fixAndSettleOracle");
    assert.equal(decoded.args[1], BigInt(strike.roundId));
    assert.equal(decoded.args[3], BigInt(resolve.roundId));

    // Confirm signature hash exists cleanly on keccak
    assert.ok(keccak256(calldata).startsWith("0x"));
  });

  it("brackets Chainlink timestamps across aggregator phase rollovers (phase N-1 -> phase N)", async () => {
    const reader = new BscChainReader();
    const prevPhaseMax = 500n;
    const currPhaseMax = 25n;
    const baseTime = 1_795_000_000;
    const stepSec = 30;

    const getRoundTuple = (fullId: bigint) => {
      const ph = fullId >> 64n;
      const agg = fullId & ((1n << 64n) - 1n);
      if (ph === 2n && agg >= 1n && agg <= prevPhaseMax) {
        const uAt = BigInt(baseTime + Number(agg) * stepSec);
        return [fullId, 58_000_000_000n + agg, uAt - 2n, uAt, fullId] as const;
      }
      if (ph === 3n && agg >= 1n && agg <= currPhaseMax) {
        const uAt = BigInt(baseTime + Number(prevPhaseMax + agg) * stepSec + 100);
        return [fullId, 59_000_000_000n + agg, uAt - 2n, uAt, fullId] as const;
      }
      throw new Error(`No data for phase=${ph} agg=${agg}`);
    };

    const client = reader.getPublicClient() as unknown as {
      readContract: (p: { functionName: string; args?: readonly [bigint] }) => Promise<unknown>;
      multicall: (p: {
        contracts: Array<{ functionName: string; args?: readonly [bigint] }>;
      }) => Promise<Array<{ status: "success" | "failure"; result?: unknown }>>;
    };

    client.readContract = async (p) => {
      if (p.functionName === "latestRoundData") return getRoundTuple((3n << 64n) | currPhaseMax);
      if (p.functionName === "getRoundData" && p.args) return getRoundTuple(p.args[0]);
      throw new Error(`Unexpected readContract ${p.functionName}`);
    };

    client.multicall = async (p) =>
      p.contracts.map((c) => {
        try {
          return { status: "success" as const, result: getRoundTuple(c.args![0]) };
        } catch {
          return { status: "failure" as const };
        }
      });

    // 1. Exact seam between phase 2 round 500 and phase 3 round 1
    const boundaryTarget = baseTime + Number(prevPhaseMax) * stepSec + 40;
    const boundaryBracket = await reader.findChainlinkBracket(0, boundaryTarget);
    assert.equal(boundaryBracket.roundId, ((2n << 64n) | prevPhaseMax).toString());
    assert.equal(boundaryBracket.nextRoundId, ((3n << 64n) | 1n).toString());

    // 2. Historical timestamp inside phase 2
    const insidePrevTarget = baseTime + 210 * stepSec + 12;
    const prevBracket = await reader.findChainlinkBracket(0, insidePrevTarget);
    assert.equal(prevBracket.roundId, ((2n << 64n) | 210n).toString());
    assert.equal(prevBracket.nextRoundId, ((2n << 64n) | 211n).toString());
  });
});
