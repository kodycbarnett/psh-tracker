@echo off
echo ===============================================
echo    PSH Platform Setup Test
echo ===============================================
echo.

echo Testing basic requirements...
echo.

echo 1. Checking current directory:
echo    %CD%
echo.

echo 2. Checking if we're in the right project folder:
if exist "package.json" (
    echo    ✅ package.json found - we're in the right place!
) else (
    echo    ❌ package.json NOT found - wrong directory!
    echo    Expected to be in: psh-tracker folder
    pause
    exit /b 1
)

echo 3. Checking Node.js:
node --version >nul 2>&1
if errorlevel 1 (
    echo    ❌ Node.js not found - please install Node.js
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo    ✅ Node.js version: %%i
)

echo 4. Checking npm:
npm --version >nul 2>&1
if errorlevel 1 (
    echo    ❌ npm not found
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do echo    ✅ npm version: %%i
)

echo 5. Checking if dependencies are installed:
if exist "node_modules" (
    echo    ✅ Dependencies are installed
) else (
    echo    ⚠️  Dependencies not installed - will install when needed
)

echo 6. Testing npm run dev command:
echo    Running: npm run dev
echo    (This will start the server - press Ctrl+C to stop it)
echo.
echo    If this works, you should see the Vite server start and
echo    it will show: Local: http://localhost:5175
echo.
echo    Press any key to start the test...
pause >nul

npm run dev
