$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT LINT: Biome Linter Check" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx -y biome check .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Biome lint failed." -ForegroundColor Red
        exit 1
    }
} elseif (Get-Command biome -ErrorAction SilentlyContinue) {
    biome check .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Biome lint failed." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERROR] npx is not found. Cannot run Biome linter." -ForegroundColor Red
    exit 1
}
exit 0
