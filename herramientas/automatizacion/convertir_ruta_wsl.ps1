[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [string]$Distro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
$fullPath = [System.IO.Path]::GetFullPath($Path)
$previousPath = [Environment]::GetEnvironmentVariable("BIOSECURE_WINDOWS_PATH", "Process")
$previousWslEnv = [Environment]::GetEnvironmentVariable("WSLENV", "Process")

try {
    # La ubicación predeterminada de unidades DrvFs evita por completo el
    # parser defectuoso de wslpath/Windows PowerShell. Se verifica dentro de
    # la distribución antes de aceptarla.
    if ($fullPath -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLowerInvariant()
        $tail = $Matches[2].Replace('\', '/')
        $candidate = "/mnt/$drive/$tail"
        & wsl.exe -d $Distro --exec test -e $candidate 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Output $candidate
            return
        }
    }

    # WSLENV /p hace que WSL traduzca la ruta sin entregarla a su parser de
    # argumentos. En Windows PowerShell 5.1, pasar C:\... directamente a
    # `wslpath` elimina las barras y produce rutas como C:UsersUsuario...
    $env:BIOSECURE_WINDOWS_PATH = $fullPath
    $env:WSLENV = if ([string]::IsNullOrWhiteSpace($previousWslEnv)) {
        "BIOSECURE_WINDOWS_PATH/p"
    } else {
        "BIOSECURE_WINDOWS_PATH/p:$previousWslEnv"
    }
    $translated = & wsl.exe -d $Distro --exec printenv BIOSECURE_WINDOWS_PATH 2>$null | Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$translated)) {
        throw "WSL no pudo traducir la ruta '$fullPath' para $Distro."
    }
    Write-Output ((([string]$translated) -replace ([char]0), "").Trim())
} finally {
    if ($null -eq $previousPath) { Remove-Item Env:BIOSECURE_WINDOWS_PATH -ErrorAction SilentlyContinue }
    else { $env:BIOSECURE_WINDOWS_PATH = $previousPath }
    if ($null -eq $previousWslEnv) { Remove-Item Env:WSLENV -ErrorAction SilentlyContinue }
    else { $env:WSLENV = $previousWslEnv }
}
