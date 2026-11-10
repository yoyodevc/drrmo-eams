# Security and Privacy

This system handles names, phone numbers, emergency contacts and location. Under the Data Privacy Act of 2012 (RA 10173) location history of identifiable people is personal information, so it gets the strictest rules in the app.

## 1. Permission matrix

Permissions are seeded codes. Roles have fixed sets. Extra access only comes from a time-limited grant. Almost every admin permission can be granted, so the office can lend a screen such as People or Events to one person for a while. `access.manage` and the permissions that only make sense for a role (`assignments.own`, `location.send_own`, `events.view_department`, `memos.view`, `messages.use`, `profile.own`) cannot be granted.

| Code | What it allows | Admin | Marshal | Volunteer | Coordinator | Grantable |
|---|---|---|---|---|---|---|
| `people.view` | List and view all people | ✓ | | | |  ✓ |
| `people.manage` | Create, edit, import people | ✓ | | | |  ✓ |
| `registrations.review` | Approve or reject sign up requests | ✓ | | | |  ✓ |
| `volunteers.toggle` | Set volunteer active or inactive | ✓ | | | |  ✓ |
| `access.manage` | Create and revoke grants | ✓ | | | | |
| `events.view_all` | See every event | ✓ | | | |  ✓ |
| `events.manage` | Create and edit events and requirements | ✓ | | | |  ✓ |
| `assignments.manage` | Assign, change, cancel | ✓ | | | |  ✓ |
| `events.view_department` | See event notices for own department or campus wide | ✓ | | | ✓ | |
| `assignments.own` | See and acknowledge own assignments, start and end own duty | | ✓ | ✓ (only while active) | | |
| `location.send_own` | Send own pings while on duty | | ✓ | ✓ | | |
| `location.view` | See the map and ping trails | ✓ | | | | ✓ (time limited) |
| `reports.submit` | Submit site reports for one event | ✓ | | | | ✓ (event scoped, required) |
| `reports.view` | Read the site report feed | ✓ | | | | ✓ |
| `memos.view` | Search and read memos | ✓ | ✓ | ✓ | ✓ | |
| `memos.manage` | Post, edit, delete memos | ✓ | | | |  ✓ |
| `messages.use` | Send and read own messages | ✓ | ✓ | ✓ | ✓ | |
| `messages.office_inbox` | Read and answer the DRRMO inbox | ✓ | | | |  ✓ |
| `notifications.view` | Read the notification log | ✓ | | | |  ✓ |
| `audit.view` | Read the audit log | ✓ | | | |  ✓ |
| `data.export` | Export lists (CSV) | ✓ | | | |  ✓ |
| `profile.own` | Read own profile, edit own contact number and emergency contacts, export own data | ✓ | ✓ | ✓ | ✓ | |

Notes:

- An inactive volunteer can log in, read memos and messages, and see past assignments. They cannot be assigned and cannot start duty or send pings.
- `reports.submit` grants must have an `event_id`. A grant without one is rejected.
- Grants for `location.view` must end within 7 days. This covers the "have the option" answer: the admin can give, for example, the ERT lead map access for one event day.
- A person who holds `people.manage` only through a grant cannot create or edit an admin, or import one. Only an admin can.
- Admin has every permission through the role. There is no "super admin bypass" in code. The admin role simply has all codes, so the audit and policy paths are the same for everyone.

Scoping rule: every list query is filtered to the user's own rows unless the user has the matching `*.view_all` style permission. Policies check both the permission and ownership.

## 2. Data Privacy Act checklist

