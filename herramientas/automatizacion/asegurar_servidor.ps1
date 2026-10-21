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
$HealthUrl = "http://127.0.0.1:$Port/api/health/ready"
$FullHealthUrl = "http://127.0.0.1:$Port/api/health"
$RestartStateFile = Join-Path $DataDirectory "supervisor_reinicios.json"
$MysqlSupervisor = Join-Path $PSScriptRoot "asegurar_mysql.ps1"
$CredentialsCheck = Join-Path $ProjectRoot "herramientas\verificar_credenciales.js"

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

function Get-FullProjectHealth {
    try { return Invoke-RestMethod -Uri $FullHealthUrl -Method Get -TimeoutSec 4 } catch { return $null }
}

function Test-RestartBudget {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $recent = @()
    if (Test-Path -LiteralPath $RestartStateFile) {
        try {
            $parsed = @(Get-Content -LiteralPath $RestartStateFile -Raw | ConvertFrom-Json)
            $recent = @($parsed | Where-Object { [long]$_ -ge ($now - 300) })
        } catch { $recent = @() }
    }
    if ($recent.Count -ge 5) {
        Write-SupervisorLog "Protección crash-loop: se alcanzaron $($recent.Count) reinicios en 5 minutos. Se esperará antes de volver a intentar."
        return $false
    }
    $recent += $now
    $recent | ConvertTo-Json | Set-Content -LiteralPath $RestartStateFile -Encoding UTF8
    return $true
}

function Clear-RestartBudget {
    try { @() | ConvertTo-Json | Set-Content -LiteralPath $RestartStateFile -Encoding UTF8 } catch { }
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
    Clear-RestartBudget
    if ($StatusOnly) {
        $full = Get-FullProjectHealth
        [pscustomobject]@{
            Active = $true
            Url = "http://localhost:$Port/login.html"
            BuildId = $health.buildId
            InstanceId = $health.instanceId
            StartedAt = if ($full) { $full.startedAt } else { $null }
            EmailReady = if ($full) { $full.email.ready } else { $null }
            EmailProvider = if ($full) { $full.email.provider } else { $null }
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

# Quien invoque este supervisor directamente (npm run start:ensure o el
# vigilante) recibe las mismas garantías que ABRIR_PROYECTO.cmd.
& $MysqlSupervisor
if ($LASTEXITCODE -ne 0) {
    Write-SupervisorLog "No se inició Node.js porque MySQL no está listo."
    exit 7
}
& node.exe $CredentialsCheck
if ($LASTEXITCODE -ne 0) {
    Write-SupervisorLog "No se inició Node.js porque faltan credenciales de acceso válidas."
    exit 8
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

if (-not (Test-RestartBudget)) {
    exit 6
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
        Clear-RestartBudget
        $full = Get-FullProjectHealth
        $emailText = if ($full) { "correo=$($full.email.provider), disponible=$($full.email.ready)" } else { "health completo pendiente" }
        Write-SupervisorLog "Servidor listo en http://localhost:$Port/login.html; build=$($health.buildId); instance=$($health.instanceId); $emailText."
        exit 0
    }
    if ($process.HasExited) {
        Write-SupervisorLog "El servidor terminó durante el arranque con código $($process.ExitCode)."
        exit 4
    }
}

Write-SupervisorLog "El servidor no respondió con el build esperado $ExpectedBuildId después de 15 segundos."
exit 5
