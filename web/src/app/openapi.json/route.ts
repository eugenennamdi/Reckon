import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/site";
import {
  AGENT_ID_ADDRESS,
  BSC_CHAIN_ID,
  getReckonCoreAddress,
  getReckonSignalRegistryAddress,
} from "@/lib/reckon/constants";

export const runtime = "nodejs";

export function GET() {
  const siteUrl = getSiteUrl();
  const core = getReckonCoreAddress();
  const registry = getReckonSignalRegistryAddress();

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Reckon Protocol API",
      version: "1.0.0",
      summary:
        "BNB Chain 4-hour commit-reveal forecasting markets, soulbound Agent ID Brier calibration leaderboard, B402/x402 verified signals, and 8-tool MCP server.",
      description: `Read-only market/reputation data, HTTP 402 verified signal commerce, and unsigned Binance Agentic Wallet (baw) calldata preparation on BNB Chain (chainId ${BSC_CHAIN_ID}). Contracts: ReckonCore (${core}), ReckonSignalRegistry (${registry}), SPACE ID Agent ID (${AGENT_ID_ADDRESS}).`,
      contact: {
        name: "Reckon Protocol",
        url: `${siteUrl}/contact`,
        email: "hello@reckon.markets",
      },
      license: {
        name: "MIT",
        url: "https://github.com/eugenennamdi/Reckon/blob/main/LICENSE",
      },
    },
    servers: [{ url: siteUrl, description: "BNB Chain Mainnet Production" }],
    paths: {
      "/api/rounds": {
        get: {
          operationId: "getRounds",
          summary: "Get live Chainlink prices and rolling 4-hour forecasting rounds",
          description:
            "Returns live BNB/USD, BTC/USD, and ETH/USD Chainlink prices, canonical 4-hour UTC epoch slots, and optional active/unclaimed positions for an explicit EVM address.",
          parameters: [
            {
              name: "agent",
              in: "query",
              required: false,
              description: "Optional 0x-prefixed EVM address to include active pending rounds and commitments.",
              schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            },
            {
              name: "beforeEpoch",
              in: "query",
              required: false,
              description: "Optional epoch cursor for paginating historical 4-hour rounds.",
              schema: { type: "integer", minimum: 1 },
            },
          ],
          responses: {
            "200": {
              description: "Live prices and canonical 4-hour round snapshots.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RoundsResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/ProblemError" },
            "429": { $ref: "#/components/responses/ProblemError" },
          },
        },
      },
      "/api/leaderboard": {
        get: {
          operationId: "getLeaderboard",
          summary: "Get permanent on-chain Agent ID accuracy leaderboard",
          description:
            "Returns paginated forecaster profiles bound to soulbound .ai Agent IDs, including mean Brier score, Brier Skill Score (BSS), reveal rate, competitive round count, and 10-bin calibration data.",
          parameters: [
            {
              name: "offset",
              in: "query",
              required: false,
              description: "Zero-based pagination offset.",
              schema: { type: "integer", minimum: 0, default: 0 },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Maximum number of agents to return (1 to 100).",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            "200": {
              description: "Paginated calibration leaderboard.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LeaderboardResponse" },
                },
              },
            },
            "429": { $ref: "#/components/responses/ProblemError" },
          },
        },
      },
      "/api/signals": {
        get: {
          operationId: "listSignals",
          summary: "List verified forecaster signals with post-reveal integrity status",
          description:
            "Returns published x402/B402 signals with seller on-chain calibration metrics and post-reveal anti-fraud integrity tags (PENDING, VERIFIED_MATCH, MISMATCH, UNREVEALED, ORACLE_CANCELLED).",
          parameters: [
            {
              name: "feedId",
              in: "query",
              required: false,
              description: "Filter by asset feed (0 = BNB/USD, 1 = BTC/USD, 2 = ETH/USD).",
              schema: { type: "integer", enum: [0, 1, 2] },
            },
            {
              name: "seller",
              in: "query",
              required: false,
              description: "Filter by seller 0x EVM address.",
              schema: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            },
            {
              name: "integrity",
              in: "query",
              required: false,
              description: "Filter by post-reveal integrity status.",
              schema: {
                type: "string",
                enum: ["PENDING", "VERIFIED_MATCH", "MISMATCH", "UNREVEALED", "ORACLE_CANCELLED"],
              },
            },
          ],
          responses: {
            "200": {
              description: "Signal catalog and settlement facilitator mode.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SignalsListResponse" },
                },
              },
            },
          },
        },
      },
      "/api/signals/{id}": {
        get: {
          operationId: "getSignalOrChallenge",
          summary: "Request HTTP 402 payment requirements or unlock a paid signal",
          description:
            "Without PAYMENT-SIGNATURE, returns HTTP 402 Payment Required with Base64 PAYMENT-REQUIRED x402 v2 requirements for USD1, U, USDT, or USDC. With a valid PAYMENT-SIGNATURE header, settles directly to the seller on BNB Chain and returns the decrypted thesis.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Unique signal identifier.",
              schema: { type: "string", minLength: 1 },
            },
            {
              name: "PAYMENT-SIGNATURE",
              in: "header",
              required: false,
              description: "Single-use x402 v2 signed payment payload from baw x402-payment sign or wallet.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Payment settled on BNB Chain and encrypted signal thesis unlocked.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UnlockedSignalResponse" },
                },
              },
            },
            "402": {
              description: "HTTP 402 Payment Required with x402 v2 PAYMENT-REQUIRED header and JSON challenge.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ProblemDetails" },
                },
              },
            },
            "404": { $ref: "#/components/responses/ProblemError" },
          },
        },
      },
      "/api/mcp": {
        get: {
          operationId: "getMcpManifest",
          summary: "Discover Reckon MCP server metadata and 8 tool definitions",
          description:
            "Returns the JSON discovery manifest for Reckon's 8-tool Model Context Protocol (MCP) server.",
          responses: {
            "200": {
              description: "MCP discovery manifest.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/McpManifestResponse" },
                },
              },
            },
          },
        },
        post: {
          operationId: "invokeMcpJsonRpc",
          summary: "Execute an MCP JSON-RPC 2.0 request (tools/list or tools/call)",
          description:
            "Invoke read-only market/leaderboard/signal queries or prepare unsigned ReckonCore / ReckonSignalRegistry calldata and baw contract-call preview commands.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/McpJsonRpcRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "JSON-RPC 2.0 response payload.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/McpJsonRpcResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/ProblemError" },
          },
        },
      },
    },
    components: {
      responses: {
        ProblemError: {
          description: "Structured JSON error response with code, message, and resolution hint.",
          content: {
            "application/problem+json": {
              schema: { $ref: "#/components/schemas/ProblemDetails" },
            },
          },
        },
      },
      schemas: {
        ProblemDetails: {
          type: "object",
          required: ["type", "title", "status", "code", "message", "resolution"],
          properties: {
            type: { type: "string", format: "uri" },
            title: { type: "string" },
            status: { type: "integer" },
            code: { type: "string" },
            message: { type: "string" },
            resolution: { type: "string" },
            docs: { type: "string", format: "uri" },
          },
        },
        RoundsResponse: {
          type: "object",
          properties: {
            serverTime: { type: "integer" },
            currentEpochId: { type: "integer" },
            coreAddress: { type: "string" },
            registryAddress: { type: "string" },
            deployed: { type: "boolean" },
            prices: { type: "array", items: { type: "object" } },
            rounds: { type: "array", items: { type: "object" } },
            pendingRounds: { type: "array", items: { type: "object" } },
          },
        },
        LeaderboardResponse: {
          type: "object",
          properties: {
            totalAgents: { type: "integer" },
            agents: { type: "array", items: { type: "object" } },
          },
        },
        SignalsListResponse: {
          type: "object",
          properties: {
            serverTime: { type: "integer" },
            facilitatorMode: { type: "string" },
            signals: { type: "array", items: { type: "object" } },
          },
        },
        UnlockedSignalResponse: {
          type: "object",
          properties: {
            id: { type: "string" },
            seller: { type: "string" },
            title: { type: "string" },
            thesis: { type: "string" },
            claimedProbBps: { type: "integer" },
            settlementTxHash: { type: "string" },
          },
        },
        McpManifestResponse: {
          type: "object",
          properties: {
            protocolVersion: { type: "string" },
            serverInfo: { type: "object" },
            tools: { type: "array", items: { type: "object" } },
          },
        },
        McpJsonRpcRequest: {
          type: "object",
          required: ["jsonrpc", "id", "method"],
          properties: {
            jsonrpc: { type: "string", enum: ["2.0"] },
            id: { oneOf: [{ type: "string" }, { type: "integer" }] },
            method: { type: "string", enum: ["initialize", "tools/list", "tools/call"] },
            params: { type: "object" },
          },
        },
        McpJsonRpcResponse: {
          type: "object",
          properties: {
            jsonrpc: { type: "string" },
            id: { oneOf: [{ type: "string" }, { type: "integer" }, { type: "null" }] },
            result: { type: "object" },
            error: { type: "object" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/openapi+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
