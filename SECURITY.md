# Reckon Security & Hackathon Compliance Disclosure

Reckon is engineered around **minimal trust surfaces, zero custody risk, and full verifiability** on BNB Chain Mainnet (`chainId = 56`).

---

## 1. Smart Contract Permission Disclosure (Zero-Owner Immutability)

Both core smart contracts are **100% ownerless, non-upgradeable, and immutable**:

| Contract | Owner / Admin Role | Upgrade Proxy? | Admin Fund Withdrawal? | Pause / Freeze? | Protocol Fee? |
|---|---|---|---|---|---|
| `ReckonCore.sol` | **None** | **No** | **No** | **No** | **0%** |
| `ReckonSignalRegistry.sol` | **None** | **No** | **No** (holds zero funds) | **No** | **0%** |

### Key Contract Safety Invariants (Foundry Unit + Fuzz + Invariant + Fork Verified)
- **Strict Solvency (`address(this).balance >= sum(remainingPool)`, with exact equality absent force-sent BNB):** Every round tracks its own `remainingPool` independently (never relying on `address(this).balance`, making the vault immune to force-sent BNB via `selfdestruct` or block rewards).
- **Canonical Race-Proof Commitments:** Commitments hash `(block.chainid, address(this), feedId, epochId, tierId, agent, probBps, salt)` rather than sequential `roundId`, making 1-tx `commitEpoch` 100% invariant to concurrent round creations or mempool front-running across human confirmation delays.
- **Zero Dust Lockup:** Integer floor truncation drops at most `N - 1` wei across a round; the final claimer sweeps `remainingPool`, leaving exactly `0` wei stranded.
- **No Raw Native Transfers:** Neither contract implements `receive()` or `fallback()`, rejecting accidental raw BNB transfers.
- **Reentrancy Protection:** All state-changing value flows use strict Checks-Effects-Interactions plus OpenZeppelin `ReentrancyGuard`. Claims are strictly pull-based (`claim` / `claimRefund`) with zero push loops.
- **Grief-Proof 3-Path Oracle Failure Escape Hatch:** Healthy Chainlink rounds **cannot** be cancelled at 2 hours (`OracleStillHealthy`), preventing non-revealer score-dodging and delayed-keeper wipeouts. Cancellation (`CANCELLED_ORACLE`, 100% penalty-free refund) triggers via:
  1. `cancelOracleGap(...)`: immediate cryptographic proof that two adjacent rounds on Chainlink (`afterPhase > 0 && afterPhase <= latestPhase`, hardened across post-gap aggregator phase rollovers) bracket `commitEnd` or `resolveTime` with a staleness gap `> 30 minutes` or invalid answer;
  2. `cancelUnsettleableRound(roundId)` after `resolveTime + 2 hours` (`ORACLE_HALT_GRACE`): verified live feed halt/revert (`latestRoundData()` reverted or failed to advance past `resolveTime`, protected by a `100,000` gas floor against EIP-150 `63/64` OOG spoofing);
  3. `EMERGENCY_CANCEL_DELAY` (`resolveTime + 7 days`): unconditional black-swan fallback ensuring zero permanently locked BNB.
- **Strict Boundary Input Validation (`ReckonSignalRegistry`):** Enforces 18-decimal token verification in the constructor, `$0.10`–`$50.00` price bounds aligned with the x402 API, overflow-safe pagination, RFC 3986 safe HTTPS URL whitelisting (blocking `@` userinfo phishing, shell metacharacters, quotes, backticks, `$`, and XSS delimiters), and ASCII control-byte / `0x1b` ANSI terminal-escape rejection on provider `bio` strings.
- **Backend & CLI Hardening:** Production x402 signal store fails closed if `RECKON_STORE_ENCRYPTION_KEY` is missing; self-hosted BSC relayer serializes transactions to prevent EOA nonce collisions; pre-broadcast RPC errors release claimed nonces; Chainlink bracket API routes are rate-limited; CLI `x402-inspect`, `x402-unlock`, and `publish-signal` block private/loopback/metadata SSRF hosts by default; `/api/mcp` is strictly read + unsigned calldata preparation only.

