# Data Dictionary

Filled in per milestone. See ../../DOCUMENTATION_GUIDE.md. Types are shown as Laravel column types.

## M0 tables

### roles (Access)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| code | string(32) | unique. Built-in: admin, marshal, volunteer, coordinator. Custom roles get a code made from the name, for example `records_officer` |
| name | string(64) | display name, unique |
| description | string(255), nullable | who gets the role |
| is_system | boolean | true for the four built-in roles, which cannot be renamed or deleted |

### permissions (Access)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| code | string(64) | unique, for example `location.view` |
| description | string | what it allows |
| grantable | boolean | true when the admin may grant it for a limited time |

### role_permission (Access)
| Column | Type | Notes |
|---|---|---|
| role_id | foreign key | cascade on delete |
| permission_id | foreign key | cascade on delete, unique with role_id |

### departments (Personnel)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| name | string | unique |
| active | boolean | default true. A switched off department stays on old records but cannot be picked for new ones |

### users (Personnel)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| first_name | string(100) | required |
| last_name | string(100) | required. A dash means the person gave one word only (see the name split in DEV_LOG) |
| email | string | unique, used to log in |
| contact_number | string(32) | optional |
| role_id | foreign key | restrict on delete |
| department_id | foreign key | optional, restrict on delete |
| team | string(32) | optional. Matches `teams.code` (no foreign key) |
| status | string(16) | on-call availability: active or inactive |
| account_status | string(20) | sign up state: pending_email, pending_approval, active (default) or rejected. Only active accounts can sign in |
| password | string | hashed |
| email_verified_at, last_login_at, disabled_at | timestamp | optional. `disabled_at` blocks login |
| verification_code_hash | string(64) | HMAC of the 6 digit email code. The code itself is never stored. Cleared once used |
| verification_expires_at, verification_sent_at | timestamp | optional. A code works for 10 minutes. A new one can be sent after 60 seconds |
| verification_attempts | tinyint | wrong tries for the current code. At 5 the code is locked until a new one is sent |
| reviewed_by | foreign key | optional, the admin who approved or rejected the request. Set null on delete |
| reviewed_at | timestamp | optional |
| rejection_reason | string(500) | optional, the reason given when a request is rejected |

### emergency_contacts (Personnel)
| Column | Type | Notes |
|---|---|---|
| user_id | foreign key | cascade on delete |
| name, relationship, phone | string | |

### volunteer_status_logs (Personnel)
| Column | Type | Notes |
|---|---|---|
| user_id | foreign key | restrict on delete |
| old_status, new_status | string(16) | |
| reason | string | required |
| changed_by | foreign key | optional, set to null if that user is deleted |

### audit_logs (Records)
| Column | Type | Notes |
|---|---|---|
| actor_id | foreign key | optional, null for system work |
| action | string(64) | for example `assignment.created` |
| entity, entity_id | string, bigint | what the action touched |
| meta | json | optional detail, before and after for changes |
| ip_address | string(45) | optional |
| created_at | timestamp | rows are never updated or deleted |

### consent_records (Records)
| Column | Type | Notes |
|---|---|---|
| user_id | foreign key | restrict on delete |
| purpose | string(32) | privacy_notice or location_tracking |
| notice_version | string(32) | version of the notice agreed to |
| consented_at, withdrawn_at | timestamp | withdrawn_at is empty while consent is active |
| ip_address | string(45) | optional |

## Auth tables

### refresh_tokens (Access)
One row per refresh token. A family is one sign in on one device; every refresh adds a row to the same family. The token itself is never stored.

| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| user_id | foreign key | users, cascade on delete |
| token_hash | char(64) | SHA-256 of the token, unique |
| family_id | uuid | indexed. Reuse of an old token revokes the whole family |
| expires_at | timestamp | 7 days after it was issued |
| used_at | timestamp, nullable | set when it is swapped for the next token |
| revoked_at | timestamp, nullable | set at logout, on reuse, on password reset or when the account is disabled |
| ip_address | string(45), nullable | where it was issued |
| user_agent | string(255), nullable | browser that received it |
| created_at, updated_at | timestamps | |

