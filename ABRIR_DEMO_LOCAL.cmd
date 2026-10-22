@echo off
setlocal
title BioSecure SENA 9.1 - DEMO LOCAL
cd /d "%~dp0"
echo ============================================================
echo   BIOSECURE SENA 9.1 - DEMOSTRACION SIN MYSQL
 echo ============================================================
echo Carpeta del proyecto: %CD%
echo.
if not exist "pruebas\servidor_visual.js" (
  echo [ERROR] Falta pruebas\servidor_visual.js en esta carpeta.
  echo Este archivo debe venir incluido en el ZIP corregido.
  echo Extrae el ZIP COMPLETO; no copies solo el archivo .cmd.
  pause
  exit /b 2
)
if not exist "package.json" (
  echo [ERROR] Falta package.json. Revisa la carpeta extraida.
  pause
  exit /b 3
)
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta disponible en este PC.
  echo Instala Node.js y ejecuta este archivo otra vez.
  pause
  exit /b 4
)
if not exist "node_modules\qrcode\package.json" (
  echo Instalando dependencias por primera vez...
  call npm.cmd ci
  if errorlevel 1 (
    echo [ERROR] npm ci fallo. Revisa la conexion a Internet y los mensajes anteriores.
    pause
    exit /b 5
  )
)
echo.
echo Demostracion local: http://127.0.0.1:3100/login.html
echo Acceso de DEMO: usuario admin; clave visual-test.
echo Este modo NO utiliza tu MySQL ni tu lector de huella real.
echo Deja ABIERTA esta ventana mientras uses la pagina.
echo Si el navegador no se abre solo, copia la direccion anterior.
echo.
set "BIOSECURE_ABRIR_NAVEGADOR=1"
node "pruebas\servidor_visual.js"
set "RESULTADO=%errorlevel%"
echo.
echo El servidor se detuvo. Codigo de salida: %RESULTADO%
pause
exit /b %RESULTADO%
