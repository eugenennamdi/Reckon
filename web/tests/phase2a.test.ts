import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GET as getLeaderboardRoute } from "@/app/api/leaderboard/route";
import { GET as getMcpRoute, POST as postMcpRoute } from "@/app/api/mcp/route";
import { GET as getRoundsRoute } from "@/app/api/rounds/route";
import { GET as getSignalByIdRoute } from "@/app/api/signals/[id]/route";
import { POST as publishSignalRoute } from "@/app/api/signals/publish/route";
import { GET as listSignalsRoute } from "@/app/api/signals/route";
import {
  setChainReaderForTests,
  type ChainReader,
  type EffectiveProfileSnapshot,
  type EntrySnapshot,
  type RoundSnapshot,
} from "@/lib/reckon/chain";
import { computeCommitment, computeRoundKey, epochTiming } from "@/lib/reckon/commitment";
import {
  BSC_CAIP2,
  BSC_CHAIN_ID,
  BSC_STABLECOINS,
  PERMIT2_ADDRESS,
  X402_EXACT_PERMIT2_PROXY,
  type RoundStateName,
} from "@/lib/reckon/constants";
import {
  buildSignalAttestationTypedData,
  hashThesis,
  verifySignalAttestation,
  type SignalAttestationPayload,
} from "@/lib/x402/attestation";
import {
  EIP3009_TYPED_DATA_TYPES,
  FacilitatorError,
  PERMIT2_WITNESS_TYPED_DATA_TYPES,
  setFetchForTests,
  setSettlementExecutorForTests,
  type SettlementExecutor,
} from "@/lib/x402/facilitator";
import { decodeBase64Json, encodeBase64Json } from "@/lib/x402/protocol";
import { resetRateLimitsForTests } from "@/lib/x402/rateLimit";
import { EncryptedJsonSignalStore, setSignalStoreForTests } from "@/lib/x402/store";

const CORE_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;
const REGISTRY_ADDRESS = "0x2222222222222222222222222222222222222222" as Address;

const SELLER_ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const BUYER_ACCOUNT = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const RELAYER_ADDRESS = "0x9999999999999999999999999999999999999999" as Address;

interface MockChainState {
  verified: Map<string, boolean>;
  committed: Map<string, boolean>;
  rounds: Map<number, RoundSnapshot>;
  entries: Map<string, EntrySnapshot>;
  profiles: Map<string, EffectiveProfileSnapshot>;
}

function makeProfile(address: Address, handle: string, isVerified: boolean): EffectiveProfileSnapshot {
  return {
    address,
    handle,
    handleHash: keccak256(Buffer.from(handle)),
    roundsCommitted: 4,
    roundsRevealed: 4,
    roundsScored: 4,
    competitiveRoundsScored: 4,
    roundsMissed: 0,
    firstActiveAt: 1700000000,
    cumulativeBrier: "352000000",
    totalVolumeWei: "8000000000000000",
    meanBrier: 88_000_000,
    bssPct: 52,
    revealRateBps: 10_000,
    isVerified,
    bucketCounts: [0, 0, 0, 0, 0, 0, 0, 2, 2, 0],
    bucketHits: [0, 0, 0, 0, 0, 0, 0, 2, 2, 0],
  };
}

