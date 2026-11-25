# Runs the app behind a Cloudflare quick tunnel (random trycloudflare.com URL, no domain).
# The URL changes every run. It is written to APP_URL in .env.
param([int]$Port = 8000)
. "$PSScriptRoot\_common.ps1"
Set-Location $script:Root
if (-not (Test-Path .env)) { throw '.env is missing. Run setup-laptop.ps1 first.' }
if (-not (Test-Cmd cloudflared)) {
    if (Test-Cmd winget) { winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements }
    if (-not (Test-Cmd cloudflared)) { throw 'cloudflared not found. Install it, then reopen PowerShell.' }
}

# The php on PATH must meet the app's requirement (XAMPP's old php often comes first).
php -r "exit(PHP_VERSION_ID >= 80300 ? 0 : 1);"
if ($LASTEXITCODE -ne 0) { throw "php on PATH is too old ($(php -r 'echo PHP_VERSION;')). Put PHP 8.3+ first on PATH." }

# Quick tunnels need built assets. A hot file would point the browser at localhost Vite.
Remove-Item public\hot -ErrorAction SilentlyContinue
Write-Host 'Building assets...'
npm run build

# Start the web server first and wait until it answers.
Set-EnvValue 'TRUSTED_PROXIES' '127.0.0.1'
php artisan config:clear | Out-Null
Start-Window 'DRRMO web' "php artisan serve --host=127.0.0.1 --port=$Port"
Start-Window 'DRRMO queue' 'php artisan queue:work --tries=3 --sleep=3'
$up = $false
for ($i = 0; $i -lt 30 -and -not $up; $i++) {
    Start-Sleep -Seconds 1
    try { $up = (Invoke-WebRequest "http://127.0.0.1:$Port/up" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { }
}
if (-not $up) { throw "The web server did not answer on port $Port. Look at the 'DRRMO web' window for the error." }

# Start the tunnel to learn the URL. http2 avoids the QUIC (UDP) blocking that makes tunnels hang on some networks.
$log = Join-Path $env:TEMP 'drrmo-cloudflared.log'
Remove-Item $log -ErrorAction SilentlyContinue
$cf = Start-Process cloudflared -ArgumentList 'tunnel', '--url', "http://127.0.0.1:$Port", '--protocol', 'http2', '--no-autoupdate', '--logfile', $log -PassThru -WindowStyle Minimized
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $log) {
        $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($m) { $url = $m.Matches[0].Value }
    }
}
if (-not $url) { Stop-Process -Id $cf.Id -Force; throw "No tunnel URL after 60s. See $log" }

# APP_URL plus cookie and proxy settings for https through the tunnel.
# Auth is JWT, so there are no Sanctum stateful domains to set.
Set-EnvValue 'APP_URL' $url
Set-EnvValue 'SESSION_SECURE_COOKIE' 'true'
Set-EnvValue 'SESSION_DOMAIN' 'null'
Set-EnvValue 'TRUSTED_PROXIES' '127.0.0.1'
php artisan config:clear | Out-Null

# Check the app through the public URL (the first seconds can fail while DNS spreads).
$ok = $false
for ($i = 0; $i -lt 20 -and -not $ok; $i++) {
    try { $ok = (Invoke-WebRequest "$url/up" -UseBasicParsing -TimeoutSec 8).StatusCode -eq 200 } catch { Start-Sleep -Seconds 2 }
}
if ($ok) { Write-Host 'Tunnel check: OK' -ForegroundColor Green }
else { Write-Warning 'The public URL did not answer from this PC. Wait a minute and retry, or check the network (firewall, VPN).' }
Write-Host ''
Write-Host "Public URL: $url" -ForegroundColor Green
Write-Host 'Press Enter here to stop the tunnel (close the web and queue windows too).'
Read-Host | Out-Null
Stop-Process -Id $cf.Id -Force -ErrorAction SilentlyContinue
