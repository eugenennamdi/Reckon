import type { Address, Hex } from "viem";

export const BSC_CHAIN_ID = 56 as const;
export const BSC_CAIP2 = "eip155:56" as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const satisfies Address;

export const BSC_RPC_URLS: readonly string[] = [
  ...(process.env.BSC_RPC_URL ? [process.env.BSC_RPC_URL] : []),
  ...(process.env.NEXT_PUBLIC_BSC_RPC_URL ? [process.env.NEXT_PUBLIC_BSC_RPC_URL] : []),
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc-rpc.publicnode.com",
];

export const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F" as const satisfies Address;
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const satisfies Address;
export const X402_EXACT_PERMIT2_PROXY = "0x402085c248EeA27D92E8b30b2C58ed07f9E20001" as const satisfies Address;

// RECKON_SYNC:CORE_START
export const DEFAULT_RECKON_CORE_ADDRESS: Address = ZERO_ADDRESS;
// RECKON_SYNC:CORE_END
// RECKON_SYNC:REGISTRY_START
export const DEFAULT_RECKON_SIGNAL_REGISTRY_ADDRESS: Address = ZERO_ADDRESS;
// RECKON_SYNC:REGISTRY_END

export function getReckonCoreAddress(): Address {
  const addr = process.env.NEXT_PUBLIC_RECKON_CORE_ADDRESS || process.env.RECKON_CORE_ADDRESS;
  if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
    return addr as Address;
  }
  return DEFAULT_RECKON_CORE_ADDRESS;
}

export function getReckonSignalRegistryAddress(): Address {
  const addr =
    process.env.NEXT_PUBLIC_RECKON_SIGNAL_REGISTRY_ADDRESS ||
    process.env.RECKON_SIGNAL_REGISTRY_ADDRESS;
  if (addr && /^0x[a-fA-F0-9]{40}$/.test(addr)) {
    return addr as Address;
  }
  return DEFAULT_RECKON_SIGNAL_REGISTRY_ADDRESS;
}

export function isDeployedAddress(addr: string | undefined | null): addr is Address {
  return Boolean(
    addr &&
      /^0x[a-fA-F0-9]{40}$/.test(addr) &&
      addr.toLowerCase() !== ZERO_ADDRESS.toLowerCase(),
  );
}

export interface FeedSpec {
  readonly id: 0 | 1 | 2;
  readonly symbol: "BNB/USD" | "BTC/USD" | "ETH/USD";
  readonly base: "BNB" | "BTC" | "ETH";
  readonly address: Address;
  readonly decimals: 8;
  readonly heartbeatSec: number;
}

export const FEEDS: readonly FeedSpec[] = [
  {
    id: 0,
    symbol: "BNB/USD",
    base: "BNB",
    address: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE",
    decimals: 8,
    heartbeatSec: 27,
  },
  {
    id: 1,
    symbol: "BTC/USD",
    base: "BTC",
    address: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf",
    decimals: 8,
    heartbeatSec: 60,
  },
  {
    id: 2,
    symbol: "ETH/USD",
    base: "ETH",
    address: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e",
    decimals: 8,
    heartbeatSec: 60,
  },
] as const;

export interface StakeTierSpec {
  readonly id: 0 | 1 | 2;
  readonly label: "Starter" | "Standard" | "Pro";
  readonly stakeBnb: string;
  readonly stakeWei: bigint;
}

export const STAKE_TIERS: readonly StakeTierSpec[] = [
  { id: 0, label: "Starter", stakeBnb: "0.002", stakeWei: 2_000_000_000_000_000n },
  { id: 1, label: "Standard", stakeBnb: "0.005", stakeWei: 5_000_000_000_000_000n },
  { id: 2, label: "Pro", stakeBnb: "0.01", stakeWei: 10_000_000_000_000_000n },
] as const;

// Exact ReckonCore.sol timing & scoring constants (4h UTC candle pipeline: 24/7 OPEN, 0% blackout)
export const EPOCH_DURATION = 14_400; // 4h
export const COMMIT_DURATION = 14_400; // 4h
export const OBSERVE_DURATION = 14_400; // 4h
export const REVEAL_DURATION = 14_400; // 4h
export const ORACLE_HALT_GRACE = 7_200; // 2h
export const EMERGENCY_CANCEL_DELAY = 604_800; // 7d
export const MAX_ORACLE_STALENESS = 1_800; // 30m

