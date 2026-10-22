@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
echo Preparando biometria REAL con DigitalPersona 4500...
echo.
echo Requisitos: WSL2 Ubuntu-24.04, usbipd-win y lector conectado.
echo El proceso pedira la contrasena sudo de Ubuntu para instalar libfprint-dev.
echo.

set "WSLROOT="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\herramientas\automatizacion\convertir_ruta_wsl.ps1" -Path "%CD%" -Distro "Ubuntu-24.04"`) do set "WSLROOT=%%I"
if not defined WSLROOT (
  echo [ERROR] No se pudo convertir la ruta del proyecto a WSL.
  pause
  exit /b 1
)

wsl.exe -d Ubuntu-24.04 -- bash -lc "cd '%WSLROOT%/puente_biometrico_real' && ./instalar_wsl.sh"
if errorlevel 1 (
  echo [ERROR] No fue posible instalar o compilar el puente real.
  pause
  exit /b 2
)

echo Activando BIOMETRIC_MODE=real en .env...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=Join-Path '%CD%' '.env'; $s=Get-Content -LiteralPath $p; $s=$s -replace '^BIOMETRIC_ENABLED=.*$','BIOMETRIC_ENABLED=true'; $s=$s -replace '^BIOMETRIC_MODE=.*$','BIOMETRIC_MODE=real'; $s ^| Set-Content -LiteralPath $p -Encoding UTF8"
if errorlevel 1 (
  echo [ERROR] El motor se compilo, pero no se pudo activar el modo real en .env.
  pause
  exit /b 3
)

echo Generando claves locales y comprobando el puente real...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\herramientas\automatizacion\asegurar_biometria.ps1"
if errorlevel 1 (
  echo [ADVERTENCIA] El motor quedo instalado, pero el lector no pudo iniciarse automaticamente.
  echo Revisa usbipd list y vuelve a ejecutar ABRIR_PROYECTO.cmd con el lector conectado.
) else (
  echo [OK] Puente biometrico real disponible.
)

echo.
echo Biometria real preparada. Desde ahora usa ABRIR_PROYECTO.cmd normalmente.
pause
endlocal