---

## 2. Mechanism Design & Anti-Arbitrage Proofs

- **Strictly Proper Lambert WSWM (EC 2008):** Reporting one's true subjective probability $p = q$ is the unique dominant strategy for every competitive round ($N \ge 2$), computed in O(1) gas via `sumP` and `sumP2` accumulators.
- **Closure of Chen / Devanur et al. (2014) WSWM Arbitrage Vectors:**
  - *Public-report arbitrage* is closed by sealed commit-reveal (forecasts remain hashed until `resolveTime`) plus forward-start ATM strikes fixed at `commitEnd` on the 24/7 rolling 4-hour UTC candle grid (`4h OPEN / 4h LOCKED / 4h REVEAL`, `MAX_PENDING_ROUNDS = 27`).
  - *Sybil bracketing* is closed at the identity layer by Binance's 1-per-verified-account, permanently soulbound SPACE ID Agent ID (`0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`).
- **Closure of 50% Coin-Flip, Solo & Same-Epoch Multi-Tier Badge Farming:** Layer 3 Verified Forecaster eligibility requires `effectiveBrier >= 0.7600` (+4.0% Brier Skill Score above coin-flip `0.7500`; `>= 0.7800` displays as **ELITE**), `>= 3` finalized competitive rounds (`revealedCount >= 2`) across **distinct 4-hour `epochId`s** (`_competitiveEpochCredited`, order-invariant across out-of-order settlements), and `revealRate >= 80%` (with missed reveals reflected immediately in `getEffectiveProfile()` the exact second `revealEnd` passes, even before `settleOracle()` is called).

---

## 3. Compliance Matrix — Binance Wallet × BNB Chain Agent ID Hackathon 9 Safety Red Lines

1. **No web-based Agentic Wallet QR login / no server sessions:** Web UI uses standard client-side EVM wallet connections (`RainbowKit`/`wagmi`) with zero server-side sessions, zero Agentic Wallet pairing codes, and zero `baw` QR login; Agentic Wallet runs locally via the official `baw` CLI (`skills/reckon/SKILL.md`) and read+prepare `/api/mcp`.
2. **No bypassing transaction confirmations:** Every asset-moving or signing action in `skills/reckon/SKILL.md` previews (`baw contract-call preview` / `baw sign-message preview` / `baw x402-payment preview`), displays full addresses, amounts, simulation results, and risks, and waits for explicit human confirmation before `execute` / `sign`.
3. **No unauthorized transfers or silent unlimited approvals:** Layer 1 uses native BNB (`allowanceChanges: []`, zero ERC-20 `approve()` calls). Layer 3 prioritizes zero-approval EIP-3009 stablecoins (`USD1`/`U`) and explicitly surfaces `needApproveFirst` for Permit2 (`USDT`/`USDC`).
4. **Open-source & verified contracts with disclosed permissions:** MIT-licensed repo (`LICENSE`), BscScan + Sourcify verified, zero owner permissions (table above).
5. **No Binance/BNB brand impersonation:** Independent open-source protocol named **Reckon**; non-affiliated with Binance.
6. **No collection of sensitive credentials:** Zero seed phrase, private key, API key, session token, or pairing code inputs. Commit salts stay strictly client-side (append-only `localStorage` / `~/.reckon/salts.json` mode `0600`).
7. **No promised returns:** Zero yield-promise, return-promise, or zero-risk profit claims anywhere in code, docs, UI, or skills.
8. **Mandatory risk warnings:** Prominent risk disclosure displayed on all forecasting and signal interfaces, in `SKILL.md`, and in `/api/mcp`.
9. **No "wallet lookup by name" tool:** Zero forward `handle -> address` functions in `contracts/src/`, UI, API, or `/api/mcp`; displays only opt-in Reckon protocol participants via `getAgents(offset, limit)` and `getProviders(offset, limit)`.
