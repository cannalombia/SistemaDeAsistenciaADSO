@echo off
setlocal
title Sistema de Asistencia SENA
cd /d "%~dp0"

echo Preparando el Sistema de Asistencia SENA...
echo Verificando que localhost:3000 corresponda a ESTA carpeta y ESTA version...
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta disponible en el PATH.
    echo Instala Node.js y vuelve a abrir este archivo.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0.env" (
    echo [ERROR] Falta el archivo .env de esta instalacion.
    echo Copia el .env de tu version funcional anterior a esta carpeta y vuelve a intentarlo.
    echo Ruta esperada: %~dp0.env
    echo.
    pause
    exit /b 2
)

if not exist "%~dp0node_modules\qrcode\package.json" (
    echo Instalando dependencias del proyecto por primera vez...
    call npm.cmd install
    if errorlevel 1 (
        echo.
        echo [ERROR] No fue posible instalar las dependencias.
        echo Ejecuta manualmente: npm.cmd install
        echo.
        pause
        exit /b 3
    )
    echo.
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\automatizacion\asegurar_servidor.ps1"

if errorlevel 1 (
    echo.
    echo [ERROR] No fue posible iniciar el servidor.
    if exist "%~dp0datos\servidor_errores.log" (
        echo.
        echo Ultimas lineas del error real:
        echo ------------------------------------------------------------
        powershell.exe -NoProfile -Command "Get-Content -LiteralPath '%~dp0datos\servidor_errores.log' -Tail 20"
        echo ------------------------------------------------------------
    )
    echo.
    echo Tambien puedes ejecutar npm.cmd start para ver el error directamente.
    echo.
    pause
    exit /b 4
)

echo Servidor listo. Abriendo el proyecto en el navegador...
start "" "http://localhost:3000/login.html"
endlocal
