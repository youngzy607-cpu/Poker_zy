@echo off
chcp 65001 >nul

rem 德州扑克服务器启动脚本
rem Version: v3.3.1

echo ===============================================
echo 德州扑克服务器启动脚本
echo Current directory: %cd%
echo ===============================================

rem Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    echo Download URL: https://nodejs.org/
    pause
    exit /b 1
)

echo Found Node.js installation
node --version

rem Change to server directory
cd /d "%~dp0server"

rem Check if package.json exists
if not exist "package.json" (
    echo Error: package.json file not found. Please ensure the current directory is the server directory.
    pause
    exit /b 1
)

rem Check if node_modules directory exists, install dependencies if not
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
    echo Dependencies installed successfully
)

rem Check if port 3000 is occupied
netstat -ano | findstr :3000 >nul 2>nul
if %errorlevel% equ 0 (
    echo Warning: Port 3000 is already in use
    echo Trying to terminate the process occupying the port...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /f /pid %%a >nul 2>nul
        if %errorlevel% equ 0 (
            echo Successfully terminated process %%a
        ) else (
            echo Failed to terminate process %%a
        )
    )
    echo.
)

rem Start the server
echo Starting server...
echo ===============================================
echo Server will run at http://localhost:3000
echo Press Ctrl+C to stop the server
echo ===============================================
echo.

npm start

rem Capture Ctrl+C event
echo.
echo Server stopped
pause
