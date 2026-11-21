import crypto from "node:crypto";
import {
  createWalletClient,
  fallback,
  getAddress,
  http,
  parseSignature,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { getChainReader } from "@/lib/reckon/chain";
import {
  BSC_CAIP2,
  BSC_CHAIN_ID,
  BSC_RPC_URLS,
  MIN_SIGNAL_PRICE_ATOMIC,
  PERMIT2_ADDRESS,
  X402_EXACT_PERMIT2_PROXY,
  ZERO_ADDRESS,
  findStablecoin,
} from "@/lib/reckon/constants";
import {
  buildBazaarExtension,
  type X402PaymentExtra,
  type X402PaymentRequirement,
  type X402PaymentSignatureEnvelope,
} from "./protocol";
import type { SignalStore, StoredSignalRecord } from "./store";

export type FacilitatorMode = "binance-b402" | "self-hosted-bsc";

export class FacilitatorError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 402) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const EIP3009_ABI = [
  {
    type: "function",
    name: "authorizationState",
    stateMutability: "view",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

export const PERMIT2_ABI = [
  {
    type: "function",
    name: "nonceBitmap",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "wordPos", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Exact Sourcify-verified ABI for BSC 0x402085c248EeA27D92E8b30b2C58ed07f9E20001
export const X402_EXACT_PERMIT2_PROXY_ABI = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      {
        name: "witness",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "validAfter", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const EIP3009_TYPED_DATA_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export const PERMIT2_WITNESS_TYPED_DATA_TYPES = {
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Witness" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Witness: [
    { name: "to", type: "address" },
    { name: "validAfter", type: "uint256" },
  ],
} as const;

export interface SettlementExecutor {
  getSignerAddress(): Address;
  checkEip3009State(params: {
    asset: Address;
    owner: Address;
    nonce: Hex;
  }): Promise<{ nonceUsed: boolean; balance: bigint }>;
  checkPermit2State(params: {
    asset: Address;
    owner: Address;
    nonce: bigint;
  }): Promise<{ nonceUsed: boolean; allowance: bigint; balance: bigint }>;
  simulateAndSettleEip3009(params: {
    asset: Address;
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  }): Promise<Hex>;
  simulateAndSettlePermit2(params: {
    asset: Address;
    amount: bigint;
    nonce: bigint;
    deadline: bigint;
    owner: Address;
    to: Address;
    validAfter: bigint;
    signature: Hex;
  }): Promise<Hex>;
}

class BscRelayerExecutor implements SettlementExecutor {
  // Serialize relayer broadcasts in-process so concurrent x402 unlocks never collide on EOA nonces.
  private txQueue: Promise<unknown> = Promise.resolve();

  private enqueueTx<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.txQueue.then(fn, fn);
    this.txQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private getAccount() {
    const pk = process.env.X402_RELAYER_PRIVATE_KEY?.trim();
    if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
      return null;
    }
    return privateKeyToAccount(pk as Hex);
  }

  getSignerAddress(): Address {
    const account = this.getAccount();
    if (account) return account.address;
    const configured = process.env.X402_FACILITATOR_SIGNER_ADDRESS?.trim();
    if (configured && /^0x[a-fA-F0-9]{40}$/.test(configured)) {
      return getAddress(configured);
    }
    return ZERO_ADDRESS;
  }

  async checkEip3009State(params: {
    asset: Address;
    owner: Address;
    nonce: Hex;
  }): Promise<{ nonceUsed: boolean; balance: bigint }> {
    const client = getChainReader().getPublicClient();
    const [nonceUsed, balance] = await client.multicall({
      contracts: [
        {
          address: params.asset,
          abi: EIP3009_ABI,
          functionName: "authorizationState",
          args: [params.owner, params.nonce],
        },
        {
          address: params.asset,
          abi: EIP3009_ABI,
          functionName: "balanceOf",
          args: [params.owner],
        },
      ],
      allowFailure: false,
    });
    return { nonceUsed: Boolean(nonceUsed), balance: BigInt(balance) };
  }

  async checkPermit2State(params: {
    asset: Address;
    owner: Address;
    nonce: bigint;
  }): Promise<{ nonceUsed: boolean; allowance: bigint; balance: bigint }> {
    const client = getChainReader().getPublicClient();
    const wordPos = params.nonce >> 8n;
    const bitPos = params.nonce & 0xffn;
    const [bitmap, allowance, balance] = await client.multicall({
      contracts: [
        {
          address: PERMIT2_ADDRESS,
          abi: PERMIT2_ABI,
          functionName: "nonceBitmap",
          args: [params.owner, wordPos],
        },
        {
          address: params.asset,
          abi: EIP3009_ABI,
          functionName: "allowance",
          args: [params.owner, PERMIT2_ADDRESS],
        },
        {
          address: params.asset,
          abi: EIP3009_ABI,
          functionName: "balanceOf",
          args: [params.owner],
        },
      ],
      allowFailure: false,
    });
    const nonceUsed = ((BigInt(bitmap) >> bitPos) & 1n) === 1n;
    return { nonceUsed, allowance: BigInt(allowance), balance: BigInt(balance) };
  }

  async simulateAndSettleEip3009(params: {
    asset: Address;
    from: Address;
    to: Address;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  }): Promise<Hex> {
    return this.enqueueTx(async () => {
      const account = this.getAccount();
      if (!account) {
        throw new FacilitatorError(
          "RELAYER_UNCONFIGURED",
          "Self-hosted settlement requires X402_RELAYER_PRIVATE_KEY (or set Binance B402 credentials).",
          503,
        );
      }

      const publicClient = getChainReader().getPublicClient();
      const parsed = parseSignature(params.signature);
      const v = Number(parsed.v ?? (parsed.yParity === 0 ? 27 : 28));

      let request: Parameters<ReturnType<typeof createWalletClient>["writeContract"]>[0];
      try {
        const sim = await publicClient.simulateContract({
          address: params.asset,
          abi: EIP3009_ABI,
          functionName: "transferWithAuthorization",
          args: [
            params.from,
            params.to,
            params.value,
            params.validAfter,
            params.validBefore,
            params.nonce,
            v,
            parsed.r,
            parsed.s,
          ],
          account,
        });
        request = sim.request as typeof request;
      } catch (err) {
        throw new FacilitatorError(
          "SIMULATION_FAILED",
          `eth_call simulation reverted for transferWithAuthorization: ${err instanceof Error ? err.message : String(err)}`,
          402,
        );
      }

      const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: fallback(BSC_RPC_URLS.map((u) => http(u, { timeout: 8_000 }))),
      });
      const txHash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      if (receipt.status !== "success") {
        throw new FacilitatorError("TX_REVERTED", `Settlement transaction ${txHash} reverted on-chain`, 402);
      }
      return txHash;
    });
  }

  async simulateAndSettlePermit2(params: {
    asset: Address;
    amount: bigint;
    nonce: bigint;
    deadline: bigint;
    owner: Address;
    to: Address;
    validAfter: bigint;
    signature: Hex;
  }): Promise<Hex> {
    return this.enqueueTx(async () => {
      const account = this.getAccount();
      if (!account) {
        throw new FacilitatorError(
          "RELAYER_UNCONFIGURED",
          "Self-hosted settlement requires X402_RELAYER_PRIVATE_KEY (or set Binance B402 credentials).",
          503,
        );
      }

      const publicClient = getChainReader().getPublicClient();
      const permitArg = {
        permitted: { token: params.asset, amount: params.amount },
        nonce: params.nonce,
        deadline: params.deadline,
      };
      const witnessArg = { to: params.to, validAfter: params.validAfter };

      let request: Parameters<ReturnType<typeof createWalletClient>["writeContract"]>[0];
      try {
        const sim = await publicClient.simulateContract({
          address: X402_EXACT_PERMIT2_PROXY,
          abi: X402_EXACT_PERMIT2_PROXY_ABI,
          functionName: "settle",
          args: [permitArg, params.owner, witnessArg, params.signature],
          account,
        });
        request = sim.request as typeof request;
      } catch (err) {
        throw new FacilitatorError(
          "SIMULATION_FAILED",
          `eth_call simulation reverted for x402ExactPermit2Proxy.settle: ${err instanceof Error ? err.message : String(err)}`,
          402,
        );
      }

      const walletClient = createWalletClient({
        account,
        chain: bsc,
        transport: fallback(BSC_RPC_URLS.map((u) => http(u, { timeout: 8_000 }))),
      });
      const txHash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      if (receipt.status !== "success") {
        throw new FacilitatorError("TX_REVERTED", `Settlement transaction ${txHash} reverted on-chain`, 402);
      }
      return txHash;
    });
  }
}

let activeExecutor: SettlementExecutor | null = null;
let customFetch: typeof fetch | null = null;

export function getSettlementExecutor(): SettlementExecutor {
  if (!activeExecutor) {
    activeExecutor = new BscRelayerExecutor();
  }
  return activeExecutor;
}

export function setSettlementExecutorForTests(executor: SettlementExecutor | null): void {
  activeExecutor = executor;
}

export function setFetchForTests(fn: typeof fetch | null): void {
  customFetch = fn;
}

function getFetch(): typeof fetch {
  return customFetch ?? fetch;
}

export interface B402Credentials {
  baseUrl: string;
  clientId: string;
  accessToken: string;
  privateKeyB64: string;
}

export function getB402Credentials(): B402Credentials | null {
  const clientId = process.env.B402_CLIENT_ID?.trim();
  const accessToken = process.env.B402_ACCESS_TOKEN?.trim();
  const privateKeyB64 = process.env.B402_PRIVATE_KEY_B64?.trim();
  if (!clientId || !accessToken || !privateKeyB64) {
    return null;
  }
  const baseUrl = (process.env.B402_BASE_URL?.trim() || "https://b402.binance.com").replace(/\/+$/, "");
  return { baseUrl, clientId, accessToken, privateKeyB64 };
}

export function getFacilitatorMode(): FacilitatorMode {
  return getB402Credentials() ? "binance-b402" : "self-hosted-bsc";
}

export function getFacilitatorSignerAddress(): Address {
  const explicitB402Signer = process.env.B402_SIGNER_ADDRESS?.trim();
  if (getFacilitatorMode() === "binance-b402" && explicitB402Signer && /^0x[a-fA-F0-9]{40}$/.test(explicitB402Signer)) {
    return getAddress(explicitB402Signer);
  }
  return getSettlementExecutor().getSignerAddress();
}

export function signB402Request(
  bodyStr: string,
  timestampMs: string,
  privateKeyB64: string,
): string {
  const keyObj = privateKeyB64.includes("BEGIN")
    ? crypto.createPrivateKey(privateKeyB64)
    : crypto.createPrivateKey({
        key: Buffer.from(privateKeyB64, "base64"),
        format: "der",
        type: "pkcs8",
      });
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(bodyStr + timestampMs, "utf8");
  signer.end();
  return signer.sign(keyObj).toString("base64");
}

async function callB402Api<T>(
  creds: B402Credentials,
  endpoint: "/papi/v2/b402/supported" | "/papi/v2/b402/verify" | "/papi/v2/b402/settle",
  body: Record<string, unknown>,
): Promise<T> {
  const bodyStr = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = signB402Request(bodyStr, timestamp, creds.privateKeyB64);

  const response = await getFetch()(`${creds.baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tesla-ClientId": creds.clientId,
      "X-Tesla-SignAccessToken": creds.accessToken,
      "X-Tesla-Timestamp": timestamp,
      "X-Tesla-Signature": signature,
    },
    body: bodyStr,
  });

  const text = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new FacilitatorError(
      "B402_INVALID_RESPONSE",
      `Binance B402 ${endpoint} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`,
      502,
    );
  }

  if (!response.ok) {
    throw new FacilitatorError(
      "B402_HTTP_ERROR",
      `Binance B402 ${endpoint} HTTP ${response.status}: ${String(json.message || json.error || text)}`,
      response.status === 400 ? 402 : 502,
    );
  }

  return json as T;
}

interface SupportedCache {
  expiresAt: number;
  extras: Record<string, Partial<X402PaymentExtra>>;
}
let b402SupportedCache: SupportedCache | null = null;

export async function getB402SupportedExtras(): Promise<Record<string, Partial<X402PaymentExtra>> | undefined> {
  const creds = getB402Credentials();
  if (!creds) return undefined;
  const now = Date.now();
  if (b402SupportedCache && b402SupportedCache.expiresAt > now) {
    return b402SupportedCache.extras;
  }
  try {
    const res = await callB402Api<{
      kinds?: Array<{
        network?: string;
        asset?: string;
        extra?: Partial<X402PaymentExtra>;
      }>;
    }>(creds, "/papi/v2/b402/supported", {});
    const extras: Record<string, Partial<X402PaymentExtra>> = {};
    for (const k of res.kinds ?? []) {
      if (k.network === BSC_CAIP2 && k.asset && k.extra) {
        extras[k.asset.toLowerCase()] = k.extra;
      }
    }
    b402SupportedCache = { expiresAt: now + 60_000, extras };
    return extras;
  } catch {
    return undefined;
  }
}

export interface SettlementReceipt {
  success: true;
  transaction: Hex;
  txHash: Hex;
  network: typeof BSC_CAIP2;
  payer: Address;
  payTo: Address;
  asset: Address;
  amount: string;
  facilitatorMode: FacilitatorMode;
  settledAt: string;
}

function safeAddress(value: unknown, field: string): Address {
  if (typeof value !== "string") {
    throw new FacilitatorError("INVALID_PAYMENT_PAYLOAD", `${field} must be a valid EVM address`, 402);
  }
  try {
    return getAddress(value);
  } catch {
    throw new FacilitatorError("INVALID_PAYMENT_PAYLOAD", `${field} is not a valid EVM address`, 402);
  }
}

function safeBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new FacilitatorError("INVALID_PAYMENT_PAYLOAD", `${field} must be an integer`, 402);
  }
  try {
    return BigInt(value);
  } catch {
    throw new FacilitatorError("INVALID_PAYMENT_PAYLOAD", `${field} is not a valid integer`, 402);
  }
}

export async function verifyAndSettlePayment(params: {
  envelope: X402PaymentSignatureEnvelope;
  signal: StoredSignalRecord;
  accepts: X402PaymentRequirement[];
  store: SignalStore;
  nowSec?: number;
}): Promise<SettlementReceipt> {
  const { envelope, signal, accepts, store } = params;
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);

  const listedPrice = BigInt(signal.priceAtomic);
  if (listedPrice < MIN_SIGNAL_PRICE_ATOMIC) {
    throw new FacilitatorError(
      "PRICE_BELOW_FLOOR",
      `Listing price ${signal.priceAtomic} is below minimum floor ${MIN_SIGNAL_PRICE_ATOMIC.toString()}`,
      400,
    );
  }

  const matchedReq = accepts.find(
    (req) =>
      req.asset.toLowerCase() === envelope.accepted.asset.toLowerCase() &&
      req.network === BSC_CAIP2,
  );
  if (!matchedReq) {
    throw new FacilitatorError(
      "UNSUPPORTED_ASSET",
      `Asset ${envelope.accepted.asset} on ${envelope.accepted.network} is not in accepted requirements`,
      402,
    );
  }

  const coin = findStablecoin(matchedReq.asset);
  if (!coin) {
    throw new FacilitatorError("UNSUPPORTED_TOKEN", "Asset is not a supported BSC stablecoin", 402);
  }

  const sellerAddr = safeAddress(signal.seller, "signal.seller");
  if (safeAddress(envelope.accepted.payTo, "accepted.payTo") !== sellerAddr) {
    throw new FacilitatorError(
      "INVALID_PAY_TO",
      "accepted.payTo must equal the signal seller's Agent ID wallet",
      402,
    );
  }

  // Extract payer & amount before mode dispatch so rate limits and self-pay guards hold identically in both modes
  let payerAddr: Address;
  let paymentAmount: bigint;
  let nonceKey: string;

  if (coin.assetTransferMethod === "eip3009") {
    const auth = envelope.payload.authorization;
    if (!auth) {
      throw new FacilitatorError(
        "MISSING_EIP3009_AUTHORIZATION",
        `Token ${coin.symbol} requires payload.authorization (eip3009)`,
        402,
      );
    }
    payerAddr = safeAddress(auth.from, "authorization.from");
    if (safeAddress(auth.to, "authorization.to") !== sellerAddr) {
      throw new FacilitatorError(
        "INVALID_PAY_TO",
        "EIP-3009 authorization.to must match seller address",
        402,
      );
    }
    if (payerAddr === sellerAddr) {
      throw new FacilitatorError("SELF_PAY_FORBIDDEN", "Seller cannot self-pay via gas relayer", 402);
    }
    paymentAmount = safeBigInt(auth.value, "authorization.value");
    if (paymentAmount < listedPrice) {
      throw new FacilitatorError(
        "INSUFFICIENT_VALUE",
        `Authorization value ${paymentAmount.toString()} < required ${listedPrice.toString()}`,
        402,
      );
    }
    const validAfter = safeBigInt(auth.validAfter, "authorization.validAfter");
    const validBefore = safeBigInt(auth.validBefore, "authorization.validBefore");
    if (BigInt(nowSec) < validAfter || BigInt(nowSec) >= validBefore) {
      throw new FacilitatorError(
        "AUTHORIZATION_WINDOW_INVALID",
        "EIP-3009 authorization validAfter/validBefore window is not active",
        402,
      );
    }
    if (typeof auth.nonce !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(auth.nonce)) {
      throw new FacilitatorError("INVALID_NONCE", "EIP-3009 nonce must be bytes32 hex", 402);
    }
    nonceKey = `eip3009:${coin.address.toLowerCase()}:${payerAddr.toLowerCase()}:${auth.nonce.toLowerCase()}`;
  } else {
    const p2 = envelope.payload.permit2Authorization;
    if (!p2 || !p2.permitted) {
      throw new FacilitatorError(
        "MISSING_PERMIT2_AUTHORIZATION",
        `Token ${coin.symbol} requires payload.permit2Authorization (permit2)`,
        402,
      );
    }
    payerAddr = safeAddress(p2.from, "permit2Authorization.from");
    if (payerAddr === sellerAddr) {
      throw new FacilitatorError("SELF_PAY_FORBIDDEN", "Seller cannot self-pay via gas relayer", 402);
    }
    if (safeAddress(p2.permitted.token, "permit2Authorization.permitted.token") !== coin.address) {
      throw new FacilitatorError("TOKEN_MISMATCH", "Permit2 permitted.token mismatch", 402);
    }
    if (safeAddress(p2.spender, "permit2Authorization.spender") !== X402_EXACT_PERMIT2_PROXY) {
      throw new FacilitatorError(
        "INVALID_SPENDER",
        `Permit2 spender must equal canonical x402ExactPermit2Proxy (${X402_EXACT_PERMIT2_PROXY})`,
        402,
      );
    }
    const witnessTo = p2.witness?.to
      ? safeAddress(p2.witness.to, "permit2Authorization.witness.to")
      : sellerAddr;
    if (witnessTo !== sellerAddr) {
      throw new FacilitatorError(
        "INVALID_PAY_TO",
        "Permit2 witness.to must equal seller address",
        402,
      );
    }
    paymentAmount = safeBigInt(p2.permitted.amount, "permit2Authorization.permitted.amount");
    if (paymentAmount < listedPrice) {
      throw new FacilitatorError(
        "INSUFFICIENT_VALUE",
        `Permit2 permitted.amount ${paymentAmount.toString()} < required ${listedPrice.toString()}`,
        402,
      );
    }
    const validAfter = safeBigInt(p2.witness?.validAfter ?? "0", "permit2Authorization.witness.validAfter");
    const deadline = safeBigInt(p2.deadline, "permit2Authorization.deadline");
    if (BigInt(nowSec) < validAfter || BigInt(nowSec) >= deadline) {
      throw new FacilitatorError(
        "AUTHORIZATION_WINDOW_INVALID",
        "Permit2 deadline or witness.validAfter window is not active",
        402,
      );
    }
    const p2NonceBig = safeBigInt(p2.nonce, "permit2Authorization.nonce");
    nonceKey = `permit2:${payerAddr.toLowerCase()}:${p2NonceBig.toString()}`;
  }

  // Mode 1: Binance Hosted B402 Facilitator
  const b402Creds = getB402Credentials();
  if (b402Creds) {
    const paymentPayload = {
      x402Version: 2,
      accepted: matchedReq,
      payload: envelope.payload,
      extensions: {
        ...(envelope.extensions ?? {}),
        bazaar: buildBazaarExtension(signal),
      },
    };

    const verifyRes = await callB402Api<{
      isValid?: boolean;
      invalidReason?: string;
    }>(b402Creds, "/papi/v2/b402/verify", {
      x402Version: 2,
      paymentPayload,
      paymentRequirements: matchedReq,
    });

    if (!verifyRes.isValid) {
      throw new FacilitatorError(
        "B402_VERIFY_REJECTED",
        `Binance B402 /verify rejected payload: ${verifyRes.invalidReason ?? "invalid_payload"}`,
        402,
      );
    }

    const settleRes = await callB402Api<{
      success?: boolean;
      transaction?: string;
      txHash?: string;
      errorReason?: string;
    }>(b402Creds, "/papi/v2/b402/settle", {
      x402Version: 2,
      paymentPayload,
      paymentRequirements: matchedReq,
    });

    const txHash = (settleRes.transaction || settleRes.txHash) as Hex | undefined;
    if (!settleRes.success || !txHash) {
      throw new FacilitatorError(
        "B402_SETTLE_FAILED",
        `Binance B402 /settle failed: ${settleRes.errorReason ?? "unknown"}`,
        402,
      );
    }

    return {
      success: true,
      transaction: txHash,
      txHash,
      network: BSC_CAIP2,
      payer: payerAddr,
      payTo: sellerAddr,
      asset: coin.address,
      amount: paymentAmount.toString(),
      facilitatorMode: "binance-b402",
      settledAt: new Date().toISOString(),
    };
  }

  // Mode 2: Self-Hosted Open BSC Facilitator (Default Day 1)
  const executor = getSettlementExecutor();

  if (coin.assetTransferMethod === "eip3009") {
    const auth = envelope.payload.authorization!;
    const validSig = await verifyTypedData({
      address: payerAddr,
      domain: {
        name: coin.name,
        version: coin.version,
        chainId: BigInt(BSC_CHAIN_ID),
        verifyingContract: coin.address,
      },
      types: EIP3009_TYPED_DATA_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: payerAddr,
        to: sellerAddr,
        value: paymentAmount,
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
        nonce: auth.nonce,
      },
      signature: envelope.payload.signature,
    }).catch(() => false);

    if (!validSig) {
      throw new FacilitatorError(
        "INVALID_SIGNATURE",
        `EIP-712 TransferWithAuthorization signature invalid for ${coin.symbol}`,
        402,
      );
    }

    const claimed = await store.tryClaimNonce(nonceKey);
    if (!claimed) {
      throw new FacilitatorError("NONCE_REPLAYED", "Payment authorization nonce already used", 402);
    }

    let reachedSettle = false;
    try {
      const chainState = await executor.checkEip3009State({
        asset: coin.address,
        owner: payerAddr,
        nonce: auth.nonce,
      });
      if (chainState.nonceUsed) {
        throw new FacilitatorError("NONCE_USED_ONCHAIN", "EIP-3009 nonce already settled on-chain", 402);
      }
      if (chainState.balance < paymentAmount) {
        throw new FacilitatorError(
          "INSUFFICIENT_BALANCE",
          `Payer ${coin.symbol} balance ${chainState.balance.toString()} < ${paymentAmount.toString()}`,
          402,
        );
      }

      reachedSettle = true;
      const txHash = await executor.simulateAndSettleEip3009({
        asset: coin.address,
        from: payerAddr,
        to: sellerAddr,
        value: paymentAmount,
        validAfter: BigInt(auth.validAfter),
        validBefore: BigInt(auth.validBefore),
        nonce: auth.nonce,
        signature: envelope.payload.signature,
      });

      return {
        success: true,
        transaction: txHash,
        txHash,
        network: BSC_CAIP2,
        payer: payerAddr,
        payTo: sellerAddr,
        asset: coin.address,
        amount: paymentAmount.toString(),
        facilitatorMode: "self-hosted-bsc",
        settledAt: new Date().toISOString(),
      };
    } catch (err) {
      const isAlreadyUsedOrReverted =
        err instanceof FacilitatorError &&
        (err.code === "NONCE_USED_ONCHAIN" || err.code === "TX_REVERTED");
      const isPreBroadcastFail =
        !reachedSettle ||
        (err instanceof FacilitatorError &&
          (err.code === "SIMULATION_FAILED" || err.code === "RELAYER_UNCONFIGURED"));
      if (!isAlreadyUsedOrReverted && isPreBroadcastFail) {
        await store.releaseNonce(nonceKey);
      }
      if (err instanceof FacilitatorError) {
        throw err;
      }
      throw new FacilitatorError(
        "BSC_RPC_ERROR",
        err instanceof Error ? err.message : "Upstream BSC RPC error during payment verification",
        502,
      );
    }
  } else {
    const p2 = envelope.payload.permit2Authorization!;
    const p2Nonce = BigInt(p2.nonce);
    const p2Deadline = BigInt(p2.deadline);
    const witnessValidAfter = BigInt(p2.witness?.validAfter ?? "0");

    // Permit2 domain has NO version field!
    const validSig = await verifyTypedData({
      address: payerAddr,
      domain: {
        name: "Permit2",
        chainId: BigInt(BSC_CHAIN_ID),
        verifyingContract: PERMIT2_ADDRESS,
      },
      types: PERMIT2_WITNESS_TYPED_DATA_TYPES,
      primaryType: "PermitWitnessTransferFrom",
      message: {
        permitted: {
          token: coin.address,
          amount: paymentAmount,
        },
        spender: X402_EXACT_PERMIT2_PROXY,
        nonce: p2Nonce,
        deadline: p2Deadline,
        witness: {
          to: sellerAddr,
          validAfter: witnessValidAfter,
        },
      },
      signature: envelope.payload.signature,
    }).catch(() => false);

    if (!validSig) {
      throw new FacilitatorError(
        "INVALID_SIGNATURE",
        `EIP-712 PermitWitnessTransferFrom signature invalid for ${coin.symbol}`,
        402,
      );
    }

    const claimed = await store.tryClaimNonce(nonceKey);
    if (!claimed) {
      throw new FacilitatorError("NONCE_REPLAYED", "Permit2 nonce already used", 402);
    }

    let reachedSettle = false;
    try {
      const chainState = await executor.checkPermit2State({
        asset: coin.address,
        owner: payerAddr,
        nonce: p2Nonce,
      });
      if (chainState.nonceUsed) {
        throw new FacilitatorError("NONCE_USED_ONCHAIN", "Permit2 nonce already spent on-chain", 402);
      }
      if (chainState.allowance < paymentAmount) {
        throw new FacilitatorError(
          "PERMIT2_APPROVAL_REQUIRED",
          `Payer must grant Permit2 approval (${PERMIT2_ADDRESS}) for ${coin.symbol} first`,
          402,
        );
      }
      if (chainState.balance < paymentAmount) {
        throw new FacilitatorError(
          "INSUFFICIENT_BALANCE",
          `Payer ${coin.symbol} balance ${chainState.balance.toString()} < ${paymentAmount.toString()}`,
          402,
        );
      }

      reachedSettle = true;
      const txHash = await executor.simulateAndSettlePermit2({
        asset: coin.address,
        amount: paymentAmount,
        nonce: p2Nonce,
        deadline: p2Deadline,
        owner: payerAddr,
        to: sellerAddr,
        validAfter: witnessValidAfter,
        signature: envelope.payload.signature,
      });

      return {
        success: true,
        transaction: txHash,
        txHash,
        network: BSC_CAIP2,
        payer: payerAddr,
        payTo: sellerAddr,
        asset: coin.address,
        amount: paymentAmount.toString(),
        facilitatorMode: "self-hosted-bsc",
        settledAt: new Date().toISOString(),
      };
    } catch (err) {
      const isAlreadyUsedOrReverted =
        err instanceof FacilitatorError &&
        (err.code === "NONCE_USED_ONCHAIN" || err.code === "TX_REVERTED");
      const isPreBroadcastFail =
        !reachedSettle ||
        (err instanceof FacilitatorError &&
          (err.code === "SIMULATION_FAILED" || err.code === "RELAYER_UNCONFIGURED"));
      if (!isAlreadyUsedOrReverted && isPreBroadcastFail) {
        await store.releaseNonce(nonceKey);
      }
      if (err instanceof FacilitatorError) {
        throw err;
      }
      throw new FacilitatorError(
        "BSC_RPC_ERROR",
        err instanceof Error ? err.message : "Upstream BSC RPC error during payment verification",
        502,
      );
    }
  }
}
