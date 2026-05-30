$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "=========================================" -ForegroundColor Green
Write-Host " AGENT DOCTOR: System Diagnostics" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

if (Get-Command node -ErrorAction SilentlyContinue) {
    $NodeVer = node -v
    Write-Host "Node version: $NodeVer" -ForegroundColor Cyan
    if ($NodeVer -match '^v(\d+)\.(\d+)') {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        if ($major -ne 22 -or $minor -lt 22) {
            Write-Host "[WARN] Target Node baseline is v22.22.0+ (Jan 2026 CVE floor). Current is $NodeVer." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[ERROR] Node.js is not found." -ForegroundColor Red
    exit 1
}

$PM = $null
if (Test-Path "pnpm-lock.yaml") {
    $PM = "pnpm"
} elseif (Test-Path "package-lock.json") {
    $PM = "npm"
} elseif (Test-Path "yarn.lock") {
    $PM = "yarn"
} elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $PM = "pnpm"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $PM = "npm"
} elseif (Get-Command yarn -ErrorAction SilentlyContinue) {
    $PM = "yarn"
}

if ($PM -and (Get-Command $PM -ErrorAction SilentlyContinue)) {
    $PMVer = & $PM -v
    Write-Host "$PM version: $PMVer" -ForegroundColor Cyan
} else {
    Write-Host "[WARN] No package manager command found." -ForegroundColor Yellow
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "Biome check:" -ForegroundColor Cyan
    try {
        pnpm exec biome --version
    } catch {
        Write-Host "Biome is not available via pnpm" -ForegroundColor Yellow
    }
} elseif (Get-Command npx -ErrorAction SilentlyContinue) {
    Write-Host "Biome check:" -ForegroundColor Cyan
    try {
        npx biome --version
    } catch {
        Write-Host "no Biome globally found (will run via local npx)" -ForegroundColor Yellow
    }
} else {
    Write-Host "no npx found" -ForegroundColor Yellow
}

# Advisory check — pnpm audit; informational unless high/critical present.
$advisoryExit = 0
if ((Get-Command pnpm -ErrorAction SilentlyContinue) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Advisories:" -ForegroundColor Cyan
    $auditJson = $null
    try { $auditJson = (pnpm audit --json 2>$null | Out-String) } catch { $auditJson = $null }
    if ($auditJson) {
        try {
            $a = $auditJson | ConvertFrom-Json
            $v = $a.metadata.vulnerabilities
            $c = if ($v.critical) { $v.critical } else { 0 }
            $h = if ($v.high) { $v.high } else { 0 }
            $m = if ($v.moderate) { $v.moderate } else { 0 }
            $l = if ($v.low) { $v.low } else { 0 }
            Write-Host "  $c critical, $h high, $m moderate, $l low"
            if ($c -gt 0 -or $h -gt 0) { $advisoryExit = 2 }
        } catch {
            Write-Host "  (could not parse audit output)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  (no audit output)"
    }
} else {
    Write-Host "Advisories: pnpm or node unavailable (skipped)" -ForegroundColor Yellow
}

# Outdated check — informational only.
if ((Get-Command pnpm -ErrorAction SilentlyContinue) -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Outdated (major):" -ForegroundColor Cyan
    $outdatedJson = $null
    try { $outdatedJson = (pnpm outdated --recursive --format json 2>$null | Out-String) } catch { $outdatedJson = $null }
    if ($outdatedJson) {
        try {
            # Find first line that begins with `{` or `[` to skip pnpm engine warnings.
            $match = [regex]::Match($outdatedJson, '(?ms)^[{\[].*$')
            if ($match.Success) { $outdatedJson = $match.Value }
            $o = $outdatedJson | ConvertFrom-Json
            $majors = 0
            foreach ($prop in $o.PSObject.Properties) {
                $entry = $prop.Value
                $cur = ($entry.current -split '\.')[0]
                $lat = ($entry.latest -split '\.')[0]
                if ($cur -and $lat -and $cur -ne $lat) { $majors++ }
            }
            Write-Host "  $majors package(s) with a newer major"
        } catch {
            Write-Host "  (could not parse outdated output)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  0 package(s) with a newer major"
    }
}

# Drizzle migration validation check
Write-Host "Step: Drizzle Migrations Check" -ForegroundColor Cyan
node scripts/agent/check-migrations.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Drizzle migrations validation failed." -ForegroundColor Red
    exit 1
}

if ($advisoryExit -ne 0) {
    Write-Host "[ERROR] high or critical advisories present; address before continuing." -ForegroundColor Red
    exit $advisoryExit
}

Write-Host "Diagnostics complete." -ForegroundColor Green
exit 0
