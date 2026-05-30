$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT FORMAT: Biome Auto-Formatter" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx -y biome check --write .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Biome format check failed." -ForegroundColor Red
        exit 1
    }
} elseif (Get-Command biome -ErrorAction SilentlyContinue) {
    biome check --write .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Biome format check failed." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERROR] npx is not found. Cannot run Biome formatter." -ForegroundColor Red
    exit 1
}
exit 0
