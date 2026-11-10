# Development Log

One entry per merged story. Format in ../DOCUMENTATION_GUIDE.md section 4.

## 2026-11-05 · Planning and scaffold (core)
- What was built: planning documents, Laravel 13 and React 19 scaffold, CI, workflow docs
- Decision and why: one Laravel app serving one React SPA with two layouts, because the user base is about 60 people and a single server is enough
- Decision and why: Laravel Sail for local development, because XAMPP still ships PHP 8.2 and Laravel 13 needs 8.3
- Evidence: docs/PROJECT_PLAN.md, docs/ARCHITECTURE.md, first CI run on main
- Paper: Chapter 3 (development model, tools and technologies)

## 2026-11-05 · S1.1 Log in and log out, API side (core)
- What was built: `POST /api/login`, `POST /api/logout` and `GET /api/me` with Sanctum cookie sessions
- Decision and why: a disabled account gets the same answer as a wrong password, so the login form does not reveal which emails exist
- Decision and why: the 5 attempts per minute limit counts failures per email and IP, and clears after a good login. The over-limit event is written to the audit log because the security rules list it
- Problem met and fix: a logout test still saw the user because the test app reuses one guard object. The test now resets guards between requests, which a real server does on its own
- Evidence: tests/Feature/Core/AuthTest.php
- Paper: Chapter 3 (authentication), Chapter 4 (security test results)
## 2026-11-05 · S0.3 Roles and permissions seeded (access)
- What was built: roles, permissions and role_permission tables, a PermissionMatrix class, idempotent seeders, and a test that compares the seeded data with the table in SECURITY_AND_PRIVACY.md
- Decision and why: the matrix lives in one PHP class and the docs table is checked against it by a test, so the code and the written rules cannot drift apart
- Decision and why: Admin and Director share one admin role for now, as the owner asked. Splitting them later means one enum case and one matrix column
- Problem met and fix: the first version of the docs parser lost empty table cells and shifted columns. Fixed by splitting each row on the pipes and dropping only the outer two
- Evidence: tests/Feature/Access/PermissionMatrixTest.php, PR #50
- Paper: Chapter 3 (access control design), Chapter 4 (permission matrix table)

## 2026-11-05 · Personnel tables (personnel)
- What was built: users (replacing the Laravel default), departments, emergency contacts and volunteer status log tables, models and a fake-data factory
- Decision and why: on-call availability (`status`) is kept apart from account disabling (`disabled_at`), because an inactive volunteer can still log in and read memos
- Decision and why: the User model moved into the Personnel module so the module owns its data
- Evidence: tests/Feature/Personnel/UserModelTest.php, PR #51
- Paper: Chapter 3 (ERD), appendix data dictionary

## 2026-11-05 · S0.4 Audit and consent contracts (records)
- What was built: audit_logs and consent_records tables, AuditLogger and ConsentChecker interfaces with database implementations
- Decision and why: audit rows are insert only and the model throws on update or delete, because the Data Privacy Act asks for a trustworthy record of who viewed location data
- Decision and why: consent is a history of rows, and the latest row decides, so withdrawal does not erase the earlier consent
- Evidence: tests/Feature/Records, PR #52
- Paper: Chapter 3 (data privacy handling), Chapter 4 (security results)

## 2026-11-05 · S1.1 Log in and log out, screen side (core)
- What was built: phone-friendly login page, a `useMe` hook, route guards that keep signed-out visitors on /login and send admins to /admin and everyone else to /me
- Decision and why: the area guard compares the `home` value from /api/me instead of repeating role rules in React, so the server stays the single place that decides who goes where
- Decision and why: tests use plain Testing Library events because adding a user-event package is a separate Core change
- Evidence: resources/js/pages/Login.test.tsx
- Paper: Chapter 4 (login screen, add screenshot at 375 px width)

## 2026-11-05 · Demo users for local testing (personnel)
- What was built: DemoSeeder with four fake people (admin, marshal, volunteer, coordinator), all with the password "password"
- Decision and why: the seeder refuses to run in production, so test accounts with a known password can never reach a real server
- Evidence: tests/Feature/Personnel/DemoSeederTest.php

