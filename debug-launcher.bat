@echo off
echo ===============================================
echo    PSH Platform Debug Launcher
echo ===============================================
echo.
echo This window will stay open so you can see any errors.
echo.

REM Change to the project directory
echo Step 1: Changing to project directory...
cd /d "C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker"
echo Current directory is now: %CD%
echo.

REM Check if package.json exists
echo Step 2: Checking for package.json...
if exist "package.json" (
    echo ✅ package.json found!
) else (
    echo ❌ package.json NOT found!
    echo This means we're not in the right directory.
    echo.
    echo Files in current directory:
    dir /b
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo.

REM Check Node.js
echo Step 3: Checking Node.js...
node --version
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo ✅ Node.js is working!
echo.

REM Check npm
echo Step 4: Checking npm...
npm --version
if errorlevel 1 (
    echo ❌ npm is not available
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo ✅ npm is working!
echo.

REM Check dependencies
echo Step 5: Checking dependencies...
if exist "node_modules" (
    echo ✅ Dependencies are installed
) else (
    echo ⚠️ Dependencies need to be installed
    echo Installing dependencies now...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        echo.
        echo Press any key to exit...
        pause >nul
        exit /b 1
    )
    echo ✅ Dependencies installed successfully!
)
echo.

REM Try to start the server
echo Step 6: Starting the development server...
echo This will open in a new window. The server window will stay open.
echo.
echo Press any key to start the server...
pause >nul

start "PSH Server" cmd /k "npm run dev"

echo.
echo Step 7: Waiting for server to start...
echo Waiting 15 seconds for the server to fully start...
timeout /t 15 /nobreak >nul

echo.
echo Step 8: Checking if server is running...
netstat -an | findstr ":5175"
if errorlevel 1 (
    echo ❌ Server doesn't appear to be running on port 5175
    echo Check the server window for error messages
) else (
    echo ✅ Server appears to be running on port 5175!
)

echo.
echo Step 9: Opening Chrome...
start chrome http://localhost:5175

echo.
echo ===============================================
echo    Debug Complete
echo ===============================================
echo.
echo What should happen:
echo 1. A new window opened with the development server
echo 2. Chrome should have opened to http://localhost:5175
echo.
echo If Chrome didn't open or shows an error:
echo 1. Check the server window for error messages
echo 2. Wait a bit longer for the server to start
echo 3. Manually open Chrome and go to http://localhost:5175
echo.
echo This debug window will stay open.
echo Close it when you're done testing.
echo.
pause
