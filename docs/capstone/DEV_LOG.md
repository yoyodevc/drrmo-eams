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

## 2026-11-10 · S2.6 and S2.7 Permission grants (access)
- What was built: a permission now comes from the person's role or from a time-limited grant. `User::hasPermission()` asks one place, the Access `PermissionChecker`, so every policy honors grants without changing. A grant counts while `starts_at <= now < ends_at` and it is not revoked. A grant tied to one event only answers questions about that event
- What was built: an admin opens a person's profile and uses the Extra access card to give access (the live map, submit site reports, read site reports) with an event, a start, an end and a reason, or to end a grant early. Admins have all of these already, so their profile hides the card
- What was built: the Me tab shows a person the extra access they hold or will hold, and when it ends. `GET /api/me` also returns the grants in force, and leaves event grants out of the flat `permissions` list
- Decision and why: `reports.submit` must name an event, and `location.view` can last 7 days at most. The server also refuses a permission the role already holds, an account that cannot sign in, a start in the past and an overlapping grant for the same permission
- Decision and why: revoking sets `revoked_at` and `revoked_by`, and nothing is deleted, so the history stays. Giving and revoking both write an audit row (`grant.created`, `grant.revoked`)
- Decision and why: only permissions marked grantable can be granted, and the checker ignores a grant row for any other permission, so a bad row can never open admin features
- Evidence: tests/Feature/Access/PermissionCheckerTest.php, tests/Feature/Access/GrantsTest.php
- Paper: Chapter 3 (system design, data privacy)
- What was built (follow up): the Access item in the System sidebar group now opens the Grants manager. It lists every grant with Active, Upcoming, Ended and All tabs, a New grant dialog with a person picker, and End access. Nearly every admin permission can now be granted (all except `access.manage` and the ones that only make sense for a role), so the office can lend a screen such as People or Events for a while
- What was built (follow up): the admin sidebar, the route check and the landing page read one permission list (`app/adminAccess.ts`). A marshal granted `people.view` sees only People and Teams, plus a My duties link back, and opens the admin area from an Admin screens row on the Me tab. A screen without its permission shows a short no access message
- Decision and why: a person who holds `people.manage` only by a grant cannot create, edit or import an admin, so a grant can never be used to climb to admin. `access.manage` is not grantable for the same reason
- Evidence: tests/Feature/Access/GrantsTest.php, resources/js/layouts/AdminLayout.test.tsx


## 2026-11-10 · S2.9 Roles and permission matrix (access)
- What was built: an Access control group in the admin sidebar with three screens. Roles lists every role with its people count, how much of the admin side it opens, and a Built-in or Custom chip. A role's page has a Permissions tab (switches grouped by module, each with a plain description) and a People tab (who holds it, and Add people to move people in). Permission matrix shows permissions by roles with tick boxes and saves every role at once. Temporary access is the old grants screen
- What was built: admins can add custom roles, such as Records officer, from the basics or from a copy of another role, rename them, and delete them once nobody holds them. The People screens read role names from the server, so a custom role shows everywhere and can be picked on the person form and in the role filter
- What was built: on the phone, the Me tab has a My access page with the person's role, what it lets them do in plain words, any extra access with its end time, and a link to the office screens when they have some
- Decision and why: permissions stay in code (`PermissionMatrix`) because code checks them. Roles and which permissions they hold became data an admin edits. The docs table is now the default matrix for a fresh install, and the seeder keeps an admin's edits when it runs again
- Decision and why: some cells are locked. Admin holds everything. Manage access, the live map and event site reports stay admin only, so location data keeps the Data Privacy Act rule and others reach it only through a time-limited grant. Duty stays with Marshal and Volunteer because event requirements staff by those roles. Every role keeps the basics (memos, messages, own profile)
- Decision and why: a person can give someone a role only when they already hold every admin permission in it (`RoleGuard`). This replaces the older "a grant holder cannot touch an admin" check with one general rule, which also covers custom roles. Nobody can change their own role, and moving the last admin out is refused
- Decision and why: moving people between roles goes through Personnel's `PersonRoleChanger`, because Personnel owns the users table. Each move, each role change and each permission change writes an audit row
- Decision and why: unsaved changes collect in a save bar that is always in the layout, only hidden, so the page never jumps when it appears. Changed cells are marked amber until saved
- Evidence: tests/Feature/Access/RolesTest.php, tests/Feature/Access/PermissionMatrixTest.php, resources/js/features/access/pages/PermissionMatrix.test.tsx, resources/js/layouts/AdminLayout.test.tsx
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (results)

