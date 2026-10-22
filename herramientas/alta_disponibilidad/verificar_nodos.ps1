[CmdletBinding()]
param([int[]]$Ports = @(3001,3002))
$rows = foreach ($port in $Ports) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 4
        [pscustomobject]@{ Port=$port; Status=$health.status; Ready=$health.ok; Instance=$health.instanceId; Build=$health.buildId; ActiveInstances=$health.resilience.activeInstances }
    } catch {
        [pscustomobject]@{ Port=$port; Status="DOWN"; Ready=$false; Instance="-"; Build="-"; ActiveInstances=0 }
    }
}
$rows | Format-Table -AutoSize
