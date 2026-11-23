# Planning Summary

One page to get up to speed. Details live in the linked documents.

## Handoff (read this first, updated 23 Nov 2026)

**How we work with the owner (John Fredrick Lim)**
- Commits and PRs are under the owner's identity. No Claude co-author or session trailers, no "Generated with Claude Code" line in PR bodies. Set `git config user.name "John Fredrick Lim"` and `user.email "192341146+yoyodevc@users.noreply.github.com"`.
- Run the full checks when a milestone is finished, not after every small fix.
- One thread per milestone keeps the context small. Everything a new thread needs is in the docs.
- Keep replies short, check facts, no em dashes, write like a person.
- Every merged story adds a DEV_LOG entry and updates the data dictionary or API reference (docs/DOCUMENTATION_GUIDE.md).

**Decisions made**
- Auth: JWT (owner decision, 6 Nov 2026) instead of Sanctum sessions. Access JWT and rotating refresh token, both in HttpOnly cookies, never in localStorage. See ARCHITECTURE.md section 3.
- Sign up: public "Request access" for volunteers only, with an emailed 6 digit code and admin approval before the account works.
- Roles are data. An admin edits the permission matrix and can add custom roles. Admin and Director share the `admin` role.
- Site reports and emergencies: two global reviewer marshals set by an admin, emergencies escalate after 5 minutes, an empty report slot closes as missed after 60 minutes.
- Alerts (M7): only emergencies and report problems are urgent. Urgent emergencies ignore quiet hours. A push cannot play a custom sound, so the alarm and chime play inside the app. No native wrapper for now.
- Data protection officer: the DRRMO head for now.
- Hosting: localhost for now. Free Oracle VM or school server later, after the project is finished.
- Map tiles: OpenStreetMap by default (no key). ArcGIS satellite can be switched on later with an optional key.
- Assumptions A1 to A9, the data model fixes and the retention periods in the plan are approved.

**Status**
- M0 to M7 are built. 49 of 53 stories are done (see the table in BACKLOG.md).
- Still open: S7.6 (check push on real phones, with the owner), S6.5 (production deployment, which also needs a first admin step because there is no admin seeder yet) and S6.6 (field test).
- The design of the screens follows DESIGN_SYSTEM.md. Admin screens are desktop first, everything else is phone first.

## What the system does

A campus tool for about 30 to 60 people. The DRRMO creates events, sets duty requirements, assigns Marshals and Volunteers, and the system emails them. People see duties on their phones, acknowledge, and start duty, which shares approximate GPS every 30 seconds while the page is open. Designated reporters send a site report every 2 hours. The admin sees pins on a satellite map and a report feed. People on duty can also send an emergency report, and urgent alerts reach their phones as push notifications with sound. There is also a memo library, messages (with the DRRMO office and between people), an audit log and consent records under the Data Privacy Act.

## Owner's answers

| Topic | Answer |
|---|---|
| Guards, Staff, OJT, QR attendance | Dropped |
| Coordinators | No field assignments |
| Map access | Admin only, with the option to grant it to someone for a limited time |
| SMS | Email only (no truly free SMS API found) |
| Hosting | Free: Oracle Always Free VM, school server as plan B |
| Ping retention | 10 working days |
| Data protection officer | None today (flagged, see below) |

## Open decisions for the owner

1. Name a DPO. The NPC requires one for government agencies. Suggestion: the university DPO, with the DRRMO head as Compliance Officer for Privacy.
2. Oracle idle reclaim: upgrade to Pay As You Go (card needed, Always Free stays free), or use the school server.
3. ArcGIS Location Platform free account for the satellite layer, or OpenStreetMap only.
4. Confirm assumptions A1 to A9 in PROJECT_PLAN.md section 4 (Admin and Director share one role, statuses, reminder times, report timing).
5. Approve the 14 data model fixes in DATABASE.md section 1.
6. Confirm retention for photos (1 year), audit log (3 years), notification log (6 months).

## Module split

Core plus seven modules, each owning its tables (27 in total): Personnel (5), Access (5), Events (6), Notifications (3), Monitoring (4), Information (2), Records (2). See MODULES.md and the ERD in DATABASE.md.

## What is next

1. Phone check of push alerts (S7.6) with the owner, on Android and iPhone.
2. Production deployment (S6.5): server, HTTPS, queue worker, scheduler, backups, first admin.
3. Field test with two marshals (S6.6), then fill the capstone chapters and the user manual appendix.

## Read first (new session)

1. CLAUDE.md
2. This file
3. docs/MODULES.md (rules at the top, then your module)
4. docs/WORKFLOWS.md (checklists)
5. docs/DOCUMENTATION_GUIDE.md (dev log and capstone paper)
6. CONTRIBUTING.md (Definition of Done)
7. The docs your module needs, listed in WORKING_WITH_CLAUDE_CODE.md section 3

## Environment notes for cloud sessions

- Composer downloads from `api.github.com` can be blocked, so packages may need `--prefer-source`. The `phpstan/phpstan` package has no source, so let CI run Larastan if it fails.
- Composer scripts need `COMPOSER_ALLOW_SUPERUSER=1` when running as root.
- No MySQL in the container. Run tests with `DB_CONNECTION=sqlite DB_DATABASE=:memory: composer test`. CI uses real MySQL.
- Pest 5 needs PHP 8.4, so the project uses Pest 4 to match PHP 8.3 on the server.
- TypeScript is pinned to 6.0 because typescript-eslint does not support 7 yet.
