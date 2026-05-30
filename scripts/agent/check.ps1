$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT CHECK: Comprehensive Verification" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

function Invoke-AgentStep {
    param([string]$Name, [string]$Script)
    Write-Host "Step: $Name" -ForegroundColor Cyan
    if (Test-Path $Script) {
        $null = & powershell -ExecutionPolicy Bypass -File $Script
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] $Name failed." -ForegroundColor Red
            return 1
        }
        return 0
    }
    Write-Host "no $Name script found (skipping)." -ForegroundColor Yellow
    return 0
}

$failed = 0

$failed += Invoke-AgentStep -Name "formatting checks" -Script "scripts/agent/format.ps1"
$failed += Invoke-AgentStep -Name "linting checks" -Script "scripts/agent/lint.ps1"
$failed += Invoke-AgentStep -Name "type checks" -Script "scripts/agent/typecheck.ps1"
$failed += Invoke-AgentStep -Name "test suites" -Script "scripts/agent/test.ps1"

if ($failed -gt 0) {
    Write-Host "Agent check failed." -ForegroundColor Red
} else {
    Write-Host "All checks passed." -ForegroundColor Green
}
exit $failed
