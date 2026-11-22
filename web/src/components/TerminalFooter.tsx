import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  AGENT_ID_ADDRESS,
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
  isDeployedAddress,
} from "@/lib/reckon/constants";
import {
  RECKON_CONTACT_EMAIL,
  RECKON_GITHUB_URL,
  RECKON_X_URL,
} from "@/lib/agent-docs";
import { ReckonMark } from "./ReckonMark";

export function TerminalFooter() {
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();

  return (
    <footer className="mt-24 border-t border-black/[0.06] bg-card px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1240px] py-12">
        {/* Structured Multi-Column Architectural Footer */}
        <div className="grid grid-cols-2 gap-10 border-b border-black/[0.06] pb-10 md:grid-cols-12">
          {/* Brand Column */}
          <div className="col-span-2 space-y-3.5 md:col-span-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em] text-foreground transition-opacity hover:opacity-80"
            >
              <ReckonMark size={16} className="text-foreground" />
              <span>Reckon</span>
            </Link>
            <p className="max-w-xs text-[13px] leading-[1.6] text-muted-foreground">
              Sealed 4-hour crypto forecasting and verified on-chain signals. Ownerless, immutable, and 0% protocol fee.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs font-medium text-muted-foreground">
              <a
                href={RECKON_X_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <span>X</span>
                <ArrowUpRight size={11} />
              </a>
              <a
                href={RECKON_GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <span>GitHub</span>
                <ArrowUpRight size={11} />
              </a>
              <a
                href={`mailto:${RECKON_CONTACT_EMAIL}`}
                className="transition-colors hover:text-foreground"
              >
                {RECKON_CONTACT_EMAIL}
              </a>
            </div>
          </div>

          {/* Column 1: Product */}
          <nav aria-label="Product" className="space-y-3 md:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
              Product
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/" className="transition-colors hover:text-foreground">
                  Markets
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="transition-colors hover:text-foreground">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/signals" className="transition-colors hover:text-foreground">
                  Signals
                </Link>
              </li>
              <li>
                <Link href="/docs" className="transition-colors hover:text-foreground">
                  Documentation
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 2: Developers */}
          <nav aria-label="Developers" className="space-y-3 md:col-span-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
              Developers
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {isDeployedAddress(core) && (
                <li>
                  <a
                    href={`https://bscscan.com/address/${core}#code`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <span>ReckonCore</span>
                    <ArrowUpRight size={11} />
                  </a>
                </li>
              )}
              {isDeployedAddress(registry) && (
                <li>
                  <a
                    href={`https://bscscan.com/address/${registry}#code`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <span>SignalRegistry</span>
                    <ArrowUpRight size={11} />
                  </a>
                </li>
              )}
              <li>
                <a
                  href={`https://bscscan.com/address/${AGENT_ID_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <span>Agent ID</span>
                  <ArrowUpRight size={11} />
                </a>
              </li>
              <li>
                <a
                  href="/api/mcp"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <span>MCP API</span>
                  <ArrowUpRight size={11} />
                </a>
              </li>
              <li>
                <a
                  href="/openapi.json"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <span>OpenAPI</span>
                  <ArrowUpRight size={11} />
                </a>
              </li>
              <li>
                <a
                  href="/llms.txt"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <span>llms.txt</span>
                  <ArrowUpRight size={11} />
                </a>
              </li>
            </ul>
          </nav>

          {/* Column 3: Transparency */}
          <nav aria-label="Transparency" className="space-y-3 md:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
              Transparency
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link href="/security" className="transition-colors hover:text-foreground">
                  Security
                </Link>
              </li>
              <li>
                <Link href="/about" className="transition-colors hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Aligned Legal / Independence Bottom Bar */}
        <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-3xl text-[11.5px] leading-relaxed text-muted-foreground">
            Independent open-source protocol on BNB Chain — not affiliated with or endorsed by Binance. Forecasting stakes are at risk of loss, unrevealed predictions forfeit stake, and signal purchases do not ensure accuracy or profit. Smart contract &amp; oracle risks apply; not financial advice.
          </p>
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground/75">
            © 2026 Reckon · Chain 56
          </span>
        </div>
      </div>
    </footer>
  );
}
