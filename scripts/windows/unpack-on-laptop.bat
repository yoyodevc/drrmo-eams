@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0unpack-on-laptop.ps1" %*
pause
