# Database

MySQL 8, InnoDB, utf8mb4. Times are stored in UTC and shown in Asia/Manila. All tables use `id` bigint unsigned auto increment unless noted.

## Public codes

Records that people open also have a `public_code`: 16 random lower case letters and digits, starting with a letter, unique in its table. URLs, query strings, request bodies and API answers use this code. Primary keys and foreign keys stay as integers and stay inside the server. A record number in a URL answers 404.

Tables with a code: roles, permission_grants, users, departments, emergency_contacts, duty_types, campus_locations, events, event_duty_requirements, assignments, site_reports, emergency_reports, notifications, push_subscriptions and memos. Teams and event types already use a readable `code`. Messages have none, because a chat is opened by the person's code.

A model gets this with the `App\Support\HasPublicCode` trait. A request turns codes back into ids with `App\Support\PublicCode::toId`. A migration adds the column and fills old rows with `App\Support\PublicCodeColumn`.

## 1. Gaps found in the brief's data model

The 20 tables in the original brief covered the flows, but several flows had nowhere to store their data. The owner approved the fixes below and all of them are built. The table is kept as the reason behind each column. The system has grown since then: section 2 lists all 27 domain tables, including the ones added after the brief (teams, event_types, emergency_reports, report_reviewers, push_subscriptions, alert_preferences and refresh_tokens).

| # | Table | Gap | Proposed fix |
|---|---|---|---|
| G1 | ASSIGNMENT | No place for acknowledge time, duty start and end, cancel reason, or the reason for a headcount override | Add `acknowledged_at`, `duty_started_at`, `duty_ended_at`, `cancelled_at`, `cancel_reason`, `override_reason`, `updated_at` |
| G2 | USER | No password, login or account disable fields. `status` mixes "volunteer on call" with "account enabled" | Add `password`, `remember_token`, `email_verified_at`, `last_login_at`, `disabled_at`. Keep `status` (active, inactive) for on-call availability only |
| G3 | USER and ROLE | The brief asks for an enum-cast role but also a ROLE table with `role_id` | Keep `role_id` and the ROLE table (needed for ROLE_PERMISSION). Add a unique `code` column to ROLE (`admin`, `marshal`, `volunteer`, `coordinator`) and a PHP `Role` enum. `User::role()` returns the enum. |
| G4 | EVENT | Coordinators must see "event notices relevant to their department", but EVENT has no department link | Add nullable `department_id` (null means campus wide), plus `description` and `created_by` |
| G5 | EVENT_DUTY_REQUIREMENT | A requirement can need a specific team (for example Fire Suppression) | Add nullable `team_needed` |
| G6 | SITE_REPORT | No status, so "overdue" cannot be stored. Designation is stored in PERMISSION_GRANT (event scoped), which works | Add `status` (pending, submitted, overdue, late, and later `missed`), `unique(assignment_id, due_at)` |
| G7 | NOTIFICATION | Only `assignment_id`, but report reminders, overdue alerts and welcome emails also exist. No recipient, no error or retry info | Add `user_id` (recipient), nullable `site_report_id`, `channel` (email, and later `in_app` and `push`), `scheduled_for`, `attempts`, `last_error`, `created_at`. Keep `assignment_id` nullable |
| G8 | LOCATION_PING | No accuracy or server time | Add `accuracy_m` (smallint), `received_at` |
| G9 | AUDIT_LOG | Cannot tell which record or what changed | Add `entity_id`, `meta` (JSON, before and after for changes), `ip_address` |
| G10 | CONSENT_RECORD | Location consent is separate from the privacy notice, and consent can be withdrawn | Add `purpose` (privacy_notice, location_tracking), `withdrawn_at`, `ip_address` |
| G11 | MESSAGE | No read status. Coordinators write to "DRRMO", not to one admin | Add `read_at`. `recipient_id` null means the DRRMO office inbox, which every admin can read and answer |
| G12 | MEMO | Admin can "write" a memo, but there is no body. No edit or delete tracking | Add `body` (text, nullable), make `file_path` nullable, add `updated_at`, `deleted_at` (soft delete) |
| G13 | VOLUNTEER_STATUS_LOG | Does not store who made the change | Add `changed_by` |
| G14 | PERMISSION_GRANT | Grants cannot be ended early | Add `revoked_at`, `revoked_by` |

## 2. Diagram

27 domain tables. Laravel's own tables (cache, jobs, failed_jobs, sessions, password_reset_tokens) are left out. A dotted line is a link by code or by a plain id column, with no database foreign key: `users.team` points at `teams.code`, `events.event_type` at `event_types.code`, and `notifications.emergency_report_id` is a plain column because Notifications does not own emergency reports.

