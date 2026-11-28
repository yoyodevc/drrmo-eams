# API Reference

Filled in per milestone. See ../../DOCUMENTATION_GUIDE.md. All endpoints are under `/api` and send and return JSON.

Record ids in this document (`{id}`, `{event}`, `id`, `user_id`, `event_id` and so on) are public codes: random 16 character strings, not numbers. Teams and event types use their readable `code`. A number in a URL answers 404.

Auth uses two HttpOnly cookies set by the server: `drrmo_access` (a JWT, 15 minutes) and `drrmo_refresh` (7 days, rotates on every use). Page scripts never read them. Every `/api` answer carries `Cache-Control: no-store, private`, so browsers and proxies never keep it. Every POST, PUT, PATCH and DELETE must send `X-Requested-With: XMLHttpRequest` and come from an allowed origin, or it gets 403 `bad_origin`. A signed-in endpoint answers 401 when the access token is missing, expired or revoked. The app then calls `POST /api/refresh` once and retries.

## Auth (Core)

| Method and path | Who | Request | Response |
|---|---|---|---|
| `POST /api/login` | anyone | `email`, `password` | 200 with the same body as `/api/me`, and both auth cookies. 422 `invalid_credentials` for a wrong password or an unknown email, with the same message for both. 403 only after the password was verified as right, when the account cannot be used yet: `email_not_confirmed`, `awaiting_approval`, `request_rejected` or `account_disabled`, each with its own `message`. No cookies are set for a 403. 429 `too_many_attempts` after 5 tries in a minute for the same email and IP. A 403 also counts as a try |
| `POST /api/refresh` | anyone with a refresh cookie | none | 204 with new access and refresh cookies. 401 `session_ended` (and both cookies cleared) when the refresh token is missing, expired, revoked, reused or belongs to a disabled account. 429 after 30 calls in a minute from the same IP |
| `POST /api/logout` | anyone | none | 204, always, also when nobody is signed in or the access token has expired, so signing out never gets stuck. Revokes the whole refresh token family of this device, denylists the access token and clears both cookies with the same path, SameSite and Secure settings they were set with. Other devices stay signed in. Audited as `auth.logout` with the user as actor, once per real sign out |
| `POST /api/register` | anyone | `first_name`, `last_name` (each required, trimmed, 100 characters at most), `email`, `password`, `password_confirmation`, `privacy_consent` (must be true) | 202 with `message`. Creates a volunteer with `account_status` pending_email and emails a 6 digit code. The answer is the same when the email is already used, and nothing is sent then. 422 for a weak or mismatched password (12 characters at least) or no consent. 429 `too_many_attempts` after 5 requests in an hour from the same IP |
| `POST /api/register/verify` | anyone | `email`, `code` | 200 and the account becomes pending_approval. 422 `invalid_code` for a wrong, expired or unknown code. 422 `code_locked` after 5 wrong tries: ask for a new code. 429 after 10 tries in 10 minutes from the same IP |
| `POST /api/register/resend` | anyone | `email` | 200 with the same `message` as register. Sends a new code only to an account still waiting to confirm its email, and at most once a minute. 429 after 3 calls in 10 minutes from the same IP. A call within 60 seconds of the last code is answered 200 but sends nothing, so the screen keeps its own 60 second wait |
| `POST /api/forgot-password` | anyone | `email` | 200 with `message`. The same answer whether or not the email has an account. Only an active account gets an email, through the same mail sender as the sign up code. Unknown, pending, rejected and disabled accounts get none and the same answer. If the mail cannot be sent the answer stays the same and `Password reset email failed` is written to the log. One link per account per minute. 422 for a missing or malformed email. 429 `too_many_attempts` after 3 requests in 10 minutes from the same IP |
| `POST /api/reset-password` | anyone with a link | `token`, `email`, `password`, `password_confirmation` | 200 with `message`. The password needs at least 12 characters. The account is signed out everywhere. 422 `invalid_reset_link` for a wrong, used or expired (over 60 minutes) link, an unknown email or a disabled account. 422 with `errors.password` for a weak or mismatched password. 429 `too_many_attempts` after 10 tries in 10 minutes from the same IP |
| `GET /api/me` | signed in | none | 200 with `data`: `id`, `first_name`, `last_name`, `name` (both together, for display), `email`, `role` (role code, built-in or custom), `role_name`, `team`, `status`, `permissions` (list of codes), `consent.privacy_notice`, `consent.location_tracking`, `home` (`/admin` or `/me`). 401 when not signed in |

