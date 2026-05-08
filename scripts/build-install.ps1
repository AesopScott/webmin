$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\scott\Code\webmin"

Write-Host "[webmin-build] Building client..."
npm run build

Write-Host "[webmin-build] Starting server..."
npm start
