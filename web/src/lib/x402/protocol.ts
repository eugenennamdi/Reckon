import type { Address, Hex } from "viem";
import {
  BSC_CAIP2,
  BSC_STABLECOINS,
  FEEDS,
  STAKE_TIERS,
  X402_EXACT_PERMIT2_PROXY,
  ZERO_ADDRESS,
  findStablecoin,
  type AssetTransferMethod,
} from "@/lib/reckon/constants";
import type { StoredSignalRecord } from "./store";

export interface X402PaymentExtra {
  name: string;
  version: string;
  assetTransferMethod: AssetTransferMethod;
  signerAddress?: Address;
  spenderAddress?: Address;
}

export interface X402PaymentRequirement {
  scheme: "exact";
  network: typeof BSC_CAIP2;
  asset: Address;
  amount: string;
  maxAmountRequired: string;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra: X402PaymentExtra;
}

export interface X402ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
}

export interface X402PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: X402ResourceInfo;
  accepts: X402PaymentRequirement[];
  extensions?: {
    bazaar?: BazaarExtension;
  };
}

export interface BazaarExtension {
  info: {
    input: {
      type: "http";
      method: "GET";
      discoverable: true;
    };
    output: {
      type: "json";
      example: {
        signalId: string;
        feedSymbol: string;
        epochId: number;
        claimedProbBps: number;
        thesis: string;
      };
    };
  };
  schema: {
    $schema: string;
    type: "object";
    properties: Record<string, unknown>;
  };
}

export interface Eip3009AuthorizationPayload {
  from: Address;
  to: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
}

export interface Permit2AuthorizationPayload {
  permitted: {
    token: Address;
    amount: string;
  };
  from: Address;
  spender: Address;
  nonce: string;
  deadline: string;
  witness?: {
    to?: Address;
    validAfter?: string;
  };
}

export interface X402PaymentSignatureEnvelope {
  x402Version: 2;
  accepted: {
    scheme: string;
    network: string;
    asset: Address;
    amount?: string;
    maxAmountRequired?: string;
    payTo: Address;
    extra?: Partial<X402PaymentExtra>;
  };
  resource?: Partial<X402ResourceInfo>;
  payload: {
    signature: Hex;
    authorization?: Eip3009AuthorizationPayload;
    permit2Authorization?: Permit2AuthorizationPayload;
  };
  extensions?: Record<string, unknown>;
}

export function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function decodeBase64Json<T = unknown>(encoded: string): T {
  const cleaned = encoded.trim();
  const json = Buffer.from(cleaned, "base64").toString("utf8");
  return JSON.parse(json) as T;
}

export function buildBazaarExtension(
  signal: Pick<StoredSignalRecord, "id" | "feedId" | "epochId">,
): BazaarExtension {
  const feed = FEEDS[signal.feedId] ?? FEEDS[0];
  return {
    info: {
      input: {
        type: "http",
        method: "GET",
        discoverable: true,
      },
      output: {
        type: "json",
        example: {
          signalId: signal.id,
          feedSymbol: feed.symbol,
          epochId: signal.epochId,
          claimedProbBps: 7400,
          thesis: "Verified forecaster probabilistic thesis unlocked on payment.",
        },
      },
    },
    schema: {
      $schema: "https://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        signal: { type: "object" },
        receipt: { type: "object" },
        integrity: { type: "object" },
      },
    },
  };
}

