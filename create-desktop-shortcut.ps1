# Script to create a desktop shortcut for the PSH Tracking Platform
# Run this script as Administrator for best results

Write-Host "Creating Desktop Shortcut for PSH Tracking Platform..." -ForegroundColor Green

# Get the current script location
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$batchFilePath = Join-Path $scriptPath "start-psh-app.bat"
$ps1FilePath = Join-Path $scriptPath "start-psh-app.ps1"

# Check which launcher script exists
$launcherPath = ""
$launcherName = ""

if (Test-Path $ps1FilePath) {
    $launcherPath = $ps1FilePath
    $launcherName = "start-psh-app.ps1"
    Write-Host "Using PowerShell launcher script" -ForegroundColor Cyan
} elseif (Test-Path $batchFilePath) {
    $launcherPath = $batchFilePath
    $launcherName = "start-psh-app.bat"
    Write-Host "Using Batch launcher script" -ForegroundColor Cyan
} else {
    Write-Host "Error: No launcher script found!" -ForegroundColor Red
    Write-Host "Please make sure start-psh-app.bat or start-psh-app.ps1 exists in the same directory." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Get desktop path
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "PSH Tracking Platform.lnk"

# Create WScript.Shell object
$WScriptShell = New-Object -ComObject WScript.Shell

# Create shortcut
$Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $launcherPath
$Shortcut.WorkingDirectory = $scriptPath
$Shortcut.Description = "Launch PSH Tracking Platform - Starts the development server and opens the application in Chrome"
$Shortcut.IconLocation = "C:\Program Files\Google\Chrome\Application\chrome.exe,0"

# If using PowerShell script, set the target to PowerShell
if ($launcherName -eq "start-psh-app.ps1") {
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$launcherPath`""
}

# Save the shortcut
$Shortcut.Save()

Write-Host ""
Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Location: $shortcutPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now double-click 'PSH Tracking Platform' on your desktop to:" -ForegroundColor Yellow
Write-Host "  1. Start the development server" -ForegroundColor White
Write-Host "  2. Automatically open Chrome to http://localhost:5175" -ForegroundColor White
Write-Host ""
Write-Host "To stop the server, close the minimized command window that opens." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"