```mermaid
erDiagram
    DEPARTMENT |o--o{ USER : has
    ROLE ||--o{ USER : has
    TEAM |o..o{ USER : "by code"
    USER ||--o{ EMERGENCY_CONTACT : lists
    USER ||--o{ VOLUNTEER_STATUS_LOG : has
    USER ||--o{ REFRESH_TOKEN : signs_in_with
    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : in
    USER ||--o{ PERMISSION_GRANT : receives
    PERMISSION ||--o{ PERMISSION_GRANT : for
    EVENT |o--o{ PERMISSION_GRANT : scopes
    CAMPUS_LOCATION ||--o{ EVENT : hosts
    DEPARTMENT |o--o{ EVENT : concerns
    EVENT_TYPE |o..o{ EVENT : "by code"
    EVENT ||--o{ EVENT_DUTY_REQUIREMENT : needs
    DUTY_TYPE ||--o{ EVENT_DUTY_REQUIREMENT : typed
    EVENT ||--o{ ASSIGNMENT : has
    DUTY_TYPE ||--o{ ASSIGNMENT : typed
    EVENT_DUTY_REQUIREMENT |o--o{ ASSIGNMENT : filled_by
    USER ||--o{ ASSIGNMENT : works
    ASSIGNMENT ||--o{ LOCATION_PING : records
    ASSIGNMENT ||--o{ SITE_REPORT : has
    ASSIGNMENT ||--o{ EMERGENCY_REPORT : raises
    EVENT ||--o{ EMERGENCY_REPORT : during
    USER ||--o{ EMERGENCY_REPORT : sends
    USER |o--o| REPORT_REVIEWER : is
    ASSIGNMENT |o--o{ NOTIFICATION : triggers
    SITE_REPORT |o--o{ NOTIFICATION : triggers
    EMERGENCY_REPORT |o..o{ NOTIFICATION : "by id"
    USER ||--o{ NOTIFICATION : receives
    USER |o--o{ NOTIFICATION : "is about"
    USER ||--o{ PUSH_SUBSCRIPTION : registers
    USER ||--o| ALERT_PREFERENCE : sets
    USER |o--o{ MEMO : posts
    USER ||--o{ MESSAGE : sends
    USER |o--o{ MESSAGE : receives
    USER |o--o{ AUDIT_LOG : acts
    USER ||--o{ CONSENT_RECORD : gives
```

## 3. Migration order

Each module gets a fixed timestamp prefix so parallel sessions never collide and order is always correct. New migrations inside a module use the next free number in its range.

| Order | Prefix | Module | Tables |
|---|---|---|---|
| 0 | `0001_01_01_*` | Core | Laravel defaults: cache, jobs, failed_jobs, sessions, password_reset_tokens |
| 1 | `2026_01_01_1000xx` | Access | roles, permissions, role_permission, and `100004` adds `description` and `is_system` to roles (custom roles have `is_system` false), and `100005` adds `public_code` |
| 2 | `2026_01_01_2000xx` | Personnel | departments, users (FK roles, departments), emergency_contacts, volunteer_status_logs, `200005` adds the sign up columns to users (account_status, email code fields, reviewed_by, reviewed_at, rejection_reason), `200006` replaces `users.name` with `first_name` and `last_name`, and `200007` adds teams (with the three starting teams) and an `active` flag on departments. `200008` adds `public_code` |
| 3 | `2026_01_01_3000xx` | Events | duty_types, campus_locations, events, event_types, event_duty_requirements, assignments. Later files add `event_type` to events, `active` to campus_locations and duty_types, and the status, cancel and duty time columns to assignments. `300010` adds `public_code` |
| 4 | `2026_01_01_3500xx` | Access | refresh_tokens (needs users), permission_grants (needs events). Both are owned by Access, though refresh_tokens is used by the login code in Core. `350003` adds `public_code` to permission_grants |
| 5 | `2026_01_01_4000xx` | Monitoring | location_pings, site_reports, emergency_reports, report_reviewers. `400004` adds `missed_at` to site_reports and `reminded_at` to emergency_reports. `400006` adds `public_code` to site_reports and emergency_reports |
| 6 | `2026_01_01_5000xx` | Notifications | notifications (needs assignments), `500002` subject_user_id, `500003` site_report_id, `500004` emergency_report_id and read_at (in app alerts), `500005` push_subscriptions (one row for each device, unique on a hash of the endpoint), `500006` alert_preferences (mute and quiet hours for each person), `500007` adds `public_code` to notifications and push_subscriptions |
| 7 | `2026_01_01_6000xx` | Information | memos (`600002` adds the PDF preview columns), messages (`600004` adds `is_direct`), `600005` adds `public_code` to memos |
| 8 | `2026_01_01_7000xx` | Records | audit_logs, consent_records |

Laravel's default `users` migration is replaced by the Personnel version. The default `sessions` table keeps its `user_id` column without a foreign key.

Foreign key rules: `restrict` on delete for people and events (we soft-close, not delete). `cascade` for child rows that mean nothing alone: emergency contacts, role_permission, location_pings and site_reports of a deleted assignment. Actor columns (`assigned_by`, `granted_by`, `posted_by`, `actor_id`, `changed_by`) use `nullOnDelete` so history survives.

## 4. Indexes