## 2026-11-13 · S4.2 Location sharing and S4.9 Location data cleanup (monitoring)
- What was built: while a person is on duty and the page is open, the phone captures a location point about every 30 seconds. Points wait in a local queue and upload in batches of up to 50 to `POST /api/me/assignments/{assignment}/pings`. A banner on the duty card shows sharing, GPS off, or offline with the number of points waiting
- What was built: the phone asks for the Screen Wake Lock so the screen stays on, and asks again when the page becomes visible
- What was built: the server takes pings only from the assignment's own person who holds `location.send_own`, has not withdrawn location consent, and has started duty. Points captured outside the duty window (from start of duty to its end, with a 2 minute clock allowance) are refused. The limit is 10 requests a minute per person
- What was built: `monitoring:purge-pings` runs at 02:00 and deletes pings older than 10 working days (Monday to Friday), 5,000 rows at a time
- Decision and why: one bad point must not block the queue, so the server keeps the good points and reports how many it refused. The phone drops a batch the server refuses for good and keeps retrying on network errors or the rate limit
- Decision and why: a duty that already ended still accepts points captured during it, because a phone that was offline uploads late
- Evidence: tests/Feature/Monitoring/PingTest.php, resources/js/features/monitoring/pingQueue.test.ts
- Paper: Chapter 3 (system design, data privacy)

## 2026-11-13 · Location consent screen (records, monitoring)
- What was built: the first time a person taps Start duty without location consent, a sheet explains when location runs, who sees it and how long it is kept. Agree saves the consent and starts duty. Not now closes it and nothing is saved
- What was built: the Me tab has a Stop location consent button. After that, Start duty is refused with a clear message until the person agrees again
- Decision and why: `POST /api/consent/location` and `DELETE /api/consent/location` only ever touch the signed-in person's own consent. Only roles that can share location may agree, so an admin gets 403. Agreeing twice writes one row. Both calls write an audit row (`consent.given`, `consent.withdrawn`)
- Evidence: tests/Feature/Records/LocationConsentTest.php
- Paper: Chapter 3 (data privacy)

## 2026-11-13 · S4.3 Live map and S4.4 Ping trail (monitoring)
- What was built: an admin Live map page. Esri satellite imagery by default with an OpenStreetMap switch, centred on the campus, with attribution shown. One pin per person on duty, grey after 5 minutes without a ping, with last seen time. It refreshes every 30 seconds and can be filtered by event
- What was built: side lists On the map, No ping 5+ min and No location. Clicking a person draws their trail for the shift
- What was built: `GET /api/map/latest` and `GET /api/map/trail/{assignment}` need `location.view`. Each call writes one audit row (`location.viewed`, `location.trail_viewed`), and a trail is one row however many points it holds
- Decision and why: the latest ping per person uses the indexed join in docs/DATABASE.md, so the page stays fast with 600,000 rows. The trail loads once per click and is not polled, so one click is one audit row
- Decision and why: the event filter is built from people on duty, so someone who holds only `location.view` does not need the events permission
- Evidence: tests/Feature/Monitoring/MapTest.php, resources/js/features/monitoring/mapView.test.ts
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (results)