function makeMockChainReader(state: MockChainState): ChainReader {
  return {
    getCoreAddress: () => CORE_ADDRESS,
    getRegistryAddress: () => REGISTRY_ADDRESS,
    getPublicClient: () => ({}) as PublicClient,
    getLivePrices: async () => [
      {
        feedId: 0,
        symbol: "BNB/USD",
        base: "BNB",
        address: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
        roundId: "1001",
        answer8: "59000000000",
        updatedAt: Math.floor(Date.now() / 1000) - 10,
      },
      {
        feedId: 1,
        symbol: "BTC/USD",
        base: "BTC",
        address: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
        roundId: "1002",
        answer8: "6400000000000",
        updatedAt: Math.floor(Date.now() / 1000) - 10,
      },
      {
        feedId: 2,
        symbol: "ETH/USD",
        base: "ETH",
        address: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
        roundId: "1003",
        answer8: "185000000000",
        updatedAt: Math.floor(Date.now() / 1000) - 10,
      },
    ],
    getCanonicalRounds: async ({ epochIds }) => {
      const out: RoundSnapshot[] = [];
      for (const epochId of epochIds) {
        for (let f = 0; f < 3; f++) {
          for (let t = 0; t < 3; t++) {
            const timing = epochTiming(epochId);
            out.push({
              roundId: 0,
              feedId: f,
              feedSymbol: f === 0 ? "BNB/USD" : f === 1 ? "BTC/USD" : "ETH/USD",
              tierId: t,
              tierLabel: t === 0 ? "Starter" : t === 1 ? "Standard" : "Pro",
              stakeWei: t === 0 ? "2000000000000000" : t === 1 ? "5000000000000000" : "10000000000000000",
              stakeBnb: t === 0 ? "0.002" : t === 1 ? "0.005" : "0.01",
              state: "OPEN",
              instantiated: false,
              ...timing,
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
            });
          }
        }
      }
      return out;
    },
    getRoundAndEntry: async (roundId, agent) => {
      const round = state.rounds.get(roundId) ?? null;
      const entry = agent
        ? (state.entries.get(`${roundId}:${agent.toLowerCase()}`) ?? null)
        : null;
      return { round, entry };
    },
    getAgentPendingRounds: async (agent) => {
      const out: RoundSnapshot[] = [];
      for (const [rId, round] of state.rounds.entries()) {
        if (state.committed.get(`${rId}:${agent.toLowerCase()}`)) {
          out.push(round);
        }
      }
      return out;
    },
    isVerifiedForecaster: async (agent) => state.verified.get(agent.toLowerCase()) ?? false,
    hasCommitted: async (roundId, agent) =>
      state.committed.get(`${roundId}:${agent.toLowerCase()}`) ?? false,
    getEffectiveProfile: async (agent) =>
      state.profiles.get(agent.toLowerCase()) ?? makeProfile(agent, "unknown", false),
    getHandleOf: async (agent) => state.profiles.get(agent.toLowerCase())?.handle ?? "",
    getLeaderboard: async () => ({
      totalAgents: state.profiles.size,
      agents: [...state.profiles.values()],
    }),
    getProviders: async () => ({
      totalProviders: 1,
      providers: [
        {
          agent: SELLER_ACCOUNT.address,
          handle: "alpha",
          endpointUrl: "https://signals.reckon.example/api/signals",
          bio: "Systematic BSC momentum forecaster",
          paymentToken: BSC_STABLECOINS[0].address,
          priceAtomic: "500000000000000000",
          updatedAt: 1700000000,
          listingActive: true,
          meanBrier: 88_000_000,
          bssPct: 52,
          revealRateBps: 10_000,
          competitiveRoundsScored: 4,
        },
      ],
    }),
    findChainlinkBracket: async () => ({
      roundId: "100",
      nextRoundId: "101",
      price8: "59000000000",
      updatedAt: 1700000000,
    }),
  };
}

function makeLockedRound(roundId: number, feedId = 0, epochId = 80000, tierId = 0): RoundSnapshot {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    roundId,
    feedId,
    feedSymbol: "BNB/USD",
    epochId,
    tierId,
    tierLabel: "Starter",
    stakeWei: "2000000000000000",
    stakeBnb: "0.002",
    state: "LOCKED",
    instantiated: true,
    openTime: nowSec - 4000,
    commitEnd: nowSec - 400,
    resolveTime: nowSec + 7200,
    revealEnd: nowSec + 10800,
    committedCount: 3,
    revealedCount: 0,
    claimedCount: 0,
    remainingPoolWei: "6000000000000000",
    strikeFixed: true,
    oracleSettled: false,
    oracleCancelled: false,
    outcome: 0,
    strikePrice8: "59000000000",
    settlePrice8: "0",
    sumP: "0",
    sumP2: "0",
  };
}

async function signAttestation(
  overrides: Partial<SignalAttestationPayload> = {},
  thesis = "Orderbook liquidity imbalance and Chainlink basis point above strike.",
) {
  const nowSec = Math.floor(Date.now() / 1000);
  const attestation: SignalAttestationPayload = {
    chainId: BSC_CHAIN_ID,
    coreAddress: CORE_ADDRESS,
    feedId: 0,
    epochId: 80000,
    tierId: 0,
    roundId: 1,
    seller: SELLER_ACCOUNT.address,
    claimedProbBps: 7600,
    thesisHash: hashThesis(thesis),
    issuedAt: nowSec,
    ...overrides,
  };
  const typed = buildSignalAttestationTypedData(attestation);
  const signature = await SELLER_ACCOUNT.signTypedData(typed);
  return { attestation, signature, thesis };
}

