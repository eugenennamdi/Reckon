// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentID} from "./interfaces/IAgentID.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IReckonCore} from "./interfaces/IReckonCore.sol";

/// @title ReckonCore
/// @notice Ownerless, immutable, Sybil-proof commit-reveal forecasting protocol on BNB Smart Chain.
/// @dev Security & Mechanism Design Properties:
///      1. ZERO OWNER / ZERO ADMIN KEYS / ZERO PROTOCOL FEE: No upgrade proxy, no pause, no admin withdrawal.
///      2. SYBIL-PROOF AGENT ID GATE: Every participant must hold a soulbound SPACE ID Agent ID
///         (`balanceOf(msg.sender) > 0` and non-empty `handleOf(msg.sender)`). Because Agent ID is
///         1-per-verified-account and permanently non-transferable/non-burnable, burner-wallet cherry-picking
///         and WSWM Sybil bracketing (Chen/Devanur et al. 2014) are closed at the identity layer.
///      3. FORWARD-START ATM STRIKE & CANONICAL COMMITMENT BINDING: `strikePrice` is fixed at `commitEnd`
///         (not at creation), eliminating late-commit sniping. Commitments bind deterministically to
///         `(chainid, address(this), feedId, epochId, tierId, agent, probBps, salt)`, making `commitEpoch`
///         100% invariant to concurrent round creation or `nextRoundId` ordering.
///      4. STRICTLY PROPER LAMBERT WSWM PAYOUTS (EC 2008): Equal-stake Weighted-Score Wagering Mechanism
///         with equal non-revealer forfeit split, computed in O(1) gas via running `sumP` and `sumP2`
///         accumulators. Per-round `remainingPool` accounting with final claimer sweeping `<= N - 1` wei dust
///         guarantees strict solvency and zero locked dust.
///      5. O(1) ANTI-SCORE-DODGING & GRIEF-PROOF ORACLE CANCELLATION: Bounded `pendingRoundIds` (cap 27,
///         covering 3 full 9-slot 4h candle epochs: OPEN + LOCKED + REVEAL) reflects missed reveals
///         immediately at `revealEnd` in `getEffectiveProfile()` and deduplicates competitive round credits
///         to at most 1 per 4h `epochId`. Rounds cannot be cancelled at 2h if Chainlink updated normally
///         (`OracleStillHealthy`).
contract ReckonCore is IReckonCore, ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Constants & Immutables
    // -------------------------------------------------------------------------

    /// @notice Canonical 4-hour UTC candle grid (00:00 / 04:00 / 08:00 / 12:00 / 16:00 / 20:00 UTC).
    ///         Because COMMIT_DURATION == EPOCH_DURATION (4h), exactly one epoch is OPEN 24/7 (zero blackout),
    ///         one prior epoch is LOCKED (4h observation + B402 signal exclusivity), and one is in REVEAL (4h).
    uint64 public constant EPOCH_DURATION = 4 hours;
    uint64 public constant COMMIT_DURATION = 4 hours;
    uint64 public constant OBSERVE_DURATION = 4 hours;
    uint64 public constant REVEAL_DURATION = 4 hours;
    uint64 public constant ORACLE_HALT_GRACE = 2 hours;
    uint64 public constant EMERGENCY_CANCEL_DELAY = 7 days;
    uint64 public constant MAX_ORACLE_STALENESS = 30 minutes;

    uint16 public constant MIN_PROB_BPS = 100;       // 1.00%
    uint16 public constant MAX_PROB_BPS = 9_900;     // 99.00%
    uint256 public constant PROB_SCALE = 10_000;
    uint256 public constant BRIER_SCALE = 100_000_000; // 1e8 == Brier score 1.00000000

    uint256 public constant MAX_PENDING_ROUNDS = 27; // 3 full 9-slot (3 feeds x 3 tiers) active epochs

    /// @notice Verified Forecaster thresholds for Layer 3 B402/x402 monetization.
    ///         Submitting p = 50% guarantees 0.7500 Brier with zero skill. Requiring 0.7600 enforces
    ///         a strictly positive +4% Brier Skill Score (~60% directional accuracy) above coin-flip,
    ///         across >= 3 distinct competitive 4h epochs (`revealedCount >= 2`) with >= 80% reveal rate.
    uint256 public constant MIN_VERIFIED_BRIER = 76_000_000; // 0.7600
    uint32 public constant MIN_COMPETITIVE_ROUNDS = 3;
    uint256 public constant MIN_REVEAL_RATE_BPS = 8_000;     // 80.00%

    uint128 public constant STAKE_TIER_0 = 0.001 ether; // Starter
    uint128 public constant STAKE_TIER_1 = 0.005 ether; // Standard
    uint128 public constant STAKE_TIER_2 = 0.01 ether;  // Pro

    address public immutable override AGENT_ID;
    IAggregatorV3 public immutable BNB_USD_FEED;
    IAggregatorV3 public immutable BTC_USD_FEED;
    IAggregatorV3 public immutable ETH_USD_FEED;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum RoundState {
        NONE,
        OPEN,
        LOCKED,
        REVEAL,
        AWAITING_ORACLE,
        CLAIMABLE,
        NO_REVEALS,
        CANCELLED_ORACLE
    }

    struct Round {
        uint8 feedId;           // 0 = BNB/USD, 1 = BTC/USD, 2 = ETH/USD
        uint8 tierId;           // 0 = 0.001 BNB, 1 = 0.005 BNB, 2 = 0.01 BNB
        uint8 outcome;          // 0 or 1 (valid iff oracleSettled == true)
        bool strikeFixed;
        bool oracleSettled;
        bool oracleCancelled;
        uint64 epochId;
        uint64 openTime;
        uint64 commitEnd;
        uint64 resolveTime;
        uint64 revealEnd;
        uint32 committedCount;
        uint32 revealedCount;
        uint32 claimedCount;
        uint128 stakeAmount;
        uint128 remainingPool;
        int256 strikePrice;     // 8-dec Chainlink price at commitEnd
        int256 settlePrice;     // 8-dec Chainlink price at resolveTime
        uint256 sumP;           // O(1) sum of revealed probBps
        uint256 sumP2;          // O(1) sum of revealed probBps^2
    }

    struct Entry {
        bytes32 commitment;
        uint16 probBps;
        bool revealed;
        bool claimed;
        bool profileFlushed;
    }

    struct StoredProfile {
        bytes32 handleHash;
        uint32 roundsCommitted;
        uint32 roundsRevealed;
        uint32 roundsScored;
        uint32 competitiveRoundsScored;
        uint32 roundsMissed;
        uint64 firstActiveAt;
        uint128 cumulativeBrier;
        uint128 totalVolumeWei;
        uint64[10] bucketCounts;
        uint64[10] bucketHits;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    uint64 public nextRoundId;

    /// @notice Deduplicates canonical rounds by `keccak256(abi.encode(feedId, epochId, tierId))`.
    mapping(bytes32 => uint64) public roundIdByKey;

    mapping(uint64 => Round) private _rounds;
    mapping(uint64 => mapping(address => Entry)) private _entries;
    mapping(address => StoredProfile) private _profiles;
    mapping(address => uint64[]) private _pendingRoundIds;
    mapping(address => mapping(uint64 => bool)) private _competitiveEpochCredited;
    address[] private _agents;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event RoundCreated(
        uint64 indexed roundId,
        uint8 indexed feedId,
        uint64 indexed epochId,
        uint8 tierId,
        uint128 stakeAmount,
        uint64 openTime,
        uint64 commitEnd,
        uint64 resolveTime,
        uint64 revealEnd
    );

    event ForecastCommitted(
        uint64 indexed roundId,
        address indexed agent,
        string handle,
        bytes32 commitment,
        uint128 stakeAmount
    );

    event StrikeFixed(
        uint64 indexed roundId,
        int256 strikePrice,
        uint80 oracleRoundId
    );

    event OracleSettled(
        uint64 indexed roundId,
        int256 strikePrice,
        int256 settlePrice,
        uint8 outcome,
        uint80 oracleRoundId
    );

    event RoundCancelled(uint64 indexed roundId);

    event ForecastRevealed(
        uint64 indexed roundId,
        address indexed agent,
        uint16 probBps
    );

    event PayoutClaimed(
        uint64 indexed roundId,
        address indexed agent,
        uint256 payoutWei,
        uint256 brierScore
    );

    event RefundClaimed(
        uint64 indexed roundId,
        address indexed agent,
        uint256 refundWei,
        bool oracleCancelled
    );

    event ProfileFlushed(
        address indexed agent,
        uint64 indexed roundId,
        bool revealed,
        bool oracleCancelled,
        uint256 brierScore
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error InvalidFeedDecimals();
    error InvalidFeedId();
    error InvalidTierId();
    error InvalidEpochId();
    error RoundNotFound();
    error RoundAlreadyExists();
    error RoundNotOpen();
    error CommitStillOpen();
    error ResolveTimeNotReached();
    error TargetTimeNotReached();
    error GracePeriodNotElapsed();
    error SettleDeadlinePassed();
    error StrikeAlreadyFixed();
    error StrikeNotFixed();
    error OracleAlreadySettled();
    error OracleAlreadyCancelled();
    error OracleStillHealthy();
    error OracleBracketValid();
    error InsufficientOracleCheckGas();
    error InvalidOracleRound();
    error OraclePriceStaleOrAfterTarget();
    error InvalidNextOracleRound();
    error NoAgentID();
    error InvalidCommitment();
    error InvalidStakeAmount();
    error AlreadyCommitted();
    error TooManyPendingRounds();
    error NotInRevealWindow();
    error InvalidProbability();
    error NotCommitted();
    error AlreadyRevealed();
    error InvalidReveal();
    error RoundNotClaimable();
    error RoundNotRefundable();
    error NotRevealed();
    error AlreadyClaimed();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Constructor (Zero Owner — Fully Immutable)
    // -------------------------------------------------------------------------

    constructor(
        address agentId_,
        address bnbUsdFeed_,
        address btcUsdFeed_,
        address ethUsdFeed_
    ) {
        if (
            agentId_ == address(0) ||
            bnbUsdFeed_ == address(0) ||
            btcUsdFeed_ == address(0) ||
            ethUsdFeed_ == address(0)
        ) {
            revert ZeroAddress();
        }
        if (
            IAggregatorV3(bnbUsdFeed_).decimals() != 8 ||
            IAggregatorV3(btcUsdFeed_).decimals() != 8 ||
            IAggregatorV3(ethUsdFeed_).decimals() != 8
        ) {
            revert InvalidFeedDecimals();
        }

        AGENT_ID = agentId_;
        BNB_USD_FEED = IAggregatorV3(bnbUsdFeed_);
        BTC_USD_FEED = IAggregatorV3(btcUsdFeed_);
        ETH_USD_FEED = IAggregatorV3(ethUsdFeed_);
    }

    // -------------------------------------------------------------------------
    // External State-Changing Functions
    // -------------------------------------------------------------------------

    /// @notice Permissionlessly instantiate a canonical 4h UTC candle epoch round while its commit window is open.
    function createRound(
        uint8 feedId,
        uint64 epochId,
        uint8 tierId
    ) external returns (uint64 roundId) {
        roundId = _createRound(feedId, epochId, tierId);
    }

    /// @notice Commit a sealed probability to an existing open round.
    function commit(uint64 roundId, bytes32 commitment) external payable nonReentrant {
        _commit(roundId, commitment);
    }

    /// @notice 1-tx convenience: instantiate the canonical epoch round if needed and commit atomically.
    ///         Commitment hashes `(feedId, epochId, tierId)`, so concurrent round creations never invalidate it.
    function commitEpoch(
        uint8 feedId,
        uint64 epochId,
        uint8 tierId,
        bytes32 commitment
    ) external payable nonReentrant returns (uint64 roundId) {
        bytes32 key = roundKey(feedId, epochId, tierId);
        roundId = roundIdByKey[key];
        if (roundId == 0) {
            roundId = _createRound(feedId, epochId, tierId);
        }
        _commit(roundId, commitment);
    }

    /// @notice Permissionlessly fix the forward-start ATM strike price at `commitEnd` using Chainlink
    ///         historical round bracketing (`strikeRound.updatedAt <= commitEnd < strikeNext.updatedAt`).
    function fixStrike(
        uint64 roundId,
        uint80 strikeRoundId,
        uint80 strikeNextRoundId
    ) external {
        _fixStrike(roundId, strikeRoundId, strikeNextRoundId);
    }

    /// @notice Permissionlessly settle the round outcome at `resolveTime` once `strikePrice` is fixed.
    function settleOracle(
        uint64 roundId,
        uint80 resolveRoundId,
        uint80 resolveNextRoundId
    ) external {
        _settleOracle(roundId, resolveRoundId, resolveNextRoundId);
    }

    /// @notice Permissionlessly fix `strikePrice` (if not yet fixed) and settle the round outcome atomically.
    function fixAndSettleOracle(
        uint64 roundId,
        uint80 strikeRoundId,
        uint80 strikeNextRoundId,
        uint80 resolveRoundId,
        uint80 resolveNextRoundId
    ) external {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (!r.strikeFixed) {
            _fixStrike(roundId, strikeRoundId, strikeNextRoundId);
        }
        _settleOracle(roundId, resolveRoundId, resolveNextRoundId);
    }

    /// @notice Cancel an unsettled round either:
    ///         (1) after `resolveTime + ORACLE_HALT_GRACE` (2h) ONLY if the live Chainlink feed genuinely
    ///             halted/reverted and failed to post any valid round after `resolveTime`, OR
    ///         (2) after `resolveTime + EMERGENCY_CANCEL_DELAY` (7d) as an unconditional safety valve.
    function cancelUnsettleableRound(uint64 roundId) external {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (r.oracleSettled) revert OracleAlreadySettled();
        if (r.oracleCancelled) revert OracleAlreadyCancelled();
        if (block.timestamp < r.resolveTime + ORACLE_HALT_GRACE) revert GracePeriodNotElapsed();

        if (block.timestamp < r.resolveTime + EMERGENCY_CANCEL_DELAY) {
            if (gasleft() < 100_000) revert InsufficientOracleCheckGas();
            IAggregatorV3 feed = feedForId(r.feedId);
            bool feedHealthyAfterResolve = false;
            try feed.latestRoundData() returns (
                uint80 latestId,
                int256 answer,
                uint256,
                uint256 updatedAt,
                uint80 answeredInRound
            ) {
                if (answer > 0 && updatedAt > r.resolveTime && answeredInRound >= latestId) {
                    feedHealthyAfterResolve = true;
                }
            } catch {
                // Genuine oracle revert (gasleft() >= 100_000 rules out EIP-150 63/64 OOG griefing).
            }
            if (feedHealthyAfterResolve) revert OracleStillHealthy();
        }

        r.oracleCancelled = true;
        emit RoundCancelled(roundId);
    }

    /// @notice Immediately cancel a round if two provably adjacent Chainlink rounds on the active proxy phase
    ///         bracket `commitEnd` (`isStrike == true`) or `resolveTime` (`isStrike == false`) with a staleness
    ///         gap `> MAX_ORACLE_STALENESS` or invalid answer, proving settlement is mathematically impossible.
    function cancelOracleGap(
        uint64 roundId,
        bool isStrike,
        uint80 rBefore,
        uint80 rAfter
    ) external {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (r.oracleSettled) revert OracleAlreadySettled();
        if (r.oracleCancelled) revert OracleAlreadyCancelled();
        if (isStrike && r.strikeFixed) revert StrikeAlreadyFixed();

        uint64 targetTime = isStrike ? r.commitEnd : r.resolveTime;
        if (block.timestamp < targetTime) revert TargetTimeNotReached();

        IAggregatorV3 feed = feedForId(r.feedId);
        {
            (uint80 latestId, , , , ) = feed.latestRoundData();
            uint16 afterPhase = uint16(rAfter >> 64);
            if (afterPhase == 0 || afterPhase > uint16(latestId >> 64)) revert InvalidNextOracleRound();
        }

        _verifyRoundAdjacency(feed, rBefore, rAfter);

        bool beforeFault;
        {
            (uint80 pId, int256 ansBefore, , uint256 uBefore, uint80 ansInBefore) = feed.getRoundData(rBefore);
            if (pId != rBefore || uBefore == 0 || uBefore > targetTime) revert InvalidOracleRound();
            beforeFault = (targetTime - uBefore > MAX_ORACLE_STALENESS) || (ansBefore <= 0) || (ansInBefore < rBefore);
        }

        bool afterFault;
        {
            (uint80 nId, int256 ansAfter, , uint256 uAfter, uint80 ansInAfter) = feed.getRoundData(rAfter);
            if (nId != rAfter || uAfter <= targetTime) revert InvalidNextOracleRound();
            afterFault = (ansAfter <= 0) || (ansInAfter < rAfter);
        }

        if (!beforeFault && !afterFault) revert OracleBracketValid();

        r.oracleCancelled = true;
        emit RoundCancelled(roundId);
    }

    /// @notice Reveal a previously committed probability strictly after `resolveTime` and before `revealEnd`.
    function reveal(uint64 roundId, uint16 probBps, bytes32 salt) external nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (r.oracleCancelled || block.timestamp < r.resolveTime || block.timestamp >= r.revealEnd) {
            revert NotInRevealWindow();
        }
        if (probBps < MIN_PROB_BPS || probBps > MAX_PROB_BPS) {
            revert InvalidProbability();
        }

        Entry storage e = _entries[roundId][msg.sender];
        if (e.commitment == bytes32(0)) revert NotCommitted();
        if (e.revealed) revert AlreadyRevealed();

        bytes32 expected = computeCommitment(r.feedId, r.epochId, r.tierId, msg.sender, probBps, salt);
        if (expected != e.commitment) revert InvalidReveal();

        e.revealed = true;
        e.probBps = probBps;
        r.revealedCount += 1;
        r.sumP += probBps;
        r.sumP2 += uint256(probBps) * uint256(probBps);

        emit ForecastRevealed(roundId, msg.sender, probBps);
    }

    /// @notice Claim exact WSWM + equal-forfeit BNB payout for a settled round where `msg.sender` revealed.
    ///         The final claimer automatically sweeps any `<= N - 1` wei rounding dust from `remainingPool`.
    function claim(uint64 roundId) external nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (roundState(roundId) != RoundState.CLAIMABLE) revert RoundNotClaimable();

        Entry storage e = _entries[roundId][msg.sender];
        if (!e.revealed) revert NotRevealed();
        if (e.claimed) revert AlreadyClaimed();

        // Flush any finalized pending rounds (including this one) into persistent profile storage.
        _flushPending(msg.sender);

        uint256 brier = _brierScore(e.probBps, r.outcome);
        uint256 payout;
        if (r.claimedCount + 1 == r.revealedCount) {
            payout = r.remainingPool;
        } else {
            payout = _computePayout(r, e.probBps);
        }

        e.claimed = true;
        r.claimedCount += 1;
        r.remainingPool -= uint128(payout);

        emit PayoutClaimed(roundId, msg.sender, payout, brier);

        (bool ok, ) = msg.sender.call{value: payout}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Reclaim exact BNB stake if a round ended with zero reveals (`NO_REVEALS`, incurring S=0 penalty)
    ///         or was cancelled due to an oracle fault/halt (`CANCELLED_ORACLE`, zero penalty).
    function claimRefund(uint64 roundId) external nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();

        RoundState st = roundState(roundId);
        bool oracleCancelled;
        if (st == RoundState.CANCELLED_ORACLE) {
            oracleCancelled = true;
        } else if (st == RoundState.NO_REVEALS) {
            oracleCancelled = false;
        } else {
            revert RoundNotRefundable();
        }

        Entry storage e = _entries[roundId][msg.sender];
        if (e.commitment == bytes32(0)) revert NotCommitted();
        if (e.claimed) revert AlreadyClaimed();

        _flushPending(msg.sender);

        uint256 refund = r.stakeAmount;
        e.claimed = true;
        r.claimedCount += 1;
        r.remainingPool -= uint128(refund);

        emit RefundClaimed(roundId, msg.sender, refund, oracleCancelled);

        (bool ok, ) = msg.sender.call{value: refund}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Permissionlessly flush any finalized pending rounds into `agent`'s persistent profile storage.
    function flushAgent(address agent) external {
        _flushPending(agent);
    }

    // -------------------------------------------------------------------------
    // Public / External View Helpers
    // -------------------------------------------------------------------------

    function currentEpochId() external view returns (uint64) {
        return uint64(block.timestamp / EPOCH_DURATION);
    }

    function roundKey(uint8 feedId, uint64 epochId, uint8 tierId) public pure returns (bytes32) {
        return keccak256(abi.encode(feedId, epochId, tierId));
    }

    function computeCommitment(
        uint8 feedId,
        uint64 epochId,
        uint8 tierId,
        address agent,
        uint16 probBps,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), feedId, epochId, tierId, agent, probBps, salt));
    }

    function stakeForTier(uint8 tierId) public pure returns (uint128) {
        if (tierId == 0) return STAKE_TIER_0;
        if (tierId == 1) return STAKE_TIER_1;
        if (tierId == 2) return STAKE_TIER_2;
        revert InvalidTierId();
    }

    function feedForId(uint8 feedId) public view returns (IAggregatorV3) {
        if (feedId == 0) return BNB_USD_FEED;
        if (feedId == 1) return BTC_USD_FEED;
        if (feedId == 2) return ETH_USD_FEED;
        revert InvalidFeedId();
    }

    function getRound(uint64 roundId) external view returns (Round memory) {
        return _rounds[roundId];
    }

    function getEntry(uint64 roundId, address agent) external view returns (Entry memory) {
        return _entries[roundId][agent];
    }

    function hasCommitted(uint64 roundId, address agent) external view override returns (bool) {
        return _entries[roundId][agent].commitment != bytes32(0);
    }

    function getPendingRounds(address agent) external view returns (uint64[] memory) {
        return _pendingRoundIds[agent];
    }

    function isCompetitiveEpochCredited(address agent, uint64 epochId) external view returns (bool) {
        return _competitiveEpochCredited[agent][epochId];
    }

    function agentCount() external view override returns (uint256) {
        return _agents.length;
    }

    /// @notice Overflow-safe paginated read of opt-in Reckon participant addresses (Red Line #9 compliant).
    function getAgents(uint256 offset, uint256 limit) external view override returns (address[] memory result) {
        uint256 total = _agents.length;
        if (offset >= total || limit == 0) {
            return new address[](0);
        }
        uint256 count = limit > total - offset ? total - offset : limit;
        result = new address[](count);
        for (uint256 i = 0; i < count; ++i) {
            result[i] = _agents[offset + i];
        }
    }

    function roundState(uint64 roundId) public view returns (RoundState) {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) return RoundState.NONE;
        if (r.oracleCancelled) return RoundState.CANCELLED_ORACLE;
        if (block.timestamp < r.commitEnd) return RoundState.OPEN;
        if (block.timestamp < r.resolveTime) return RoundState.LOCKED;
        if (block.timestamp < r.revealEnd) return RoundState.REVEAL;

        if (r.oracleSettled) {
            return r.revealedCount > 0 ? RoundState.CLAIMABLE : RoundState.NO_REVEALS;
        }
        if (block.timestamp < r.resolveTime + EMERGENCY_CANCEL_DELAY) {
            return RoundState.AWAITING_ORACLE;
        }
        return RoundState.CANCELLED_ORACLE;
    }

    /// @notice Historical settled WSWM payout for a revealed participant (retained post-claim for UI/history).
    function previewPayout(uint64 roundId, address agent) external view override returns (uint256) {
        Round storage r = _rounds[roundId];
        if (roundState(roundId) != RoundState.CLAIMABLE) return 0;
        Entry storage e = _entries[roundId][agent];
        if (!e.revealed) return 0;
        return _computePayout(r, e.probBps);
    }

    /// @notice Exact wei currently claimable by `agent` via `claim()` or `claimRefund()` (returns 0 once claimed).
    function claimablePayout(uint64 roundId, address agent) external view override returns (uint256) {
        Entry storage e = _entries[roundId][agent];
        if (e.commitment == bytes32(0) || e.claimed) return 0;

        RoundState st = roundState(roundId);
        Round storage r = _rounds[roundId];
        if (st == RoundState.CLAIMABLE) {
            if (!e.revealed) return 0;
            if (r.claimedCount + 1 == r.revealedCount) {
                return r.remainingPool;
            }
            return _computePayout(r, e.probBps);
        }
        if (st == RoundState.NO_REVEALS || st == RoundState.CANCELLED_ORACLE) {
            return r.stakeAmount;
        }
        return 0;
    }

    /// @notice Returns `agent`'s live, anti-dodge calibration profile by dynamically folding in any
    ///         finalized or missed-reveal rounds still sitting in `pendingRoundIds[agent]`.
    function getEffectiveProfile(address agent) public view override returns (EffectiveProfile memory eff) {
        StoredProfile storage p = _profiles[agent];
        eff.handleHash = p.handleHash;
        eff.roundsCommitted = p.roundsCommitted;
        eff.roundsRevealed = p.roundsRevealed;
        eff.roundsScored = p.roundsScored;
        eff.competitiveRoundsScored = p.competitiveRoundsScored;
        eff.roundsMissed = p.roundsMissed;
        eff.firstActiveAt = p.firstActiveAt;
        eff.cumulativeBrier = p.cumulativeBrier;
        eff.totalVolumeWei = p.totalVolumeWei;
        eff.bucketCounts = p.bucketCounts;
        eff.bucketHits = p.bucketHits;

        uint64[MAX_PENDING_ROUNDS] memory seenCompetitiveEpochs;
        uint256 seenCount = 0;

        uint64[] storage pending = _pendingRoundIds[agent];
        uint256 len = pending.length;
        for (uint256 i = 0; i < len; ++i) {
            uint64 rId = pending[i];
            Entry storage e = _entries[rId][agent];
            if (e.profileFlushed) continue;

            RoundState st = roundState(rId);
            if (st == RoundState.CLAIMABLE || st == RoundState.NO_REVEALS) {
                Round storage r = _rounds[rId];
                eff.roundsScored += 1;
                if (e.revealed) {
                    eff.roundsRevealed += 1;
                    uint256 s = _brierScore(e.probBps, r.outcome);
                    eff.cumulativeBrier += uint128(s);
                    uint8 b = uint8(e.probBps / 1000);
                    eff.bucketCounts[b] += 1;
                    if (r.outcome == 1) {
                        eff.bucketHits[b] += 1;
                    }
                    if (r.revealedCount >= 2 && !_competitiveEpochCredited[agent][r.epochId]) {
                        bool alreadySeen = false;
                        for (uint256 j = 0; j < seenCount; ++j) {
                            if (seenCompetitiveEpochs[j] == r.epochId) {
                                alreadySeen = true;
                                break;
                            }
                        }
                        if (!alreadySeen) {
                            seenCompetitiveEpochs[seenCount++] = r.epochId;
                            eff.competitiveRoundsScored += 1;
                        }
                    }
                } else {
                    eff.roundsMissed += 1;
                }
            } else if (st == RoundState.AWAITING_ORACLE && !e.revealed) {
                // Reveal window has already closed without a reveal; penalize immediately in live view.
                eff.roundsScored += 1;
                eff.roundsMissed += 1;
            }
            // CANCELLED_ORACLE (and AWAITING_ORACLE where e.revealed == true) has zero calibration impact.
        }

        if (eff.roundsScored > 0) {
            eff.meanBrier = uint256(eff.cumulativeBrier) / uint256(eff.roundsScored);
            eff.revealRateBps = (uint256(eff.roundsRevealed) * PROB_SCALE) / uint256(eff.roundsScored);
            eff.isVerified = (
                eff.competitiveRoundsScored >= MIN_COMPETITIVE_ROUNDS &&
                uint256(eff.cumulativeBrier) >= uint256(eff.roundsScored) * MIN_VERIFIED_BRIER &&
                uint256(eff.roundsRevealed) * PROB_SCALE >= uint256(eff.roundsScored) * MIN_REVEAL_RATE_BPS &&
                IAgentID(AGENT_ID).balanceOf(agent) > 0
            );
        }
    }

    /// @notice Live Layer 3 B402 Verified Forecaster eligibility check:
    ///         1. Holds an active Agent ID (`balanceOf > 0`)
    ///         2. `competitiveRoundsScored >= 3` (distinct 4h epochs with `revealedCount >= 2`)
    ///         3. `effectiveBrier >= 0.7600` (+4% Brier Skill Score over 50% coin-flip)
    ///         4. `revealRate >= 80%`
    function isVerifiedForecaster(address agent) external view override returns (bool) {
        if (IAgentID(AGENT_ID).balanceOf(agent) == 0) return false;
        return getEffectiveProfile(agent).isVerified;
    }

    // -------------------------------------------------------------------------
    // Internal Logic
    // -------------------------------------------------------------------------

    function _createRound(uint8 feedId, uint64 epochId, uint8 tierId) internal returns (uint64 roundId) {
        if (feedId > 2) revert InvalidFeedId();
        uint128 stakeAmount = stakeForTier(tierId);
        uint64 maxEpochId =
            (type(uint64).max - EMERGENCY_CANCEL_DELAY - COMMIT_DURATION - OBSERVE_DURATION - REVEAL_DURATION)
                / EPOCH_DURATION;
        if (epochId == 0 || epochId > maxEpochId) {
            revert InvalidEpochId();
        }

        uint64 openTime = epochId * EPOCH_DURATION;
        uint64 commitEnd = openTime + COMMIT_DURATION;
        if (block.timestamp < openTime || block.timestamp >= commitEnd) revert RoundNotOpen();

        bytes32 key = roundKey(feedId, epochId, tierId);
        if (roundIdByKey[key] != 0) revert RoundAlreadyExists();

        uint64 resolveTime = commitEnd + OBSERVE_DURATION;
        uint64 revealEnd = resolveTime + REVEAL_DURATION;

        roundId = ++nextRoundId;
        roundIdByKey[key] = roundId;

        Round storage r = _rounds[roundId];
        r.feedId = feedId;
        r.tierId = tierId;
        r.epochId = epochId;
        r.openTime = openTime;
        r.commitEnd = commitEnd;
        r.resolveTime = resolveTime;
        r.revealEnd = revealEnd;
        r.stakeAmount = stakeAmount;

        emit RoundCreated(
            roundId,
            feedId,
            epochId,
            tierId,
            stakeAmount,
            openTime,
            commitEnd,
            resolveTime,
            revealEnd
        );
    }

    function _commit(uint64 roundId, bytes32 commitment) internal {
        if (commitment == bytes32(0)) revert InvalidCommitment();

        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (block.timestamp < r.openTime || block.timestamp >= r.commitEnd) revert RoundNotOpen();
        if (msg.value != r.stakeAmount) revert InvalidStakeAmount();

        // Sybil-proof Agent ID gate: verify both ERC-721 ownership and non-empty bound handle.
        if (IAgentID(AGENT_ID).balanceOf(msg.sender) == 0) revert NoAgentID();
        string memory handle = IAgentID(AGENT_ID).handleOf(msg.sender);
        if (bytes(handle).length == 0) revert NoAgentID();

        Entry storage e = _entries[roundId][msg.sender];
        if (e.commitment != bytes32(0)) revert AlreadyCommitted();

        // Auto-flush finished rounds BEFORE checking active cap so users never self-lockout.
        _flushPending(msg.sender);
        if (_pendingRoundIds[msg.sender].length >= MAX_PENDING_ROUNDS) revert TooManyPendingRounds();

        e.commitment = commitment;
        r.committedCount += 1;
        r.remainingPool += uint128(msg.value);
        _pendingRoundIds[msg.sender].push(roundId);

        StoredProfile storage p = _profiles[msg.sender];
        if (p.firstActiveAt == 0) {
            p.firstActiveAt = uint64(block.timestamp);
            p.handleHash = keccak256(bytes(handle));
            _agents.push(msg.sender);
        }
        p.roundsCommitted += 1;
        p.totalVolumeWei += uint128(msg.value);

        emit ForecastCommitted(roundId, msg.sender, handle, commitment, uint128(msg.value));
    }

    function _fixStrike(uint64 roundId, uint80 strikeRoundId, uint80 strikeNextRoundId) internal {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (r.strikeFixed) revert StrikeAlreadyFixed();
        if (r.oracleCancelled) revert OracleAlreadyCancelled();
        if (block.timestamp < r.commitEnd) revert CommitStillOpen();
        if (block.timestamp >= r.resolveTime + EMERGENCY_CANCEL_DELAY) revert SettleDeadlinePassed();

        int256 strike = _verifyHistoricalPrice(feedForId(r.feedId), r.commitEnd, strikeRoundId, strikeNextRoundId);
        r.strikePrice = strike;
        r.strikeFixed = true;

        emit StrikeFixed(roundId, strike, strikeRoundId);
    }

    function _settleOracle(uint64 roundId, uint80 resolveRoundId, uint80 resolveNextRoundId) internal {
        Round storage r = _rounds[roundId];
        if (r.openTime == 0) revert RoundNotFound();
        if (!r.strikeFixed) revert StrikeNotFixed();
        if (r.oracleSettled) revert OracleAlreadySettled();
        if (r.oracleCancelled) revert OracleAlreadyCancelled();
        if (block.timestamp < r.resolveTime) revert ResolveTimeNotReached();
        if (block.timestamp >= r.resolveTime + EMERGENCY_CANCEL_DELAY) revert SettleDeadlinePassed();

        int256 settle = _verifyHistoricalPrice(feedForId(r.feedId), r.resolveTime, resolveRoundId, resolveNextRoundId);
        uint8 outcome = settle >= r.strikePrice ? 1 : 0;

        r.settlePrice = settle;
        r.outcome = outcome;
        r.oracleSettled = true;

        emit OracleSettled(roundId, r.strikePrice, settle, outcome, resolveRoundId);
    }

    /// @dev Verifies that `priceRoundId` was the exact active Chainlink price at `targetTime`
    ///      (with `targetTime - updatedAt <= MAX_ORACLE_STALENESS`) and that `nextOracleRoundId` is the
    ///      immediately subsequent round with `nextUpdatedAt > targetTime` (supporting aggregator
    ///      phase rollovers cleanly).
    function _verifyHistoricalPrice(
        IAggregatorV3 feed,
        uint64 targetTime,
        uint80 priceRoundId,
        uint80 nextOracleRoundId
    ) internal view returns (int256 price) {
        {
            (uint80 pId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) = feed.getRoundData(priceRoundId);
            if (pId != priceRoundId || answer <= 0 || updatedAt == 0 || answeredInRound < priceRoundId) {
                revert InvalidOracleRound();
            }
            if (updatedAt > targetTime || targetTime - updatedAt > MAX_ORACLE_STALENESS) {
                revert OraclePriceStaleOrAfterTarget();
            }
            price = answer;
        }

        _verifyRoundAdjacency(feed, priceRoundId, nextOracleRoundId);

        {
            (uint80 nId, int256 nextAnswer, , uint256 nextUpdatedAt, uint80 nextAnsweredInRound) =
                feed.getRoundData(nextOracleRoundId);
            if (
                nId != nextOracleRoundId ||
                nextAnswer <= 0 ||
                nextUpdatedAt <= targetTime ||
                nextAnsweredInRound < nextOracleRoundId
            ) {
                revert InvalidNextOracleRound();
            }
        }
    }

    function _verifyRoundAdjacency(
        IAggregatorV3 feed,
        uint80 priceRoundId,
        uint80 nextOracleRoundId
    ) internal view {
        uint16 pricePhase = uint16(priceRoundId >> 64);
        uint64 priceAggRound = uint64(priceRoundId);
        uint16 nextPhase = uint16(nextOracleRoundId >> 64);
        uint64 nextAggRound = uint64(nextOracleRoundId);

        if (nextPhase == pricePhase) {
            if (nextAggRound != priceAggRound + 1) revert InvalidNextOracleRound();
        } else if (nextPhase == pricePhase + 1 && nextAggRound == 1) {
            if (priceAggRound == type(uint64).max) revert InvalidOracleRound();
            if (gasleft() < 50_000) revert InsufficientOracleCheckGas();
            // Confirm the previous aggregator phase truly ended at `priceRoundId`.
            try feed.getRoundData((uint80(pricePhase) << 64) | uint80(priceAggRound + 1)) returns (
                uint80,
                int256,
                uint256,
                uint256 oldNextUpdatedAt,
                uint80
            ) {
                if (oldNextUpdatedAt != 0) revert InvalidNextOracleRound();
            } catch (bytes memory reason) {
                // Chainlink aggregators revert with non-empty revert data ("No data present");
                // empty revert data indicates an OOG or non-contract target and must never be swallowed.
                if (reason.length == 0) revert InvalidNextOracleRound();
            }
        } else {
            revert InvalidNextOracleRound();
        }
    }

    function _flushPending(address agent) internal {
        uint64[] storage pending = _pendingRoundIds[agent];
        StoredProfile storage p = _profiles[agent];

        uint256 i = 0;
        while (i < pending.length) {
            uint64 rId = pending[i];
            RoundState st = roundState(rId);

            if (st == RoundState.CLAIMABLE || st == RoundState.NO_REVEALS) {
                Entry storage e = _entries[rId][agent];
                if (!e.profileFlushed) {
                    Round storage r = _rounds[rId];
                    p.roundsScored += 1;
                    uint256 s = 0;
                    if (e.revealed) {
                        p.roundsRevealed += 1;
                        s = _brierScore(e.probBps, r.outcome);
                        p.cumulativeBrier += uint128(s);
                        uint8 b = uint8(e.probBps / 1000);
                        p.bucketCounts[b] += 1;
                        if (r.outcome == 1) {
                            p.bucketHits[b] += 1;
                        }
                        if (r.revealedCount >= 2 && !_competitiveEpochCredited[agent][r.epochId]) {
                            _competitiveEpochCredited[agent][r.epochId] = true;
                            p.competitiveRoundsScored += 1;
                        }
                    } else {
                        p.roundsMissed += 1;
                    }
                    e.profileFlushed = true;
                    emit ProfileFlushed(agent, rId, e.revealed, false, s);
                }
                // Swap-and-pop
                pending[i] = pending[pending.length - 1];
                pending.pop();
            } else if (st == RoundState.CANCELLED_ORACLE) {
                Entry storage e = _entries[rId][agent];
                if (!e.profileFlushed) {
                    e.profileFlushed = true;
                    emit ProfileFlushed(agent, rId, e.revealed, true, 0);
                }
                pending[i] = pending[pending.length - 1];
                pending.pop();
            } else {
                ++i;
            }
        }
    }

    function _brierScore(uint16 probBps, uint8 outcome) internal pure returns (uint256) {
        uint256 p = uint256(probBps);
        uint256 diff = outcome == 1 ? (PROB_SCALE - p) : p;
        return BRIER_SCALE - (diff * diff);
    }

    /// @dev Lambert et al. (EC 2008) equal-stake WSWM + equal non-revealer forfeit split:
    ///      payout_i = floor(W * (C * D + N * S_i - sumS) / (N * D))
    ///      where sumS = N * D - sumP2 (if Y == 0) OR 20_000 * sumP - sumP2 (if Y == 1).
    function _computePayout(Round storage r, uint16 probBps) internal view returns (uint256) {
        uint256 c = uint256(r.committedCount);
        uint256 n = uint256(r.revealedCount);
        uint256 w = uint256(r.stakeAmount);

        uint256 sI = _brierScore(probBps, r.outcome);
        uint256 sumS = r.outcome == 1
            ? (2 * PROB_SCALE * r.sumP - r.sumP2)
            : (n * BRIER_SCALE - r.sumP2);

        uint256 numeratorFactor = (c * BRIER_SCALE) + (n * sI) - sumS;
        return Math.mulDiv(w, numeratorFactor, n * BRIER_SCALE);
    }
}
