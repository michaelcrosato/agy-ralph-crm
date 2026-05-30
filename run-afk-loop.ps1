param()

$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot

$AgyCommand = Get-Command agy -ErrorAction SilentlyContinue
$AgyPath = if ($null -ne $AgyCommand) { $AgyCommand.Source } else { $null }
if (-not $AgyPath) {
    $FallbackAgyPath = Join-Path $env:LOCALAPPDATA "agy\bin\agy.exe"
    if (Test-Path $FallbackAgyPath) {
        $AgyPath = $FallbackAgyPath
    }
}

if (-not $AgyPath -or -not (Test-Path $AgyPath)) {
    Write-Host "[ERROR] agy executable not found in PATH or LocalAppData." -ForegroundColor Red
    Write-Host "Install/update the AFK CLI and retry." -ForegroundColor Yellow
    exit 1
}

$Prompt = @'
Read the highest-priority pending ticket in the tickets/ directory,
follow the workflow in AGENTS.md, implement the ticket scope atomically,
run the ticket verification commands, update ticket status and notes,
and then stop so the caller can evaluate handoff state.
'@

function Invoke-WorkspaceCommand {
    param([string]$Command)

    $originalPrefs = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        $commandToRun = "pnpm $Command"
    } else {
        $commandToRun = "`$env:CI = '1'; npx -y pnpm $Command"
    }
    & powershell -NoProfile -Command $commandToRun
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $originalPrefs
    return $exitCode
}

Write-Host "========================================================" -ForegroundColor Green
Write-Host "Starting CRM Core Automation Loop in AFK Mode..." -ForegroundColor Green
Write-Host "Press [Ctrl + C] to terminate this loop." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green

$RunCount = 0

while ($true) {
    $RunCount++
    $Time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "`n[$Time] Starting Run #$RunCount..." -ForegroundColor Cyan

    Write-Host "[CI] Running workspace pre-flight health checks..." -ForegroundColor DarkYellow
    $verifyExit = Invoke-WorkspaceCommand "verify"
    if ($verifyExit -ne 0) {
        Write-Host "[CI Error] pnpm verify failed with exit status $verifyExit." -ForegroundColor Red
        Add-Content -Path "afk_error.log" -Value "[$Time] Run #${RunCount}: CI verify failed with status $verifyExit."
        break
    }

    Write-Host "[CI] Running comprehensive test suite..." -ForegroundColor DarkYellow
    $testExit = Invoke-WorkspaceCommand "test"
    if ($testExit -ne 0) {
        Write-Host "[CI Error] pnpm test failed with exit status $testExit." -ForegroundColor Red
        Add-Content -Path "afk_error.log" -Value "[$Time] Run #${RunCount}: CI test failed with status $testExit."
        break
    }

    Write-Host "CI pre-flight check passed successfully. Initiating agent execution..." -ForegroundColor Green
    & $AgyPath --dangerously-skip-permissions --print-timeout 15m --print $Prompt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: agy exited with non-zero exit code: $LASTEXITCODE" -ForegroundColor Red
    }

    Write-Host "Run #$RunCount completed. Pausing for 5 seconds before next iteration..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5
}
