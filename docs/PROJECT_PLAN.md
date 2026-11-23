# Project Plan

ZPPSU DRRMO Personnel Event Assignment and Monitoring System (working name: DRRMO EAMS).

## 1. Goal

Replace hand-made duty lists and chat reminders with one small web app. The DRRMO plans events, assigns Marshals and Volunteers, and the system tells people, reminds them, collects site reports and shows approximate positions on a campus map. Everything stays inside the rules of the Data Privacy Act (RA 10173).

Success looks like this:

- An admin can staff an event in under 10 minutes, and the system catches double bookings and inactive volunteers.
- Every assigned person gets an email and can see their duty on a phone without help.
- The director reads all site reports for an event in one feed.
- Nobody but the admin (and people the admin explicitly grants) can see anyone's location.

## 2. Scope

In scope, mapped to the stages:

| Stage | What we build |
|---|---|
| 1. Register personnel | People records, departments, emergency contacts, volunteer active/inactive toggle with history, privacy consent on first login |
| 2. Control access | Fixed role permissions, time-limited extra grants (optionally tied to one event), policy on every endpoint |
| 3. Plan and assign | Events, duty requirements, assignments, conflict and headcount checks |
| 4. Notify | Queued emails for assignment changes, shift reminders, report reminders and overdue alerts, with a send log |
| 5. Monitor on duty | Start and end duty, location pings every 30 seconds while the page is open, admin map, 2-hourly site reports, report feed |
| 6. Share information | Memo and policy library with search, simple direct messages with DRRMO |
| 7. Keep records | Audit log, consent records, retention jobs, a data export for each person |
| 8. Alert fast | Emergency reports from people on duty, two reviewer marshals, in app and push alerts with sound, mute and quiet hours |

## 3. Out of scope

- Guards, Staff and OJT student roles, and QR attendance (dropped from the earlier scope, confirmed).
- SMS. Email only for now (see section 6).
- Native mobile apps and background location tracking. The web app reads GPS only while the page is open.
- Real-time map. The map refreshes every 30 to 60 seconds.
- Group chat, file sharing beyond memos and report photos, payroll, attendance sheets.
- Integration with other university systems.

## 4. Answers and assumptions

Answers from the project owner (5 Nov 2026):

| Question | Answer | How the plan reads it |
|---|---|---|
| Old scope (Guards, Staff, OJT, QR) | Dropped | Not planned at all |
| Coordinators in the field, map access | "No / have the option for that" | Coordinators get no field assignments. The map stays admin only by default, but the admin can grant map access to a specific person for a limited time through a permission grant. Every map view is audited. |
| SMS | Email only, unless a totally free SMS API exists | No reliable free SMS API was found (Semaphore, a common PH gateway, lists PHP 0.56 per text). Email only. The notification table has a channel column so SMS can be added later. |
| Hosting | Free hosting | Oracle Cloud Always Free VM as the default, school server as plan B. Both documented. |
| Ping retention | 10 working days | Pings older than 10 working days (Monday to Friday) are deleted every night. Public holidays are not skipped in version 1. |
| Data protection officer | There is none | See risk R5. The law requires one, so this is flagged as an open decision. |

Assumptions (please correct any that are wrong):

- A1. Admin and Director share one role called Admin. If the director needs a separate read-mostly role, it is a small change to the role seeder.
- A2. Assignment statuses are: assigned, acknowledged, on_duty, completed, cancelled, no_show.
- A3. Reminders go out at 6:00 PM the evening before a shift and 1 hour before it starts.
- A4. Site report slots are due every 2 hours from shift start. A shift shorter than 2 hours gets one slot due at shift end. A slot becomes overdue 15 minutes after its due time and is closed as missed after 60 minutes.
- A5. The designated site reporter must also hold an assignment in that event.
- A6. One person has exactly one role. Teams are Security (Crowd Control), ERT and Fire Suppression. Admins and Coordinators have no team.
- A7. Admins create accounts and people get an email to set their password. Volunteers can also ask for an account on the public Request access page. They confirm their email with a 6 digit code and an admin approves before the account works.
- A8. Time zone is Asia/Manila for everything.
- A9. A free domain name is available (school subdomain preferred, DuckDNS as a fallback). HTTPS needs one.

## 5. Risks

