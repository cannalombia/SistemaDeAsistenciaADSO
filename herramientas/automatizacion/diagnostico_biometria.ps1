<#
    Archivo: diagnostico_biometria.ps1

    Propósito:
    Verificar toda la cadena DigitalPersona -> usbipd -> WSL2 -> libfprint -> puente -> Node.

    Límites:
    Solo consulta estado. No muestra claves, no modifica plantillas y no adjunta ni desconecta USB.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$EnvFile = Join-Path $ProjectRoot ".env"
$Distro = "Ubuntu-24.04"
$VidPid = "05ba:000a"
$WslPathConverter = Join-Path $PSScriptRoot "convertir_ruta_wsl.ps1"

function Read-EnvMap {
    $map = @{}
    if (-not (Test-Path -LiteralPath $EnvFile)) { return $map }
    foreach ($line in Get-Content -LiteralPath $EnvFile) {
        $trimmed = ([string]$line).Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $pos = $trimmed.IndexOf("=")
        if ($pos -lt 1) { continue }
        $map[$trimmed.Substring(0,$pos).Trim()] = $trimmed.Substring($pos+1).Trim().Trim('"').Trim("'")
    }
    return $map
}

function Line([string]$Name, [bool]$Ok, [string]$Detail="") {
    $tag = if ($Ok) { "[OK]" } else { "[--]" }
    Write-Host ("{0} {1}{2}" -f $tag,$Name,$(if($Detail){" · $Detail"}else{""}))
}

$config = Read-EnvMap
Write-Host "`nDIAGNÓSTICO BIOMÉTRICO REAL`n"

$wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
Line "WSL" ([bool]$wsl) $(if($wsl){"disponible"}else{"no instalado"})

$distroOk = $false
if ($wsl) {
    $distros = ((& wsl.exe -l -q 2>$null) -join "`n") -replace ([char]0), ""
    $distroOk = $distros -match [regex]::Escape($Distro)
}
Line "Ubuntu WSL2" $distroOk $Distro

$usbipd = Get-Command usbipd.exe -ErrorAction SilentlyContinue
if (-not $usbipd) { $usbipd = Get-Command usbipd -ErrorAction SilentlyContinue }
Line "usbipd-win" ([bool]$usbipd) $(if($usbipd){"instalado"}else{"no disponible en PATH"})

$readerPresent = $false
$readerAttached = $false
if ($usbipd) {
    $lista = & $usbipd.Source list 2>&1
    $linea = $lista | Where-Object { [string]$_ -match $VidPid } | Select-Object -First 1
    $readerPresent = [bool]$linea
    $readerAttached = $readerPresent -and ([string]$linea -match '\bAttached\b')
    Line "DigitalPersona en Windows" $readerPresent $(if($linea){([string]$linea).Trim()}else{$VidPid})
    Line "USB adjunto a WSL" $readerAttached $(if($readerAttached){"Attached"}else{"requiere attach"})
} else {
    Line "DigitalPersona en Windows" $false $VidPid
    Line "USB adjunto a WSL" $false "usbipd no disponible"
}

$linuxSees = $false
$motorOk = $false
if ($distroOk) {
    & wsl.exe -d $Distro -- bash -lc "lsusb 2>/dev/null | grep -qi '$VidPid'" 2>$null
    $linuxSees = $LASTEXITCODE -eq 0
    Line "DigitalPersona dentro de Ubuntu" $linuxSees $VidPid

    try { $wslRoot = (& $WslPathConverter -Path $ProjectRoot -Distro $Distro | Select-Object -First 1) }
    catch { $wslRoot = $null }
    if ($wslRoot) {
        $wslRoot = (([string]$wslRoot) -replace ([char]0), "").Trim()
        & wsl.exe -d $Distro -- bash -lc "test -x '$wslRoot/puente_biometrico_real/bin/motor_biometrico'" 2>$null
        $motorOk = $LASTEXITCODE -eq 0
    }
}
Line "Motor libfprint compilado" $motorOk $(if($motorOk){"listo"}else{"ejecuta INSTALAR_BIOMETRIA_REAL.cmd"})

$enabled = @("1","true") -contains ([string]$config["BIOMETRIC_ENABLED"]).ToLowerInvariant()
$mode = ([string]$config["BIOMETRIC_MODE"]).ToLowerInvariant()
$serviceUrl = [string]$config["BIOMETRIC_SERVICE_URL"]
if (-not $serviceUrl) { $serviceUrl = "http://127.0.0.1:4318" }
Line "Configuración biométrica" ($enabled -and $mode -eq "real") $(if($enabled){"modo=$mode"}else{"deshabilitada"})
Line "URL del puente" ($serviceUrl -match '^http://127\.0\.0\.1:\d+/?$') $serviceUrl

$bridgeOk = $false
$secret = [string]$config["BIOMETRIC_SERVICE_KEY"]
if ($enabled -and $secret) {
    try {
        $health = Invoke-RestMethod -Uri ($serviceUrl.TrimEnd('/') + '/v1/salud') -Headers @{Authorization="Bearer $secret"} -TimeoutSec 3
        $bridgeOk = $health.correcto -eq $true -and $health.modo -eq "real"
    } catch {}
}
Line "Puente biométrico real" $bridgeOk $(if($bridgeOk){"responde y autentica"}else{"sin respuesta válida"})

$nodeOk = $false
try {
    $healthNode = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 3
    $nodeOk = $healthNode.ok -eq $true
} catch {}
Line "Servidor principal :3000" $nodeOk $(if($nodeOk){"operativo"}else{"no responde"})

Write-Host "`nCadena esperada: lector -> usbipd -> WSL2 -> libfprint -> puente local -> Node.js`n"
