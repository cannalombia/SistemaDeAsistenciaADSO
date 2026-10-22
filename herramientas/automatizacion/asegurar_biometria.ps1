<#
    Archivo: asegurar_biometria.ps1

    Propósito:
    Mantener disponible el puente biométrico configurado (mock o real).

    Responsabilidad:
    - Leer .env y generar secretos locales cuando falten.
    - Mantener el puente mock o el puente real de WSL en 127.0.0.1:4318.
    - Para modo real, adjuntar el DigitalPersona 05ba:000a a WSL mediante usbipd-win.
    - Aplicar protección contra crash-loop.

    Límites:
    No instala WSL, Ubuntu, usbipd-win ni paquetes de libfprint. Esa preparación se
    realiza una sola vez con puente_biometrico_real/INSTALAR_BIOMETRIA_REAL.cmd.
#>
[CmdletBinding()]
param([switch]$StatusOnly)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$EnvFile = Join-Path $ProjectRoot ".env"
$MockScript = Join-Path $ProjectRoot "puente_biometrico_mock\servidor_mock.js"
$RealDirectory = Join-Path $ProjectRoot "puente_biometrico_real"
$DataDirectory = Join-Path $ProjectRoot "datos"
$SecretFile = Join-Path $DataDirectory "clave_puente_biometrico.key"
$SupervisorLog = Join-Path $DataDirectory "supervisor_biometria.log"
$BridgeOutputLog = Join-Path $DataDirectory "biometria_salida.log"
$BridgeErrorLog = Join-Path $DataDirectory "biometria_errores.log"
$RestartStateFile = Join-Path $DataDirectory "supervisor_biometria_reinicios.json"
$Port = 4318
$ServiceUrl = "http://127.0.0.1:4318"
$WslDistro = "Ubuntu-24.04"
$FingerprintVidPid = "05ba:000a"
$WslPathConverter = Join-Path $PSScriptRoot "convertir_ruta_wsl.ps1"

New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null

function Write-BiometricLog([string]$Message) {
    Add-Content -LiteralPath $SupervisorLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -Encoding UTF8
}

function Read-EnvMap {
    $map = @{}
    if (-not (Test-Path -LiteralPath $EnvFile)) { return $map }
    foreach ($line in Get-Content -LiteralPath $EnvFile) {
        $text = [string]$line
        $trimmed = $text.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $pos = $trimmed.IndexOf("=")
        if ($pos -lt 1) { continue }
        $key = $trimmed.Substring(0, $pos).Trim()
        $value = $trimmed.Substring($pos + 1).Trim().Trim('"').Trim("'")
        $map[$key] = $value
    }
    return $map
}

function Set-EnvValue([string]$Key, [string]$Value) {
    $lines = if (Test-Path -LiteralPath $EnvFile) { @(Get-Content -LiteralPath $EnvFile) } else { @() }
    $found = $false
    $updated = foreach ($line in $lines) {
        if ([string]$line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $found = $true
            "$Key=$Value"
        } else { $line }
    }
    if (-not $found) { $updated += "$Key=$Value" }
    $updated | Set-Content -LiteralPath $EnvFile -Encoding UTF8
}