## 2026-11-13 · Admin notice on location consent withdrawal and Wake Lock status (records, notifications, monitoring)
- What was built: when a person stops sharing their location, everyone who may view locations (admins, and anyone holding `location.view` through a grant) gets a notification and an email. It names the person and lists their upcoming duties with shift times, so the office can reassign. It shows in the Notification log with a "Location consent withdrawn" label and the person's name
- What was built: nothing is sent when there was no open consent to withdraw, so tapping twice, or withdrawing when never agreed, makes no notice. The person is never told about their own withdrawal
- What was built: the duty banner now says whether the screen stays on. It reads "Screen stays on", a paused note when the browser lets go (page hidden, comes back on return), or "Screen may turn off (not supported or blocked)". The hook exposes the state as `active`, `unsupported`, `denied` or `released`
- Decision and why: Records only fires a `LocationConsentWithdrawn` event. Notifications listens and writes its own rows, because Records must not write another module's table. The notification table gained a nullable `subject_user_id` for notices that are about a person and not an assignment
- Decision and why: the upcoming duties are read when the email is built, so the list is current at send time
- Problem met and fix: Wake Lock can only be checked on a real phone over HTTPS, so the state is now visible on screen instead of guessed, and a Vitest test with a mocked `navigator.wakeLock` covers request, release, re-request on visible, unsupported and denied
- Evidence: tests/Feature/Notifications/ConsentWithdrawalNoticeTest.php, resources/js/features/monitoring/hooks/useDutyTracker.test.tsx
- Paper: Chapter 3 (data privacy), Chapter 4 (results)

## 2026-11-13 · S4.5 Report slots (monitoring)
- What was built: `monitoring:create-report-slots` runs every 5 minutes and makes a report slot when a report is due within the next 15 minutes. Slots are due every 2 hours from the start of the person's shift. A shift shorter than 2 hours gets one slot, due at its end. Nothing is made for a shift that ended more than 15 minutes ago
- What was built: a new `site_reports` table with status pending, submitted, overdue or late, a unique key on assignment and due time, and an index on status and due time for the overdue scan. A `ReportSlotCreated` event fires once for each new slot
- Decision and why: a designated reporter is a person who holds an active `reports.submit` grant tied to that event and also has a live assignment in it. This follows the permission matrix, where the grant must name an event, and the plan rule that the reporter must be on the event. No new flag was added to assignments
- Decision and why: running the command again, or twice at once, never makes a second slot. The database unique key is the safety net and the command uses firstOrCreate
- Evidence: tests/Feature/Monitoring/ReportSlotsTest.php (fixed dates, a Monday)
- Paper: Chapter 3 (system design), Chapter 4 (feature 4.5)

## 2026-11-13 · S4.6 Report form (monitoring)
- What was built: a designated reporter sees a Reports due card at the top of My duties. Each row opens the report form: a summary (required, up to 1,000 characters with a live count) and an optional photo from the camera. The phone shrinks the photo to 1,600 px on the long side and sends it as a JPEG
- What was built: the text is kept on the phone as a draft while typing, so a dropped connection loses nothing. If the send fails for lack of network, the form says so and keeps the draft
- What was built: `POST /api/me/report-slots/{id}` saves the report as submitted, or late when it is sent more than 15 minutes after the due time or after the slot went overdue. `GET /api/me/report-slots` lists the reporter own slots. The photo goes to private storage under a random name and is read back only through `GET /api/me/report-slots/{id}/photo`
- Decision and why: sending the same slot twice returns the report already saved and changes nothing, so a double tap or a retry after a slow answer never makes a second report. The slot row is locked while saving
- Decision and why: only the slot owner can send, and only while their event grant for `reports.submit` holds. A revoked grant stops them at once. The file type is read from the file content, not the name, and a 6 per minute limit applies per person
- Evidence: tests/Feature/Monitoring/ReportFormTest.php, resources/js/features/monitoring/reportDraft.test.ts
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (feature 4.6)

