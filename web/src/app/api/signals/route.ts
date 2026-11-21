import { NextResponse } from "next/server";
import { getChainReader } from "@/lib/reckon/chain";
import { FEEDS, STAKE_TIERS, findStablecoin } from "@/lib/reckon/constants";
import { computeIntegrityCheck } from "@/lib/x402/attestation";
import { getFacilitatorMode } from "@/lib/x402/facilitator";
import { getSignalStore } from "@/lib/x402/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feedFilter = url.searchParams.get("feedId");
  const sellerFilter = url.searchParams.get("seller")?.toLowerCase();
  const roundFilter = url.searchParams.get("roundId");
  const integrityFilter = url.searchParams.get("integrity");

  const store = getSignalStore();
  const chain = getChainReader();
  const nowSec = Math.floor(Date.now() / 1000);
  const all = await store.listSignals();

  const filtered = all.filter((s) => {
    if (feedFilter !== null && feedFilter !== "" && String(s.feedId) !== feedFilter) return false;
    if (sellerFilter && s.seller.toLowerCase() !== sellerFilter) return false;
    if (roundFilter !== null && roundFilter !== "" && String(s.roundId) !== roundFilter) return false;
    return true;
  });

  const enriched = await Promise.all(
    filtered.map(async (sig) => {
      const [profile, roundAndEntry, purchaseCount] = await Promise.all([
        chain.getEffectiveProfile(sig.seller),
        chain.getRoundAndEntry(sig.roundId, sig.seller),
        store.getPurchaseCount(sig.id),
      ]);

      const round = roundAndEntry.round;
      const roundState = round?.state ?? "NONE";
      const integrity = computeIntegrityCheck({
        claimedProbBps: sig.claimedProbBps,
        roundState,
        entry: roundAndEntry.entry,
      });

      const isPreResolve =
        roundState === "OPEN" ||
        roundState === "LOCKED" ||
        (round ? nowSec < round.resolveTime : false);

      const coin = findStablecoin(sig.preferredToken);
      const feed = FEEDS[sig.feedId] ?? FEEDS[0];
      const tier = STAKE_TIERS[sig.tierId] ?? STAKE_TIERS[0];

      return {
        id: sig.id,
        seller: sig.seller,
        handle: profile.handle,
        isVerified: profile.isVerified,
        meanBrier: profile.meanBrier,
        bssPct: profile.bssPct,
        revealRateBps: profile.revealRateBps,
        competitiveRoundsScored: profile.competitiveRoundsScored,
        roundId: sig.roundId,
        feedId: sig.feedId,
        feedSymbol: feed.symbol,
        epochId: sig.epochId,
        tierId: sig.tierId,
        tierLabel: tier.label,
        roundState,
        resolveTime: round?.resolveTime ?? null,
        outcome: round?.oracleSettled ? round.outcome : null,
        title: sig.title,
        summary: sig.summary,
        priceAtomic: sig.priceAtomic,
        preferredToken: sig.preferredToken,
        preferredTokenSymbol: coin?.symbol ?? "USD1",
        thesisHash: sig.thesisHash,
        createdAt: sig.createdAt,
        purchaseCount,
        // Prevent pre-resolve free-riding: never expose claimedProbBps publicly while LOCKED!
        claimedProbRedacted: isPreResolve,
        claimedProbBps: isPreResolve ? null : sig.claimedProbBps,
        integrity,
        attestation: isPreResolve ? null : sig.attestation,
        signature: isPreResolve ? null : sig.signature,
        endpointUrl: `/api/signals/${sig.id}`,
      };
    }),
  );

  const finalList = integrityFilter
    ? enriched.filter((item) => item.integrity.status === integrityFilter)
    : enriched;

  return NextResponse.json({
    serverTime: nowSec,
    facilitatorMode: getFacilitatorMode(),
    signals: finalList,
  });
}
