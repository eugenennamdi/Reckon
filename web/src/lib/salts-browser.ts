import {
  computeCommitment,
  decodeRecoveryToken,
  encodeRecoveryToken,
  type SaltRecoveryRecord,
} from "@/lib/reckon/commitment";
import type { Address, Hex } from "viem";

const STORAGE_KEY = "reckon:salts:v1";

export function generateRandomSaltHex(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

export function createSaltRecord(params: {
  chainId: number;
  coreAddress: Address;
  agent: Address;
  feedId: number;
  epochId: number;
  tierId: number;
  roundId?: number;
  probBps: number;
}): SaltRecoveryRecord {
  const salt = generateRandomSaltHex();
  const commitment = computeCommitment({
    chainId: params.chainId,
    coreAddress: params.coreAddress,
    feedId: params.feedId,
    epochId: params.epochId,
    tierId: params.tierId,
    agent: params.agent,
    probBps: params.probBps,
    salt,
  });
  return {
    version: 1,
    chainId: params.chainId,
    coreAddress: params.coreAddress,
    agent: params.agent,
    feedId: params.feedId,
    epochId: params.epochId,
    tierId: params.tierId,
    ...(params.roundId && params.roundId > 0 ? { roundId: String(params.roundId) } : {}),
    probBps: params.probBps,
    salt,
    commitment,
    createdAt: new Date().toISOString(),
  };
}

export function loadSavedSalts(): SaltRecoveryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SaltRecoveryRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSaltRecord(record: SaltRecoveryRecord): SaltRecoveryRecord[] {
  const current = loadSavedSalts();
  // Append-only by commitment hash: never overwrite an earlier salt for the same slot,
  // because regenerating a salt before aborting/retrials must never erase a committed salt.
  const deduped = current.filter(
    (r) => r.commitment.toLowerCase() !== record.commitment.toLowerCase(),
  );
  const next = [record, ...deduped];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function findSaltForSlot(params: {
  agent?: string;
  coreAddress?: string;
  feedId: number;
  epochId: number;
  tierId: number;
  commitment?: string;
}): SaltRecoveryRecord | null {
  if (!params.agent) return null;
  const all = loadSavedSalts();
  if (params.commitment) {
    const exact = all.find(
      (r) => r.commitment.toLowerCase() === params.commitment!.toLowerCase(),
    );
    if (exact) return exact;
  }
  return (
    all.find(
      (r) =>
        r.agent.toLowerCase() === params.agent!.toLowerCase() &&
        (!params.coreAddress ||
          r.coreAddress.toLowerCase() === params.coreAddress.toLowerCase()) &&
        r.feedId === params.feedId &&
        r.epochId === params.epochId &&
        r.tierId === params.tierId,
    ) ?? null
  );
}

export function importRecoveryInput(raw: string): SaltRecoveryRecord {
  const trimmed = raw.trim();
  const record = trimmed.startsWith("RKN1-")
    ? decodeRecoveryToken(trimmed)
    : (JSON.parse(trimmed) as SaltRecoveryRecord);
  if (!record || record.version !== 1 || !record.salt || !record.agent) {
    throw new Error("Invalid salt backup JSON or RKN1 recovery token");
  }
  saveSaltRecord(record);
  return record;
}

export function downloadSaltJsonFile(record: SaltRecoveryRecord): void {
  const payload = {
    ...record,
    recoveryToken: encodeRecoveryToken(record),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reckon-salt-epoch-${record.epochId}-feed-${record.feedId}-tier-${record.tierId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
