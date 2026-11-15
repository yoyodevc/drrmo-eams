# DRRMO EAMS

Personnel Event Assignment and Monitoring System for the ZPPSU Disaster Risk Reduction and Management Office.

The DRRMO plans events, assigns Marshals and Volunteers, emails them, collects 2-hourly site reports, and sees approximate positions of on-duty people on a campus map. Built with Laravel 13, React 19, MySQL 8.

> Status: in development. 20 of 45 stories are done, including events and assignments, assignment emails, shift reminders, the notification log, conflict checks, the admin dashboard and start and end duty. The story table in [docs/BACKLOG.md](docs/BACKLOG.md) is kept up to date. Start with [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Documents

| Document | What it covers |
|---|---|
| [PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Goals, scope, assumptions, risks, roadmap |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Diagrams, auth, jobs, GPS and report flows, map licence |
| [USER_FLOWS.md](docs/USER_FLOWS.md) | The ten day-in-the-life flows |
| [SCREENS.md](docs/SCREENS.md) | Every screen, desktop and mobile |
| [MODULES.md](docs/MODULES.md) | Module boundaries, endpoints, ownership |
| [DATABASE.md](docs/DATABASE.md) | Tables, gaps, migrations, indexes, seeders |
| [SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | Permission matrix, Data Privacy Act checklist |
| [BACKLOG.md](docs/BACKLOG.md) | Epics and stories by milestone |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Server setup, deploy, backup, rollback |
| [DOCUMENTATION_GUIDE.md](docs/DOCUMENTATION_GUIDE.md) | Code docs and the capstone paper (chapters, dev log, figures) |
| [WORKFLOWS.md](docs/WORKFLOWS.md) | Checklists: new module, table, endpoint, permission, job, screen |
| [WORKING_WITH_CLAUDE_CODE.md](docs/WORKING_WITH_CLAUDE_CODE.md) | One session per module |
| [PLANNING_SUMMARY.md](docs/PLANNING_SUMMARY.md) | One-page summary and current status |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, commits, Definition of Done |

## Local setup on Windows (default: Laravel Sail)

Why Sail and not XAMPP: Laravel 13 needs PHP 8.3 or newer, and the latest XAMPP release still ships PHP 8.2. Sail runs the exact PHP and MySQL versions we use on the server, inside Docker.

One-time install:

1. Install WSL2. Open PowerShell as administrator and run `wsl --install`. Restart when asked. This installs Ubuntu.
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). In Settings, Resources, WSL integration, turn on Ubuntu.
3. Open the Ubuntu app and install Git: `sudo apt update && sudo apt install -y git`.

Get the project and run it:

```
cd ~
git clone https://github.com/OWNER/drrmo-eams.git
cd drrmo-eams
bash scripts/setup.sh
```

Keep the project inside the Ubuntu home folder (`~/`), not under `/mnt/c/`. It is much faster.

Open http://localhost for the app and http://localhost:8025 for Mailpit, which catches every email the app sends locally.

Sail does not start a queue worker or the scheduler for you. Without them, assignment emails and shift reminders never go out. Run each in its own terminal:

```
./vendor/bin/sail artisan queue:work
./vendor/bin/sail artisan schedule:work
```

Everyday commands:

```
./vendor/bin/sail up -d          # start
./vendor/bin/sail npm run dev    # hot reload while coding
./vendor/bin/sail composer check # Pint, Larastan, Pest
./vendor/bin/sail npm run check  # ESLint, Prettier, TypeScript, Vitest
./vendor/bin/sail down           # stop
```

Tip: add `alias sail='./vendor/bin/sail'` to `~/.bashrc`.

Testing on your phone needs HTTPS for GPS. Use the staging server, or a tunnel such as `./vendor/bin/sail share`.

## Run without Docker (Herd plus XAMPP MariaDB)

Use this if Docker uses too much memory on your PC. It runs PHP and the database straight on Windows.

One-time install:

1. Install [Laravel Herd](https://herd.laravel.com/windows). It gives you PHP 8.3 or newer and Composer.
2. Install XAMPP. We only use its MySQL (MariaDB). Do not use XAMPP's PHP, it is too old.
3. In the XAMPP Control Panel, start MySQL. Create a database named `drrmo_eams` (utf8mb4, utf8mb4_unicode_ci). Create a second one named `testing` for the PHP tests.
4. Copy `.env.example` to `.env` and change these lines:

```
APP_URL=http://127.0.0.1:8000
DB_HOST=127.0.0.1
DB_USERNAME=root
DB_PASSWORD=
MAIL_MAILER=log
AUTH_ALLOWED_ORIGINS=http://127.0.0.1:8000,http://localhost:8000
```

5. In the project folder run:

```
composer install
npm install
php artisan key:generate
php artisan jwt:secret
php artisan migrate --seed
php artisan db:seed --class=DemoSeeder
```

XAMPP puts its old PHP on the system PATH. Check with `php -v`. If it shows 8.2, put Herd's folder (`C:\Users\<you>\.config\herd\bin`) first on the PATH, or only for VS Code with `terminal.integrated.env.windows` in `.vscode/settings.json`.

Every day:

1. Start MySQL in the XAMPP Control Panel.
2. In one terminal run `php artisan serve`.
3. In a second terminal run `npm run dev`. Skip this if you are not changing React code.
4. In a third terminal run `php artisan queue:work`. Assignment and reminder emails wait in the queue until it runs.
5. In a fourth terminal run `php artisan schedule:work`. It sends the shift reminders and closes finished duties.
6. Open http://127.0.0.1:8000. With `MAIL_MAILER=log`, emails are written to `storage/logs/laravel.log`.

To stop, press Ctrl+C in all terminals and stop MySQL in XAMPP.

Run checks with `composer check` and `npm run check`. Note: XAMPP ships MariaDB 10.4, not MySQL 8. The server and CI use MySQL 8, so CI still catches database differences.

## Email

The app sends these emails:

- **Queued** (needs `php artisan queue:work`): a new, moved or cancelled assignment, a cancelled event, and the shift reminders (6:00 PM the evening before and 1 hour before). Each email has a button that opens the app on the right duty, with the link `/?assignment=<id>`. A person who is signed out signs in first and then lands on that duty.
- **Sent at once:** the sign up confirmation code, access approved or rejected, and the password reset link.

A failed queued email is retried 3 times and then shows as `failed` in the notification log. Reminders need `php artisan schedule:work` locally. On the server, cron runs the scheduler.

Where mail goes is set by `MAIL_MAILER` in `.env`:

- `log`: nothing is sent. The message is written to `storage/logs/laravel.log`. Use this for local work.
- `smtp`: the message goes to the SMTP server in `MAIL_HOST`. Docker uses Mailpit. Production uses Brevo.
- Tests never send real mail, whatever `.env` says.

### Brevo setup

Do not use a personal Gmail account to send. Gmail held our test emails for up to 2 hours. Brevo delivered them in seconds.

1. Make a Brevo account and verify the sender address. A school domain with SPF and DKIM set up by IT gives the best delivery.
2. Make an SMTP key in Brevo under SMTP & API.
3. In Brevo under Security, then Authorized IPs, add the IP address of the server. A home PC has a changing IP, so for local tests turn off the IP block for SMTP keys.
4. Put these in the server `.env`. Never commit it, and never paste the key in chat or tickets.

```
MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_USERNAME=<your Brevo SMTP login>
MAIL_PASSWORD=<your Brevo SMTP key>
MAIL_FROM_ADDRESS=<the verified sender>
MAIL_FROM_NAME="ZPPSU DRRMO"
```

5. Restart the queue worker with `php artisan queue:restart` so it reads the new settings.

If Brevo answers `525 Unauthorized IP address`, the IP is not on the Authorized IPs list.

## Stack

| Part | Choice |
|---|---|
| Backend | Laravel 13 (PHP 8.3+), JWT auth in HttpOnly cookies (firebase/php-jwt), Gates and Policies, database queue and scheduler |
| Frontend | React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, Vite 8, TypeScript |
| Map | Leaflet 1.9 with Esri World Imagery and OpenStreetMap |
| Database | MySQL 8 |
| Mail | Queued SMTP (Brevo free tier in production, Mailpit locally) |
| Quality | Pint, Larastan, Pest 4, ESLint, Prettier, Vitest, GitHub Actions |
