[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$EnsureScript = Join-Path $PSScriptRoot "asegurar_servidor.ps1"
$MutexName = "Local\SistemaAsistenciaSenaWatchdog"
$mutex = New-Object System.Threading.Mutex($false, $MutexName)
$ownsMutex = $false

try {
    $ownsMutex = $mutex.WaitOne(0, $false)
    if (-not $ownsMutex) { exit 0 }

    while ($true) {
        try {
            & $EnsureScript | Out-Null
        } catch {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $log = Join-Path $ProjectRoot "datos\supervisor_servidor.log"
            Add-Content -LiteralPath $log -Value "[$timestamp] El vigilante no pudo comprobar el servidor: $($_.Exception.Message)" -Encoding UTF8
        }
        Start-Sleep -Seconds 60
    }
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
