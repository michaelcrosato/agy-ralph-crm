$ErrorActionPreference = "Stop"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT CHECK: Comprehensive Verification" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

Write-Host "Step 1: Running linting checks..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "scripts/agent/lint.ps1"

Write-Host "Step 2: Running type checks..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "scripts/agent/typecheck.ps1"

Write-Host "Step 3: Running test suites..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "scripts/agent/test.ps1"

Write-Host "All checks passed successfully." -ForegroundColor Green
exit 0