## 2026-11-13 · S4.7 Overdue alerts (monitoring, notifications)
- What was built: `monitoring:mark-overdue-reports` runs every 5 minutes. A pending slot becomes overdue 15 minutes after it was due, and a `ReportOverdue` event fires once for it. Notifications listens and emails everyone who may read site reports, naming the reporter, the event and the due time. The email also shows in the admin Notification log as "Report overdue"
- What was built: a report sent after the 15 minutes, or after the slot went overdue, is stored as late (done in S4.6). Sent, late and future slots are never touched
- Decision and why: the status change is made with a conditional update (only if still pending), so two runs at once cannot both announce the same slot, and running the command again sends nothing new
- Decision and why: recipients are found by the permission `reports.view`, tied to the event, so a person with a grant for one event hears only about that event. The lookup moved into a small shared helper that the consent withdrawal notice now uses too
- Decision and why: the notifications table got a nullable `site_report_id`, as planned in docs/DATABASE.md gap G7
- Evidence: tests/Feature/Monitoring/OverdueReportsTest.php (fixed dates, 15 minute boundary, once only, recipients)
- Paper: Chapter 3 (system design), Chapter 4 (feature 4.7)

## 2026-11-13 · S4.8 Report feed (monitoring)
- What was built: an admin Reports page. Site reports newest first, each card showing the event, author, place, due and sent times, the summary, and a Late or Overdue badge. A photo thumbnail opens a lightbox. Filters by event, place and date (Manila days) sit in the URL, and results come 15 at a time
- What was built: `GET /api/reports`, `GET /api/reports/{id}` and `GET /api/reports/{id}/photo`. Photos are read from private storage through the API, never from a public folder
- Decision and why: access follows `reports.view`. A role that holds it sees every event. A person with an event grant sees only that event, and the filter lists name only events they may see. Everyone else gets 403 on the list, one report and its photo, including a reporter who may send reports but not read the feed
- Decision and why: slots that are not yet due stay out of the feed, because they carry no news
- Evidence: tests/Feature/Monitoring/ReportFeedTest.php
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (feature 4.8)

## 2026-11-18 · Manage lists redesign and location pin picker (personnel, events)
- What was built: the admin Manage lists page now shows one list at a time. A switcher on the left groups People lists (teams, departments) and Events lists (event types, locations) with counts. Phones get a row of choices on top. The chosen list is in the URL (`?list=locations`)
- What was built: each list has a search box, an All, Active and Inactive filter, and table rows with name, status, use count and actions. Empty, no match, loading and error states are covered
- What was built: locations show on a campus map next to the list. The add and edit dialog has a map picker: click to drop the pin, drag to fine tune, or pin the map center. Typed latitude and longitude still work. A note shows when the pin is outside the campus border
- Decision and why: the satellite and street layers and the campus border moved into one shared map piece, so the live map and the picker look the same
- Decision and why: setting a location inactive from the delete dialog now keeps its coordinates. Before, it sent 0, 0
- Evidence: resources/js/features/monitoring/mapView.test.ts (campus border check, coordinate parsing)
- Paper: Chapter 4 (admin lists, campus locations)

## 2026-11-19 · S5.1 to S5.3 Memo library (information)
- What was built: an admin Memos page to post, edit and delete memos with a title, a category, and text, a file, or both. Files are PDF, DOCX, JPG or PNG up to 5 MB, and the type is read from the file content. Files sit in private storage under a random name and open only through `GET /api/memos/{id}/file`
- What was built: phone search with category chips that show a count for the current search. Search starts at 2 letters. MySQL uses FULLTEXT with prefix match, so "fire dril" finds "Fire Drill Procedure", and LIKE takes over when FULLTEXT finds nothing or the database has no FULLTEXT
- What was built: a memo viewer for admin and phone with the text inline and the file in a preview pane. A Word file gets a PDF copy made by LibreOffice in a queued job. Until it is ready, or if it fails, the page shows the quick browser preview
- Decision and why: delete is soft and audited as `memo.deleted`, so the audit trail can still name what was removed. Everyone reads (`memos.view`), only `memos.manage` writes
- Decision and why: when a file is replaced, the old file and its PDF copy are removed only after the new state is saved, so a failed save loses nothing
- Evidence: tests/Feature/Information/MemoTest.php and MemoPreviewTest.php (18 tests, all pass, run on MariaDB 10.4 on 19 Nov 2026). The 300 ms search test with 500 memos should be run again on MySQL 8
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (features 5.1 to 5.3)

