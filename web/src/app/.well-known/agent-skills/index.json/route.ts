import { NextResponse } from "next/server";
import { buildAgentSkillsIndex } from "@/lib/agent-docs";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";

export function GET() {
  const siteUrl = getSiteUrl();
  return NextResponse.json(buildAgentSkillsIndex(siteUrl), {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
