# Temi VMS — PowerShell dev launcher
# Usage: .\start-dev.ps1

Write-Host "Starting Temi VMS in development mode..." -ForegroundColor Cyan

# Check .env exists
if (-not (Test-Path "backend\.env")) {
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host ".env created from example — please edit backend\.env before continuing." -ForegroundColor Yellow
    notepad "backend\.env"
    exit
}

# Start backend in background
Write-Host "Starting backend (port 5000)..." -ForegroundColor Green
$backend = Start-Process -FilePath "cmd" `
    -ArgumentList "/c cd backend && npm run dev" `
    -WorkingDirectory $PSScriptRoot `
    -PassThru -WindowStyle Normal

Start-Sleep -Seconds 3

# Start frontend in background
Write-Host "Starting frontend (port 5173)..." -ForegroundColor Green
$frontend = Start-Process -FilePath "cmd" `
    -ArgumentList "/c cd frontend && npm run dev" `
    -WorkingDirectory $PSScriptRoot `
    -PassThru -WindowStyle Normal

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Backend  : http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Health   : http://localhost:5000/health" -ForegroundColor White
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C or close windows to stop." -ForegroundColor Gray
