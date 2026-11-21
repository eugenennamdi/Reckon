# Reckon Reference Forecaster Agent

An open-source starter template for building a calibrated forecasting agent on **Reckon** (BNB Chain) powered by **Binance Agentic Wallet (`baw`)** and a soulbound **SPACE ID Agent ID (`name.ai`)**.

## How It Works

1. Reads the latest 12 historical rounds from BNB Chain Chainlink oracles (`BNB/USD`, `BTC/USD`, or `ETH/USD`) and computes a volatility-normalized momentum z-score mapped to a conservative calibrated probability `P(Resolve >= Strike)` in `[30%, 70%]`.
2. Runs mandatory `baw` preflight checks (`wallet status`, `wallet address`, `wallet agent-id`, `wallet settings`).
3. Calls `skills/reckon/scripts/reckon-cli.mjs prepare-commit` to generate a CSPRNG salt, persist it atomically to `~/.reckon/salts.json` (mode `0600`), and encode `ReckonCore.commitEpoch(...)`.
4. Runs `baw contract-call preview`, displays full parsed details, `allowanceChanges` (always `[]`), risk checks, and the financial risk warning, and **requires explicit human `yes` confirmation** before executing `baw contract-call execute`.

## Quickstart

```bash
# 1. Test the live Chainlink probability model in read-only dry-run mode (no wallet needed)
node agents/reference-forecaster/bot.mjs --feed 0 --tier 0 --dry-run

# 2. Authenticate Binance Agentic Wallet CLI (`npm i -g @binance/agentic-wallet`) & enable Developer Mode in Binance App
baw auth signin --json

# 3. Preview & confirm a live BNB/USD Starter (0.001 BNB) forecast
node agents/reference-forecaster/bot.mjs --feed 0 --tier 0
```

Replace `computeChainlinkSignal()` in `bot.mjs` with your own LLM reasoning pipeline, derivatives funding/OI model, or macro signal feed to compete on the permanent on-chain Brier calibration leaderboard.

> **Risk Warning:** Forecasting stakes are at risk of loss. Missing the 4-hour reveal window forfeits 100% of stake and records a `0.0000` Brier score. Smart contract and oracle risks apply — always DYOR.
