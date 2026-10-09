[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$StatusOnly
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$DataDirectory = Join-Path $ProjectRoot "datos"
$ServerScript = Join-Path $ProjectRoot "servidor\servidor.js"
$BuildIdFile = Join-Path $ProjectRoot "BUILD_ID.txt"
$ExpectedBuildId = if (Test-Path -LiteralPath $BuildIdFile) { (Get-Content -LiteralPath $BuildIdFile -Raw).Trim() } else { "development" }
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

function Get-ListeningNodeProcesses {
    $result = @()
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    foreach ($processId in ($listeners.OwningProcess | Sort-Object -Unique)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if ($process) { $result += $process }
    }
    return @($result)
}

function Test-CurrentProjectServer {
    param($Process)
    if (-not $Process -or $Process.Name -ne "node.exe") { return $false }
    $commandLine = ([string]$Process.CommandLine).Replace('/', '\').ToLowerInvariant()
    $expectedScript = ([System.IO.Path]::GetFullPath($ServerScript)).Replace('/', '\').ToLowerInvariant()
    return $commandLine.Contains($expectedScript)
}

function Test-AnyProjectServer {
    param($Process)
    if (-not $Process -or $Process.Name -ne "node.exe") { return $false }
    return ([string]$Process.CommandLine) -match "servidor[\\/]servidor\.js"
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
$processes = @(Get-ListeningNodeProcesses)
$currentProcess = $processes | Where-Object { Test-CurrentProjectServer $_ } | Select-Object -First 1
$buildMatches = $health -and ([string]$health.buildId -eq $ExpectedBuildId)
$currentInstanceReady = $health -and $currentProcess -and $buildMatches

if ($currentInstanceReady) {
    if ($StatusOnly) {
        [pscustomobject]@{
            Active = $true
            Url = "http://localhost:$Port/login.html"
            BuildId = $health.buildId
            StartedAt = $health.startedAt
            EmailReady = $health.email.ready
            EmailProvider = $health.email.provider
        } | Format-List
    }
    exit 0
}

if ($StatusOnly) {
    $reason = if ($health -and -not $buildMatches) {
        "Hay otra versión de Blue Magic usando el puerto $Port."
    } elseif ($health -and -not $currentProcess) {
        "Blue Magic está activo desde otra carpeta."
    } else {
        "La versión actual no está activa."
    }
    $detectedBuildId = $null
    if ($health) { $detectedBuildId = [string]$health.buildId }
    [pscustomobject]@{
        Active = $false
        Url = "http://localhost:$Port/login.html"
        ExpectedBuildId = $ExpectedBuildId
        DetectedBuildId = $detectedBuildId
        Reason = $reason
    } | Format-List
    exit 1
}

# Si localhost:3000 pertenece a una copia anterior del mismo proyecto,
# la cerramos antes de iniciar esta carpeta. Esta validación evita que el
# navegador siga mostrando HTML/CSS viejos aunque el usuario abra un ZIP nuevo.
if ($processes.Count -gt 0) {
    $stoppedProjectProcess = $false
    foreach ($process in $processes) {
        if (Test-AnyProjectServer $process) {
            Stop-Process -Id $process.ProcessId -Force
            $stoppedProjectProcess = $true
            $source = if (Test-CurrentProjectServer $process) { "misma carpeta, versión anterior" } else { "otra carpeta/versión" }
            Write-SupervisorLog "Se detuvo Blue Magic de $source (PID $($process.ProcessId)); se iniciará build $ExpectedBuildId."
        }
    }
    if (-not $stoppedProjectProcess) {
        Write-SupervisorLog "No se pudo iniciar: el puerto $Port está ocupado por otro programa."
        exit 2
    }
    Start-Sleep -Milliseconds 650
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
    Write-SupervisorLog "Servidor iniciado (PID $($process.Id), build $ExpectedBuildId, raíz $ProjectRoot)."
} catch {
    Write-SupervisorLog "Error al iniciar el servidor: $($_.Exception.Message)"
    exit 3
}

for ($attempt = 1; $attempt -le 15; $attempt += 1) {
    Start-Sleep -Seconds 1
    $health = Get-ProjectHealth
    if ($health -and ([string]$health.buildId -eq $ExpectedBuildId)) {
        Write-SupervisorLog "Servidor listo en http://localhost:$Port/login.html; build=$($health.buildId); correo=$($health.email.provider), disponible=$($health.email.ready)."
        exit 0
    }
    if ($process.HasExited) {
        Write-SupervisorLog "El servidor terminó durante el arranque con código $($process.ExitCode)."
        exit 4
    }
}

Write-SupervisorLog "El servidor no respondió con el build esperado $ExpectedBuildId después de 15 segundos."
exit 5
