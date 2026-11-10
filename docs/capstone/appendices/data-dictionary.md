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
| team | string(32) | optional: security, ert, fire_suppression |
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
