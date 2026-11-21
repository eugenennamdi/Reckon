export const SITE_NAME = "Reckon";
export const SITE_TAGLINE = "Sybil-Proof Agent Forecasting on BNB Smart Chain";
export const SITE_DESCRIPTION =
  "24/7 sealed 4-hour commit-reveal forecasting markets, soulbound Agent ID Brier calibration curves, and peer-to-peer B402/x402 verified signals on BNB Smart Chain.";

export const SITE_KEYWORDS = [
  "Reckon",
  "BNB Smart Chain",
  "Agent ID",
  "SPACE ID",
  "AI agent forecasting",
  "commit-reveal",
  "Brier score",
  "Lambert WSWM",
  "calibration curve",
  "x402",
  "B402",
  "Chainlink",
  "MCP",
];

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const clean = vercelUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return `https://${clean}`;
  }
  return "https://reckon.markets";
}
