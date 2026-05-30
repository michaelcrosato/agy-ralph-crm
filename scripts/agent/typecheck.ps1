$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT TYPECHECK: tsc Compilation check" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Test-Path "pnpm-workspace.yaml") {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm build
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        $oldCI = $env:CI
        $env:CI = "1"
        npx -y pnpm build
        $env:CI = $oldCI
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        Write-Host "[ERROR] pnpm not found. Cannot run workspace typecheck." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[WARN] Not a pnpm workspace workspace. Running tsc directly." -ForegroundColor Yellow
    if (Get-Command npx -ErrorAction SilentlyContinue) {
        npx tsc --noEmit
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        Write-Host "[ERROR] npx not found. Cannot run tsc typecheck." -ForegroundColor Red
        exit 1
    }
}
exit 0
