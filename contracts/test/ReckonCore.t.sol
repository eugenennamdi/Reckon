// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReckonCore} from "../src/ReckonCore.sol";
import {IReckonCore} from "../src/interfaces/IReckonCore.sol";
import {MockAgentID} from "./mocks/MockAgentID.sol";
import {MockAggregatorV3} from "./mocks/MockAggregatorV3.sol";

contract ReentrantAgent {
    ReckonCore public immutable core;
    uint64 public targetRoundId;
    bool public attackReenter;
    bool public revertOnReceive;
    bool public reentered;

    constructor(ReckonCore core_) {
        core = core_;
    }

    function commit(uint64 roundId, bytes32 commitment) external payable {
        core.commit{value: msg.value}(roundId, commitment);
    }

    function reveal(uint64 roundId, uint16 probBps, bytes32 salt) external {
        core.reveal(roundId, probBps, salt);
    }

    function attackClaim(uint64 roundId, bool reenter_, bool revert_) external {
        targetRoundId = roundId;
        attackReenter = reenter_;
        revertOnReceive = revert_;
        core.claim(roundId);
    }

    receive() external payable {
        if (revertOnReceive) revert("refuse ETH");
        if (attackReenter && !reentered) {
            reentered = true;
            core.claim(targetRoundId);
        }
    }
}

