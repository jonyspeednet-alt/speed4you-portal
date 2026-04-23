@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\scripts\one-click-deploy.ps1"
pause
