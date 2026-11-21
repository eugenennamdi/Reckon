import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090B",
        }}
      >
        <svg width="116" height="116" viewBox="0 0 32 32" fill="none">
          <path d="M4 4H23.5L18.5 9H9V18.5L4 23.5V4Z" fill="#FAFAFA" />
          <path d="M28 28H8.5L13.5 23H23V13.5L28 8.5V28Z" fill="#71717A" />
          <path d="M16 12.2L19.8 16L16 19.8L12.2 16L16 12.2Z" fill="#FAFAFA" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
