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
| S2.1 | People list and profile | Not started |
| S2.2 | Import people from CSV | Not started |
| S2.3 | Emergency contacts | Partial |
| S2.4 | Volunteer active and inactive toggle | Done |
| S2.5 | Privacy notice and consent | Done |
| S2.6 | Permission check with grants | Not started |
| S2.7 | Grants manager | Not started |
| S2.8 | Coordinator event notices | Done |
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
| S4.2 | Ping engine with offline queue | Not started |
| S4.3 | Live map | Not started |
| S4.4 | Ping trail | Not started |
| S4.5 | Report slots | Not started |
| S4.6 | Report form | Not started |
| S4.7 | Overdue alerts | Not started |
| S4.8 | Report feed | Not started |
| S4.9 | Ping retention | Not started |
| S5.1 | Memo manager | Not started |
| S5.2 | Memo search | Not started |
| S5.3 | Memo viewer | Not started |
| S5.4 | Messages | Not started |
| S6.1 | Audit log viewer | Not started |
| S6.2 | My data export | Not started |
| S6.3 | Retention and pruning | Not started |
| S6.4 | PWA install | Not started |
| S6.5 | Production deployment | Not started |
| S6.6 | Field test | Not started |

Partial notes: S2.3 has models only.

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
- A seeded user logs in with email and password via Sanctum cookie auth.
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

**S2.2 Import people from CSV** `personnel` `desktop` **M**
- Template CSV download. Upload validates every row and shows errors per row before anything is saved.
- Import is all or nothing.

**S2.3 Emergency contacts** `personnel` `mobile` **M**
- A person adds, edits and deletes their own contacts from My profile.
- Admin sees them on the person profile.

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

**S4.4 Ping trail** `monitoring` `desktop` **S**
- Click a person to draw their trail for this shift. Audited.

**S4.5 Report slots** `monitoring` `both` **M**
- Scheduler creates slots every 2 hours for designated reporters with an assignment in the event.
- Slots are unique per assignment and due time.

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

## M6 Records and launch

**S6.1 Audit log viewer** `records` `desktop` **M**
- Filters by actor, action, entity, date. Expand row for details. No edit or delete.

**S6.2 My data export** `records` `mobile` **S**
- A person downloads their own profile, contacts, assignments and consents as JSON. Audited.

**S6.3 Retention and pruning** `records` `both` **S**
- Nightly prune for notifications (6 months), audit (3 years), photos (1 year), as confirmed by the owner.

**S6.4 PWA install** `core` `mobile` **S**
- Manifest, icons, app shell cache only. Installable on Android Chrome. Add to Home Screen works on iPhone.

**S6.5 Production deployment** `core` `both` **L**
- Follows DEPLOYMENT.md on the chosen server. HTTPS works. Queue worker and scheduler run. Backup and restore tested once.

**S6.6 Field test** `core` `both` **M**
- Two marshals run a 1-hour mock duty on real phones on campus data. Notes on GPS gaps, battery and signal go into an issue.
