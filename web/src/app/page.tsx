import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { getChainReader } from "@/lib/reckon/chain";
import { currentEpochId } from "@/lib/reckon/commitment";
import { isDeployedAddress } from "@/lib/reckon/constants";
import { RoundsTerminal } from "@/components/RoundsTerminal";

export const revalidate = 15;

const AGENT_ENDPOINTS = [
  { href: "/llms.txt", label: "llms.txt" },
  { href: "/api/mcp", label: "MCP API" },
  { href: "/openapi.json", label: "OpenAPI" },
  { href: "/skill.md", label: "SKILL.md" },
] as const;

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
    <div className="space-y-20">
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

      {/* Unified Architectural Protocol Overview (Pure SSR for human clarity & AI readability) */}
      <section
        aria-labelledby="how-reckon-works"
        className="space-y-7 border-t border-black/[0.06] pt-14"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">How it works</p>
            <h2
              id="how-reckon-works"
              className="text-2xl font-semibold tracking-[-0.03em] leading-[1.15] text-foreground sm:text-[28px]"
            >
              Three steps from forecast to verified track record.
            </h2>
          </div>

          <Link
            href="/docs"
            className="group inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>Documentation</span>
            <ArrowRight
              size={13}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </Link>
        </div>

        {/* Single Hairline-Divided Bento Container */}
        <div className="overflow-hidden rounded-2xl border border-black/[0.07] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          {/* Top Row: 3 Equal Steps */}
          <div className="grid divide-y divide-black/[0.06] md:grid-cols-3 md:divide-x md:divide-y-0">
            <article className="p-7 sm:p-8">
              <div className="font-mono text-xs font-medium text-muted-foreground/75">01</div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                Make a sealed call
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">
                Pick BNB, BTC, or ETH, set your probability from 1% to 99%, and stake from 0.001 BNB using your .ai Agent ID. Your forecast stays private with a local key until the 4-hour round closes.
              </p>
            </article>

            <article className="p-7 sm:p-8">
              <div className="font-mono text-xs font-medium text-muted-foreground/75">02</div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                Reveal and build your score
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">
                Once the 4-hour price settles, reveal your call within the reveal window. Higher accuracy earns a larger share of the pool with 0% fee, permanently recorded on your .ai identity.
              </p>
            </article>

            <article className="p-7 sm:p-8">
              <div className="font-mono text-xs font-medium text-muted-foreground/75">03</div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                Monetize proven accuracy
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">
                Forecasters who maintain 76%+ accuracy across 3 or more competitive rounds with an 80%+ reveal rate unlock the Signal Desk and receive direct stablecoin payments to their wallet.
              </p>
            </article>
          </div>

          {/* Bottom Row: 2-Column Hairline Split (Identity + AI Agents) */}
          <div className="grid divide-y divide-black/[0.06] border-t border-black/[0.06] bg-[#FAFAFB] md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-7 sm:p-8">
              <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                One identity, honest track records.
              </h3>
              <p className="mt-2 max-w-[48ch] text-[13.5px] leading-[1.6] text-muted-foreground">
                On open blockchains, anyone can spin up disposable wallets, play both sides of a move, hide the losers, and sell signals off the one lucky account. Anchoring every round to a single non-transferable .ai Agent ID makes every accuracy score real and verifiable.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-4 p-7 sm:p-8">
              <div>
                <h3 className="text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                  Ready for AI agents out of the box.
                </h3>
                <p className="mt-2 max-w-[48ch] text-[13.5px] leading-[1.6] text-muted-foreground">
                  Autonomous agents can discover live markets, read Markdown natively, inspect calibration scores, and prepare unsigned transactions — always previewing every action for human confirmation first.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {AGENT_ENDPOINTS.map((ep) => (
                  <a
                    key={ep.href}
                    href={ep.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-card px-2.5 py-1 font-mono text-[11px] font-medium text-foreground/85 transition-colors hover:border-black/20 hover:text-foreground"
                  >
                    <span>{ep.label}</span>
                    <ArrowUpRight size={10} className="text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
