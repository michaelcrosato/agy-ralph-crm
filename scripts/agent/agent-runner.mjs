import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!command) {
  console.error("Usage: node scripts/agent/agent-runner.mjs <command>");
  process.exit(1);
}

const runnerDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(runnerDir, "..", "..");
const scriptBase = join(runnerDir, command);
const ps1Path = `${scriptBase}.ps1`;
const shPath = `${scriptBase}.sh`;

function hasCommand(name) {
  const probe =
    process.platform === "win32"
      ? spawnSync("cmd", ["/c", `where ${name}`], {
          encoding: "utf8",
          windowsHide: true,
        })
      : spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" });
  return probe.status === 0;
}

function exec(args) {
  const child = spawnSync(args[0], args.slice(1), {
    stdio: "inherit",
    shell: false,
    cwd: repoRoot,
  });
  process.exit(child.status ?? 1);
}

if (process.platform === "win32" && existsSync(ps1Path)) {
  if (hasCommand("pwsh")) {
    exec(["pwsh", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1Path]);
  }
  if (hasCommand("powershell")) {
    exec([
      "powershell",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      ps1Path,
    ]);
  }
}

if (existsSync(shPath) && hasCommand("bash")) {
  exec(["bash", shPath]);
}

if (process.platform === "win32" && existsSync(ps1Path)) {
  console.error(
    `Found ${ps1Path} but no PowerShell/bash available to run it. Install PowerShell 7+ or Git Bash.`,
  );
} else {
  console.error(`No executable agent script found for command "${command}".`);
}
process.exit(1);
