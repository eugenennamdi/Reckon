// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAgentID} from "../../src/interfaces/IAgentID.sol";

/// @notice Test-only extension matching HandleRegistry's forward lookup (used strictly in fork/unit tests;
///         omitted from `src/interfaces/IAgentID.sol` for strict Red Line #9 compliance).
interface IAgentIDTest is IAgentID {
    function ownerOfHandle(string calldata handle) external view returns (address);
}

/// @notice Minimal faithful mock of SPACE ID Agent ID (HandleRegistry.sol) for unit & invariant tests.
contract MockAgentID is IAgentIDTest {
    mapping(address => string) public override handleOf;
    mapping(bytes32 => address) private _owners;

    error AddressHasHandle();
    error HandleTaken();

    function mint(address to, string calldata handle) external {
        if (bytes(handleOf[to]).length != 0) revert AddressHasHandle();
        bytes32 h = keccak256(bytes(handle));
        if (_owners[h] != address(0)) revert HandleTaken();
        handleOf[to] = handle;
        _owners[h] = to;
    }

    function balanceOf(address owner) external view override returns (uint256) {
        return bytes(handleOf[owner]).length > 0 ? 1 : 0;
    }

    function ownerOfHandle(string calldata handle) external view override returns (address) {
        return _owners[keccak256(bytes(handle))];
    }
}
