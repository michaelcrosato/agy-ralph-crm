# Continuous AFK CRM Core Feature Generation Loop & CI Hook
# This script executes the Antigravity agent in an endless loop to incrementally
# build, verify, and commit high-value features, wrapped in a strict Phase 7 CI pre-flight check.

$AgyPath = "C:\Users\Michael Crosato\AppData\Local\agy\bin\agy.exe"
$Prompt = "/goal Read C:\Users\Michael Crosato\.gemini\antigravity-cli\brain\8dbbde2b-9dd7-487d-bd77-c3d0ed09e639\afk_execution_blueprint.md, find the next unimplemented specification task, write its specification, implement the code, write thorough RLS and integration tests, verify the workspace compiles and lint checks pass cleanly using pnpm verify, commit the changes to git, and stop so the script can execute the next step."

Write-Host "========================================================" -ForegroundColor Green
Write-Host "Starting CRM Core Automation Loop in AFK Mode..." -ForegroundColor Green
Write-Host "Press [Ctrl + C] to terminate this loop." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green

$RunCount = 0

while ($true) {
    $RunCount++
    $Time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "`n[$Time] Starting Run #$RunCount..." -ForegroundColor Cyan
    
    # ----------------------------------------------------
    # Phase 7 CI Pre-Flight Health Mappings
    # ----------------------------------------------------
    Write-Host "Executing Continuous Integration pre-flight health checks..." -ForegroundColor DarkYellow
    
    # 1. Clean Git Status Verification
    Write-Host "[CI] Verifying repository clean status..." -ForegroundColor Gray
    $GitStatus = git status --porcelain
    if ($GitStatus) {
        Write-Host "[CI Warning] Dirty repository detected! Uncommitted changes exist:" -ForegroundColor Yellow
        Write-Host $GitStatus -ForegroundColor DarkYellow
    } else {
        Write-Host "[CI Check] Repository is clean." -ForegroundColor Green
    }
    
    # 2. Workspace Compilation & Verification
    Write-Host "[CI] Running workspace verify pipeline (lint/format/compile)..." -ForegroundColor Gray
    pnpm verify
    $VerifyExitCode = $LASTEXITCODE
    if ($VerifyExitCode -ne 0) {
        Write-Host "[CI Error] pnpm verify failed with exit status $VerifyExitCode. Halting loop to prevent drift!" -ForegroundColor Red
        $ErrorMsg = "[$Time] Run #$RunCount: CI pnpm verify failed with status $VerifyExitCode."
        Add-Content -Path "afk_error.log" -Value $ErrorMsg
        break
    }
    Write-Host "[CI Check] Workspace compilation and Biome linting passed." -ForegroundColor Green
    
    # 3. Workspace Integration Tests
    Write-Host "[CI] Running comprehensive test suite..." -ForegroundColor Gray
    pnpm test
    $TestExitCode = $LASTEXITCODE
    if ($TestExitCode -ne 0) {
        Write-Host "[CI Error] pnpm test failed with exit status $TestExitCode. Halting loop to prevent regression!" -ForegroundColor Red
        $ErrorMsg = "[$Time] Run #$RunCount: CI pnpm test failed with status $TestExitCode."
        Add-Content -Path "afk_error.log" -Value $ErrorMsg
        break
    }
    Write-Host "[CI Check] All integration and unit tests passed." -ForegroundColor Green
    
    Write-Host "CI pre-flight check passed successfully. Initiating agent execution..." -ForegroundColor Green
    
    # Execute the Antigravity CLI binary directly with correct flags and a 15-minute timeout
    & $AgyPath --dangerously-skip-permissions --print-timeout 15m --print $Prompt
    
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ne 0) {
        Write-Host "Warning: agy exited with non-zero exit code: $ExitCode" -ForegroundColor Red
    }
    
    Write-Host "Run #$RunCount completed. Pausing for 5 seconds before next iteration..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
