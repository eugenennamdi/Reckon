import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/site";

function buildAgentLinkHeader(siteUrl: string): string {
  return [
    `<${siteUrl}/llms.txt>; rel="describedby"; type="text/markdown"`,
    `<${siteUrl}/openapi.json>; rel="service-desc"; type="application/openapi+json"`,
    `<${siteUrl}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
    `<${siteUrl}/.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"`,
  ].join(", ");
}

function parseQ(acceptHeader: string, mediaType: string): number {
  const parts = acceptHeader.toLowerCase().split(",");
  let best = -1;
  for (const rawPart of parts) {
    const [typePart, ...params] = rawPart.trim().split(";");
    if (typePart.trim() !== mediaType) continue;
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split("=");
      if (k === "q" && v !== undefined) {
        const parsed = Number(v);
        if (Number.isFinite(parsed)) q = parsed;
      }
    }
    if (q > best) best = q;
  }
  return best;
}

/**
 * Returns true strictly when the caller explicitly requests `text/markdown`
 * with priority >= `text/html` (standard acceptmarkdown.com content negotiation).
 * Regular browsers send `Accept: text/html,...` and never match.
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader || !acceptHeader.toLowerCase().includes("text/markdown")) {
    return false;
  }
  const mdQ = parseQ(acceptHeader, "text/markdown");
  if (mdQ <= 0) return false;
  const htmlQ = parseQ(acceptHeader, "text/html");
  return htmlQ < 0 || mdQ >= htmlQ;
}

const BYPASS_EXACT = new Set([
  "/llms.txt",
  "/llms-full.txt",
  "/skill.md",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/opengraph-image",
  "/twitter-image",
  "/apple-icon",
  "/icon.svg",
  "/favicon.ico",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/.well-known/") ||
    BYPASS_EXACT.has(pathname) ||
    /\.[a-z0-9]{1,8}$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const accept = request.headers.get("accept");
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    prefersMarkdown(accept)
  ) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/api/md";
    rewriteUrl.searchParams.set("path", pathname);
    const res = NextResponse.rewrite(rewriteUrl);
    res.headers.set("Vary", "Accept");
    return res;
  }

  const response = NextResponse.next();
  response.headers.append("Vary", "Accept");
  response.headers.set("Link", buildAgentLinkHeader(getSiteUrl()));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon|opengraph-image|twitter-image).*)",
  ],
};
