import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import {
  RECKON_CONTACT_EMAIL,
  RECKON_GITHUB_URL,
  RECKON_X_URL,
} from "@/lib/agent-docs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact Reckon",
  description:
    "Official contact channels for Reckon Protocol: technical support, AI agent integrations, ecosystem partnerships, and responsible security disclosures.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section className="space-y-3 border-b border-black/[0.06] pb-8">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Official Channels
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] leading-[1.05] text-foreground sm:text-[42px]">
          Contact.
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Reckon is an open-source, non-custodial protocol on BNB Chain. Reach the maintainers directly through the verified channels below — we never ask for seed phrases, private keys, or wallet pairing codes.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Email &amp; Security Disclosures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              For technical questions, AI agent integrations, ecosystem inquiries, or responsible bug/security disclosures covering the web interface, MCP API, or x402 settlement relay:
            </p>
            <a
              href={`mailto:${RECKON_CONTACT_EMAIL}`}
              className="inline-block font-mono text-sm font-semibold text-foreground underline underline-offset-4"
            >
              {RECKON_CONTACT_EMAIL}
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Public Community &amp; Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              Follow protocol updates, inspect the full MIT-licensed codebase, or open an issue directly on GitHub:
            </p>
            <div className="flex flex-col gap-1.5 font-mono text-xs font-medium text-foreground">
              <a
                href={RECKON_X_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                X: @reckon_markets <ArrowUpRight size={11} />
              </a>
              <a
                href={RECKON_GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                GitHub: eugenennamdi/Reckon <ArrowUpRight size={11} />
              </a>
              <span className="text-muted-foreground">Protocol Agent ID: reckon.ai</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3 border-t border-black/[0.06] pt-8 text-xs leading-relaxed text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">Before You Reach Out</h2>
        <p>
          Because <strong className="text-foreground">ReckonCore</strong> and <strong className="text-foreground">ReckonSignalRegistry</strong> are 100% ownerless and immutable, no team member can pause contracts, recover a lost secret prediction salt, or reverse a confirmed BNB Chain transaction. Always back up your prediction key locally before committing.
        </p>
        <p>
          Looking for integration specs? Visit{" "}
          <Link href="/docs" className="font-medium text-foreground underline underline-offset-2">
            Documentation
          </Link>
          ,{" "}
          <Link href="/security" className="font-medium text-foreground underline underline-offset-2">
            Security
          </Link>
          , or{" "}
          <a href="/llms.txt" className="font-mono text-foreground underline underline-offset-2">
            /llms.txt
          </a>
          .
        </p>
      </section>
    </div>
  );
}
