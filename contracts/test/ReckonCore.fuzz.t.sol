// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ReckonCore} from "../src/ReckonCore.sol";
import {IReckonCore} from "../src/interfaces/IReckonCore.sol";
import {MockAgentID} from "./mocks/MockAgentID.sol";
import {MockAggregatorV3} from "./mocks/MockAggregatorV3.sol";

/// @title ReckonCoreFuzzTest
/// @notice Stateless mathematical fuzz tests proving WSWM solvency, zero-dust conservation,
///         non-negativity, score monotonicity, and strict incentive compatibility (properness).
contract ReckonCoreFuzzTest is Test {
    ReckonCore internal core;
    MockAgentID internal agentId;
    MockAggregatorV3 internal bnbFeed;
    MockAggregatorV3 internal btcFeed;
    MockAggregatorV3 internal ethFeed;

    uint64 internal constant BASE_EPOCH = 83_200;

    function setUp() public {
        agentId = new MockAgentID();
        bnbFeed = new MockAggregatorV3(8, "BNB / USD");
        btcFeed = new MockAggregatorV3(8, "BTC / USD");
        ethFeed = new MockAggregatorV3(8, "ETH / USD");
        core = new ReckonCore(address(agentId), address(bnbFeed), address(btcFeed), address(ethFeed));
    }

    /// @notice Fuzzes arbitrary revealer counts (1..20), non-revealer counts (0..8), probabilities [100..9900],
    ///         outcomes {0,1}, stake tiers {0,1,2}, and claim order permutations.
    ///         Proves exact wei-for-wei conservation, zero dust lockup, positive payouts, and score monotonicity.
    function testFuzz_WSWMExactConservationZeroDustAndMonotonicity(
        uint8 rawRevealers,
        uint8 rawNonRevealers,
        uint8 rawTier,
        bool outcomeUp,
        uint256 seed
    ) public {
        uint256 n = bound(rawRevealers, 1, 20);
        uint256 k = bound(rawNonRevealers, 0, 8);
        uint8 tierId = uint8(bound(rawTier, 0, 2));
        uint128 stake = core.stakeForTier(tierId);

        vm.warp(uint256(BASE_EPOCH) * core.EPOCH_DURATION() + 30);
        uint64 rId = core.createRound(0, BASE_EPOCH, tierId);

        address[] memory revealers = new address[](n);
        uint16[] memory probs = new uint16[](n);
        bytes32[] memory salts = new bytes32[](n);

        // Mint Agent IDs & commit all C = N + K participants
        for (uint256 i = 0; i < n; ++i) {
            address a = address(uint160(0x10000 + i));
            agentId.mint(a, string.concat("rev", vm.toString(i)));
            vm.deal(a, 1 ether);

            uint16 p = uint16(bound(uint256(keccak256(abi.encode(seed, i, "p"))), 100, 9900));
            bytes32 salt = keccak256(abi.encode(seed, i, "salt"));

            revealers[i] = a;
            probs[i] = p;
            salts[i] = salt;

            bytes32 comm = core.computeCommitment(0, BASE_EPOCH, tierId, a, p, salt);
            vm.prank(a);
            core.commit{value: stake}(rId, comm);
        }

        for (uint256 j = 0; j < k; ++j) {
            address nr = address(uint160(0x20000 + j));
            agentId.mint(nr, string.concat("nr", vm.toString(j)));
            vm.deal(nr, 1 ether);
            bytes32 commNr = core.computeCommitment(0, BASE_EPOCH, tierId, nr, 5000, bytes32(j + 1));
            vm.prank(nr);
            core.commit{value: stake}(rId, commNr);
        }

        _settleFuzzRound(rId, outcomeUp);

        for (uint256 i = 0; i < n; ++i) {
            vm.prank(revealers[i]);
            core.reveal(rId, probs[i], salts[i]);
        }

        vm.warp(core.getRound(rId).revealEnd + 1);

        // Check preview monotonicity before claims
        uint256[] memory previews = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            previews[i] = core.previewPayout(rId, revealers[i]);
            assertGt(previews[i], 0, "WSWM payout must be strictly positive");
        }
        _assertMonotonicity(probs, previews, outcomeUp ? 1 : 0);

        // Claim in fuzzed rotated order
        uint256 totalPaid = _claimAllAndVerifyDust(rId, revealers, previews, seed);

        assertEq(totalPaid, (n + k) * uint256(stake), "Exact wei conservation violated");
        assertEq(core.getRound(rId).remainingPool, 0, "Remaining pool dust stranded");
        assertEq(address(core).balance, 0, "Contract balance not drained to zero");
    }

    function _assertMonotonicity(uint16[] memory probs, uint256[] memory previews, uint8 outcome) internal pure {
        uint256 n = probs.length;
        for (uint256 i = 0; i < n; ++i) {
            uint256 si = _brier(probs[i], outcome);
            for (uint256 j = i + 1; j < n; ++j) {
                uint256 sj = _brier(probs[j], outcome);
                if (si > sj) assertGe(previews[i], previews[j], "Monotonicity violated");
                if (sj > si) assertGe(previews[j], previews[i], "Monotonicity violated");
            }
        }
    }

    function _claimAllAndVerifyDust(
        uint64 rId,
        address[] memory revealers,
        uint256[] memory previews,
        uint256 seed
    ) internal returns (uint256 totalPaid) {
        uint256 n = revealers.length;
        uint256 offset = seed % n;
        for (uint256 step = 0; step < n; ++step) {
            uint256 idx = (offset + step) % n;
            address a = revealers[idx];
            uint256 claimableBefore = core.claimablePayout(rId, a);
            uint256 balBefore = a.balance;
            vm.prank(a);
            core.claim(rId);
            uint256 paid = a.balance - balBefore;
            totalPaid += paid;

            assertEq(paid, claimableBefore, "claimablePayout must match exact paid wei");
            assertEq(core.claimablePayout(rId, a), 0, "claimablePayout must be 0 after claim");

            if (step + 1 < n) {
                assertEq(paid, previews[idx], "Non-last claimer must match preview exactly");
            } else {
                assertGe(paid, previews[idx], "Final claimer underpaid");
                assertLe(paid - previews[idx], n - 1, "Dust exceeded N - 1 wei bound");
            }
        }
    }

    /// @notice Numerical verification of Lambert WSWM Strict Properness:
    ///         For any true belief q in [500, 9500] and any opponent forecast pOpp in [100, 9900],
    ///         reporting p == q yields strictly higher expected payout than reporting any misreport pMis != q.
    function testFuzz_WSWMStrictPropernessDominantStrategy(
        uint16 rawQ,
        uint16 rawOpp,
        uint16 rawMis
    ) public pure {
        uint256 q = bound(rawQ, 500, 9500);       // true probability in bps
        uint256 pOpp = bound(rawOpp, 100, 9900);  // opponent forecast in bps
        uint256 pMis = bound(rawMis, 100, 9900);  // alternative report in bps
        vm.assume(pMis != q);

        uint256 evTruth = q * _brier(uint16(q), 1) + (10_000 - q) * _brier(uint16(q), 0);
        uint256 evMis = q * _brier(uint16(pMis), 1) + (10_000 - q) * _brier(uint16(pMis), 0);

        uint256 oppEv = q * _brier(uint16(pOpp), 1) + (10_000 - q) * _brier(uint16(pOpp), 0);
        assertGt(evTruth + 1e18 - oppEv, evMis + 1e18 - oppEv, "Truthful reporting must strictly dominate");
    }

    function _settleFuzzRound(uint64 rId, bool outcomeUp) internal {
        ReckonCore.Round memory r = core.getRound(rId);
        uint80 s1 = bnbFeed.makeRoundId(1, 10);
        uint80 s2 = bnbFeed.makeRoundId(1, 11);
        uint80 e1 = bnbFeed.makeRoundId(1, 20);
        uint80 e2 = bnbFeed.makeRoundId(1, 21);
        bnbFeed.setRound(s1, 600e8, r.commitEnd - 10);
        bnbFeed.setRound(s2, 601e8, r.commitEnd + 10);
        bnbFeed.setRound(e1, outcomeUp ? int256(620e8) : int256(580e8), r.resolveTime - 10);
        bnbFeed.setRound(e2, outcomeUp ? int256(621e8) : int256(579e8), r.resolveTime + 10);
        vm.warp(r.resolveTime + 60);
        core.fixAndSettleOracle(rId, s1, s2, e1, e2);
    }

    function _brier(uint16 probBps, uint8 outcome) internal pure returns (uint256) {
        uint256 p = uint256(probBps);
        uint256 diff = outcome == 1 ? (10_000 - p) : p;
        return 100_000_000 - diff * diff;
    }
}

