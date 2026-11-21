"use client";

import "@rainbow-me/rainbowkit/styles.css";

import {
  RainbowKitProvider,
  lightTheme,
  type DisclaimerComponent,
  type Theme,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { bsc } from "wagmi/chains";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/wagmi";

const baseLight = lightTheme({
  accentColor: "#111111",
  accentColorForeground: "#ffffff",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

const reckonWalletTheme: Theme = {
  ...baseLight,
  fonts: {
    body: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif",
  },
  radii: {
    ...baseLight.radii,
    actionButton: "9999px",
    connectButton: "9999px",
    menuButton: "12px",
    modal: "20px",
    modalMobile: "20px",
  },
  colors: {
    ...baseLight.colors,
    accentColor: "#111111",
    accentColorForeground: "#ffffff",
    actionButtonBorder: "rgba(0, 0, 0, 0.08)",
    actionButtonBorderMobile: "rgba(0, 0, 0, 0.08)",
    actionButtonSecondaryBackground: "#F4F4F5",
    closeButton: "#52525B",
    closeButtonBackground: "#F4F4F5",
    connectionIndicator: "#111111",
    error: "#C81E1E",
    generalBorder: "rgba(0, 0, 0, 0.07)",
    generalBorderDim: "rgba(0, 0, 0, 0.04)",
    menuItemBackground: "rgba(0, 0, 0, 0.045)",
    modalBackdrop: "rgba(9, 9, 11, 0.36)",
    modalBackground: "#FFFFFF",
    modalBorder: "rgba(0, 0, 0, 0.08)",
    modalText: "#111111",
    modalTextDim: "rgba(17, 17, 17, 0.38)",
    modalTextSecondary: "#6B6B70",
    profileAction: "#FFFFFF",
    profileActionHover: "#F5F5F7",
    profileForeground: "#F7F7F8",
    selectedOptionBorder: "rgba(0, 0, 0, 0.14)",
  },
  shadows: {
    ...baseLight.shadows,
    connectButton: "0 1px 2px rgba(0, 0, 0, 0.06)",
    dialog:
      "0 1px 2px rgba(0, 0, 0, 0.04), 0 20px 48px -12px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06)",
    profileDetailsAction: "0 1px 2px rgba(0, 0, 0, 0.04)",
    selectedOption: "0 1px 3px rgba(0, 0, 0, 0.08)",
    selectedWallet: "0 1px 3px rgba(0, 0, 0, 0.06)",
    walletLogo: "0 1px 4px rgba(0, 0, 0, 0.10)",
  },
};

const WalletDisclaimer: DisclaimerComponent = ({ Text, Link }) => (
  <Text>
    Standard client-side EVM wallets for BNB Chain (56) — zero server sessions, never scan an Agentic Wallet pairing QR on any site. Agentic Wallet runs locally via{" "}
    <Link href="/security">baw CLI</Link>.
  </Text>
);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={reckonWalletTheme}
          modalSize="compact"
          initialChain={bsc}
          appInfo={{
            appName: "Reckon",
            disclaimer: WalletDisclaimer,
          }}
        >
          <TooltipProvider delayDuration={280} skipDelayDuration={250}>
            {children}
            <Toaster />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
