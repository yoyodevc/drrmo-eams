# Records module

Owned tables and endpoints are listed in docs/MODULES.md under "Records".
Folder layout: Actions, Contracts, Enums, Events, Http, Jobs, Listeners, Models, Policies, Console, routes.php, RecordsServiceProvider.php

## Contracts (stubbed in M0)

- `Contracts/AuditLogger::log($action, $entity, $entityId, $meta)` writes one row to `audit_logs`. The actor is the signed-in user, or null for jobs. Rows are insert only; the model throws on update or delete.
- `Contracts/ConsentChecker::has($user, ConsentPurpose)` is true when the latest consent for that purpose is not withdrawn. For the privacy notice it must also be for the current `config('privacy.notice_version')`. `outdated()` is true when they agreed to an older version.
- `POST /api/consent/privacy-notice` writes the person's own consent row (version, time, IP) and audits it. Until then the `EnsurePrivacyConsent` middleware answers every API call except `/api/me`, this endpoint and logout with 403 `consent_required`.

`RecordsServiceProvider` binds both to the database implementations in `Services/`. Other modules type-hint the interfaces and never touch the tables.
