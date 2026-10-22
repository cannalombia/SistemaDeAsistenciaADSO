[CmdletBinding()]
param([switch]$StatusOnly)

$ErrorActionPreference = "Continue"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$CheckScript = Join-Path $ProjectRoot "herramientas\verificar_mysql.js"
$LogFile = Join-Path $ProjectRoot "datos\supervisor_mysql.log"

function Write-MysqlLog([string]$Message) {
    Add-Content -LiteralPath $LogFile -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -Encoding UTF8
}

function Test-MysqlReady {
    $result = @(& node.exe $CheckScript 2>&1)
    $exitCode = $LASTEXITCODE
    $script:LastMysqlDiagnostic = ($result | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    return [bool]($exitCode -eq 0)
}

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js no está disponible en PATH; no se puede validar MySQL."
    exit 2
}

if (Test-MysqlReady) {
    if ($LastMysqlDiagnostic) { Write-Output $LastMysqlDiagnostic }
    if (-not $StatusOnly) { Write-MysqlLog "MySQL respondió y el esquema está actualizado." }
    exit 0
}
if ($LastMysqlDiagnostic) { Write-Error $LastMysqlDiagnostic }
if ($StatusOnly) { exit 1 }

# Solo se intenta iniciar un servicio detenido. Nunca se reinicia un MySQL ya
# activo, para no interrumpir conexiones ni arriesgar datos.
$configuredName = [string]$env:MYSQL_SERVICE_NAME
if ([string]::IsNullOrWhiteSpace($configuredName)) {
    $envFile = Join-Path $ProjectRoot ".env"
    if (Test-Path -LiteralPath $envFile) {
        $serviceLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*MYSQL_SERVICE_NAME\s*=' } | Select-Object -First 1
        if ($serviceLine) { $configuredName = ([string]$serviceLine).Split('=', 2)[1].Trim().Trim('"').Trim("'") }
    }
}
$services = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object {
    $_.PathName -match '(?i)mysqld(?:\.exe)?' -and
    ([string]::IsNullOrWhiteSpace($configuredName) -or $_.Name -eq $configuredName)
})
$stopped = @($services | Where-Object { $_.State -ne "Running" })
if ($services.Count -eq 1 -and $stopped.Count -eq 1) {
    try {
        Start-Service -Name $services[0].Name -ErrorAction Stop
        Write-MysqlLog "Se inició el servicio MySQL '$($services[0].Name)'."
        for ($attempt = 1; $attempt -le 15; $attempt++) {
            Start-Sleep -Seconds 1
            if (Test-MysqlReady) {
                if ($LastMysqlDiagnostic) { Write-Output $LastMysqlDiagnostic }
                exit 0
            }
        }
    } catch {
        Write-MysqlLog "No se pudo iniciar '$($services[0].Name)': $($_.Exception.Message)"
        Write-Error "MySQL está detenido y Windows no permitió iniciarlo. Abre ABRIR_PROYECTO.cmd como administrador o inicia el servicio '$($services[0].Name)'."
        exit 3
    }
}

$hint = if ($services.Count -gt 1 -and [string]::IsNullOrWhiteSpace($configuredName)) {
    "Hay varios servicios MySQL. Define MYSQL_SERVICE_NAME en .env con el servicio correcto."
} else {
    "Comprueba el servicio MySQL, DB_HOST/DB_PORT, las credenciales y ejecuta npm.cmd run db:migrate si faltan migraciones."
}
Write-MysqlLog "MySQL no quedó disponible. $hint"
Write-Error $hint
exit 4
