$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT CHECK: Comprehensive Verification" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
$Shell = if ($pwshCmd) { $pwshCmd.Source } else { "powershell" }

$failed = 0

Write-Host "Step: formatting checks" -ForegroundColor Cyan
if (Test-Path "scripts/agent/format.ps1") {
    & $Shell -NoProfile -ExecutionPolicy Bypass -File "scripts/agent/format.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] formatting checks failed." -ForegroundColor Red
        $failed++
    }
} else {
    Write-Host "no formatting checks script found (skipping)." -ForegroundColor Yellow
}

Write-Host "Step: linting checks" -ForegroundColor Cyan
if (Test-Path "scripts/agent/lint.ps1") {
    & $Shell -NoProfile -ExecutionPolicy Bypass -File "scripts/agent/lint.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] linting checks failed." -ForegroundColor Red
        $failed++
    }
} else {
    Write-Host "no linting checks script found (skipping)." -ForegroundColor Yellow
}

Write-Host "Step: type checks" -ForegroundColor Cyan
if (Test-Path "scripts/agent/typecheck.ps1") {
    & $Shell -NoProfile -ExecutionPolicy Bypass -File "scripts/agent/typecheck.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] type checks failed." -ForegroundColor Red
        $failed++
    }
} else {
    Write-Host "no type checks script found (skipping)." -ForegroundColor Yellow
}

Write-Host "Step: test suites" -ForegroundColor Cyan
if (Test-Path "scripts/agent/test.ps1") {
    & $Shell -NoProfile -ExecutionPolicy Bypass -File "scripts/agent/test.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] test suites failed." -ForegroundColor Red
        $failed++
    }
} else {
    Write-Host "no test suites script found (skipping)." -ForegroundColor Yellow
}

if ($failed -gt 0) {
    Write-Host "Agent check failed." -ForegroundColor Red
    exit 1
}

Write-Host "All checks passed." -ForegroundColor Green
exit 0
