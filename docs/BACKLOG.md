# Backlog

Draft for approval. GitHub issues are created only after the owner approves this list.

Sizes: **S** about half a day, **M** about one day, **L** two to three days.
Tags: module (`core`, `personnel`, `access`, `events`, `notifications`, `monitoring`, `information`, `records`) and device (`desktop`, `mobile`, `both`).

## Epics

| Epic | Milestone | Modules |
|---|---|---|
| E0 Foundations | M0 | core, records |
| E1 Walking skeleton | M1 | core, personnel, access, events |
| E2 People and access | M2 | personnel, access, records |
| E3 Assignments and notifications | M3 | events, notifications |
| E4 Monitoring | M4 | monitoring, events |
| E5 Information | M5 | information |
| E6 Records and launch | M6 | records, core |

## Status

Checked against the code. Done, Partial or Not started. Update this table when a story merges.

| Story | Title | Status |
|---|---|---|
| S0.1 | Repository, CI and quality tools | Done |
| S0.2 | App shell with two layouts | Done |
| S0.3 | Roles and permissions seeded | Done |
| S0.4 | Audit and consent contracts stubbed | Done |
| S1.1 | Log in and log out | Done |
| S1.2 | Admin creates an event | Done |
| S1.3 | Admin adds a duty requirement | Done |
| S1.4 | Admin assigns a person | Done |
| S1.5 | Person sees the assignment on a phone | Done |
| S2.1 | People list and profile | Done |
| S2.2 | Import people from CSV | Done |
| S2.3 | Emergency contacts | Done |
| S2.4 | Volunteer active and inactive toggle | Done |
| S2.5 | Privacy notice and consent | Done |
| S2.6 | Permission check with grants | Done |
| S2.7 | Grants manager | Done |
| S2.8 | Coordinator event notices | Done |
| S2.9 | Roles and permission matrix | Done |
| S3.1 | Assignment conflict checks | Done |
| S3.2 | Acknowledge | Done |
| S3.3 | Edit and cancel assignments | Done |
| S3.4 | Email on assignment created, changed, cancelled | Done |
| S3.5 | Shift reminders | Done |
| S3.6 | Notification log | Done |
| S3.7 | Admin dashboard | Done |
| S3.8 | No-show marking | Done |
| S3.9 | Calendar view | Done |
| S4.1 | Start and end duty | Done |
| S4.2 | Ping engine with offline queue | Done |
| S4.3 | Live map | Done |
| S4.4 | Ping trail | Done |
| S4.5 | Report slots | Done |
| S4.6 | Report form | Done |
| S4.7 | Overdue alerts | Done |
| S4.8 | Report feed | Done |
| S4.9 | Ping retention | Done |
| S5.1 | Memo manager | Done |
| S5.2 | Memo search | Done |
| S5.3 | Memo viewer | Done |
| S5.4 | Messages | Done |
| S6.1 | Audit log viewer | Done |
| S6.2 | My data export | Done |
| S6.3 | Retention and pruning | Done |
| S6.4 | PWA install | Done |
| S6.4b | Web Push module | Replaced by M7 |
| S6.5 | Production deployment | Not started |
| S6.6 | Field test | Not started |
| S7.1 | Push subscriptions and service worker | Done |
| S7.2 | Pusher send function and Laravel channel | Done |
| S7.3 | Urgent and normal alerts wired in | Done |
| S7.4 | In app sound and vibration | Done |
| S7.5 | Opt in screen, mute and quiet hours | Done |
| S7.6 | Push test and field check | Local test done, phone check with owner |


---

## M0 Foundations

**S0.1 Repository, CI and quality tools** `core` `both` **M**
- CI runs Pint, Larastan, Pest (MySQL), ESLint, Prettier check, Vitest and the Vite build on every PR.
- `composer check` and `npm run check` run the same checks locally.
- Done in the planning session, verify on the first PR.

**S0.2 App shell with two layouts** `core` `both` **M**
- `/admin/*` renders AdminLayout, `/me/*` renders MobileLayout.
- At 375 px the MobileLayout bottom navigation is visible and no element scrolls sideways.
- Unknown routes show a friendly 404.

**S0.3 Roles and permissions seeded** `access` `both` **S**
- Seeders create 4 roles and every permission in the matrix.
- A test asserts the role to permission matrix matches SECURITY_AND_PRIVACY.md.

**S0.4 Audit and consent contracts stubbed** `records` `both` **S**
- `AuditLogger` and `ConsentChecker` interfaces exist with working database implementations.
- Any module can call `AuditLogger::log()` and a row appears.

