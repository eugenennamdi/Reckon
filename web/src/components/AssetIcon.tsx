interface AssetIconProps {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg";
  active?: boolean;
}

const SIZE_MAP = {
  xs: 16,
  sm: 24,
  md: 34,
  lg: 40,
} as const;

/** Official BNB Smart Chain network icon (#F0B90B medallion + BNB Chain isometric cube mark). */
export function BscChainIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 rounded-full ${className}`}
    >
      <circle cx="14" cy="14" r="14" fill="#F0B90B" />
      <path
        fill="#FFFFFF"
        d="M7.694 14l.01 3.702 3.146 1.85v2.168l-4.986-2.924v-5.878L7.694 14Zm0-3.702v2.157l-1.832-1.083V9.214l1.832-1.083 1.841 1.083-1.841 1.084Zm4.47-1.084 1.832-1.083 1.84 1.083-1.84 1.084-1.832-1.084ZM9.018 16.935v-2.168l1.832 1.084v2.157l-1.832-1.073Zm3.146 3.394 1.832 1.084 1.84-1.084v2.157l-1.84 1.084-1.832-1.084V20.33Zm6.3-11.115 1.832-1.083 1.84 1.083v2.158l-1.84 1.083v-2.157l-1.832-1.084Zm1.832 8.488.01-3.702 1.831-1.084v5.879l-4.986 2.924v-2.167l3.145-1.85Zm-1.314-.767-1.832 1.073v-2.157l1.832-1.084v2.168Zm0-5.87.01 2.168-3.155 1.85v3.712l-1.831 1.073-1.832-1.073v-3.711l-3.155-1.851v-2.168l1.84-1.083 3.135 1.86 3.155-1.86 1.833 1.083Zm-9.964-3.7 4.977-2.935 4.987 2.935-1.832 1.083-3.154-1.86-3.146 1.86-1.832-1.083Z"
      />
    </svg>
  );
}

/** Authentic full-color vector token icons for BNB (#F0B90B), BTC (#F7931A), and ETH (#627EEA). */
export function AssetIcon({ symbol, size = "md", active = false }: AssetIconProps) {
  const base = symbol.split("/")[0]?.toUpperCase() ?? symbol.toUpperCase();
  const px = SIZE_MAP[size];

  return (
    <span
      aria-hidden="true"
      style={{ width: px, height: px }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-shadow duration-150 ${
        active
          ? "shadow-[0_0_0_2px_#ffffff,0_0_0_3.5px_rgba(0,0,0,0.16)]"
          : "shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
      }`}
    >
      {base === "BNB" ? (
        <svg width={px} height={px} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#F0B90B" />
          <path
            fill="#FFFFFF"
            d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26ZM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16Zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257ZM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16Zm-3.188-.002h.002V16L16 18.294l-2.291-2.29-.004-.004.004-.003.401-.402.195-.195L16 13.706l2.293 2.293-.001-.001Z"
          />
        </svg>
      ) : base === "BTC" ? (
        <svg width={px} height={px} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            fill="#FFFFFF"
            d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538Zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11Zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733Z"
          />
        </svg>
      ) : (
        <svg width={px} height={px} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path fill="#FFFFFF" fillOpacity="0.602" d="M16.498 4v8.87l7.497 3.35L16.498 4Z" />
          <path fill="#FFFFFF" d="M16.498 4L9 16.22l7.498-3.35V4Z" />
          <path fill="#FFFFFF" fillOpacity="0.602" d="M16.498 21.968v6.027L24 17.616l-7.502 4.352Z" />
          <path fill="#FFFFFF" d="M16.498 27.995v-6.028L9 17.616l7.498 10.379Z" />
          <path fill="#FFFFFF" fillOpacity="0.2" d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701Z" />
          <path fill="#FFFFFF" fillOpacity="0.602" d="M9 16.22l7.498 4.353v-7.701L9 16.22Z" />
        </svg>
      )}
    </span>
  );
}
