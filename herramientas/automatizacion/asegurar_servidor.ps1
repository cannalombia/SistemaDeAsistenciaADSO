[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$StatusOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$DataDirectory = Join-Path $ProjectRoot "datos"
$ServerScript = Join-Path $ProjectRoot "servidor\servidor.js"
$SupervisorLog = Join-Path $DataDirectory "supervisor_servidor.log"
$ServerOutputLog = Join-Path $DataDirectory "servidor_salida.log"
$ServerErrorLog = Join-Path $DataDirectory "servidor_errores.log"
$HealthUrl = "http://127.0.0.1:$Port/api/health"

New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null

function Write-SupervisorLog {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $SupervisorLog -Value "[$timestamp] $Message" -Encoding UTF8
}

function Get-ProjectHealth {
    try {
        $health = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 4
        if ($health.ok -eq $true -and $health.service -eq "sistema-asistencia-sena") {
            return $health
        }
    } catch {
        return $null
    }
    return $null
}

function Rotate-Log {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    if ((Get-Item -LiteralPath $Path).Length -lt 5MB) { return }
    $archive = "$Path.1"
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    Move-Item -LiteralPath $Path -Destination $archive
}

$health = Get-ProjectHealth
if ($health) {
    if ($StatusOnly) {
        [pscustomobject]@{
            Active = $true
            Url = "http://localhost:$Port/login.html"
            StartedAt = $health.startedAt
            EmailReady = $health.email.ready
            EmailProvider = $health.email.provider
        } | Format-List
    }
    exit 0
}

if ($StatusOnly) {
    [pscustomobject]@{ Active = $false; Url = "http://localhost:$Port/login.html" } | Format-List
    exit 1
}

$listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
    $stoppedProjectProcess = $false
    foreach ($processId in ($listeners.OwningProcess | Sort-Object -Unique)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if ($process -and $process.Name -eq "node.exe" -and $process.CommandLine -match "servidor[\\/]servidor\.js") {
            Stop-Process -Id $processId -Force
            $stoppedProjectProcess = $true
            Write-SupervisorLog "Se detuvo el servidor bloqueado (PID $processId) para recuperarlo."
        }
    }
    if (-not $stoppedProjectProcess) {
        Write-SupervisorLog "No se pudo iniciar: el puerto $Port está ocupado por otro programa."
        exit 2
    }
    Start-Sleep -Milliseconds 500
}

Rotate-Log -Path $ServerOutputLog
Rotate-Log -Path $ServerErrorLog

try {
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $process = Start-Process -FilePath $nodePath `
        -ArgumentList "`"$ServerScript`"" `
        -WorkingDirectory $ProjectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $ServerOutputLog `
        -RedirectStandardError $ServerErrorLog `
        -PassThru
    Write-SupervisorLog "Servidor iniciado (PID $($process.Id))."
} catch {
    Write-SupervisorLog "Error al iniciar el servidor: $($_.Exception.Message)"
    exit 3
}

for ($attempt = 1; $attempt -le 15; $attempt += 1) {
    Start-Sleep -Seconds 1
    $health = Get-ProjectHealth
    if ($health) {
        Write-SupervisorLog "Servidor listo en http://localhost:$Port/login.html; correo=$($health.email.provider), disponible=$($health.email.ready)."
        exit 0
    }
    if ($process.HasExited) {
        Write-SupervisorLog "El servidor terminó durante el arranque con código $($process.ExitCode)."
        exit 4
    }
}

Write-SupervisorLog "El servidor no respondió después de 15 segundos."
exit 5