## 2026-11-05 · Fixes found during the owner's local check of S1.1 (core)
- What was built: a Sign out button in both layouts, a setup script that handles a root Ubuntu user and fails loudly, and a refreshed composer.lock hash
- Problem met and fix: on the owner's Windows PC Ubuntu defaults to root, so the Sail container could not write project files and setup.sh stopped without a clear message. The script now gives the group write access when it runs as root and prints a clear message if any step fails
- Problem met and fix: composer validate said the lock file was out of date. Only the content hash had drifted, so it was refreshed with no package changes
- Evidence: Login.test.tsx (sign out test), composer validate output
- Paper: Chapter 4 (testing on a real machine), Chapter 5 (limitations: setup differs per PC)

## 2026-11-06 · Sign out after an ended session, and a setup without Docker (core)
- What was built: Sign out now works when the session has already ended, and the README has a way to run the project without Docker
- Problem met and fix: when the session had expired, /api/logout returned 401 and the Sign out button did nothing. Now 401 and 419 count as already signed out, so the user goes to /login
- Decision and why: any other failure, such as a server error, shows "Could not sign out. Try again." and keeps the user signed in. Otherwise the screen would say signed out while the real session stays open on a shared phone
- Problem met and fix: Docker used about 2.8 GB of memory on the owner's 16 GB PC. Herd (PHP 8.5) and the MariaDB from XAMPP use about 0.5 GB for the same work
- Decision and why: MariaDB 10.4 is not MySQL 8, so the Docker setup and CI stay on MySQL 8 and still catch database differences. All migrations, seeders and 34 Pest tests passed on MariaDB 10.4 and PHP 8.5
- Evidence: Login.test.tsx (401 and 500 sign out tests), README section "Run without Docker"
- Paper: Chapter 4 (testing on a real machine), Chapter 5 (limitations: local database differs from the server)

## 2026-11-06 · Design system and the landing and login screen (core)
- What was built: DESIGN_SYSTEM.md with a ready to paste UI prompt, color and shape tokens in app.css, shared Button, TextField, PasswordField, Alert, Spinner and BrandLogos components, the ZPPSU and DRRMO logos as web assets and favicon, and a redesigned login screen
- Decision and why: maroon and gold come from the ZPPSU seal and are the base, while the DRRMO orange is kept for live or urgent states only, so the app feels official and urgent things still stand out
- Decision and why: the owner compared a fully flat version with the first draft and kept the first. The final version keeps its layout but drops the dot pattern, strong glows and the badge, so it looks finished without looking busy
- Decision and why: Public Sans is self hosted instead of loaded from Google Fonts, so the screen works on a weak campus connection and no visitor data goes to a third party
- Decision and why: there is no self service password reset yet, so the login screen tells people to ask the DRRMO office instead of showing a link that does nothing
- Evidence: resources/js/shared/ui/ui.test.tsx, Login.test.tsx, figures/m-login.png, figures/m-login-desktop.png
- Paper: Chapter 3 (user interface design), Chapter 4 (login screen)

## 2026-11-06 · Forgot and reset password (core)
- What was built: POST /api/forgot-password and POST /api/reset-password on Laravel's password broker, a Forgot password screen, a Reset password screen opened from the emailed link, and a shared AuthLayout so every signed-out screen uses the same brand frame
- Decision and why: forgot password gives the same answer whether or not the email has an account, so nobody can use it to find out who has an account
- Decision and why: a disabled account never gets a link and cannot use an old one, the same as at login
- Decision and why: links last 60 minutes and work once. After a reset every session of the account is deleted, so a lost phone that was still signed in is signed out
- Decision and why: new passwords need at least 12 characters. Length helps more than symbol rules, and a short sentence is easy to remember on a phone
- Decision and why: both requests are rate limited per IP (3 and 10 per 10 minutes) and write audit rows (auth.password_reset_requested, auth.password_reset_completed)
- Evidence: tests/Feature/Core/PasswordResetTest.php, resources/js/pages/PasswordReset.test.tsx
- Paper: Chapter 3 (account security), Chapter 4 (forgot and reset password screens)

