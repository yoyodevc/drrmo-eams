# User Flows

These are the ten "day in the life" flows. Each one lists the device, the steps, the screens, the API calls, the permission checked, what is written, and what can go wrong. Screen names match SCREENS.md. Endpoint paths match MODULES.md.

---

## Flow 1. Before the event (Admin, desktop)

**Steps**
1. Admin opens Events and clicks New event. Fills in title, location, start and end, department (or campus wide). Saves as draft.
2. On the event page, adds duty requirements: for example "Crowd control, Marshal, Security team, 6 people, 7:00 AM to 12:00 NN, gather at the main gate".
3. Clicks Assign on a requirement. A side panel lists candidates. Each candidate shows team, status and warning chips ("overlapping shift", "inactive").
4. Ticks people and saves. If the headcount is exceeded, a dialog asks for a reason.
5. Publishes the event. Emails go out.
6. Later, the event page shows a progress bar per requirement: assigned, acknowledged.

**Screens:** A-Events list, A-Event detail, A-Assignment editor.

**API:** `POST /api/events`, `POST /api/events/{event}/requirements`, `GET /api/requirements/{id}/candidates`, `POST /api/requirements/{id}/assignments`, `PATCH /api/events/{event}` (status published), `GET /api/events/{event}`.

**Permission:** `events.manage`, `assignments.manage`.

**Written:** EVENT, EVENT_DUTY_REQUIREMENT, ASSIGNMENT (status assigned, assigned_by, assigned_at, override_reason), NOTIFICATION (queued), AUDIT_LOG (assignment created, override).

**What can go wrong**
- Inactive volunteer selected: blocked, cannot be overridden.
- Overlapping shift: blocked, shown in the candidate list as a red chip.
- Headcount exceeded: warning, allowed with a reason.
- Double click on Save: the unique `(user_id, requirement_id)` index stops duplicates. The button disables while saving.
- Session expired: API returns 401, the app keeps the form state and shows the login dialog.
- Email bounces: NOTIFICATION becomes failed after 3 tries and shows on the dashboard. The assignment still exists and is visible in the app.

---

## Flow 2. Evening before (Marshal, mobile)

**Steps**
1. At 6:00 PM the marshal gets an email: "Duty tomorrow: Foundation Day, Crowd control, 7:00 AM, Main gate". The button opens the app.
2. If not logged in, the login screen appears, then the assignment.
3. The assignment detail shows event, place, shift, duty type, instructions and a small static map of the location.
4. The marshal taps Acknowledge. The button turns into a green "Acknowledged" label.

**Screens:** M-Login, M-Assignment detail.

**API:** `GET /api/me/assignments/{id}`, `POST /api/me/assignments/{id}/acknowledge`.

**Permission:** `assignments.own` plus ownership.

**Written:** ASSIGNMENT (status acknowledged, acknowledged_at), AUDIT_LOG is not needed for acknowledge (low risk), NOTIFICATION (reminder marked sent).

**What can go wrong**
- No signal: the page shows "You're offline. Acknowledge will be sent when you reconnect." The action is retried when the browser fires `online`.
- Assignment cancelled since the email: the page shows "This duty was cancelled" instead of the button.
- Email link opened on another phone: works, because it is just a link to the app plus a normal login.

---

## Flow 3. Start of shift (Marshal, mobile)

**Steps**
1. Within 15 minutes of shift start, My assignments shows the duty at the top with a big Start duty button.
2. First time only: the location consent screen. The marshal agrees.
3. The browser asks for location permission. The marshal allows it.
4. The app requests a screen Wake Lock, starts `watchPosition`, and shows a fixed banner: "Location is being shared with DRRMO. Keep this page open."
5. Pings go out every 30 seconds.

**Screens:** M-My assignments, M-Location consent, M-Assignment detail (on duty state).

**API:** `POST /api/consents` (purpose location_tracking), `POST /api/me/assignments/{id}/start-duty`, `POST /api/me/assignments/{id}/pings`.

**Permission:** `assignments.own`, `location.send_own`, active volunteer status, location consent.

**Written:** CONSENT_RECORD, ASSIGNMENT (on_duty, duty_started_at), LOCATION_PING.

