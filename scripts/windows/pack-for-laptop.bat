@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0pack-for-laptop.ps1" %*
pause
