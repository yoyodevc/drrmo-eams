# Windows scripts

Scripts live in `scripts/windows`. Each has a `.ps1` and a `.bat` wrapper (double click it).

## Run locally

`run-local.bat` starts the web server on http://127.0.0.1:8000, the queue worker and Vite.
In PowerShell, add `-Build` to serve built assets instead of Vite.
MySQL must already be running.

## Run behind a Cloudflare quick tunnel

`run-tunnel.bat` builds the assets, starts `cloudflared` and prints a random `https://...trycloudflare.com` URL.
It writes that URL to `APP_URL` and sets `SESSION_SECURE_COOKIE=true` and `TRUSTED_PROXIES=127.0.0.1` in `.env`.
The URL changes every run. Auth is JWT, so there are no Sanctum domains to set.
Run `run-local.bat` afterwards to switch the settings back.

## Set up a fresh laptop

1. On the PC, push every local commit first (`git push`). The clone only gets what is on GitHub.
2. Optional, to copy your data: run `export-db.bat` on the PC. It writes `backups\drrmo-<time>.sql`. Copy it to the laptop. It holds real data, so never commit it.
3. On the laptop, copy `setup-laptop.ps1` over (or download it from GitHub) and run:

```powershell
powershell -ExecutionPolicy Bypass -File setup-laptop.ps1 -Dir C:\drrmo-eams
```

To import the dump, add `-DumpFile C:\path\drrmo.sql`. Without it the script migrates and seeds.
It installs Git, Node, PHP, Composer, cloudflared and MySQL with winget when they are missing.
Check that the PHP extensions in `php.ini` are on (pdo_mysql, mbstring, openssl, fileinfo, curl, zip, intl, gd).
Use `-DbUser` and `-DbPass` if MySQL root has a password.
