@echo off
echo ===============================================
echo    PSH Tracking Platform Launcher (Debug)
echo ===============================================
echo.
echo Current directory: %CD%
echo.

REM Change to the project directory
echo Changing to project directory...
cd /d "C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker"
if errorlevel 1 (
    echo ERROR: Could not change to project directory!
    echo Expected path: C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker
    echo Current path: %CD%
    echo.
    echo Please check that the path is correct.
    pause
    exit /b 1
)
echo Project directory: %CD%
echo.

REM Check if package.json exists
if not exist "package.json" (
    echo ERROR: package.json not found in project directory!
    echo This means we're not in the right folder.
    echo.
    echo Files in current directory:
    dir /b
    echo.
    pause
    exit /b 1
)
echo package.json found - we're in the right directory!
echo.

REM Check if Node.js is installed
echo Checking Node.js installation...
node --version
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo Node.js is installed and working!
echo.

REM Check if npm is available
echo Checking npm installation...
npm --version
if errorlevel 1 (
    echo ERROR: npm is not available
    echo.
    pause
    exit /b 1
)
echo npm is installed and working!
echo.

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    echo This may take a few minutes...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
) else (
    echo Dependencies already installed.
)
echo.

REM Start the development server in the background
echo Starting development server...
echo Opening a new window for the server...
start "PSH Development Server" cmd /c "npm run dev & pause"

REM Wait for the server to start
echo Waiting for server to start (10 seconds)...
timeout /t 10 /nobreak >nul

REM Check if server is running
echo Checking if server is running...
netstat -an | findstr ":5175" >nul
if errorlevel 1 (
    echo WARNING: Server may not be running on port 5175
    echo Let's try to open Chrome anyway...
) else (
    echo Server appears to be running on port 5175!
)

REM Open Chrome to the application
echo Opening PSH Tracking Platform in Chrome...
start chrome --new-window --app=http://localhost:5175

echo.
echo ===============================================
echo    PSH Tracking Platform Status
echo ===============================================
echo.
echo The development server should be starting in a new window.
echo Chrome should open automatically to http://localhost:5175
echo.
echo If Chrome didn't open automatically:
echo 1. Wait a few more seconds for the server to fully start
echo 2. Manually open Chrome and go to: http://localhost:5175
echo.
echo To stop the server: Close the "PSH Development Server" window
echo.
echo Press any key to close this launcher window...
pause >nul
