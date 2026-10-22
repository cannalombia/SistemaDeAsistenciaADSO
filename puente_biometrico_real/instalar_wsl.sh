#!/usr/bin/env bash
#
# Archivo: instalar_wsl.sh
# Instala los componentes necesarios para compilar y ejecutar el puente real.
# Ejecutar dentro de Ubuntu 24.04 WSL2.
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/4] Instalando paquetes de libfprint y compilación..."
sudo apt update
sudo apt install -y build-essential pkg-config libfprint-2-dev libglib2.0-dev usbutils

echo "[2/4] Compilando motor biométrico..."
mkdir -p bin
gcc -O2 -Wall -Wextra -o bin/motor_biometrico motor_biometrico.c $(pkg-config --cflags --libs libfprint-2 glib-2.0 gio-2.0)
chmod 700 bin/motor_biometrico servidor_real.py

echo "[3/4] Comprobando motor..."
./bin/motor_biometrico estado || true

echo "[4/4] Instalación terminada."
echo "El lector debe aparecer como 05ba:000a en 'lsusb' antes de iniciar el puente."
