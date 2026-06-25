@echo off
cd /d "%~dp0"
echo ===================================================
echo Starting Next.js and Inngest servers...
echo The web application and Inngest dashboard will open
echo in your browser shortly.
echo ===================================================
echo.

:: Open browsers in a background process after a 5 second delay to let servers start
start /b cmd /c "timeout /t 5 >nul && start http://localhost:3000 && start http://localhost:8288"

:: Start the Next.js and Inngest development servers
npm run dev:all
