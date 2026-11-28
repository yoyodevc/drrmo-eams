@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0export-db.ps1" %*
pause
