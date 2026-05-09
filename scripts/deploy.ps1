# Webmin deploy script
# Run from the repo root: .\scripts\deploy.ps1
# Requires: firebase-tools installed and authenticated
# To install:   npm install -g firebase-tools
# To auth:      firebase login

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

Write-Host "Building client..." -ForegroundColor Cyan
npm run build
if (-not $?) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }

Write-Host "Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy
if (-not $?) { Write-Host "Deploy failed." -ForegroundColor Red; exit 1 }

Write-Host "Done." -ForegroundColor Green
