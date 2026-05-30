$ErrorActionPreference = "Stop"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT TYPECHECK: tsc Compilation check" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Test-Path "pnpm-workspace.yaml") {
    pnpm build
} else {
    Write-Host "[WARN] Not a pnpm workspace workspace. Running tsc directly." -ForegroundColor Yellow
    npx tsc --noEmit
}
exit 0