**What can go wrong**
- GPS permission denied: duty still starts (the person is present), the banner turns amber "Location is off", and the admin map lists them under "No location". Help text explains how to enable location in Chrome and Safari.
- Wake Lock not supported or refused: banner adds "Your screen may turn off. Keep the app open."
- Tapping Start duty too early (more than 15 minutes before): button disabled with the time it becomes active.
- Volunteer was set inactive after assignment: start is blocked with "Your status is inactive. Contact DRRMO."
- Weak signal: points pile up in the local queue and upload later. The banner shows "3 updates waiting to send".

---

## Flow 4. During the shift (Admin, desktop)

**Steps**
1. Admin opens Live map. It loads satellite imagery centred on the campus.
2. Each on-duty person is a pin with name, duty and "last seen 40 s ago". Pins older than 5 minutes turn grey. A side list shows "Not pinged in 5 min" and "No location".
3. The map refreshes every 30 seconds.
4. Admin clicks a person to see their trail for this shift.
5. Admin switches to the Report feed.

**Screens:** A-Live map, A-Report feed.

**API:** `GET /api/map/latest?event_id=` (polled), `GET /api/map/trail/{assignment}`, `GET /api/reports`.

**Permission:** `location.view`, `reports.view`.

**Written:** AUDIT_LOG (one row per map load and trail view; polling refreshes are grouped into one row per 10 minutes per admin to avoid noise).

**What can go wrong**
- Tile provider down or key missing: switch to the OSM layer automatically and show a note.
- Admin on a phone: the map works in a simple full-screen view.
- A person granted `location.view` after the grant ends: API returns 403, the page explains the access has ended.

---

## Flow 5. Every 2 hours (Designated reporter, mobile)

**Steps**
1. Fifteen minutes before a slot is due, the reporter gets an email and, if the app is open, an in-app banner "Site report due at 11:00 AM".
2. They open Report form, type a short summary ("Crowd steady at gate 2, one minor injury handled by ERT"), optionally take a photo.
3. They submit. The slot shows as submitted.
4. The director sees it at the top of the Report feed.

**Screens:** M-Report slots and form, A-Report feed.

**API:** `GET /api/me/report-slots`, `POST /api/me/report-slots/{id}` (multipart).

**Permission:** `reports.submit` grant for this event, plus ownership of the slot's assignment.

**Written:** SITE_REPORT (summary, photo_path, submitted_at, status), NOTIFICATION (reminder), and if late: NOTIFICATION (overdue alert to admins).

**What can go wrong**
- No signal at submit: the form saves a draft locally and retries. The summary is never lost.
- Photo too large: the phone resizes it before upload. If upload still fails, the summary can be sent without the photo.
- Double submit: the second request finds the slot already submitted and returns the existing report.
- Missed slot: after due + 15 minutes the slot becomes overdue and admins get an alert. The reporter can still submit, and it is marked late.
- Grant ended mid-shift: no new slots are created. Existing pending slots stay submittable until their due time.

---

## Flow 6. Anytime (Everyone, mobile)

**Steps**
1. The person opens Memos and types "fire drill procedure".
2. Results show while typing (after 2 characters, 300 ms debounce). Category chips filter results.
3. They tap a memo. The text shows inline, or the PDF opens in the phone's viewer.

**Screens:** M-Memo search, M-Memo viewer.

**API:** `GET /api/memos?q=fire drill&category=`, `GET /api/memos/{id}`, `GET /api/memos/{id}/file`.

**Permission:** `memos.view`.

**Written:** nothing.

**What can go wrong**
- Typos ("fire dril"): search uses MySQL FULLTEXT in boolean mode with prefix matching, then falls back to `LIKE` on title words. Results are ranked with title matches first.
- Large PDF on weak data: the list shows file size before opening.
- No results: show the categories and "Ask DRRMO" which opens Messages.

---

## Flow 7. End of shift (Marshal, mobile)

**Steps**
1. The marshal taps End duty and confirms.
2. The app sends any queued pings, stops `watchPosition`, releases the Wake Lock and hides the banner.
3. The assignment shows Completed.

**Screens:** M-Assignment detail.

**API:** `POST /api/me/assignments/{id}/pings` (flush), `POST /api/me/assignments/{id}/end-duty`.

**Permission:** `assignments.own`.

**Written:** ASSIGNMENT (completed, duty_ended_at), LOCATION_PING (last points).

**What can go wrong**
- Forgot to tap End duty: `monitoring:auto-end-duty` ends it 30 minutes after shift end and marks it completed.
- Offline at end: the end action is queued with the pings and sent on reconnect. Pings captured after the tap are discarded on the phone.
- Phone died during the shift: the map shows the last ping. Auto end still runs.

