import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Address, Hex } from "viem";
import type { SignalAttestationPayload } from "./attestation";

export interface EncryptedBlob {
  ivHex: string;
  tagHex: string;
  ciphertextHex: string;
}

export interface StoredSignalRecord {
  id: string;
  seller: Address;
  roundId: number;
  feedId: number;
  epochId: number;
  tierId: number;
  coreAddress: Address;
  title: string;
  summary: string;
  priceAtomic: string;
  preferredToken: Address;
  claimedProbBps: number;
  thesisHash: Hex;
  encryptedThesis: EncryptedBlob;
  attestation: SignalAttestationPayload;
  signature: Hex;
  createdAt: string;
}

export interface StoredPurchaseRecord {
  id: string;
  signalId: string;
  payer: Address;
  payTo: Address;
  asset: Address;
  amountAtomic: string;
  txHash: Hex;
  facilitatorMode: "binance-b402" | "self-hosted-bsc";
  purchasedAt: string;
}

export interface CreateSignalInput {
  seller: Address;
  roundId: number;
  feedId: number;
  epochId: number;
  tierId: number;
  coreAddress: Address;
  title: string;
  summary: string;
  priceAtomic: string;
  preferredToken: Address;
  claimedProbBps: number;
  thesis: string;
  thesisHash: Hex;
  attestation: SignalAttestationPayload;
  signature: Hex;
}

export interface SignalStore {
  createSignal(input: CreateSignalInput): Promise<StoredSignalRecord>;
  getSignalById(id: string): Promise<StoredSignalRecord | null>;
  findBySellerAndRound(seller: Address, roundId: number): Promise<StoredSignalRecord | null>;
  listSignals(): Promise<StoredSignalRecord[]>;
  decryptThesis(record: StoredSignalRecord): string;
  tryClaimNonce(nonceKey: string): Promise<boolean>;
  releaseNonce(nonceKey: string): Promise<void>;
  recordPurchase(purchase: Omit<StoredPurchaseRecord, "id" | "purchasedAt">): Promise<StoredPurchaseRecord>;
  getPurchaseCount(signalId: string): Promise<number>;
}

interface PersistedFileState {
  version: 1;
  signals: StoredSignalRecord[];
  purchases: StoredPurchaseRecord[];
  usedNonces: string[];
}

function resolveStoreFilePath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  const dir = process.env.RECKON_DATA_DIR || path.join(process.cwd(), ".reckon-data");
  return path.join(dir, "signals.json");
}

function deriveEncryptionKey(secret?: string): Buffer {
  const configured = secret?.trim() || process.env.RECKON_STORE_ENCRYPTION_KEY?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[reckon/store] RECKON_STORE_ENCRYPTION_KEY must be set in production (refusing to fall back to public default key).",
      );
    }
    return crypto
      .createHash("sha256")
      .update("reckon-dev-ephemeral-encryption-key-set-RECKON_STORE_ENCRYPTION_KEY-in-prod")
      .digest();
  }
  return crypto.createHash("sha256").update(configured).digest();
}

export function encryptTextAesGcm(plaintext: string, key: Buffer): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ivHex: iv.toString("hex"),
    tagHex: tag.toString("hex"),
    ciphertextHex: encrypted.toString("hex"),
  };
}