function New-LocalSecret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ([System.BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
}

function Ensure-Secrets($config, [string]$mode) {
    $secret = [string]$config["BIOMETRIC_SERVICE_KEY"]
    if ([string]::IsNullOrWhiteSpace($secret) -or $secret.Length -lt 24) {
        if ($StatusOnly) { return $null }
        $secret = New-LocalSecret
        Set-EnvValue -Key "BIOMETRIC_SERVICE_KEY" -Value $secret
        Write-BiometricLog "Se generó automáticamente una nueva clave local para el puente biométrico."
    }
    Set-Content -LiteralPath $SecretFile -Value $secret -Encoding ascii -NoNewline

    if ($mode -eq "real") {
        $encryption = [string]$config["BIOMETRIC_ENCRYPTION_KEY"]
        if ($encryption -notmatch '^[0-9a-fA-F]{64}$') {
            if ($StatusOnly) { return $null }
            $encryption = New-LocalSecret
            Set-EnvValue -Key "BIOMETRIC_ENCRYPTION_KEY" -Value $encryption
            Write-BiometricLog "Se generó automáticamente una clave AES-256 para plantillas biométricas reales."
        }
    }
    return $secret
}

function Test-RestartBudget {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $recent = @()
    if (Test-Path -LiteralPath $RestartStateFile) {
        try { $recent = @((Get-Content -LiteralPath $RestartStateFile -Raw | ConvertFrom-Json) | Where-Object { [long]$_ -ge ($now - 300) }) } catch { $recent = @() }
    }
    if ($recent.Count -ge 5) {
        Write-BiometricLog "Protección crash-loop: 5 reinicios en 5 minutos. Se pospone el siguiente intento."
        return $false
    }
    $recent += $now
    $recent | ConvertTo-Json | Set-Content -LiteralPath $RestartStateFile -Encoding UTF8
    return $true
}
function Clear-RestartBudget { try { @() | ConvertTo-Json | Set-Content -LiteralPath $RestartStateFile -Encoding UTF8 } catch {} }

function Test-BridgeHealth([string]$Secret, [string]$Mode) {
    try {
        $headers = @{ Authorization = "Bearer $Secret" }
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/v1/salud" -Headers $headers -Method Get -TimeoutSec 3
        return ($health.correcto -eq $true -and [string]$health.modo -eq $Mode)
    } catch { return $false }
}

function Get-WslProjectPath {
    try { return (& $WslPathConverter -Path $ProjectRoot -Distro $WslDistro | Select-Object -First 1) }
    catch { Write-BiometricLog "No se pudo convertir la ruta del proyecto para WSL: $($_.Exception.Message)"; return $null }
}

function Ensure-UsbAttached {
    $usbipd = Get-Command usbipd.exe -ErrorAction SilentlyContinue
    if (-not $usbipd) { $usbipd = Get-Command usbipd -ErrorAction SilentlyContinue }
    if (-not $usbipd) { Write-BiometricLog "usbipd-win no está instalado o no está en PATH."; return $false }

    $list = & $usbipd.Source list 2>&1
    $line = $list | Where-Object { [string]$_ -match $FingerprintVidPid } | Select-Object -First 1
    if (-not $line) { Write-BiometricLog "No se detectó el lector USB $FingerprintVidPid en Windows."; return $false }
    $text = [string]$line
    if ($text -notmatch '^\s*([^\s]+)\s+05ba:000a\s+') { Write-BiometricLog "No se pudo resolver el BUSID del lector."; return $false }
    $busid = $Matches[1]

    if ($text -match '\bNot shared\b') {
        try {
            & $usbipd.Source bind --busid $busid | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "bind falló" }
            Write-BiometricLog "El lector $busid fue compartido con usbipd."
        } catch {
            Write-BiometricLog "El lector existe pero aún no está compartido. Ejecuta como administrador: usbipd bind --busid $busid"
            return $false
        }
    }

    $list = & $usbipd.Source list 2>&1
    $line = $list | Where-Object { [string]$_ -match "^\s*$([regex]::Escape($busid))\s+05ba:000a\s+" } | Select-Object -First 1
    if ([string]$line -notmatch '\bAttached\b') {
        & $usbipd.Source attach --wsl --busid $busid | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-BiometricLog "No se pudo adjuntar el lector $busid a WSL."; return $false }
        Start-Sleep -Seconds 1
    }

    & wsl.exe -d $WslDistro -- bash -lc "lsusb | grep -qi '$FingerprintVidPid'" 2>$null
    if ($LASTEXITCODE -ne 0) { Write-BiometricLog "Ubuntu no ve el lector $FingerprintVidPid después del attach."; return $false }
    return $true
}

function Stop-ManagedBridges {
    # Si se cambió entre mock y real, detenemos únicamente puentes biométricos
    # reconocidos de este proyecto. Nunca finalizamos un proceso desconocido del puerto.
    try {
        $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
        foreach ($connection in $connections) {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction SilentlyContinue
            $commandLine = [string]$process.CommandLine
            if ($commandLine -match 'puente_biometrico_mock[\\/]servidor_mock\.js') {
                Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-BiometricLog "Se detuvo un puente mock anterior antes de cambiar/reiniciar el modo biométrico."
            }
        }
    } catch {
        Write-BiometricLog "No se pudo inspeccionar completamente el puente mock anterior: $($_.Exception.Message)"
    }

    if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
        try {
            $distros = ((& wsl.exe -l -q 2>$null) -join "`n") -replace ([char]0), ""
            if ($distros -match [regex]::Escape($WslDistro)) {
                & wsl.exe -d $WslDistro -- bash -lc "pkill -f '[s]ervidor_real.py' >/dev/null 2>&1 || true" 2>$null | Out-Null
            }
        } catch {
            Write-BiometricLog "No se pudo comprobar/detener un puente real anterior: $($_.Exception.Message)"
        }
    }
    Start-Sleep -Milliseconds 700
}

function Test-PortAvailable {
    $listener = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    return $listener.Count -eq 0
}

