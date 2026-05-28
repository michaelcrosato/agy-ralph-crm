# Continuous AFK CRM Core Feature Generation Loop
# This script executes the Antigravity agent in an endless loop to incrementally
# build, verify, and commit high-value features.

$AgyPath = "C:\Users\Michael Crosato\AppData\Local\agy\bin\agy.exe"
$Prompt = "/goal review the features that are production/commercial ready for the CRM, research the next highest value common feature that aligns with the coding style and structure of this CRM the most, write its design/requirements specs, implement it, test it until production-ready, verify lint/compile check, commit it, and repeat."

Write-Host "========================================================" -ForegroundColor Green
Write-Host "Starting CRM Core Automation Loop in AFK Mode..." -ForegroundColor Green
Write-Host "Press [Ctrl + C] to terminate this loop." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green

$RunCount = 0

while ($true) {
    $RunCount++
    $Time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "`n[$Time] Starting Run #$RunCount..." -ForegroundColor Cyan
    
    # Execute the Antigravity CLI binary directly with correct flags and a 15-minute timeout
    & $AgyPath --dangerously-skip-permissions --print-timeout 15m --print $Prompt
    
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ne 0) {
        Write-Host "Warning: agy exited with non-zero exit code: $ExitCode" -ForegroundColor Red
    }
    
    Write-Host "Run #$RunCount completed. Pausing for 5 seconds before next iteration..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
