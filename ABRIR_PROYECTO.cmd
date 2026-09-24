@echo off
setlocal
title Sistema de Asistencia SENA
cd /d "%~dp0"

echo Preparando el Sistema de Asistencia SENA...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\automatizacion\asegurar_servidor.ps1"

if errorlevel 1 (
    echo.
    echo No fue posible iniciar el servidor.
    echo Comprueba que Node.js este instalado y ejecuta npm.cmd install.
    echo.
    pause
    exit /b 1
)

echo Abriendo el proyecto en el navegador...
start "" "http://localhost:3000/login.html"
endlocal