## Access requests (Personnel, admin only)

These need the `registrations.review` permission. Anyone else gets 403, also when the input is invalid.

| Method and path | Who | Request | Response |
|---|---|---|---|
| `GET /api/admin/registrations` | admin | query `status`: `pending_approval` (default), `pending_email`, `rejected`, `active` (approved by an admin) or `all` | 200 with `data`: list of `id`, `first_name`, `last_name`, `name` (both together), `email`, `account_status`, `requested_at`, `email_verified_at`, `reviewed_at`, `rejection_reason`. 422 for an unknown status |
| `POST /api/admin/registrations/{id}/approve` | admin | none | 200 with `data`. The account becomes active and the person gets an email. 409 when the request is not waiting for review. Audited as `registration.approved` |
| `POST /api/admin/registrations/{id}/reject` | admin | `reason` (3 to 500 characters) | 200 with `data`. The reason is kept, emailed to the person and audited as `registration.rejected`. 409 when the request is not waiting for review. 422 without a reason |

## Roles and permissions (Access, admin only)

These need `access.manage`, which only the Admin role holds and nobody can be granted. Anyone else gets 403, also when the input is invalid.

| Method and path | Who | Request | Response |
|---|---|---|---|
| `GET /api/permissions` | admin | none | 200 with `data`: list of `code`, `label`, `description`, `group`, `admin` (opens an admin screen), `grantable`, and `groups`: list of `key`, `label` in screen order |
| `GET /api/roles` | admin | none | 200 with `data`: list of `id`, `code`, `name`, `description`, `is_system`, `is_admin`, `is_field`, `members_count`, `permissions` (codes), `locks` (code to `on` and `reason` for cells that cannot change), `can_delete` |
| `GET /api/roles/{id}` | admin | none | 200 with one role, same fields |
| `POST /api/roles` | admin | `name` (3 to 50 characters, unique), `description` (optional), `copy_from` (optional role id) | 201 with the new custom role. It gets a copy of `copy_from`'s permissions, minus cells it may not hold, plus the basics. Audited as `role.created` |
| `PATCH /api/roles/{id}` | admin | `name`, `description` | 200. 422 for a built-in role. Audited as `role.updated` |
| `DELETE /api/roles/{id}` | admin | none | 204. 422 for a built-in role or while people still hold it. Audited as `role.deleted` |
| `PUT /api/roles/permissions` | admin | `roles`: list of `id` and `permissions` (the full list of codes the role should hold) | 200 with every role. All or nothing: a locked cell anywhere gives 422 on `roles.N.permissions` and nothing is saved. Each changed role is audited as `role.permissions_changed` with `added` and `removed` |
| `POST /api/roles/{id}/members` | admin | `user_ids` (1 to 100) | 200 with the role. Each person leaves their old role. 422 on `user_ids` for the admin themselves, an account not yet approved, or when no active admin would remain. Each move is audited as `person.role_changed` |
| `GET /api/role-options` | `people.view` or `people.manage` | none | 200 with `data`: list of `code`, `name`, `is_system`, `can_assign` (false when the role has an admin permission the signed-in person does not hold) |
| `GET /api/me/access` | signed in | none | 200 with `data.role` (`code`, `name`, `description`) and `data.permissions`: the role's permissions with `label`, `description`, `group`, `admin` |

## Messages (Information)

A person writes to the DRRMO office. Any admin can read and answer. Text only, up to 1000 characters, no attachments. Every route needs a signed in person. `messages.use` belongs to every role. The inbox needs `messages.office_inbox`, and anyone without it gets 403 on every inbox route.

