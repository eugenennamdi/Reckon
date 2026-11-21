// AUTO-GENERATED FROZEN ABIs — DO NOT EDIT MANUALLY
// Source of truth: contracts/src/{ReckonCore,ReckonSignalRegistry,interfaces/*}.sol

export const reckonCoreAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "agentId_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "bnbUsdFeed_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "btcUsdFeed_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "ethUsdFeed_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "AGENT_ID",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "BNB_USD_FEED",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAggregatorV3"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "BRIER_SCALE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "BTC_USD_FEED",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAggregatorV3"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "COMMIT_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "EMERGENCY_CANCEL_DELAY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "EPOCH_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ETH_USD_FEED",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAggregatorV3"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_ORACLE_STALENESS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PENDING_ROUNDS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PROB_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_COMPETITIVE_ROUNDS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_PROB_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_REVEAL_RATE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_VERIFIED_BRIER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "OBSERVE_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ORACLE_HALT_GRACE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PROB_SCALE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "REVEAL_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "STAKE_TIER_0",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "STAKE_TIER_1",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "STAKE_TIER_2",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agentCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancelOracleGap",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "isStrike",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "rBefore",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "rAfter",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelUnsettleableRound",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimRefund",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimablePayout",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "commit",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "commitEpoch",
    "inputs": [
      {
        "name": "feedId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "epochId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "tierId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "commitment",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "computeCommitment",
    "inputs": [
      {
        "name": "feedId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "epochId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "tierId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "probBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createRound",
    "inputs": [
      {
        "name": "feedId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "epochId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "tierId",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "currentEpochId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "feedForId",
    "inputs": [
      {
        "name": "feedId",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAggregatorV3"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fixAndSettleOracle",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "strikeRoundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "strikeNextRoundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "resolveRoundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "resolveNextRoundId",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "fixStrike",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "strikeRoundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "strikeNextRoundId",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "flushAgent",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAgents",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "result",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEffectiveProfile",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "eff",
        "type": "tuple",
        "internalType": "struct IReckonCore.EffectiveProfile",
        "components": [
          {
            "name": "handleHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "roundsCommitted",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "roundsRevealed",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "roundsScored",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "competitiveRoundsScored",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "roundsMissed",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "firstActiveAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "cumulativeBrier",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "totalVolumeWei",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "meanBrier",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "revealRateBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "isVerified",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "bucketCounts",
            "type": "uint64[10]",
            "internalType": "uint64[10]"
          },
          {
            "name": "bucketHits",
            "type": "uint64[10]",
            "internalType": "uint64[10]"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEntry",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ReckonCore.Entry",
        "components": [
          {
            "name": "commitment",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "probBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "revealed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "claimed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "profileFlushed",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPendingRounds",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64[]",
        "internalType": "uint64[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRound",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ReckonCore.Round",
        "components": [
          {
            "name": "feedId",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "tierId",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "outcome",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "strikeFixed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "oracleSettled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "oracleCancelled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "epochId",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "openTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "commitEnd",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "resolveTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "revealEnd",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "committedCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "revealedCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "claimedCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "stakeAmount",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "remainingPool",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "strikePrice",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "settlePrice",
            "type": "int256",
            "internalType": "int256"
          },
          {
            "name": "sumP",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "sumP2",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasCommitted",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isCompetitiveEpochCredited",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "epochId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isVerifiedForecaster",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextRoundId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewPayout",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reveal",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "probBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "roundIdByKey",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "roundKey",
    "inputs": [
      {
        "name": "feedId",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "epochId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "tierId",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "roundState",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "enum ReckonCore.RoundState"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "settleOracle",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "resolveRoundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "resolveNextRoundId",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "stakeForTier",
    "inputs": [
      {
        "name": "tierId",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint128",
        "internalType": "uint128"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "event",
    "name": "ForecastCommitted",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "handle",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "commitment",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "stakeAmount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ForecastRevealed",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "probBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OracleSettled",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "strikePrice",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "settlePrice",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "outcome",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "oracleRoundId",
        "type": "uint80",
        "indexed": false,
        "internalType": "uint80"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PayoutClaimed",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "payoutWei",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "brierScore",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProfileFlushed",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "revealed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "oracleCancelled",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "brierScore",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RefundClaimed",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "refundWei",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "oracleCancelled",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoundCancelled",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoundCreated",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "feedId",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "epochId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "tierId",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "stakeAmount",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "openTime",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "commitEnd",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "resolveTime",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "revealEnd",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "StrikeFixed",
    "inputs": [
      {
        "name": "roundId",
        "type": "uint64",
        "indexed": true,
        "internalType": "uint64"
      },
      {
        "name": "strikePrice",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "oracleRoundId",
        "type": "uint80",
        "indexed": false,
        "internalType": "uint80"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyClaimed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyCommitted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyRevealed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CommitStillOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GracePeriodNotElapsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientOracleCheckGas",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidCommitment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidEpochId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidFeedDecimals",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidFeedId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidNextOracleRound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidOracleRound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidProbability",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidReveal",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidStakeAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTierId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoAgentID",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotCommitted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInRevealWindow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotRevealed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OracleAlreadyCancelled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OracleAlreadySettled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OracleBracketValid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OraclePriceStaleOrAfterTarget",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OracleStillHealthy",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ResolveTimeNotReached",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RoundAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RoundNotClaimable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RoundNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RoundNotOpen",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RoundNotRefundable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SettleDeadlinePassed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StrikeAlreadyFixed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StrikeNotFixed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TargetTimeNotReached",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TooManyPendingRounds",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;

export const reckonSignalRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "reckonCore_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "usdt_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "usdc_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "usd1_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "u_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "AGENT_ID",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAgentID"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_BIO_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_PRICE_ATOMIC",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_URL_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_PRICE_ATOMIC",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_URL_LEN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "RECKON_CORE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IReckonCore"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "U",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USD1",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USDC",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "USDT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deactivateSignal",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getListing",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ReckonSignalRegistry.SignalListing",
        "components": [
          {
            "name": "endpointUrl",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "bio",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "priceAtomic",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "updatedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "active",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "registered",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getProviders",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "result",
        "type": "tuple[]",
        "internalType": "struct ReckonSignalRegistry.ProviderView[]",
        "components": [
          {
            "name": "agent",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "handle",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "endpointUrl",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "bio",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "paymentToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "priceAtomic",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "updatedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "listingActive",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "meanBrier",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "revealRateBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "competitiveRoundsScored",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isListingActive",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isSupportedToken",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "providerCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerSignal",
    "inputs": [
      {
        "name": "endpointUrl",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "priceAtomic",
        "type": "uint128",
        "internalType": "uint128"
      },
      {
        "name": "paymentToken",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "bio",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "SignalDeactivated",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SignalRegistered",
    "inputs": [
      {
        "name": "agent",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "handle",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "endpointUrl",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "paymentToken",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "priceAtomic",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BioTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidBioCharacters",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidEndpointUrl",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPrice",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTokenDecimals",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotVerifiedForecaster",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnsupportedPaymentToken",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;

export const agentIdAbi = [
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "handleOf",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  }
] as const;

export const aggregatorV3Abi = [
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "description",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoundData",
    "inputs": [
      {
        "name": "_roundId",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "outputs": [
      {
        "name": "roundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "answer",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "startedAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "updatedAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "answeredInRound",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "latestRoundData",
    "inputs": [],
    "outputs": [
      {
        "name": "roundId",
        "type": "uint80",
        "internalType": "uint80"
      },
      {
        "name": "answer",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "startedAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "updatedAt",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "answeredInRound",
        "type": "uint80",
        "internalType": "uint80"
      }
    ],
    "stateMutability": "view"
  }
] as const;
