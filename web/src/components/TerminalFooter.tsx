import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  AGENT_ID_ADDRESS,
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
  isDeployedAddress,
} from "@/lib/reckon/constants";
import { ReckonMark } from "./ReckonMark";

export function TerminalFooter() {
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();

  return (
    <footer className="mt-20 border-t border-black/[0.06] bg-card px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1240px] py-8">
        {/* Top Row: Brand + Specs (Left) & Uniform Navigation/Protocol Links (Right) */}
        <div className="flex flex-col gap-5 border-b border-black/[0.06] pb-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-[-0.015em] text-foreground transition-opacity hover:opacity-80"
            >
              <ReckonMark size={15} className="text-foreground" />
              <span>Reckon</span>
            </Link>
            <span className="h-3 w-px bg-black/[0.12]" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">
              Ownerless · Immutable · 0% Fee
            </span>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-foreground">
              Markets
            </Link>
            <Link href="/leaderboard" className="transition-colors hover:text-foreground">
              Leaderboard
            </Link>
            <Link href="/signals" className="transition-colors hover:text-foreground">
              Signals
            </Link>
            <Link href="/security" className="transition-colors hover:text-foreground">
              Security
            </Link>

            <span className="hidden h-3 w-px bg-black/[0.12] sm:inline-block" aria-hidden="true" />

            <a
              href={`https://bscscan.com/address/${AGENT_ID_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <span>Agent ID</span>
              <ArrowUpRight size={11} />
            </a>
            {isDeployedAddress(core) && (
              <a
                href={`https://bscscan.com/address/${core}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <span>ReckonCore</span>
                <ArrowUpRight size={11} />
              </a>
            )}
            {isDeployedAddress(registry) && (
              <a
                href={`https://bscscan.com/address/${registry}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <span>SignalRegistry</span>
                <ArrowUpRight size={11} />
              </a>
            )}
            <a
              href="/api/mcp"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <span>MCP API</span>
              <ArrowUpRight size={11} />
            </a>
          </nav>
        </div>

        {/* Bottom Row: Risk & Independence Disclosure (Left) + Network Stamp (Right) */}
        <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            Independent open-source protocol on BNB Chain — not affiliated with or endorsed by Binance. Forecasting stakes are at risk of loss, unrevealed commitments forfeit 100% of stake, and signal purchases do not ensure accuracy or profit. Smart contract &amp; oracle risks apply; not financial advice — always DYOR.
          </p>
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground/80">
            BNB Chain · Chain ID 56
          </span>
        </div>
      </div>
    </footer>
  );
}
