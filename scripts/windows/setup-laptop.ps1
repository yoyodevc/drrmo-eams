# Fresh laptop setup. Run in PowerShell:
#   powershell -ExecutionPolicy Bypass -File setup-laptop.ps1 [-Dir C:\drrmo-eams] [-DumpFile C:\path\dump.sql]
# Push all local commits on the PC first, or the clone will miss them.
param(
    [string]$Dir = "$env:USERPROFILE\drrmo-eams",
    [string]$Repo = 'https://github.com/yoyodevc/drrmo-eams.git',
    [string]$DumpFile = '',
    [string]$DbName = 'drrmo_eams',
    [string]$DbUser = 'root',
    [string]$DbPass = ''
)
$ErrorActionPreference = 'Stop'
function Test-Cmd($n) { [bool](Get-Command $n -ErrorAction SilentlyContinue) }
function Update-SessionPath { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Install-If($cmd, $id) {
    if (Test-Cmd $cmd) { Write-Host "ok  $cmd"; return }
    if (-not (Test-Cmd winget)) { throw "winget missing. Install $cmd by hand." }
    Write-Host "installing $id ..."
    winget install --id $id -e --accept-source-agreements --accept-package-agreements
    Update-SessionPath
}

# 1. Prerequisites
Install-If git Git.Git
Install-If node OpenJS.NodeJS.LTS
Install-If php PHP.PHP.8.4
Install-If composer Composer.Composer
Install-If cloudflared Cloudflare.cloudflared
if (-not (Test-Cmd mysql) -and -not (Test-Path 'C:\xampp\mysql\bin\mysql.exe')) { Install-If mysql Oracle.MySQL }
foreach ($c in 'git', 'node', 'php', 'composer') { if (-not (Test-Cmd $c)) { throw "$c is not available. Reopen PowerShell and rerun." } }
Write-Host 'PHP needs these extensions on in php.ini: pdo_mysql, mbstring, openssl, fileinfo, curl, zip, intl, gd.'

# 2. Clone
if (Test-Path (Join-Path $Dir '.git')) { Write-Host "Repo already at $Dir, pulling."; git -C $Dir pull --ff-only }
else { git clone $Repo $Dir }
Set-Location $Dir

# 3. Dependencies and .env
composer install
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
$envText = (Get-Content .env) `
    -replace '^DB_HOST=.*', 'DB_HOST=127.0.0.1' `
    -replace '^DB_USERNAME=.*', "DB_USERNAME=$DbUser" `
    -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$DbPass" `
    -replace '^DB_DATABASE=.*', "DB_DATABASE=$DbName" `
    -replace '^APP_URL=.*', 'APP_URL=http://127.0.0.1:8000'
[IO.File]::WriteAllLines((Join-Path (Get-Location) '.env'), [string[]]$envText, (New-Object Text.UTF8Encoding $false))
php artisan key:generate

# 4. Database
$mysql = (Get-Command mysql -ErrorAction SilentlyContinue).Source
if (-not $mysql -and (Test-Path 'C:\xampp\mysql\bin\mysql.exe')) { $mysql = 'C:\xampp\mysql\bin\mysql.exe' }
if (-not $mysql) { throw 'mysql client not found. Start MySQL, put mysql.exe on PATH, rerun.' }
$pw = @(); if ($DbPass) { $pw = @("-p$DbPass") }
& $mysql -u $DbUser @pw -e "CREATE DATABASE IF NOT EXISTS ``$DbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if ($DumpFile) {
    if (-not (Test-Path $DumpFile)) { throw "Dump not found: $DumpFile" }
    Write-Host "Importing $DumpFile ..."
    $passArg = ''; if ($DbPass) { $passArg = "-p$DbPass" }
    cmd /c "`"$mysql`" -u $DbUser $passArg $DbName < `"$DumpFile`""
    php artisan migrate --force
} else {
    php artisan migrate --force --seed
}

php artisan storage:link
npm run build
Write-Host "`nDone. Start the app with scripts\windows\run-local.bat or run-tunnel.bat" -ForegroundColor Green