| Method and path | Who | Request | Response |
|---|---|---|---|
| `GET /api/me/messages` | signed in | none | 200 with `data` (the newest 200 messages of this person's own conversation, oldest first: `id`, `body`, `sent_at`, `from_office`, `sender` which is `You` or `DRRMO`, and `seen`, true on the person's own messages once an admin opened the conversation) and `unread` (answers not opened yet) |
| `POST /api/me/messages` | signed in | `body` (required, trimmed, 1000 characters at most) | 201 with `data`. 422 for an empty or too long text. 429 `too_many_messages` after 20 in a minute |
| `POST /api/me/messages/read` | signed in | none | 200 with `unread: 0`. Marks the answers to this person as read |
| `GET /api/me/messages/unread` | signed in | none | 200 with `unread`. The app asks every 60 seconds for the Messages tab |
| `GET /api/inbox` | inbox | none | 200 with `data` (one row per person, newest activity first, at most 200: `person` with `id` and `name`, `last` with `body`, `sent_at`, `from_office`, and `unread`) and `unread` (the total) |
| `GET /api/inbox/unread` | inbox | none | 200 with `unread` for the sidebar |
| `GET /api/inbox/{user}` | inbox | none | 200 with `person` and `data` (the conversation, oldest first, with the real `sender` names, and `seen`, true on office answers the person has opened) |
| `POST /api/inbox/{user}/reply` | inbox | `body` (same rules) | 201 with `data`. 404 when that person never wrote, because a conversation starts with the person. 429 as above |
| `POST /api/inbox/{user}/read` | inbox | none | 200 with `unread` (the new total). Marks what the person wrote as read for every admin |
| `GET /api/me/chats` | signed in | none | 200 with the person's direct chats, newest first, with the last message and unread count |
| `GET /api/me/chats/people?q=` | signed in | `q` (name) | 200 with active people matching the full name. Names only |
| `GET /api/me/chats/{user}` | signed in | none | 200 with the conversation between the two people. Only they can read it |
| `POST /api/me/chats/{user}` | signed in | `body` (same rules) | 201 with `data`. 404 or 422 for a closed or waiting account |
| `POST /api/me/chats/{user}/read` | signed in | none | 200 with `unread`. Marks what the other person wrote as read |

## Route index for the other modules

These tables list every other route so the reference is complete. They give the purpose only. Who may call each route is set by a policy or gate (see SECURITY_AND_PRIVACY.md), and each route has a test for the forbidden case. Request and response shapes are in the module README and in the feature tests. The detailed tables above are the model to follow when a route is written up in full.

### Personnel

| Route | Purpose |
|---|---|
| `GET /api/people`, `POST /api/people` | List people (filters: role, team, status, department, search). Create a person |
| `GET /api/people/{user}`, `PATCH /api/people/{user}` | Read and edit one person |
| `POST /api/people/{user}/invite` | Send the set password email |
| `GET /api/people/import/template`, `POST /api/people/import` | CSV template and CSV import |
| `GET /api/admin/volunteers` | Volunteers with their on-call status |
| `PUT /api/admin/volunteers/{user}/status`, `GET /api/admin/volunteers/{user}/status-history` | Set active or inactive with a reason. Read the history |
| `GET /api/me/availability` | The signed in person's own status |
| `GET /api/me/profile`, `PATCH /api/me/profile` | Own profile. Only the contact number can change |
| `GET\|POST /api/me/emergency-contacts`, `PUT\|DELETE /api/me/emergency-contacts/{contact}` | Own emergency contacts |
| `GET /api/admin/people/{user}/emergency-contacts` | Another person's contacts, for admins |
| `GET\|POST /api/departments`, `PATCH\|DELETE /api/departments/{department}` | Department list |
| `GET\|POST /api/teams`, `PATCH\|DELETE /api/teams/{team}` | Team list |

### Access (grants)

| Route | Purpose |
|---|---|
| `GET /api/grantable-permissions` | Permissions that can be lent for a while |
| `GET /api/grants`, `POST /api/grants` | List grants (filters: user, event, active). Give temporary access |
| `POST /api/grants/{grant}/revoke` | End a grant early |
| `GET /api/me/grants` | The signed in person's own grants |

### Events

