[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$WatchdogScript = Join-Path $PSScriptRoot "vigilante_servidor.ps1"
$TaskName = "Sistema Asistencia SENA - Supervisor"
$RunValueName = "SistemaAsistenciaSENA"

if (-not (Test-Path -LiteralPath $WatchdogScript)) {
    throw "No se encontraron los scripts del supervisor."
}

$powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchdogScript`""
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $ProjectRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Seconds 30)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

$mode = "Tarea programada"
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Description "Mantiene disponible el Sistema de Asistencia SENA y, cuando está habilitado, su puente biométrico local." `
        -Action $action `
        -Trigger $logonTrigger `
        -Settings $settings `
        -Principal $principal `
        -Force `
        -ErrorAction Stop | Out-Null
    Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
} catch {
    $mode = "Inicio de Windows con vigilante cada 10 segundos"
    $runPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $watchdogArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchdogScript`""
    $runCommand = "`"$powerShellPath`" $watchdogArguments"
    New-Item -Path $runPath -Force | Out-Null
    New-ItemProperty -Path $runPath -Name $RunValueName -Value $runCommand -PropertyType String -Force -ErrorAction Stop | Out-Null
    Start-Process -FilePath $powerShellPath -ArgumentList $watchdogArguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden
    $registered = (Get-ItemProperty -Path $runPath -Name $RunValueName -ErrorAction Stop).$RunValueName
    if ($registered -ne $runCommand) { throw "Windows no guardó el inicio automático." }
}

[pscustomobject]@{
    Installed = $true
    TaskName = $TaskName
    Mode = $mode
    CheckEverySeconds = 10
    Url = "http://localhost:3000/login.html"
} | Format-List
