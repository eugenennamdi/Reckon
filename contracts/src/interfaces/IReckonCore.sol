// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IReckonCore
/// @notice Read interface consumed by ReckonSignalRegistry and external agent protocols.
interface IReckonCore {
    struct EffectiveProfile {
        bytes32 handleHash;
        uint32 roundsCommitted;
        uint32 roundsRevealed;
        uint32 roundsScored;
        uint32 competitiveRoundsScored;
        uint32 roundsMissed;
        uint64 firstActiveAt;
        uint128 cumulativeBrier;
        uint128 totalVolumeWei;
        uint256 meanBrier;      // scaled 1e8 (0..99_990_000)
        uint256 revealRateBps;  // scaled 1e4 (0..10_000)
        bool isVerified;        // live Verified Forecaster gate status
        uint64[10] bucketCounts;
        uint64[10] bucketHits;
    }

    function AGENT_ID() external view returns (address);

    function getEffectiveProfile(address agent) external view returns (EffectiveProfile memory);

    function isVerifiedForecaster(address agent) external view returns (bool);

    function hasCommitted(uint64 roundId, address agent) external view returns (bool);

    function agentCount() external view returns (uint256);

    function getAgents(uint256 offset, uint256 limit) external view returns (address[] memory);

    function previewPayout(uint64 roundId, address agent) external view returns (uint256);

    function claimablePayout(uint64 roundId, address agent) external view returns (uint256);
}
