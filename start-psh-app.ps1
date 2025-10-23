# PSH Tracking Platform Launcher
# This script starts the development server and opens the app in Chrome

Write-Host "Starting PSH Tracking Platform..." -ForegroundColor Green
Write-Host ""

# Set the project directory
$projectDir = "C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker"

# Check if the project directory exists
if (-not (Test-Path $projectDir)) {
    Write-Host "Error: Project directory not found at $projectDir" -ForegroundColor Red
    Write-Host "Please update the path in this script to match your project location." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Change to the project directory
Set-Location $projectDir

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version 2>$null
    Write-Host "npm version: $npmVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: npm is not available" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Start the development server in a new window
Write-Host "Starting development server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir'; npm run dev" -WindowStyle Minimized

# Wait for the server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

# Check if Chrome is available
$chromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if ($chromePath) {
    Write-Host "Opening PSH Tracking Platform in Chrome..." -ForegroundColor Green
    Start-Process $chromePath -ArgumentList "--new-window", "--app=http://localhost:5175"
} else {
    Write-Host "Chrome not found. Opening in default browser..." -ForegroundColor Yellow
    Start-Process "http://localhost:5175"
}

Write-Host ""
Write-Host "PSH Tracking Platform is starting up!" -ForegroundColor Green
Write-Host "The development server is running in a minimized PowerShell window." -ForegroundColor Cyan
Write-Host "Chrome should open automatically to http://localhost:5175" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the server, close the minimized PowerShell window." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit this launcher"
