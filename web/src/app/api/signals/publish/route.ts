import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { getChainReader } from "@/lib/reckon/chain";
import {
  BSC_CHAIN_ID,
  BSC_STABLECOINS,
  MAX_SIGNAL_PRICE_ATOMIC,
  MIN_SIGNAL_PRICE_ATOMIC,
  findStablecoin,
  isDeployedAddress,
} from "@/lib/reckon/constants";
import { checkRateLimit, extractClientIp } from "@/lib/x402/rateLimit";
import { getSignalStore } from "@/lib/x402/store";
import {
  verifySignalAttestation,
  type SignalAttestationPayload,
} from "@/lib/x402/attestation";

const USD1_DEFAULT_FALLBACK = BSC_STABLECOINS[0].address;

function checkControlChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return false;
    }
  }
  return true;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PublishBody {
  title?: unknown;
  summary?: unknown;
  thesis?: unknown;
  priceAtomic?: unknown;
  preferredToken?: unknown;
  attestation?: Partial<SignalAttestationPayload>;
  signature?: unknown;
}

export async function POST(request: Request) {
  const ip = extractClientIp(request.headers);
  const ipLimit = checkRateLimit(`publish:ip:${ip}`, 20, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for IP address", resetAt: ipLimit.resetAt },
      { status: 429 },
    );
  }

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rawSummary = typeof body.summary === "string" ? body.summary.trim() : "";
  const thesis = typeof body.thesis === "string" ? body.thesis.trim() : "";
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (title.length < 4 || title.length > 120 || !checkControlChars(title)) {
    return NextResponse.json(
      { error: "title must be 4..120 safe printable characters" },
      { status: 400 },
    );
  }
  const summary = rawSummary.length > 0 ? rawSummary : title.slice(0, 140);
  if (summary.length > 280 || !checkControlChars(summary)) {
    return NextResponse.json(
      { error: "summary must be <= 280 safe printable characters" },
      { status: 400 },
    );
  }
  if (thesis.length < 20 || thesis.length > 4000) {
    return NextResponse.json(
      { error: "thesis must be between 20 and 4000 characters" },
      { status: 400 },
    );
  }

  let priceAtomicBig: bigint;
  try {
    if (typeof body.priceAtomic !== "string" && typeof body.priceAtomic !== "number") {
      throw new Error("missing priceAtomic");
    }
    priceAtomicBig = BigInt(body.priceAtomic);
  } catch {
    return NextResponse.json({ error: "priceAtomic must be an integer string in 18-decimal wei" }, { status: 400 });
  }
  if (priceAtomicBig < MIN_SIGNAL_PRICE_ATOMIC || priceAtomicBig > MAX_SIGNAL_PRICE_ATOMIC) {
    return NextResponse.json(
      {
        error: `priceAtomic must be between ${MIN_SIGNAL_PRICE_ATOMIC.toString()} ($0.10) and ${MAX_SIGNAL_PRICE_ATOMIC.toString()} ($50.00)`,
      },
      { status: 400 },
    );
  }

  let preferredToken: Address = USD1_DEFAULT_FALLBACK;
  if (typeof body.preferredToken === "string" && body.preferredToken.trim().length > 0) {
    const coin = findStablecoin(body.preferredToken);
    if (!coin) {
      return NextResponse.json(
        { error: "preferredToken must be a supported BSC stablecoin (USD1, U, USDT, USDC)" },
        { status: 400 },
      );
    }
    preferredToken = coin.address;
  }

  const attRaw = body.attestation;
  if (
    !attRaw ||
    typeof attRaw.seller !== "string" ||
    !isAddress(attRaw.seller) ||
    typeof attRaw.coreAddress !== "string" ||
    !isAddress(attRaw.coreAddress) ||
    typeof attRaw.thesisHash !== "string" ||
    typeof attRaw.chainId !== "number" ||
    typeof attRaw.feedId !== "number" ||
    typeof attRaw.epochId !== "number" ||
    typeof attRaw.tierId !== "number" ||
    typeof attRaw.roundId !== "number" ||
    typeof attRaw.claimedProbBps !== "number" ||
    typeof attRaw.issuedAt !== "number"
  ) {
    return NextResponse.json(
      { error: "attestation is missing required SignalAttestation EIP-712 fields" },
      { status: 400 },
    );
  }

  const seller = getAddress(attRaw.seller);
  const sellerLimit = checkRateLimit(`publish:seller:${seller.toLowerCase()}`, 10, 3_600_000);
  if (!sellerLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for seller wallet", resetAt: sellerLimit.resetAt },
      { status: 429 },
    );
  }

  const chain = getChainReader();
  const coreAddress = chain.getCoreAddress();
  if (!isDeployedAddress(coreAddress)) {
    return NextResponse.json(
      { error: "ReckonCore contract address is not configured yet" },
      { status: 503 },
    );
  }

  const attestation: SignalAttestationPayload = {
    chainId: attRaw.chainId,
    coreAddress: getAddress(attRaw.coreAddress),
    feedId: attRaw.feedId,
    epochId: attRaw.epochId,
    tierId: attRaw.tierId,
    roundId: attRaw.roundId,
    seller,
    claimedProbBps: attRaw.claimedProbBps,
    thesisHash: attRaw.thesisHash as Hex,
    issuedAt: attRaw.issuedAt,
  };

  if (attestation.chainId !== BSC_CHAIN_ID) {
    return NextResponse.json({ error: "Attestation must target BSC Mainnet (56)" }, { status: 400 });
  }

  // (a) Verify EIP-712 SignalAttestation signature
  const sigCheck = await verifySignalAttestation({
    attestation,
    signature: signature as Hex,
    thesis,
    expectedCoreAddress: coreAddress,
  });
  if (!sigCheck.valid) {
    return NextResponse.json(
      { error: `Invalid SignalAttestation: ${sigCheck.reason}` },
      { status: 401 },
    );
  }

  // (b) Verify on-chain Verified Forecaster status
  const verified = await chain.isVerifiedForecaster(seller);
  if (!verified) {
    return NextResponse.json(
      {
        error:
          "Seller does not currently satisfy ReckonCore.isVerifiedForecaster(seller) (>= 0.7600 Brier, >= 3 distinct competitive epochs, >= 80% reveal rate)",
      },
      { status: 403 },
    );
  }

  // (c) Verify on-chain commitment + round match
  const [hasCommitted, roundInfo] = await Promise.all([
    chain.hasCommitted(attestation.roundId, seller),
    chain.getRoundAndEntry(attestation.roundId, seller),
  ]);

  if (!hasCommitted || !roundInfo.round) {
    return NextResponse.json(
      { error: `Seller ${seller} has not committed to round ${attestation.roundId}` },
      { status: 403 },
    );
  }

  const r = roundInfo.round;
  if (
    r.feedId !== attestation.feedId ||
    r.epochId !== attestation.epochId ||
    r.tierId !== attestation.tierId
  ) {
    return NextResponse.json(
      { error: "Attestation (feedId, epochId, tierId) does not match on-chain round metadata" },
      { status: 400 },
    );
  }

  // (d) Strictly LOCKED and before resolveTime (never after resolveTime!)
  const nowSec = Math.floor(Date.now() / 1000);
  if (r.state !== "LOCKED" || nowSec >= r.resolveTime) {
    return NextResponse.json(
      {
        error: `Signals can only be published during LOCKED phase before resolveTime (current state=${r.state})`,
      },
      { status: 409 },
    );
  }

  const store = getSignalStore();
  const existing = await store.findBySellerAndRound(seller, attestation.roundId);
  if (existing) {
    return NextResponse.json(
      { error: `Signal already published for round ${attestation.roundId}` },
      { status: 409 },
    );
  }

  const record = await store.createSignal({
    seller,
    roundId: attestation.roundId,
    feedId: attestation.feedId,
    epochId: attestation.epochId,
    tierId: attestation.tierId,
    coreAddress,
    title,
    summary,
    priceAtomic: priceAtomicBig.toString(),
    preferredToken,
    claimedProbBps: attestation.claimedProbBps,
    thesis,
    thesisHash: attestation.thesisHash,
    attestation,
    signature: signature as Hex,
  });

  return NextResponse.json(
    {
      signal: {
        id: record.id,
        seller: record.seller,
        roundId: record.roundId,
        feedId: record.feedId,
        epochId: record.epochId,
        tierId: record.tierId,
        title: record.title,
        summary: record.summary,
        priceAtomic: record.priceAtomic,
        preferredToken: record.preferredToken,
        thesisHash: record.thesisHash,
        createdAt: record.createdAt,
      },
      endpointUrl: `/api/signals/${record.id}`,
    },
    { status: 201 },
  );
}