## 2026-11-06 · Request access sign up with email code and admin approval (personnel, notifications)
- What was built: a public Request access flow for volunteers (`/register`, `/register/verify`, a waiting screen), a 6 digit email code, and an admin screen to approve or reject. Login, refresh and the access token refuse any account that is not active
- Decision and why: the owner chose public sign up for volunteers only, with admin approval. A new account is pending and can do nothing until an admin approves it, so a stranger cannot get in just by registering
- Decision and why: the email code is stored only as an HMAC, expires in 10 minutes, locks after 5 wrong tries and can be re-sent once a minute. This stops guessing a 6 digit number
- Decision and why: sign up gives the same answer when the email is already used, so nobody can probe which emails have accounts
- Decision and why: emails go through a `MailSender` contract in the Notifications module with a PHPMailer implementation. With `MAIL_MAILER=log` or no `MAIL_HOST` the message, with the code, is written to `storage/logs/laravel.log` so it works on a laptop with no mail server
- Decision and why: the new states live in a new `account_status` column, apart from the on-call `status`, because "can this person sign in" and "is this volunteer on call" are different questions
- Evidence: tests/Feature/Personnel/RegistrationTest.php (success, wrong, expired and locked codes, duplicate email, throttle, forbidden for non-admins, audit of approve and reject, pending cannot sign in), resources/js/pages/RequestAccess.test.tsx
- Paper: Chapter 3 (registration and approval design), Chapter 4 (security tests)

## 2026-11-06 · Cookie notice page and first visit message (core)
- What was built: a public page at /cookies, a first visit message with a Got it button and a link to it, and a Cookie notice link in the footer of every signed out screen
- Decision and why: there is no accept or reject choice, because there are no optional cookies. Only essential cookies are set, so a fake choice would be misleading. The notice says so in plain words
- Finding: the system sets four cookies, not two. Besides the two sign in cookies, the web framework adds a session cookie and an XSRF-TOKEN on every page load. The notice lists all four. The session cookie is not used to sign anyone in, so it could be removed in a later story
- Decision and why: the message is remembered in local storage with a versioned key, not in a cookie, so the message about cookies does not set a cookie itself
- Decision and why: a test compares the notice with the real server settings (cookie names and lifetimes), so the notice cannot drift away from what the system does
- Evidence: resources/js/pages/CookieNotice.test.tsx (shows on first visit, hides after Got it and after a reload, not on /cookies, link works, blocked storage, no focus trap, lists every cookie), tests/Feature/Core/CookieNoticeTest.php (names and lifetimes match the config, the cookies set on a page load and on sign in)
- Paper: Chapter 3 (data privacy and cookies), Chapter 4 (privacy screens)

