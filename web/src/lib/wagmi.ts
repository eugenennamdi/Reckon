"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  binanceWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  trustWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";

const rpcUrl =
  process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org/";

// Falls back to RainbowKit's public development ID when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is unset locally.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "YOUR_PROJECT_ID";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        binanceWallet,
        rabbyWallet,
        zerionWallet,
        metaMaskWallet,
      ],
    },
    {
      groupName: "More Wallets",
      wallets: [
        walletConnectWallet,
        trustWallet,
        okxWallet,
      ],
    },
  ],
  {
    appName: "Reckon",
    appDescription:
      "Sybil-proof commit-reveal forecasting & verified signals on BNB Chain.",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://reckon.markets",
    projectId: walletConnectProjectId,
  },
);

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors,
  transports: {
    [bsc.id]: http(rpcUrl),
  },
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