| Principle or right | How the system handles it | Status |
|---|---|---|
| Transparency, privacy notice | Notice shown on first login and whenever its version changes. States purpose, data collected, who sees it, retention, contact. | Planned (M2) |
| Consent | Two records: privacy notice (needed to use the app), location tracking (needed to start duty). Stored with notice version, time and IP. | Planned (M2, M4) |
| Legitimate purpose | Location is used only to coordinate safety and response during an assigned shift. Not for attendance discipline or performance rating. Written in the notice. | Policy text, needs DRRMO sign-off |
| Proportionality, collect only what is needed | No birthdays, addresses, IDs or photos of people. Pings only while on duty. No tracking outside shifts. | Planned |
| Retention | Pings: 10 working days. Site report photos: 1 year (assumption). Audit log: 3 years (assumption). Notifications log: 6 months (assumption). Inactive accounts: reviewed yearly. | Needs owner confirmation for non-ping items |
| Access control | Roles, policies, grants, scoped queries, admin-only location | Planned (M2) |
| Audit trail | See section 4 | Planned (M0 stub, M6 viewer) |
| Right to access | `GET /api/me/data-export` gives a person their own data as JSON | Planned (M6) |
| Right to correct | People edit their own contact number and emergency contacts. Other corrections through the admin. | Planned (M2) |
| Right to object or withdraw | A person can withdraw location consent. They then cannot start duty, and the admin is told so they can reassign. | Planned (M4) |
| Security measures | HTTPS only, hashed passwords (bcrypt), private file storage, encrypted backups, least privilege on the server | Planned (M6) |
| Breach response | See section 7 | Procedure written, needs a named responsible person |
| Data Protection Officer | None today. NPC Advisory 2017-01 says each government agency "shall designate a DPO" and allows a Compliance Officer for Privacy for a sub-unit under the DPO. | **Open decision for the owner** |

## 3. Consent flow

1. First login: the app shows the privacy notice (version, for example `2026-11-v1`). The person taps "I have read and agree". A CONSENT_RECORD row with purpose `privacy_notice` is written. Until then every API call except notice, consent and logout returns 403 with code `consent_required`.
2. First Start duty: a second, short screen explains location sharing (when it runs, who sees it, how long it is kept). Agreeing writes purpose `location_tracking`. Then the browser asks for location permission.
3. If the notice version changes, step 1 repeats on the next login.
4. Withdrawal: Profile has a "Stop location consent" button. It sets `withdrawn_at`. Start duty is then blocked with a clear message.

## 3a. Sign up and approval

- Sign up is public but only creates a volunteer. The account has `account_status` pending_email, then pending_approval, and cannot sign in, refresh or call the API until an admin approves it. A rejected account stays locked out and keeps the reason.
- The 6 digit email code is stored as an HMAC, works for 10 minutes, locks after 5 wrong tries and is sent at most once a minute. Sign up answers the same for an existing email.
- Agreeing to the privacy notice is required at sign up and is written as a `privacy_notice` consent row.
- Login names the account state only after the password was verified as right: the person is told to confirm the email, that the account waits for approval, that the request was not approved, or that the account is disabled. A wrong password or an unknown email always gets the same "wrong email or password" answer, so the screen cannot be used to find out which emails have accounts. Every such try counts toward the login throttle.
- Review needs `registrations.review` (admin only). The person is told the result by email.

## 4. Audit rules

Write an AUDIT_LOG row for:

- Assignment created, changed, cancelled, status override, headcount override (with reason)
- Permission grant created or revoked
- Volunteer status change
- Person created, role changed, account disabled
- Any view of location data: map load, trail view (one row per request, not per pin)
- Any delete: memo, event, requirement, emergency contact
- Any export: CSV lists, personal data export
- Login, logout, login failures above the throttle limit, password resets
- A refresh token used twice (`auth.token_reuse_detected`), which revokes that sign in
- Consent given or withdrawn
- Sign up requested, email confirmed, request approved or rejected (with the reason): `registration.requested`, `registration.email_verified`, `registration.approved`, `registration.rejected`

Audit rows are insert only. The app has no update or delete route for them, and the scheduled prune keeps them for 3 years.

## 4a. Signing out

- One sign out path. The app asks `POST /api/logout`. The server revokes the whole refresh token family of that device, denylists the access token and clears both cookies with the exact attributes they were set with. It answers 204 even when nobody is signed in.
- Only 401 and 419 count as "already signed out". Any other failure keeps the person signed in and shows "Could not sign out. Try again."
- On success the app throws away every cached answer, not only the user record, and blocks the quiet refresh, so nothing signs the person back in and nothing of the old user can show for the next one.
- A refresh that fails during normal use (the session was revoked, expired or ended in another tab) does the same: all state is cleared and the person lands on the login page.
- Other open tabs hear about a sign out through a browser broadcast and go to the login page at once.
- Every `/api` answer is sent with `Cache-Control: no-store, private`. A page restored by the Back button checks who is signed in again before it shows anything.
- There is no idle timeout and no "sign out on every device" yet.

