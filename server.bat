@echo off
cd /d "%~dp0"
echo Starting Tasbee7 server...
start "Tasbee7 Server" python server.py
timeout /t 2 /nobreak >nul
start http://localhost:8080
