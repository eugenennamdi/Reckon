import { getAddress, keccak256, toBytes, verifyTypedData, type Address, type Hex } from "viem";
import {
  BSC_CHAIN_ID,
  MAX_PROB_BPS,
  MIN_PROB_BPS,
  type RoundStateName,
} from "@/lib/reckon/constants";
import type { EntrySnapshot } from "@/lib/reckon/chain";

export interface SignalAttestationPayload {
  chainId: number;
  coreAddress: Address;
  feedId: number;
  epochId: number;
  tierId: number;
  roundId: number;
  seller: Address;
  claimedProbBps: number;
  thesisHash: Hex;
  issuedAt: number;
}

export const SIGNAL_ATTESTATION_TYPES = {
  SignalAttestation: [
    { name: "chainId", type: "uint256" },
    { name: "coreAddress", type: "address" },
    { name: "feedId", type: "uint8" },
    { name: "epochId", type: "uint64" },
    { name: "tierId", type: "uint8" },
    { name: "roundId", type: "uint64" },
    { name: "seller", type: "address" },
    { name: "claimedProbBps", type: "uint16" },
    { name: "thesisHash", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
  ],
} as const;

export function getSignalAttestationDomain(chainId: number, coreAddress: Address) {
  return {
    name: "ReckonSignal",
    version: "1",
    chainId: BigInt(chainId),
    verifyingContract: getAddress(coreAddress),
  } as const;
}

export function hashThesis(thesis: string): Hex {
  return keccak256(toBytes(thesis.trim()));
}

export function buildSignalAttestationTypedData(attestation: SignalAttestationPayload) {
  return {
    domain: getSignalAttestationDomain(attestation.chainId, attestation.coreAddress),
    types: SIGNAL_ATTESTATION_TYPES,
    primaryType: "SignalAttestation" as const,
    message: {
      chainId: BigInt(attestation.chainId),
      coreAddress: getAddress(attestation.coreAddress),
      feedId: attestation.feedId,
      epochId: BigInt(attestation.epochId),
      tierId: attestation.tierId,
      roundId: BigInt(attestation.roundId),
      seller: getAddress(attestation.seller),
      claimedProbBps: attestation.claimedProbBps,
      thesisHash: attestation.thesisHash,
      issuedAt: BigInt(attestation.issuedAt),
    },
  };
}

export interface AttestationVerifyResult {
  valid: boolean;
  reason?: string;
}

export async function verifySignalAttestation(params: {
  attestation: SignalAttestationPayload;
  signature: Hex;
  thesis: string;
  expectedCoreAddress: Address;
  nowSec?: number;
}): Promise<AttestationVerifyResult> {
  const { attestation, signature, thesis, expectedCoreAddress } = params;
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);

  if (attestation.chainId !== BSC_CHAIN_ID) {
    return { valid: false, reason: `Expected chainId ${BSC_CHAIN_ID}, got ${attestation.chainId}` };
  }
  if (attestation.coreAddress.toLowerCase() !== expectedCoreAddress.toLowerCase()) {
    return { valid: false, reason: "Attestation coreAddress mismatch" };
  }
  if (
    !Number.isInteger(attestation.claimedProbBps) ||
    attestation.claimedProbBps < MIN_PROB_BPS ||
    attestation.claimedProbBps > MAX_PROB_BPS
  ) {
    return {
      valid: false,
      reason: `claimedProbBps must be in [${MIN_PROB_BPS}, ${MAX_PROB_BPS}]`,
    };
  }
  if (Math.abs(nowSec - attestation.issuedAt) > 900) {
    return { valid: false, reason: "Attestation issuedAt outside 15-minute freshness window" };
  }
  const expectedHash = hashThesis(thesis);
  if (attestation.thesisHash.toLowerCase() !== expectedHash.toLowerCase()) {
    return { valid: false, reason: "thesisHash does not match thesis plaintext" };
  }
  if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
    return { valid: false, reason: "Invalid EIP-712 signature hex length" };
  }

  try {
    const typedData = buildSignalAttestationTypedData(attestation);
    const ok = await verifyTypedData({
      address: getAddress(attestation.seller),
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
      signature,
    });
    if (!ok) {
      return { valid: false, reason: "EIP-712 signature does not recover seller address" };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "EIP-712 verification error",
    };
  }
}

export type IntegrityStatus =
  | "PENDING"
  | "VERIFIED_MATCH"
  | "MISMATCH"
  | "UNREVEALED"
  | "ORACLE_CANCELLED";

export interface IntegrityCheckResult {
  status: IntegrityStatus;
  onChainRevealedProbBps: number | null;
}

export function computeIntegrityCheck(params: {
  claimedProbBps: number;
  roundState: RoundStateName;
  entry: EntrySnapshot | null;
}): IntegrityCheckResult {
  const { claimedProbBps, roundState, entry } = params;

  if (roundState === "CANCELLED_ORACLE") {
    return { status: "ORACLE_CANCELLED", onChainRevealedProbBps: null };
  }

  if (entry?.revealed) {
    return {
      status: entry.probBps === claimedProbBps ? "VERIFIED_MATCH" : "MISMATCH",
      onChainRevealedProbBps: entry.probBps,
    };
  }

  if (
    roundState === "AWAITING_ORACLE" ||
    roundState === "CLAIMABLE" ||
    roundState === "NO_REVEALS"
  ) {
    return { status: "UNREVEALED", onChainRevealedProbBps: null };
  }

  return { status: "PENDING", onChainRevealedProbBps: null };
}