## 2026-11-19 · S5.4 Messages (information)
- What was built: a phone Messages tab with one conversation with DRRMO. Newest at the bottom, grouped by day, a text box with a character count, and a Send button. The bottom navigation shows how many answers are unread, and the app checks every 60 seconds while it is open. Answers on screen are marked read
- What was built: an admin DRRMO inbox with two panes, people on the left with the newest activity first and unread counts, the conversation on the right. On a phone one pane shows at a time. The sidebar shows the unread total. Admins type an answer from the same box
- What was built: `GET` and `POST /api/me/messages` (plus `/read` and `/unread`) and `GET /api/inbox`, `/inbox/unread`, `/inbox/{user}`, `POST /inbox/{user}/reply` and `/read`. New table `messages` as planned in docs/DATABASE.md gap G11
- Decision and why: the inbox is shared. A message to the office has no recipient, so any admin with `messages.office_inbox` can read and answer, and opening a conversation marks it read for every admin. Two admins do not both chase the same message
- Decision and why: a person sees answers as "DRRMO", not the admin's name, because they wrote to the office and not to one person. Admins see which admin answered
- Decision and why: the office can only answer. A conversation starts when the person writes, so the answer route returns 404 for someone who never wrote. This keeps the inbox from becoming a way to message anyone
- Decision and why: no audit row and no email for a message. The audit rules in docs/SECURITY_AND_PRIVACY.md do not list messages, and the story asks only for an unread count. Both are easy to add later if the owner wants them
- Decision and why: sending is limited to 20 a minute per person. A real conversation never gets near it
- Evidence: tests/Feature/Information/MessageTest.php (15 tests: every role may write, each person sees only their own conversation, read and unread counts, shared inbox, forbidden for volunteer, marshal and coordinator on every inbox route, signed out 401, rate limit), resources/js/features/information/messages.test.tsx (day labels, grouping, send, failed send keeps the text, empty and over-long blocked). Full suite 361 PHP tests and 141 JS tests pass
- Design pass: messages sit on the stone page, the other side in white bubbles and yours in maroon. Messages from one sender within 5 minutes form a run, with the name and time once under the last one. Days are split by a hairline with the day's name. The box grows with the text, Ctrl or Cmd + Enter sends, and the count shows only near the 1000 limit. On a phone the page fills the screen so only the messages scroll and the box sits right above the tab bar
- Design pass: the inbox rows show initials, name, time and the last message, with unread rows in bold and a maroon count. The open row gets a maroon bar on its left edge. The search matches the People filters. With nothing open, the right pane says what to do. Each conversation has a link to the person's profile for admins who can see People
- Design pass: the memo search empty state ends with "Still can't find it?" and an Ask DRRMO link. The unread count sits on the Messages icon in the tab bars and on the inbox icon in the collapsed admin rail
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (feature 5.4)

## 2026-11-19 · S5.4 Messages between people (information)
- What was built: anyone can now write to any other active person, not only to the DRRMO office. The phone Messages tab is a list: the DRRMO office first, then people, newest first, with a name search to start a new conversation. Each conversation has its own screen and unread count, and the Messages tab total includes both
- What was built: `GET /api/me/chats`, `/me/chats/people?q=`, `/me/chats/{user}`, `POST /me/chats/{user}` and `/read`. The `messages` table has a new `is_direct` column, so the office inbox never mixes with person to person messages
- Decision and why: only the two people in a conversation can read it. Admins do not see it, because the inbox is for the office and not for reading private talk
- Decision and why: the people list shows names only, active accounts only, never the sender. Closed and waiting accounts cannot receive messages
- Evidence: tests/Feature/Information/MessageTest.php (41 Information tests pass). Admin screens have no person to person page yet
- Paper: Chapter 3 (system design, data privacy), Chapter 4 (feature 5.4)

