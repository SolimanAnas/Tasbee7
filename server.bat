@echo off
title Tasbee7 Flask Server
cd /d "%~dp0"

echo ====================================
echo  Tasbee7 - Flask Server Launcher
echo ====================================
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python and try again.
    pause
    exit /b 1
)

echo [1/2] Installing Flask...
python -m pip install flask -q

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Flask.
    pause
    exit /b 1
)

echo [2/2] Starting Flask server...
start cmd /k "python server.py"

timeout /t 3 /nobreak >nul

echo.
echo Opening http://localhost:5000 ...
start http://localhost:5000
echo.
echo Server is running. Close the Flask window to stop.
echo ====================================