## 4b. Cookies and the cookie notice

The system sets only essential cookies. There is no tracking, advertising or analytics cookie, so there is nothing optional to accept or reject. A public page at `/cookies` lists them, and a first visit message points to it.

| Cookie | Purpose | Kept for |
|---|---|---|
| `drrmo_access` | Access token (JWT). HttpOnly | 15 minutes |
| `drrmo_refresh` | Refresh token. HttpOnly, replaced on every use | 7 days |
| `drrmo-eams-session` | Technical session cookie from the web framework, set when a page opens. It does not sign anyone in. HttpOnly | 8 hours |
| `XSRF-TOKEN` | Technical protection token from the web framework | 8 hours |

- That Got it was pressed is kept in the browser's local storage under `drrmo:cookie-notice:v1`, not in a cookie. Raise the version when the notice changes in a way people should see again.
- `tests/Feature/Core/CookieNoticeTest.php` checks that the notice names exactly the cookies the server sets and states the real lifetimes. If a cookie is added or a lifetime changes, the test fails until the notice is updated.

## 5. HTTPS, cookies and headers

- HTTPS everywhere with Let's Encrypt. HTTP redirects to HTTPS. HSTS once the domain is stable.
- Auth is JWT in two HttpOnly, SameSite=Lax cookies. Page scripts never see a token (see ARCHITECTURE.md section 3).
- `.env` in production: a long random `JWT_SECRET` (`php artisan jwt:secret`, never shared or committed), `JWT_SECURE_COOKIES=true`, `AUTH_ALLOWED_ORIGINS` set to the real https origin only, `APP_DEBUG=false`.
- Changing `JWT_SECRET` signs everyone out. Do it if the secret may have leaked.
- Access tokens last 15 minutes. Refresh tokens last 7 days, are stored only as hashes, rotate on every use, and a reused one revokes its whole sign in.
- Headers from Nginx: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, a Content Security Policy that allows only our origin plus the two tile hosts for images.
- `Permissions-Policy: geolocation=(self), camera=(self)`.

## 6. Rate limits and upload rules

| Endpoint | Limit |
|---|---|
| `POST /api/login` | 5 per minute per email and IP |
| `POST /api/forgot-password` | 3 per 10 minutes per IP, and one email per account per minute |
| `POST /api/reset-password` | 10 per 10 minutes per IP |
| `POST /api/refresh` | 30 per minute per IP |
| `POST /api/register` | 5 per hour per IP |
| `POST /api/register/verify` | 10 per 10 minutes per IP, and 5 wrong tries per code |
| `POST /api/register/resend` | 3 per 10 minutes per IP, and one code per account per minute |
| `POST /api/me/assignments/{id}/pings` | 10 requests per minute per user, max 50 points per request |
| `POST /api/me/report-slots/{id}` | 6 per minute per user |
| Other API | 120 per minute per user |

Uploads:

| Upload | Allowed types | Max size | Storage |
|---|---|---|---|
| Memo file | PDF, DOCX, JPG, PNG | 10 MB | `storage/app/private/memos`, served only through `GET /api/memos/{id}/file` after a policy check |
| Site report photo | JPG, PNG, HEIC converted to JPG | 8 MB before upload. The phone resizes to 1600 px on the long side before sending. | `storage/app/private/reports`, served through the API |

Files get random names. Original names are kept only in the database. MIME type is checked from the file content, not the extension. Nothing user-uploaded is ever placed in `public/`.

## 7. Breach response (short version)

1. Contain: log everyone out by running `php artisan jwt:secret --force` (new signing secret) and setting `revoked_at` on every row of `refresh_tokens`, rotate `APP_KEY` only if needed, change server and SMTP passwords.
2. Assess: use the audit log and server logs to find what data and whose.
3. Notify: the university DPO, and the National Privacy Commission and affected people within 72 hours when the NPC rules require it (NPC Circular 16-03, confirm current rules with the DPO).
4. Record: write what happened, what was done, and what changes to make.
5. The responsible person for each step must be named before launch.