## 2026-11-19 · S5.4 Messages redesign (information)
- What was built: Messages now works like a messaging app. One screen holds the list of chats and the open chat. On a phone they take turns, and the screen fills the space between the top bar and the tab bar so only the messages scroll. From 768 px they sit side by side in one panel
- What was built: the DRRMO office is pinned on top of the list with its seal, then direct messages, newest first, with initials, the last message, the time and an unread count. A search finds anyone by name to start a chat
- What was built: every chat has a header with a back button, the avatar and a short line about who can read it. Bubbles carry the other side's avatar, messages from one sender within 5 minutes form a run, and days are split by a hairline. A sent message shows at once with "Sending...", and your newest message says "Sent" or "Seen". An empty office chat offers three ready questions to start with
- What was built: the admin Messages screen uses the same frame, with two lists on the left: DRRMO inbox and My chats. Admins can now chat person to person from the admin area. The sidebar badge counts both
- Decision and why: "Seen" comes from the read time the server already keeps, so no new table or column was needed. For the office chat, "Seen" means an admin opened the conversation
- Evidence: tests/Feature/Information/MessageTest.php adds a test for "seen" on office messages, office answers and direct messages. Full suite 370 PHP tests and 141 JS tests pass
- Paper: Chapter 4 (feature 5.4)

## 2026-11-20 · Reports redesign (monitoring)
- What was built: one Reports page with three tabs. Needs attention is the landing tab, then Emergencies, then the report Feed. The old Needs attention and Emergencies pages and their sidebar items are gone, and their old addresses redirect
- What was built: Needs attention opens with four counts (not acknowledged, open and taken on, overdue, missed). Open emergencies come first, each with an Acknowledge button and a link to its details. Each event name in the summary table opens the Feed filtered to that event
- What was built: on a wide screen the Emergencies tab shows the list and the open report side by side, with the note, place, photo and a short history. On a phone a report opens under its row
- What was built: Report reviewers moved to Access control, next to Roles and Temporary access. It shows the two reviewer places, a searchable list of active marshals and the same save bar as the role screens
- Decision and why: unacknowledged emergencies must never hide behind a tab. The sidebar Reports item shows their count in a white badge, the Emergencies tab carries a red count, the Feed tab shows a red strip, and the red alert banner stays
- Decision and why: no report opens by itself in the side by side view, because opening one shows where the person was and is audited
- Evidence: no backend change. The full JS suite passes (141 tests). The screens were checked in a browser at 1280, 900 and 390 px with sample data
- Paper: Chapter 4 (monitoring features)

### Reports page redesign (monitoring)
- What was built: the Reports page now follows the same layout as People and Roles. Each section is one white panel with a title row. Needs attention has a single summary strip with a colored dot for each count, then panels for open emergencies, overdue and missed reports, and reports for each event
- What was built: the Feed tab is now called All reports. Its filters match the People filters (on a phone they fold behind a Filters button), and the reports sit in one list with a count, Clear filters and paging
- What was built: on a phone the emergency rows no longer break, and the event table fits without sideways scrolling
- Decision and why: the extra red strip on the Feed tab was removed. The admin red banner and the sidebar and tab counts already show open emergencies on every page
- Evidence: no backend change. Checked in a browser at 1280, 900 and 390 px with sample data
- Paper: Chapter 4 (monitoring features)

### Reports page second pass (monitoring)
- What was built: the tabs now match the Roles tabs. Needs attention shows how many items wait, and the Emergencies count turns red while any emergency is not acknowledged. On a phone the first tab reads Attention so all three fit without scrolling. A Report reviewers button sits in the page header for admins
- What was built: Needs attention puts the oldest waiting emergency first and shows "Sent 14 min ago" next to the clock time. Each summary number has a short line that says what it counts. Late site reports is a table on desktop with who, which event and when it was due. Site reports by event adds an on time rate bar on wide screens and four small numbers per event on a phone
- What was built: an open emergency now shows Acknowledge in a red box at the top, so it never sits below the fold. The note, who sent it, the event and the place sit in labelled rows, and the history shows when it was escalated. Once someone acknowledges it, Mark resolved becomes the main button
- What was built: All reports leads each row with the person and a status chip (On time, Late, Overdue or Missed), and shows "Showing 1 to 15 of 40" like People. The date filters cannot be set so that From is after To
- What was built: Report reviewers gets a search icon, a count of active marshals and a line that says how many may be picked
- Decision and why: Acknowledge on Needs attention still does not load the place. Only View details opens an emergency, and that open is audited, so nothing opens by itself
- Evidence: no backend change. Types, lint and formatting pass. Checked in a browser at 1280, 900 and 390 px with sample data
- Paper: Chapter 4 (monitoring features)

