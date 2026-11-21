import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
