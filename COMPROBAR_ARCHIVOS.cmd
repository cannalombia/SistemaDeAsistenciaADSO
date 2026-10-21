@echo off
setlocal
title Diagnostico de archivos - BioSecure SENA 9.1
cd /d "%~dp0"
echo Carpeta actual: %CD%
echo.
if exist "package.json" (echo [OK] package.json) else (echo [FALTA] package.json)
if exist "pruebas\servidor_visual.js" (echo [OK] pruebas\servidor_visual.js) else (echo [FALTA] pruebas\servidor_visual.js)
if exist "servidor\servidor.js" (echo [OK] servidor\servidor.js) else (echo [FALTA] servidor\servidor.js)
if exist "aplicacion\paginas HTML\login.html" (echo [OK] aplicacion\paginas HTML\login.html) else (echo [FALTA] aplicacion\paginas HTML\login.html)
if exist "ABRIR_DEMO_LOCAL.cmd" (echo [OK] ABRIR_DEMO_LOCAL.cmd) else (echo [FALTA] ABRIR_DEMO_LOCAL.cmd)
echo.
where node.exe >nul 2>nul
if errorlevel 1 (echo [FALTA] Node.js) else (node --version)
echo.
echo Si todo indica OK, ejecuta ABRIR_DEMO_LOCAL.cmd
pause
