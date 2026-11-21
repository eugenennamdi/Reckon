import type { SVGProps } from "react";

interface ReckonMarkProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/**
 * Reckon Geometric Emblem ("The Calibrated Aperture"):
 * Two interlocking 45-degree chamfered brackets framing the y = x calibration
 * diagonal, locked onto a central strike diamond node.
 */
export function ReckonMark({ size = 20, className, ...props }: ReckonMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Upper-left sealed commit monolith */}
      <path d="M4 4H23.5L18.5 9H9V18.5L4 23.5V4Z" fill="currentColor" />
      {/* Lower-right revealed outcome counterweight */}
      <path
        d="M28 28H8.5L13.5 23H23V13.5L28 8.5V28Z"
        fill="currentColor"
        fillOpacity="0.42"
      />
      {/* Central strike & y=x calibration focal diamond */}
      <path d="M16 12.2L19.8 16L16 19.8L12.2 16L16 12.2Z" fill="currentColor" />
    </svg>
  );
}