describe("Phase 2A — Commitments, Attestations, Dual-Mode B402/x402 & APIs", () => {
  let tmpDir: string;
  let storeFile: string;
  let mockState: MockChainState;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reckon-2a-"));
    storeFile = path.join(tmpDir, "signals.json");
    setSignalStoreForTests(
      new EncryptedJsonSignalStore({
        filePath: storeFile,
        encryptionKey: "test-secret-key-32-bytes-reckon",
      }),
    );

    mockState = {
      verified: new Map([[SELLER_ACCOUNT.address.toLowerCase(), true]]),
      committed: new Map([[`1:${SELLER_ACCOUNT.address.toLowerCase()}`, true]]),
      rounds: new Map([[1, makeLockedRound(1)]]),
      entries: new Map(),
      profiles: new Map([
        [SELLER_ACCOUNT.address.toLowerCase(), makeProfile(SELLER_ACCOUNT.address, "alpha", true)],
      ]),
    };
    setChainReaderForTests(makeMockChainReader(mockState));
    resetRateLimitsForTests();

    savedEnv = {
      B402_CLIENT_ID: process.env.B402_CLIENT_ID,
      B402_ACCESS_TOKEN: process.env.B402_ACCESS_TOKEN,
      B402_PRIVATE_KEY_B64: process.env.B402_PRIVATE_KEY_B64,
      B402_BASE_URL: process.env.B402_BASE_URL,
      B402_SIGNER_ADDRESS: process.env.B402_SIGNER_ADDRESS,
    };
    delete process.env.B402_CLIENT_ID;
    delete process.env.B402_ACCESS_TOKEN;
    delete process.env.B402_PRIVATE_KEY_B64;
  });

  afterEach(() => {
    setChainReaderForTests(null);
    setSignalStoreForTests(null);
    setSettlementExecutorForTests(null);
    setFetchForTests(null);
    resetRateLimitsForTests();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("computes deterministic commitments and roundKeys matching Solidity ABI encoding", () => {
    const salt = `0x${"ab".repeat(32)}` as Hex;
    const commitment = computeCommitment({
      chainId: 56,
      coreAddress: CORE_ADDRESS,
      feedId: 1,
      epochId: 80000,
      tierId: 2,
      agent: SELLER_ACCOUNT.address,
      probBps: 7350,
      salt,
    });
    const manual = keccak256(
      encodeAbiParameters(
        parseAbiParameters("uint256, address, uint8, uint64, uint8, address, uint16, bytes32"),
        [56n, CORE_ADDRESS, 1, 80000n, 2, SELLER_ACCOUNT.address, 7350, salt],
      ),
    );
    assert.equal(commitment, manual);

    const rKey = computeRoundKey(1, 80000, 2);
    const manualKey = keccak256(
      encodeAbiParameters(parseAbiParameters("uint8, uint64, uint8"), [1, 80000n, 2]),
    );
    assert.equal(rKey, manualKey);
  });

  it("verifies SignalAttestation EIP-712 signatures and rejects tampering/staleness", async () => {
    const { attestation, signature, thesis } = await signAttestation();
    const ok = await verifySignalAttestation({
      attestation,
      signature,
      thesis,
      expectedCoreAddress: CORE_ADDRESS,
    });
    assert.equal(ok.valid, true);

    const tampered = await verifySignalAttestation({
      attestation,
      signature,
      thesis: `${thesis} tampered`,
      expectedCoreAddress: CORE_ADDRESS,
    });
    assert.equal(tampered.valid, false);

    const stale = await verifySignalAttestation({
      attestation: { ...attestation, issuedAt: Math.floor(Date.now() / 1000) - 2000 },
      signature,
      thesis,
      expectedCoreAddress: CORE_ADDRESS,
    });
    assert.equal(stale.valid, false);
  });

  it("enforces publish gates (LOCKED, verified, committed, price floor, duplicate, encrypted rest)", async () => {
    const { attestation, signature, thesis } = await signAttestation();

    // 1. Happy path -> 201 and encrypted thesis on disk
    const res = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({
          title: "BNB/USD Upside Skew Signal",
          summary: "Positive skew vs 4h forward strike",
          thesis,
          priceAtomic: "500000000000000000", // $0.50
          preferredToken: "USD1",
          attestation,
          signature,
        }),
      }),
    );
    assert.equal(res.status, 201);
    const created = (await res.json()) as { signal: { id: string } };
    assert.ok(created.signal.id.startsWith("sig_"));

    const rawDisk = fs.readFileSync(storeFile, "utf8");
    assert.equal(rawDisk.includes(thesis), false, "Plaintext thesis must be encrypted at rest");

    // 2. Duplicate (seller, roundId) -> 409
    const dupRes = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.2" },
        body: JSON.stringify({
          title: "Duplicate Signal",
          thesis,
          priceAtomic: "500000000000000000",
          attestation,
          signature,
        }),
      }),
    );
    assert.equal(dupRes.status, 409);

    // 3. Price below $0.10 floor -> 400
    const cheapRes = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Too Cheap Signal",
          thesis,
          priceAtomic: "50000000000000000", // $0.05
          attestation,
          signature,
        }),
      }),
    );
    assert.equal(cheapRes.status, 400);

    // 4. Unverified seller -> 403
    mockState.verified.set(SELLER_ACCOUNT.address.toLowerCase(), false);
    const unverifiedRes = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Unverified Seller Signal",
          thesis,
          priceAtomic: "500000000000000000",
          attestation,
          signature,
        }),
      }),
    );
    assert.equal(unverifiedRes.status, 403);
    mockState.verified.set(SELLER_ACCOUNT.address.toLowerCase(), true);

    // 5. Post-resolveTime REVEAL round -> 409
    const nowSec = Math.floor(Date.now() / 1000);
    const r2 = {
      ...makeLockedRound(2),
      state: "REVEAL" as RoundStateName,
      resolveTime: nowSec - 60,
    };
    mockState.rounds.set(2, r2);
    mockState.committed.set(`2:${SELLER_ACCOUNT.address.toLowerCase()}`, true);
    const att2 = await signAttestation({ roundId: 2 });
    const postResolveRes = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Late Signal",
          thesis: att2.thesis,
          priceAtomic: "500000000000000000",
          attestation: att2.attestation,
          signature: att2.signature,
        }),
      }),
    );
    assert.equal(postResolveRes.status, 409);
  });

  it("handles x402 v2 402 challenge, EIP-3009 (USD1), Permit2 (USDT), replay/sim guards, and Binance B402 mode", async () => {
    const { attestation, signature, thesis } = await signAttestation();
    const pubRes = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "BNB Volatility Alpha",
          thesis,
          priceAtomic: "500000000000000000",
          preferredToken: "USD1",
          attestation,
          signature,
        }),
      }),
    );
    const { signal } = (await pubRes.json()) as { signal: { id: string } };

    let failSim = false;
    const mockExecutor: SettlementExecutor = {
      getSignerAddress: () => RELAYER_ADDRESS,
      checkEip3009State: async () => ({ nonceUsed: false, balance: 10_000_000_000_000_000_000n }),
      checkPermit2State: async () => ({
        nonceUsed: false,
        allowance: 10_000_000_000_000_000_000n,
        balance: 10_000_000_000_000_000_000n,
      }),
      simulateAndSettleEip3009: async () => {
        if (failSim) throw new FacilitatorError("SIMULATION_FAILED", "reverted in eth_call", 402);
        return `0x${"11".repeat(32)}` as Hex;
      },
      simulateAndSettlePermit2: async () => `0x${"22".repeat(32)}` as Hex,
    };
    setSettlementExecutorForTests(mockExecutor);

    // 1. Unpaid request -> HTTP 402 with full PAYMENT-REQUIRED header + extra metadata
    const challengeRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(challengeRes.status, 402);
    const prHeader = challengeRes.headers.get("payment-required");
    assert.ok(prHeader);
    const decodedPr = decodeBase64Json<{
      x402Version: number;
      accepts: Array<{
        asset: Address;
        payTo: Address;
        network: string;
        extra: {
          name: string;
          version: string;
          assetTransferMethod: string;
          signerAddress: Address;
          spenderAddress?: Address;
        };
      }>;
    }>(prHeader);
    assert.equal(decodedPr.x402Version, 2);
    const usd1Req = decodedPr.accepts.find(
      (a) => a.asset.toLowerCase() === BSC_STABLECOINS[0].address.toLowerCase(),
    );
    const usdtReq = decodedPr.accepts.find(
      (a) => a.asset.toLowerCase() === BSC_STABLECOINS[2].address.toLowerCase(),
    );
    assert.ok(usd1Req && usdtReq);
    assert.equal(usd1Req.payTo, getAddress(SELLER_ACCOUNT.address));
    assert.equal(usd1Req.extra.name, "World Liberty Financial USD");
    assert.equal(usd1Req.extra.version, "1");
    assert.equal(usd1Req.extra.assetTransferMethod, "eip3009");
    assert.equal(usd1Req.extra.signerAddress, RELAYER_ADDRESS);
    assert.equal(usdtReq.extra.assetTransferMethod, "permit2");
    assert.equal(usdtReq.extra.spenderAddress, X402_EXACT_PERMIT2_PROXY);

    // 2. Self-Hosted EIP-3009 (USD1) valid payment -> 200 + PAYMENT-RESPONSE
    const nowSec = Math.floor(Date.now() / 1000);
    const nonce3009 = `0x${crypto.randomBytes(32).toString("hex")}` as Hex;
    const eip3009Sig = await BUYER_ACCOUNT.signTypedData({
      domain: {
        name: "World Liberty Financial USD",
        version: "1",
        chainId: BigInt(BSC_CHAIN_ID),
        verifyingContract: BSC_STABLECOINS[0].address,
      },
      types: EIP3009_TYPED_DATA_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: BUYER_ACCOUNT.address,
        to: SELLER_ACCOUNT.address,
        value: 500_000_000_000_000_000n,
        validAfter: BigInt(nowSec - 10),
        validBefore: BigInt(nowSec + 300),
        nonce: nonce3009,
      },
    });
    const env3009 = encodeBase64Json({
      x402Version: 2,
      accepted: usd1Req,
      payload: {
        signature: eip3009Sig,
        authorization: {
          from: BUYER_ACCOUNT.address,
          to: SELLER_ACCOUNT.address,
          value: "500000000000000000",
          validAfter: String(nowSec - 10),
          validBefore: String(nowSec + 300),
          nonce: nonce3009,
        },
      },
    });
    const paidRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": env3009 },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(paidRes.status, 200);
    assert.ok(paidRes.headers.get("payment-response"));
    const paidBody = (await paidRes.json()) as {
      signal: { thesis: string; claimedProbBps: number };
      receipt: { txHash: string; facilitatorMode: string };
    };
    assert.equal(paidBody.signal.thesis, thesis);
    assert.equal(paidBody.signal.claimedProbBps, 7600);
    assert.equal(paidBody.receipt.facilitatorMode, "self-hosted-bsc");

    // 3. Replay exact same EIP-3009 nonce -> 402 NONCE_REPLAYED
    const replayRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": env3009 },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(replayRes.status, 402);

    // 4. Adversarial checks: wrong payTo, self-pay, failed simulation
    const wrongPayToEnv = encodeBase64Json({
      x402Version: 2,
      accepted: { ...usd1Req, payTo: BUYER_ACCOUNT.address },
      payload: {
        signature: eip3009Sig,
        authorization: {
          from: BUYER_ACCOUNT.address,
          to: BUYER_ACCOUNT.address,
          value: "500000000000000000",
          validAfter: String(nowSec - 10),
          validBefore: String(nowSec + 300),
          nonce: `0x${crypto.randomBytes(32).toString("hex")}`,
        },
      },
    });
    const wrongRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": wrongPayToEnv },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(wrongRes.status, 402);

    // Simulation failure test (with fresh valid signature)
    failSim = true;
    const simNonce = `0x${crypto.randomBytes(32).toString("hex")}` as Hex;
    const simSig = await BUYER_ACCOUNT.signTypedData({
      domain: {
        name: "World Liberty Financial USD",
        version: "1",
        chainId: BigInt(BSC_CHAIN_ID),
        verifyingContract: BSC_STABLECOINS[0].address,
      },
      types: EIP3009_TYPED_DATA_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: BUYER_ACCOUNT.address,
        to: SELLER_ACCOUNT.address,
        value: 500_000_000_000_000_000n,
        validAfter: BigInt(nowSec - 10),
        validBefore: BigInt(nowSec + 300),
        nonce: simNonce,
      },
    });
    const simRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: {
          "payment-signature": encodeBase64Json({
            x402Version: 2,
            accepted: usd1Req,
            payload: {
              signature: simSig,
              authorization: {
                from: BUYER_ACCOUNT.address,
                to: SELLER_ACCOUNT.address,
                value: "500000000000000000",
                validAfter: String(nowSec - 10),
                validBefore: String(nowSec + 300),
                nonce: simNonce,
              },
            },
          }),
        },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(simRes.status, 402);
    failSim = false;

    // 5. Self-Hosted Permit2 (USDT) valid payment (Permit2 domain has NO version!) -> 200
    const p2Nonce = 987654321n;
    const p2Deadline = BigInt(nowSec + 300);
    const p2ValidAfter = BigInt(nowSec - 10);
    const p2Sig = await BUYER_ACCOUNT.signTypedData({
      domain: {
        name: "Permit2",
        chainId: BigInt(BSC_CHAIN_ID),
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: PERMIT2_WITNESS_TYPED_DATA_TYPES,
      primaryType: "PermitWitnessTransferFrom",
      message: {
        permitted: {
          token: BSC_STABLECOINS[2].address,
          amount: 500_000_000_000_000_000n,
        },
        spender: X402_EXACT_PERMIT2_PROXY,
        nonce: p2Nonce,
        deadline: p2Deadline,
        witness: {
          to: SELLER_ACCOUNT.address,
          validAfter: p2ValidAfter,
        },
      },
    });
    const p2Env = encodeBase64Json({
      x402Version: 2,
      accepted: usdtReq,
      payload: {
        signature: p2Sig,
        permit2Authorization: {
          permitted: {
            token: BSC_STABLECOINS[2].address,
            amount: "500000000000000000",
          },
          from: BUYER_ACCOUNT.address,
          spender: X402_EXACT_PERMIT2_PROXY,
          nonce: p2Nonce.toString(),
          deadline: p2Deadline.toString(),
          witness: {
            to: SELLER_ACCOUNT.address,
            validAfter: p2ValidAfter.toString(),
          },
        },
      },
    });
    const p2PaidRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": p2Env },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(p2PaidRes.status, 200);

    // 6. Binance B402 Mode: verify RSA-SHA256 signing & extensions.bazaar indexing
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 1024,
      privateKeyEncoding: { type: "pkcs8", format: "der" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    process.env.B402_CLIENT_ID = "client_test_123";
    process.env.B402_ACCESS_TOKEN = "token_test_abc";
    process.env.B402_PRIVATE_KEY_B64 = Buffer.from(privateKey).toString("base64");
    process.env.B402_BASE_URL = "https://mock-b402.binance.local";
    process.env.B402_SIGNER_ADDRESS = RELAYER_ADDRESS;

    const b402Calls: string[] = [];
    let sawBazaar = false;
    setFetchForTests((async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      b402Calls.push(url);
      if (url.endsWith("/supported")) {
        return new Response(JSON.stringify({ kinds: [] }), { status: 200 });
      }
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("X-Tesla-ClientId"), "client_test_123");
      assert.equal(headers.get("X-Tesla-SignAccessToken"), "token_test_abc");
      const ts = headers.get("X-Tesla-Timestamp")!;
      const sigB64 = headers.get("X-Tesla-Signature")!;
      const rawBody = String(init?.body || "");
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(rawBody + ts, "utf8");
      verifier.end();
      assert.equal(
        verifier.verify(publicKey, Buffer.from(sigB64, "base64")),
        true,
        "RSA-SHA256 X-Tesla-Signature must verify against public key",
      );

      const parsed = JSON.parse(rawBody) as {
        paymentPayload?: { extensions?: { bazaar?: { info?: { input?: { discoverable?: boolean } } } } };
      };
      if (url.endsWith("/verify")) {
        return new Response(JSON.stringify({ isValid: true }), { status: 200 });
      }
      if (url.endsWith("/settle")) {
        sawBazaar = Boolean(parsed.paymentPayload?.extensions?.bazaar?.info?.input?.discoverable);
        return new Response(
          JSON.stringify({ success: true, transaction: `0x${"bb".repeat(32)}` }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch);

    const b402Res = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": env3009 },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(b402Res.status, 200);
    const b402Body = (await b402Res.json()) as {
      receipt: { facilitatorMode: string; txHash: string };
    };
    assert.equal(b402Body.receipt.facilitatorMode, "binance-b402");
    assert.equal(sawBazaar, true);
    assert.ok(b402Calls.some((u) => u.endsWith("/papi/v2/b402/verify")));
    assert.ok(b402Calls.some((u) => u.endsWith("/papi/v2/b402/settle")));
  });

  it("redacts LOCKED claimedProbBps and computes post-REVEAL VERIFIED_MATCH / MISMATCH / UNREVEALED", async () => {
    // Signal 1 (Round 1, LOCKED)
    const a1 = await signAttestation({ roundId: 1, claimedProbBps: 7600 });
    await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Signal 1",
          thesis: a1.thesis,
          priceAtomic: "500000000000000000",
          attestation: a1.attestation,
          signature: a1.signature,
        }),
      }),
    );

    // While LOCKED, claimedProbBps MUST be redacted in public catalog
    const lockedCatalog = await listSignalsRoute(new Request("http://localhost:3000/api/signals"));
    const lockedData = (await lockedCatalog.json()) as {
      signals: Array<{
        roundId: number;
        claimedProbBps: number | null;
        claimedProbRedacted: boolean;
        integrity: { status: string; onChainRevealedProbBps: number | null };
      }>;
    };
    assert.equal(lockedData.signals[0].claimedProbRedacted, true);
    assert.equal(lockedData.signals[0].claimedProbBps, null);
    assert.equal(lockedData.signals[0].integrity.status, "PENDING");

    // Signal 2 (Round 2) and Signal 3 (Round 3) — initially LOCKED during publish, then transition to CLAIMABLE
    for (const rId of [2, 3]) {
      mockState.rounds.set(rId, makeLockedRound(rId));
      mockState.committed.set(`${rId}:${SELLER_ACCOUNT.address.toLowerCase()}`, true);
      const att = await signAttestation({ roundId: rId, claimedProbBps: 8100 });
      const pub = await publishSignalRoute(
        new Request("http://localhost:3000/api/signals/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: `Signal ${rId}`,
            thesis: att.thesis,
            priceAtomic: "500000000000000000",
            attestation: att.attestation,
            signature: att.signature,
          }),
        }),
      );
      assert.equal(pub.status, 201);
    }

    // Transition rounds to CLAIMABLE post-resolveTime:
    // Round 1 -> revealed 7600 (VERIFIED_MATCH)
    // Round 2 -> revealed 2100 (MISMATCH!)
    // Round 3 -> unrevealed (UNREVEALED)
    const pastResolve = Math.floor(Date.now() / 1000) - 4000;
    for (const rId of [1, 2, 3]) {
      const r = mockState.rounds.get(rId)!;
      mockState.rounds.set(rId, {
        ...r,
        state: rId === 3 ? "NO_REVEALS" : "CLAIMABLE",
        resolveTime: pastResolve,
        revealEnd: pastResolve + 3600,
      });
    }
    mockState.entries.set(`1:${SELLER_ACCOUNT.address.toLowerCase()}`, {
      committed: true,
      commitment: `0x${"01".repeat(32)}`,
      probBps: 7600,
      revealed: true,
      claimed: false,
      profileFlushed: false,
    });
    mockState.entries.set(`2:${SELLER_ACCOUNT.address.toLowerCase()}`, {
      committed: true,
      commitment: `0x${"02".repeat(32)}`,
      probBps: 2100,
      revealed: true,
      claimed: false,
      profileFlushed: false,
    });
    mockState.entries.set(`3:${SELLER_ACCOUNT.address.toLowerCase()}`, {
      committed: true,
      commitment: `0x${"03".repeat(32)}`,
      probBps: 0,
      revealed: false,
      claimed: false,
      profileFlushed: false,
    });

    const postCatalog = await listSignalsRoute(new Request("http://localhost:3000/api/signals"));
    const postData = (await postCatalog.json()) as {
      signals: Array<{
        roundId: number;
        claimedProbBps: number | null;
        claimedProbRedacted: boolean;
        integrity: { status: string; onChainRevealedProbBps: number | null };
      }>;
    };
    const byRound = new Map(postData.signals.map((s) => [s.roundId, s]));
    assert.equal(byRound.get(1)?.claimedProbRedacted, false);
    assert.equal(byRound.get(1)?.claimedProbBps, 7600);
    assert.equal(byRound.get(1)?.integrity.status, "VERIFIED_MATCH");
    assert.equal(byRound.get(1)?.integrity.onChainRevealedProbBps, 7600);

    assert.equal(byRound.get(2)?.integrity.status, "MISMATCH");
    assert.equal(byRound.get(2)?.integrity.onChainRevealedProbBps, 2100);

    assert.equal(byRound.get(3)?.integrity.status, "UNREVEALED");
    assert.equal(byRound.get(3)?.integrity.onChainRevealedProbBps, null);
  });

  it("serves /api/rounds, /api/leaderboard, and enforces per-IP rate limiting (429)", async () => {
    const roundsRes = await getRoundsRoute(new Request("http://localhost:3000/api/rounds?epochs=3"));
    assert.equal(roundsRes.status, 200);
    const roundsBody = (await roundsRes.json()) as {
      deployed: boolean;
      prices: unknown[];
      rounds: unknown[];
    };
    assert.equal(roundsBody.deployed, true);
    assert.equal(roundsBody.prices.length, 3);
    assert.equal(roundsBody.rounds.length, 27);

    const lbRes = await getLeaderboardRoute(new Request("http://localhost:3000/api/leaderboard"));
    assert.equal(lbRes.status, 200);
    const lbBody = (await lbRes.json()) as {
      totalAgents: number;
      agents: Array<{ handle: string }>;
      providers: unknown[];
    };
    assert.equal(lbBody.totalAgents, 1);
    assert.equal(lbBody.agents[0].handle, "alpha");
    assert.equal(lbBody.providers.length, 1);

    // Rate limiting check (20/min per IP on publish)
    const { attestation, signature, thesis } = await signAttestation();
    let hit429 = false;
    for (let i = 0; i < 25; i++) {
      const r = await publishSignalRoute(
        new Request("http://localhost:3000/api/signals/publish", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.42" },
          body: JSON.stringify({
            title: "Spam Test",
            thesis,
            priceAtomic: "1000000000000000", // triggers 400 after rate check pass, until 21st hits 429
            attestation,
            signature,
          }),
        }),
      );
      if (r.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.equal(hit429, true, "Rate limiter should return HTTP 429 on burst requests");
  });

  it("hardens x402 malformed inputs (402 not 500), pre-broadcast nonce release, fail-closed prod key, and /api/mcp", async () => {
    const { attestation, signature, thesis } = await signAttestation();
    const pubRes = await publishSignalRoute(
      new Request("http://localhost:3000/api/signals/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Hardening Test Signal",
          thesis,
          priceAtomic: "500000000000000000",
          preferredToken: "USD1",
          attestation,
          signature,
        }),
      }),
    );
    const { signal } = (await pubRes.json()) as { signal: { id: string } };

    // 1. Malformed PAYMENT-SIGNATURE address/value returns 402, never 500
    let preBroadcastFail = true;
    setSettlementExecutorForTests({
      getSignerAddress: () => RELAYER_ADDRESS,
      checkEip3009State: async () => {
        if (preBroadcastFail) throw new Error("transient RPC timeout before broadcast");
        return { nonceUsed: false, balance: 10_000_000_000_000_000_000n };
      },
      checkPermit2State: async () => ({
        nonceUsed: false,
        allowance: 10_000_000_000_000_000_000n,
        balance: 10_000_000_000_000_000_000n,
      }),
      simulateAndSettleEip3009: async () => `0x${"33".repeat(32)}` as Hex,
      simulateAndSettlePermit2: async () => `0x${"44".repeat(32)}` as Hex,
    });

    const challengeRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`),
      { params: Promise.resolve({ id: signal.id }) },
    );
    const pr = decodeBase64Json<{ accepts: Array<{ asset: Address }> }>(
      challengeRes.headers.get("payment-required")!,
    );
    const usd1Req = pr.accepts.find(
      (a) => a.asset.toLowerCase() === BSC_STABLECOINS[0].address.toLowerCase(),
    )!;

    const malformedEnv = encodeBase64Json({
      x402Version: 2,
      accepted: usd1Req,
      payload: {
        signature: "0x1234",
        authorization: {
          from: "not-an-address",
          to: SELLER_ACCOUNT.address,
          value: "not-a-bigint",
          validAfter: "0",
          validBefore: "99999999999",
          nonce: `0x${"55".repeat(32)}`,
        },
      },
    });
    const malformedRes = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": malformedEnv },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(malformedRes.status, 402);

    // 2. Pre-broadcast RPC failure releases nonce so identical valid retry succeeds
    const nowSec = Math.floor(Date.now() / 1000);
    const retryNonce = `0x${crypto.randomBytes(32).toString("hex")}` as Hex;
    const retrySig = await BUYER_ACCOUNT.signTypedData({
      domain: {
        name: "World Liberty Financial USD",
        version: "1",
        chainId: BigInt(BSC_CHAIN_ID),
        verifyingContract: BSC_STABLECOINS[0].address,
      },
      types: EIP3009_TYPED_DATA_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: BUYER_ACCOUNT.address,
        to: SELLER_ACCOUNT.address,
        value: 500_000_000_000_000_000n,
        validAfter: BigInt(nowSec - 10),
        validBefore: BigInt(nowSec + 300),
        nonce: retryNonce,
      },
    });
    const retryEnv = encodeBase64Json({
      x402Version: 2,
      accepted: usd1Req,
      payload: {
        signature: retrySig,
        authorization: {
          from: BUYER_ACCOUNT.address,
          to: SELLER_ACCOUNT.address,
          value: "500000000000000000",
          validAfter: String(nowSec - 10),
          validBefore: String(nowSec + 300),
          nonce: retryNonce,
        },
      },
    });
    const firstTry = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": retryEnv },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(firstTry.status, 502);

    preBroadcastFail = false;
    const secondTry = await getSignalByIdRoute(
      new Request(`http://localhost:3000/api/signals/${signal.id}`, {
        headers: { "payment-signature": retryEnv },
      }),
      { params: Promise.resolve({ id: signal.id }) },
    );
    assert.equal(secondTry.status, 200);

    // 3. Production fail-closed encryption key check
    const prevNodeEnv = process.env.NODE_ENV;
    const prevEncKey = process.env.RECKON_STORE_ENCRYPTION_KEY;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      delete process.env.RECKON_STORE_ENCRYPTION_KEY;
      assert.throws(() => new EncryptedJsonSignalStore({ filePath: storeFile }), /RECKON_STORE_ENCRYPTION_KEY/);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
      if (prevEncKey !== undefined) process.env.RECKON_STORE_ENCRYPTION_KEY = prevEncKey;
    }

    // 4. /api/rounds returns pendingRounds for agent & supports beforeEpoch
    const agentRoundsRes = await getRoundsRoute(
      new Request(`http://localhost:3000/api/rounds?agent=${SELLER_ACCOUNT.address}`),
    );
    assert.equal(agentRoundsRes.status, 200);
    const agentRoundsJson = (await agentRoundsRes.json()) as {
      rounds: unknown[];
      pendingRounds: Array<{ roundId: number }>;
    };
    assert.equal(agentRoundsJson.rounds.length, 36); // default 4 epochs * 9 slots
    assert.equal(agentRoundsJson.pendingRounds.length, 1);
    assert.equal(agentRoundsJson.pendingRounds[0].roundId, 1);

    // 5. /api/mcp discovery + JSON-RPC 2.0 tools
    const mcpGet = await getMcpRoute();
    assert.equal(mcpGet.status, 200);
    const mcpManifest = (await mcpGet.json()) as { tools: Array<{ name: string }> };
    assert.equal(mcpManifest.tools.length, 5);

    const mcpList = await postMcpRoute(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    assert.equal(mcpList.status, 200);
    const mcpListBody = (await mcpList.json()) as { result: { tools: Array<{ name: string }> } };
    assert.ok(mcpListBody.result.tools.some((t) => t.name === "reckon_prepare_commit"));

    const mcpCommit = await postMcpRoute(
      new Request("http://localhost:3000/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "reckon_prepare_commit",
            arguments: {
              feedId: 0,
              tierId: 0,
              epochId: 80000,
              agent: SELLER_ACCOUNT.address,
              commitment: `0x${"aa".repeat(32)}`,
            },
          },
        }),
      }),
    );
    assert.equal(mcpCommit.status, 200);
    const mcpCommitBody = (await mcpCommit.json()) as {
      result: { isError: boolean; structuredContent: { bawPreviewCommand: string; calldata: Hex } };
    };
    assert.equal(mcpCommitBody.result.isError, false);
    assert.ok(mcpCommitBody.result.structuredContent.bawPreviewCommand.includes("baw contract-call preview"));
    assert.ok(mcpCommitBody.result.structuredContent.calldata.startsWith("0x"));
  });
});
