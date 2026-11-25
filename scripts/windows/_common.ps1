# Shared helpers. Dot-source from the other scripts.
$ErrorActionPreference = 'Stop'
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Test-Cmd($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

function Get-EnvValue($key) {
    $f = Join-Path $script:Root '.env'
    if (-not (Test-Path $f)) { return $null }
    $line = Get-Content $f | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
    if ($line) { return ($line -replace "^$key=", '').Trim('"') }
    return $null
}

function Set-EnvValue($key, $value) {
    $f = Join-Path $script:Root '.env'
    $lines = @(Get-Content $f)
    if ($lines.Count -gt 0) { $lines[0] = $lines[0].TrimStart([char]0xFEFF) }
    $found = $false
    $lines = $lines | ForEach-Object { if ($_ -match "^$key=") { $found = $true; "$key=$value" } else { $_ } }
    if (-not $found) { $lines += "$key=$value" }
    [IO.File]::WriteAllLines($f, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
}

function Find-MysqlTool($exe) {
    $c = Get-Command $exe -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    foreach ($d in 'C:\xampp\mysql\bin', 'C:\laragon\bin\mysql\*\bin', 'C:\Program Files\MySQL\MySQL Server *\bin', "$env:USERPROFILE\.config\herd\bin\*") {
        $hit = Get-ChildItem -Path (Join-Path $d $exe) -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

function Start-Window($title, $command) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle='$title'; Set-Location '$script:Root'; $command"
}
