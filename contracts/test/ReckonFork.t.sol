// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReckonCore} from "../src/ReckonCore.sol";
import {ReckonSignalRegistry} from "../src/ReckonSignalRegistry.sol";
import {IAgentID} from "../src/interfaces/IAgentID.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IAgentIDTest} from "./mocks/MockAgentID.sol";

/// @title ReckonForkTest
/// @notice End-to-end integration test running against LIVE BNB Smart Chain Mainnet state:
///         - Real SPACE ID Agent ID contract (0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F)
///         - Real Agent ID holders ("alice", "satoshi")
///         - Real 18-decimal BSC stablecoins (USDT, USDC, USD1, U) verified in ReckonSignalRegistry constructor
///         - Real Chainlink BNB/USD, BTC/USD, ETH/USD 8-decimal proxies and historical `getRoundData`
///         Run via: forge test --match-path test/ReckonFork.t.sol --fork-url https://bsc-dataseed.binance.org/ -vv
contract ReckonForkTest is Test {
    address internal constant BSC_AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address internal constant BSC_BNB_USD  = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE;
    address internal constant BSC_BTC_USD  = 0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf;
    address internal constant BSC_ETH_USD  = 0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e;

    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address internal constant BSC_USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
    address internal constant BSC_USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address internal constant BSC_U    = 0xcE24439F2D9C6a2289F741120FE202248B666666;

    ReckonCore internal core;
    ReckonSignalRegistry internal registry;

    function setUp() public {
        // Skip gracefully when running offline unit tests without --fork-url
        if (block.chainid != 56) return;
        core = new ReckonCore(BSC_AGENT_ID, BSC_BNB_USD, BSC_BTC_USD, BSC_ETH_USD);
        registry = new ReckonSignalRegistry(address(core), BSC_USDT, BSC_USDC, BSC_USD1, BSC_U);
    }

    function testFork_LiveAgentIDAndHistoricalChainlinkSettlement() public {
        if (block.chainid != 56) return;

        // 1. Resolve two real live Agent ID holders on BSC Mainnet
        address alice = IAgentIDTest(BSC_AGENT_ID).ownerOfHandle("alice");
        address satoshi = IAgentIDTest(BSC_AGENT_ID).ownerOfHandle("satoshi");
        assertTrue(alice != address(0), "alice.ai should exist on mainnet");
        assertTrue(satoshi != address(0), "satoshi.ai should exist on mainnet");
        assertEq(IAgentID(BSC_AGENT_ID).balanceOf(alice), 1);
        assertEq(IAgentID(BSC_AGENT_ID).handleOf(alice), "alice");

        // 2. Fetch real live Chainlink historical round from BNB/USD proxy
        uint80 latestId;
        uint64 epoch;
        {
            uint256 prevUpdatedAt;
            (latestId, , , , ) = IAggregatorV3(BSC_BNB_USD).latestRoundData();
            (, int256 prevAns, , uint256 uAt, ) = IAggregatorV3(BSC_BNB_USD).getRoundData(latestId - 1);
            assertGt(prevAns, 0);
            prevUpdatedAt = uAt;
            // With 4h COMMIT + 4h OBSERVE (8h = 2 epochs), step back 2 full epochs so resolveTime < latest.
            epoch = uint64(prevUpdatedAt / core.EPOCH_DURATION()) - 2;
        }

        // 3. Rewind EVM clock to `openTime + 60` (historical Chainlink storage remains readable at current fork state!)
        vm.deal(alice, 1 ether);
        vm.deal(satoshi, 1 ether);
        vm.warp(uint256(epoch) * core.EPOCH_DURATION() + 60);

        {
            address nonHolder = makeAddr("freshWalletWithoutAgentID");
            assertEq(IAgentID(BSC_AGENT_ID).balanceOf(nonHolder), 0);
            vm.deal(nonHolder, 1 ether);
            bytes32 commNoId = core.computeCommitment(0, epoch, 0, nonHolder, 5000, bytes32(uint256(3)));
            vm.prank(nonHolder);
            vm.expectRevert(ReckonCore.NoAgentID.selector);
            core.commitEpoch{value: 0.002 ether}(0, epoch, 0, commNoId);
        }

        uint64 rId;
        {
            bytes32 cAlice = core.computeCommitment(0, epoch, 0, alice, 8500, bytes32(uint256(1)));
            vm.prank(alice);
            rId = core.commitEpoch{value: 0.002 ether}(0, epoch, 0, cAlice);
            assertEq(rId, 1);

            bytes32 cSatoshi = core.computeCommitment(0, epoch, 0, satoshi, 2500, bytes32(uint256(2)));
            vm.prank(satoshi);
            core.commit{value: 0.002 ether}(rId, cSatoshi);
        }

        assertEq(core.agentCount(), 2);
        address[] memory agents = core.getAgents(0, 10);
        assertEq(agents[0], alice);
        assertEq(agents[1], satoshi);

        // 4. Advance to REVEAL, verify healthy Chainlink feed CANNOT be cancelled at +2h, then settle, reveal & claim!
        ReckonCore.Round memory r = core.getRound(rId);
        vm.warp(r.resolveTime + 60);
        vm.prank(alice);
        core.reveal(rId, 8500, bytes32(uint256(1)));
        vm.prank(satoshi);
        core.reveal(rId, 2500, bytes32(uint256(2)));

        vm.warp(r.resolveTime + core.ORACLE_HALT_GRACE() + 10);
        vm.expectRevert(ReckonCore.OracleStillHealthy.selector);
        core.cancelUnsettleableRound(rId);

        _settleForkRound(IAggregatorV3(BSC_BNB_USD), latestId, rId);

        // Advance past the 4-hour REVEAL window so the round enters CLAIMABLE state.
        vm.warp(r.revealEnd + 1);

        uint256 aBefore = alice.balance;
        uint256 sBefore = satoshi.balance;
        vm.prank(alice);
        core.claim(rId);
        vm.prank(satoshi);
        core.claim(rId);

        assertEq((alice.balance - aBefore) + (satoshi.balance - sBefore), 0.004 ether);
        assertEq(core.getRound(rId).remainingPool, 0);
        assertEq(address(core).balance, 0);
        assertEq(core.getEffectiveProfile(alice).competitiveRoundsScored, 1);
        assertTrue(registry.isSupportedToken(BSC_USD1));
    }

    function _settleForkRound(IAggregatorV3 bnbFeed, uint80 latestId, uint64 rId) internal {
        ReckonCore.Round memory r = core.getRound(rId);
        (uint80 strikeR, uint80 strikeNext) = _findBracket(bnbFeed, latestId, r.commitEnd);
        (uint80 resolveR, uint80 resolveNext) = _findBracket(bnbFeed, latestId, r.resolveTime);

        core.fixAndSettleOracle(rId, strikeR, strikeNext, resolveR, resolveNext);

        ReckonCore.Round memory settled = core.getRound(rId);
        assertTrue(settled.strikeFixed);
        assertTrue(settled.oracleSettled);
        assertGt(settled.strikePrice, 0);
        assertGt(settled.settlePrice, 0);
    }

    /// @dev Binary search over real mainnet Chainlink aggregator rounds in the current phase.
    function _findBracket(
        IAggregatorV3 feed,
        uint80 latestId,
        uint64 targetTime
    ) internal view returns (uint80 priceRoundId, uint80 nextRoundId) {
        uint16 phase = uint16(latestId >> 64);
        uint64 hi = uint64(latestId);
        uint64 lo = hi > 5000 ? hi - 5000 : 1;

        while (lo < hi) {
            uint64 mid = lo + (hi - lo + 1) / 2;
            uint80 midId = (uint80(phase) << 64) | uint80(mid);
            (, , , uint256 updatedAt, ) = feed.getRoundData(midId);
            if (updatedAt <= targetTime) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }
        priceRoundId = (uint80(phase) << 64) | uint80(lo);
        nextRoundId = (uint80(phase) << 64) | uint80(lo + 1);
    }
}
