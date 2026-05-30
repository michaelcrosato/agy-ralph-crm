$ErrorActionPreference = "Stop"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT BOOTSTRAP: Workspace Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$PM = "pnpm"
if (Test-Path "pnpm-lock.yaml") {
    $PM = "pnpm"
} elseif (Test-Path "package-lock.json") {
    $PM = "npm"
} elseif (Test-Path "yarn.lock") {
    $PM = "yarn"
} else {
    Write-Host "[WARN] No lockfile found. Defaulting to pnpm." -ForegroundColor Yellow
}

Write-Host "Detected package manager: $PM" -ForegroundColor Cyan

if (-not (Get-Command $PM -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] $PM is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host "Running installation..." -ForegroundColor Cyan
& $PM install

Write-Host "Bootstrap completed successfully." -ForegroundColor Green
exit 0