---

## Flow 8. Changes (Admin, desktop)

**Steps**
1. Admin opens the event and changes a shift time, or cancels one person's assignment with a reason.
2. The system emails the affected person: "Your duty changed" or "Your duty was cancelled".

**Screens:** A-Event detail, A-Assignment editor.

**API:** `PATCH /api/requirements/{id}`, `PATCH /api/assignments/{id}`, `POST /api/assignments/{id}/cancel`.

**Permission:** `assignments.manage`, `events.manage`.

**Written:** EVENT_DUTY_REQUIREMENT or ASSIGNMENT (cancelled_at, cancel_reason), NOTIFICATION, AUDIT_LOG (with before and after values).

**What can go wrong**
- Shift time change creates an overlap for someone already assigned: the save shows the conflict list and asks for confirmation.
- Cancelling someone who is on duty: blocked. They must end duty first, or the admin uses "End duty for this person", which is audited.
- Reminder already queued for the old time: the reminder job re-checks the assignment before sending, so stale reminders are skipped.

---

## Flow 9. Volunteer availability (Admin, desktop)

**Steps**
1. Admin opens People, filters Volunteers, and flips the Active switch for one person.
2. A dialog asks for a reason ("Exam week"). Saves.
3. The volunteer no longer appears in candidate lists.

**Screens:** A-People list, A-Person profile.

**API:** `PATCH /api/people/{user}/status`.

**Permission:** `volunteers.toggle`.

**Written:** USER (status), VOLUNTEER_STATUS_LOG (old, new, reason, changed_by, changed_at), AUDIT_LOG.

**What can go wrong**
- The volunteer has future assignments: the dialog lists them and offers "Cancel these assignments too" (each cancellation emails them). Default is to keep them and show a warning on the event.
- Volunteer is on duty right now: the change is allowed, but the current shift is not interrupted.

---

## Flow 10. Exceptional access (Admin, desktop)

**Steps**
1. Admin opens Access control, Temporary access, and clicks Give access.
2. Picks the person, the permission (`reports.submit`), the event, start and end time, and a reason ("Designated reporter, gate 2").
3. Saves. The person sees the Reports tab during the grant window.

**Screens:** A-Temporary access.

**API:** `POST /api/grants`, `POST /api/grants/{id}/revoke`.

**Permission:** `access.manage`.

**Written:** PERMISSION_GRANT, AUDIT_LOG, NOTIFICATION (optional email "You are the site reporter for ...").

**What can go wrong**
- End before start, or `reports.submit` without an event: validation error.
- `location.view` longer than 7 days: validation error.
- Person has no assignment in that event: warning "This person cannot submit reports until assigned". Allowed, because the assignment may come later.
- Grant expires mid-session: the next API call is refused and the tab disappears after the next `/api/me` refresh (every 5 minutes or on navigation).

---

## Flow 11. Roles and permissions (Admin, desktop)

**Steps**
1. Admin opens Access control, Roles, and clicks New role.
2. Names it ("Records officer"), adds a short description and picks what it starts with: the basics, or a copy of another role.
3. On the role's Permissions tab the admin turns on "View audit log" and "Export lists", then presses Save changes in the save bar.
4. On the People tab the admin clicks Add people, picks one or more people and moves them into the role.
5. To compare roles, the admin opens Permission matrix, ticks boxes across several roles and saves once.
6. The people in the role see the new screens the next time their app loads.

**Screens:** A-Roles, A-Role detail, A-Permission matrix. The person sees M-My access.

**API:** `POST /api/roles`, `PUT /api/roles/permissions`, `POST /api/roles/{role}/members`, `PATCH /api/roles/{role}`, `DELETE /api/roles/{role}`.

**Permission:** `access.manage` (Admin only, never granted).

**Written:** ROLE, ROLE_PERMISSION, USER (role_id, through Personnel), AUDIT_LOG.

**What can go wrong**
- A locked cell is sent anyway (for example the map for Marshal): the whole save is refused and nothing changes.
- Two roles with the same name: validation error.
- Deleting a custom role that people still hold: refused until they are moved.
- The admin tries to move themselves: refused, so nobody locks themselves out.
- A person with `people.manage` but not `audit.view` tries to give someone the Records officer role: 403.