## M1 Walking skeleton

**S1.1 Log in and log out** `core` `both` **M**
- A seeded user logs in with email and password. Tokens travel in HttpOnly cookies (JWT access token and a rotating refresh token).
- Wrong password 5 times in a minute returns 429.
- `/api/me` returns the user, role and permission codes.
- Admin lands on `/admin`, others on `/me`.

**S1.2 Admin creates an event** `events` `desktop` **M**
- Admin fills title, location, start and end and saves.
- Non-admin gets 403 on `POST /api/events`.
- The event appears in the Events list.

**S1.3 Admin adds a duty requirement** `events` `desktop` **M**
- Requirement has duty type, role, team (optional), headcount, shift start and end, instructions.
- Shift must sit inside the event time.

**S1.4 Admin assigns a person** `events` `desktop` **M**
- Candidate list shows only users with the needed role.
- Saving creates an ASSIGNMENT with status assigned and an audit row.

**S1.5 Person sees the assignment on a phone** `events` `mobile` **M**
- After login at 375 px width, My assignments shows the duty with event, time, place and duty type.
- A user only ever sees their own assignments (test with two users).

## M2 People and access

**S2.1 People list and profile** `personnel` `desktop` **L**
- Filter by role, team, status, department, and search by name or email.
- Admin creates and edits a person. Email is unique.
- New person gets a set-password email.
- Mobile: a person sees their own details and edits their contact number from the Me tab (`/me/details`).
- Admin opens a person profile (`/admin/people/:id`) with details, availability history and emergency contacts. Viewing contacts is audited.

**S2.2 Import people from CSV** `personnel` `desktop` **M**
- Template CSV download. Upload validates every row and shows errors per row before anything is saved.
- Import is all or nothing.

**S2.3 Emergency contacts** `personnel` `mobile` **M**
- A person adds, edits and deletes their own contacts from the Me tab (`/me/contacts`), up to 5.
- Admin sees them on the person profile. Viewing and deleting are audited.

**S2.4 Volunteer active and inactive toggle** `personnel` `desktop` **M**
- Switch requires a reason. A VOLUNTEER_STATUS_LOG row is written with old, new, reason, changed_by.
- Inactive volunteers do not appear as candidates.
- Status history tab shows all changes.

**S2.5 Privacy notice and consent** `records` `mobile` **M**
- First login shows the notice. API calls return 403 `consent_required` until the person agrees.
- Consent row stores notice version, time and IP.
- Changing the notice version asks again on next login.

**S2.6 Permission check with grants** `access` `both` **M**
- `PermissionChecker` returns true for role permissions or an active grant (event scoped when given).
- Unit tests cover: no grant, active grant, expired grant, revoked grant, wrong event.

**S2.7 Grants manager** `access` `desktop` **M**
- Admin creates a grant with person, permission, optional event, start, end, reason.
- `reports.submit` requires an event. `location.view` max 7 days.
- Revoke sets revoked_at and revoked_by. Both actions are audited.

**S2.8 Coordinator event notices** `events` `mobile` **S**
- Coordinators see published events for their department or campus wide, read only.

**S2.9 Roles and permission matrix** `access` `both` **L**
- Access control group in the admin sidebar: Roles, Permission matrix, Temporary access.
- Admin adds custom roles, edits role permissions with switches or the matrix, and moves people between roles.
- Locked cells (admin only, duty roles only, everyone) cannot change. Nobody hands out a role with more access than they hold.
- Every change is audited. People see their own role and permissions on My access.

## M3 Assignments and notifications

**S3.1 Assignment conflict checks** `events` `desktop` **M**
- Inactive volunteer: blocked.
- Overlapping shift for the same person: blocked, shown as a chip in candidates.
- Headcount exceeded: allowed with a reason, stored in override_reason and audited.

**S3.2 Acknowledge** `events` `mobile` **S**
- Tapping Acknowledge sets status and acknowledged_at. Repeating it does nothing.
- Admin event page shows acknowledged counts.

**S3.3 Edit and cancel assignments** `events` `desktop` **M**
- Cancel needs a reason. On-duty assignments cannot be cancelled directly.
- Changes are audited with before and after.

**S3.4 Email on assignment created, changed, cancelled** `notifications` `both` **M**
- Each change queues one NOTIFICATION and one email through the queue.
- Failed sends retry 3 times, then show as failed.
- Email has a link that opens the assignment.
- Later: the Events module has no hook for this yet. When it is built, call it from assignment create, move and cancel in `AssignmentController`.

