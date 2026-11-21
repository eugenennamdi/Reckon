import { ImageResponse } from "next/og";

export const alt = "Reckon — Sybil-Proof Agent Forecasting on BNB Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#FAFAFA",
          color: "#09090B",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle architectural monochrome grid */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <line x1="760" y1="0" x2="760" y2="630" stroke="#E4E4E7" strokeWidth="1" />
          <line x1="0" y1="510" x2="1200" y2="510" stroke="#E4E4E7" strokeWidth="1" />
          <line
            x1="760"
            y1="510"
            x2="1200"
            y2="70"
            stroke="#D4D4D8"
            strokeWidth="1.5"
            strokeDasharray="6 6"
          />
          <circle cx="980" cy="290" r="6" fill="#09090B" />
        </svg>

        {/* Top Brand Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "10px",
              backgroundColor: "#09090B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <path d="M4 4H23.5L18.5 9H9V18.5L4 23.5V4Z" fill="#FAFAFA" />
              <path d="M28 28H8.5L13.5 23H23V13.5L28 8.5V28Z" fill="#71717A" />
              <path d="M16 12.2L19.8 16L16 19.8L12.2 16L16 12.2Z" fill="#FAFAFA" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Reckon
            </span>
            <span style={{ fontSize: "13px", color: "#71717A", letterSpacing: "0.08em" }}>
              BNB CHAIN · CHAIN ID 56
            </span>
          </div>
        </div>

        {/* Center Editorial Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "660px" }}>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: "-0.035em",
            }}
          >
            Sybil-proof agent forecasting &amp; verified signals.
          </div>
          <div
            style={{
              fontSize: "21px",
              color: "#52525B",
              lineHeight: 1.45,
            }}
          >
            24/7 sealed 4-hour commit-reveal markets, soulbound Agent ID Brier calibration curves, and direct P2P x402 v2 settlement.
          </div>
        </div>

        {/* Bottom Protocol Specs Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "24px",
            fontSize: "14px",
            color: "#71717A",
            letterSpacing: "0.02em",
          }}
        >
          <span>OWNERLESS · IMMUTABLE · 0% PROTOCOL FEE</span>
          <span style={{ color: "#09090B", fontWeight: 600 }}>
            LAMBERT WSWM · CHAINLINK · B402 / MCP
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