| ID | Risk | Effect | What we do about it |
|---|---|---|---|
| R1 | GPS only works while the page is open and the screen is on | Gaps in the map when a marshal locks the phone | Screen Wake Lock API keeps the screen on during duty (supported in Chrome 84+, Safari and iOS Safari 16.4+, Firefox 126+ per caniuse). The map shows "last seen" time and flags people with no ping in 5 minutes. We say clearly in the app and the docs that the map is approximate. |
| R2 | Weak campus mobile signal | Pings and reports fail to send | Pings are stored on the phone and sent in batches when the connection returns. Report form keeps a local draft. Small payloads, compressed photos. |
| R3 | Oracle Always Free limits | VM can be reclaimed if idle (95th percentile CPU, network and memory under 20% over 7 days), A1 shapes can be "out of host capacity", free resources only exist in the home region chosen at sign-up | Pick the home region carefully at sign-up. Retry other availability domains or later if out of capacity. Consider upgrading the account to Pay As You Go, which Oracle says keeps Always Free resources free (a card is needed). Nightly off-site backups. School server stays ready as plan B. |
| R4 | Free email limits | Brevo free tier is about 300 emails a day (third-party review, July 2026, confirm on the Brevo pricing page) | One busy day with 30 assignees is about 100 emails. The app counts sends per day and warns the admin near the limit. A second SMTP account can be configured as fallback. Everything an email says is also visible in the app. |
| R5 | No data protection officer | NPC Advisory 2017-01 says each government agency "shall designate a DPO". Running a system that tracks location without one is a compliance gap. | Ask the university for its existing DPO. The NPC advisory allows a Compliance Officer for Privacy (COP) for a sub-unit under the DPO, so the DRRMO head could act as COP. The system has a configurable "privacy contact" shown in the privacy notice. |
| R6 | Location data misuse | Privacy complaint, loss of trust | Admin only by default, grants are time limited, every view is audited, 10 working day retention, purpose stated in the notice. |
| R7 | Tile provider terms | Esri says World Imagery is meant to be used with an ArcGIS account, and direct use of the public tile URL is a grey area | Use an ArcGIS Location Platform API key on its free tier, or fall back to OpenStreetMap. Show the required attribution. See ARCHITECTURE.md section 8. |
| R8 | One developer, student timeline | Delays | Walking skeleton first, strict scope, modules that can be built in parallel. |
| R9 | XAMPP still ships PHP 8.2 | Laravel 13 needs PHP 8.3, so XAMPP cannot run it | Local default is Laravel Sail on Windows with WSL2 (see README). |

## 6. Notes on choices made during planning

- SMS: no provider offered genuinely free, ongoing SMS for the Philippines. Revisit if the school gets SMS credits.
- Email: Brevo free is the default (largest free daily cap among the options checked). Mailjet (200 a day), SMTP2GO (200 a day, 1,000 a month) and Resend (100 a day) are smaller. Gmail SMTP with an app password works for testing but is not recommended for production.
- Laravel 13 needs PHP 8.3 or newer (confirmed in the Laravel 13 release notes, March 2026). The project was created with Laravel 13 on PHP 8.3.

## 7. Roadmap

Effort is in developer days for one developer. With two or three people working on separate modules, M2 to M5 can overlap and the total drops to roughly 5 to 6 weeks.

| Milestone | Content | Effort |
|---|---|---|
| M0 Foundations | Repo, CI, quality tools, layouts, login, seeders | 3 days |
| M1 Walking skeleton | Admin creates an event, adds one requirement, assigns one person. The person logs in on a phone and sees it. | 5 days |
| M2 Personnel and Access | People CRUD and CSV import, emergency contacts, volunteer toggle and history, consent flow, permission matrix, grants | 7 days |
| M3 Assignments and Notifications | Conflict and headcount checks, acknowledge, emails on change, reminders, notification log | 7 days |
| M4 Monitoring | Start and end duty, Wake Lock, pings with offline queue, admin map, report slots, report form with photo, overdue alerts, report feed | 10 days |
| M5 Information | Memo library and search, memo manager, messages | 5 days |
| M6 Records and launch | Audit viewer, retention jobs, data export for data subjects, PWA, deployment, backups, user testing with real marshals | 8 days |
| M7 Push alerts | Emergency reports, push notifications, in app sound and vibration, mute and quiet hours (added after the first plan) | built |
| Total | | about 45 days for M0 to M6, or 9 weeks full time |

Milestone exit rule: every story in the milestone meets the Definition of Done in CONTRIBUTING.md and the milestone demo works on a real phone over HTTPS.