export const MIN_PROB_BPS = 100; // 1.00%
export const MAX_PROB_BPS = 9_900; // 99.00%
export const PROB_SCALE = 10_000;
export const BRIER_SCALE = 100_000_000;

export const MIN_VERIFIED_BRIER = 76_000_000; // 0.7600 (+4.0% BSS)
export const ELITE_BRIER = 78_000_000; // 0.7800 (+12.0% BSS display tier)
export const COIN_FLIP_BRIER = 75_000_000; // 0.7500
export const MIN_COMPETITIVE_ROUNDS = 3;
export const MIN_REVEAL_RATE_BPS = 8_000; // 80.00%
export const MAX_PENDING_ROUNDS = 27;

export const ROUND_STATES = [
  "NONE",
  "OPEN",
  "LOCKED",
  "REVEAL",
  "AWAITING_ORACLE",
  "CLAIMABLE",
  "NO_REVEALS",
  "CANCELLED_ORACLE",
] as const;

export type RoundStateName = (typeof ROUND_STATES)[number];

// "permit2" is the canonical x402 v2 & `baw x402-payment preview` wire method;
// "permit2-exact" is also accepted when overridden by Binance B402 /supported.
export type AssetTransferMethod = "eip3009" | "permit2" | "permit2-exact";

export interface BscStablecoinSpec {
  readonly symbol: "USD1" | "U" | "USDT" | "USDC";
  readonly address: Address;
  readonly decimals: 18;
  readonly assetTransferMethod: AssetTransferMethod;
  readonly name: string;
  readonly version: string;
  readonly needApproveFirstPossible: boolean;
  readonly domainSeparator?: Hex;
  readonly spenderAddress?: Address;
}

// Live-verified on BSC Mainnet (chainId 56) against on-chain DOMAIN_SEPARATOR()
export const BSC_STABLECOINS: readonly BscStablecoinSpec[] = [
  {
    symbol: "USD1",
    address: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
    decimals: 18,
    assetTransferMethod: "eip3009",
    name: "World Liberty Financial USD",
    version: "1",
    needApproveFirstPossible: false,
    domainSeparator: "0x5d939dc193fd011c5e26fb861450a696546a09db6b26db26501fe354ba3ed4ba",
  },
  {
    symbol: "U",
    address: "0xcE24439F2D9C6a2289F741120FE202248B666666",
    decimals: 18,
    assetTransferMethod: "eip3009",
    name: "United Stables",
    version: "1",
    needApproveFirstPossible: false,
    domainSeparator: "0x358738403e5a61fdc30a8be78a60f289cbe4d2545b735a344b6229c70c1679b6",
  },
  {
    symbol: "USDT",
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18,
    assetTransferMethod: "permit2",
    name: "Tether USD",
    version: "1",
    needApproveFirstPossible: true,
    spenderAddress: X402_EXACT_PERMIT2_PROXY,
  },
  {
    symbol: "USDC",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    assetTransferMethod: "permit2",
    name: "USD Coin",
    version: "1",
    needApproveFirstPossible: true,
    spenderAddress: X402_EXACT_PERMIT2_PROXY,
  },
] as const;

export function findStablecoin(tokenOrSymbol: string): BscStablecoinSpec | undefined {
  const normalized = tokenOrSymbol.trim().toLowerCase();
  return BSC_STABLECOINS.find(
    (s) => s.symbol.toLowerCase() === normalized || s.address.toLowerCase() === normalized,
  );
}

// Facilitator safety floor ($0.10) vs on-chain ReckonSignalRegistry ceiling ($50.00)
export const MIN_SIGNAL_PRICE_ATOMIC = 100_000_000_000_000_000n; // $0.10
export const MAX_SIGNAL_PRICE_ATOMIC = 50_000_000_000_000_000_000n; // $50.00

export const RISK_DISCLOSURE =
  "Risk Warning: Forecasting stakes are at risk of loss. Poorly calibrated predictions or failure to reveal before the reveal deadline result in partial or total stake forfeiture. Signal purchases do not ensure accuracy or profit. Smart contract and oracle risks apply. Not financial advice — always DYOR.";
