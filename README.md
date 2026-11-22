# Reckon

**Sybil-proof, commit-reveal forecasting and B402/x402 verified signal protocol on BNB Chain.**

**Live App:** [https://reckon.markets](https://reckon.markets) · **MCP Server:** `https://reckon.markets/api/mcp` · **Agent ID:** `reckon.ai`

> **Core Thesis:** Remove Binance's soulbound Agent ID (`name.ai`), and burner-wallet cherry-picking plus WSWM Sybil bracketing immediately break the entire protocol. Reckon turns Agent ID into a mathematically load-bearing primitive for verifiable AI agent track records.

---

## Architecture Overview

1. **Layer 1 — 24/7 Rolling 4-Hour Sealed Commit-Reveal Forecasting (`ReckonCore.sol`):**
   - **100% Ownerless & Immutable:** Zero admin keys, zero upgrade proxy, zero pause switch, zero admin withdrawals, **0% protocol fee**.
   - **Hard Agent ID Gate:** Requires both `balanceOf(msg.sender) > 0` and non-empty `handleOf(msg.sender)` on SPACE ID Agent ID (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`).
   - **24/7 Rolling 4-Hour UTC Candle Grid (`00:00 / 04:00 / 08:00 / 12:00 / 16:00 / 20:00 UTC`):** Zero commit blackout — every 4h candle is `OPEN` (4h commit) while `E-1` is `LOCKED` (4h observe), `E-2` is `REVEAL` (4h post-outcome reveal), and `E-3` is `CLAIMABLE`. Deduplicated by `keccak256(abi.encode(feedId, epochId, tierId))` across 3 canonical 8-decimal Chainlink feeds (`BNB/USD`, `BTC/USD`, `ETH/USD`) and 3 native BNB micro-stake tiers (`0.001 / 0.005 / 0.01 BNB` — zero ERC-20 `approve()` transactions).
   - **Race-Proof Canonical Commitments:** Commitments bind to `(chainId, reckonCore, feedId, epochId, tierId, agent, probBps, salt)`, making 1-tx `commitEpoch` immune to concurrent round creation or front-running.
   - **Forward-Start ATM Strike & Grief-Proof Oracle Cancellation:** `strikePrice` is fixed at `commitEnd` (not at creation) via permissionless Chainlink `getRoundData` historical round bracketing (with OOG-hardened phase-rollover support). Healthy Chainlink feeds cannot be cancelled early (`OracleStillHealthy`), while proven `>30m` gaps (`cancelOracleGap`, hardened across post-gap phase rollovers), verified live feed halts after 2h (`cancelUnsettleableRound`), and a 7d black-swan safety valve ensure 100% stake recovery on oracle faults.
   - **Strict Post-Outcome Reveal:** `reveal()` opens strictly in `[resolveTime, revealEnd)` to preserve Layer 3 signal exclusivity during the 4-hour `LOCKED` window.

2. **Layer 2 — Strictly Proper Lambert WSWM & O(1) Soulbound Calibration Ledger:**
   - **Integer Brier Score (scaled $10^8$):** $S_i = 10^8 - (P_i - Y)^2$ for $P_i \in [100, 9900]$, $Y \in \{0, 10000\}$.
   - **Strictly Proper Payouts (Lambert et al., EC 2008) + Equal Forfeit Split:**
     $$\text{Payout}_i = \left\lfloor \frac{W \cdot (C \cdot 10^8 + N \cdot S_i - \Sigma S)}{N \cdot 10^8} \right\rfloor$$
     computed in O(1) gas via running `sumP` and `sumP2` accumulators (`previewPayout` for historical winnings + `claimablePayout` for exact live claimable wei). Per-round `remainingPool` accounting with the final claimer sweeping leftover floor dust ($\le N - 1$ wei) ensures exact solvency and zero locked dust.
   - **O(1) Anti-Score-Dodging, Global Calibration Ranking & 10-Bin Reliability Curve:** Bounded `pendingRoundIds` (cap `27`, covering 3 full 9-slot active 4-hour epochs, auto-flushed inside `commit()`) folds settled reveals and immediate post-`revealEnd` non-reveal penalties live into `getEffectiveProfile()`, alongside paginated `getAgents(offset, limit)` and an on-chain 10-decile calibration curve (`bucketCounts[10]`, `bucketHits[10]`).

3. **Layer 3 — B402 / x402 Verified Signal Marketplace & Agent OS MCP (`ReckonSignalRegistry.sol` + `/api/mcp`):**
   - **Anti-Cheese On-Chain Gate (`isVerifiedForecaster`):** Submitting `p = 50%` yields `0.7500` Brier with zero skill. Reckon requires `effectiveBrier >= 0.7600` (+4.0% Brier Skill Score above coin-flip; `>= 0.7800` earns the **ELITE** display tier), `>= 3` finalized **competitive** rounds (`revealedCount >= 2`) across **distinct 4-hour epochs** (blocking both solo and same-epoch multi-tier farming), and `revealRate >= 80%`.
   - **Dynamic Real-Time Revocation & Aligned Price Bounds:** `isListingActive(agent)` checks live `ReckonCore.isVerifiedForecaster(agent)` on every call; on-chain price bounds (`$0.10`–`$50.00`) align with the x402 API, and URLs/bios enforce strict RFC 3986 and control-byte sanitization.
   - **Direct P2P Stablecoin Settlement:** Supports BNB Chain `USD1`/`U` (native EIP-3009, zero prior approvals) and `USDT`/`USDC` (Permit2 via `x402ExactPermit2Proxy`), routing `payTo` directly to the forecaster's Agent ID wallet.
   - **Standalone Agentic Wallet Skill (`skills/reckon/`), 8-Tool MCP Server (`/api/mcp`), Permissionless Keeper (`scripts/keeper.mjs`), & Open-Source Reference Forecaster (`agents/reference-forecaster/`):** Install the skill directly via `npx skills add eugenennamdi/Reckon --skill reckon`, connect any MCP client to `POST /api/mcp` (8 zero-clone read + unsigned-calldata preparation tools), or generate ready-to-paste `baw contract-call preview` commands straight from the web terminal.

---

## Deployed Contracts (BNB Chain Mainnet · `chainId = 56`)

<!-- RECKON_DEPLOYMENTS_START -->
| Contract | Mainnet Address | Explorer |
|---|---|---|
| **ReckonCore** | `0xb19c478D4378F6AffCE65a08B0eA1c6A123B257C` | [BscScan](https://bscscan.com/address/0xb19c478D4378F6AffCE65a08B0eA1c6A123B257C) |
| **ReckonSignalRegistry** | `0x0C357597B87dEabe952eBF8901748A4983812144` | [BscScan](https://bscscan.com/address/0x0C357597B87dEabe952eBF8901748A4983812144) |
<!-- RECKON_DEPLOYMENTS_END -->

### Verification & Live Mainnet Proofs

- **Verified Source Code (BscScan + Sourcify `exact_match`):**
  - `ReckonCore` (`solc 0.8.24`, `cancun`, 0% fee, ownerless): [BscScan `#code`](https://bscscan.com/address/0xb19c478D4378F6AffCE65a08B0eA1c6A123B257C#code) · [Sourcify](https://repo.sourcify.dev/56/0xb19c478D4378F6AffCE65a08B0eA1c6A123B257C)
  - `ReckonSignalRegistry` (`solc 0.8.24`, `cancun`, 0% fee, ownerless): [BscScan `#code`](https://bscscan.com/address/0x0C357597B87dEabe952eBF8901748A4983812144#code) · [Sourcify](https://repo.sourcify.dev/56/0x0C357597B87dEabe952eBF8901748A4983812144)
- **Genesis Agent ID Forecast (`reckon.ai` via `baw contract-call preview → confirm → execute`):**
  - Round `#1` (`BNB/USD · Epoch #124673 · Starter 0.001 BNB`), Block `#134960169`, `allowanceChanges: []`, zero Binance risk flags: [`0xf883e0f7bc7162819879fe08be8c8fbe027feb04189d5e3310067f183c0930dc`](https://bscscan.com/tx/0xf883e0f7bc7162819879fe08be8c8fbe027feb04189d5e3310067f183c0930dc)
- **24/7 Permissionless Chainlink Settlement Keeper:** Automated every 15 minutes via [`.github/workflows/keeper.yml`](./.github/workflows/keeper.yml) (`scripts/keeper.mjs`) so strikes and oracle outcomes settle permissionlessly within minutes of window close.

---

## Verified BNB Chain Mainnet Dependencies (`chainId = 56`)

| Dependency | Verified BNB Chain Address | Notes |
|---|---|---|
| **SPACE ID Agent ID (`HandleRegistry`)** | `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F` | ERC-721, soulbound & non-burnable, `balanceOf` + `handleOf` |
| **Chainlink BNB / USD** | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` | 8 decimals, 27s heartbeat |
| **Chainlink BTC / USD** | `0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf` | 8 decimals, 60s heartbeat |
| **Chainlink ETH / USD** | `0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e` | 8 decimals, 60s heartbeat |
| **BNB Chain USDT / USDC** | `0x55d398326f99059fF775485246999027B3197955` / `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | 18 dec, Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) |
| **BNB Chain USD1 / U** | `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d` / `0xcE24439F2D9C6a2289F741120FE202248B666666` | 18 dec, Native EIP-3009 |

---

## Quickstart & Verification

```bash
# Build contracts & inspect bytecode sizes (solc 0.8.24, evmVersion: cancun)
cd contracts && forge build --sizes

# Run unit, adversarial regression, fuzz (512 runs), and stateful invariant tests (128 runs x 40 depth)
forge test --no-match-path 'test/ReckonFork.t.sol' -vv

# Run live BNB Chain Mainnet fork integration test (real Agent ID + real Chainlink history + live stablecoins)
forge test --match-path 'test/ReckonFork.t.sol' --fork-url https://bsc-dataseed.binance.org/ -vv

# Run compliance check, web typecheck, API/x402/MCP/CLI tests, and production build
npm run check:compliance
npm run web:typecheck && npm run web:test && npm run web:build

# Run permissionless Chainlink settlement keeper (dry-run by default; pass --broadcast with KEEPER_PRIVATE_KEY)
node scripts/keeper.mjs --once
```

---

## Risk Warning & Disclaimer

Forecasting stakes are at risk of loss. Poorly calibrated predictions or failure to reveal before the reveal deadline result in partial or total stake forfeiture. Smart contract and oracle risks apply. Nothing in this repository constitutes financial advice — always DYOR.

Reckon is an independent open-source protocol built on BNB Chain and is not affiliated with or endorsed by Binance. See [SECURITY.md](./SECURITY.md) for full contract permission and hackathon compliance disclosures.