### Phone Reports tab and emergency alert fix (monitoring)
- What was built: phones get a Reports tab where a marshal can send an emergency and write due site reports. The phone nav now has five tabs, with Alerts on a bell icon, and the Reports screen uses a quieter design. The medical emergency icon is a cross
- What was built: the red emergency alert now disappears once the emergency is acknowledged, so it no longer shows on every page after someone has taken it on
- Evidence: a new Pest test covers the alert clearing after acknowledge. Full backend suite (394 tests), JS suite (141 tests), Pint, Larastan and the build pass
- Paper: Chapter 4 (monitoring features)

### Audit log viewer and a working dashboard (records, events)
- What was built: the Records page (S6.1) lists the audit log with filters for actor, action, entity and date. A row expands to show its IP address and details. It is read only, and only people with `audit.view` can open it
- What was built: the admin dashboard now shows real figures instead of the "Coming soon" preview: attendance this month, duty hours for 8 weeks, time to acknowledge, events by type, and an "Across the system" strip with open emergencies, reports needing attention, unread messages, access requests, active people and the latest memos. Each block only shows when the person's permissions cover it
- Decision and why: the audit viewer does not audit itself, to keep the log free of noise from people reading it
- Evidence: new Pest tests cover the filters and the forbidden case. Full backend suite, JS suite, Pint and Larastan pass
- Paper: Chapter 4 (records and dashboard)

### My data export and retention pruning (records)
- What was built: the phone Me tab has a "Download my data" button (S6.2). It saves the person's own profile, emergency contacts, duty assignments and consents as one JSON file. Each download is audited as `data.exported`
- What was built: three nightly jobs prune old rows (S6.3): notifications after 6 months, audit rows after 3 years, and report photos after 1 year. A pruned photo is deleted from disk and the report stays without it. The audit prune writes one `records.pruned` row of its own
- Decision and why: each job lives in the module that owns the table, so no module deletes another module's rows
- Evidence: new Pest tests cover the export (own data only, audited, forbidden when signed out) and the three prune jobs. Retention periods for non-ping data still need owner confirmation
- Paper: Chapter 4 (records and privacy)

### PWA install (core)
- What was built: the app has a web manifest, icons (192, 512 and a maskable one) and a small service worker, so it can be installed on Android Chrome and added to the Home Screen on iPhone. It opens full screen with the maroon theme color
- Decision and why: the service worker caches only the app shell (the page, built files and brand images). It never caches `/api`, so no personal data is stored on the phone by it. It registers in production builds only
- Evidence: checked the manifest and service worker on a production build served through an https tunnel
- Paper: Chapter 4 (mobile access)

### Launch screen, quieter phone pages and dated alerts (core, information, notifications)
- What was built: the installed app opens on an off-white splash with the DRRMO shield and no box around it. The page keeps the same screen (with a thin loading bar and the office name) until the app knows who is signed in, then fades into it. No white flash
- What was built: the phone Memos list and memo page use the quieter Reports style: hairline rows, small gray icons, and a pale chip for the chosen category. The gradient line above titles is gone from all phone pages. The phone Messages list now has the same page margins, gray section labels and white cards as the other tabs, instead of running edge to edge
- What was built: Alerts opens each day with a calendar tile, the day's name and its full date, so Today and Yesterday still show the date. Times are darker and easier to read
- Decision and why: the boot screen is plain CSS in the page, not part of the app bundle, so it paints before the JS loads. The icons now have a transparent or off-white field that matches the splash color exactly. A maroon splash was tried first, but an installed app keeps its old splash color until Android refreshes it, which left a maroon box on a light screen
- Evidence: type check, lint and the format tests pass
- Paper: Chapter 4 (mobile access)

