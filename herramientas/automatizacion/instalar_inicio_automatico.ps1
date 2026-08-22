[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$SupervisorScript = Join-Path $PSScriptRoot "asegurar_servidor.ps1"
$WatchdogScript = Join-Path $PSScriptRoot "vigilante_servidor.ps1"
$TaskName = "Sistema Asistencia SENA - Supervisor"
$RunValueName = "SistemaAsistenciaSENA"

if (-not (Test-Path -LiteralPath $SupervisorScript) -or -not (Test-Path -LiteralPath $WatchdogScript)) {
    throw "No se encontraron los scripts del supervisor."
}

$powerShellPath = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$SupervisorScript`""
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $ProjectRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn
$watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

$mode = "Tarea programada"
try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Description "Mantiene disponible el Sistema de Asistencia SENA en http://localhost:3000 y lo recupera si se detiene." `
        -Action $action `
        -Trigger @($logonTrigger, $watchdogTrigger) `
        -Settings $settings `
        -Principal $principal `
        -Force `
        -ErrorAction Stop | Out-Null
    Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
} catch {
    $mode = "Inicio de Windows con vigilante cada minuto"
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
    CheckEveryMinutes = if ($mode -eq "Tarea programada") { 5 } else { 1 }
    Url = "http://localhost:3000/login.html"
} | Format-List