Index: (user_id, revoked_at) to revoke all of a user's tokens quickly.

## People lists

### teams (Personnel)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| code | string(32) | unique. `users.team` points at it. Starting codes: ert, security, fire_suppression |
| name | string(100) | unique, display name |
| active | boolean | default true |

## Events tables

### duty_types (Events)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| name | string | unique. What a person does at an event, for example Crowd control |

### campus_locations (Events)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| name | string | unique |
| latitude, longitude | decimal(9,6) | map pin |
| active | boolean | default true |

### event_types (Events)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| code | string(32) | unique. `events.event_type` points at it. Starting codes: academic, ceremony, sports, cultural, drill, other |
| name | string(100) | unique |
| active | boolean | default true |

### events (Events)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| title | string | |
| description | text, nullable | |
| event_type | string(32) | default `other`. Matches `event_types.code` |
| campus_location_id | foreign key | restrict on delete |
| department_id | foreign key, nullable | null means campus wide. Restrict on delete |
| starts_at, ends_at | datetime | stored in UTC |
| status | string(16) | default `draft` (then published, cancelled or completed) |
| created_by | foreign key, nullable | users, set null on delete |

Indexes: starts_at, status.

### event_duty_requirements (Events)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| event_id | foreign key | restrict on delete |
| duty_type_id | foreign key | restrict on delete |
| role | string(20) | marshal or volunteer |
| team_needed | string(100), nullable | the team the person must be in, or empty for any team |
| headcount | smallint | people needed |
| shift_starts_at, shift_ends_at | datetime | |
| instructions | text, nullable | shown to the person on their duty |

### assignments (Events)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| event_id | foreign key | restrict on delete. Unique together with user_id |
| user_id | foreign key | the person. Restrict on delete |
| requirement_id | foreign key, nullable | the requirement this fills. Restrict on delete |
| duty_type_id | foreign key | restrict on delete |
| status | string(20) | assigned, acknowledged, on_duty, completed, cancelled, no_show |
| acknowledged_at, duty_started_at, duty_ended_at, cancelled_at | datetime, nullable | |
| cancel_reason, override_reason | string(500), nullable | why it was cancelled, or why the headcount was exceeded |
| assigned_by | foreign key, nullable | users, set null on delete |

Indexes: unique(event_id, user_id), (user_id, status), (requirement_id, status).

## Access tables

### permission_grants (Access)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| user_id | foreign key | who receives the access. Restrict on delete |
| permission_id | foreign key | restrict on delete |
| event_id | foreign key, nullable | null means not tied to one event |
| starts_at, ends_at | datetime | the grant works from start up to end |
| reason | string(255) | required |
| granted_by | foreign key, nullable | users, set null on delete |
| revoked_at | datetime, nullable | set when ended early |
| revoked_by | foreign key, nullable | users, set null on delete |

Index: (user_id, permission_id, ends_at).

## Monitoring tables

### location_pings (Monitoring)
Location data. Only admins and people with an active `location.view` grant can read it, and every view is audited. Rows older than 10 working days are deleted every night.

| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| assignment_id | foreign key | cascade on delete |
| latitude, longitude | decimal(9,6) | |
| accuracy_m | smallint, nullable | GPS accuracy in metres |
| captured_at | datetime | when the phone read the position |
| received_at | datetime | when the server got it |

Indexes: (assignment_id, captured_at), captured_at.

### site_reports (Monitoring)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| assignment_id | foreign key | cascade on delete |
| due_at | datetime | one slot for each assignment and due time (unique) |
| status | string(12) | pending, submitted, overdue, late, missed |
| summary | string(1000), nullable | |
| photo_path, photo_name | string, nullable | stored privately. Deleted after 1 year |
| submitted_at, overdue_at, missed_at | datetime, nullable | |

Index: (status, due_at).

