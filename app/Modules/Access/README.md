# Access module

Owned tables and endpoints are listed in docs/MODULES.md under "Access".
Folder layout: Actions, Contracts, Enums, Events, Http, Jobs, Listeners, Models, Policies, Console, routes.php, AccessServiceProvider.php

## Roles and permissions

`Support/PermissionMatrix.php` is the source of truth for permission codes and which role holds each one. `RoleSeeder` and `PermissionSeeder` write it to the database and can be run again safely. A test compares the seeded data with the table in docs/SECURITY_AND_PRIVACY.md, so change both together.

Admin and Director share the `admin` role for now. To split them, add a `Director` case to the `Role` enum, give it a column in the docs matrix, and list it in `PermissionMatrix`.

## Grants

`PermissionChecker::allows($user, $code, $eventId)` is the single check. It returns true when the role holds the permission, or the person has an active grant for it (`starts_at <= now < ends_at`, not revoked, grantable permission only) whose event is empty or equal to `$eventId`. `User::hasPermission()` calls it, so policies keep using `hasPermission()`.

- `GET /api/grants` (filters `user`, `event`, `active`), `POST /api/grants`, `POST /api/grants/{grant}/revoke`: need `access.manage` (admin).
- `GET /api/me/grants`: the signed-in person's own grants.
- Rules on create: `reports.submit` needs an event, `location.view` lasts 7 days at most, no start in the past, no overlapping grant for the same permission, not for a permission the role already has.
- Create and revoke write `grant.created` and `grant.revoked` audit rows and fire `PermissionGranted` and `PermissionRevoked`.
- `GET /api/grantable-permissions` lists what can be granted. Nearly every admin permission is grantable. `access.manage` and role-only permissions are not.
- A person who holds `people.manage` only through a grant cannot create, edit or import an admin (checked in `PersonRequest` and the CSV import).
- The React sidebar and routes read `resources/js/app/adminAccess.ts`, which maps each admin screen to its permission.

