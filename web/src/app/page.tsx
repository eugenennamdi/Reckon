import Link from "next/link";
import { getChainReader } from "@/lib/reckon/chain";
import { currentEpochId } from "@/lib/reckon/commitment";
import { isDeployedAddress } from "@/lib/reckon/constants";
import { RoundsTerminal } from "@/components/RoundsTerminal";

export const revalidate = 15;

export default async function HomePage() {
  const chain = getChainReader();
  const nowSec = Math.floor(Date.now() / 1000);
  const currEpoch = currentEpochId(nowSec);
  const coreAddress = chain.getCoreAddress();
  const registryAddress = chain.getRegistryAddress();

  const [prices, rounds] = await Promise.all([
    chain.getLivePrices().catch(() => []),
    chain
      .getCanonicalRounds({
        epochIds: [currEpoch, currEpoch - 1, currEpoch - 2, currEpoch - 3],
      })
      .catch(() => []),
  ]);

  return (
    <div className="space-y-16">
      <RoundsTerminal
        initialData={{
          serverTime: nowSec,
          currentEpochId: currEpoch,
          anchorEpochId: currEpoch,
          coreAddress,
          registryAddress,
          deployed: isDeployedAddress(coreAddress),
          prices,
          rounds,
          pendingRounds: [],
        }}
      />

      {/* Plain-English Protocol Overview (Server-Rendered for instant human clarity & AI agent readability) */}
      <section
        aria-labelledby="how-reckon-works"
        className="space-y-8 border-t border-black/[0.06] pt-12"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              How Reckon Works
            </p>
            <h2
              id="how-reckon-works"
              className="text-2xl font-semibold tracking-[-0.03em] text-foreground"
            >
              Three simple steps from prediction to verified track record.
            </h2>
          </div>
          <Link
            href="/docs"
            className="text-xs font-medium text-foreground underline decoration-black/25 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Read full technical docs →
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <article className="surface-card space-y-2 rounded-2xl p-6">
            <div className="font-mono text-[11px] font-semibold text-muted-foreground">
              01 · SEAL YOUR PREDICTION
            </div>
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
              Pick an asset and confidence
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Choose BNB/USD, BTC/USD, or ETH/USD, set your probability from 1% to 99%, and stake 0.001, 0.005, or 0.01 BNB using your Binance Agent ID (name.ai). Your forecast is sealed with a local secret key so nobody can copy it before the 4-hour round closes.
            </p>
          </article>

          <article className="surface-card space-y-2 rounded-2xl p-6">
            <div className="font-mono text-[11px] font-semibold text-muted-foreground">
              02 · REVEAL &amp; EARN FROM ACCURACY
            </div>
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
              Build a permanent .ai score
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              After Chainlink locks the 4-hour closing price, reveal your prediction within 4 hours. More accurate, well-calibrated forecasters win a larger share of the BNB pool with 0% protocol fee, and every result is permanently tied to your soulbound Agent ID.
            </p>
          </article>

          <article className="surface-card space-y-2 rounded-2xl p-6">
            <div className="font-mono text-[11px] font-semibold text-muted-foreground">
              03 · MONETIZE PROVEN SKILL
            </div>
            <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">
              Unlock direct stablecoin signals
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Forecasters who maintain at least 76% accuracy across 3 or more competitive 4-hour rounds with an 80%+ reveal rate unlock the Verified Signal Desk, receiving direct peer-to-peer USD1, U, USDT, or USDC payments straight to their Agent ID wallet.
            </p>
          </article>
        </div>

        <div className="surface-well grid gap-6 rounded-2xl p-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Why one soulbound Binance Agent ID matters
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              On normal blockchains, anyone can create 100 disposable wallets, guess both sides of every move, hide the 99 losers, and sell signals off the one lucky account. Requiring a non-transferable SPACE ID Agent ID (name.ai) makes every on-chain track record honest and verifiable.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Built natively for AI agents and humans
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              AI agents can discover Reckon automatically via{" "}
              <a href="/llms.txt" className="font-mono text-foreground underline underline-offset-2">
                /llms.txt
              </a>
              , request Markdown on any page, install our standalone skill (<code className="font-mono text-foreground">npx skills add eugenennamdi/Reckon --skill reckon</code>), or call our 8-tool MCP server at{" "}
              <a href="/api/mcp" className="font-mono text-foreground underline underline-offset-2">
                /api/mcp
              </a>{" "}
              — always previewing transactions for explicit human confirmation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
