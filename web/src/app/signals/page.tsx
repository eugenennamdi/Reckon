import type { Metadata } from "next";
import { getChainReader } from "@/lib/reckon/chain";
import { FEEDS, STAKE_TIERS, findStablecoin } from "@/lib/reckon/constants";
import { computeIntegrityCheck } from "@/lib/x402/attestation";
import { getFacilitatorMode } from "@/lib/x402/facilitator";
import { getSignalStore } from "@/lib/x402/store";
import { SignalDesk, type CatalogSignalItem } from "@/components/SignalDesk";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Verified Signal Desk",
  description:
    "Direct peer-to-peer B402 / x402 v2 forecasting signal marketplace gated on live on-chain Brier calibration on BNB Smart Chain.",
  alternates: { canonical: "/signals" },
  openGraph: {
    title: "Verified Signal Desk · Reckon",
    description:
      "Direct peer-to-peer B402 / x402 v2 signal marketplace with zero server custody and live on-chain calibration verification.",
    url: "/signals",
  },
};

export default async function SignalsPage() {
  const chain = getChainReader();
  const coreAddress = chain.getCoreAddress();
  const registryAddress = chain.getRegistryAddress();
  const nowSec = Math.floor(Date.now() / 1000);

  let store: ReturnType<typeof getSignalStore> | null = null;
  try {
    store = getSignalStore();
  } catch {
    // Build-time ISR shell without runtime RECKON_STORE_ENCRYPTION_KEY; API routes remain fail-closed.
  }

  const [stored, providerData] = await Promise.all([
    store ? store.listSignals().catch(() => []) : Promise.resolve([]),
    chain.getProviders(0, 100).catch(() => ({ totalProviders: 0, providers: [] })),
  ]);

  const initialSignals: CatalogSignalItem[] = await Promise.all(
    stored.map(async (sig) => {
      const [profile, roundAndEntry, purchaseCount] = await Promise.all([
        chain.getEffectiveProfile(sig.seller).catch(() => ({
          address: sig.seller,
          handle: "",
          handleHash: "0x0" as const,
          roundsCommitted: 0,
          roundsRevealed: 0,
          roundsScored: 0,
          competitiveRoundsScored: 0,
          roundsMissed: 0,
          firstActiveAt: 0,
          cumulativeBrier: "0",
          totalVolumeWei: "0",
          meanBrier: 0,
          bssPct: 0,
          revealRateBps: 0,
          isVerified: false,
          bucketCounts: Array(10).fill(0),
          bucketHits: Array(10).fill(0),
        })),
        chain.getRoundAndEntry(sig.roundId, sig.seller).catch(() => ({
          round: null,
          entry: null,
        })),
        store ? store.getPurchaseCount(sig.id) : Promise.resolve(0),
      ]);

      const round = roundAndEntry.round;
      const roundState = round?.state ?? "NONE";
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
        claimedProbRedacted: isPreResolve,
        claimedProbBps: isPreResolve ? null : sig.claimedProbBps,
        integrity: computeIntegrityCheck({
          claimedProbBps: sig.claimedProbBps,
          roundState,
          entry: roundAndEntry.entry,
        }),
        endpointUrl: `/api/signals/${sig.id}`,
      };
    }),
  );

  return (
    <div className="space-y-10">
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          Verified signal desk.
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Peer-to-peer probabilistic research gated on live on-chain calibration. Zero server custody — every payment settles directly to the forecaster&apos;s Agent ID wallet.
        </p>
      </section>

      <SignalDesk
        coreAddress={coreAddress}
        registryAddress={registryAddress}
        initialFacilitatorMode={getFacilitatorMode()}
        initialSignals={initialSignals}
        initialProviders={providerData.providers}
      />
    </div>
  );
}
