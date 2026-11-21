#!/usr/bin/env node
/**
 * Reckon Open-Source Reference Forecaster Agent (BNB Chain · chainId 56).
 *
 * Computes a transparent, reproducible probabilistic forecast P(Resolve >= Strike)
 * from recent BNB Chain Chainlink oracle round momentum & realized volatility,
 * prepares unsigned ReckonCore calldata via `skills/reckon/scripts/reckon-cli.mjs`,
 * runs `baw contract-call preview`, and strictly waits for explicit human confirmation
 * before executing (Red Line #2 compliant).
 *
 * Usage:
 *   node agents/reference-forecaster/bot.mjs --feed 0 --tier 0 --dry-run
 *   node agents/reference-forecaster/bot.mjs --feed 0 --tier 0 --core <0x...>
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const CLI_PATH = path.join(REPO_ROOT, "skills/reckon/scripts/reckon-cli.mjs");

const FEEDS = [
  { id: 0, symbol: "BNB/USD", address: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" },
  { id: 1, symbol: "BTC/USD", address: "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf" },
  { id: 2, symbol: "ETH/USD", address: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e" },
];

async function loadViem() {
  try {
    return await import("viem");
  } catch {
    const candidate = path.join(REPO_ROOT, "web/node_modules/viem/_esm/index.js");
    if (fs.existsSync(candidate)) {
      return await import(pathToFileURL(candidate).href);
    }
    throw new Error("Could not load 'viem'. Run 'cd web && npm install' or 'cd skills/reckon && npm install'.");
  }
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

/**
 * Compute a calibrated directional probability in [3000, 7000] bps using the last 12
 * Chainlink rounds (short-term drift normalized by realized volatility -> logistic map).
 * Builders can swap this function with any LLM, orderbook, or macro signal model.
 */
async function computeChainlinkSignal(viem, feed, rpcUrl) {
  const aggAbi = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "skills/reckon/abi/IAggregatorV3.abi.json"), "utf8"),
  );
  const client = viem.createPublicClient({ transport: viem.http(rpcUrl, { timeout: 10_000 }) });
  const [latestId, latestAns, , latestUpdated] = await client.readContract({
    address: feed.address,
    abi: aggAbi,
    functionName: "latestRoundData",
  });

  const phase = latestId >> 64n;
  const agg = latestId & ((1n << 64n) - 1n);
  const lookback = 12;
  const contracts = [];
  for (let i = lookback; i >= 1; i--) {
    if (agg > BigInt(i)) {
      contracts.push({
        address: feed.address,
        abi: aggAbi,
        functionName: "getRoundData",
        args: [(phase << 64n) | (agg - BigInt(i))],
      });
    }
  }

  const historyRes = await client.multicall({
    contracts,
    allowFailure: true,
    multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
  });
  const prices = historyRes
    .filter((r) => r.status === "success" && Array.isArray(r.result) && r.result[1] > 0n)
    .map((r) => Number(r.result[1]) / 1e8);
  prices.push(Number(latestAns) / 1e8);

  if (prices.length < 3) {
    return { spotUsd: Number(latestAns) / 1e8, updatedAt: Number(latestUpdated), probBps: 5000, zScore: 0 };
  }

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const meanRet = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - meanRet) ** 2, 0) / returns.length;
  const vol = Math.sqrt(variance) || 1e-4;
  const zScore = Math.max(-2.5, Math.min(2.5, meanRet / vol));

  // Calibrated conservative logistic map (avoids extreme overconfidence on quadratic Brier scoring)
  const rawProb = 1 / (1 + Math.exp(-0.55 * zScore));
  const probBps = Math.max(3000, Math.min(7000, Math.round(rawProb * 10_000)));

  return {
    spotUsd: Number(latestAns) / 1e8,
    updatedAt: Number(latestUpdated),
    sampleCount: prices.length,
    zScore: Number(zScore.toFixed(3)),
    probBps,
  };
}

function runJson(cmd, args) {
  const out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const feedId = Number(flags.feed ?? 0);
  const tierId = Number(flags.tier ?? 0);
  const dryRun = Boolean(flags["dry-run"]);
  const rpcUrl = String(flags.rpc || process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/");

  const feed = FEEDS[feedId];
  if (!feed) throw new Error("--feed must be 0 (BNB/USD), 1 (BTC/USD), or 2 (ETH/USD)");
  if (![0, 1, 2].includes(tierId)) throw new Error("--tier must be 0, 1, or 2");

  const viem = await loadViem();
  const signal = await computeChainlinkSignal(viem, feed, rpcUrl);

  console.log(
    JSON.stringify(
      {
        stage: "model_forecast",
        feed: feed.symbol,
        spotUsd: signal.spotUsd.toFixed(2),
        zScore: signal.zScore,
        probBps: signal.probBps,
        probPct: `${(signal.probBps / 100).toFixed(2)}%`,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry-run complete. Re-run without --dry-run (with baw signed in + Developer Mode ON) to preview.");
    return;
  }

  // Step 1: Mandatory baw preflight
  const preflight = runJson("node", [CLI_PATH, "preflight"]);
  if (!preflight.ok || !preflight.wallet?.address) {
    throw new Error(`Preflight failed: ${JSON.stringify(preflight)}`);
  }
  const agentAddress = preflight.wallet.address;

  // Step 2: Prepare commit & persist CSPRNG salt locally (mode 0600)
  const prepareArgs = [
    CLI_PATH,
    "prepare-commit",
    "--feed",
    String(feedId),
    "--tier",
    String(tierId),
    "--prob-bps",
    String(signal.probBps),
    "--agent",
    agentAddress,
  ];
  if (flags.core) prepareArgs.push("--core", String(flags.core));
  const prepared = runJson("node", prepareArgs);

  // Step 3: Run `baw contract-call preview`
  const preview = runJson("baw", [
    "contract-call",
    "preview",
    "--binanceChainId",
    "56",
    "--from",
    prepared.from,
    "--to",
    prepared.to,
    "--value",
    prepared.valueWei,
    "--inputData",
    prepared.inputData,
    "--json",
  ]);

  if (!preview.success || !preview.data?.requestId) {
    throw new Error(`baw contract-call preview blocked/failed: ${JSON.stringify(preview)}`);
  }

  console.log("\n=== Transaction Preview (Red Line #2 Human Confirmation) ===");
  console.log(`Agent ID:   ${preflight.wallet.handle}.ai (${agentAddress})`);
  console.log(`Market:     ${prepared.feed} · Epoch #${prepared.epochId} · ${prepared.tier}`);
  console.log(`Forecast:   ${(prepared.probBps / 100).toFixed(2)}% (salt saved at ${prepared.saltFile})`);
  console.log(`To:         ${prepared.to}`);
  console.log(`Value:      ${prepared.valueBnb} BNB (${prepared.valueWei} wei)`);
  console.log(`Allowances: ${JSON.stringify(preview.data.simulationResult?.allowanceChanges ?? [])}`);
  console.log(`Risks:      ${JSON.stringify(preview.data.risks?.riskDetails ?? [])}`);
  console.log(`Warning:    ${prepared.riskReminder}\n`);

  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question("Type 'yes' to execute via baw contract-call execute: ")).trim().toLowerCase();
  rl.close();

  if (answer !== "yes" && answer !== "confirm") {
    console.log("Aborted by human operator. Salt remains safely archived locally.");
    return;
  }

  const executed = runJson("baw", [
    "contract-call",
    "execute",
    "--requestId",
    preview.data.requestId,
    "--json",
  ]);
  console.log(JSON.stringify({ ok: true, executed }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
