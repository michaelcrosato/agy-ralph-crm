$ErrorActionPreference = "Stop"
Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT LINT: Biome Linter Check" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command npx -ErrorAction SilentlyContinue) {
    npx biome check .
} else {
    Write-Host "[ERROR] npx is not found. Cannot run Biome linter." -ForegroundColor Red
    exit 1
}
exit 0
