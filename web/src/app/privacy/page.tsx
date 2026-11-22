import type { Metadata } from "next";
import Link from "next/link";
import { RECKON_CONTACT_EMAIL, RECKON_GITHUB_URL } from "@/lib/agent-docs";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Reckon Privacy Policy: zero user accounts, zero credential collection, local-only prediction salts, and transparent public BNB Chain data handling.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Local-First · Non-Custodial
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          Privacy Policy.
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Reckon is a non-custodial web interface and API for public BNB Chain smart contracts. We minimize data collection by design.
        </p>
      </section>

      <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
          1. Information We Do Not Collect
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">No Accounts or Passwords:</strong> Reckon does not offer user accounts, sign-up forms, password authentication, or server-side wallet login sessions.
          </li>
          <li>
            <strong className="text-foreground">No Private Keys or Pairing Codes:</strong> Reckon never asks for, transmits, or stores seed phrases, private keys, exchange API secrets, or Binance Agentic Wallet pairing codes.
          </li>
          <li>
            <strong className="text-foreground">Local-Only Prediction Salts:</strong> Secret salts used to seal and reveal your 4-hour predictions are generated strictly on your device (browser <code className="font-mono text-xs text-foreground">localStorage</code> or local <code className="font-mono text-xs text-foreground">~/.reckon/salts.json</code>) and are never sent to Reckon servers.
          </li>
          <li>
            <strong className="text-foreground">No Arbitrary Wallet-by-Name Lookup:</strong> Reckon only displays on-chain profiles for addresses that voluntarily transact with <code className="font-mono text-xs text-foreground">ReckonCore</code> or <code className="font-mono text-xs text-foreground">ReckonSignalRegistry</code>.
          </li>
        </ul>
      </section>

      <section className="space-y-4 border-t border-black/[0.06] pt-8 text-sm leading-relaxed text-muted-foreground">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
          2. Public Blockchain &amp; Signal Data
        </h2>
        <p>
          Transactions broadcast to BNB Chain (<code className="font-mono text-xs text-foreground">chainId 56</code>) are permanent and publicly visible on-chain, including participating wallet addresses, Agent ID handles, revealed forecasts, and Brier scores.
        </p>
        <p>
          Verified Forecasters who voluntarily publish paid x402 signals submit encrypted analysis stored at rest with AES-256-GCM encryption in Upstash Redis; decrypted text is delivered only after verified stablecoin payment directly to the seller. Standard infrastructure logs (such as IP-based rate-limiting counters and edge access logs) are processed transiently to maintain service reliability.
        </p>
      </section>

      <section className="space-y-3 border-t border-black/[0.06] pt-8 text-xs leading-relaxed text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">3. Questions &amp; Open-Source Verification</h2>
        <p>
          You can audit every line of frontend, API, and smart contract code at{" "}
          <a href={RECKON_GITHUB_URL} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
            GitHub
          </a>
          , review our{" "}
          <Link href="/security" className="font-medium text-foreground underline underline-offset-2">
            Security page
          </Link>
          , or email{" "}
          <a href={`mailto:${RECKON_CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-2">
            {RECKON_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
