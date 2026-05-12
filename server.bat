@echo off
echo Starting Python server...

:: Open the server in a new command prompt window so you can see its logs
start cmd /k "python server.py"

:: Wait 2 seconds to give the server time to fully start up
timeout /t 2 /nobreak >nul

echo Opening index.html...

:: Open the HTML file in your default web browser
start index.html