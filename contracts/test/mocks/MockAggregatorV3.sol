// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";

/// @notice Mock Chainlink AggregatorV3 supporting multi-phase historical `getRoundData`, phase rollovers,
///         simulated oracle halts, and empty-returndata / OOG fault injection for adversarial tests.
contract MockAggregatorV3 is IAggregatorV3 {
    struct RoundData {
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
        bool exists;
    }

    uint8 public immutable override decimals;
    string public override description;
    uint80 public latestId;
    bool public revertLatest;

    mapping(uint80 => RoundData) private _rounds;
    mapping(uint80 => bool) private _emptyRevertRound;

    error RoundDoesNotExist();
    error FeedPaused();

    constructor(uint8 decimals_, string memory description_) {
        decimals = decimals_;
        description = description_;
    }

    function makeRoundId(uint16 phaseId, uint64 aggRoundId) public pure returns (uint80) {
        return (uint80(phaseId) << 64) | uint80(aggRoundId);
    }

    function setRevertLatest(bool revert_) external {
        revertLatest = revert_;
    }

    function setEmptyRevertRound(uint80 roundId, bool emptyRevert_) external {
        _emptyRevertRound[roundId] = emptyRevert_;
    }

    function setRound(
        uint80 roundId,
        int256 answer,
        uint256 updatedAt
    ) external {
        _rounds[roundId] = RoundData({
            answer: answer,
            startedAt: updatedAt,
            updatedAt: updatedAt,
            answeredInRound: roundId,
            exists: true
        });
        if (roundId >= latestId) {
            latestId = roundId;
        }
    }

    function setRoundCustom(
        uint80 roundId,
        int256 answer,
        uint256 updatedAt,
        uint80 answeredInRound
    ) external {
        _rounds[roundId] = RoundData({
            answer: answer,
            startedAt: updatedAt,
            updatedAt: updatedAt,
            answeredInRound: answeredInRound,
            exists: true
        });
        if (roundId >= latestId) {
            latestId = roundId;
        }
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        if (_emptyRevertRound[_roundId]) {
            // Simulates empty-returndata revert (identical to EVM Out-Of-Gas or barren target revert)
            assembly {
                revert(0, 0)
            }
        }
        RoundData storage d = _rounds[_roundId];
        if (!d.exists) revert RoundDoesNotExist();
        return (_roundId, d.answer, d.startedAt, d.updatedAt, d.answeredInRound);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        if (revertLatest) revert FeedPaused();
        RoundData storage d = _rounds[latestId];
        if (!d.exists) revert RoundDoesNotExist();
        return (latestId, d.answer, d.startedAt, d.updatedAt, d.answeredInRound);
    }
}
