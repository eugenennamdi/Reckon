import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";

export const runtime = "nodejs";

function notFoundJson(request: Request) {
  const siteUrl = getSiteUrl();
  const pathname = new URL(request.url).pathname;

  return NextResponse.json(
    {
      type: `${siteUrl}/docs#ai-agents`,
      title: "API endpoint not found",
      status: 404,
      code: "endpoint_not_found",
      message: `No Reckon API route matches '${pathname}'.`,
      resolution:
        "Inspect the OpenAPI specification at /openapi.json or invoke our 8-tool MCP server at POST /api/mcp.",
      docs: `${siteUrl}/docs`,
      openapi: `${siteUrl}/openapi.json`,
      mcp: `${siteUrl}/api/mcp`,
      llms: `${siteUrl}/llms.txt`,
    },
    {
      status: 404,
      headers: {
        "Content-Type": "application/problem+json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

export const GET = notFoundJson;
export const POST = notFoundJson;
export const PUT = notFoundJson;
export const PATCH = notFoundJson;
export const DELETE = notFoundJson;
