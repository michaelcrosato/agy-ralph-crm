param()

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT E2E: End-to-End Test Check" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$hasConfig = $false
if (Test-Path "e2e/config.ts" -PathType Leaf) { $hasConfig = $true }
if (Test-Path "playwright.config.ts" -PathType Leaf) { $hasConfig = $true }
if (Test-Path "playwright.config.js" -PathType Leaf) { $hasConfig = $true }
if (Test-Path "playwright.config.mjs" -PathType Leaf) { $hasConfig = $true }
if (Test-Path "playwright.config.cjs" -PathType Leaf) { $hasConfig = $true }

if ($hasConfig) {
    if ((Test-Path "pnpm-workspace.yaml" -PathType Leaf) -and (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        pnpm exec playwright test
    } elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        npx playwright test
    } else {
        Write-Host "[ERROR] No package-manager or npx fallback available to run Playwright." -ForegroundColor Red
        exit 1
    }

    if ($LASTEXITCODE -ne 0) {
        exit 1
    }
} else {
    Write-Host "[WARN] No E2E Playwright config found. Skipping e2e checks." -ForegroundColor Yellow
}

exit 0