contract ReckonCoreTest is Test {
    ReckonCore internal core;
    MockAgentID internal agentId;
    MockAggregatorV3 internal bnbFeed;
    MockAggregatorV3 internal btcFeed;
    MockAggregatorV3 internal ethFeed;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal noIdUser = makeAddr("noIdUser");

    uint64 internal constant BASE_EPOCH = 83_100; // Clean canonical 6h epoch (~2026)

    function setUp() public {
        agentId = new MockAgentID();
        bnbFeed = new MockAggregatorV3(8, "BNB / USD");
        btcFeed = new MockAggregatorV3(8, "BTC / USD");
        ethFeed = new MockAggregatorV3(8, "ETH / USD");

        core = new ReckonCore(address(agentId), address(bnbFeed), address(btcFeed), address(ethFeed));

        agentId.mint(alice, "alice");
        agentId.mint(bob, "bob");
        agentId.mint(carol, "carol");
        agentId.mint(dave, "dave");

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
        vm.deal(dave, 10 ether);
        vm.deal(noIdUser, 10 ether);

        vm.warp(uint256(BASE_EPOCH) * core.EPOCH_DURATION() + 60);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _setHistoricalBracket(
        MockAggregatorV3 feed,
        uint16 phase,
        uint64 aggId,
        uint64 targetTime,
        int256 priceBefore,
        int256 priceAfter
    ) internal returns (uint80 rBefore, uint80 rAfter) {
        rBefore = feed.makeRoundId(phase, aggId);
        rAfter = feed.makeRoundId(phase, aggId + 1);
        feed.setRound(rBefore, priceBefore, targetTime - 20);
        feed.setRound(rAfter, priceAfter, targetTime + 25);
    }

    function _runFullCompetitiveRound(
        uint64 epochId,
        uint16 aliceProb,
        uint16 bobProb,
        int256 settlePrice
    ) internal returns (uint64 roundId) {
        vm.warp(uint256(epochId) * core.EPOCH_DURATION() + 10);
        bytes32 saltA = bytes32(uint256(epochId) * 10 + 1);
        bytes32 saltB = bytes32(uint256(epochId) * 10 + 2);

        bytes32 commA = core.computeCommitment(0, epochId, 0, alice, aliceProb, saltA);
        vm.prank(alice);
        roundId = core.commitEpoch{value: 0.001 ether}(0, epochId, 0, commA);

        bytes32 commB = core.computeCommitment(0, epochId, 0, bob, bobProb, saltB);
        vm.prank(bob);
        core.commit{value: 0.001 ether}(roundId, commB);

        _settleCompetitiveBnb(roundId, epochId, settlePrice);

        vm.prank(alice);
        core.reveal(roundId, aliceProb, saltA);
        vm.prank(bob);
        core.reveal(roundId, bobProb, saltB);

        vm.warp(core.getRound(roundId).revealEnd + 1);
    }

    function _settleCompetitiveBnb(uint64 roundId, uint64 epochId, int256 settlePrice) internal {
        ReckonCore.Round memory r = core.getRound(roundId);
        uint64 baseAgg = epochId * 10;
        (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, baseAgg + 1, r.commitEnd, 600e8, 600e8 + 100);
        (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, baseAgg + 5, r.resolveTime, settlePrice, settlePrice + 100);
        vm.warp(r.resolveTime + 60);
        core.fixAndSettleOracle(roundId, s1, s2, e1, e2);
    }

    // -------------------------------------------------------------------------
    // Constructor & Static Guards
    // -------------------------------------------------------------------------

    function test_ConstructorRejectsZeroAddressOrBadDecimals() public {
        vm.expectRevert(ReckonCore.ZeroAddress.selector);
        new ReckonCore(address(0), address(bnbFeed), address(btcFeed), address(ethFeed));

        MockAggregatorV3 badFeed = new MockAggregatorV3(18, "BAD");
        vm.expectRevert(ReckonCore.InvalidFeedDecimals.selector);
        new ReckonCore(address(agentId), address(badFeed), address(btcFeed), address(ethFeed));
    }

    function test_RawNativeTransferReverts() public {
        (bool ok, ) = address(core).call{value: 1 ether}("");
        assertFalse(ok);
    }

    // -------------------------------------------------------------------------
    // Canonical Epochs & Deduplication
    // -------------------------------------------------------------------------

    function test_CanonicalEpochDeduplicationAndBounds() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 0);
        assertEq(rId, 1);

        // Duplicate reverts
        vm.expectRevert(ReckonCore.RoundAlreadyExists.selector);
        core.createRound(0, epoch, 0);

        // Future epoch reverts (prevents pre-creation spam)
        vm.expectRevert(ReckonCore.RoundNotOpen.selector);
        core.createRound(0, epoch + 1, 0);

        // Past epoch reverts
        vm.expectRevert(ReckonCore.RoundNotOpen.selector);
        core.createRound(0, epoch - 1, 0);

        // Invalid feed / tier reverts
        vm.expectRevert(ReckonCore.InvalidFeedId.selector);
        core.createRound(3, epoch, 0);
        vm.expectRevert(ReckonCore.InvalidTierId.selector);
        core.createRound(0, epoch, 3);
    }

    // -------------------------------------------------------------------------
    // Agent ID Sybil Gate & Commit Validation
    // -------------------------------------------------------------------------

    function test_AgentIDGateBlocksNonHolders() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 0);
        bytes32 comm = core.computeCommitment(0, epoch, 0, noIdUser, 7000, bytes32(uint256(1)));

        vm.prank(noIdUser);
        vm.expectRevert(ReckonCore.NoAgentID.selector);
        core.commit{value: 0.001 ether}(rId, comm);
    }

    function test_DoubleCommitAndInvalidStakeRevert() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 1); // 0.005 BNB
        bytes32 comm = core.computeCommitment(0, epoch, 1, alice, 7500, bytes32(uint256(42)));

        vm.prank(alice);
        vm.expectRevert(ReckonCore.InvalidStakeAmount.selector);
        core.commit{value: 0.001 ether}(rId, comm);

        vm.prank(alice);
        core.commit{value: 0.005 ether}(rId, comm);

        vm.prank(alice);
        vm.expectRevert(ReckonCore.AlreadyCommitted.selector);
        core.commit{value: 0.005 ether}(rId, comm);
    }

    // -------------------------------------------------------------------------
    // Forward-Start ATM Strike & Chainlink Phase Rollover
    // -------------------------------------------------------------------------

    function test_ForwardStartStrikeRejectsBeforeCommitEndAndSupportsPhaseRollover() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 0);
        ReckonCore.Round memory r = core.getRound(rId);

        // Cannot fix strike while OPEN
        vm.expectRevert(ReckonCore.CommitStillOpen.selector);
        core.fixStrike(rId, 1, 2);

        // Warp to LOCKED
        vm.warp(r.commitEnd + 60);

        // Phase rollover: phase 2 ends at aggId 500; phase 3 starts at aggId 1
        uint80 oldLast = bnbFeed.makeRoundId(2, 500);
        uint80 newFirst = bnbFeed.makeRoundId(3, 1);
        bnbFeed.setRound(oldLast, 600e8, r.commitEnd - 15);
        bnbFeed.setRound(newFirst, 601e8, r.commitEnd + 20);

        core.fixStrike(rId, oldLast, newFirst);
        assertEq(core.getRound(rId).strikePrice, 600e8);
        assertTrue(core.getRound(rId).strikeFixed);

        // Exact tie (settlePrice == strikePrice) resolves outcome = 1
        vm.warp(r.resolveTime + 60);
        uint80 res1 = bnbFeed.makeRoundId(3, 20);
        uint80 res2 = bnbFeed.makeRoundId(3, 21);
        bnbFeed.setRound(res1, 600e8, r.resolveTime);
        bnbFeed.setRound(res2, 599e8, r.resolveTime + 1);

        core.settleOracle(rId, res1, res2);
        ReckonCore.Round memory settled = core.getRound(rId);
        assertTrue(settled.oracleSettled);
        assertEq(settled.outcome, 1);
    }

    function test_FakePhaseRolloverRejectedWhenOldPhaseContinues() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 0);
        ReckonCore.Round memory r = core.getRound(rId);
        vm.warp(r.commitEnd + 60);

        uint80 oldA = bnbFeed.makeRoundId(2, 500);
        uint80 oldB = bnbFeed.makeRoundId(2, 501);
        uint80 fakeNextPhase = bnbFeed.makeRoundId(3, 1);

        bnbFeed.setRound(oldA, 600e8, r.commitEnd - 10);
        bnbFeed.setRound(oldB, 605e8, r.commitEnd - 5); // Still existed before commitEnd!
        bnbFeed.setRound(fakeNextPhase, 610e8, r.commitEnd + 10);

        vm.expectRevert(ReckonCore.InvalidNextOracleRound.selector);
        core.fixStrike(rId, oldA, fakeNextPhase);
    }

    function test_StaleOraclePriceRejected() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 0);
        ReckonCore.Round memory r = core.getRound(rId);
        vm.warp(r.commitEnd + 60);

        uint80 s1 = bnbFeed.makeRoundId(1, 10);
        uint80 s2 = bnbFeed.makeRoundId(1, 11);
        // Updated 31 minutes before commitEnd (> MAX_ORACLE_STALENESS = 30 min)
        bnbFeed.setRound(s1, 600e8, r.commitEnd - 31 minutes);
        bnbFeed.setRound(s2, 601e8, r.commitEnd + 10);

        vm.expectRevert(ReckonCore.OraclePriceStaleOrAfterTarget.selector);
        core.fixStrike(rId, s1, s2);
    }

    // -------------------------------------------------------------------------
    // Strict Post-Oracle Reveal
    // -------------------------------------------------------------------------

    function test_RevealStrictlyBlockedBeforeResolveTimeAndAfterRevealEnd() public {
        uint64 epoch = core.currentEpochId();
        uint64 rId = core.createRound(0, epoch, 0);
        bytes32 salt = bytes32(uint256(999));
        bytes32 comm = core.computeCommitment(0, epoch, 0, alice, 8000, salt);

        vm.prank(alice);
        core.commit{value: 0.001 ether}(rId, comm);

        ReckonCore.Round memory r = core.getRound(rId);

        // Cannot reveal during OPEN
        vm.prank(alice);
        vm.expectRevert(ReckonCore.NotInRevealWindow.selector);
        core.reveal(rId, 8000, salt);

        // Cannot reveal during LOCKED (preserves Layer 3 B402 signal exclusivity!)
        vm.warp(r.resolveTime - 1);
        vm.prank(alice);
        vm.expectRevert(ReckonCore.NotInRevealWindow.selector);
        core.reveal(rId, 8000, salt);

        // Cannot reveal after revealEnd
        vm.warp(r.revealEnd);
        vm.prank(alice);
        vm.expectRevert(ReckonCore.NotInRevealWindow.selector);
        core.reveal(rId, 8000, salt);
    }

    // -------------------------------------------------------------------------
    // Exact Lambert WSWM Math, Non-Revealer Forfeits & Zero Dust
    // -------------------------------------------------------------------------

    function test_ExactWSWMPayoutsWithNonRevealerForfeitAndZeroDust() public {
        uint64 epoch = BASE_EPOCH;
        uint64 rId = core.createRound(0, epoch, 2); // 0.01 BNB each
        uint128 stake = 0.01 ether;

        // Alice: 90% (9000), Bob: 20% (2000), Carol: commits and NEVER reveals!
        {
            bytes32 cAlice = core.computeCommitment(0, epoch, 2, alice, 9000, bytes32(uint256(1)));
            bytes32 cBob = core.computeCommitment(0, epoch, 2, bob, 2000, bytes32(uint256(2)));
            bytes32 cCarol = core.computeCommitment(0, epoch, 2, carol, 5000, bytes32(uint256(3)));
            vm.prank(alice);
            core.commit{value: stake}(rId, cAlice);
            vm.prank(bob);
            core.commit{value: stake}(rId, cBob);
            vm.prank(carol);
            core.commit{value: stake}(rId, cCarol);
        }

        ReckonCore.Round memory r = core.getRound(rId);
        (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, 10, r.commitEnd, 590e8, 591e8);
        (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, 20, r.resolveTime, 610e8, 611e8);

        vm.warp(r.resolveTime + 60);
        core.fixAndSettleOracle(rId, s1, s2, e1, e2); // outcome == 1

        vm.prank(alice);
        core.reveal(rId, 9000, bytes32(uint256(1)));
        vm.prank(bob);
        core.reveal(rId, 2000, bytes32(uint256(2)));
        // Carol skips reveal!

        vm.warp(r.revealEnd + 1);

        assertEq(core.previewPayout(rId, alice), 0.01815 ether);
        assertEq(core.previewPayout(rId, bob), 0.01185 ether);

        // Anti-dodge check BEFORE anyone claims or flushes:
        IReckonCore.EffectiveProfile memory pCarol = core.getEffectiveProfile(carol);
        assertEq(pCarol.roundsScored, 1);
        assertEq(pCarol.roundsMissed, 1);
        assertEq(pCarol.roundsRevealed, 0);
        assertEq(pCarol.meanBrier, 0);
        assertEq(pCarol.revealRateBps, 0);

        // First-revealer (Alice) AND second-revealer (Bob) BOTH get competitiveRoundsScored == 1!
        IReckonCore.EffectiveProfile memory pAlice = core.getEffectiveProfile(alice);
        IReckonCore.EffectiveProfile memory pBob = core.getEffectiveProfile(bob);
        assertEq(pAlice.competitiveRoundsScored, 1);
        assertEq(pBob.competitiveRoundsScored, 1);
        assertEq(pBob.meanBrier, 36_000_000);
        assertEq(pBob.bucketCounts[2], 1);
        assertEq(pBob.bucketHits[2], 1);

        // Claims
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        core.claim(rId);
        vm.prank(bob);
        core.claim(rId);

        assertEq(alice.balance - aliceBefore, 0.01815 ether);
        assertEq(bob.balance - bobBefore, 0.01185 ether);
        assertEq(core.getRound(rId).remainingPool, 0);
        assertEq(address(core).balance, 0);

        // Carol cannot claim payout or refund
        vm.prank(carol);
        vm.expectRevert(ReckonCore.NotRevealed.selector);
        core.claim(rId);

        vm.prank(carol);
        vm.expectRevert(ReckonCore.RoundNotRefundable.selector);
        core.claimRefund(rId);
    }

    function test_NoRevealsRefundsStakeButAppliesZeroBrierPenalty() public {
        uint64 epoch = BASE_EPOCH;
        uint64 rId = core.createRound(0, epoch, 0);
        bytes32 cAlice = core.computeCommitment(0, epoch, 0, alice, 8000, bytes32(uint256(1)));
        vm.prank(alice);
        core.commit{value: 0.001 ether}(rId, cAlice);

        ReckonCore.Round memory r = core.getRound(rId);
        (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, 10, r.commitEnd, 590e8, 591e8);
        (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, 20, r.resolveTime, 600e8, 601e8);

        // Warp past revealEnd WITHOUT oracle settled yet -> AWAITING_ORACLE (cannot refund yet!)
        vm.warp(r.revealEnd + 10);
        assertEq(uint8(core.roundState(rId)), uint8(ReckonCore.RoundState.AWAITING_ORACLE));
        vm.prank(alice);
        vm.expectRevert(ReckonCore.RoundNotRefundable.selector);
        core.claimRefund(rId);

        // Settle oracle -> NO_REVEALS
        core.fixAndSettleOracle(rId, s1, s2, e1, e2);
        assertEq(uint8(core.roundState(rId)), uint8(ReckonCore.RoundState.NO_REVEALS));

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        core.claimRefund(rId);
        assertEq(alice.balance - balBefore, 0.001 ether);
        assertEq(core.getRound(rId).remainingPool, 0);

        // S = 0 penalty permanently recorded
        IReckonCore.EffectiveProfile memory p = core.getEffectiveProfile(alice);
        assertEq(p.roundsScored, 1);
        assertEq(p.roundsMissed, 1);
        assertEq(p.meanBrier, 0);
    }

    function test_OracleHaltRefundsStakeWithZeroPenalty() public {
        uint64 epoch = BASE_EPOCH;
        uint64 rId = core.createRound(0, epoch, 0);
        bytes32 cAlice = core.computeCommitment(0, epoch, 0, alice, 8000, bytes32(uint256(1)));
        vm.prank(alice);
        core.commit{value: 0.001 ether}(rId, cAlice);

        ReckonCore.Round memory r = core.getRound(rId);
        // Feed halted BEFORE resolveTime (no round posted after resolveTime)
        bnbFeed.setRound(bnbFeed.makeRoundId(1, 1), 600e8, r.commitEnd - 10);

        // Alice reveals during reveal window while oracle is halted
        vm.warp(r.resolveTime + 60);
        vm.prank(alice);
        core.reveal(rId, 8000, bytes32(uint256(1)));

        // Warp past resolveTime + ORACLE_HALT_GRACE -> cancelUnsettleableRound succeeds!
        vm.warp(r.resolveTime + core.ORACLE_HALT_GRACE() + 1);
        core.cancelUnsettleableRound(rId);
        assertEq(uint8(core.roundState(rId)), uint8(ReckonCore.RoundState.CANCELLED_ORACLE));

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        core.claimRefund(rId);
        assertEq(alice.balance - balBefore, 0.001 ether);

        // Zero calibration impact
        IReckonCore.EffectiveProfile memory p = core.getEffectiveProfile(alice);
        assertEq(p.roundsCommitted, 1);
        assertEq(p.roundsScored, 0);
        assertEq(p.roundsRevealed, 0);
        assertEq(p.roundsMissed, 0);
    }

    // -------------------------------------------------------------------------
    // B402 Verified Forecaster Anti-Cheese Gates
    // -------------------------------------------------------------------------

    function test_FiftyPercentCoinFlipCheeseBlocked() public {
        for (uint64 i = 0; i < 4; ++i) {
            _runFullCompetitiveRound(BASE_EPOCH + i, 5000, 7000, i % 2 == 0 ? int256(610e8) : int256(590e8));
        }

        IReckonCore.EffectiveProfile memory p = core.getEffectiveProfile(alice);
        assertEq(p.competitiveRoundsScored, 4);
        assertEq(p.meanBrier, 75_000_000);
        assertEq(p.revealRateBps, 10_000);
        assertFalse(p.isVerified);
        assertFalse(core.isVerifiedForecaster(alice));
    }

    function test_SoloRoundBadgeFarmingBlocked() public {
        for (uint64 i = 0; i < 4; ++i) {
            uint64 epoch = BASE_EPOCH + i;
            vm.warp(uint256(epoch) * core.EPOCH_DURATION() + 10);
            bytes32 salt = bytes32(uint256(i + 1));
            bytes32 cSolo = core.computeCommitment(0, epoch, 0, alice, 9900, salt);
            vm.prank(alice);
            uint64 rId = core.commitEpoch{value: 0.001 ether}(0, epoch, 0, cSolo);
            ReckonCore.Round memory r = core.getRound(rId);
            (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, epoch * 10 + 1, r.commitEnd, 600e8, 601e8);
            (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, epoch * 10 + 5, r.resolveTime, 610e8, 611e8);
            vm.warp(r.resolveTime + 60);
            core.fixAndSettleOracle(rId, s1, s2, e1, e2);
            vm.prank(alice);
            core.reveal(rId, 9900, salt);
            vm.warp(r.revealEnd + 1);
            uint256 before = alice.balance;
            vm.prank(alice);
            core.claim(rId);
            assertEq(alice.balance - before, 0.001 ether);
        }

        IReckonCore.EffectiveProfile memory p = core.getEffectiveProfile(alice);
        assertEq(p.roundsScored, 4);
        assertEq(p.competitiveRoundsScored, 0);
        assertEq(p.meanBrier, 99_990_000);
        assertFalse(core.isVerifiedForecaster(alice));
    }

    function test_SkilledCompetitiveForecasterQualifiesAndDynamicallyRevokesOnMiss() public {
        for (uint64 i = 0; i < 3; ++i) {
            _runFullCompetitiveRound(BASE_EPOCH + i, 8000, 4000, 610e8);
        }

        assertTrue(core.isVerifiedForecaster(alice));
        assertTrue(core.getEffectiveProfile(alice).isVerified);
        assertFalse(core.isVerifiedForecaster(bob));

        // Alice commits to round 4 and SKIPS reveal -> revoked immediately once revealEnd passes!
        uint64 e4 = BASE_EPOCH + 3;
        vm.warp(uint256(e4) * core.EPOCH_DURATION() + 10);
        bytes32 cA4 = core.computeCommitment(0, e4, 0, alice, 8000, bytes32(uint256(77)));
        vm.prank(alice);
        uint64 r4 = core.commitEpoch{value: 0.001 ether}(0, e4, 0, cA4);
        bytes32 cB4 = core.computeCommitment(0, e4, 0, bob, 5000, bytes32(uint256(88)));
        vm.prank(bob);
        core.commit{value: 0.001 ether}(r4, cB4);

        ReckonCore.Round memory r = core.getRound(r4);
        (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, e4 * 10 + 1, r.commitEnd, 600e8, 601e8);
        (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, e4 * 10 + 5, r.resolveTime, 610e8, 611e8);
        vm.warp(r.resolveTime + 60);
        core.fixAndSettleOracle(r4, s1, s2, e1, e2);
        vm.prank(bob);
        core.reveal(r4, 5000, bytes32(uint256(88)));

        vm.warp(r.revealEnd + 1);
        assertFalse(core.isVerifiedForecaster(alice));
    }

    // -------------------------------------------------------------------------
    // Reentrancy & Force-Sent BNB Isolation
    // -------------------------------------------------------------------------

    function test_ReentrancyBlockedAndForceSentBNBDoesNotCorruptPool() public {
        ReentrantAgent attacker = new ReentrantAgent(core);
        agentId.mint(address(attacker), "reenter");
        vm.deal(address(attacker), 1 ether);

        uint64 epoch = BASE_EPOCH;
        uint64 rId = core.createRound(0, epoch, 1); // 0.005 BNB
        bytes32 sAtt = bytes32(uint256(11));
        bytes32 sAlice = bytes32(uint256(22));

        {
            bytes32 cAtt = core.computeCommitment(0, epoch, 1, address(attacker), 8000, sAtt);
            bytes32 cAlice = core.computeCommitment(0, epoch, 1, alice, 2000, sAlice);
            attacker.commit{value: 0.005 ether}(rId, cAtt);
            vm.prank(alice);
            core.commit{value: 0.005 ether}(rId, cAlice);
        }

        vm.deal(address(core), address(core).balance + 5 ether);

        {
            ReckonCore.Round memory r = core.getRound(rId);
            (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, 10, r.commitEnd, 600e8, 601e8);
            (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, 20, r.resolveTime, 610e8, 611e8);
            vm.warp(r.resolveTime + 60);
            core.fixAndSettleOracle(rId, s1, s2, e1, e2);
        }

        attacker.reveal(rId, 8000, sAtt);
        vm.prank(alice);
        core.reveal(rId, 2000, sAlice);
        vm.warp(core.getRound(rId).revealEnd + 1);

        vm.expectRevert(ReckonCore.TransferFailed.selector);
        attacker.attackClaim(rId, true, false);

        uint256 aliceBefore = alice.balance;
        uint256 expectedAlice = core.previewPayout(rId, alice);
        vm.prank(alice);
        core.claim(rId);
        assertEq(alice.balance - aliceBefore, expectedAlice);

        uint256 attBefore = address(attacker).balance;
        attacker.attackClaim(rId, false, false);
        assertEq((alice.balance - aliceBefore) + (address(attacker).balance - attBefore), 0.01 ether);
        assertEq(core.getRound(rId).remainingPool, 0);
        assertEq(address(core).balance, 5 ether);
    }

    // =========================================================================
    // AUDIT REGRESSION TESTS ([C-1], [H-1], [M-1], [M-2], [L-1], [L-2], [L-3])
    // =========================================================================

    /// @notice [C-1] Proves offline-computed commitments survive arbitrary front-run `createRound` calls
    ///         and concurrent `commitEpoch` calls across any feed/tier in the same block.
    function test_Regression_C1_ConcurrentAndFrontRunCommitEpochInvariance() public {
        uint64 epoch = BASE_EPOCH;
        bytes32 saltA = keccak256("alice-offline-salt");
        bytes32 saltB = keccak256("bob-offline-salt");

        // Alice & Bob compute commitments offline when nextRoundId == 0 (expecting BNB/USD, epoch, tier 2)
        assertEq(core.nextRoundId(), 0);
        bytes32 commAlice = core.computeCommitment(0, epoch, 2, alice, 8200, saltA);
        bytes32 commBob = core.computeCommitment(0, epoch, 2, bob, 3500, saltB);

        // Griefer without an Agent ID front-runs 5 `createRound` calls across other slots to shift nextRoundId!
        vm.startPrank(noIdUser);
        core.createRound(1, epoch, 0);
        core.createRound(1, epoch, 1);
        core.createRound(1, epoch, 2);
        core.createRound(2, epoch, 0);
        core.createRound(2, epoch, 1);
        vm.stopPrank();
        assertEq(core.nextRoundId(), 5);

        // Bob ALSO lands `commitEpoch` on (0, epoch, 2) before Alice, assigning roundId = 6 (not 1!)
        vm.prank(bob);
        uint64 rIdBob = core.commitEpoch{value: 0.01 ether}(0, epoch, 2, commBob);
        assertEq(rIdBob, 6);

        // Alice's `commitEpoch` lands right behind Bob into roundId = 6
        vm.prank(alice);
        uint64 rIdAlice = core.commitEpoch{value: 0.01 ether}(0, epoch, 2, commAlice);
        assertEq(rIdAlice, 6);

        // Settle & verify BOTH Alice and Bob reveal cleanly with zero `InvalidReveal`!
        _settleCompetitiveBnb(6, epoch, 615e8);

        vm.prank(alice);
        core.reveal(6, 8200, saltA);
        vm.prank(bob);
        core.reveal(6, 3500, saltB);

        vm.warp(core.getRound(6).revealEnd + 1);
        vm.prank(alice);
        core.claim(6);
        vm.prank(bob);
        core.claim(6);
        assertEq(core.getRound(6).remainingPool, 0);
    }

    function _prankCommitEpoch(
        address user,
        uint8 feedId,
        uint64 ep,
        uint8 tierId,
        uint16 prob,
        bytes32 salt
    ) internal returns (uint64) {
        uint128 st = core.stakeForTier(tierId);
        bytes32 comm = core.computeCommitment(feedId, ep, tierId, user, prob, salt);
        vm.prank(user);
        return core.commitEpoch{value: st}(feedId, ep, tierId, comm);
    }

    function _prankCommit(
        address user,
        uint64 rId,
        uint8 feedId,
        uint64 ep,
        uint8 tierId,
        uint16 prob,
        bytes32 salt
    ) internal {
        uint128 st = core.stakeForTier(tierId);
        bytes32 comm = core.computeCommitment(feedId, ep, tierId, user, prob, salt);
        vm.prank(user);
        core.commit{value: st}(rId, comm);
    }

    /// @notice [H-1] Proves healthy Chainlink feeds CANNOT be cancelled at +2h (blocking non-reveal score dodging
    ///         and protecting delayed settlements up to 7 days), while real halts & >30m gaps cancel cleanly.
    function test_Regression_H1_HealthyFeedRejectsCancel_RealHaltAndGapCancelCleanly() public {
        // --- Part 1: Healthy Chainlink feed rejects cancellation at +2h and settles cleanly 3 days later ---
        {
            uint64 ep1 = BASE_EPOCH;
            bytes32 sA = bytes32(uint256(1));
            bytes32 sB = bytes32(uint256(2));
            uint64 r1 = _prankCommitEpoch(alice, 0, ep1, 0, 8500, sA);
            _prankCommit(bob, r1, 0, ep1, 0, 2500, sB);

            ReckonCore.Round memory rd1 = core.getRound(r1);
            (uint80 k1, uint80 k2) = _setHistoricalBracket(bnbFeed, 1, 10, rd1.commitEnd, 600e8, 601e8);
            (uint80 m1, uint80 m2) = _setHistoricalBracket(bnbFeed, 1, 20, rd1.resolveTime, 610e8, 611e8);

            vm.warp(rd1.resolveTime + 60);
            vm.prank(alice);
            core.reveal(r1, 8500, sA);
            vm.prank(bob);
            core.reveal(r1, 2500, sB);

            vm.warp(rd1.resolveTime + 1 hours + 30 minutes);
            vm.expectRevert(ReckonCore.GracePeriodNotElapsed.selector);
            core.cancelUnsettleableRound(r1);

            vm.warp(rd1.resolveTime + core.ORACLE_HALT_GRACE() + 10);
            vm.expectRevert(ReckonCore.OracleStillHealthy.selector);
            core.cancelUnsettleableRound(r1);

            vm.expectRevert(ReckonCore.OracleBracketValid.selector);
            core.cancelOracleGap(r1, false, m1, m2);

            vm.expectRevert(ReckonCore.InsufficientOracleCheckGas.selector);
            core.cancelUnsettleableRound{gas: 60_000}(r1);

            vm.warp(rd1.resolveTime + 3 days);
            assertEq(uint8(core.roundState(r1)), uint8(ReckonCore.RoundState.AWAITING_ORACLE));
            core.fixAndSettleOracle(r1, k1, k2, m1, m2);
            assertEq(uint8(core.roundState(r1)), uint8(ReckonCore.RoundState.CLAIMABLE));
            vm.prank(alice);
            core.claim(r1);
            vm.prank(bob);
            core.claim(r1);
            assertEq(core.getRound(r1).remainingPool, 0);
        }

        // --- Part 2: Historical >30m staleness gap cancels immediately via `cancelOracleGap` ---
        {
            uint64 ep2 = BASE_EPOCH + 20;
            vm.warp(uint256(ep2) * core.EPOCH_DURATION() + 10);
            uint64 r2 = _prankCommitEpoch(alice, 1, ep2, 0, 7500, bytes32(uint256(3)));
            ReckonCore.Round memory rd2 = core.getRound(r2);

            uint80 g1 = btcFeed.makeRoundId(1, 50);
            uint80 g2 = btcFeed.makeRoundId(1, 51);
            btcFeed.setRound(g1, 65000e8, rd2.commitEnd - 40 minutes);
            btcFeed.setRound(g2, 65100e8, rd2.commitEnd + 5 minutes);

            vm.warp(rd2.commitEnd + 6 minutes);
            core.cancelOracleGap(r2, true, g1, g2);
            assertEq(uint8(core.roundState(r2)), uint8(ReckonCore.RoundState.CANCELLED_ORACLE));

            uint256 aBefore = alice.balance;
            vm.prank(alice);
            core.claimRefund(r2);
            assertEq(alice.balance - aBefore, 0.001 ether);
        }

        // --- Part 3: Live feed revert cancels cleanly at +2h via `cancelUnsettleableRound` ---
        {
            uint64 ep3 = BASE_EPOCH + 21;
            vm.warp(uint256(ep3) * core.EPOCH_DURATION() + 10);
            uint64 r3 = _prankCommitEpoch(alice, 2, ep3, 0, 7500, bytes32(uint256(4)));
            ReckonCore.Round memory rd3 = core.getRound(r3);
            ethFeed.setRevertLatest(true);

            vm.warp(rd3.resolveTime + core.ORACLE_HALT_GRACE() + 1);
            core.cancelUnsettleableRound(r3);
            assertEq(uint8(core.roundState(r3)), uint8(ReckonCore.RoundState.CANCELLED_ORACLE));
        }

        // --- Part 4: 7-day emergency fallback guarantees zero permanently trapped funds ---
        {
            uint64 ep4 = BASE_EPOCH + 22;
            vm.warp(uint256(ep4) * core.EPOCH_DURATION() + 10);
            uint64 r4 = _prankCommitEpoch(alice, 0, ep4, 0, 7500, bytes32(uint256(5)));
            ReckonCore.Round memory rd4 = core.getRound(r4);
            bnbFeed.setRound(bnbFeed.makeRoundId(1, 999), 600e8, rd4.resolveTime + 10);

            vm.warp(rd4.resolveTime + core.EMERGENCY_CANCEL_DELAY());
            assertEq(uint8(core.roundState(r4)), uint8(ReckonCore.RoundState.CANCELLED_ORACLE));
            vm.prank(alice);
            core.claimRefund(r4);
        }
    }

    function _commitAllNineSlots(address user, uint64 ep, uint256 saltBase) internal {
        vm.warp(uint256(ep) * core.EPOCH_DURATION() + 10);
        for (uint8 f = 0; f < 3; ++f) {
            for (uint8 t = 0; t < 3; ++t) {
                _prankCommitEpoch(user, f, ep, t, 7000, bytes32(saltBase + f * 10 + t));
            }
        }
    }

    /// @notice [M-1] Proves 27 concurrent pending slots (3 full 9-slot 4h epochs: OPEN+LOCKED+REVEAL)
    ///         work across AWAITING_ORACLE AND missed reveals revoke Verified Forecaster immediately
    ///         at `revealEnd` BEFORE `settleOracle()`.
    function test_Regression_M1_TwentySevenPendingSlotsAndImmediatePostRevealEndRevocation() public {
        for (uint64 i = 0; i < 3; ++i) {
            _runFullCompetitiveRound(BASE_EPOCH + i, 8500, 3500, 615e8);
        }
        assertTrue(core.isVerifiedForecaster(alice));

        {
            uint64 epMiss = BASE_EPOCH + 3;
            vm.warp(uint256(epMiss) * core.EPOCH_DURATION() + 10);
            uint64 rMiss = _prankCommitEpoch(alice, 0, epMiss, 0, 8500, bytes32(uint256(777)));
            ReckonCore.Round memory rdMiss = core.getRound(rMiss);

            vm.warp(rdMiss.revealEnd - 1);
            assertTrue(core.isVerifiedForecaster(alice));

            vm.warp(rdMiss.revealEnd);
            assertEq(uint8(core.roundState(rMiss)), uint8(ReckonCore.RoundState.AWAITING_ORACLE));
            assertFalse(core.isVerifiedForecaster(alice));
            IReckonCore.EffectiveProfile memory eff = core.getEffectiveProfile(alice);
            assertEq(eff.roundsScored, 4);
            assertEq(eff.roundsMissed, 1);
            assertEq(eff.revealRateBps, 7500);
            assertFalse(eff.isVerified);
        }

        uint64 epA = BASE_EPOCH + 10;
        _commitAllNineSlots(carol, epA, 1);
        assertEq(core.getPendingRounds(carol).length, 9);

        uint64 epB = epA + 1;
        _commitAllNineSlots(carol, epB, 100);
        assertEq(core.getPendingRounds(carol).length, 18);

        uint64 epC = epA + 2;
        _commitAllNineSlots(carol, epC, 200);
        assertEq(core.getPendingRounds(carol).length, 27);

        vm.warp(uint256(epC) * core.EPOCH_DURATION() + 8 days);
        uint64 epD = core.currentEpochId();
        _prankCommitEpoch(carol, 0, epD, 0, 7000, bytes32(uint256(999)));
        assertEq(core.getPendingRounds(carol).length, 1);
    }

    /// @notice Proves 24/7 zero-blackout commit availability, 2-of-3 skilled verification (0.7600 gate),
    ///         and post-gap phase-rollover cancellation.
    function test_ZeroBlackout24x7_SkilledTwoOfThreeVerification_AndPostGapRolloverCancel() public {
        // 1. Sample every 30 minutes across a full 24-hour UTC day: EVERY timestamp has an OPEN epoch!
        uint256 dayStart = uint256(BASE_EPOCH + 50) * core.EPOCH_DURATION();
        for (uint256 step = 0; step < 48; ++step) {
            uint256 ts = dayStart + step * 30 minutes;
            vm.warp(ts);
            uint64 ep = core.currentEpochId();
            uint64 openTime = ep * core.EPOCH_DURATION();
            uint64 commitEnd = openTime + core.COMMIT_DURATION();
            assertGe(ts, openTime);
            assertLt(ts, commitEnd);
        }

        // 2. Skilled forecaster going 2-of-3 at 67% (meanBrier ~0.7778 >= 0.7600) qualifies!
        _runFullCompetitiveRound(BASE_EPOCH + 100, 6700, 5000, 610e8); // hit (0.8911)
        _runFullCompetitiveRound(BASE_EPOCH + 101, 6700, 5000, 610e8); // hit (0.8911)
        _runFullCompetitiveRound(BASE_EPOCH + 102, 6700, 5000, 590e8); // miss (0.5511)
        IReckonCore.EffectiveProfile memory pAlice = core.getEffectiveProfile(alice);
        assertEq(pAlice.competitiveRoundsScored, 3);
        assertGe(pAlice.meanBrier, core.MIN_VERIFIED_BRIER());
        assertTrue(core.isVerifiedForecaster(alice));
        // Bob played 50% coin-flip on all 3 -> meanBrier 0.7500 -> still strictly blocked!
        assertFalse(core.isVerifiedForecaster(bob));

        // 3. cancelOracleGap still works even after Chainlink later rolls over to a newer phase
        uint64 epGap = BASE_EPOCH + 120;
        vm.warp(uint256(epGap) * core.EPOCH_DURATION() + 10);
        uint64 rGap = _prankCommitEpoch(carol, 1, epGap, 0, 7000, bytes32(uint256(404)));
        ReckonCore.Round memory rd = core.getRound(rGap);

        uint80 g1 = btcFeed.makeRoundId(1, 500);
        uint80 g2 = btcFeed.makeRoundId(1, 501);
        btcFeed.setRound(g1, 65000e8, rd.commitEnd - 45 minutes);
        btcFeed.setRound(g2, 65100e8, rd.commitEnd + 5 minutes);
        // Feed rolls over to phase 2 AFTER the gap!
        btcFeed.setRound(btcFeed.makeRoundId(2, 1), 65200e8, rd.commitEnd + 20 minutes);

        vm.warp(rd.commitEnd + 25 minutes);
        core.cancelOracleGap(rGap, true, g1, g2);
        assertEq(uint8(core.roundState(rGap)), uint8(ReckonCore.RoundState.CANCELLED_ORACLE));
    }

    /// @notice [M-2] & [L-4] Proves `_agents` deduplication and overflow-safe `getAgents(offset, limit)`.
    function test_Regression_M2_AgentPaginationAndOverflowSafety() public {
        uint64 ep = BASE_EPOCH;
        uint64 rId = _prankCommitEpoch(alice, 0, ep, 0, 7000, bytes32(uint256(1)));
        _prankCommit(bob, rId, 0, ep, 0, 6000, bytes32(uint256(2)));
        _prankCommit(carol, rId, 0, ep, 0, 5000, bytes32(uint256(3)));

        // Alice commits to a second round -> must NOT duplicate in `_agents`
        _prankCommitEpoch(alice, 0, ep, 1, 7000, bytes32(uint256(4)));

        assertEq(core.agentCount(), 3);
        address[] memory page1 = core.getAgents(0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0], alice);
        assertEq(page1[1], bob);

        // Overflow-safe with limit = type(uint256).max
        address[] memory page2 = core.getAgents(1, type(uint256).max);
        assertEq(page2.length, 2);
        assertEq(page2[0], bob);
        assertEq(page2[1], carol);

        assertEq(core.getAgents(5, 10).length, 0);
        assertEq(core.getAgents(0, 0).length, 0);
    }

    /// @notice [L-1] Proves per-epoch competitive deduplication blocks single-epoch 3-tier farming AND
    ///         maintains exact view == storage parity under out-of-order multi-epoch oracle settlements.
    function test_Regression_L1_SameEpochMultiTierDedupAndOutOfOrderSettlementParity() public {
        // 1. Alice & Bob play ALL 3 tiers (0, 1, 2) in the SAME Epoch E and Alice gets 99% right on all 3!
        {
            uint64 ep0 = BASE_EPOCH;
            uint64[3] memory rIds0;
            for (uint8 t = 0; t < 3; ++t) {
                rIds0[t] = _prankCommitEpoch(alice, 0, ep0, t, 9900, bytes32(uint256(t + 1)));
                _prankCommit(bob, rIds0[t], 0, ep0, t, 2000, bytes32(uint256(t + 11)));
            }

            ReckonCore.Round memory rd0 = core.getRound(rIds0[0]);
            (uint80 s1, uint80 s2) = _setHistoricalBracket(bnbFeed, 1, 10, rd0.commitEnd, 600e8, 601e8);
            (uint80 e1, uint80 e2) = _setHistoricalBracket(bnbFeed, 1, 20, rd0.resolveTime, 620e8, 621e8);
            vm.warp(rd0.resolveTime + 60);
            for (uint8 t = 0; t < 3; ++t) {
                core.fixAndSettleOracle(rIds0[t], s1, s2, e1, e2);
                vm.prank(alice);
                core.reveal(rIds0[t], 9900, bytes32(uint256(t + 1)));
                vm.prank(bob);
                core.reveal(rIds0[t], 2000, bytes32(uint256(t + 11)));
            }
            vm.warp(rd0.revealEnd + 1);

            IReckonCore.EffectiveProfile memory pView0 = core.getEffectiveProfile(alice);
            assertEq(pView0.roundsScored, 3);
            assertEq(pView0.meanBrier, 99_990_000);
            assertEq(pView0.competitiveRoundsScored, 1);
            assertFalse(pView0.isVerified);
            assertFalse(core.isVerifiedForecaster(alice));

            core.flushAgent(alice);
            assertEq(core.getEffectiveProfile(alice).competitiveRoundsScored, 1);
        }

        // 2. Out-of-order settlement across Epoch +1 and Epoch +2:
        uint64 rEp1;
        uint64 rEp2;
        {
            uint64 ep1 = BASE_EPOCH + 1;
            vm.warp(uint256(ep1) * core.EPOCH_DURATION() + 10);
            rEp1 = _prankCommitEpoch(alice, 0, ep1, 0, 9000, bytes32(uint256(51)));
            _prankCommit(bob, rEp1, 0, ep1, 0, 3000, bytes32(uint256(52)));
            ReckonCore.Round memory rd1 = core.getRound(rEp1);
            vm.warp(rd1.resolveTime + 60);
            vm.prank(alice);
            core.reveal(rEp1, 9000, bytes32(uint256(51)));
            vm.prank(bob);
            core.reveal(rEp1, 3000, bytes32(uint256(52)));

            uint64 ep2 = BASE_EPOCH + 2;
            vm.warp(uint256(ep2) * core.EPOCH_DURATION() + 10);
            rEp2 = _prankCommitEpoch(alice, 0, ep2, 0, 9000, bytes32(uint256(61)));
            _prankCommit(bob, rEp2, 0, ep2, 0, 3000, bytes32(uint256(62)));
            ReckonCore.Round memory rd2 = core.getRound(rEp2);
            vm.warp(rd2.resolveTime + 60);
            vm.prank(alice);
            core.reveal(rEp2, 9000, bytes32(uint256(61)));
            vm.prank(bob);
            core.reveal(rEp2, 3000, bytes32(uint256(62)));
            vm.warp(rd2.revealEnd + 1);
        }

        // Settle & flush LATER epoch (ep2) BEFORE earlier epoch (ep1)!
        {
            ReckonCore.Round memory rd2 = core.getRound(rEp2);
            (uint80 s2a, uint80 s2b) = _setHistoricalBracket(bnbFeed, 1, 200, rd2.commitEnd, 600e8, 601e8);
            (uint80 e2a, uint80 e2b) = _setHistoricalBracket(bnbFeed, 1, 210, rd2.resolveTime, 620e8, 621e8);
            core.fixAndSettleOracle(rEp2, s2a, s2b, e2a, e2b);
            core.flushAgent(alice);
            assertEq(core.getEffectiveProfile(alice).competitiveRoundsScored, 2);
        }

        // Now settle EARLIER epoch (ep1) out of order!
        {
            ReckonCore.Round memory rd1 = core.getRound(rEp1);
            (uint80 s1a, uint80 s1b) = _setHistoricalBracket(bnbFeed, 1, 100, rd1.commitEnd, 600e8, 601e8);
            (uint80 e1a, uint80 e1b) = _setHistoricalBracket(bnbFeed, 1, 110, rd1.resolveTime, 620e8, 621e8);
            core.fixAndSettleOracle(rEp1, s1a, s1b, e1a, e1b);
        }

        // View BEFORE flush must equal 3 AND match storage AFTER flush!
        IReckonCore.EffectiveProfile memory beforeFlush = core.getEffectiveProfile(alice);
        assertEq(beforeFlush.competitiveRoundsScored, 3);
        assertTrue(beforeFlush.isVerified);

        core.flushAgent(alice);
        IReckonCore.EffectiveProfile memory afterFlush = core.getEffectiveProfile(alice);
        assertEq(afterFlush.competitiveRoundsScored, 3);
        assertEq(afterFlush.cumulativeBrier, beforeFlush.cumulativeBrier);
        assertTrue(afterFlush.isVerified);
        assertTrue(core.isVerifiedForecaster(alice));
    }

    /// @notice [L-2] Proves empty-returndata / OOG on `priceRoundId + 1` and `uint64.max` boundary revert cleanly.
    function test_Regression_L2_EmptyRevertOrMaxAggIdRejectedInPhaseRollover() public {
        uint64 epoch = BASE_EPOCH;
        uint64 rId = core.createRound(0, epoch, 0);
        ReckonCore.Round memory r = core.getRound(rId);
        vm.warp(r.commitEnd + 60);

        uint80 oldA = bnbFeed.makeRoundId(2, 500);
        uint80 oldB = bnbFeed.makeRoundId(2, 501);
        uint80 nextPhaseFirst = bnbFeed.makeRoundId(3, 1);

        bnbFeed.setRound(oldA, 600e8, r.commitEnd - 10);
        bnbFeed.setRound(nextPhaseFirst, 605e8, r.commitEnd + 10);
        bnbFeed.setEmptyRevertRound(oldB, true);

        vm.expectRevert(ReckonCore.InvalidNextOracleRound.selector);
        core.fixStrike(rId, oldA, nextPhaseFirst);

        uint80 maxAgg = bnbFeed.makeRoundId(2, type(uint64).max);
        bnbFeed.setRound(maxAgg, 600e8, r.commitEnd - 10);
        vm.expectRevert(ReckonCore.InvalidOracleRound.selector);
        core.fixStrike(rId, maxAgg, nextPhaseFirst);
    }

    /// @notice [L-3] Proves `claimablePayout` returns exact live claimable wei (including final-claimer dust
    ///         and refunds, dropping to 0 post-claim) while `previewPayout` preserves historical WSWM winnings.
    function test_Regression_L3_PreviewPayoutVsClaimablePayoutExactSemantics() public {
        uint64 epoch = BASE_EPOCH;
        uint64 rId = core.createRound(0, epoch, 0); // 0.001 ether

        bytes32 sA = bytes32(uint256(1));
        bytes32 sB = bytes32(uint256(2));
        bytes32 sC = bytes32(uint256(3));

        // 3 players with probabilities chosen to produce 1-wei floor truncation dust across N=3:
        _prankCommit(alice, rId, 0, epoch, 0, 7777, sA);
        _prankCommit(bob, rId, 0, epoch, 0, 5555, sB);
        _prankCommit(carol, rId, 0, epoch, 0, 3333, sC);

        assertEq(core.claimablePayout(rId, alice), 0); // Still OPEN

        _settleCompetitiveBnb(rId, epoch, 610e8);
        vm.prank(alice);
        core.reveal(rId, 7777, sA);
        vm.prank(bob);
        core.reveal(rId, 5555, sB);
        vm.prank(carol);
        core.reveal(rId, 3333, sC);
        vm.warp(core.getRound(rId).revealEnd + 1);

        uint256 histAlice = core.previewPayout(rId, alice);
        uint256 histCarol = core.previewPayout(rId, carol);
        assertEq(core.claimablePayout(rId, alice), histAlice);

        // Alice & Bob claim first
        vm.prank(alice);
        core.claim(rId);
        assertEq(core.claimablePayout(rId, alice), 0, "Claimable must drop to 0 after claim");
        assertEq(core.previewPayout(rId, alice), histAlice, "Historical preview preserved post-claim");

        vm.prank(bob);
        core.claim(rId);

        // Carol is now the final claimer: claimablePayout MUST equal exact remainingPool!
        uint128 rem = core.getRound(rId).remainingPool;
        assertEq(core.claimablePayout(rId, carol), rem);
        assertGe(rem, histCarol);

        uint256 cBefore = carol.balance;
        vm.prank(carol);
        core.claim(rId);
        assertEq(carol.balance - cBefore, rem);
        assertEq(core.claimablePayout(rId, carol), 0);
    }
}
