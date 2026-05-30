param()

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT BOOTSTRAP: Workspace Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# corepack activates the pnpm version declared in packageManager
if (Get-Command corepack -ErrorAction SilentlyContinue) {
    try { corepack enable 2>$null } catch { Write-Host "[WARN] corepack enable failed (non-fatal)" -ForegroundColor Yellow }
}

$PMFallback = $null
$PM = $null
if (Test-Path "pnpm-lock.yaml") {
    $PM = "pnpm"
} elseif (Test-Path "package-lock.json") {
    $PM = "npm"
} elseif (Test-Path "yarn.lock") {
    $PM = "yarn"
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $PM = "pnpm"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $PM = "npm"
} elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
    $PM = "yarn"
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    $PM = "npx"
    $PMFallback = "npx -y pnpm"
} else {
    Write-Host "[WARN] No supported package manager found." -ForegroundColor Yellow
    exit 1
}

Write-Host "Detected package manager: $PM" -ForegroundColor Cyan
if ($PM -eq "npx" -and $PMFallback) {
    $PM = "pnpm"
}

if (-not (Get-Command $PM -ErrorAction SilentlyContinue)) {
    if ($PM -eq "pnpm" -and (Get-Command npx -ErrorAction SilentlyContinue)) {
        Write-Host "[WARN] pnpm not found; using npx fallback." -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] $PM is not installed. Please install it first." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Running installation..." -ForegroundColor Cyan
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
} else {
    $oldCI = $env:CI
    $env:CI = "1"
    npx -y pnpm install
    $env:CI = $oldCI
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

Write-Host "Bootstrap completed successfully." -ForegroundColor Green
exit 0
