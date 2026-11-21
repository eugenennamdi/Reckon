#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SCAN_TARGETS = [
  "web/src",
  "web/public",
  "skills",
  "docs",
  "agents",
  "contracts/README.md",
  "README.md",
  "SECURITY.md",
];

const IGNORE_DIRS = new Set(["node_modules", ".next", ".reckon-data", ".git"]);

const BANNED_PATTERNS = [
  { name: "passive income", regex: /passive income/i },
  { name: "guaranteed", regex: /\bguaranteed\b/i },
  { name: "risk-free", regex: /\brisk-free\b/i },
  { name: "automatic money", regex: /automatic money/i },
  { name: "auto-profit", regex: /auto-profit/i },
  { name: "ownerOfHandle", regex: /ownerOfHandle/i },
];

function collectFiles(targetPath, out = []) {
  if (!fs.existsSync(targetPath)) return out;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    out.push(targetPath);
    return out;
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      collectFiles(path.join(targetPath, entry.name), out);
    }
  }
  return out;
}

const files = [];
for (const rel of SCAN_TARGETS) {
  collectFiles(path.join(ROOT, rel), files);
}

const violations = [];
for (const file of files) {
  const relPath = path.relative(ROOT, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of BANNED_PATTERNS) {
      if (pat.regex.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          pattern: pat.name,
          text: line.trim(),
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Compliance check FAILED — banned phrases/symbols found:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} [${v.pattern}] -> ${v.text}`);
  }
  process.exit(1);
}

console.log(`Compliance check PASSED (${files.length} files scanned, 0 violations).`);
