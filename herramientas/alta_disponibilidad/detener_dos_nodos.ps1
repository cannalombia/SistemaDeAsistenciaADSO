[CmdletBinding()]
param([int[]]$Ports = @(3001,3002))
$ErrorActionPreference = "Continue"
foreach ($port in $Ports) {
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    foreach ($pid in ($listeners.OwningProcess | Sort-Object -Unique)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$pid" -ErrorAction SilentlyContinue
        if ($process -and $process.Name -eq "node.exe" -and ([string]$process.CommandLine) -match 'servidor[\\/]servidor\.js') {
            Stop-Process -Id $pid -Force
            Write-Host "Nodo Blue Magic detenido: PID=$pid puerto=$port"
        }
    }
}
