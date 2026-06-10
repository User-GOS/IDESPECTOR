@echo off
cd /d "%~dp0"
title IDespector Server
echo Iniciando IDespector...
echo Acesse: http://localhost:8772/idespector.html
echo APIs: WhatsApp, Telegram, Outlook ICS — porta 8772
start http://localhost:8772/idespector.html
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
