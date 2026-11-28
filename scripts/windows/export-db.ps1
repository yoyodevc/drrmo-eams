# Dumps the local MySQL database to a .sql file you can carry to the laptop.
# Reads DB settings from .env. Output: backups\drrmo-<timestamp>.sql
. "$PSScriptRoot\_common.ps1"
Set-Location $script:Root
$db = Get-EnvValue 'DB_DATABASE'; $user = Get-EnvValue 'DB_USERNAME'; $pass = Get-EnvValue 'DB_PASSWORD'
$h = Get-EnvValue 'DB_HOST'; $port = Get-EnvValue 'DB_PORT'
$dump = Find-MysqlTool 'mysqldump.exe'
if (-not $dump) { throw 'mysqldump.exe not found. Add MySQL bin to PATH.' }
New-Item -ItemType Directory -Force backups | Out-Null
$out = "backups\drrmo-$(Get-Date -Format 'yyyyMMdd-HHmm').sql"
$a = @("-h$h", "-P$port", "-u$user", '--single-transaction', '--routines', '--default-character-set=utf8mb4', "--result-file=$out")
if ($pass) { $a += "-p$pass" }
& $dump @a $db
if ($LASTEXITCODE -ne 0) { throw 'mysqldump failed.' }
Write-Host "Wrote $out. It holds real data: keep it private, never commit it." -ForegroundColor Green