**S3.5 Shift reminders** `notifications` `mobile` **M**
- Reminder at 6:00 PM the evening before and 1 hour before.
- Never sent twice, never sent for cancelled assignments.

**S3.6 Notification log** `notifications` `desktop` **S**
- Table with filters and Retry. Shows today's count against the daily limit.

**S3.7 Admin dashboard** `events` `desktop` **M**
- Today's events, unacknowledged assignments, people not on duty 30 minutes after shift start.
- Done: the "not on duty" list shows only people whose duty never started, now that S4.1 exists. An "On duty now" count and panel, on duty staffing per event, minutes late, and Mark no show from the dashboard.

**S3.9 Calendar view** `events` `desktop` **S**
- Admin sees events by month, week or day from `GET /api/events/calendar`, through a List and Calendar switch on the Events page (no separate sidebar link). Click an event to open it.
- Done: month, week and day views, status tones, staffing bars, filters and a phone layout.
- Done: published events become completed after they end (`events:complete-ended`).

**S3.8 No-show marking** `events` `both` **S**
- Assignments never started become no_show at shift end.
- Later (needs S4.1): once duty can start, `on_duty` and `completed` assignments are skipped by the job. The job already skips them.

## M4 Monitoring

**S4.1 Start and end duty** `monitoring` `mobile` **M**
- Start allowed from 15 minutes before shift start. Requires location consent and active status.
- End sets completed and duty_ended_at. Auto end 30 minutes after shift end.
- Done: start and end endpoints, `AssignmentLookup`, auto end command, and Start and End buttons on the duty card.

**S4.2 Ping engine with offline queue** `monitoring` `mobile` **L**
- Sends a point about every 30 seconds while on duty and the page is open.
- Points captured offline are stored on the phone and uploaded in batches of up to 50 when online.
- Banner shows sharing status, GPS off, or points waiting.
- Screen Wake Lock is requested and re-requested when the page becomes visible again.
- Server rejects points from someone else's assignment or outside the shift window. Rate limit applies.

**S4.3 Live map** `monitoring` `desktop` **L**
- Esri imagery with OSM toggle, centred on ZPPSU, attribution visible.
- Latest pin per on-duty person with last seen time. Grey after 5 minutes. Polls every 30 seconds.
- Lists "No ping 5+ min" and "No location".
- Each load writes an audit row. Users without `location.view` get 403.
- Done: `GET /api/map/latest`, Live map admin page with Leaflet, event filter, 30 second polling.

**S4.4 Ping trail** `monitoring` `desktop` **S**
- Click a person to draw their trail for this shift. Audited.
- Done: `GET /api/map/trail/{assignment}`, one audit row per request, trail drawn on the live map.

**S4.5 Report slots** `monitoring` `both` **M**
- Scheduler creates slots every 2 hours for designated reporters with an assignment in the event.
- Slots are unique per assignment and due time.
- Done: `monitoring:create-report-slots` every minute. A reporter is a person with an active event scoped `reports.submit` grant and a live assignment in that event. Slots appear 15 minutes before they are due.

**S4.6 Report form** `monitoring` `mobile` **M**
- Summary required (max 1,000 characters), photo optional (resized on the phone).
- Draft kept locally if offline. Double submit returns the same report.

**S4.7 Overdue alerts** `monitoring` `both` **S**
- Slot becomes overdue 15 minutes after due. Admins are emailed. Late submissions are marked late.

**S4.8 Report feed** `monitoring` `desktop` **M**
- Newest first, filters by event, location and date. Photo opens in a lightbox.

**S4.9 Ping retention** `monitoring` `both` **S**
- Nightly job deletes pings older than 10 working days in chunks. Test with fixed dates including weekends.

## M5 Information

**S5.1 Memo manager** `information` `desktop` **M**
- Admin posts a memo with title, category, and body or file. Upload rules enforced. Delete is soft and audited.

**S5.2 Memo search** `information` `mobile` **M**
- Search after 2 characters with debounce. FULLTEXT with prefix match, LIKE fallback. Category chips.
- "fire dril" finds "Fire Drill Procedure".
- Results return in under 300 ms with 500 memos seeded.

**S5.3 Memo viewer** `information` `mobile` **S**
- Body shown inline. Files open through the protected file endpoint.

**S5.4 Messages** `information` `both` **M**
- A person writes to DRRMO. Any admin can read and answer in the DRRMO inbox.
- Unread count in the bottom navigation. Polls every 60 seconds while the page is open.
- Built as one messaging screen: a chat list with the DRRMO office pinned on top, and the open chat beside it (or in turn on a phone). Anyone can also message any other active person. Those direct chats are private to the two people, so admins cannot read them.
- Sent and Seen status on your newest message. Admins get a DRRMO inbox and My chats on the same screen.