## 2026-11-06 · Clear sign in messages for accounts that are not usable yet (core)
- What was built: when the password is right but the account cannot be used, sign in now says why: confirm the email (with a link to the code screen), waiting for admin approval, not approved, or disabled. Before, all of these said "email or password is wrong", which sent people in circles
- Decision and why: the reason is shown only after the password has been verified. Someone who does not know the password still gets the same generic answer for a wrong password and an unknown email, so the screen cannot be used to find out who has an account
- Decision and why: the answer is a 403 with its own code per state, and no cookies are set. A 403 counts toward the login throttle like a wrong password, so guessing is still limited. The failed login audit is unchanged
- Evidence: tests/Feature/Core/AuthTest.php and tests/Feature/Personnel/RegistrationTest.php (each state with the right password, generic answer for a wrong password or an unknown email, no cookies, throttle, approval lets the person in), resources/js/pages/Login.test.tsx
- Paper: Chapter 4 (sign in behavior and account enumeration)
## 2026-11-06 · Fix the app crashing on load in development (core)
- What was built: `main.tsx` is now a plain entry file. The session watcher component moved to `SessionWatcher.tsx`, and the entry reuses one React root if it is evaluated twice
- Why it crashed: the screen said "Unexpected Application Error: Failed to execute removeChild". The console showed `createRoot()` called twice on the same container. `main.tsx` defined a component, which made Vite's hot reload run the whole entry a second time, so two React trees fought over the same page. It only happens on the Vite dev server, not in the production build
- Decision and why: keep entry files free of components and make the mount safe to repeat, so a hot reload can never mount the app twice
- Evidence: a browser check on /admin and /admin/requests, with the entry loading once and no crash while changing filters and opening and cancelling the sign out dialog
- Paper: not needed (development tooling)
## 2026-11-06 · One mail path and clear feedback on the sign up screens (core, personnel)
- What was built: the password reset email now goes through the same `MailSender` (PHPMailer) as the sign up code. Send a new code on the confirm screen now shows a spinner, a success note, a 60 second countdown and clear errors
- Why the reset email did not arrive: the screen said "we sent a link" on purpose for every address, but the address was a pending sign up and the system never sends a reset link to pending, rejected or disabled accounts. The audit row showed `sent: false`. To test, approve the account first. The reset email also used Laravel's own mailer, a second path with its own settings, so it was moved onto the shared one
- Decision and why: one mail path means one place to configure and to read errors. A failure is logged as `Password reset email failed` and the public answer stays the same, so the screen still cannot be used to find out which emails have accounts
- Decision and why: the resend button waits 60 seconds on the screen too, because the server ignores a second request inside that minute. Without the wait the screen would say "sent" when nothing was sent
- Evidence: tests/Feature/Core/PasswordResetTest.php (active account gets mail, unknown, pending, rejected and disabled get none with the same answer, mail failure keeps the answer and logs, the link works), resources/js/pages/VerifyEmail.test.tsx (spinner, success, countdown with fake timers, 429, error, clearing messages)
- Paper: Chapter 4 (account recovery behavior)

## 2026-11-06 · Proper sign out (core)
- What was built: one sign out path that clears all client state, stops quiet re-login, signs out other tabs, and keeps protected answers out of browser memory. The server cleans up the cookies exactly and audits the sign out with the right actor
- Decision and why: sign out clears every cached answer, not only the user record. Before, the next person on a shared phone could briefly see data of the one before. `queryClient.clear()` would also detach the live user query the route guards listen to, so the same wipe is done by removing every query except that one
- Decision and why: after sign out the token refresh is blocked until the next login. Without it, a request still in flight could get a 401, refresh and quietly sign the person back in
- Decision and why: a refresh that fails during normal use now ends the session cleanly (clear state, go to login) instead of leaving a broken page. Sign out in one tab goes to the other tabs through a BroadcastChannel
- Decision and why: `Cache-Control: no-store, private` on every `/api` answer, and a recheck when a page comes back from the back/forward cache, so Back never shows a protected page after sign out
- Decision and why: the audit row `auth.logout` now has the user as actor (it had none because the route has no auth middleware) and is written once. A second sign out with the same old cookies is a harmless 204 and is not audited again
- Decision kept: only 401 and 419 count as already signed out. Other failures keep the person signed in with a message. No idle timeout and no sign out on all devices yet
- Evidence: tests/Feature/Core/SignOutTest.php (cookie attributes, idempotent, audit actor, refresh-only sign out, rotated tokens, other devices, no-store), resources/js/app/signOut.test.tsx and resources/js/shared/api/client.test.ts (cache clearing, double click, other tabs, no refresh after sign out, failed refresh, page restore)
- Paper: Chapter 3 (session handling), Chapter 4 (security tests)

## 2026-11-06 · First name and last name instead of one name (personnel)
- What was built: `users.name` is replaced by `first_name` and `last_name` (migration `200006`). Request access asks for both. The API returns both plus a combined `name` for display, so emails, the audit text and the admin list still show "First Last"
- Decision and why: the owner asked for two fields, in the form and in the database, so records can be sorted and searched by last name and imports can match them
- Decision and why: existing users were split at the last space. "Maria Dela Cruz" became "Maria Dela" and "Cruz". A one word name goes to first_name and last_name gets a dash, which the display name leaves out. The migration can be rolled back and joins the two names again
- Decision and why: both names are required, trimmed and limited to 100 characters
- Evidence: tests/Feature/Personnel/UserNameTest.php (display name, the split and its rollback), tests/Feature/Personnel/RegistrationTest.php (validation, review list, /api/me), resources/js/pages/RequestAccess.test.tsx
- Paper: Chapter 3 (data design), Chapter 4 (registration screen)

