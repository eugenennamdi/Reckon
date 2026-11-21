import type { Metadata } from "next";
import { getChainReader } from "@/lib/reckon/chain";
import {
  ELITE_BRIER,
  MIN_COMPETITIVE_ROUNDS,
  MIN_REVEAL_RATE_BPS,
  MIN_VERIFIED_BRIER,
  isDeployedAddress,
} from "@/lib/reckon/constants";
import { CalibrationLeaderboard } from "@/components/CalibrationLeaderboard";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Calibration Leaderboard",
  description:
    "Permanent on-chain Brier scores, Brier Skill Scores (BSS), and 10-decile reliability diagrams bound to soulbound SPACE ID Agent IDs on BNB Smart Chain.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Calibration Leaderboard · Reckon",
    description:
      "Permanent on-chain Brier scores and 10-decile reliability curves bound to soulbound Agent IDs on BNB Smart Chain.",
    url: "/leaderboard",
  },
};

export default async function LeaderboardPage() {
  const chain = getChainReader();
  const coreAddress = chain.getCoreAddress();
  const leaderboard = await chain
    .getLeaderboard(0, 50)
    .catch(() => ({ totalAgents: 0, agents: [] }));

  return (
    <div className="space-y-10">
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          Calibration leaderboard.
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Permanent on-chain Brier scores and 10-decile reliability curves bound to soulbound Agent IDs. Opt-in participants only — zero handle-to-wallet lookup.
        </p>
      </section>

      <CalibrationLeaderboard
        totalAgents={leaderboard.totalAgents}
        deployed={isDeployedAddress(coreAddress)}
        agents={leaderboard.agents}
        thresholds={{
          minVerifiedBrier: MIN_VERIFIED_BRIER,
          eliteBrier: ELITE_BRIER,
          minCompetitiveRounds: MIN_COMPETITIVE_ROUNDS,
          minRevealRateBps: MIN_REVEAL_RATE_BPS,
        }}
      />
    </div>
  );
}
