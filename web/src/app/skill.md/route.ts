import { NextResponse } from "next/server";
import { buildSkillMd } from "@/lib/agent-docs";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";

export function GET() {
  const siteUrl = getSiteUrl();
  return new NextResponse(buildSkillMd(siteUrl), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