## 2026-11-06 · JWT auth in HttpOnly cookies (core, access)
- What was built: a JWT guard (`auth:api`) with a 15 minute access token and a 7 day rotating refresh token, POST /api/refresh, logout that revokes, a `refresh_tokens` table, a CSRF origin check, a `jwt:secret` command, and a client that refreshes once on a 401 and retries
- Decision and why: the owner asked for JWT instead of the planned Sanctum sessions. The tokens are kept in HttpOnly, SameSite=Lax cookies, never in localStorage, so a script injected into a page cannot steal them
- Decision and why: the access token is short (15 minutes) because a JWT cannot be called back once issued. Logout and password reset still cut it off through a denylist in the cache
- Decision and why: refresh tokens are stored only as hashes and rotate on every use. Using an old one again means it was copied, so the whole sign in is revoked and audited. A 30 second grace lets two open tabs refresh at the same moment
- Decision and why: cookie auth needs CSRF protection, so every state changing call must carry `X-Requested-With` and come from an allowed origin
- Decision and why: Sanctum was removed because nothing else used it. Policies, gates and the permission matrix did not change
- Evidence: tests/Feature/Core/JwtAuthTest.php (cookies, refresh, reuse, logout, forged and alg none tokens, disabled accounts, origin check), resources/js/shared/api/client.test.ts
- Paper: Chapter 3 (authentication design and its trade offs), Chapter 4 (security tests)

## 2026-11-06 · Sign out confirmation (core)
- What was built: a shared `ConfirmDialog` (native dialog, centered on desktop, bottom sheet on phones) and the "Sign out?" step in `SignOutButton`
- Decision and why: only the dialog's own Sign out button calls logout, so a stray tap on the header link can no longer end a session. Cancel gets focus first because it is the safe choice
- Decision and why: the confirm button stays maroon, not red, because signing out does not destroy anything
- Problem met and fix: jsdom has no `showModal`, so the test setup adds a small stand-in that only toggles the open state
- Evidence: resources/js/app/signOut.test.tsx, resources/js/pages/Login.test.tsx
- Paper: Chapter 3 (user interface design), Chapter 4 (usability)

## 2026-11-07 · Admin sidebar design pass (core)
- What was built: the admin sidebar now follows DESIGN_SYSTEM.md section 7. It is maroon-900 with the ZPPSU and DRRMO logos at the top, line icons, and links grouped under Operations, Personnel, Communication and System. The active link is white with a gold-400 bar on its left edge. The bottom shows who is signed in and a Sign out button. The content area moved to a stone-50 background
- Decision and why: from 768 to 1023 px the sidebar shrinks to an icon rail with a small label on hover or focus, and below 768 px it becomes a maroon top bar with a menu, as SCREENS.md asks
- Decision and why: Events stays lit on an event's detail and edit pages, because only Dashboard matches its path exactly. Before, every link needed an exact match
- Decision and why: `SignOutButton` takes optional children so the sidebar can show an icon with the label. Its behavior did not change
- Evidence: resources/js/layouts/AdminLayout.test.tsx
- Paper: Chapter 3 (user interface design)

## 2026-11-08 · S4.1 Start and end duty (monitoring)
- What was built: `POST /api/me/assignments/{assignment}/start-duty` and `end-duty`, the `AssignmentLookup` contract in Events, the `monitoring:auto-end-duty` command (every five minutes), and Start duty and End duty buttons on the mobile duty card
- Decision and why: start opens 15 minutes before the shift and closes at shift end. It needs an active availability status and location consent, so a person who has not agreed to tracking is never put on duty
- Decision and why: Monitoring changes the assignment only through `AssignmentLookup`, as MODULES.md requires. The auto end uses the same contract and is audited with source `system`
- Problem met and fix: `duty_started_at` and `duty_ended_at` were planned in DATABASE.md (G1) but missing, so migration 300008 adds them
- Evidence: tests/Feature/Monitoring/DutyTest.php
- Paper: Chapter 3 (system design), Chapter 4 (privacy by design)

