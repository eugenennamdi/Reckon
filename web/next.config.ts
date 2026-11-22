import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Vary",
            value: "Accept, rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
          },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "radix-ui", "viem", "wagmi"],
  },
  turbopack: {
    resolveAlias: {
      "@coinbase/cdp-sdk": "./src/lib/empty-module.ts",
      "@react-native-async-storage/async-storage": "./src/lib/empty-module.ts",
    },
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@coinbase/cdp-sdk": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
