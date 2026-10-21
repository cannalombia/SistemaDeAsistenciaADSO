<#
    Crea un ZIP para compartir sin .env, Git, node_modules, logs, respaldos ni datos operativos sensibles.
#>
[CmdletBinding()]
param([string]$Nombre = "VERSION 8.1 HTML ASISTENCIA SENA - ENTREGA SEGURA")

$ErrorActionPreference = "Stop"
$Raiz = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$Temporal = Join-Path ([System.IO.Path]::GetTempPath()) ("sena_entrega_" + [guid]::NewGuid().ToString("N"))
$Salida = Join-Path (Split-Path -Parent $Raiz) ($Nombre + ".zip")

$excluirDirectorios = @(".git", "node_modules", "respaldos", "tmp", "entregas", "__pycache__")
$excluirExactos = @(
    ".env",
    ".env.bak",
    "usuarios_listo_para_importar.csv",
    "usuarios.csv",
    "datos/credenciales_administrador.json",
    "datos/clave_codigos.key",
    "datos/biometria_mock_estado.json",
    "datos/clave_puente_biometrico.key",
    "datos/usuarios_gestionados.json",
    "datos/aprendices.json",
    "datos/asistencia.json",
    "datos/estado_autenticacion_correo.json",
    "datos/historial_envios_correo.json"
)

New-Item -ItemType Directory -Path $Temporal -Force | Out-Null
try {
    Get-ChildItem -LiteralPath $Raiz -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($Raiz.Length).TrimStart('\','/').Replace('\','/')
        $partes = $rel.Split('/')
        if ($partes | Where-Object { $excluirDirectorios -contains $_ }) { return }
        if ($excluirExactos -contains $rel) { return }
        if ($rel -match '(^|/)datos/.*\.(log|key|tmp|json)$' -and $rel -notmatch '^datos/ejemplos/') { return }
        if ($rel -match '(^|/)\.env($|\.)|\.(bak|pyc|sqlite|sqlite3)$') { return }
        if ($rel -match '^documentacion/evidencias/') { return }
        if ($rel -match '(^|/)datos/biometria_real/') { return }
        if ($rel -match '(^|/)datos/(supervisor|servidor|biometria)_') { return }
        if ($rel -match '(^|/)datos/informe-general-.*\.pdf$') { return }
        $destino = Join-Path $Temporal $rel
        New-Item -ItemType Directory -Path (Split-Path -Parent $destino) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $destino -Force
    }
    if (Test-Path -LiteralPath $Salida) { Remove-Item -LiteralPath $Salida -Force }
    Compress-Archive -Path (Join-Path $Temporal '*') -DestinationPath $Salida -CompressionLevel Optimal
    Write-Output "Entrega segura creada: $Salida"
} finally {
    Remove-Item -LiteralPath $Temporal -Recurse -Force -ErrorAction SilentlyContinue
}