function Start-MockBridge([string]$Secret) {
    $env:CLAVE_LOCAL_PUENTE = $Secret
    $env:PUERTO_PUENTE_BIOMETRICO = [string]$Port
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    Start-Process -FilePath $node -ArgumentList "`"$MockScript`"" -WorkingDirectory (Split-Path -Parent $MockScript) -WindowStyle Hidden -RedirectStandardOutput $BridgeOutputLog -RedirectStandardError $BridgeErrorLog -PassThru | Out-Null
}

function Start-RealBridge {
    if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { throw "WSL no está instalado." }
    $distros = ((& wsl.exe -l -q 2>$null) -join "`n") -replace ([char]0), ""
    if ($distros -notmatch [regex]::Escape($WslDistro)) { throw "No está instalada la distribución $WslDistro." }
    if (-not (Ensure-UsbAttached)) { throw "El DigitalPersona 4500 no está adjunto a WSL." }

    $wslRoot = Get-WslProjectPath
    if (-not $wslRoot) { throw "No se pudo convertir la ruta del proyecto para WSL." }
    $wslSecretFile = "$wslRoot/datos/clave_puente_biometrico.key"
    $server = "$wslRoot/puente_biometrico_real/servidor_real.py"
    $motor = "$wslRoot/puente_biometrico_real/bin/motor_biometrico"
    & wsl.exe -d $WslDistro -- bash -lc "test -x '$motor'" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "El motor real no está compilado. Ejecuta puente_biometrico_real\INSTALAR_BIOMETRIA_REAL.cmd una vez." }

    # wsl.exe permanece como proceso anfitrión del servicio Python. Lanzar con
    # nohup y cerrar wsl.exe permite que WSL finalice la distribución y mate el
    # puente aunque Python haya arrancado correctamente.
    $wslExecutable = (Get-Command wsl.exe -ErrorAction Stop).Source
    $arguments = "-d $WslDistro --exec env PUERTO_PUENTE_BIOMETRICO=$Port CLAVE_LOCAL_PUENTE_FILE=$wslSecretFile python3 $server"
    Start-Process -FilePath $wslExecutable `
        -ArgumentList $arguments `
        -WorkingDirectory $RealDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $BridgeOutputLog `
        -RedirectStandardError $BridgeErrorLog `
        -PassThru | Out-Null
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
    if ($StatusOnly) { Write-Output "Biometría: .env no disponible."; exit 1 }
    throw "Falta .env; no se puede preparar la biometría."
}

$config = Read-EnvMap

# BIOMETRIC_SERVICE_URL es la fuente única del puerto. De esta manera Node,
# el supervisor y ambos puentes no pueden quedar desalineados por accidente.
$ServiceUrl = [string]$config["BIOMETRIC_SERVICE_URL"]
if ([string]::IsNullOrWhiteSpace($ServiceUrl)) { $ServiceUrl = "http://127.0.0.1:4318" }
try {
    $serviceUri = [System.Uri]$ServiceUrl
    if ($serviceUri.Scheme -ne "http" -or $serviceUri.Host -ne "127.0.0.1" -or -not $serviceUri.IsDefaultPort -and ($serviceUri.Port -lt 1024 -or $serviceUri.Port -gt 65535)) {
        throw "URL local inválida"
    }
    if ($serviceUri.AbsolutePath -ne "/" -or $serviceUri.Query -or $serviceUri.Fragment -or $serviceUri.UserInfo) { throw "URL con componentes no permitidos" }
    $Port = if ($serviceUri.IsDefaultPort) { 80 } else { $serviceUri.Port }
    if ($Port -lt 1024 -or $Port -gt 65535) { throw "Puerto fuera de rango" }
} catch {
    throw "BIOMETRIC_SERVICE_URL debe ser http://127.0.0.1:PUERTO con un puerto entre 1024 y 65535."
}

$enabled = @("1", "true") -contains ([string]$config["BIOMETRIC_ENABLED"]).Trim().ToLowerInvariant()
if (-not $enabled) {
    if ($StatusOnly) { Write-Output "Biometría: deshabilitada (BIOMETRIC_ENABLED=false)." }
    exit 0
}
$mode = ([string]$config["BIOMETRIC_MODE"]).Trim().ToLowerInvariant()
if (-not $mode) { $mode = "mock" }
if (@("mock", "real") -notcontains $mode) { throw "BIOMETRIC_MODE debe ser mock o real." }

$secret = Ensure-Secrets $config $mode
if (-not $secret) { if ($StatusOnly) { Write-Output "Biometría: faltan claves locales válidas."; exit 1 } else { exit 1 } }
if (Test-BridgeHealth $secret $mode) {
    Clear-RestartBudget
    if ($StatusOnly) { Write-Output "Biometría: puente $mode disponible en 127.0.0.1:$Port." }
    exit 0
}
if ($StatusOnly) { Write-Output "Biometría: puente $mode no disponible."; exit 1 }
if (-not (Test-RestartBudget)) { exit 6 }

Stop-ManagedBridges
if (-not (Test-PortAvailable)) {
    Write-BiometricLog "El puerto $Port está ocupado por un proceso ajeno al puente administrado. No se finalizará automáticamente."
    exit 4
}

try {
    if ($mode -eq "mock") { Start-MockBridge $secret }
    else { Start-RealBridge }
    Write-BiometricLog "Se solicitó el inicio del puente biométrico $mode."
} catch {
    Write-BiometricLog "Error al iniciar el puente biométrico ${mode}: $($_.Exception.Message)"
    exit 3
}

for ($attempt = 1; $attempt -le 12; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-BridgeHealth $secret $mode) {
        Clear-RestartBudget
        Write-BiometricLog "Puente biométrico $mode listo en 127.0.0.1:$Port."
        exit 0
    }
}
Write-BiometricLog "El puente biométrico $mode no respondió después de 12 segundos."
exit 5