## 2026-11-08 · S3.7 Admin dashboard, on duty pass (events)
- What was built: the dashboard now shows who is on duty. A fourth count, "On duty now", sits with Events today, Late to start and Not acknowledged. A new "On duty now" panel under Today's events lists each person, their event and duty, and when they started. Each event row shows "3 of 5 on duty" with a thin ember bar while it runs, and "4 of 5 assigned" with a maroon bar before it starts
- What was built: the Late to start list says how late each person is ("35 min late") and has a Mark no show action with the same confirm dialog as the event page
- Decision and why: the late list is now accurate, because start duty exists. People on duty or done drop off it, and only those whose duty never started stay
- Decision and why: `GET /api/dashboard` adds `on_duty`, `on_duty_count`, `places_needed`, and the duty name and status on each person row. No location data is sent, so the dashboard needs no `location.view` grant
- Evidence: tests/Feature/Events/AssignmentRulesTest.php
- Paper: Chapter 3 (user interface design)

## 2026-11-08 · S3.7 Admin dashboard, cleaner and phone ready (events)
- What was built: the four counts became separate cards with a small line icon, two per row on phones and four on desktop. A refresh button sits next to "Updated" time. Today's events has an "All events" link
- What was built: a Statistics section with four placeholder cards: Attendance, Duty hours, Time to acknowledge and Events by type. They show the layout in gray with "--" values and a "Coming soon" chip, so no one reads made-up numbers as real
- Decision and why: on phones the Late to start and Not acknowledged lists come first, because those need action. On desktop they sit in the right column. The page order puts them first, so screen readers also reach them first
- Decision and why: the lists use container queries. In a narrow list the time and actions drop under the name, so names are no longer cut to one letter in the right column. Mark no show is a 40 px outlined button on phones
- Problem met and fix: the page scrolled sideways on phones because the grid had no column size. `grid-cols-1` and `min-w-0` fixed it
- Paper: Chapter 3 (user interface design)

## 2026-11-09 · S3.4 Email on assignment created, changed, cancelled (notifications)
- What was built: the `notifications` table (migration 500001), the `Notification` model, the `AssignmentNotifier` contract and a queued `SendNotificationEmail` job. `AssignmentController` calls the contract after create, move and cancel. Each call queues one notification row and one email with a link that opens the app on the person's duties
- Decision and why: the job retries 3 times (30 s, then 2 min apart). When it gives up, the row is marked `failed` with the last error, so the S3.6 log can show it and offer Retry
- Decision and why: Events reaches Notifications only through the `AssignmentNotifier` contract, as MODULES.md requires. Notifications owns the table and the email text
- Problem met and fix: the `users` table has no recipient link in the old `notifications` plan, so the table follows DATABASE.md G7 (`user_id`, `attempts`, `last_error`, nullable `assignment_id`)
- Evidence: tests/Feature/Notifications/AssignmentEmailTest.php
- Paper: Chapter 3 (system design), Chapter 4 (reliability of email delivery)

## 2026-11-09 · Branded HTML emails (notifications)
- What was built: one shared email layout for all seven emails the system sends (confirmation code, access approved, access rejected, password reset, duty assigned, duty changed, duty cancelled). Each email now goes out as HTML with a plain text part
- Decision and why: content is built with a small `EmailMessage` class (heading, lines, code, button, details, notice) and rendered by one Blade view, so every email looks the same and other modules never write HTML
- Decision and why: tables and inline styles, because mail apps ignore most modern CSS. Logos are embedded in the message (cid), so they show even when remote images are blocked
- Decision and why: `MailSender::send` takes an optional `$html`, so the old plain text calls still work
- Problem met and fix: shift times were printed in UTC. They are now shown in Asia/Manila, as PROJECT_PLAN A8 says
- Evidence: tests/Feature/Notifications/EmailMessageTest.php, AssignmentEmailTest.php, RegistrationTest.php
- Paper: Chapter 3 (system design, interface design)