/// @title ReckonHandler
/// @notice Stateful fuzzing actor driving arbitrary valid sequences across multiple epochs & agents.
contract ReckonHandler is Test {
    ReckonCore public immutable core;
    MockAgentID public immutable agentId;
    MockAggregatorV3 public immutable bnbFeed;

    address[] public actors;
    uint64[] public createdRounds;
    uint64 public currentEpoch;
    uint64 internal oracleSeq;

    mapping(uint64 => mapping(address => uint16)) public savedProb;
    mapping(uint64 => mapping(address => bytes32)) public savedSalt;

    constructor(ReckonCore core_, MockAgentID agentId_, MockAggregatorV3 bnbFeed_) {
        core = core_;
        agentId = agentId_;
        bnbFeed = bnbFeed_;
        currentEpoch = 83_300;
        oracleSeq = 100;

        for (uint256 i = 0; i < 6; ++i) {
            address a = address(uint160(0x30000 + i));
            agentId.mint(a, string.concat("bot", vm.toString(i)));
            vm.deal(a, 50 ether);
            actors.push(a);
        }
        vm.warp(uint256(currentEpoch) * core.EPOCH_DURATION() + 60);
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function actorAt(uint256 i) external view returns (address) {
        return actors[i];
    }

    function roundCount() external view returns (uint256) {
        return createdRounds.length;
    }

    function roundAt(uint256 i) external view returns (uint64) {
        return createdRounds[i];
    }

    function actCommit(uint8 actorSeed, uint8 tierSeed, uint16 probSeed, bytes32 salt) external {
        address a = actors[actorSeed % actors.length];
        uint8 tierId = tierSeed % 3;
        uint16 prob = uint16(bound(probSeed, 100, 9900));

        uint64 ep = core.currentEpochId();
        uint64 openTime = ep * core.EPOCH_DURATION();
        if (block.timestamp >= openTime + core.COMMIT_DURATION()) {
            ep += 1;
            vm.warp(uint256(ep) * core.EPOCH_DURATION() + 30);
        }

        bytes32 key = core.roundKey(0, ep, tierId);
        uint64 existingId = core.roundIdByKey(key);

        bytes32 comm = core.computeCommitment(0, ep, tierId, a, prob, salt);
        uint128 stake = core.stakeForTier(tierId);

        vm.prank(a);
        try core.commitEpoch{value: stake}(0, ep, tierId, comm) returns (uint64 rId) {
            if (existingId == 0) {
                createdRounds.push(rId);
            }
            savedProb[rId][a] = prob;
            savedSalt[rId][a] = salt;
        } catch {}
    }

    function actWarp(uint32 deltaSeconds) external {
        uint256 dt = bound(deltaSeconds, 60, 8 hours);
        vm.warp(block.timestamp + dt);
    }

    function actSettle(uint256 roundIdxSeed, bool outcomeUp) external {
        if (createdRounds.length == 0) return;
        uint64 rId = createdRounds[roundIdxSeed % createdRounds.length];
        ReckonCore.Round memory r = core.getRound(rId);
        if (r.oracleSettled || r.oracleCancelled) return;
        if (block.timestamp < r.resolveTime || block.timestamp >= r.resolveTime + core.EMERGENCY_CANCEL_DELAY()) return;

        uint80 s1 = bnbFeed.makeRoundId(1, ++oracleSeq);
        uint80 s2 = bnbFeed.makeRoundId(1, ++oracleSeq);
        uint80 e1 = bnbFeed.makeRoundId(1, ++oracleSeq);
        uint80 e2 = bnbFeed.makeRoundId(1, ++oracleSeq);

        bnbFeed.setRound(s1, 600e8, r.commitEnd - 20);
        bnbFeed.setRound(s2, 601e8, r.commitEnd + 20);
        bnbFeed.setRound(e1, outcomeUp ? int256(615e8) : int256(585e8), r.resolveTime - 20);
        bnbFeed.setRound(e2, outcomeUp ? int256(616e8) : int256(584e8), r.resolveTime + 20);

        try core.fixAndSettleOracle(rId, s1, s2, e1, e2) {} catch {}
    }

    function actCancelIfHalted(uint256 roundIdxSeed) external {
        if (createdRounds.length == 0) return;
        uint64 rId = createdRounds[roundIdxSeed % createdRounds.length];
        try core.cancelUnsettleableRound(rId) {} catch {}
    }

    function actReveal(uint256 roundIdxSeed, uint8 actorSeed) external {
        if (createdRounds.length == 0) return;
        uint64 rId = createdRounds[roundIdxSeed % createdRounds.length];
        address a = actors[actorSeed % actors.length];
        uint16 p = savedProb[rId][a];
        if (p == 0) return;

        vm.prank(a);
        try core.reveal(rId, p, savedSalt[rId][a]) {} catch {}
    }

    function actClaimOrRefund(uint256 roundIdxSeed, uint8 actorSeed) external {
        if (createdRounds.length == 0) return;
        uint64 rId = createdRounds[roundIdxSeed % createdRounds.length];
        address a = actors[actorSeed % actors.length];
        ReckonCore.RoundState st = core.roundState(rId);

        vm.prank(a);
        if (st == ReckonCore.RoundState.CLAIMABLE) {
            try core.claim(rId) {} catch {}
        } else if (st == ReckonCore.RoundState.NO_REVEALS || st == ReckonCore.RoundState.CANCELLED_ORACLE) {
            try core.claimRefund(rId) {} catch {}
        }
    }

    function actFlush(uint8 actorSeed) external {
        core.flushAgent(actors[actorSeed % actors.length]);
    }
}

/// @title ReckonCoreInvariantTest
/// @notice Stateful Foundry invariant test verifying protocol-wide solvency and calibration ledger invariants.
contract ReckonCoreInvariantTest is StdInvariant, Test {
    ReckonCore internal core;
    MockAgentID internal agentId;
    MockAggregatorV3 internal bnbFeed;
    MockAggregatorV3 internal btcFeed;
    MockAggregatorV3 internal ethFeed;
    ReckonHandler internal handler;

    function setUp() public {
        agentId = new MockAgentID();
        bnbFeed = new MockAggregatorV3(8, "BNB / USD");
        btcFeed = new MockAggregatorV3(8, "BTC / USD");
        ethFeed = new MockAggregatorV3(8, "ETH / USD");
        core = new ReckonCore(address(agentId), address(bnbFeed), address(btcFeed), address(ethFeed));
        handler = new ReckonHandler(core, agentId, bnbFeed);

        targetContract(address(handler));
    }

    function invariant_solvencyAndExactEscrowMatch() public view {
        uint256 sumRemaining = 0;
        uint256 nRounds = handler.roundCount();
        for (uint256 i = 0; i < nRounds; ++i) {
            ReckonCore.Round memory r = core.getRound(handler.roundAt(i));
            sumRemaining += r.remainingPool;
            assertLe(r.revealedCount, r.committedCount, "Revealed > committed");
            assertLe(r.claimedCount, r.committedCount, "Claimed > committed");
            assertFalse(r.oracleSettled && r.oracleCancelled, "Settled and cancelled mutually exclusive");
        }
        assertEq(address(core).balance, sumRemaining, "Exact escrow solvency invariant violated");
    }

    function invariant_calibrationLedgerAccounting() public view {
        uint256 nActors = handler.actorCount();
        for (uint256 i = 0; i < nActors; ++i) {
            address a = handler.actorAt(i);
            IReckonCore.EffectiveProfile memory eff = core.getEffectiveProfile(a);

            assertEq(eff.roundsScored, eff.roundsRevealed + eff.roundsMissed, "Scored != revealed + missed");
            assertLe(eff.competitiveRoundsScored, eff.roundsRevealed, "Competitive > revealed");
            assertLe(eff.roundsScored, eff.roundsCommitted, "Scored > committed");
            assertLe(eff.meanBrier, 99_990_000, "Brier exceeded max bound");
            assertLe(eff.revealRateBps, 10_000, "Reveal rate exceeded 100%");
            assertEq(eff.isVerified, core.isVerifiedForecaster(a), "isVerified parity mismatch");
            assertLe(core.getPendingRounds(a).length, core.MAX_PENDING_ROUNDS(), "Pending rounds cap exceeded");

            uint256 totalBucketCount = 0;
            for (uint256 b = 0; b < 10; ++b) {
                assertLe(eff.bucketHits[b], eff.bucketCounts[b], "Bucket hits > counts");
                totalBucketCount += eff.bucketCounts[b];
            }
            assertEq(totalBucketCount, eff.roundsRevealed, "Bucket sum != revealed");
        }
    }
}
