# Runs the app on http://127.0.0.1:8000 with the Vite dev server and a queue worker.
# Use -Build to serve built assets instead of Vite (no hot reload).
param([switch]$Build, [int]$Port = 8000)
. "$PSScriptRoot\_common.ps1"
Set-Location $script:Root
if (-not (Test-Path .env)) { throw '.env is missing. Run setup-laptop.ps1 first.' }

Set-EnvValue 'APP_URL' "http://127.0.0.1:$Port"
Set-EnvValue 'SESSION_SECURE_COOKIE' 'false'
php artisan config:clear | Out-Null

Start-Window 'DRRMO web' "php artisan serve --host=127.0.0.1 --port=$Port"
Start-Window 'DRRMO queue' 'php artisan queue:work --queue=high,default --tries=3 --sleep=3'
if ($Build) {
    Remove-Item public\hot -ErrorAction SilentlyContinue
    npm run build
} else {
    Start-Window 'DRRMO vite' 'npm run dev'
}
Write-Host "App: http://127.0.0.1:$Port  (close the opened windows to stop)"
