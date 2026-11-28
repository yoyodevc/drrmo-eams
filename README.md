# DRRMO EAMS

Personnel Event Assignment and Monitoring System for the ZPPSU Disaster Risk Reduction and Management Office.

The DRRMO plans events, assigns Marshals and Volunteers, emails them, collects 2-hourly site reports, and sees approximate positions of on-duty people on a campus map. Built with Laravel 13, React 19, MySQL 8.

> Status: M0 to M7 are built. 49 of the 53 stories in [docs/BACKLOG.md](docs/BACKLOG.md) are done. That covers people and access control, events and assignments, emails and reminders, start and end duty, the live map, site reports, emergency reports, memos, messages, the audit log, data export and pruning, the PWA install, and push and sound alerts. Still open: the phone check for push alerts (S7.6), production deployment (S6.5) and the field test (S6.6). The story table in the backlog is kept up to date. Start with [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Documents

| Document | What it covers |
|---|---|
| [PROJECT_PLAN.md](docs/PROJECT_PLAN.md) | Goals, scope, assumptions, risks, roadmap |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Diagrams, auth, jobs, GPS and report flows, map licence |
| [USER_FLOWS.md](docs/USER_FLOWS.md) | The ten day-in-the-life flows |
| [SCREENS.md](docs/SCREENS.md) | Every screen, desktop and mobile |
| [MODULES.md](docs/MODULES.md) | Module boundaries, endpoints, ownership |
| [DATABASE.md](docs/DATABASE.md) | The 27 tables and their ERD, migrations, indexes, seeders |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Colors, type, components and layouts. Read before any UI work |
| [SECURITY_AND_PRIVACY.md](docs/SECURITY_AND_PRIVACY.md) | Permission matrix, Data Privacy Act checklist |
| [BACKLOG.md](docs/BACKLOG.md) | Epics and stories by milestone |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Server setup, deploy, backup, rollback |
| [DOCUMENTATION_GUIDE.md](docs/DOCUMENTATION_GUIDE.md) | Code docs and the capstone paper (chapters, dev log, figures) |
| [WORKFLOWS.md](docs/WORKFLOWS.md) | Checklists: new module, table, endpoint, permission, job, screen |
| [WORKING_WITH_CLAUDE_CODE.md](docs/WORKING_WITH_CLAUDE_CODE.md) | One session per module |
| [PLANNING_SUMMARY.md](docs/PLANNING_SUMMARY.md) | One-page summary and current status |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, commits, Definition of Done |
| [capstone/](docs/capstone/README.md) | The capstone paper: chapters, dev log, appendices (API reference, data dictionary), figures |

## Local setup on Windows (default: Laravel Sail)

Why Sail and not XAMPP: Laravel 13 needs PHP 8.3 or newer, and the latest XAMPP release still ships PHP 8.2. Sail runs the exact PHP and MySQL versions we use on the server, inside Docker.

One-time install:

1. Install WSL2. Open PowerShell as administrator and run `wsl --install`. Restart when asked. This installs Ubuntu.
2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). In Settings, Resources, WSL integration, turn on Ubuntu.
3. Open the Ubuntu app and install Git: `sudo apt update && sudo apt install -y git`.

Get the project and run it:

```
cd ~
git clone https://github.com/yoyodevc/drrmo-eams.git
cd drrmo-eams
bash scripts/setup.sh
```

Keep the project inside the Ubuntu home folder (`~/`), not under `/mnt/c/`. It is much faster.

Open http://localhost for the app and http://localhost:8025 for Mailpit, which catches every email the app sends locally.

Sail does not start a queue worker or the scheduler for you. Without them, emails, push alerts, shift and report reminders, overdue and emergency checks never run. Run each in its own terminal:

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

Testing on your phone needs HTTPS for GPS and for push alerts. Use the staging server, or a tunnel such as `./vendor/bin/sail share`.

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
4. In a third terminal run `php artisan queue:work --queue=high,default`. Without `high`, emergency pushes are never sent. Emails and push alerts wait in the queue until it runs.
5. In a fourth terminal run `php artisan schedule:work`. It sends the reminders, makes the report slots, flags overdue and missed reports and unanswered emergencies, and closes finished duties.
6. Open http://127.0.0.1:8000. With `MAIL_MAILER=log`, emails are written to `storage/logs/laravel.log`. Keep `MAIL_MAILER=log` for local testing so no real email is sent. The `run-local` and `run-tunnel` scripts (see docs/WINDOWS_SCRIPTS.md) start the server, the worker on `high,default`, the scheduler, and pass the temp folder to PHP so uploads work.

To stop, press Ctrl+C in all terminals and stop MySQL in XAMPP.

Run checks with `composer check` and `npm run check`. Note: XAMPP ships MariaDB 10.4, not MySQL 8. The server and CI use MySQL 8, so CI still catches database differences.

## Email

The app sends these emails:

- **Queued** (needs `php artisan queue:work`): a new, moved or cancelled assignment, a cancelled event, the shift reminders (6:00 PM the evening before and 1 hour before), report reminders and overdue or missed report alerts, and emergency alerts. Each assignment email has a button that opens the app on the right duty, with the link `/?assignment=<code>`, where the code is the duty's random public code. A person who is signed out signs in first and then lands on that duty.
- **Sent at once:** the sign up confirmation code, access approved or rejected, and the password reset link.

A failed queued email is retried 3 times and then shows as `failed` in the notification log. Reminders need `php artisan schedule:work` locally. On the server, cron runs the scheduler. Notification log rows are deleted after 6 months.

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

## Push alerts and sound

Urgent things (an emergency report, an unanswered emergency, a missed site report) reach a phone that is not open through Web Push. Setup:

1. Run `php artisan push:vapid --write` once. It adds `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to `.env`. Set `VAPID_SUBJECT` to your site address. Keep the keys: new keys make every phone turn alerts on again.
2. Open the app over HTTPS. Push does not work on plain `http` except on `localhost`.
3. Each person turns alerts on from the Alerts settings page, after a tap. On an iPhone the app must first be added to the Home Screen (iOS 16.4 or newer). There is also a test button, mute for sound and push, and quiet hours. Urgent emergencies ignore quiet hours.
4. Run the queue worker. Urgent pushes go on the `high` queue, so start it with `php artisan queue:work --queue=high,default`.

A push cannot play a custom sound. The alarm and chime play inside the app while it is open, after the person has tapped once to allow audio.

## Memo previews

Word memos get a PDF copy for the preview pane. It needs LibreOffice on the machine. Set `LIBREOFFICE_BINARY` in `.env` to its path. Without it, the memo page falls back to a quick browser preview. After installing LibreOffice, run `php artisan memos:convert-previews` to make copies for the memos that have none.

## Stack

| Part | Choice |
|---|---|
| Backend | Laravel 13 (PHP 8.3+), JWT auth in HttpOnly cookies (firebase/php-jwt), Gates and Policies, database queue and scheduler, Web Push (minishlink/web-push) |
| Frontend | React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, Vite 8, TypeScript |
| Map | Leaflet 1.9 with Esri World Imagery and OpenStreetMap |
| Database | MySQL 8 (8.4 in Sail) |
| Mail | Queued SMTP through PHPMailer (Brevo free tier in production, Mailpit locally) |
| Memos | LibreOffice for PDF copies of Word files, pdf.js and docx-preview in the viewer |
| App | Installable PWA with a service worker for the app shell and push |
| Quality | Pint, Larastan, Pest 4, ESLint, Prettier, Vitest, GitHub Actions |