### Push and sound alerts (core, notifications)
- What was built: people can turn on phone alerts for a device from Me, then Alerts (S7.1, S7.5). A new `Pusher` sends short, generic Web Push messages through `AlertSender` (S7.2). Each alert has a level on `NotificationType`: urgent (emergencies, missed reports), important (assignments, due or overdue reports) or normal (S7.3). Urgent pushes go on a `high` queue
- What was built: while the app is open, an urgent alert rings an alarm on a full screen card until the person opens it or dismisses it. Important alerts play one short chime. Sound unlocks with one tap (S7.4). Settings cover mute, quiet hours and a device list, and turning alerts on or off is audited (S7.5)
- Decision and why: emergencies ignore mute and quiet hours, so nobody silences one by accident. Memos and messages are never urgent. Push text has no names, places or memo content. Mute and quiet hours live in a Notifications table so no module writes to a Personnel table. A web push cannot play a custom sound with the app closed, so urgent pushes use strong vibration and stay on screen on Android
- Evidence: Pest tests cover levels, skip rules, forbidden removal of another person's device, and gone devices being deleted. Checked in desktop Chrome on localhost with a real push subscription: alerts turned on, a push was delivered by Google's service, and the alarm card rang and closed
- Open: phone checks (Android background and closed, iPhone installed app, silent mode, Do Not Disturb) are with the owner (S7.6). A named Cloudflare tunnel needs the owner's Cloudflare login and domain, so testing used localhost
- Paper: Chapter 4 (alerts and mobile access)

## 2026-11-23 · Documentation refresh (core)
- What was built: README, MODULES, DATABASE, SCREENS, USER_FLOWS, ARCHITECTURE, PLANNING_SUMMARY, PROJECT_PLAN, BACKLOG, SECURITY_AND_PRIVACY and the data dictionary and API reference appendices were checked against the code and brought up to date for M0 to M7.
- What was built: the ERD in DATABASE.md now shows all 27 domain tables, including emergency_reports, report_reviewers, push_subscriptions, alert_preferences, refresh_tokens, teams and event_types. Two new flows (emergency on duty, turn on phone alerts) are in USER_FLOWS.md.
- Problem met and fix: several docs still described the first plan (20 tables, Sanctum, no emergencies, no push). They were rewritten from the migrations, routes, scheduler and enums, not from the older docs.
- Open: DEPLOYMENT.md and `.env.example` mention a ProductionSeeder and an AdminUserSeeder that do not exist, so there is no first admin step yet. It belongs to S6.5.
- Evidence: docs only, no code changed
- Paper: Chapter 3 (system design)

## 2026-11-28 · Random record codes in links (core, all modules)
- What was built: every record people open now has a random public code. Addresses such as /admin/events/..., the duty link in emails, push links, query filters and API answers use the code. Record numbers stay inside the database. Old rows got their codes during the migration
- Decision and why: random codes stop people from guessing the next record or counting records. Primary keys stayed integers, so no foreign key changed. Policies were not relaxed. A code is not a permission
- Problem met and fix: a number sent to the map filter would have shown every event, so an unknown code now matches nothing. A copied row would have kept the same code, so copies get a new one
- Open: links in emails sent before this change no longer highlight the duty or open the report. Reports, emergencies and location points still waiting offline on a phone at the moment of the update are not sent by the new version, so deploy when no duty is running
- Evidence: tests/Feature/Core/PublicCodeTest.php checks that a number is refused for each record type. 466 PHP tests and 155 JavaScript tests pass. Click-through on the local server as an admin and as a marshal at phone width
- Paper: Chapter 3 (security design), Chapter 4
