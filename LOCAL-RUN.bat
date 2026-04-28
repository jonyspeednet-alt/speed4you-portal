@echo off
cd /d "%~dp0"
echo Starting ISP Entertainment Portal (Local Dev Mode)...
powershell -ExecutionPolicy Bypass -File ".\scripts\run-local.ps1"
pause