## M6 Records and launch

**S6.1 Audit log viewer** `records` `desktop` **M**
- Filters by actor, action, entity, date. Expand row for details. No edit or delete.

**S6.2 My data export** `records` `mobile` **S**
- A person downloads their own profile, contacts, assignments and consents as JSON. Audited.

**S6.3 Retention and pruning** `records` `both` **S**
- Nightly prune for notifications (6 months), audit (3 years), photos (1 year), as confirmed by the owner.

**S6.4 PWA install** `core` `mobile` **S**
- Manifest, icons, app shell cache only. Installable on Android Chrome. Add to Home Screen works on iPhone.

**S6.4b Web Push module** `core` `both` **L**
- A project wide module that any other module can use to push a message to a person's phone or browser. Replaced by M7 below, which is built. Emergency alerts go through the Notifications module and reach the phone as Web Push.
- Service worker that shows the push and opens the right screen on tap. Builds on PWA install (S6.4).
- VAPID keys kept in the environment, never in the repo.
- Package: `minishlink/web-push`, wrapped inside the Notifications module.
- One subscription for each device a person signs in on. A person can turn a device off, and signing out removes it.
- One send function, for example `Pusher::send(User $to, string $title, string $body, string $url)`, that any module calls. Modules never talk to the push service directly.
- Expired or refused subscriptions are removed. A failed push never blocks the in app alert or the email.
- Audited when a person turns push on or off.

**S6.5 Production deployment** `core` `both` **L**
- Follows DEPLOYMENT.md on the chosen server. HTTPS works. Queue worker and scheduler run. Backup and restore tested once.

**S6.6 Field test** `core` `both` **M**
- Two marshals run a 1-hour mock duty on real phones on campus data. Notes on GPS gaps, battery and signal go into an issue.

## M7 Push notifications and sound alerts

Goal: urgent things reach people who are not looking at the app. This replaces S6.4b. Builds on PWA install (S6.4) and the `AlertSender` in the Notifications module.

**Platform limits (plain words)**
- Web Push needs HTTPS and VAPID keys. It works in the background on Android Chrome.
- On iPhone it works only for an installed PWA (Add to Home Screen, iOS 16.4 or later), and only after the person allows it from a tap.
- A web push cannot play a custom sound. It uses the phone's default notification sound and obeys silent mode and Do Not Disturb. We cannot override that.
- A custom alarm sound and vibration pattern can only play while the app is open, and the browser needs one prior tap on the page to allow audio.
- Partial answer for Android: the push can use a vibration pattern and `requireInteraction` so it stays on screen until dismissed. A real custom alarm sound with the app closed needs a native wrapper (Capacitor, or a TWA with its own notification channel). That is a bigger step, not in M7, kept under Later.
- So the real promise is: a push wakes the phone, and the app plays the alarm once it is opened or already open. Marshals should be told to keep the app installed and notifications allowed. This goes in the S6.6 field test notes.

**Which events are urgent and which are normal**
- Urgent (high priority push, repeating alarm in the app until acknowledged): `emergency.reported`, `emergency.reminder` (unacknowledged after 2 minutes), `emergency.escalated`, `report.missed`. Decided: memos and messages have no urgent flag, so they stay normal.
- Important (push, short in app chime): `report.overdue`, `report.due`, `assignment.created`, `assignment.changed`, `assignment.cancelled`.
- Normal (in app and email only, no push by default): `report.reminder`, `reminder.evening`, `reminder.hour`, `consent.withdrawn`, memos and messages.
- The level is a method on the `NotificationType` enum (`urgency()`), so other modules need no extra code.

