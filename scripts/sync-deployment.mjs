#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, "..");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function loadViem(repoRoot) {
  try {
    return await import("viem");
  } catch {
    for (const base of [repoRoot, DEFAULT_ROOT]) {
      const localEntry = path.join(base, "web/node_modules/viem/_esm/index.js");
      if (fs.existsSync(localEntry)) {
        return await import(pathToFileURL(localEntry).href);
      }
    }
    throw new Error("Could not load 'viem'. Run 'cd web && npm install' first.");
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

function readFromBroadcast(broadcastPath) {
  const resolved = path.resolve(broadcastPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Broadcast file not found: ${resolved}`);
  }
  const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const txs = Array.isArray(data.transactions) ? data.transactions : [];
  let core;
  let registry;
  for (const tx of txs) {
    if (tx.transactionType !== "CREATE" && tx.transactionType !== "CREATE2") continue;
    if (tx.contractName === "ReckonCore") core = tx.contractAddress;
    if (tx.contractName === "ReckonSignalRegistry") registry = tx.contractAddress;
  }
  if (!core || !registry) {
    throw new Error(
      `Could not find both ReckonCore and ReckonSignalRegistry deployments in ${resolved}`,
    );
  }
  return { core, registry };
}

function replaceBlock(content, startMarker, endMarker, replacementBody, fileLabel) {
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`Missing sync markers (${startMarker} .. ${endMarker}) in ${fileLabel}`);
  }
  const before = content.slice(0, startIdx + startMarker.length);
  const after = content.slice(endIdx);
  return `${before}\n${replacementBody}\n${after}`;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const repoRoot = flags.root ? path.resolve(String(flags.root)) : DEFAULT_ROOT;
  const dryRun = Boolean(flags["dry-run"]);
  const viem = await loadViem(repoRoot);

  let rawCore = typeof flags.core === "string" ? flags.core.trim() : "";
  let rawRegistry = typeof flags.registry === "string" ? flags.registry.trim() : "";

  if (flags["from-broadcast"]) {
    const broadcastRel =
      typeof flags["from-broadcast"] === "string"
        ? flags["from-broadcast"]
        : path.join(repoRoot, "contracts/broadcast/Deploy.s.sol/56/run-latest.json");
    const parsed = readFromBroadcast(broadcastRel);
    rawCore = parsed.core;
    rawRegistry = parsed.registry;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(rawCore) || !/^0x[a-fA-F0-9]{40}$/.test(rawRegistry)) {
    throw new Error(
      "Usage: node scripts/sync-deployment.mjs --core <0x...> --registry <0x...> [--root <dir>] [--dry-run] | --from-broadcast [path]",
    );
  }

  const coreAddress = viem.getAddress(rawCore);
  const registryAddress = viem.getAddress(rawRegistry);
  if (coreAddress === ZERO_ADDRESS || registryAddress === ZERO_ADDRESS) {
    throw new Error("Core and Registry addresses must not be the zero address");
  }
  if (coreAddress.toLowerCase() === registryAddress.toLowerCase()) {
    throw new Error("Core and Registry addresses must be distinct");
  }

  const targets = [
    {
      relPath: "web/.env.example",
      transform(src) {
        return replaceBlock(
          src,
          "# RECKON_SYNC:ENV_START",
          "# RECKON_SYNC:ENV_END",
          [
            `NEXT_PUBLIC_RECKON_CORE_ADDRESS=${coreAddress}`,
            `RECKON_CORE_ADDRESS=${coreAddress}`,
            `NEXT_PUBLIC_RECKON_SIGNAL_REGISTRY_ADDRESS=${registryAddress}`,
            `RECKON_SIGNAL_REGISTRY_ADDRESS=${registryAddress}`,
          ].join("\n"),
          "web/.env.example",
        );
      },
    },
    {
      relPath: "web/src/lib/reckon/constants.ts",
      transform(src) {
        let out = replaceBlock(
          src,
          "// RECKON_SYNC:CORE_START",
          "// RECKON_SYNC:CORE_END",
          `export const DEFAULT_RECKON_CORE_ADDRESS: Address = "${coreAddress}";`,
          "web/src/lib/reckon/constants.ts",
        );
        out = replaceBlock(
          out,
          "// RECKON_SYNC:REGISTRY_START",
          "// RECKON_SYNC:REGISTRY_END",
          `export const DEFAULT_RECKON_SIGNAL_REGISTRY_ADDRESS: Address = "${registryAddress}";`,
          "web/src/lib/reckon/constants.ts",
        );
        return out;
      },
    },
    {
      relPath: "skills/reckon/scripts/reckon-cli.mjs",
      transform(src) {
        let out = replaceBlock(
          src,
          "// RECKON_SYNC:CORE_START",
          "// RECKON_SYNC:CORE_END",
          `const DEFAULT_CORE_ADDRESS = "${coreAddress}";`,
          "skills/reckon/scripts/reckon-cli.mjs",
        );
        out = replaceBlock(
          out,
          "// RECKON_SYNC:REGISTRY_START",
          "// RECKON_SYNC:REGISTRY_END",
          `const DEFAULT_REGISTRY_ADDRESS = "${registryAddress}";`,
          "skills/reckon/scripts/reckon-cli.mjs",
        );
        return out;
      },
    },
    {
      relPath: "skills/reckon/SKILL.md",
      transform(src) {
        return replaceBlock(
          src,
          "<!-- RECKON_CONFIG_START -->",
          "<!-- RECKON_CONFIG_END -->",
          [
            `- **ReckonCore:** \`${coreAddress}\` ([BscScan](https://bscscan.com/address/${coreAddress}))`,
            `- **ReckonSignalRegistry:** \`${registryAddress}\` ([BscScan](https://bscscan.com/address/${registryAddress}))`,
            "- **SPACE ID Agent ID:** `0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F`",
          ].join("\n"),
          "skills/reckon/SKILL.md",
        );
      },
    },
    {
      relPath: "README.md",
      transform(src) {
        return replaceBlock(
          src,
          "<!-- RECKON_DEPLOYMENTS_START -->",
          "<!-- RECKON_DEPLOYMENTS_END -->",
          [
            "| Contract | Mainnet Address | Explorer |",
            "|---|---|---|",
            `| **ReckonCore** | \`${coreAddress}\` | [BscScan](https://bscscan.com/address/${coreAddress}) |`,
            `| **ReckonSignalRegistry** | \`${registryAddress}\` | [BscScan](https://bscscan.com/address/${registryAddress}) |`,
          ].join("\n"),
          "README.md",
        );
      },
    },
  ];

  const updated = [];
  for (const t of targets) {
    const abs = path.join(repoRoot, t.relPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`Expected target file does not exist: ${abs}`);
    }
    const prev = fs.readFileSync(abs, "utf8");
    const next = t.transform(prev);
    const changed = prev !== next;
    if (changed && !dryRun) {
      fs.writeFileSync(abs, next, "utf8");
    }
    updated.push({ file: t.relPath, changed });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        chainId: 56,
        coreAddress,
        registryAddress,
        files: updated,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  );
  process.exit(1);
});
