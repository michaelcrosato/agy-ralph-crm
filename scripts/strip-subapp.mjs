#!/usr/bin/env node
// Strip route blocks for specified sub-app names from a routes file.
// Also removes the corresponding `export const <name> = new Hono<...>()` line.

import fs from "node:fs";
import path from "node:path";

const [, , filePath, ...appNames] = process.argv;
if (!filePath || appNames.length === 0) {
  console.error("usage: strip-subapp.mjs <file> <appName> [<appName> ...]");
  process.exit(2);
}

const abs = path.resolve(filePath);
const src = fs.readFileSync(abs, "utf8");
const lines = src.split(/\r?\n/);

const appPattern = new RegExp(
  `^(${appNames.join("|")})\\.(get|post|put|delete|patch)\\(`,
);
const exportPattern = new RegExp(
  `^export\\s+const\\s+(${appNames.join("|")})\\s*=\\s*new\\s+Hono`,
);

function findBlockEnd(startIdx) {
  let depth = 0;
  let inStr = null;
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    inLineComment = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const next = line[j + 1];
      if (inLineComment) break;
      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          j++;
        }
        continue;
      }
      if (inStr) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }
        if (ch === "\\") {
          isEscaped = true;
          continue;
        }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === "/" && next === "/") {
        inLineComment = true;
        break;
      }
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        j++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
        continue;
      }
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

const removed = [];
const toRemove = new Set();
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (exportPattern.test(line)) {
    toRemove.add(i);
    removed.push({ start: i + 1, end: i + 1, kind: "export" });
    continue;
  }
  if (!appPattern.test(line)) continue;
  const end = findBlockEnd(i);
  if (end < 0) {
    console.error("end not found at", i + 1);
    process.exit(1);
  }
  for (let k = i; k <= end; k++) toRemove.add(k);
  removed.push({ start: i + 1, end: end + 1, kind: "route" });
  i = end;
}

const out = lines.filter((_, idx) => !toRemove.has(idx)).join("\n");
fs.writeFileSync(abs, out, "utf8");
console.log(`Removed ${removed.length} blocks from ${filePath}`);
for (const r of removed) console.log(`  ${r.start}-${r.end} ${r.kind}`);
