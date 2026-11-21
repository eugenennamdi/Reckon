// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAgentID
/// @notice Minimal verified interface for SPACE ID Agent ID (HandleRegistry) on BNB Smart Chain Mainnet:
///         0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F (ERC-721, strictly soulbound & non-burnable).
/// @dev Red Line #9 compliance: intentionally omits forward `handle -> address` resolution selectors;
///      Reckon contracts strictly verify `msg.sender` ownership and reverse-resolve opt-in participant handles.
interface IAgentID {
    /// @notice Returns 1 if `owner` holds an Agent ID, 0 otherwise.
    function balanceOf(address owner) external view returns (uint256);

    /// @notice Returns the bare lowercase alphanumeric handle (without ".ai") bound to `owner`, or "" if none.
    function handleOf(address owner) external view returns (string memory);
}
