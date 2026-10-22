[CmdletBinding()]
param(
    [int]$Port1 = 3001,
    [int]$Port2 = 3002
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$ServerScript = Join-Path $ProjectRoot "servidor\servidor.js"
$DataDirectory = Join-Path $ProjectRoot "datos"
$envFile = Join-Path $ProjectRoot ".env"

if (-not (Test-Path -LiteralPath $envFile)) { throw "Falta .env. Copia .env.example y configura MySQL antes de iniciar dos nodos." }
$sourceLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*DATA_SOURCE\s*=' } | Select-Object -Last 1
if ($sourceLine -notmatch '=\s*mysql\s*$') { throw "La ejecución multi-instancia exige DATA_SOURCE=mysql para compartir el estado de forma segura." }

New-Item -ItemType Directory -Path $DataDirectory -Force | Out-Null
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source

function Start-BlueMagicNode {
    param([string]$InstanceId, [int]$Port)
    $oldPort = $env:PORT
    $oldInstance = $env:INSTANCE_ID
    try {
        $env:PORT = [string]$Port
        $env:INSTANCE_ID = $InstanceId
        $out = Join-Path $DataDirectory "$InstanceId-salida.log"
        $err = Join-Path $DataDirectory "$InstanceId-errores.log"
        return Start-Process -FilePath $nodePath -ArgumentList "`"$ServerScript`"" -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    } finally {
        $env:PORT = $oldPort
        $env:INSTANCE_ID = $oldInstance
    }
}

$n1 = Start-BlueMagicNode -InstanceId "blue-magic-node-01" -Port $Port1
$n2 = Start-BlueMagicNode -InstanceId "blue-magic-node-02" -Port $Port2

Start-Sleep -Seconds 2
$rows = @()
foreach ($item in @(@{Pid=$n1.Id;Port=$Port1;Id='blue-magic-node-01'}, @{Pid=$n2.Id;Port=$Port2;Id='blue-magic-node-02'})) {
    $ready = $false
    try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($item.Port)/api/health/ready" -TimeoutSec 4; $ready = $health.ok -eq $true } catch { }
    $rows += [pscustomobject]@{ InstanceId=$item.Id; PID=$item.Pid; Port=$item.Port; Ready=$ready }
}
$rows | Format-Table -AutoSize
