$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT STATUS: Git Repository Status" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command git -ErrorAction SilentlyContinue) {
    git status
} else {
    Write-Host "[WARN] git command not found." -ForegroundColor Yellow
}
exit 0