| Route | Purpose |
|---|---|
| `GET /api/events`, `POST /api/events`, `GET /api/events/calendar` | List, create, calendar view |
| `GET /api/events/{event}`, `PUT /api/events/{event}` | Read and edit one event |
| `POST /api/events/{event}/publish`, `POST /api/events/{event}/cancel` | Publish or cancel |
| `POST /api/events/{event}/requirements`, `DELETE /api/requirements/{requirement}` | Add or remove a duty requirement |
| `GET /api/requirements/{requirement}/candidates` | Assignable people with conflict flags |
| `POST /api/requirements/{requirement}/assignments` | Assign one or more people, with an optional override reason |
| `PATCH /api/assignments/{assignment}`, `DELETE /api/assignments/{assignment}` | Change or remove an assignment |
| `POST /api/assignments/{assignment}/cancel`, `POST /api/assignments/{assignment}/no-show` | Cancel with a reason. Mark a no show |
| `GET /api/me/assignments`, `POST /api/me/assignments/{assignment}/acknowledge` | Own duties. Acknowledge one |
| `GET /api/me/event-notices` | Event notices for a coordinator |
| `GET /api/dashboard` | Admin dashboard numbers |
| `GET /api/event-lookups` | Event types, duty types and locations for the event form |
| `GET\|POST /api/event-types`, `PATCH\|DELETE /api/event-types/{event_type}` | Event type list |
| `GET\|POST /api/campus-locations`, `PATCH\|DELETE /api/campus-locations/{campus_location}` | Campus location list |

### Monitoring

| Route | Purpose |
|---|---|
| `POST /api/me/assignments/{assignment}/start-duty`, `.../end-duty` | Start and end duty |
| `POST /api/me/assignments/{assignment}/pings` | Send a batch of location pings (throttled) |
| `GET /api/map/latest`, `GET /api/map/trail/{assignment}` | Live map and trail. Every call is audited |
| `GET /api/me/report-slots`, `POST /api/me/report-slots/{report}`, `GET /api/me/report-slots/{report}/photo` | Own report slots. Submit a report. Read its photo |
| `GET /api/me/report-slots/{report}/emergencies` | Emergencies since the previous report, for the report form |
| `GET /api/reports`, `GET /api/reports/{report}`, `GET /api/reports/{report}/photo` | Report feed, one report, its photo |
| `POST /api/me/assignments/{assignment}/emergencies` | Send an emergency report (throttled) |
| `GET /api/me/emergencies`, `GET /api/me/emergencies/{emergency}/photo` | Own emergencies and photos |
| `GET /api/emergencies`, `GET /api/emergencies/{emergency}`, `GET /api/emergencies/{emergency}/photo` | Emergency inbox for reviewers. Reading one shows the place and is audited |
| `POST /api/emergencies/{emergency}/acknowledge`, `POST /api/emergencies/{emergency}/resolve` | Acknowledge and resolve |
| `GET /api/report-reviewers`, `PUT /api/report-reviewers` | Read and set the reviewer marshals |
| `GET /api/attention` | Needs attention counts and lists. Audited |

### Notifications

| Route | Purpose |
|---|---|
| `GET /api/me/notifications` | Own notifications |
| `GET /api/me/alerts`, `POST /api/me/alerts/read` | In app alerts and marking them read |
| `GET /api/notifications`, `POST /api/notifications/{notification}/retry` | Admin send log. Retry a failed email |
| `GET /api/me/push`, `PUT /api/me/alert-settings` | Devices and settings. Mute and quiet hours |
| `POST /api/push/subscribe`, `DELETE /api/push/subscribe` | Turn alerts on or off for this device |
| `DELETE /api/push/devices/{subscription}` | Remove one of the person's devices |
| `POST /api/push/test` | Send a test push (6 a minute) |

### Information (memos)

| Route | Purpose |
|---|---|
| `GET /api/memos`, `GET /api/memos/{memo}` | Search and read memos |
| `GET /api/memos/{memo}/file`, `GET /api/memos/{memo}/preview` | The file, and the PDF copy of a Word file |
| `POST /api/memos`, `PATCH /api/memos/{memo}`, `DELETE /api/memos/{memo}` | Admin: create, edit, delete (soft) |

### Records

| Route | Purpose |
|---|---|
| `POST /api/consent/privacy-notice` | Agree to the current privacy notice |
| `POST /api/consent/location`, `DELETE /api/consent/location` | Agree to location tracking, or withdraw |
| `GET /api/audit-logs` | Audit log with filters (actor, action, entity, date) |
| `GET /api/me/data-export` | The person's own data as JSON |
