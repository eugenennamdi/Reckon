#!/usr/bin/env node
/**
 * Permissionless Chainlink Oracle Settlement Keeper for ReckonCore (BNB Chain · chainId 56).
 *
 * Scans recent canonical 4h epochs for instantiated rounds needing `fixStrike`, `settleOracle`,
 * or `fixAndSettleOracle`, resolves exact Chainlink historical round brackets, and settles them
 * permissionlessly so rounds never stall in AWAITING_ORACLE.
 *
 * Usage:
 *   node scripts/keeper.mjs --once                    # Dry-run scan (default safe mode)
 *   node scripts/keeper.mjs --once --broadcast        # Broadcast using KEEPER_PRIVATE_KEY
 *   node scripts/keeper.mjs --interval 180 --broadcast
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const EPOCH_DURATION = 14_400;
const SETTLE_BUFFER_SEC = 90;
const FEEDS = [
  { id: 0, symbol: "BNB/USD", address: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" },
  { id: 1, symbol: "BTC/USD", address: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf" },
  { id: 2, symbol: "ETH/USD", address: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e" },
];

async function loadViem() {
  try {
    return {
      viem: await import("viem"),
      accounts: await import("viem/accounts"),
      chains: await import("viem/chains"),
    };
  } catch {
    const base = path.join(REPO_ROOT, "web/node_modules/viem/_esm");
    if (!fs.existsSync(path.join(base, "index.js"))) {
      throw new Error("Could not load 'viem'. Run 'cd web && npm install' first.");
    }
    return {
      viem: await import(pathToFileURL(path.join(base, "index.js")).href),
      accounts: await import(pathToFileURL(path.join(base, "accounts/index.js")).href),
      chains: await import(pathToFileURL(path.join(base, "chains/index.js")).href),
    };
  }
}

function loadAbi(fileName) {
  const abiPath = path.join(REPO_ROOT, "skills/reckon/abi", fileName);
  const raw = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  return Array.isArray(raw) ? raw : raw.abi;
}

function readSyncedCoreAddress() {
  const constFile = path.join(REPO_ROOT, "web/src/lib/reckon/constants.ts");
  if (!fs.existsSync(constFile)) return ZERO_ADDRESS;
  const content = fs.readFileSync(constFile, "utf8");
  const match = /DEFAULT_RECKON_CORE_ADDRESS[^"]*"(0x[a-fA-F0-9]{40})"/.exec(content);
  return match ? match[1] : ZERO_ADDRESS;
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[arg.slice(2)] = next;
        i++;
      } else {
        flags[arg.slice(2)] = true;
      }
    }
  }
  return flags;
}

async function searchPhaseBracket(client, feedAddr, aggAbi, phase, maxAggRound, latestUpdatedSec, targetTime) {
  const samplePrior = maxAggRound > 100n ? maxAggRound - 100n : 1n;
  let secPerRound = 35;
  if (samplePrior < maxAggRound) {
    try {
      const [, , , priorUpdatedAt] = await client.readContract({
        address: feedAddr,
        abi: aggAbi,
        functionName: "getRoundData",
        args: [(phase << 64n) | samplePrior],
      });
      const dtSample = latestUpdatedSec - Number(priorUpdatedAt);
      if (Number(priorUpdatedAt) > 0 && dtSample > 0) {
        secPerRound = Math.max(5, Math.min(600, dtSample / Number(maxAggRound - samplePrior)));
      }
    } catch {
      // keep default step estimate
    }
  }

  const dt = Math.max(1, latestUpdatedSec - targetTime);
  const maxSpan = BigInt(Math.ceil(dt / 5) + 1200);
  let lo = maxAggRound > maxSpan ? maxAggRound - maxSpan : 1n;
  let hi = maxAggRound;
  const estOffset = BigInt(Math.round(dt / secPerRound));
  const rawEst = maxAggRound > estOffset ? maxAggRound - estOffset : 1n;
  const est = rawEst < lo ? lo : rawEst > hi ? hi : rawEst;

  const probeBatch = async (candidates) => {
    const unique = [...new Set(candidates.map((c) => (c < lo ? lo : c > hi ? hi : c)))]
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (unique.length === 0) return;
    const res = await client.multicall({
      contracts: unique.map((agg) => ({
        address: feedAddr,
        abi: aggAbi,
        functionName: "getRoundData",
        args: [(phase << 64n) | agg],
      })),
      allowFailure: true,
    });
    for (let i = 0; i < unique.length; i++) {
      const item = res[i];
      if (item?.status !== "success" || !Array.isArray(item.result)) continue;
      const uAt = Number(item.result[3]);
      if (uAt <= 0) continue;
      if (uAt <= targetTime) {
        if (unique[i] > lo) lo = unique[i];
      } else if (unique[i] < hi) {
        hi = unique[i];
        break;
      }
    }
  };

  await probeBatch([
    lo, est - 1024n, est - 256n, est - 64n, est - 16n, est - 4n,
    est, est + 4n, est + 16n, est + 64n, est + 256n, est + 1024n, hi,
  ]);

  for (let iter = 0; iter < 6 && hi - lo > 16n; iter++) {
    const span = hi - lo;
    const probes = [];
    for (let k = 1n; k <= 15n; k++) probes.push(lo + (span * k) / 16n);
    await probeBatch(probes);
  }

  const scanIds = [];
  const capHi = hi - lo > 64n ? lo + 64n : hi;
  for (let agg = lo; agg <= capHi; agg++) scanIds.push(agg);
  const scanRes = await client.multicall({
    contracts: scanIds.map((agg) => ({
      address: feedAddr,
      abi: aggAbi,
      functionName: "getRoundData",
      args: [(phase << 64n) | agg],
    })),
    allowFailure: true,
  });
  for (let i = 0; i < scanIds.length - 1; i++) {
    const cur = scanRes[i];
    const nxt = scanRes[i + 1];
    if (cur?.status !== "success" || nxt?.status !== "success") continue;
    const [curId, curAns, , curUAt] = cur.result;
    const [nxtId, nxtAns, , nxtUAt] = nxt.result;
    if (curAns > 0n && nxtAns > 0n && Number(curUAt) > 0 && Number(curUAt) <= targetTime && Number(nxtUAt) > targetTime) {
      return { roundId: curId, nextRoundId: nxtId };
    }
  }
  return null;
}

async function findBracket(client, feedAddr, aggAbi, targetTime) {
  const [latestId, , , latestUpdatedAt] = await client.readContract({
    address: feedAddr,
    abi: aggAbi,
    functionName: "latestRoundData",
  });
  const latestUpdatedSec = Number(latestUpdatedAt);
  if (latestUpdatedSec <= targetTime) return null;
  const phase = latestId >> 64n;
  const latestRound = latestId & ((1n << 64n) - 1n);
  return searchPhaseBracket(client, feedAddr, aggAbi, phase, latestRound, latestUpdatedSec, targetTime);
}

async function runPass({ client, walletClient, account, coreAddress, coreAbi, aggAbi, lookbackEpochs, broadcast }) {
  const nowSec = Math.floor(Date.now() / 1000);
  const currEpoch = Math.floor(nowSec / EPOCH_DURATION);

  const slots = [];
  for (let offset = 1; offset <= lookbackEpochs; offset++) {
    const epochId = currEpoch - offset;
    if (epochId < 1) continue;
    for (let feedId = 0; feedId < 3; feedId++) {
      for (let tierId = 0; tierId < 3; tierId++) {
        slots.push({ epochId, feedId, tierId });
      }
    }
  }

  const keyRes = await client.multicall({
    contracts: slots.map((s) => ({
      address: coreAddress,
      abi: coreAbi,
      functionName: "roundKey",
      args: [s.feedId, BigInt(s.epochId), s.tierId],
    })),
    allowFailure: true,
  });

  const idRes = await client.multicall({
    contracts: keyRes.map((r) => ({
      address: coreAddress,
      abi: coreAbi,
      functionName: "roundIdByKey",
      args: [r.status === "success" ? r.result : `0x${"00".repeat(32)}`],
    })),
    allowFailure: true,
  });

  const roundIds = idRes
    .map((r) => (r.status === "success" ? Number(r.result) : 0))
    .filter((id) => id > 0);

  if (roundIds.length === 0) {
    return { scannedSlots: slots.length, instantiated: 0, actions: [] };
  }

  const roundRes = await client.multicall({
    contracts: roundIds.map((id) => ({
      address: coreAddress,
      abi: coreAbi,
      functionName: "getRound",
      args: [BigInt(id)],
    })),
    allowFailure: true,
  });

  const actions = [];
  for (let i = 0; i < roundIds.length; i++) {
    const rId = roundIds[i];
    const item = roundRes[i];
    if (item?.status !== "success") continue;
    const r = item.result;
    if (r.oracleCancelled || r.oracleSettled) continue;

    const commitEnd = Number(r.commitEnd);
    const resolveTime = Number(r.resolveTime);
    const feed = FEEDS[Number(r.feedId)];
    if (!feed) continue;

    const needsStrike = !r.strikeFixed && nowSec >= commitEnd + SETTLE_BUFFER_SEC;
    const needsSettle = !r.oracleSettled && nowSec >= resolveTime + SETTLE_BUFFER_SEC;
    if (!needsStrike && !needsSettle) continue;

    let fnName;
    let args;
    if (needsStrike && needsSettle) {
      const strike = await findBracket(client, feed.address, aggAbi, commitEnd);
      const resolve = await findBracket(client, feed.address, aggAbi, resolveTime);
      if (!strike || !resolve) continue;
      fnName = "fixAndSettleOracle";
      args = [BigInt(rId), strike.roundId, strike.nextRoundId, resolve.roundId, resolve.nextRoundId];
    } else if (needsStrike) {
      const strike = await findBracket(client, feed.address, aggAbi, commitEnd);
      if (!strike) continue;
      fnName = "fixStrike";
      args = [BigInt(rId), strike.roundId, strike.nextRoundId];
    } else if (needsSettle && r.strikeFixed) {
      const resolve = await findBracket(client, feed.address, aggAbi, resolveTime);
      if (!resolve) continue;
      fnName = "settleOracle";
      args = [BigInt(rId), resolve.roundId, resolve.nextRoundId];
    } else {
      continue;
    }

    if (broadcast && walletClient && account) {
      const sim = await client.simulateContract({
        address: coreAddress,
        abi: coreAbi,
        functionName: fnName,
        args,
        account,
      });
      const txHash = await walletClient.writeContract(sim.request);
      const receipt = await client.waitForTransactionReceipt({ hash: txHash });
      actions.push({ roundId: rId, feed: feed.symbol, fnName, status: receipt.status, txHash });
    } else {
      actions.push({ roundId: rId, feed: feed.symbol, fnName, status: "dry-run" });
    }
  }

  return { scannedSlots: slots.length, instantiated: roundIds.length, actions };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const { viem, accounts, chains } = await loadViem();

  const rawCore =
    flags.core ||
    process.env.RECKON_CORE_ADDRESS ||
    process.env.NEXT_PUBLIC_RECKON_CORE_ADDRESS ||
    readSyncedCoreAddress();
  if (!/^0x[a-fA-F0-9]{40}$/.test(String(rawCore)) || rawCore === ZERO_ADDRESS) {
    throw new Error("ReckonCore address required via --core <0x...> or RECKON_CORE_ADDRESS (sync deployment first).");
  }
  const coreAddress = viem.getAddress(String(rawCore));
  const rpcUrl = String(flags.rpc || process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/");
  const lookbackEpochs = Math.max(1, Math.min(24, Number(flags.lookback || 6)));
  const broadcast = Boolean(flags.broadcast);
  const intervalSec = flags.interval ? Math.max(30, Number(flags.interval)) : 0;

  let account = null;
  let walletClient = null;
  if (broadcast) {
    const pk = process.env.KEEPER_PRIVATE_KEY?.trim();
    if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
      throw new Error("--broadcast requires KEEPER_PRIVATE_KEY (0x-prefixed 32-byte private key of a dedicated gas EOA)");
    }
    account = accounts.privateKeyToAccount(pk);
    walletClient = viem.createWalletClient({
      account,
      chain: chains.bsc,
      transport: viem.http(rpcUrl, { timeout: 10_000 }),
    });
  }

  const client = viem.createPublicClient({
    chain: chains.bsc,
    transport: viem.http(rpcUrl, { timeout: 10_000 }),
  });
  const coreAbi = loadAbi("ReckonCore.abi.json");
  const aggAbi = loadAbi("IAggregatorV3.abi.json");

  const execPass = async () => {
    const summary = await runPass({
      client,
      walletClient,
      account,
      coreAddress,
      coreAbi,
      aggAbi,
      lookbackEpochs,
      broadcast,
    });
    console.log(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), coreAddress, broadcast, ...summary }));
  };

  await execPass();
  if (intervalSec > 0 && !flags.once) {
    setInterval(() => {
      execPass().catch((err) => {
        console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      });
    }, intervalSec * 1000);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
