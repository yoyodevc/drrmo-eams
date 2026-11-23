# Deployment

One Linux server runs everything: Nginx, PHP-FPM 8.3, MySQL 8, one queue worker under supervisor, and cron for the scheduler. HTTPS is required because phones only allow GPS on secure pages.

Two targets are covered. Pick one and keep the other as plan B.

| | Oracle Cloud Always Free VM | School server |
|---|---|---|
| Cost | Free | Free (school hardware) |
| Reachable from mobile data | Yes, public IP | Only if the school gives it a public IP or a reverse proxy. A campus-only server will not work for marshals on mobile data. |
| Main risks | Idle reclaim, out of capacity at sign-up, home region is fixed forever | Power and network outages, who maintains it, firewall rules |
| Domain | Free DuckDNS subdomain, or a school subdomain pointed at the VM | School subdomain |

## 1. Oracle Cloud Always Free VM

Facts from Oracle's Always Free documentation (checked Nov 2026):

- Ampere A1 Always Free gives the equivalent of 2 OCPUs and 12 GB memory in total. One VM with 2 OCPUs and 12 GB is plenty.
- Always Free compute must be created in your **home region**, which you choose at sign-up and cannot change. Choose the region closest to Zamboanga that offers A1 capacity.
- "Out of host capacity" means no free A1 shapes right now. Try another availability domain or try again later.
- Idle Always Free instances may be reclaimed if, over 7 days, 95th percentile CPU, network and (for A1) memory use are all under 20%. A campus app with 60 users will look idle most weeks. The cleanest protection is upgrading the account to Pay As You Go. Oracle says Always Free resources stay free after the upgrade, but a payment card is required. Decide this before launch. Keep nightly backups off the VM either way.

Steps:

1. Create the VM: Ubuntu 24.04 (aarch64), shape VM.Standard.A1.Flex, 2 OCPU, 12 GB, add your SSH key.
2. In the VCN security list, allow inbound TCP 80 and 443.
3. Oracle Ubuntu images also block ports in the OS firewall. Open them:
   ```
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
4. Point the domain's A record at the VM's public IP (DuckDNS or the school DNS admin).
5. Continue with section 3.

## 2. School server

1. Ask IT for: Ubuntu 24.04 (or Debian 12 with PHP 8.3 from a trusted repository), a public IP or a reverse proxy, a subdomain such as `drrmo.<school domain>`, and ports 80 and 443 open from the internet.
2. Confirm who restarts the server after power loss and who applies security updates.
3. Continue with section 3.

## 3. Server setup (both targets)

```
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server supervisor git unzip \
  php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl \
  php8.3-zip php8.3-intl php8.3-bcmath php8.3-gd
# Word to PDF for memo previews. Then set LIBREOFFICE_BINARY=soffice in .env
# and run: php artisan memos:convert-previews
sudo apt install -y --no-install-recommends libreoffice-writer-nogui
# Composer: follow https://getcomposer.org/download/
# Node 22 LTS for building assets: use the NodeSource or nvm instructions
sudo timedatectl set-timezone Asia/Manila
```

Create a deploy user and folders:

```
sudo adduser --disabled-password deploy
sudo mkdir -p /var/www/drrmo/{releases,shared/storage}
sudo chown -R deploy:www-data /var/www/drrmo
```

MySQL:

```
sudo mysql_secure_installation
sudo mysql -e "CREATE DATABASE drrmo_eams CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'drrmo'@'localhost' IDENTIFIED BY '<strong password>';"
sudo mysql -e "GRANT ALL ON drrmo_eams.* TO 'drrmo'@'localhost';"
```

Shared `.env` at `/var/www/drrmo/shared/.env` (copy from `.env.example`, then change): `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://<domain>`, DB credentials, `JWT_SECURE_COOKIES=true`, `AUTH_ALLOWED_ORIGINS=https://<domain>`, a `JWT_SECRET` from `php artisan jwt:secret --show`, SMTP settings, `VITE_ARCGIS_API_KEY` if used. Run `php artisan key:generate --show` once and paste the key. For push alerts run `php artisan push:vapid` once and paste the two `VAPID_*` lines, and set `VAPID_SUBJECT=https://<domain>`. Keep the keys: new keys make every phone turn alerts on again. The queue worker reads the `high` queue first (urgent pushes). `chmod 640` the file.

Nginx, supervisor and cron: copy the files in `deploy/` to the paths written at the top of each file, then:

```
sudo ln -s /etc/nginx/sites-available/drrmo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo supervisorctl reread && sudo supervisorctl update
```

HTTPS with Let's Encrypt:

```
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <domain> --redirect
```

Certbot installs a renewal timer. Check it with `sudo certbot renew --dry-run`.

## 4. Deploy

As the deploy user, with `REPO_URL` set (a read-only deploy key on the GitHub repo is the simplest way):

```
REPO_URL=git@github.com:OWNER/drrmo-eams.git scripts/deploy.sh main
```

First deploy only: `php artisan db:seed --force` (roles, permissions, duty types, campus locations). Starting teams come with the migrations. The first admin account has no seeder yet, so create it by hand for now (for example with `php artisan tinker`). A proper first admin step is part of story S6.5.

## 5. Rollback

```
scripts/rollback.sh
```

This points `current` at the previous release. It does not undo migrations. Write migrations that are safe to leave in place (add columns, do not drop them in the same release that stops using them). If a migration must be reversed, restore the backup taken before the deploy.

## 6. Backup and restore

- `scripts/backup-db.sh` runs nightly at 03:00 from cron and keeps 14 days in `/var/backups/drrmo`.
- MySQL credentials for the script live in `~deploy/.my.cnf` with `chmod 600`.
- Copy backups off the server at least weekly (for example `rclone` to a university Google Drive folder, or `scp` to an office PC). An Oracle VM that gets reclaimed takes its disk with it.
- Back up `/var/www/drrmo/shared/storage/app/private` (memos and report photos) the same way.

Restore:

```
gunzip < /var/backups/drrmo/drrmo_eams-YYYYMMDD-HHMM.sql.gz | mysql drrmo_eams
```

Test a restore into a scratch database once a month: `mysql -e "CREATE DATABASE restore_test"` then restore into it and count rows in `users` and `events`.

## 7. Smoke test after every deploy

- [ ] `https://<domain>/up` returns 200
- [ ] Login works on a phone over mobile data
- [ ] Admin dashboard loads
- [ ] Create a test event, assign a test account, the email arrives
- [ ] On a phone: Acknowledge, Start duty, the location banner appears, a pin shows on the admin map within a minute
- [ ] `sudo supervisorctl status` shows `drrmo-queue RUNNING`
- [ ] `php artisan schedule:list` shows the jobs, and `storage/logs/laravel.log` has no new errors
- [ ] Delete the test event
