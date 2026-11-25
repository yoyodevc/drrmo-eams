# Run on the PC. Builds one transfer zip with everything the laptop needs:
#   project\            the working tree, .git included (unpushed and uncommitted work too)
#   database.sql        fresh dump of the local database
#   env.packed          copy of .env (APP_KEY included)
#   unpack-on-laptop.*  the laptop script
# Output: transfer\drrmo-transfer.zip. It holds real data and secrets. Never commit or upload it publicly.
. "$PSScriptRoot\_common.ps1"
Set-Location $script:Root
if (-not (Test-Path .env)) { throw '.env not found.' }

$stage = Join-Path $script:Root 'transfer\stage'
$zip = Join-Path $script:Root 'transfer\drrmo-transfer.zip'
Remove-Item (Join-Path $script:Root 'transfer') -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null

Write-Host '1/4 Exporting database...'
& "$PSScriptRoot\export-db.ps1"
$dump = Get-ChildItem (Join-Path $script:Root 'backups\drrmo-*.sql') | Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $dump -or $dump.Length -lt 1kb) { throw 'Database dump is missing or empty.' }
Copy-Item $dump.FullName (Join-Path $stage 'database.sql')

Write-Host '2/4 Copying .env...'
Copy-Item .env (Join-Path $stage 'env.packed')

Write-Host '3/4 Copying project files...'
$proj = Join-Path $stage 'project'
robocopy $script:Root $proj /E /NFL /NDL /NJH /NJS /NP `
    /XD node_modules vendor build build-off transfer backups messages-smoke nav-smoke drrmo-zppsu-documents .phpunit.cache `
    /XF hot hot.bak *.log | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)." }
# Keep empty runtime folders the app needs.
foreach ($d in 'storage\logs', 'storage\framework\cache', 'storage\framework\sessions', 'storage\framework\views', 'bootstrap\cache') {
    New-Item -ItemType Directory -Force (Join-Path $proj $d) | Out-Null
}
# Never ship the PC's runtime cache or the .env inside project (env.packed is the one source).
Remove-Item (Join-Path $proj '.env') -ErrorAction SilentlyContinue
Get-ChildItem (Join-Path $proj 'bootstrap\cache') -Filter *.php -ErrorAction SilentlyContinue | Remove-Item -Force

Copy-Item "$PSScriptRoot\unpack-on-laptop.ps1" $stage
Copy-Item "$PSScriptRoot\unpack-on-laptop.bat" $stage

Write-Host '4/4 Zipping...'
tar -a -cf $zip -C $stage .
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $zip)) { throw 'Zip failed.' }
Remove-Item $stage -Recurse -Force
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "`nDone: $zip ($mb MB)" -ForegroundColor Green
Write-Host 'Copy it to the laptop (USB or cloud drive), extract it, and double click unpack-on-laptop.bat.'
