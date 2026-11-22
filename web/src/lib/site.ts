export const SITE_NAME = "Reckon";
export const SITE_TAGLINE = "Predict 4-Hour Crypto Prices on BNB Chain";
export const SITE_DESCRIPTION =
  "Predict whether BNB, BTC, or ETH finishes higher in 4 hours, build a permanent on-chain accuracy score on your Binance Agent ID (.ai), and buy or sell verified signals directly in stablecoins on BNB Chain.";

export const SITE_KEYWORDS = [
  "Reckon",
  "BNB Chain",
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