## 2026-11-09 · S3.5 Shift reminders (notifications)
- What was built: the `notifications:send-reminders` command, scheduled every five minutes. It queues an email at 6:00 PM Manila time the evening before a shift and another 1 hour before it starts
- Decision and why: each assignment gets each reminder once, because the command looks for an existing notification row of that type first. Cancelled, no show and ended assignments, cancelled events and disabled people never get one
- Decision and why: if the 1 hour reminder is already due, the evening one is skipped, so a person assigned late is not sent two emails at once
- Evidence: tests/Feature/Notifications/AssignmentEmailTest.php
- Paper: Chapter 3 (system design)

## 2026-11-09 · S3.4 Email link opens the assignment (events)
- What was built: the link in assignment and reminder emails (`/?assignment=<id>`) now works. My duties scrolls to that duty and gives its card a maroon ring. A duty from a cancelled event opens the Cancelled section first
- Decision and why: the page only looks the id up in the person's own duties, so no new endpoint is needed and nobody can see another person's duty. An unknown id shows "That duty is not in your list"
- Decision and why: a link always shows the list, not the calendar, because the card is found in the list
- Evidence: resources/js/features/events/dutyLink.test.ts
- Paper: Chapter 3 (user interface design)

## 2026-11-10 · S2.1 People list and profile (personnel)
- What was built: admin People list (`/admin/people`) with search by name or email and filters for role, team, department and availability, 25 per page. Admin can add and edit a person. A person profile page brings details, availability history and emergency contacts together
- Decision and why: a new person gets a random unknown password and an emailed link to choose their own, using the same reset-password flow as forgot password. The admin never sees or types a password. If the email fails the person is still created and the profile offers Send set-password email again
- Decision and why: an admin cannot change their own role, so the office cannot lock itself out. Create, edit and resend write audit rows (`person.created`, `person.updated` with before and after, `person.invite_sent`)
- Decision and why: the list shows only approved accounts. Pending sign ups stay on Access requests
- Also built (mobile): `/me/details` shows a volunteer what DRRMO has on file and lets them change only their contact number (`PATCH /api/me/profile`, which ignores every other field)
- Evidence: tests/Feature/Personnel/PeopleTest.php
- Paper: Chapter 3 (system design, data privacy)

## 2026-11-10 · S2.5 Privacy notice and consent (records)
- What was built: after sign in, a person who has not agreed to the current privacy notice sees the notice instead of the app, with one "I have read and agree" button and Sign out. A public `/privacy` page shows the same text, linked from Request access and the sign in page
- Decision and why: the server enforces it. A middleware answers every API call except `/api/me`, the agree call and logout with 403 `consent_required`, so hiding screens is not the only protection. The app reads that code and asks `/api/me` again, so a notice change mid session shows the screen at once
- Decision and why: consent is checked against `config('privacy.notice_version')`. Changing the version makes everyone agree again, and `/api/me` says `privacy_notice_outdated` so the screen can tell them the notice changed
- Decision and why: agreeing twice writes one row, and each agreement is audited (`consent.given`)
- Decision and why: test users made by the factory have already agreed, so API tests reach the endpoint they test. `withoutConsent()` makes one who has not
- Evidence: tests/Feature/Records/PrivacyConsentTest.php, ConsentCheckerTest.php
- Paper: Chapter 3 (data privacy, system design)

## 2026-11-10 · S2.4 Volunteer active and inactive toggle (personnel)
- What was built: an admin screen, Volunteer status, lists approved volunteers with Active and Inactive filters. Switching one needs a reason, and each person has a History view of every change with who made it and when
- Decision and why: the change, the history row and the audit entry (`volunteer.status_changed`) are written in one transaction, so none can exist without the others
- Decision and why: the server rejects a switch with no reason or no real change. Assignment candidates and the assign endpoint both skip inactive people, so a direct API call cannot book them either
- Decision and why: only the Volunteer role can be switched here, and only an account with the `volunteers.toggle` permission (admin)
- Evidence: tests/Feature/Personnel/VolunteerStatusTest.php
- Paper: Chapter 3 (system design, data privacy)
- Also built (mobile): `/me/availability` shows a volunteer their own status and the history of changes with reasons, read only, from `GET /api/me/availability` which only returns their own rows
- The Me tab (`/me/profile`) shows your name, role and team, then rows for My availability (with an Active or Inactive chip) and the Privacy notice, and a Sign out button. This replaced a footer of plain links that sat under every /me page. My availability got the same look as Alerts and a back link to Me
- Alerts: every row keeps a slot the width of the chevron, so the times line up in one column

