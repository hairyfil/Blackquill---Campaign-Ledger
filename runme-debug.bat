@echo off
setlocal
cd /d "%~dp0"
set "SCRIPT_NAME=%~nx0"

echo =====================================
echo BlackQuill v1.0.8  [DEBUG MODE]
echo =====================================

call :checknode
if errorlevel 1 goto failed

if not exist node_modules goto notinstalled
if not exist client\dist\index.html goto notinstalled

echo Starting BlackQuill with debug forced on...
set BLACKQUILL_DEBUG=1
call npm run server -- --debug %*
pause
exit /b 0

:notinstalled
echo.
echo BlackQuill is not installed yet. Run install.bat first.
pause
exit /b 1

:failed
pause
exit /b 1

:checknode
rem Node.js 22.12 or later (with npm) must be installed and on the PATH.
where node >nul 2>nul
if errorlevel 1 goto nonode
set "NODE_VER="
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a==22&&b>=12)?0:1)" >nul 2>nul
if errorlevel 1 goto oldnode
where npm >nul 2>nul
if errorlevel 1 goto nonpm
exit /b 0

:nonode
echo.
echo Node.js is not installed (or Windows cannot find it).
echo BlackQuill needs Node.js 22.12 or later to run.
goto getnode

:oldnode
echo.
echo Node.js %NODE_VER% is installed, but BlackQuill needs Node.js 22.12 or later.
goto getnode

:nonpm
echo.
echo Node.js is installed, but npm (which comes with it) cannot be found.
echo Reinstalling Node.js with the default options usually fixes this.
goto getnode

:getnode
echo.
echo  1. Download the LTS version from https://nodejs.org (22 or later).
echo  2. Install it with the default options.
echo  3. Close this window and double-click %SCRIPT_NAME% again.
echo     If it still says Node.js is missing, restart the PC and try again.
echo.
choice /c YN /n /m "Open the Node.js download page now? [Y/N] "
if errorlevel 2 exit /b 1
start "" "https://nodejs.org/en/download"
exit /b 1
