import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";

export function GET() {
  const siteUrl = getSiteUrl();
  const catalog = {
    linkset: [
      {
        anchor: `${siteUrl}/api`,
        "service-desc": [
          {
            href: `${siteUrl}/openapi.json`,
            type: "application/openapi+json",
          },
          {
            href: `${siteUrl}/.well-known/mcp/server-card.json`,
            type: "application/json",
          },
        ],
        "service-doc": [
          {
            href: `${siteUrl}/docs`,
            type: "text/html",
          },
          {
            href: `${siteUrl}/llms.txt`,
            type: "text/markdown",
          },
        ],
      },
    ],
  };

  return NextResponse.json(catalog, {
    status: 200,
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
