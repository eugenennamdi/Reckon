// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReckonCore} from "../src/ReckonCore.sol";
import {ReckonSignalRegistry, IERC20Decimals} from "../src/ReckonSignalRegistry.sol";
import {MockAgentID} from "./mocks/MockAgentID.sol";
import {MockAggregatorV3} from "./mocks/MockAggregatorV3.sol";

contract MockTokenDecimals is IERC20Decimals {
    uint8 public immutable override decimals;

    constructor(uint8 decimals_) {
        decimals = decimals_;
    }
}

contract ReckonSignalRegistryTest is Test {
    ReckonCore internal core;
    ReckonSignalRegistry internal registry;
    MockAgentID internal agentId;
    MockAggregatorV3 internal bnbFeed;
    MockAggregatorV3 internal btcFeed;
    MockAggregatorV3 internal ethFeed;

    address internal usdt;
    address internal usdc;
    address internal usd1;
    address internal u;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint64 internal constant BASE_EPOCH = 83_100;

    function setUp() public {
        agentId = new MockAgentID();
        bnbFeed = new MockAggregatorV3(8, "BNB / USD");
        btcFeed = new MockAggregatorV3(8, "BTC / USD");
        ethFeed = new MockAggregatorV3(8, "ETH / USD");

        usdt = address(new MockTokenDecimals(18));
        usdc = address(new MockTokenDecimals(18));
        usd1 = address(new MockTokenDecimals(18));
        u = address(new MockTokenDecimals(18));

        core = new ReckonCore(address(agentId), address(bnbFeed), address(btcFeed), address(ethFeed));
        registry = new ReckonSignalRegistry(address(core), usdt, usdc, usd1, u);

        agentId.mint(alice, "alice");
        agentId.mint(bob, "bob");
        vm.deal(alice, 5 ether);
        vm.deal(bob, 5 ether);
    }

    function _qualifyAlice() internal {
        for (uint64 i = 0; i < 3; ++i) {
            uint64 ep = BASE_EPOCH + i;
            vm.warp(uint256(ep) * core.EPOCH_DURATION() + 10);
            bytes32 cA = core.computeCommitment(0, ep, 0, alice, 8500, bytes32(uint256(i + 1)));
            vm.prank(alice);
            uint64 rId = core.commitEpoch{value: 0.002 ether}(0, ep, 0, cA);
            bytes32 cB = core.computeCommitment(0, ep, 0, bob, 4000, bytes32(uint256(i + 101)));
            vm.prank(bob);
            core.commit{value: 0.002 ether}(rId, cB);

            ReckonCore.Round memory r = core.getRound(rId);
            uint80 s1 = bnbFeed.makeRoundId(1, ep * 10 + 1);
            uint80 s2 = bnbFeed.makeRoundId(1, ep * 10 + 2);
            uint80 e1 = bnbFeed.makeRoundId(1, ep * 10 + 5);
            uint80 e2 = bnbFeed.makeRoundId(1, ep * 10 + 6);
            bnbFeed.setRound(s1, 600e8, r.commitEnd - 15);
            bnbFeed.setRound(s2, 601e8, r.commitEnd + 15);
            bnbFeed.setRound(e1, 620e8, r.resolveTime - 15);
            bnbFeed.setRound(e2, 621e8, r.resolveTime + 15);

            vm.warp(r.resolveTime + 60);
            core.fixAndSettleOracle(rId, s1, s2, e1, e2);
            vm.prank(alice);
            core.reveal(rId, 8500, bytes32(uint256(i + 1)));
            vm.prank(bob);
            core.reveal(rId, 4000, bytes32(uint256(i + 101)));
            vm.warp(r.revealEnd + 1);
        }
    }

    function test_ConstructorRejectsZeroAddressOrNon18DecimalToken() public {
        vm.expectRevert(ReckonSignalRegistry.ZeroAddress.selector);
        new ReckonSignalRegistry(address(0), usdt, usdc, usd1, u);

        address bad6Dec = address(new MockTokenDecimals(6));
        vm.expectRevert(ReckonSignalRegistry.InvalidTokenDecimals.selector);
        new ReckonSignalRegistry(address(core), bad6Dec, usdc, usd1, u);
    }

    function test_UnverifiedAgentCannotRegister() public {
        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.NotVerifiedForecaster.selector);
        registry.registerSignal("https://signals.reckon.xyz/alice", 0.25 ether, usd1, "Macro BNB signals");
    }

    function test_VerifiedAgentRegistersUpdatesAndValidatesInputs() public {
        _qualifyAlice();

        // Reject unsupported token
        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.UnsupportedPaymentToken.selector);
        registry.registerSignal("https://signals.reckon.xyz/alice", 0.25 ether, address(0x1234), "bio");

        // Reject non-HTTPS / javascript URLs
        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("http://signals.reckon.xyz/alice", 0.25 ether, usd1, "bio");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("javascript:alert(1)", 0.25 ether, usd1, "bio");

        // [M-3] Reject `@` userinfo phishing, shell metacharacters, XSS delimiters, and empty host
        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("https://binance.com@attacker.tld/signal", 0.25 ether, usd1, "bio");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("https://signals.reckon.xyz/$(whoami)", 0.25 ether, usd1, "bio");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("https://signals.reckon.xyz/`id`", 0.25 ether, usd1, "bio");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("https://signals.reckon.xyz/<script>", 0.25 ether, usd1, "bio");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidEndpointUrl.selector);
        registry.registerSignal("https:///missing-host", 0.25 ether, usd1, "bio");

        // [M-3] Reject ANSI ESC (0x1b) and newline control bytes in bio
        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidBioCharacters.selector);
        registry.registerSignal("https://signals.reckon.xyz/alice", 0.25 ether, usd1, "Spoof \x1b[2J terminal");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidBioCharacters.selector);
        registry.registerSignal("https://signals.reckon.xyz/alice", 0.25 ether, usd1, "Line1\nLine2");

        // Reject out-of-range prices ($0.10 floor, $50.00 ceiling)
        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidPrice.selector);
        registry.registerSignal("https://signals.reckon.xyz/alice", 0.05 ether, usd1, "bio");

        vm.prank(alice);
        vm.expectRevert(ReckonSignalRegistry.InvalidPrice.selector);
        registry.registerSignal("https://signals.reckon.xyz/alice", 51 ether, usd1, "bio");

        // Valid registration (with query params & port)
        vm.prank(alice);
        registry.registerSignal("https://signals.reckon.xyz:8443/v1/alice?feed=bnb", 0.50 ether, usd1, "BNB 6h volatility model");
        assertTrue(registry.isListingActive(alice));
        assertEq(registry.providerCount(), 1);

        // Updating does NOT duplicate providerList entry
        vm.prank(alice);
        registry.registerSignal("https://signals.reckon.xyz/alice/v2", 1 ether, usdt, "Updated bio");
        assertEq(registry.providerCount(), 1);

        // [M-3] Overflow-safe `getProviders(offset, type(uint256).max)` must NOT panic!
        ReckonSignalRegistry.ProviderView[] memory list = registry.getProviders(0, type(uint256).max);
        assertEq(list.length, 1);
        assertEq(list[0].agent, alice);
        assertEq(list[0].handle, "alice");
        assertEq(list[0].paymentToken, usdt);
        assertEq(list[0].priceAtomic, 1 ether);
        assertTrue(list[0].listingActive);
        assertEq(list[0].competitiveRoundsScored, 3);

        // Non-zero offset + type(uint256).max test (qualify Bob too so total == 2)
        for (uint64 k = 10; k < 16; ++k) {
            uint64 ep = BASE_EPOCH + k;
            vm.warp(uint256(ep) * core.EPOCH_DURATION() + 10);
            bytes32 cBob = core.computeCommitment(0, ep, 0, bob, 9500, bytes32(uint256(k)));
            vm.prank(bob);
            uint64 rId = core.commitEpoch{value: 0.002 ether}(0, ep, 0, cBob);
            bytes32 cAli = core.computeCommitment(0, ep, 0, alice, 8500, bytes32(uint256(k + 50)));
            vm.prank(alice);
            core.commit{value: 0.002 ether}(rId, cAli);
            ReckonCore.Round memory r = core.getRound(rId);
            uint80 s1 = bnbFeed.makeRoundId(1, ep * 10 + 1);
            uint80 s2 = bnbFeed.makeRoundId(1, ep * 10 + 2);
            uint80 e1 = bnbFeed.makeRoundId(1, ep * 10 + 5);
            uint80 e2 = bnbFeed.makeRoundId(1, ep * 10 + 6);
            bnbFeed.setRound(s1, 600e8, r.commitEnd - 15);
            bnbFeed.setRound(s2, 601e8, r.commitEnd + 15);
            bnbFeed.setRound(e1, 620e8, r.resolveTime - 15);
            bnbFeed.setRound(e2, 621e8, r.resolveTime + 15);
            vm.warp(r.resolveTime + 60);
            core.fixAndSettleOracle(rId, s1, s2, e1, e2);
            vm.prank(bob);
            core.reveal(rId, 9500, bytes32(uint256(k)));
            vm.prank(alice);
            core.reveal(rId, 8500, bytes32(uint256(k + 50)));
            vm.warp(r.revealEnd + 1);
        }
        vm.prank(bob);
        registry.registerSignal("https://signals.reckon.xyz/bob", 0.50 ether, u, "Bob macro signals");
        assertEq(registry.providerCount(), 2);

        ReckonSignalRegistry.ProviderView[] memory tail = registry.getProviders(1, type(uint256).max);
        assertEq(tail.length, 1);
        assertEq(tail[0].agent, bob);

        // Voluntary deactivation
        vm.prank(alice);
        registry.deactivateSignal();
        assertFalse(registry.isListingActive(alice));
    }

    function test_ListingAutoDeactivatesWhenCalibrationDrops() public {
        _qualifyAlice();

        vm.prank(alice);
        registry.registerSignal("https://signals.reckon.xyz/alice", 0.25 ether, u, "Verified");
        assertTrue(registry.isListingActive(alice));

        // Alice misses a round -> revoked at `revealEnd` EVEN BEFORE `settleOracle()` is called ([M-1])!
        uint64 ep4 = BASE_EPOCH + 3;
        vm.warp(uint256(ep4) * core.EPOCH_DURATION() + 10);
        bytes32 cA4 = core.computeCommitment(0, ep4, 0, alice, 8500, bytes32(uint256(99)));
        vm.prank(alice);
        uint64 r4 = core.commitEpoch{value: 0.002 ether}(0, ep4, 0, cA4);
        bytes32 cB4 = core.computeCommitment(0, ep4, 0, bob, 5000, bytes32(uint256(100)));
        vm.prank(bob);
        core.commit{value: 0.002 ether}(r4, cB4);

        ReckonCore.Round memory r = core.getRound(r4);
        vm.warp(r.resolveTime + 60);
        vm.prank(bob);
        core.reveal(r4, 5000, bytes32(uint256(100)));

        // Warp past revealEnd WITHOUT settling oracle yet -> STILL revoked immediately!
        vm.warp(r.revealEnd + 1);
        assertFalse(registry.isListingActive(alice));
    }
}
