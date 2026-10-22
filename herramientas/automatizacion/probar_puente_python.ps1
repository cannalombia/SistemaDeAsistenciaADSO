[CmdletBinding()]
param([string]$Distro = "Ubuntu-24.04")

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$Converter = Join-Path $PSScriptRoot "convertir_ruta_wsl.ps1"
$wslRoot = (& $Converter -Path $ProjectRoot -Distro $Distro | Select-Object -First 1)
if (-not $wslRoot) { throw "No se pudo resolver la ruta del proyecto dentro de WSL." }

foreach ($test in @("prueba_puente_biometrico_89.py", "prueba_puente_biometrico_891.py")) {
    Write-Host "Ejecutando $test dentro de $Distro..."
    & wsl.exe -d $Distro --exec python3 "$wslRoot/pruebas/$test"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
