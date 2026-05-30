$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT DOCTOR: System Diagnostics" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeVer = node -v
    Write-Host "Node version: $NodeVer" -ForegroundColor Cyan
    if ($NodeVer -notmatch "^v22") {
        Write-Host "[WARN] Target Node baseline is v22.0.0. Current is $NodeVer." -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERROR] Node.js is not found." -ForegroundColor Red
    exit 1
}

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
}

if ($PM -and (Get-Command $PM -ErrorAction SilentlyContinue)) {
    $PMVer = & $PM -v
    Write-Host "$PM version: $PMVer" -ForegroundColor Cyan
} else {
    Write-Host "[WARN] No package manager command found." -ForegroundColor Yellow
}

if (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "Biome check:" -ForegroundColor Cyan
    try {
        npx biome --version
    } catch {
        Write-Host "no Biome globally found (will run via local npx)" -ForegroundColor Yellow
    }
} else {
    Write-Host "no npx found" -ForegroundColor Yellow
}

Write-Host "Diagnostics complete." -ForegroundColor Green
exit 0
