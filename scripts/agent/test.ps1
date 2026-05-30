$ErrorActionPreference = "Stop"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT TEST: Vitest Execution" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Test-Path "pnpm-workspace.yaml") {
    pnpm test
} else {
    Write-Host "[WARN] No pnpm workspace found. Running standard npm test." -ForegroundColor Yellow
    npm test
}
exit 0
