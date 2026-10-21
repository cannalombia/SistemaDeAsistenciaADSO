<#
    Archivo: detener_puente.ps1

    Propósito:
    Este archivo detiene de forma controlada el puente biométrico mock local.

    Responsabilidad:
    Localizar el proceso que escucha en 127.0.0.1:4318 y verificar que corresponda
    a servidor_mock.js antes de detenerlo.

    Comunicación:
    Consulta los procesos locales de Windows y detiene únicamente el puente mock.

    Límites:
    No elimina archivos, no detiene otros servicios y no modifica asistencias.
#>

param([int]$Puerto = $(if ($env:PUERTO_PUENTE_BIOMETRICO) { [int]$env:PUERTO_PUENTE_BIOMETRICO } else { 4318 }))

$ErrorActionPreference = "Stop"
$conexion = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue

if (-not $conexion) {
    Write-Output "El puente biométrico mock no está iniciado."
    exit 0
}

$identificador_proceso = $conexion.OwningProcess
$proceso = Get-CimInstance Win32_Process -Filter "ProcessId = $identificador_proceso"

if (-not $proceso.CommandLine -or $proceso.CommandLine -notmatch "servidor_mock\.js") {
    throw "El proceso del puerto $Puerto no corresponde al puente mock y no será detenido."
}

Stop-Process -Id $identificador_proceso
Write-Output "Puente biométrico mock detenido. PID: $identificador_proceso"
