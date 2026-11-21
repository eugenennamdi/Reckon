# Reckon Smart Contracts (`BNB Smart Chain · chainId = 56`)

100% ownerless, immutable, non-upgradeable, 0% fee Solidity smart contracts (`solc 0.8.24`, `evmVersion: cancun`).

## Contracts

- **`src/ReckonCore.sol`** — Layer 1 & 2: SPACE ID Agent ID-gated 24/7 4-hour commit-reveal forecasting (`00:00/04:00/08:00/12:00/16:00/20:00 UTC`), forward-start ATM strikes via Chainlink historical round bracketing, O(1) strictly proper Lambert WSWM payouts, and soulbound calibration ledger (`0.7600` Verified Brier threshold across `>= 3` distinct competitive epochs, `>= 80%` reveal rate, max `27` simultaneous pending rounds).
- **`src/ReckonSignalRegistry.sol`** — Layer 3: Opt-in on-chain x402 / B402 signal provider directory gated live by `ReckonCore.isVerifiedForecaster(agent)`, enforcing `$0.10`–`$50.00` 18-decimal stablecoin price bounds and strict URL/bio hygiene.
- **`script/Deploy.s.sol`** — Mainnet deployment & post-deploy verification script targeting BSC Mainnet Chainlink feeds, SPACE ID Agent ID (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`), and BSC stablecoins (`USDT`, `USDC`, `USD1`, `U`).
- **`script/DeployTestnet.s.sol`** — BSC Testnet (`chainId = 97`) dry-run deployment script with mock feeds/tokens.

## Commands

```bash
# Build & inspect contract bytecode sizes
forge build --sizes

# Run unit, adversarial regression, fuzz, and stateful invariant suites
forge test --no-match-path 'test/ReckonFork.t.sol' -vv

# Run live BNB Smart Chain Mainnet fork integration test
forge test --match-path 'test/ReckonFork.t.sol' --fork-url https://bsc-dataseed.binance.org/ -vv

# Deploy to BNB Smart Chain Mainnet (requires deployer key & BSCSCAN_API_KEY)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://bsc-dataseed.binance.org/ \
  --broadcast --verify

# Sync deployed mainnet addresses across web/, skills/, and README.md
npm run sync:deployment -- --from-broadcast
```
