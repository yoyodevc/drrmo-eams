@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-tunnel.ps1" %*
pause
