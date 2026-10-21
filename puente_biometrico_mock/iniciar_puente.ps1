<#
    Archivo: iniciar_puente.ps1

    Propósito:
    Este archivo inicia el puente biométrico mock como un proceso local independiente.

    Responsabilidad:
    Validar la clave local y ejecutar servidor_mock.js en 127.0.0.1:4318.

    Comunicación:
    Entrega la configuración al proceso Node.js mediante variables de entorno.

    Límites:
    No instala SDK, no accede al lector y no modifica el sistema de asistencia.
#>

param(
    [string]$ClaveLocal = $env:CLAVE_LOCAL_PUENTE,
    [int]$Puerto = $(if ($env:PUERTO_PUENTE_BIOMETRICO) { [int]$env:PUERTO_PUENTE_BIOMETRICO } else { 4318 }),
    [switch]$Visible
)

$ErrorActionPreference = "Stop"
$ruta_proyecto = Split-Path -Parent $MyInvocation.MyCommand.Path
$ruta_servidor = Join-Path $ruta_proyecto "servidor_mock.js"

if ([string]::IsNullOrWhiteSpace($ClaveLocal) -or $ClaveLocal.Length -lt 12) {
    throw "Debes indicar CLAVE_LOCAL_PUENTE con al menos 12 caracteres."
}

if ($Puerto -lt 1024 -or $Puerto -gt 65535) { throw "El puerto debe estar entre 1024 y 65535." }
$puerto_ocupado = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue
if ($puerto_ocupado) {
    throw "El puerto $Puerto ya está ocupado por otro proceso."
}

$env:CLAVE_LOCAL_PUENTE = $ClaveLocal
$env:PUERTO_PUENTE_BIOMETRICO = [string]$Puerto
$argumentos = @($ruta_servidor)

if ($Visible) {
    $proceso = Start-Process -FilePath "node" -ArgumentList $argumentos -WorkingDirectory $ruta_proyecto -PassThru
} else {
    $proceso = Start-Process -FilePath "node" -ArgumentList $argumentos -WorkingDirectory $ruta_proyecto -WindowStyle Hidden -PassThru
}

Write-Output "Puente biométrico mock iniciado. PID: $($proceso.Id)"
Write-Output "Dirección: http://127.0.0.1:$Puerto/"
