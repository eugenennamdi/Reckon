import { encodeAbiParameters, keccak256, parseAbiParameters, type Address, type Hex } from "viem";
import {
  BRIER_SCALE,
  BSC_CHAIN_ID,
  COIN_FLIP_BRIER,
  COMMIT_DURATION,
  EPOCH_DURATION,
  MAX_PROB_BPS,
  MIN_PROB_BPS,
  OBSERVE_DURATION,
  PROB_SCALE,
  REVEAL_DURATION,
  type RoundStateName,
} from "./constants";

export interface CommitmentParams {
  chainId?: number;
  coreAddress: Address;
  feedId: number;
  epochId: number | bigint;
  tierId: number;
  agent: Address;
  probBps: number;
  salt: Hex;
}

const COMMITMENT_ABI_PARAMS = parseAbiParameters(
  "uint256, address, uint8, uint64, uint8, address, uint16, bytes32",
);
const ROUND_KEY_ABI_PARAMS = parseAbiParameters("uint8, uint64, uint8");

export function assertValidProbBps(probBps: number): void {
  if (!Number.isInteger(probBps) || probBps < MIN_PROB_BPS || probBps > MAX_PROB_BPS) {
    throw new Error(`probBps must be an integer in [${MIN_PROB_BPS}, ${MAX_PROB_BPS}], got ${probBps}`);
  }
}

export function assertValidSalt(salt: string): asserts salt is Hex {
  if (!/^0x[a-fA-F0-9]{64}$/.test(salt)) {
    throw new Error("salt must be a 32-byte 0x-prefixed hex string");
  }
}

export function computeCommitment(params: CommitmentParams): Hex {
  assertValidProbBps(params.probBps);
  assertValidSalt(params.salt);
  const chainId = BigInt(params.chainId ?? BSC_CHAIN_ID);
  return keccak256(
    encodeAbiParameters(COMMITMENT_ABI_PARAMS, [
      chainId,
      params.coreAddress,
      params.feedId,
      BigInt(params.epochId),
      params.tierId,
      params.agent,
      params.probBps,
      params.salt,
    ]),
  );
}

export function computeRoundKey(feedId: number, epochId: number | bigint, tierId: number): Hex {
  return keccak256(encodeAbiParameters(ROUND_KEY_ABI_PARAMS, [feedId, BigInt(epochId), tierId]));
}

export function currentEpochId(nowSec = Math.floor(Date.now() / 1000)): number {
  return Math.floor(nowSec / EPOCH_DURATION);
}

export interface EpochTiming {
  epochId: number;
  openTime: number;
  commitEnd: number;
  resolveTime: number;
  revealEnd: number;
}

export function epochTiming(epochId: number): EpochTiming {
  const openTime = epochId * EPOCH_DURATION;
  const commitEnd = openTime + COMMIT_DURATION;
  const resolveTime = commitEnd + OBSERVE_DURATION;
  const revealEnd = resolveTime + REVEAL_DURATION;
  return { epochId, openTime, commitEnd, resolveTime, revealEnd };
}

export function virtualRoundState(
  epochId: number,
  nowSec = Math.floor(Date.now() / 1000),
): RoundStateName {
  const t = epochTiming(epochId);
  if (nowSec < t.openTime) return "NONE";
  if (nowSec < t.commitEnd) return "OPEN";
  if (nowSec < t.resolveTime) return "LOCKED";
  if (nowSec < t.revealEnd) return "REVEAL";
  return "AWAITING_ORACLE";
}

export function brierScoreScaled(probBps: number, outcome: 0 | 1): number {
  assertValidProbBps(probBps);
  const diff = outcome === 1 ? PROB_SCALE - probBps : probBps;
  return BRIER_SCALE - diff * diff;
}

/**
 * Brier Skill Score relative to a 50% coin-flip baseline (0.7500).
 * Verified Forecaster threshold 0.7600 corresponds to +4.0% BSS (Elite 0.7800 = +12.0% BSS).
 */
export function brierSkillScorePct(meanBrierScaled: number): number {
  const denominator = BRIER_SCALE - COIN_FLIP_BRIER; // 0.25 * 1e8
  return ((meanBrierScaled - COIN_FLIP_BRIER) / denominator) * 100;
}

export function formatBrierScore(scaled: number | bigint): string {
  return (Number(scaled) / BRIER_SCALE).toFixed(4);
}

export function formatUsdPrice8(price8: bigint | string): string {
  const n = typeof price8 === "bigint" ? Number(price8) : Number(price8);
  return (n / 1e8).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatAtomicUsd(atomic: string | bigint, decimals = 18): string {
  const val = typeof atomic === "bigint" ? atomic : BigInt(atomic);
  const scale = 10n ** BigInt(decimals);
  const whole = val / scale;
  const frac = (val % scale).toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toString()}.${frac}`;
}

export interface SaltRecoveryRecord {
  version: 1;
  chainId: number;
  coreAddress: Address;
  agent: Address;
  feedId: number;
  epochId: number;
  tierId: number;
  roundId?: string;
  probBps: number;
  salt: Hex;
  commitment: Hex;
  createdAt: string;
}

export function encodeRecoveryToken(record: SaltRecoveryRecord): string {
  const json = JSON.stringify(record);
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(json, "utf8").toString("base64url")
      : btoa(unescape(encodeURIComponent(json)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/g, "");
  return `RKN1-${b64}`;
}

export function decodeRecoveryToken(token: string): SaltRecoveryRecord {
  const trimmed = token.trim();
  if (!trimmed.startsWith("RKN1-")) {
    throw new Error("Invalid recovery token prefix (expected RKN1-)");
  }
  const b64url = trimmed.slice(5);
  let json: string;
  if (typeof Buffer !== "undefined") {
    json = Buffer.from(b64url, "base64url").toString("utf8");
  } else {
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    json = decodeURIComponent(escape(atob(b64 + pad)));
  }
  const parsed = JSON.parse(json) as SaltRecoveryRecord;
  if (
    parsed.version !== 1 ||
    typeof parsed.feedId !== "number" ||
    typeof parsed.epochId !== "number" ||
    typeof parsed.tierId !== "number" ||
    typeof parsed.probBps !== "number" ||
    !parsed.salt ||
    !parsed.agent ||
    !parsed.coreAddress
  ) {
    throw new Error("Malformed salt recovery payload");
  }
  assertValidProbBps(parsed.probBps);
  assertValidSalt(parsed.salt);
  return parsed;
}
