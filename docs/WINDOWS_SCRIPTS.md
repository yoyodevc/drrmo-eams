# Windows scripts

Scripts live in `scripts/windows`. Each has a `.ps1` and a `.bat` wrapper (double click it).

## Run locally

`run-local.bat` starts the web server on http://127.0.0.1:8000, the queue worker, the scheduler and Vite.
In PowerShell, add `-Build` to serve built assets instead of Vite.
MySQL must already be running.
The worker runs the `high` queue first, so emergency pushes are sent. Both scripts also open a scheduler window for reminders and report checks, and pass the temp folder to PHP so memo files and photos upload. Keep `MAIL_MAILER=log` in `.env` while testing so no real email goes out.

## Run behind a Cloudflare quick tunnel

`run-tunnel.bat` builds the assets, starts `cloudflared` and prints a random `https://...trycloudflare.com` URL.
It writes that URL to `APP_URL` and sets `SESSION_SECURE_COOKIE=true` and `TRUSTED_PROXIES=127.0.0.1` in `.env`.
The URL changes every run. Auth is JWT, so there are no Sanctum domains to set.
Run `run-local.bat` afterwards to switch the settings back.

## Move the project to a laptop (recommended)

No push is needed. The zip carries your working tree, `.git`, database dump and `.env`.

1. On the PC, double click `pack-for-laptop.bat`. It writes `transfer\drrmo-transfer.zip`.
2. Copy the zip to the laptop (USB or a private drive). It holds real data and secrets, so delete it afterwards.
3. On the laptop, extract it and double click `unpack-on-laptop.bat`.

The laptop script installs the missing tools with winget, turns on the PHP extensions, copies the project, writes `.env` (only the DB settings change), installs dependencies, imports the dump, migrates, builds and starts the app.
It is safe to rerun. It skips the import if the database already has tables (`-ForceImport` reloads it).
If MySQL root has a password, run it from PowerShell with `-DbPass 'secret'`.

What can still fail:
- winget is missing. Install App Installer from the Microsoft Store.
- A fresh install is not on PATH yet. Open a new window (or reboot) and rerun.
- MySQL is not running, or root has a password you did not pass. The script stops with a message.
- The Oracle MySQL install from winget may need its configuration wizard first. XAMPP also works.
- Antivirus or a blocked network can break winget, composer or npm. Rerun when fixed.

## Set up a fresh laptop from GitHub (alternative)

Use this only after `git push`. The clone only has what is on GitHub.

```powershell
powershell -ExecutionPolicy Bypass -File setup-laptop.ps1 -Dir C:\drrmo-eams
```

Add `-DumpFile C:\path\drrmo.sql` to import a dump from `export-db.bat`. Without it the script migrates and seeds.
Use `-DbUser` and `-DbPass` if MySQL root has a password.
