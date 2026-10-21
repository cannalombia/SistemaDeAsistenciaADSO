@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\entrega\crear_entrega_segura.ps1"
if errorlevel 1 (
  echo [ERROR] No se pudo crear la entrega segura.
  pause
  exit /b 1
)
echo.
echo Entrega segura creada sin .env, Git, node_modules ni datos operativos sensibles.
pause
endlocal
