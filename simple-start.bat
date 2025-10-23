@echo off
echo Starting PSH Tracking Platform...
echo.
echo This window will stay open and show the server output.
echo Press Ctrl+C to stop the server when you're done.
echo.

cd /d "C:\Users\Kody Barnett\PSH Tracking Platform\psh-tracker"

echo Current directory: %CD%
echo.

if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Make sure this file is in the psh-tracker folder.
    echo.
    pause
    exit /b 1
)

echo Starting the development server on port 5185...
echo The server will run in this window.
echo Once it starts, open Chrome and go to: http://localhost:5185
echo.
echo Press Ctrl+C to stop the server.
echo.

npm run dev

echo.
echo Server stopped.
pause
