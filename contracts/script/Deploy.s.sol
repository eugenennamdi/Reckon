// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ReckonCore} from "../src/ReckonCore.sol";
import {ReckonSignalRegistry} from "../src/ReckonSignalRegistry.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

/// @title Deploy
/// @notice Canonical deployment & post-deploy verification script for ReckonCore & ReckonSignalRegistry
///         on BNB Smart Chain Mainnet (chainId 56).
contract Deploy is Script {
    // Verified BNB Chain Mainnet addresses (chainId = 56)
    address internal constant BSC_AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address internal constant BSC_BNB_USD  = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE;
    address internal constant BSC_BTC_USD  = 0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf;
    address internal constant BSC_ETH_USD  = 0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e;

    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address internal constant BSC_USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
    address internal constant BSC_USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address internal constant BSC_U    = 0xcE24439F2D9C6a2289F741120FE202248B666666;

    function run() external returns (ReckonCore core, ReckonSignalRegistry registry) {
        require(block.chainid == 56, "Deploy.s.sol is pinned to BSC Mainnet (56)");
        require(BSC_AGENT_ID.code.length > 0, "Agent ID contract missing");

        vm.startBroadcast();
        core = new ReckonCore(BSC_AGENT_ID, BSC_BNB_USD, BSC_BTC_USD, BSC_ETH_USD);
        registry = new ReckonSignalRegistry(address(core), BSC_USDT, BSC_USDC, BSC_USD1, BSC_U);
        vm.stopBroadcast();

        // Post-deployment live invariant & wiring smoke checks
        require(core.AGENT_ID() == BSC_AGENT_ID, "Core AGENT_ID mismatch");
        require(address(registry.RECKON_CORE()) == address(core), "Registry RECKON_CORE mismatch");
        require(address(registry.AGENT_ID()) == BSC_AGENT_ID, "Registry AGENT_ID mismatch");
        require(
            registry.isSupportedToken(BSC_USDT) &&
            registry.isSupportedToken(BSC_USDC) &&
            registry.isSupportedToken(BSC_USD1) &&
            registry.isSupportedToken(BSC_U),
            "Supported stablecoin mismatch"
        );

        (, int256 bnbPrice, , uint256 bnbUpdated, ) = IAggregatorV3(BSC_BNB_USD).latestRoundData();
        (, int256 btcPrice, , uint256 btcUpdated, ) = IAggregatorV3(BSC_BTC_USD).latestRoundData();
        (, int256 ethPrice, , uint256 ethUpdated, ) = IAggregatorV3(BSC_ETH_USD).latestRoundData();
        require(bnbPrice > 0 && btcPrice > 0 && ethPrice > 0, "Non-positive live Chainlink price");
        require(bnbUpdated > 0 && btcUpdated > 0 && ethUpdated > 0, "Zero Chainlink updatedAt");

        console2.log("ReckonCore deployed & verified at:", address(core));
        console2.log("ReckonSignalRegistry deployed & verified at:", address(registry));
    }
}