**S7.1 Push subscriptions and service worker** `core` `both` **M**
- Table `push_subscriptions` (user_id, endpoint, public key, auth token, device label, last_used_at). One row for each device. Unique on endpoint. Index on user_id. Migration prefix next to Notifications.
- Signing out removes that device's row. A person can remove any of their devices.
- VAPID keys in `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, subject), never in the repo. A command generates them. Documented in DEPLOYMENT.md.
- `sw.js` gets `push` and `notificationclick` handlers. A tap opens or focuses the right screen from the payload `url`. The service worker still never caches `/api`.
- Endpoints: `POST /api/push/subscribe`, `DELETE /api/push/subscribe`. Each needs a policy or gate and a test for the forbidden case.

**S7.2 Pusher send function and Laravel channel** `notifications` `both` **M**
- Package `minishlink/web-push`, wrapped inside the Notifications module (`WebPushTransport`). Other modules never call it.
- `Pusher::send(User $to, NotificationType $type, string $title, string $body, string $url)`. `AlertSender::send` calls it as a third channel next to in app and email, based on urgency.
- Runs on the existing `database` queue as a job, 3 tries with backoff. Urgent pushes use a `high` queue, and the supervisor worker becomes `--queue=high,default`.
- A failed push never blocks the in app alert or the email. Gone or refused subscriptions (404, 410) are deleted.
- Each push is logged as a `push` row in `notifications` so the log (S3.6) keeps working. Retention follows the 6 month rule.

**S7.3 Urgent and normal alerts wired in** `notifications` `both` **M**
- Add `urgency()` to `NotificationType` and map the events above.
- The existing jobs need no change. `RemindEmergencies` (2 minutes), `EscalateEmergencies`, `SendReportReminders`, `MarkMissedReports`, `MarkOverdueReports` and the assignment notifier already call `AlertSender`.
- Tests: one for each urgency level, push skipped when muted, push skipped when there is no subscription.

**S7.4 In app sound and vibration** `core` `mobile` **M**
- A small client module watches for new alerts (existing polling, a shorter interval for urgent) and plays a sound, plus `navigator.vibrate` where allowed (Android only, not iPhone).
- Urgent push: Android vibration pattern and `requireInteraction` (stays until dismissed).
- Urgent in app: repeating alarm until the person taps Acknowledge or Dismiss. Important: one short chime. Normal: silent.
- Audio is unlocked by a one tap "Turn on alert sound" step after login. Sound files are short, small, in `public/sounds`, free or self made only. Decided: two short tones, an alarm and a chime.
- Admin desktop screens play the urgent alarm for new emergencies while the page is open.
- Design thread (UI) for the banner and the alarm screen.

**S7.5 Opt in screen, mute and quiet hours** `notifications` `mobile` **M**
- Settings screen: Turn on alerts on this device (browser permission is asked only after a tap, with a plain explanation first), devices list, test button.
- iPhone not installed: show "Add to Home Screen first" steps instead of the button.
- Mute sound, mute push for normal and important alerts, and quiet hours (for example 10 PM to 6 AM) stored on the user. Decided: urgent emergencies ignore quiet hours for everyone who gets them, and the screen says so plainly.
- Turning push on or off is audited through the Records `AuditLogger`.

**S7.6 Push test and field check** `core` `both` **S**
- HTTPS is required. Decided: set up a stable Cloudflare tunnel (a named tunnel with a fixed hostname, not a quick one that changes) first, test on it, and change to the real domain later. Changing the domain means new subscriptions, so people turn alerts on again. Desktop Chrome also allows localhost. The VAPID subject is the tunnel address for now.
- Checklist: Android Chrome in background, Android app closed, iPhone installed PWA, iPhone browser tab (should show the install hint), silent mode, Do Not Disturb, quiet hours, expired subscription cleanup. Results go into DEV_LOG and the S6.6 notes.

**Audit and privacy**
- Push text is short and generic, for example "Emergency reported. Open the app." No victim names, no coordinates, no memo content. Push services (Google, Apple, Mozilla) see only the endpoint and an encrypted payload.
- Location stays admin only. A push never carries location.
- Subscriptions are personal data. They are included in My data export (S6.2) and deleted with the account.
- Add a line to the privacy notice that alerts may be sent to the person's device if they allow it.

**Decisions (answered by the owner)**
- Only emergencies and reports are urgent. No urgent flag on memos or messages.
- Urgent emergencies ignore quiet hours.
- Two short free tones: alarm and chime.
- Stable tunnel for testing now, real domain later.
- No custom sound with the app closed on the web. Vibration and stay on screen are used instead. A native wrapper is a possible later story.

## Later

**Native alert wrapper** `core` `mobile` **L**
- Capacitor or a TWA with its own Android notification channel, for a real custom alarm sound with the app closed. Only if the field test (S6.6) shows web push is not enough.

**Improve the overall site report logic** `monitoring` `both` **TBD**
- Done (site report rework, 3 steps). Emergency reports (type, note, photo, place from the latest ping, sent, acknowledged, resolved, escalated after 5 minutes, offline queue). Two global reviewer marshals set by an admin. Reminders 15 minutes before and at the due time, a reminder for unacknowledged emergencies, and a missed state 60 minutes after the due time. Emergencies on the report form, one Reports page with needs attention, and audit of report views.
- Web Push is built in M7, so alerts also reach the phone.
