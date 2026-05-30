$ErrorActionPreference = "Stop"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT FORMAT: Biome Auto-Formatter" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx biome check --write .
} else {
    Write-Host "[ERROR] npx is not found. Cannot run Biome formatter." -ForegroundColor Red
    exit 1
}
exit 0
