@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Sistema de Asistencia SENA
cd /d "%~dp0"

echo Preparando el Sistema de Asistencia SENA...
echo Verificando esta carpeta, dependencias, MySQL, credenciales, biometria y servidor...
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no esta disponible en el PATH.
    pause
    exit /b 1
)

if not exist "%~dp0.env" (
    echo [ERROR] Falta el archivo .env de esta instalacion.
    echo Usa .env.example como referencia y conserva tus credenciales solo en .env.
    pause
    exit /b 2
)

if not exist "%~dp0BUILD_ID.txt" (
    echo [ERROR] Falta BUILD_ID.txt. Esta copia no puede verificarse de forma segura.
    pause
    exit /b 3
)

if not exist "%~dp0node_modules\qrcode\package.json" (
    echo Instalando dependencias exactas desde package-lock.json...
    call npm.cmd ci
    if errorlevel 1 (
        echo [ERROR] npm ci no pudo instalar las dependencias.
        pause
        exit /b 4
    )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\automatizacion\asegurar_mysql.ps1"
if errorlevel 1 (
    echo [ERROR] MySQL no esta listo. Node.js no se iniciara para evitar un estado inconsistente.
    if exist "%~dp0datos\supervisor_mysql.log" powershell.exe -NoProfile -Command "Get-Content -LiteralPath '%~dp0datos\supervisor_mysql.log' -Tail 20"
    pause
    exit /b 5
)

node.exe "%~dp0herramientas\verificar_credenciales.js"
set "CRED_RESULT=!errorlevel!"
if "!CRED_RESULT!"=="10" (
    echo.
    echo La instalacion no tiene una clave administrativa guardada.
    echo Configurala ahora; la entrada se ocultara y no se escribira en .env.
    call npm.cmd run reset:admin
    if errorlevel 1 (
        echo [ERROR] No se configuraron las credenciales administrativas.
        pause
        exit /b 6
    )
    node.exe "%~dp0herramientas\verificar_credenciales.js"
    set "CRED_RESULT=!errorlevel!"
)
if not "!CRED_RESULT!"=="0" (
    echo [ERROR] La configuracion de acceso no es valida. Revisa .env y datos\credenciales_administrador.json.
    pause
    exit /b 7
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\automatizacion\asegurar_biometria.ps1"
if errorlevel 1 (
    echo [ADVERTENCIA] El puente biometrico real no quedo disponible.
    echo QR y asistencia manual pueden seguir funcionando, pero NO la huella.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\automatizacion\diagnostico_biometria.ps1"
    if exist "%~dp0datos\supervisor_biometria.log" powershell.exe -NoProfile -Command "Get-Content -LiteralPath '%~dp0datos\supervisor_biometria.log' -Tail 20"
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\automatizacion\asegurar_servidor.ps1"
if errorlevel 1 (
    echo [ERROR] No fue posible iniciar el servidor principal.
    if exist "%~dp0datos\servidor_errores.log" powershell.exe -NoProfile -Command "Get-Content -LiteralPath '%~dp0datos\servidor_errores.log' -Tail 20"
    pause
    exit /b 8
)

echo Sistema listo. Abriendo el navegador...
start "" "http://localhost:3000/login.html"
endlocal