### emergency_reports (Monitoring)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| assignment_id, event_id, user_id | foreign keys | cascade on delete |
| client_id | string(64) | made on the phone. Unique with user_id, so a report sent twice is saved once |
| type | string(12) | medical, fire, security, other |
| note | string(500), nullable | |
| photo_path, photo_name | string, nullable | |
| latitude, longitude, accuracy_m, location_captured_at | nullable | copied from the latest ping when the report is saved. Location data: admins and reviewers only |
| status | string(12) | sent, acknowledged, resolved |
| escalated_at, reminded_at | datetime, nullable | set once each |
| acknowledged_by, acknowledged_at | foreign key and datetime, nullable | |
| resolved_by, resolved_at, resolution_note | nullable | |

Indexes: unique(user_id, client_id), (status, created_at), event_id.

### report_reviewers (Monitoring)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| user_id | foreign key | unique. At most 2 active marshals, the same for every event. Cascade on delete |
| assigned_by | foreign key, nullable | the admin who chose them. Set null on delete |
| created_at | timestamp | |

## Notifications tables

### notifications (Notifications)
One row for each email, in app alert or push. It doubles as the admin send log.

| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| user_id | foreign key | the recipient. Restrict on delete |
| assignment_id | foreign key, nullable | cascade on delete |
| subject_user_id | foreign key, nullable | the person a notice is about, for example a consent withdrawal |
| site_report_id | foreign key, nullable | cascade on delete |
| emergency_report_id | bigint, nullable | plain column, not a foreign key |
| type | string(40) | for example `assignment.created`, `report.overdue`, `emergency.reported` |
| channel | string(20) | email (default), in_app or push |
| status | string(20) | queued (default), sent or failed |
| attempts | tinyint | |
| last_error | text, nullable | |
| scheduled_for, sent_at | datetime, nullable | |
| read_at | datetime, nullable | when the person read an in app alert |
| created_at | timestamp | rows older than 6 months are deleted |

Indexes: (status, scheduled_for), (user_id, type), assignment_id, (user_id, channel, read_at).

### push_subscriptions (Notifications)
One row for each device a person turned alerts on for. Personal data, included in the data export.

| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| user_id | foreign key | cascade on delete |
| endpoint_hash | char(64) | unique, hash of the endpoint |
| endpoint | text | the push service address |
| public_key, auth_token | string | from the browser, needed to encrypt the push |
| device_label | string(80), nullable | |
| last_used_at | datetime, nullable | |

### alert_preferences (Notifications)
| Column | Type | Notes |
|---|---|---|
| user_id | foreign key | primary key, cascade on delete |
| sound_muted, push_muted | boolean | default false |
| quiet_start, quiet_end | string(5), nullable | `HH:MM`. Urgent emergencies ignore quiet hours |

## Information tables

### memos (Information)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| title | string(160) | |
| category | string(24) | policy, procedure, advisory, training, other |
| body | text, nullable | a memo has a body, a file, or both |
| file_path, file_name, file_mime, file_size | nullable | random name in private storage. The original name is kept only here |
| preview_path, preview_status | nullable | PDF copy of a Word file. Status: pending, ready, failed |
| posted_by | foreign key, nullable | users, set null on delete |
| posted_at | datetime | |
| deleted_at | datetime, nullable | soft delete |

Indexes: (category, posted_at), FULLTEXT(title, body) on MySQL.

## M5 tables

### messages (Information)
| Column | Type | Notes |
|---|---|---|
| id | bigint | primary key |
| sender_id | bigint | foreign key to users, restrict on delete |
| recipient_id | bigint, nullable | foreign key to users, restrict on delete. Null means the DRRMO office inbox, which every admin can read and answer. An answer from the office names the person it is for |
| body | text | plain text, 1000 characters at most (checked by the request, not the column) |
| is_direct | boolean | false for a message to or from the DRRMO office, true for a private person to person message. Direct messages never show in the office inbox and admins cannot read them |
| sent_at | datetime | when it was sent |
| read_at | datetime, nullable | when it was opened. For a message to the office, when any admin opened it. For an answer, when the person opened it |

Indexes: (recipient_id, read_at) for the unread counts, and (sender_id, sent_at) for a person's conversation. A conversation belongs to one person: what they sent (recipient null) plus every row addressed to them. The table has no created_at or updated_at, and rows are never edited.
