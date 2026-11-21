import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { decodeFunctionData } from "viem";
import { reckonCoreAbi, reckonSignalRegistryAbi } from "@/lib/abi";
import { computeCommitment } from "@/lib/reckon/commitment";
import { BSC_STABLECOINS } from "@/lib/reckon/constants";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../skills/reckon/scripts/reckon-cli.mjs");
const CORE = "0x1111111111111111111111111111111111111111";
const REGISTRY = "0x2222222222222222222222222222222222222222";
const AGENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("Companion Skill CLI (reckon-cli.mjs) smoke tests", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reckon-cli-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prepares commit atomically with 0600 salts, matching computeCommitment and frozen ABI calldata", () => {
    const saltFile = path.join(tmpDir, "salts.json");
    const out = execFileSync(
      "node",
      [
        CLI_PATH,
        "prepare-commit",
        "--feed",
        "1",
        "--tier",
        "2",
        "--prob-bps",
        "8450",
        "--epoch",
        "80123",
        "--agent",
        AGENT,
        "--core",
        CORE,
        "--salt-file",
        saltFile,
      ],
      { encoding: "utf8" },
    );

    const parsed = JSON.parse(out) as {
      action: string;
      commitment: `0x${string}`;
      valueWei: string;
      inputData: `0x${string}`;
      bawPreviewCommand: string;
      expectedAllowanceChanges: unknown[];
    };

    assert.equal(parsed.action, "commitEpoch");
    assert.equal(parsed.valueWei, "10000000000000000");
    assert.deepEqual(parsed.expectedAllowanceChanges, []);
    assert.ok(parsed.bawPreviewCommand.includes("baw contract-call preview"));
    assert.ok(parsed.bawPreviewCommand.includes("--value 10000000000000000"));

    // Verify 0600 file permissions & commitment determinism
    const mode = fs.statSync(saltFile).mode & 0o777;
    assert.equal(mode, 0o600);
    const saved = JSON.parse(fs.readFileSync(saltFile, "utf8")) as {
      entries: Array<{ salt: `0x${string}`; probBps: number; commitment: `0x${string}` }>;
    };
    assert.equal(saved.entries.length, 1);
    const recomputed = computeCommitment({
      chainId: 56,
      coreAddress: CORE,
      feedId: 1,
      epochId: 80123,
      tierId: 2,
      agent: AGENT,
      probBps: 8450,
      salt: saved.entries[0].salt,
    });
    assert.equal(recomputed, parsed.commitment);

    const decoded = decodeFunctionData({ abi: reckonCoreAbi, data: parsed.inputData });
    assert.equal(decoded.functionName, "commitEpoch");

    // Prepare reveal using saved salt
    const revealOut = execFileSync(
      "node",
      [
        CLI_PATH,
        "prepare-reveal",
        "--round-id",
        "7",
        "--feed",
        "1",
        "--epoch",
        "80123",
        "--tier",
        "2",
        "--agent",
        AGENT,
        "--core",
        CORE,
        "--salt-file",
        saltFile,
      ],
      { encoding: "utf8" },
    );
    const revealParsed = JSON.parse(revealOut) as { inputData: `0x${string}`; probBps: number };
    assert.equal(revealParsed.probBps, 8450);
    const decodedReveal = decodeFunctionData({ abi: reckonCoreAbi, data: revealParsed.inputData });
    assert.equal(decodedReveal.functionName, "reveal");
  });

  it("encodes claim, claimRefund, registerSignal (plus alias), and SignalAttestation", () => {
    const claimOut = JSON.parse(
      execFileSync(
        "node",
        [CLI_PATH, "prepare-claim", "--round-id", "4", "--agent", AGENT, "--core", CORE],
        { encoding: "utf8" },
      ),
    ) as { inputData: `0x${string}` };
    assert.equal(decodeFunctionData({ abi: reckonCoreAbi, data: claimOut.inputData }).functionName, "claim");

    const regOut = JSON.parse(
      execFileSync(
        "node",
        [
          CLI_PATH,
          "prepare-register-provider",
          "--endpoint",
          "https://signals.reckon.example/api/signals",
          "--price-usd",
          "0.50",
          "--token",
          "USD1",
          "--bio",
          "Quantitative volatility model",
          "--agent",
          AGENT,
          "--registry",
          REGISTRY,
        ],
        { encoding: "utf8" },
      ),
    ) as { action: string; inputData: `0x${string}`; paymentToken: string };
    assert.equal(regOut.action, "registerSignal");
    assert.equal(regOut.paymentToken, BSC_STABLECOINS[0].address);
    const decodedReg = decodeFunctionData({
      abi: reckonSignalRegistryAbi,
      data: regOut.inputData,
    });
    assert.equal(decodedReg.functionName, "registerSignal");

    const attOut = JSON.parse(
      execFileSync(
        "node",
        [
          CLI_PATH,
          "prepare-attestation",
          "--round-id",
          "5",
          "--feed",
          "0",
          "--epoch",
          "80123",
          "--tier",
          "0",
          "--seller",
          AGENT,
          "--prob-bps",
          "7800",
          "--thesis",
          "Detailed on-chain liquidity and funding divergence thesis",
          "--core",
          CORE,
        ],
        { encoding: "utf8" },
      ),
    ) as { typedData: { primaryType: string }; bawPreviewCommand: string; signMessagePayload: string };
    assert.equal(attOut.typedData.primaryType, "SignalAttestation");
    assert.ok(attOut.bawPreviewCommand.includes("baw sign-message preview --binanceChainId 56 --signType EIP712"));
    assert.ok(attOut.signMessagePayload.includes("eth_signTypedData_v4"));
  });

  it("blocks private/metadata SSRF hosts by default and assembles baw signatureRecovery in publish-signal", async () => {
    // SSRF guard must block cloud metadata / private IP without --allow-localhost
    assert.throws(() =>
      execFileSync("node", [CLI_PATH, "x402-inspect", "--url", "http://169.254.169.254/latest/meta-data"], {
        stdio: "pipe",
      }),
    );

    // Local mock server verifies publish-signal combines 64-byte baw signature + recovery ("01" -> "1c")
    let receivedBody: { signature?: string; title?: string } = {};
    const server = http.createServer((req, res) => {
      let chunks = "";
      req.on("data", (d) => {
        chunks += d;
      });
      req.on("end", () => {
        receivedBody = JSON.parse(chunks) as typeof receivedBody;
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify({ signal: { id: "sig_cli_test" }, endpointUrl: "/api/signals/sig_cli_test" }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const sig64 = "ab".repeat(64);
      const { stdout } = await execFileAsync(
        "node",
        [
          CLI_PATH,
          "publish-signal",
          "--endpoint",
          `http://127.0.0.1:${port}/api/signals/publish`,
          "--allow-localhost",
          "--title",
          "BNB 4H Breakout",
          "--thesis",
          "Orderbook depth and perp funding divergence favor upside continuation.",
          "--price-usd",
          "0.50",
          "--token",
          "USD1",
          "--round-id",
          "5",
          "--feed",
          "0",
          "--epoch",
          "80123",
          "--tier",
          "0",
          "--seller",
          AGENT,
          "--prob-bps",
          "7800",
          "--issued-at",
          "1795000000",
          "--core",
          CORE,
          "--sig",
          sig64,
          "--recovery",
          "01",
        ],
        { encoding: "utf8" },
      );
      const pubOut = JSON.parse(stdout) as { ok: boolean; assembledSignature: string };

      assert.equal(pubOut.ok, true);
      assert.equal(pubOut.assembledSignature, `0x${sig64}1c`);
      assert.equal(receivedBody.signature, `0x${sig64}1c`);
      assert.equal(receivedBody.title, "BNB 4H Breakout");
    } finally {
      server.closeAllConnections?.();
      server.close();
    }
  });

  it("runs preflight with real baw v1.15 JSON schema (wallet status + wallet address + nested error 20003008)", () => {
    const binDir = path.join(tmpDir, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const mockBawPath = path.join(binDir, "baw");

    const writeMockBaw = (mode: "healthy" | "transient" | "expired") => {
      const futureMs = Date.now() + 86_400_000;
      const pastMs = Date.now() - 86_400_000;
      const script = `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ");
if (args.startsWith("wallet status")) {
  // Real baw wallet status returns NO address field!
  console.log(JSON.stringify({ success: true, data: { status: "CONNECTED", sessionExpireTime: ${futureMs} } }));
  process.exit(0);
}
if (args.startsWith("wallet address")) {
  console.log(JSON.stringify({
    success: true,
    data: {
      addresses: [
        { binanceChainId: "1", chain: "eth", address: "0x0000000000000000000000000000000000000001" },
        { binanceChainId: "56", chain: "bsc", address: "${AGENT}" }
      ]
    }
  }));
  process.exit(0);
}
if (args.startsWith("wallet agent-id")) {
  if ("${mode}" === "transient") {
    // Real baw error envelope: { success: false, error: { code: 20003008, ... } }
    console.log(JSON.stringify({ success: false, error: { code: 20003008, name: "AGENT_ID_TRANSIENT", message: "transient backend error" } }));
    process.exit(0);
  }
  console.log(JSON.stringify({ success: true, data: { claimed: true, handle: "alice", agentId: "123" } }));
  process.exit(0);
}
if (args.startsWith("wallet settings")) {
  console.log(JSON.stringify({
    success: true,
    data: {
      devMode: { enabled: true, expiresAt: ${mode === "expired" ? pastMs : futureMs}, balanceExceeded: false, dailyLimit: "100" },
      x402QuotaLeft: 20
    }
  }));
  process.exit(0);
}
process.exit(1);
`;
      fs.writeFileSync(mockBawPath, script, { mode: 0o755 });
    };

    const envWithMock = { ...process.env, PATH: `${binDir}:${process.env.PATH || ""}` };

    writeMockBaw("healthy");
    const healthy = JSON.parse(
      execFileSync("node", [CLI_PATH, "preflight"], { encoding: "utf8", env: envWithMock }),
    ) as { ok: boolean; wallet: { handle: string; address: string; devModeDailyLimit: string } };
    assert.equal(healthy.ok, true);
    assert.equal(healthy.wallet.handle, "alice");
    assert.equal(healthy.wallet.address, AGENT);
    assert.equal(healthy.wallet.devModeDailyLimit, "100");

    writeMockBaw("transient");
    const transient = JSON.parse(
      execFileSync("node", [CLI_PATH, "preflight"], { encoding: "utf8", env: envWithMock }),
    ) as { ok: boolean; transientError: boolean; errorCode: string };
    assert.equal(transient.ok, false);
    assert.equal(transient.transientError, true);
    assert.equal(transient.errorCode, "20003008");

    writeMockBaw("expired");
    assert.throws(() =>
      execFileSync("node", [CLI_PATH, "preflight"], { encoding: "utf8", env: envWithMock }),
    );
  });
});
