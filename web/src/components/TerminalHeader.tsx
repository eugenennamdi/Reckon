"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  ArrowUpRight,
  ArrowsClockwise,
  CaretDown,
  Check,
  Copy,
  SignOut,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { formatEther } from "viem";
import {
  useAccount,
  useBalance,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { bsc } from "wagmi/chains";
import { agentIdAbi } from "@/lib/abi";
import { AGENT_ID_ADDRESS, BSC_CHAIN_ID } from "@/lib/reckon/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { BscChainIcon } from "./AssetIcon";
import { OnboardingModalTrigger } from "./OnboardingModal";
import { ReckonMark } from "./ReckonMark";

const NAV_ITEMS = [
  { href: "/", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/signals", label: "Signals" },
  { href: "/docs", label: "Docs" },
  { href: "/security", label: "Security" },
] as const;

/** Deterministic Swiss monochrome 3x3 geometric avatar derived from EVM address bytes. */
function AddressAvatar({ address, size = 36 }: { address: string; size?: number }) {
  const hex = address.replace(/^0x/i, "").padEnd(16, "0");
  const cells: number[] = [];
  for (let i = 0; i < 6; i++) {
    cells.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  // Symmetric 3x3 grid (columns 0,1 mirrored to 2)
  const grid = [
    cells[0] % 3, cells[1] % 3, cells[0] % 3,
    cells[2] % 3, cells[3] % 3, cells[2] % 3,
    cells[4] % 3, cells[5] % 3, cells[4] % 3,
  ];
  const fills = ["#111111", "#71717A", "#E4E4E7"];

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F4F4F5] ring-1 ring-black/[0.08]"
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 18 18" fill="none">
        {grid.map((tone, idx) => {
          const x = (idx % 3) * 6;
          const y = Math.floor(idx / 3) * 6;
          return (
            <rect
              key={idx}
              x={x + 0.6}
              y={y + 0.6}
              width={4.8}
              height={4.8}
              rx={1.1}
              fill={fills[tone]}
            />
          );
        })}
      </svg>
    </span>
  );
}

export function TerminalHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const { address, isConnected, chainId: walletChainId, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    if (!isConnected) setAccountOpen(false);
  }, [isConnected]);

  const activeHref = pendingHref ?? pathname;

  const { data: balanceRaw } = useReadContract({
    address: AGENT_ID_ADDRESS,
    abi: agentIdAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const { data: handleRaw } = useReadContract({
    address: AGENT_ID_ADDRESS,
    abi: agentIdAbi,
    functionName: "handleOf",
    args: address ? [address] : undefined,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const { data: nativeBalance } = useBalance({
    address,
    chainId: BSC_CHAIN_ID,
    query: { enabled: Boolean(address && accountOpen) },
  });

  const hasAgentId = typeof balanceRaw === "bigint" && balanceRaw > 0n && Boolean(handleRaw);
  const handle = typeof handleRaw === "string" ? handleRaw : "";
  const wrongChain =
    isConnected && walletChainId !== undefined && walletChainId !== BSC_CHAIN_ID;

  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const formattedBnb = nativeBalance
    ? Number(formatEther(nativeBalance.value)).toFixed(4)
    : "0.0000";

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddr(true);
      toast.success("Address copied");
      setTimeout(() => setCopiedAddr(false), 1600);
    } catch {
      toast.error("Could not access clipboard");
    }
  };

  const handleDisconnect = () => {
    setAccountOpen(false);
    disconnect();
    toast.success("Wallet disconnected");
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
          {/* Left: Brand Lockup + Unboxed Navigation */}
          <div className="flex h-full min-w-0 items-center gap-8">
            <Link href="/" className="group inline-flex shrink-0 items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-opacity duration-150 group-hover:opacity-85">
                <ReckonMark size={17} />
              </span>
              <span className="text-[15px] font-semibold tracking-[-0.025em] text-foreground">
                Reckon
              </span>
            </Link>

            <nav aria-label="Primary" className="hidden h-full items-center gap-6 md:flex">
              {NAV_ITEMS.map((item) => {
                const active = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      if (item.href !== pathname) setPendingHref(item.href);
                    }}
                    className={`relative inline-flex h-full items-center whitespace-nowrap text-[13px] transition-colors duration-150 ${
                      active
                        ? "font-medium text-foreground"
                        : "font-normal text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 -bottom-px h-[1.5px] bg-foreground"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Quiet Help Link + Single Primary Wallet Control */}
          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            <OnboardingModalTrigger />
            {!mounted ? (
              <div className="h-8 w-28 animate-pulse rounded-lg bg-black/[0.06]" />
            ) : isConnected && address ? (
              <>
                {wrongChain && (
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    disabled={isSwitching}
                    className="h-8 shrink-0 whitespace-nowrap rounded-lg px-2.5 text-[11px]"
                    onClick={() => switchChain({ chainId: bsc.id })}
                  >
                    <ArrowsClockwise size={12} className={isSwitching ? "animate-spin" : ""} />
                    {isSwitching ? "Switching" : "Switch to BNB Chain"}
                  </Button>
                )}

                <button
                  type="button"
                  aria-label="Open wallet account menu"
                  onClick={() => setAccountOpen(true)}
                  className="pressable inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-black/[0.09] bg-card px-2.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-border-strong hover:bg-secondary/60"
                >
                  {!wrongChain && <BscChainIcon size={14} />}
                  {hasAgentId ? (
                    <span className="font-mono text-xs font-medium text-foreground">
                      {handle}.ai
                    </span>
                  ) : (
                    <span className="font-mono text-xs tabular-nums text-foreground">
                      {shortAddress}
                    </span>
                  )}
                  <CaretDown size={11} className="shrink-0 text-muted-foreground" />
                </button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => openConnectModal?.()}
                className="h-8 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-medium tracking-[-0.01em]"
              >
                Connect wallet
              </Button>
            )}
          </div>
        </div>

        {/* Mobile navigation */}
        <nav
          aria-label="Mobile"
          className="flex h-10 items-center gap-5 overflow-x-auto border-t border-black/[0.05] px-4 md:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  if (item.href !== pathname) setPendingHref(item.href);
                }}
                className={`relative inline-flex h-full shrink-0 items-center whitespace-nowrap text-xs transition-colors duration-150 ${
                  active
                    ? "font-medium text-foreground"
                    : "font-normal text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[1.5px] bg-foreground"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Clean Architectural Account Modal */}
      {isConnected && address && (
        <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
          <DialogContent
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[380px]"
          >
            {/* Section 1: Identity Header */}
            <div className="flex items-center gap-3.5 px-6 pt-6 pb-5 pr-12">
              <AddressAvatar address={address} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <DialogTitle className="truncate font-mono text-[15px] font-semibold tracking-[-0.02em] tabular-nums text-foreground">
                    {hasAgentId ? `${handle}.ai` : shortAddress}
                  </DialogTitle>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    aria-label="Copy wallet address"
                    title="Copy wallet address"
                    className="pressable inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    {copiedAddr ? (
                      <Check size={12} weight="bold" className="text-foreground" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
                <DialogDescription className="mt-0.5 truncate text-xs text-muted-foreground">
                  {connector?.name ?? "Connected Wallet"}
                  {hasAgentId ? ` · ${shortAddress}` : ""}
                </DialogDescription>
              </div>
            </div>

            {/* Section 2: Balance & Network */}
            <div className="border-y border-black/[0.06] bg-[#FAFAFB] px-6 py-5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  BNB Chain Balance
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  {wrongChain ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  ) : (
                    <BscChainIcon size={14} />
                  )}
                  {wrongChain ? `Chain ${walletChainId}` : "BNB Chain"}
                </span>
              </div>

              <div className="mt-2 font-mono text-[28px] leading-none font-semibold tracking-[-0.035em] tabular-nums text-foreground">
                {formattedBnb}
                <span className="ml-1.5 text-sm font-medium text-muted-foreground">BNB</span>
              </div>

              {wrongChain && (
                <div className="mt-4 space-y-2.5 border-t border-black/[0.06] pt-3.5">
                  <p className="text-[11px] leading-relaxed text-destructive">
                    Wallet is currently on Chain #{walletChainId}. Switch to BNB Chain (56) to forecast or settle signals.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: bsc.id })}
                    className="h-9 w-full rounded-lg"
                  >
                    <ArrowsClockwise size={13} className={isSwitching ? "animate-spin" : ""} />
                    {isSwitching ? "Switching network…" : "Switch to BNB Chain"}
                  </Button>
                </div>
              )}
            </div>

            {/* Section 3: Agent ID Status */}
            <div className="border-b border-black/[0.06] px-6 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Agent ID</span>
                {hasAgentId ? (
                  <span className="font-mono text-[11px] font-medium text-foreground">
                    Verified
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Not linked
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {hasAgentId
                  ? `Soulbound identity ${handle}.ai active on BNB Chain. Ready to commit forecasts and publish signals.`
                  : "A soulbound SPACE ID Agent ID is required on BNB Chain to commit forecasts and prevent Sybil bracketing."}
              </p>
            </div>

            {/* Section 4: Footer Actions */}
            <div className="flex items-center justify-between gap-2 px-6 py-3.5">
              <a
                href={`https://bscscan.com/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>View on BscScan</span>
                <ArrowUpRight size={12} />
              </a>

              <button
                type="button"
                onClick={handleDisconnect}
                className="pressable inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-destructive/[0.07] hover:text-destructive"
              >
                <SignOut size={13} />
                <span>Disconnect</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
