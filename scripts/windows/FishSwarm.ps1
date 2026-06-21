$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

if (-not (Test-Path "package.json")) {
  throw "FishSwarm package.json was not found at $projectRoot"
}

Write-Host "Starting FishSwarm from $projectRoot" -ForegroundColor Cyan
npm run dev
