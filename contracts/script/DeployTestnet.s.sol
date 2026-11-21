// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ReckonCore} from "../src/ReckonCore.sol";
import {ReckonSignalRegistry} from "../src/ReckonSignalRegistry.sol";

/// @title DeployTestnet
/// @notice BSC Testnet (chainId 97) deployment script for pre-mainnet dry-run verification.
///         Defaults to official Chainlink BSC Testnet 8-decimal proxies for BNB/USD, BTC/USD, and ETH/USD,
///         while reading testnet Agent ID and 18-decimal stablecoin mock addresses from environment variables.
contract DeployTestnet is Script {
    // Official Chainlink BSC Testnet (chainId = 97) 8-decimal price feed proxies
    address internal constant DEFAULT_TESTNET_BNB_USD = 0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526;
    address internal constant DEFAULT_TESTNET_BTC_USD = 0x5741306c21795FdCBb9b265Ea0255F499DFe515C;
    address internal constant DEFAULT_TESTNET_ETH_USD = 0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7;

    function run() external returns (ReckonCore core, ReckonSignalRegistry registry) {
        require(block.chainid == 97, "DeployTestnet.s.sol is pinned to BSC Testnet (97)");

        address agentId = vm.envAddress("TESTNET_AGENT_ID");
        address bnbUsd  = vm.envOr("TESTNET_BNB_USD", DEFAULT_TESTNET_BNB_USD);
        address btcUsd  = vm.envOr("TESTNET_BTC_USD", DEFAULT_TESTNET_BTC_USD);
        address ethUsd  = vm.envOr("TESTNET_ETH_USD", DEFAULT_TESTNET_ETH_USD);

        address usdt = vm.envAddress("TESTNET_USDT");
        address usdc = vm.envAddress("TESTNET_USDC");
        address usd1 = vm.envAddress("TESTNET_USD1");
        address u    = vm.envAddress("TESTNET_U");

        require(agentId.code.length > 0, "Testnet Agent ID contract missing");

        vm.startBroadcast();
        core = new ReckonCore(agentId, bnbUsd, btcUsd, ethUsd);
        registry = new ReckonSignalRegistry(address(core), usdt, usdc, usd1, u);
        vm.stopBroadcast();

        require(core.AGENT_ID() == agentId, "Core AGENT_ID mismatch");
        require(address(registry.RECKON_CORE()) == address(core), "Registry RECKON_CORE mismatch");

        console2.log("Testnet ReckonCore deployed at:", address(core));
        console2.log("Testnet ReckonSignalRegistry deployed at:", address(registry));
    }
}
