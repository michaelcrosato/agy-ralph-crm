#!/usr/bin/env node
// Surgical route extractor. Removes app.<method>(...) {...}; blocks whose
// path matches any of the given regex patterns. Optionally writes the
// removed blocks to an --out file with simple path/handler transformation.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
let filePath = null;
let outPath = null;
let stripBase = null;
let subApp = null;
const patterns = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--out") {
    outPath = args[++i];
    continue;
  }
  if (a === "--strip-base") {
    stripBase = args[++i];
    continue;
  }
  if (a === "--sub-app") {
    subApp = args[++i];
    continue;
  }
  if (!filePath) {
    filePath = a;
    continue;
  }
  patterns.push(new RegExp(a));
}

if (!filePath || patterns.length === 0) {
  console.error(
    "usage: extract-routes.mjs <file> [--out <path>] [--strip-base <prefix> --sub-app <name>] <pattern> [<pattern> ...]",
  );
  process.exit(2);
}

const abs = path.resolve(filePath);
const src = fs.readFileSync(abs, "utf8");
const lines = src.split(/\r?\n/);

const routeStartRe =
  /^app\.(get|post|put|delete|patch)\(\s*$|^app\.(get|post|put|delete|patch)\(["']/;

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

console.error(
  "Patterns:",
  patterns.map((p) => p.source),
);
const removed = [];
const removedSnippets = [];
const toRemove = new Set();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!routeStartRe.test(line)) continue;
  let pathLine = line;
  if (/^app\.(get|post|put|delete|patch)\(\s*$/.test(line)) {
    pathLine = lines[i + 1] || "";
  }
  const pathMatch = pathLine.match(/["']([^"']+)["']/);
  if (!pathMatch) continue;
  const routePath = pathMatch[1];
  if (!patterns.some((p) => p.test(routePath))) continue;

  const end = findBlockEnd(i);
  if (end < 0) {
    console.error(`No block end at line ${i + 1}`);
    process.exit(1);
  }
  for (let k = i; k <= end; k++) toRemove.add(k);
  removed.push({ start: i + 1, end: end + 1, path: routePath });

  if (outPath) {
    let block = lines.slice(i, end + 1).join("\n");
    if (subApp) {
      block = block.replace(
        /^app\.(get|post|put|delete|patch)\(/gm,
        `${subApp}.$1(`,
      );
    }
    if (stripBase) {
      const baseEsc = stripBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Replace "/api/foo/bar" => "/bar"; "/api/foo" => "/"
      block = block.replace(
        new RegExp(`(["'])${baseEsc}((?:/[^"']*)?)(["'])`, "g"),
        (_m, q1, rest, q2) => `${q1}${rest || "/"}${q2}`,
      );
    }
    removedSnippets.push(block);
  }
  i = end;
}

const out = lines.filter((_, idx) => !toRemove.has(idx)).join("\n");
fs.writeFileSync(abs, out, "utf8");
if (outPath && removedSnippets.length > 0) {
  fs.writeFileSync(path.resolve(outPath), removedSnippets.join("\n\n"), "utf8");
}

console.error(`Removed ${removed.length} routes from ${filePath}`);
if (outPath)
  console.error(`Wrote ${removedSnippets.length} blocks to ${outPath}`);
for (const r of removed) console.log(`  ${r.start}-${r.end}  ${r.path}`);