## 2026-11-10 · S2.3 Emergency contacts (personnel)
- What was built: a volunteer or marshal opens Emergency contacts from the Me tab and adds, edits or deletes their own contacts (name, relationship, phone), up to 5. Admin sees a person's contacts from the Volunteer status screen
- Decision and why: edit and delete return 403 for anyone else's contact, so a changed id in a request gets nowhere. Creating, editing, deleting and an admin viewing contacts all write an audit row (`emergency_contact.*`)
- Decision and why: capped at 5 contacts to keep the list useful in an emergency and stop abuse of the field
- Evidence: tests/Feature/Personnel/EmergencyContactTest.php
- Paper: Chapter 3 (system design, data privacy)

## 2026-11-10 · Personnel admin screens redesign (personnel)
- What was built: the profile has an Availability card for volunteers. It says what the status means, has a Set active or Set inactive button with a reason dialog, and shows the history as a timeline
- What was built: Teams and departments shows each list with its people count (a link to People filtered by it). Add and edit open a small dialog. Delete on a team or department that still has people explains why it cannot go and offers Set inactive instead
- Decision and why: the separate Volunteer status screen is gone. SCREENS.md already said the volunteer toggle belongs to the People list and profile, and the old screen repeated the list, the history and the contacts that the profile has. `/admin/volunteers` now opens People on the Volunteers tab
- Fix: the teams table migration was missing, so Teams failed to load. It is added with the three starting teams, departments got their `active` column, and `OrgUnitSeeder` fills in starting teams and departments
- Evidence: tests/Feature/Personnel/OrgUnitsTest.php
- Paper: Chapter 3 (system design, user interface)
- Fix: after the role tabs were reverted, only the name text on a People row opened the profile. The whole row is a link again, with a chevron hint
- What was built: People filters sit on one fixed grid row, role and team share a column, and dates are no longer cut off. Profile details are grouped under Contact and Placement as label and value rows

## 2026-11-10 · Access request screens redesign (personnel)
- What was built: Request access, Confirm your email and Waiting for approval show a three step bar (Your details, Confirm email, Approval). First and last name sit side by side from 400 px. The privacy consent is one boxed tap target that turns red when left unticked. The waiting screen lists what happens next
- What was built: Access requests now looks like People and Notifications. Status tabs with counts, a search box, a table with the person, request and confirm times, status chip and a Decision column. Under 768 px the tabs become a select and rows become a list with full width buttons
- Decision and why: Approve and Reject both ask first in the shared confirm dialog, because approving lets someone in and a stray click should not do that. Reject keeps the reason field and its 3 character minimum
- Decision and why: `GET /api/admin/registrations` also returns `counts` per status, so the tabs show numbers without five extra requests. Tabs keep one font weight and a fixed count width, so picking one never moves the others
- Evidence: resources/js/pages/RequestAccess.test.tsx, tests/Feature/Personnel/RegistrationTest.php
- Paper: Chapter 3 (user interface)

## 2026-11-10 · S2.2 Import people from CSV (personnel)
- What was built: People has an Import CSV button. The import screen offers a template download, a Check file step and an Import step. A bad file lists each problem by line and column, and nothing is saved
- What was built: columns are first_name, last_name, email, contact_number, role, team, department. Team and department are matched by name and must exist and be active. Up to 200 people per file
- Decision and why: the import is all or nothing inside one database transaction. The set-password emails go out after the save, so a mail failure never undoes the import and the screen lists who still needs an invite
- Decision and why: the same checks run for Check file and Import, so a file that passed the check cannot fail later for a reason the check missed (an email taken in between aside)
- Evidence: tests/Feature/Personnel/PeopleImportTest.php
- Paper: Chapter 3 (system design)
