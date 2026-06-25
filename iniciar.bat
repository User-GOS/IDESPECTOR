@echo off
cd /d "%~dp0"
title IDespector Server
echo Iniciando IDespector...
echo Acesse: http://localhost:8772/idespector.html
echo APIs: WhatsApp, Telegram, Outlook ICS — porta 8772
set IDESPECTOR_OPEN_BROWSER=1
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