export function decryptTextAesGcm(blob: EncryptedBlob, key: Buffer): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(blob.ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(blob.tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Encrypted atomic JSON store for Layer 3 signals.
 * ponytail: single-instance JSON persistence behind SignalStore interface; swap to Postgres/Turso before multi-region scaling.
 */
export class EncryptedJsonSignalStore implements SignalStore {
  private readonly filePath: string;
  private readonly key: Buffer;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(options?: { filePath?: string; encryptionKey?: string }) {
    this.filePath = resolveStoreFilePath(options?.filePath);
    this.key = deriveEncryptionKey(options?.encryptionKey);
  }

  private readState(): PersistedFileState {
    if (!fs.existsSync(this.filePath)) {
      return { version: 1, signals: [], purchases: [], usedNonces: [] };
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedFileState;
    return {
      version: 1,
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
      usedNonces: Array.isArray(parsed.usedNonces) ? parsed.usedNonces : [],
    };
  }

  private writeState(state: PersistedFileState): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.filePath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  private runSerialized<T>(fn: () => T): Promise<T> {
    const result = this.writeQueue.then(fn, fn);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async createSignal(input: CreateSignalInput): Promise<StoredSignalRecord> {
    return this.runSerialized(() => {
      const state = this.readState();
      const dup = state.signals.find(
        (s) =>
          s.seller.toLowerCase() === input.seller.toLowerCase() &&
          s.roundId === input.roundId,
      );
      if (dup) {
        throw new Error(`Signal already published for seller ${input.seller} on round ${input.roundId}`);
      }

      const id = `sig_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const record: StoredSignalRecord = {
        id,
        seller: input.seller,
        roundId: input.roundId,
        feedId: input.feedId,
        epochId: input.epochId,
        tierId: input.tierId,
        coreAddress: input.coreAddress,
        title: input.title,
        summary: input.summary,
        priceAtomic: input.priceAtomic,
        preferredToken: input.preferredToken,
        claimedProbBps: input.claimedProbBps,
        thesisHash: input.thesisHash,
        encryptedThesis: encryptTextAesGcm(input.thesis, this.key),
        attestation: input.attestation,
        signature: input.signature,
        createdAt: new Date().toISOString(),
      };
      state.signals.unshift(record);
      this.writeState(state);
      return record;
    });
  }

  async getSignalById(id: string): Promise<StoredSignalRecord | null> {
    const state = this.readState();
    return state.signals.find((s) => s.id === id) ?? null;
  }

  async findBySellerAndRound(
    seller: Address,
    roundId: number,
  ): Promise<StoredSignalRecord | null> {
    const state = this.readState();
    return (
      state.signals.find(
        (s) => s.seller.toLowerCase() === seller.toLowerCase() && s.roundId === roundId,
      ) ?? null
    );
  }

  async listSignals(): Promise<StoredSignalRecord[]> {
    const state = this.readState();
    return [...state.signals];
  }

  decryptThesis(record: StoredSignalRecord): string {
    return decryptTextAesGcm(record.encryptedThesis, this.key);
  }

  async tryClaimNonce(nonceKey: string): Promise<boolean> {
    return this.runSerialized(() => {
      const state = this.readState();
      if (state.usedNonces.includes(nonceKey)) {
        return false;
      }
      state.usedNonces.push(nonceKey);
      this.writeState(state);
      return true;
    });
  }

  async releaseNonce(nonceKey: string): Promise<void> {
    return this.runSerialized(() => {
      const state = this.readState();
      const idx = state.usedNonces.indexOf(nonceKey);
      if (idx !== -1) {
        state.usedNonces.splice(idx, 1);
        this.writeState(state);
      }
    });
  }

  async recordPurchase(
    purchase: Omit<StoredPurchaseRecord, "id" | "purchasedAt">,
  ): Promise<StoredPurchaseRecord> {
    return this.runSerialized(() => {
      const state = this.readState();
      const record: StoredPurchaseRecord = {
        ...purchase,
        id: `pur_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        purchasedAt: new Date().toISOString(),
      };
      state.purchases.push(record);
      this.writeState(state);
      return record;
    });
  }

  async getPurchaseCount(signalId: string): Promise<number> {
    const state = this.readState();
    return state.purchases.filter((p) => p.signalId === signalId).length;
  }
}

export type SignalStoreBackend = "upstash-redis" | "encrypted-json";

export class UpstashRedisSignalStore implements SignalStore {
  private readonly url: string;
  private readonly token: string;
  private readonly prefix: string;
  private readonly key: Buffer;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: {
    url?: string;
    token?: string;
    prefix?: string;
    encryptionKey?: string;
    fetchImpl?: typeof fetch;
  }) {
    const url =
      options?.url?.trim() ||
      process.env.UPSTASH_REDIS_REST_URL?.trim() ||
      process.env.KV_REST_API_URL?.trim();
    const token =
      options?.token?.trim() ||
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
      process.env.KV_REST_API_TOKEN?.trim();
    if (!url || !token) {
      throw new Error(
        "UpstashRedisSignalStore requires UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN)",
      );
    }
    this.url = url.replace(/\/+$/, "");
    this.token = token;
    this.prefix = options?.prefix ?? process.env.RECKON_REDIS_PREFIX?.trim() ?? "reckon:v1";
    this.key = deriveEncryptionKey(options?.encryptionKey);
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  private async cmd<T = unknown>(args: Array<string | number>): Promise<T> {
    const res = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: { result?: T; error?: string };
    try {
      parsed = JSON.parse(text) as { result?: T; error?: string };
    } catch {
      throw new Error(`Upstash REST returned non-JSON HTTP ${res.status}: ${text.slice(0, 160)}`);
    }
    if (!res.ok || parsed.error) {
      throw new Error(`Upstash REST error (${res.status}): ${parsed.error || text}`);
    }
    return parsed.result as T;
  }

  private signalsHashKey(): string {
    return `${this.prefix}:signals`;
  }

  private signalIdsKey(): string {
    return `${this.prefix}:signal_ids`;
  }

  private sellerRoundKey(seller: Address, roundId: number): string {
    return `${this.prefix}:sig_by_sr:${seller.toLowerCase()}:${roundId}`;
  }

  private nonceKey(nonceKey: string): string {
    return `${this.prefix}:nonce:${nonceKey}`;
  }

  private purchasesKey(signalId: string): string {
    return `${this.prefix}:purchases:${signalId}`;
  }

  async createSignal(input: CreateSignalInput): Promise<StoredSignalRecord> {
    const id = `sig_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const srKey = this.sellerRoundKey(input.seller, input.roundId);
    const claimed = await this.cmd<string | null>(["SET", srKey, id, "NX"]);
    if (claimed !== "OK") {
      throw new Error(`Signal already published for seller ${input.seller} on round ${input.roundId}`);
    }

    const record: StoredSignalRecord = {
      id,
      seller: input.seller,
      roundId: input.roundId,
      feedId: input.feedId,
      epochId: input.epochId,
      tierId: input.tierId,
      coreAddress: input.coreAddress,
      title: input.title,
      summary: input.summary,
      priceAtomic: input.priceAtomic,
      preferredToken: input.preferredToken,
      claimedProbBps: input.claimedProbBps,
      thesisHash: input.thesisHash,
      encryptedThesis: encryptTextAesGcm(input.thesis, this.key),
      attestation: input.attestation,
      signature: input.signature,
      createdAt: new Date().toISOString(),
    };

    try {
      await this.cmd(["HSET", this.signalsHashKey(), id, JSON.stringify(record)]);
      await this.cmd(["LPUSH", this.signalIdsKey(), id]);
    } catch (err) {
      await this.cmd(["DEL", srKey]).catch(() => undefined);
      throw err;
    }

    return record;
  }

  async getSignalById(id: string): Promise<StoredSignalRecord | null> {
    const raw = await this.cmd<string | null>(["HGET", this.signalsHashKey(), id]);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSignalRecord;
  }

  async findBySellerAndRound(
    seller: Address,
    roundId: number,
  ): Promise<StoredSignalRecord | null> {
    const id = await this.cmd<string | null>(["GET", this.sellerRoundKey(seller, roundId)]);
    if (!id) return null;
    return this.getSignalById(id);
  }

  async listSignals(): Promise<StoredSignalRecord[]> {
    const ids = await this.cmd<string[] | null>(["LRANGE", this.signalIdsKey(), 0, 199]);
    if (!ids || ids.length === 0) return [];
    const rawList = await this.cmd<Array<string | null>>(["HMGET", this.signalsHashKey(), ...ids]);
    if (!Array.isArray(rawList)) return [];
    const out: StoredSignalRecord[] = [];
    for (const raw of rawList) {
      if (raw) {
        out.push(JSON.parse(raw) as StoredSignalRecord);
      }
    }
    return out;
  }

  decryptThesis(record: StoredSignalRecord): string {
    return decryptTextAesGcm(record.encryptedThesis, this.key);
  }

  async tryClaimNonce(nonceKey: string): Promise<boolean> {
    const res = await this.cmd<string | null>([
      "SET",
      this.nonceKey(nonceKey),
      "1",
      "NX",
      "EX",
      2_592_000,
    ]);
    return res === "OK";
  }

  async releaseNonce(nonceKey: string): Promise<void> {
    await this.cmd(["DEL", this.nonceKey(nonceKey)]);
  }

  async recordPurchase(
    purchase: Omit<StoredPurchaseRecord, "id" | "purchasedAt">,
  ): Promise<StoredPurchaseRecord> {
    const record: StoredPurchaseRecord = {
      ...purchase,
      id: `pur_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      purchasedAt: new Date().toISOString(),
    };
    await this.cmd(["RPUSH", this.purchasesKey(purchase.signalId), JSON.stringify(record)]);
    return record;
  }

  async getPurchaseCount(signalId: string): Promise<number> {
    const len = await this.cmd<number | string>(["LLEN", this.purchasesKey(signalId)]);
    return Number(len) || 0;
  }
}

let activeStore: SignalStore | null = null;
let activeBackend: SignalStoreBackend | null = null;

function hasUpstashConfig(): boolean {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();
  return Boolean(url && token);
}

export function getSignalStoreBackendName(): SignalStoreBackend {
  if (activeBackend) return activeBackend;
  return hasUpstashConfig() ? "upstash-redis" : "encrypted-json";
}

export function getSignalStore(): SignalStore {
  if (!activeStore) {
    if (hasUpstashConfig()) {
      activeStore = new UpstashRedisSignalStore();
      activeBackend = "upstash-redis";
    } else {
      activeStore = new EncryptedJsonSignalStore();
      activeBackend = "encrypted-json";
    }
  }
  return activeStore;
}

export function setSignalStoreForTests(store: SignalStore | null): void {
  activeStore = store;
  if (store instanceof UpstashRedisSignalStore) {
    activeBackend = "upstash-redis";
  } else if (store instanceof EncryptedJsonSignalStore) {
    activeBackend = "encrypted-json";
  } else {
    activeBackend = null;
  }
}