| Table | Index | Why |
|---|---|---|
| every table with a public code | unique(public_code) | routes find a record by its code |
| users | unique(email), (role_id, status), (department_id), (account_status, created_at) | login, assignable list, access requests list |
| permission_grants | (user_id, permission_id, ends_at), (event_id) | permission check runs on most requests |
| role_permission | unique(role_id, permission_id) | no duplicates |
| events | (starts_at), (status), (department_id) | dashboard, coordinator notices |
| event_duty_requirements | (event_id), (shift_starts_at, shift_ends_at) | overlap checks, scheduler |
| assignments | unique(event_id, user_id), (user_id, status), (requirement_id, status) | one duty for each person in an event, my assignments, headcount |
| location_pings | (assignment_id, captured_at), (captured_at) | latest ping per person, retention purge |
| site_reports | unique(assignment_id, due_at), (status, due_at) | idempotent slots, overdue scan, feed |
| report_reviewers | unique(user_id) | at most 2 global reviewer marshals |
| emergency_reports | unique(user_id, client_id), (status, created_at), event_id | a queued report sent twice saves once, escalation scan, inbox |
| notifications | (status, scheduled_for), (user_id, type), (assignment_id), (user_id, channel, read_at) | queue scan, dedupe, unread in app alerts |
| memos | FULLTEXT(title, body), (category, posted_at) | search |
| messages | (recipient_id, read_at), (sender_id, sent_at), (recipient_id, sender_id, is_direct) | inbox, threads, direct chats |
| audit_logs | (actor_id, created_at), (entity, entity_id), (action, created_at) | audit filters |
| consent_records | (user_id, purpose, consented_at) | consent check |
| refresh_tokens | unique(token_hash), (family_id), (user_id, revoked_at) | rotation, revoke a whole sign in, sign out everywhere |
| push_subscriptions | unique(endpoint_hash), (user_id) | one row for each device, find a person's devices |
| volunteer_status_logs | (user_id, created_at) | status history |

Two notes on columns. MEMO has `preview_path` and `preview_status` (pending, ready, failed) for the PDF copy of a Word file (migration `2026_01_01_600002`). MESSAGE has `is_direct` (boolean, migration `2026_01_01_600004`): false means a message to or from the DRRMO office, true means a private person to person message, which the office inbox never lists.

Overlap check for one person: two shifts overlap when `a.shift_start < b.shift_end AND b.shift_start < a.shift_end`, excluding cancelled assignments.

Latest ping per person for the map, which the `(assignment_id, captured_at)` index serves:

```sql
SELECT p.*
FROM location_pings p
JOIN (
  SELECT assignment_id, MAX(captured_at) AS last_at
  FROM location_pings
  WHERE assignment_id IN (/* on_duty assignments */)
  GROUP BY assignment_id
) x ON x.assignment_id = p.assignment_id AND x.last_at = p.captured_at;
```

## 5. Keeping LOCATION_PING healthy

- Worst case about 58,000 rows a day. Ten working days stays under 600,000 rows. MySQL handles this without partitioning.
- `monitoring:purge-pings` runs at 02:00, computes the cutoff as "10 working days ago" (counting back Monday to Friday), and deletes in chunks of 5,000 rows with a short pause between chunks so the table is never locked for long.
- No foreign key from location_pings to other modules except `assignment_id`, and no secondary indexes beyond the two above. Fewer indexes keep inserts cheap.
- Inserts arrive in batches of up to 50 rows per request, using one multi-row `INSERT`.
- If the table ever grows past a few million rows, monthly partitioning by `captured_at` is the next step. It is not needed at this size.

## 6. Seeders

`php artisan db:seed` runs `DatabaseSeeder`, which calls PermissionSeeder (roles and permissions, built from `PermissionMatrix`), DutyTypeSeeder and CampusLocationSeeder.

| Seeder | Content | Runs in production |
|---|---|---|
| RoleSeeder | admin, marshal, volunteer, coordinator | yes, through PermissionSeeder |
| PermissionSeeder | every permission code in SECURITY_AND_PRIVACY.md and the role matrix | yes |
| DutyTypeSeeder | Emergency responder, Auxiliary to campus security, CCTV monitoring and surveillance, Enforcement of campus policies, Crowd control, Office work, Fire suppression | yes |
| CampusLocationSeeder | ZPPSU main campus center (6.91212, 122.05909) plus placeholder rows for the gym, main gate, field and admin building. Coordinates to be confirmed on the map by DRRMO. | yes |
| OrgUnitSeeder | Starting teams (ERT, Security team, Fire suppression, Crowd control, First aid and medical, CCTV monitoring) and placeholder departments. Only adds what is missing. Replace the department list with the real one after review. | after review |
| DemoSeeder | Four fake people (admin, marshal, volunteer, coordinator, `@example.test` emails, password `password`) plus OrgUnitSeeder. It refuses to run in production. | local and staging only |

There is no seeder for the first production admin yet. `.env.example` has `SEED_ADMIN_EMAIL` and DEPLOYMENT.md mentions a `ProductionSeeder`, but neither exists in the code. This belongs to story S6.5 (production deployment).

No real personal data goes into seeders, fixtures or tests.
