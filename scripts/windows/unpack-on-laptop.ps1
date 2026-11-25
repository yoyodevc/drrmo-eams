# Run on the laptop from the extracted transfer folder (next to project\, database.sql, env.packed).
#   powershell -ExecutionPolicy Bypass -File unpack-on-laptop.ps1 [-Dir C:\drrmo-eams] [-DbUser root] [-DbPass secret]
# Safe to rerun. Skips what is already done. Use -ForceImport to reload the database dump.
param(
    [string]$Dir = "$env:USERPROFILE\drrmo-eams",
    [string]$DbUser = 'root',
    [string]$DbPass = '',
    [switch]$ForceImport,
    [switch]$NoStart
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$step = 0
function Step($t) { $script:step++; Write-Host "`n[$script:step] $t" -ForegroundColor Cyan }
function Fail($m) { Write-Host "`nFAILED: $m" -ForegroundColor Red; exit 1 }
function Test-Cmd($n) { [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function Update-SessionPath {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Run($label, [scriptblock]$b) {
    & $b
    if ($LASTEXITCODE -ne 0) { Fail "$label failed (exit $LASTEXITCODE). Fix the message above and rerun this script." }
}
function Install-If($cmd, $id) {
    if (Test-Cmd $cmd) { Write-Host "ok  $cmd"; return }
    if (-not (Test-Cmd winget)) { Fail "winget is missing. Install 'App Installer' from the Microsoft Store (or install $cmd by hand), then rerun." }
    Write-Host "installing $id ..."
    winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements
    Update-SessionPath
    if (-not (Test-Cmd $cmd)) { Fail "$cmd was installed but is not on PATH yet. Close this window, open a new one, and rerun (a reboot may be needed)." }
}

# --- Check the transfer folder
Step 'Checking the transfer folder'
foreach ($f in 'project\artisan', 'database.sql', 'env.packed') {
    if (-not (Test-Path (Join-Path $here $f))) { Fail "Missing $f in $here. Run this from the extracted transfer folder." }
}

# --- Prerequisites
Step 'Installing prerequisites (skips what exists)'
Install-If git Git.Git
Install-If node OpenJS.NodeJS.LTS
Install-If php PHP.PHP.8.4
Install-If composer Composer.Composer
Install-If cloudflared Cloudflare.cloudflared

# --- php.ini extensions
Step 'Enabling PHP extensions'
$ini = ((php --ini) | Select-String 'Loaded Configuration File:\s*(.+)$').Matches | ForEach-Object { $_.Groups[1].Value.Trim() } | Select-Object -First 1
if (-not $ini -or $ini -eq '(none)') {
    $phpDir = Split-Path (Get-Command php).Source
    $dev = Join-Path $phpDir 'php.ini-development'
    if (-not (Test-Path $dev)) { Fail "No php.ini and no php.ini-development in $phpDir. Create php.ini by hand and rerun." }
    Copy-Item $dev (Join-Path $phpDir 'php.ini')
    $ini = Join-Path $phpDir 'php.ini'
}
$text = Get-Content $ini -Raw
foreach ($e in 'pdo_mysql', 'mysqli', 'mbstring', 'openssl', 'fileinfo', 'curl', 'zip', 'intl', 'gd', 'sodium', 'exif') {
    $text = $text -replace "(?m)^\s*;\s*(extension=$e)\s*$", '$1'
}
$phpDir = Split-Path (Get-Command php).Source
if ($text -match '(?m)^\s*;\s*extension_dir\s*=\s*"ext"') { $text = $text -replace '(?m)^\s*;\s*(extension_dir\s*=\s*"ext")', '$1' }
# Drop duplicate active lines (PHP warns "Module already loaded").
$seenExt = @{}
$lines = foreach ($ln in ($text -split "`r?`n")) {
    if ($ln -match '^\s*extension\s*=\s*"?([\w\.]+)"?\s*$') {
        $k = $Matches[1].ToLower() -replace '^php_|\.dll$', ''
        if ($seenExt[$k]) { continue }
        $seenExt[$k] = 1
    }
    $ln
}
[IO.File]::WriteAllText($ini, ($lines -join "`r`n"), (New-Object Text.UTF8Encoding $false))
$missing = @()
$loaded = (php -m) -join ' '
foreach ($e in 'pdo_mysql', 'mbstring', 'openssl', 'fileinfo', 'curl', 'zip', 'intl', 'gd') { if ($loaded -notmatch "(?i)\b$e\b") { $missing += $e } }
if ($missing) { Fail "PHP still lacks: $($missing -join ', '). Check $ini (the extension DLL may be absent in this PHP build)." }
Write-Host "ok  $ini"

# --- MySQL
Step 'Checking MySQL'
$mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysql) { foreach ($g in 'C:\xampp\mysql\bin\mysql.exe', 'C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe', 'C:\laragon\bin\mysql\*\bin\mysql.exe') { $h = Get-ChildItem $g -ErrorAction SilentlyContinue | Select-Object -First 1; if ($h) { $mysql = $h.FullName; break } } }
if (-not $mysql) {
    Install-If mysql Oracle.MySQL
    $mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
    if (-not $mysql) { $h = Get-ChildItem 'C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($h) { $mysql = $h.FullName } }
}
if (-not $mysql) { Fail 'mysql client not found. Install MySQL or XAMPP, start it, and rerun.' }
$svc = Get-Service | Where-Object { $_.Name -match '^(MySQL|MariaDB)' -and $_.Status -ne 'Running' } | Select-Object -First 1
if ($svc) { try { Start-Service $svc.Name } catch { Write-Warning "Could not start service $($svc.Name). Start MySQL yourself." } }
$pwArg = @(); if ($DbPass) { $pwArg = @("-p$DbPass") }
$null = & $mysql -u $DbUser @pwArg -e 'SELECT 1' 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Cannot log in to MySQL as '$DbUser'. Make sure MySQL is running. If root has a password, rerun with -DbPass 'yourpassword'." }
Write-Host 'ok  MySQL login'

# --- Copy project
Step "Copying project to $Dir"
New-Item -ItemType Directory -Force $Dir | Out-Null
robocopy (Join-Path $here 'project') $Dir /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Fail "robocopy failed ($LASTEXITCODE)." }
$global:LASTEXITCODE = 0
# Rewrite .git/config clean (no BOM, no NULs, UTF-8) so git never sees a mangled copy.
if (Test-Path (Join-Path $Dir '.git')) {
    $cfg = $null
    $src = Join-Path $here 'git-config.packed'
    if (Test-Path $src) {
        $b = [IO.File]::ReadAllBytes($src)
        if ($b.Length -ge 2 -and $b[0] -eq 0xFF -and $b[1] -eq 0xFE) { $cfg = [Text.Encoding]::Unicode.GetString($b, 2, $b.Length - 2) }
        elseif ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { $cfg = [Text.Encoding]::UTF8.GetString($b, 3, $b.Length - 3) }
        else { $cfg = [Text.Encoding]::UTF8.GetString($b) }
        $cfg = ($cfg -replace "`0", '') -replace "`r`n", "`n"
        if ($cfg -notmatch '^\s*\[') { $cfg = $null }
    }
    if (-not $cfg) { $cfg = "[core]`n`trepositoryformatversion = 0`n`tfilemode = false`n`tbare = false`n`tlogallrefupdates = true`n" }
    [IO.File]::WriteAllText((Join-Path $Dir '.git\config'), $cfg, (New-Object Text.UTF8Encoding $false))
}
Set-Location $Dir
# Convenience only, never fatal.
try { $ErrorActionPreference = 'Continue'; git config --global --add safe.directory ($Dir -replace '\\', '/') 2>&1 | Out-Null } catch { }
$ErrorActionPreference = 'Stop'
$global:LASTEXITCODE = 0

# --- .env
Step 'Writing .env from the PC copy (only DB settings changed)'
$envLines = Get-Content (Join-Path $here 'env.packed')
$db = ($envLines | Where-Object { $_ -match '^DB_DATABASE=' } | Select-Object -First 1) -replace '^DB_DATABASE=', ''
if (-not $db) { $db = 'drrmo_eams' }
$set = @{ DB_HOST = '127.0.0.1'; DB_PORT = '3306'; DB_USERNAME = $DbUser; DB_PASSWORD = $DbPass; APP_URL = 'http://127.0.0.1:8000'; SESSION_SECURE_COOKIE = 'false'; TRUSTED_PROXIES = '' }
$out = @(); $seen = @{}
foreach ($l in $envLines) {
    if ($l -match '^([A-Z_]+)=' -and $set.ContainsKey($Matches[1])) { $out += "$($Matches[1])=$($set[$Matches[1]])"; $seen[$Matches[1]] = 1 } else { $out += $l }
}
foreach ($k in $set.Keys) { if (-not $seen[$k]) { $out += "$k=$($set[$k])" } }
Set-Content .env $out -Encoding utf8
if (-not ($out -match '^APP_KEY=base64:')) { Run 'key:generate' { php artisan key:generate --force } }

# --- Dependencies
Step 'Installing PHP and JS dependencies'
Run 'composer install' { composer install --no-interaction }
Run 'npm install' { npm install --no-audit --no-fund }

# --- Database
Step "Importing database '$db'"
& $mysql -u $DbUser @pwArg -e "CREATE DATABASE IF NOT EXISTS ``$db`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if ($LASTEXITCODE -ne 0) { Fail 'Could not create the database.' }
$tables = & $mysql -u $DbUser @pwArg -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db'"
if ([int]$tables -gt 0 -and -not $ForceImport) {
    Write-Host "skip  database already has $tables tables (use -ForceImport to reload the dump)"
} else {
    $passArg = ''; if ($DbPass) { $passArg = "-p$DbPass" }
    cmd /c "`"$mysql`" -u $DbUser $passArg $db < `"$(Join-Path $here 'database.sql')`""
    if ($LASTEXITCODE -ne 0) { Fail 'Database import failed.' }
    Write-Host 'ok  dump imported'
}
Run 'migrate' { php artisan migrate --force }

# --- Finish
Step 'Final setup'
php artisan storage:link 2>$null
$global:LASTEXITCODE = 0
php artisan config:clear | Out-Null
Run 'npm run build' { npm run build }

Write-Host "`nSetup complete in $Dir" -ForegroundColor Green
if (-not $NoStart) {
    Step 'Starting the app'
    & (Join-Path $Dir 'scripts\windows\run-local.ps1') -Build
    Start-Process 'http://127.0.0.1:8000'
}
