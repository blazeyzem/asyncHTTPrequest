@echo off
REM Jednorazowe sprawdzenie ceny - do podpiecia pod Harmonogram zadan Windows.
cd /d "%~dp0"
if not exist node_modules ( call npm install )
node monitor.mjs --once >> data\monitor.log 2>&1
