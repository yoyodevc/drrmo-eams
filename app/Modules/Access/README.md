# Access module

Owned tables and endpoints are listed in docs/MODULES.md under "Access".
Folder layout: Actions, Contracts, Enums, Events, Http, Jobs, Listeners, Models, Policies, Console, routes.php, AccessServiceProvider.php

## Roles and permissions

`Support/PermissionMatrix.php` is the source of truth for permission codes, their labels and groups, the default matrix of the four built-in roles, and the locked cells. `RoleSeeder` and `PermissionSeeder` write it to the database and can be run again safely: they keep an admin's edits and custom roles, add new permissions to the built-in roles that get them by default, and reapply the locks. A test compares the defaults with the table in docs/SECURITY_AND_PRIVACY.md, so change both together.

Roles are data. An admin adds custom roles and edits role permissions on the Roles and Permission matrix screens. The rules (locks, no escalation, nobody changes their own role) are in docs/SECURITY_AND_PRIVACY.md section 1a.

- `RoleController`: list, show, create (from the basics or a copy), rename and delete custom roles. `GET /api/role-options` gives the People screens the role list with `can_assign`.
- `RolePermissionController`: `PUT /api/roles/permissions` saves several roles in one transaction and refuses any locked cell.
- `RoleMemberController`: `POST /api/roles/{role}/members` moves people in through Personnel's `PersonRoleChanger`, which writes `person.role_changed`.
- `RoleGuard` (contract): `canHandOut($actor, $role)` is true when the actor holds every admin permission of the role. Personnel calls it in `PersonRequest` and the CSV import.
- `MyAccessController`: `GET /api/me/access` for the phone My access page.

Admin and Director share the `admin` role for now. To split them, add a `Director` case to the `Role` enum, give it a column in the docs matrix, and list it in `PermissionMatrix`.

## Grants

`PermissionChecker::allows($user, $code, $eventId)` is the single check. It returns true when the role holds the permission, or the person has an active grant for it (`starts_at <= now < ends_at`, not revoked, grantable permission only) whose event is empty or equal to `$eventId`. `User::hasPermission()` calls it, so policies keep using `hasPermission()`.

- `GET /api/grants` (filters `user`, `event`, `active`), `POST /api/grants`, `POST /api/grants/{grant}/revoke`: need `access.manage` (admin).
- `GET /api/me/grants`: the signed-in person's own grants.
- Rules on create: `reports.submit` needs an event, `location.view` lasts 7 days at most, no start in the past, no overlapping grant for the same permission, not for a permission the role already has.
- Create and revoke write `grant.created` and `grant.revoked` audit rows and fire `PermissionGranted` and `PermissionRevoked`.
- `GET /api/grantable-permissions` lists what can be granted. Nearly every admin permission is grantable. `access.manage` and role-only permissions are not.
- A person who holds `people.manage` through a grant or a custom role cannot create, edit or import an admin (the `RoleGuard` rule, checked in `PersonRequest` and the CSV import).
- The React sidebar and routes read `resources/js/app/adminAccess.ts`, which maps each admin screen to its permission.

