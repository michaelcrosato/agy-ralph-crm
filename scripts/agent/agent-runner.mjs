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
const scriptBase = join(runnerDir, command);

function resolveCommand(name) {
  const result = spawnSync("cmd", ["/c", `where ${name}`], {
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0;
}

function run(args) {
  const child = spawnSync(args[0], args.slice(1), {
    stdio: "inherit",
    shell: false,
    cwd: resolve(runnerDir, "..", ".."),
  });
  process.exit(child.status ?? 1);
}

if (process.platform === "win32") {
  const scriptPaths = {
    ps1: `${scriptBase}.ps1`,
    sh: `${scriptBase}.sh`,
  };

  if (existsSync(scriptPaths.ps1)) {
    if (resolveCommand("pwsh")) {
      run([
        "pwsh",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPaths.ps1,
      ]);
    } else if (resolveCommand("powershell")) {
      run([
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPaths.ps1,
      ]);
    } else if (resolveCommand("bash") && existsSync(scriptPaths.sh)) {
      run(["bash", scriptPaths.sh]);
    }
  } else if (resolveCommand("bash") && existsSync(scriptPaths.sh)) {
    run(["bash", scriptPaths.sh]);
  }
}

if (existsSync(`${scriptBase}.sh`)) {
  run(["bash", `${scriptBase}.sh`]);
}

console.error(`No executable agent script found for command "${command}".`);
process.exit(1);
