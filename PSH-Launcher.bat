@echo off
echo ===============================================
echo    PSH Tracking Platform - One Click Launcher
echo ===============================================
echo.
echo Starting server and opening Chrome automatically...
echo.

REM Change to project directory
cd /d "C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker"

REM Start the development server in a new minimized window
echo Starting development server on port 5185...
start "PSH Development Server" /min cmd /c "npm run dev & pause"

REM Wait for server to start
echo Waiting for server to start (8 seconds)...
timeout /t 8 /nobreak >nul

REM Open Chrome to the application
echo Opening PSH Tracking Platform in Chrome...
start chrome --new-window --app=http://localhost:5185

echo.
echo ===============================================
echo    PSH Platform Started Successfully!
echo ===============================================
echo.
echo ✅ Development server is running on port 5185
echo ✅ Chrome should have opened automatically
echo ✅ Your real applicant data is available
echo.
echo The server is running in a minimized window.
echo To stop the server: Close the "PSH Development Server" window
echo.
echo This launcher window will close in 5 seconds...
timeout /t 5 /nobreak >nul
