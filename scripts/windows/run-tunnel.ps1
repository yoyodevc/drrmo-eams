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
Start-Window 'DRRMO queue' 'php artisan queue:work --queue=high,default --tries=3 --sleep=3'
$up = $false
for ($i = 0; $i -lt 30 -and -not $up; $i++) {
    Start-Sleep -Seconds 1
    try { $up = (Invoke-WebRequest "http://127.0.0.1:$Port/up" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { }
}
if (-not $up) { throw "The web server did not answer on port $Port. Look at the 'DRRMO web' window for the error." }

# Front door: Caddy serves the built files itself (gzip, many at once) and passes only app requests to PHP.
# PHP's built-in server handles one request at a time, so a slow phone download would otherwise block everything.
$front = $Port
$caddy = $null
if (-not (Test-Cmd caddy) -and (Test-Cmd winget)) {
    winget install --id CaddyServer.Caddy -e --silent --accept-source-agreements --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
if (Test-Cmd caddy) {
    $front = $Port + 80
    $pub = (Join-Path $script:Root 'public').Replace('\', '/')
    $cfgFile = Join-Path $script:Root 'storage\Caddyfile.tunnel'
    $cfg = @"
{
    admin off
    auto_https off
    servers {
        trusted_proxies static private_ranges
    }
}
:$front {
    bind 127.0.0.1
    root * $pub
    encode zstd gzip
    @static {
        file
        not path *.php
    }
    handle @static {
        file_server
    }
    handle {
        reverse_proxy 127.0.0.1:$Port
    }
}
"@
    [IO.File]::WriteAllText($cfgFile, $cfg, (New-Object Text.UTF8Encoding $false))
    $caddy = Start-Process caddy -ArgumentList 'run', '--config', $cfgFile, '--adapter', 'caddyfile' -PassThru -WindowStyle Minimized
    Start-Sleep -Seconds 2
    try { $null = Invoke-WebRequest "http://127.0.0.1:$front/up" -UseBasicParsing -TimeoutSec 5 } catch { Write-Warning 'Caddy did not answer. Falling back to PHP only.'; Stop-Process -Id $caddy.Id -Force -ErrorAction SilentlyContinue; $caddy = $null; $front = $Port }
} else { Write-Warning 'Caddy not available. Using PHP only: it can stall on slow phones.' }

# Start the tunnel to learn the URL. http2 avoids the QUIC (UDP) blocking that makes tunnels hang on some networks.
$log = Join-Path $env:TEMP 'drrmo-cloudflared.log'
Remove-Item $log -ErrorAction SilentlyContinue
$cf = Start-Process cloudflared -ArgumentList 'tunnel', '--url', "http://127.0.0.1:$front", '--protocol', 'http2', '--no-autoupdate', '--logfile', $log -PassThru -WindowStyle Minimized
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
if ($caddy) { Stop-Process -Id $caddy.Id -Force -ErrorAction SilentlyContinue }
