$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT TEST: Vitest Execution" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Test-Path "pnpm-workspace.yaml") {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm test
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        $oldCI = $env:CI
        $env:CI = "1"
        npx -y pnpm test
        $env:CI = $oldCI
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        Write-Host "[ERROR] pnpm and npx not found. Cannot run workspace tests." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[WARN] No pnpm workspace found. Running standard npm test." -ForegroundColor Yellow
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm test
        if ($LASTEXITCODE -ne 0) { exit 1 }
    } else {
        Write-Host "[ERROR] npm not found. No test command available." -ForegroundColor Red
        exit 1
    }
}
exit 0