export function buildPaymentRequired(params: {
  signal: StoredSignalRecord;
  resourceUrl: string;
  facilitatorSignerAddress: Address;
  b402SupportedExtras?: Record<string, Partial<X402PaymentExtra>>;
  error?: string;
}): X402PaymentRequired {
  const { signal, resourceUrl, facilitatorSignerAddress, b402SupportedExtras, error } = params;
  const feed = FEEDS[signal.feedId] ?? FEEDS[0];
  const tier = STAKE_TIERS[signal.tierId] ?? STAKE_TIERS[0];

  // Prioritize seller preferred token first, then zero-approval EIP-3009 (USD1, U), then Permit2 (USDT, USDC).
  const preferred = findStablecoin(signal.preferredToken);
  const orderedCoins = [
    ...(preferred ? [preferred] : []),
    ...BSC_STABLECOINS.filter((c) => c.address.toLowerCase() !== preferred?.address.toLowerCase()),
  ];

  const accepts: X402PaymentRequirement[] = orderedCoins.map((coin) => {
    const override = b402SupportedExtras?.[coin.address.toLowerCase()];
    const method = override?.assetTransferMethod ?? coin.assetTransferMethod;
    const signerAddress = override?.signerAddress ?? facilitatorSignerAddress;
    const hasSigner = signerAddress && signerAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
    const isPermit2 = method === "permit2" || method === "permit2-exact";
    const extra: X402PaymentExtra = {
      name: override?.name ?? coin.name,
      version: override?.version ?? coin.version,
      assetTransferMethod: method,
      ...(hasSigner ? { signerAddress } : {}),
      ...(isPermit2
        ? { spenderAddress: override?.spenderAddress ?? coin.spenderAddress ?? X402_EXACT_PERMIT2_PROXY }
        : {}),
    };

    return {
      scheme: "exact",
      network: BSC_CAIP2,
      asset: coin.address,
      amount: signal.priceAtomic,
      maxAmountRequired: signal.priceAtomic,
      payTo: signal.seller,
      maxTimeoutSeconds: 300,
      extra,
    };
  });

  return {
    x402Version: 2,
    ...(error ? { error } : {}),
    resource: {
      url: resourceUrl,
      description: `Reckon Verified Signal: ${signal.title} (${feed.symbol}, Epoch #${signal.epochId}, ${tier.label})`,
      mimeType: "application/json",
    },
    accepts,
    extensions: {
      bazaar: buildBazaarExtension(signal),
    },
  };
}

export function parsePaymentSignatureHeader(rawHeader: string): X402PaymentSignatureEnvelope {
  let decoded: Record<string, unknown>;
  try {
    decoded = rawHeader.trim().startsWith("{")
      ? (JSON.parse(rawHeader) as Record<string, unknown>)
      : decodeBase64Json<Record<string, unknown>>(rawHeader);
  } catch {
    throw new Error("PAYMENT-SIGNATURE header must be valid base64-encoded JSON");
  }

  if (decoded.x402Version !== 2) {
    throw new Error(`Unsupported x402Version: expected 2, got ${String(decoded.x402Version)}`);
  }

  const rawAccepted = Array.isArray(decoded.accepted) ? decoded.accepted[0] : decoded.accepted;
  if (!rawAccepted || typeof rawAccepted !== "object") {
    throw new Error("PAYMENT-SIGNATURE missing accepted payment requirement");
  }
  const accepted = rawAccepted as X402PaymentSignatureEnvelope["accepted"];
  if (!accepted.asset || !accepted.payTo || accepted.network !== BSC_CAIP2) {
    throw new Error(`Accepted payment must target ${BSC_CAIP2} with valid asset and payTo`);
  }

  const payload = decoded.payload as X402PaymentSignatureEnvelope["payload"] | undefined;
  if (!payload || typeof payload !== "object" || !/^0x[a-fA-F0-9]{130}$/.test(payload.signature ?? "")) {
    throw new Error("PAYMENT-SIGNATURE missing valid 65-byte hex signature");
  }

  if (!payload.authorization && !payload.permit2Authorization) {
    throw new Error("PAYMENT-SIGNATURE must contain authorization (eip3009) or permit2Authorization");
  }

  return {
    x402Version: 2,
    accepted,
    resource: decoded.resource as Partial<X402ResourceInfo> | undefined,
    payload,
    extensions: decoded.extensions as Record<string, unknown> | undefined,
  };
}
