# Shared constraints: AqOne and Dev Guild Manager

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 3
Status: Draft

## Platform and environment

The web client must work in current desktop and tablet browsers selected during implementation planning.

The native client target is Android through Flutter.

Both clients use the same authenticated backend API and data model.

The first release assumes intermittent connectivity but not reliable offline mutation.

The app must show a clear offline state and the age of cached data when cached reads are displayed.

Shared UI behavior and acceptance criteria are defined in [UI_UX_DESIGN.md](UI_UX_DESIGN.md).

Hosting and deployment provider selection is deferred to a separate production release decision.

## Quality and boundaries

Web interactions must be keyboard reachable, visibly focusable, readable at normal zoom, and usable without relying on color alone.

Mobile controls must have accessible labels, sufficient touch targets, and clear loading, empty, error, and retry states.

Authorization must be enforced server-side for every organization-scoped read and write.

Passwords must be hashed with a modern password-hashing algorithm, and invite tokens must be stored only as digests.

User-facing errors must be actionable and must not expose secrets, tokens, stack traces, or inaccessible organization data.

The dashboard should return its initial summary within two seconds under the expected small-team dataset and ordinary network conditions.

List views must support pagination or bounded loading so growth does not require loading every record at once.

Important changes must be recorded in the activity history.

## Evidence required

The approved implementation plan must include automated checks for authentication, role boundaries, organization isolation, validation, and core member, task, and announcement flows.

The web client requires browser checks for loading, empty, error, permission-denied, and keyboard-accessible states.

The Flutter client requires Android emulator checks for the same states plus offline cached reads and recovery after reconnecting.

Physical-device validation remains pending until a real Android device is tested.

Backup restore evidence remains pending until a deployment environment exists.

## Proposed verification baseline

Use Android API 24 as the minimum and API 36 as the second emulator target, with Flutter 3.44.7 unless a verified compatibility issue requires a new approved choice.

Target current stable Chrome, Edge, Firefox, and Safari; record actual tested versions and distinguish automated Playwright WebKit checks from real Safari testing.

Verify web layouts at 375, 768, 1024, and 1440 CSS pixels, 200 percent zoom, and keyboard-only operation.

Android controls have at least 48 logical-pixel touch targets, support TalkBack and 200 percent text scaling, and remain usable with the on-screen keyboard and system navigation visible.

Use a deterministic synthetic dataset with two organizations, 50 distinct users with some overlapping memberships, 500 tasks, and 100 announcements.

For a local performance check, measure 20 authenticated warm dashboard loads with 100 ms simulated round-trip latency and report p95 time to usable summary; the target is at most two seconds.

Report cold-load timings separately and do not present local timings as deployed performance evidence.

Development uses a dedicated project database and a local SMTP capture inbox with fake recipients only.

Password recovery is a documented owner-operated local command that changes a selected account's password securely and revokes its sessions; public password-reset email screens are deferred.

The first owner is provisioned by a local command with secure input, never by public signup or a committed default password.

Local software completion requires a working web app, an Android debug APK, required automated and emulator checks, screenshots, and a successful restore into a separate disposable local database.

Production hosting, live SMTP, HTTPS domain configuration, daily automated backups and retention, physical-device acceptance, store signing, and real Safari checks remain explicitly pending release checks when no access exists.

These release checks do not interrupt otherwise independent local implementation, and their pending status prevents any claim of production readiness.

## Open questions and approval

Deployment region, production SMTP provider, retention policy, and release credentials are the remaining operational decisions.

Exact approval of this revision is pending.
