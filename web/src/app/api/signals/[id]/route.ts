import { NextResponse } from "next/server";
import { getChainReader } from "@/lib/reckon/chain";
import { FEEDS, RISK_DISCLOSURE, STAKE_TIERS } from "@/lib/reckon/constants";
import { computeIntegrityCheck } from "@/lib/x402/attestation";
import {
  FacilitatorError,
  getB402SupportedExtras,
  getFacilitatorMode,
  getFacilitatorSignerAddress,
  verifyAndSettlePayment,
} from "@/lib/x402/facilitator";
import {
  buildPaymentRequired,
  encodeBase64Json,
  parsePaymentSignatureHeader,
} from "@/lib/x402/protocol";
import { checkRateLimit, extractClientIp } from "@/lib/x402/rateLimit";
import { getSignalStore } from "@/lib/x402/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    ...extra,
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = getSignalStore();
  const signal = await store.getSignalById(id);

  if (!signal) {
    return NextResponse.json({ error: `Signal ${id} not found` }, { status: 404 });
  }

  const mode = getFacilitatorMode();
  const signerAddress = getFacilitatorSignerAddress();
  const b402Extras = mode === "binance-b402" ? await getB402SupportedExtras() : undefined;
  const resourceUrl = new URL(request.url).toString();

  const paymentRequired = buildPaymentRequired({
    signal,
    resourceUrl,
    facilitatorSignerAddress: signerAddress,
    b402SupportedExtras: b402Extras,
  });
  const paymentRequiredB64 = encodeBase64Json(paymentRequired);

  const paymentSigHeader =
    request.headers.get("payment-signature") ?? request.headers.get("x-payment");

  const chain = getChainReader();
  const [profile, roundAndEntry] = await Promise.all([
    chain.getEffectiveProfile(signal.seller),
    chain.getRoundAndEntry(signal.roundId, signal.seller),
  ]);
  const roundState = roundAndEntry.round?.state ?? "NONE";
  const integrity = computeIntegrityCheck({
    claimedProbBps: signal.claimedProbBps,
    roundState,
    entry: roundAndEntry.entry,
  });

  const feed = FEEDS[signal.feedId] ?? FEEDS[0];
  const tier = STAKE_TIERS[signal.tierId] ?? STAKE_TIERS[0];

  if (!paymentSigHeader) {
    return NextResponse.json(
      {
        ...paymentRequired,
        facilitatorMode: mode,
        riskDisclosure: RISK_DISCLOSURE,
        signal: {
          id: signal.id,
          seller: signal.seller,
          handle: profile.handle,
          isVerified: profile.isVerified,
          meanBrier: profile.meanBrier,
          bssPct: profile.bssPct,
          roundId: signal.roundId,
          feedId: signal.feedId,
          feedSymbol: feed.symbol,
          epochId: signal.epochId,
          tierId: signal.tierId,
          tierLabel: tier.label,
          roundState,
          title: signal.title,
          summary: signal.summary,
          priceAtomic: signal.priceAtomic,
          preferredToken: signal.preferredToken,
          thesisHash: signal.thesisHash,
          integrity,
        },
      },
      {
        status: 402,
        headers: baseHeaders({
          "PAYMENT-REQUIRED": paymentRequiredB64,
        }),
      },
    );
  }

  const ip = extractClientIp(request.headers);
  const ipLimit = checkRateLimit(`unlock:ip:${ip}`, 60, 60_000);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for IP address", resetAt: ipLimit.resetAt },
      { status: 429, headers: baseHeaders() },
    );
  }

  let envelope: ReturnType<typeof parsePaymentSignatureHeader>;
  try {
    envelope = parsePaymentSignatureHeader(paymentSigHeader);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Invalid PAYMENT-SIGNATURE header";
    return NextResponse.json(
      {
        error: detail,
        code: "INVALID_PAYMENT_SIGNATURE",
        ...buildPaymentRequired({
          signal,
          resourceUrl,
          facilitatorSignerAddress: signerAddress,
          b402SupportedExtras: b402Extras,
          error: detail,
        }),
      },
      {
        status: 402,
        headers: baseHeaders({ "PAYMENT-REQUIRED": paymentRequiredB64 }),
      },
    );
  }

  const payerCandidate =
    envelope.payload.authorization?.from ?? envelope.payload.permit2Authorization?.from;
  if (payerCandidate) {
    const payerLimit = checkRateLimit(`unlock:payer:${payerCandidate.toLowerCase()}`, 30, 60_000);
    if (!payerLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded for payer wallet", resetAt: payerLimit.resetAt },
        { status: 429, headers: baseHeaders() },
      );
    }
  }

  try {
    const receipt = await verifyAndSettlePayment({
      envelope,
      signal,
      accepts: paymentRequired.accepts,
      store,
    });

    await store.recordPurchase({
      signalId: signal.id,
      payer: receipt.payer,
      payTo: receipt.payTo,
      asset: receipt.asset,
      amountAtomic: receipt.amount,
      txHash: receipt.txHash,
      facilitatorMode: receipt.facilitatorMode,
    });

    const thesis = store.decryptThesis(signal);
    const receiptB64 = encodeBase64Json(receipt);

    return NextResponse.json(
      {
        signal: {
          id: signal.id,
          seller: signal.seller,
          handle: profile.handle,
          isVerified: profile.isVerified,
          meanBrier: profile.meanBrier,
          bssPct: profile.bssPct,
          roundId: signal.roundId,
          feedId: signal.feedId,
          feedSymbol: feed.symbol,
          epochId: signal.epochId,
          tierId: signal.tierId,
          tierLabel: tier.label,
          roundState,
          title: signal.title,
          summary: signal.summary,
          priceAtomic: signal.priceAtomic,
          preferredToken: signal.preferredToken,
          claimedProbBps: signal.claimedProbBps,
          thesisHash: signal.thesisHash,
          thesis,
          attestation: signal.attestation,
          signature: signal.signature,
          createdAt: signal.createdAt,
        },
        receipt,
        integrity,
        riskDisclosure: RISK_DISCLOSURE,
      },
      {
        status: 200,
        headers: baseHeaders({
          "PAYMENT-RESPONSE": receiptB64,
        }),
      },
    );
  } catch (err) {
    if (err instanceof FacilitatorError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...(err.httpStatus === 402 ? paymentRequired : {}),
        },
        {
          status: err.httpStatus,
          headers:
            err.httpStatus === 402
              ? baseHeaders({ "PAYMENT-REQUIRED": paymentRequiredB64 })
              : baseHeaders(),
        },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment settlement failed" },
      { status: 500, headers: baseHeaders() },
    );
  }
}
