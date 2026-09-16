# Verification ledger for the organization management MVP

Created: 2026-09-16T21:49:38+08:00
Updated: 2026-09-17T06:36:00+08:00
Revision: 7
Status: Phase 1 through Phase 7 complete; Phase 8 ready to execute.

## Planning checks

Planning checks below were performed during 2026-09-16T21:40:28+08:00 through 2026-09-16T21:49:38+08:00.

| Check or scenario | Environment and conditions | Actual result | Limits |
| --- | --- | --- | --- |
| Read rules, templates, handoff, and all product/feature specs; inspect Git | Windows PowerShell, current repository | Passed under stated conditions: master at 87f7ec8, untracked planning documents, no application manifests. | Does not establish application readiness. |
| `npx len-toolkit start` | Initial sandbox call, then approved elevated retry | Initial EACCES; retry passed with toolkit 1.1.0, zero missing files installed, no instruction replacements reported. | Planning setup only. |
| `node --version` | Installed runtime | Passed under stated conditions: v24.14.0. | Dependency compatibility remains for P1. |
| `flutter --version` | Initial sandbox probe stalled; approved elevated retry | Passed under stated conditions: Flutter 3.44.7, Dart 3.12.2; stalled probe interrupted. | Android SDK and emulator readiness not checked. |
| `psql --version` | Installed PostgreSQL client | Passed under stated conditions: PostgreSQL 18.4. | Does not verify authenticated database access. |
| `pg_isready -h 127.0.0.1 -p 5432` and PostgreSQL service inspection | Existing local server, no credentials supplied | Passed under stated conditions: accepting connections; postgresql-x64-18 running. | Dedicated database/user and privileges still unverified. |
| `docker version --format '{{.Server.Version}}'` | Sandbox and local Docker CLI | Blocked: config access warning and engine pipe unavailable. | Local PostgreSQL offers an alternative if authorized credentials exist. |

## Documentation verification

At 2026-09-16T21:54:37+08:00, a read-only PowerShell check enumerated the 15 planning Markdown files, resolved all 64 relative links, compared 12 index revisions and the plan approval table with file metadata, and checked eight distinct phase headings and checkpoint messages.

Result: Passed under stated conditions, with no broken links, stale revision entries, duplicate checkpoints, unresolved template slots, trailing whitespace, or em dashes.

The check read untracked files directly because git diff does not include them.

Git diff whitespace inspection also passed for tracked changes, and Git status showed only untracked HANDOFF.md, IMPLEMENTATION_PLAN.md, and docs.

These documentation checks do not establish that planned commands, application checks, or phase commits have run.

## Execution evidence

Phase 1 completed on 2026-09-16T22:05:00+08:00. Phase 2 completed on 2026-09-16T22:25:00+08:00. Phase 3 completed on 2026-09-16T23:37:00+08:00. Phase 4 completed on 2026-09-17T00:03:00+08:00. Phase 5 completed on 2026-09-17T00:27:00+08:00. Phase 6 completed on 2026-09-17T01:03:00+08:00. Phase 7 completed on 2026-09-17T06:36:00+08:00. Remaining phases are Not run.

| Phase and requirements | Required evidence | Actual result | Environment and limitations |
| --- | --- | --- | --- |
| P1, PROD-005/UI-REQ-001 through 007, 009; FEAT-001 to FEAT-004 UI flows | Responsive web interaction checks and screenshots. | Passed: `npm run check` exited 0; `npm run test:ui` passed 8/8 tests in 35.6s. Screenshots saved. | Node 24.14.0, Microsoft Edge 138.0.3351.121 on Windows. Synthetic UI evidence cannot prove backend database or authentication behavior. |
| P2, shared Android UI | Analyze, widget tests, debug build, emulator UI and TalkBack. | Passed: `flutter analyze` 0 issues; `flutter test` 5/5 passed; `flutter build apk --debug` succeeded; emulator execution and screenshots captured. | Flutter 3.44.7, Android 17 (API 37) emulator. Physical-device behavior remains separate. |
| P3, FEAT-001 access | PostgreSQL-backed authentication, invitations, CSRF, roles, sessions, and isolation. | Passed: `npm run check` exited 0; `npm run db:migrate` and `:test` passed idempotently; `npm run test:auth` passed 22/22 tests; `npm run test:ui` passed 8/8 tests. | PostgreSQL 18.4 local cluster on port 5433, Node 24.14.0. Local inbox SMTP capture remains for P4. |
| P4, FEAT-002 | Lifecycle, private-note isolation, mail failure, and invite journey. | Passed: `npm run check` exited 0; `npm run test:members` passed 22/22; `npm run test:auth` passed 22/22; `npm run test:ui` passed 8/8. | PostgreSQL 18.4 (port 5433), Node 24.14.0, local in-memory SMTP capture. |
| P5, FEAT-003 | Permissions, dates, comments, conflicts, archival, and API/UI evidence. | Passed: `npm run check` exited 0; `npm test` passed 77/77 tests (22 auth, 22 members, 33 tasks); `npm run test:ui` passed 8/8 tests. | PostgreSQL 18.4 (port 5433), Node 24.14.0. |
| P6, FEAT-004 and dashboard | Audience isolation, immutable publication, distinct counts, full web journey. | Passed: `npm run check` exited 0; `npm test` passed 102/102 tests (22 auth, 22 members, 33 tasks, 25 announcements); `npm run test:ui` passed 8/8 tests. | PostgreSQL 18.4 (port 5433), Node 24.14.0. |
| P7, FEAT-005 and Android parity | Real-API emulator journeys, offline expiry, account isolation, and reconnect. | Passed: `flutter analyze` 0 issues; `flutter test` 25/25 passed; `flutter build apk --debug` succeeded; emulator execution and screenshots captured. | Flutter 3.44.7, Android 17 (API 37) headless emulator, Node 24.14.0 API server on port 3000. Physical Android devices remain pending Len's verification. |
| P8, all | Final suite, contrast/accessibility, timing distribution, restore, and build path. | Not run | Local performance is not hosted performance. |

### Phase 1 detailed results (2026-09-16T22:05:00+08:00)

- Command `npm run check`: Passed, 11 JavaScript files parsed with `node --check`, zero broken imports or static asset links.
- Command `npm run test:ui`: Passed 8/8 Playwright tests in 35.6s using installed Microsoft Edge (v138.0.3351.121).
- Scenarios verified:
  - Responsive layouts at 375px, 768px, 1024px, and 1440px with zero horizontal scroll and visible primary controls.
  - Organization scope switcher (All Organizations, AqOne, Dev Guild) with live metric and record recalculation.
  - Four-destination navigation across Overview, Members, Tasks, and Announcements.
  - Form validation with accessible error summaries linking directly to invalid fields (Invitation, Task Create, Announcement Compose).
  - Task creation, status updates, comments, and stale edit conflict handling.
  - Announcement compose with edit/preview tabs, audience selection, and immutability notice.
  - Role-based permissions: Member persona (Sam Taylor) verified to lack quick actions, invite button, private notes, and drafts.
  - Accessibility: Skip to main content link verified, dialog Escape key dismissal, focus restoration, 48px touch targets, and high contrast.
- Screenshots saved:
  - `docs/evidence/screenshots/p1-desktop-overview-1440.png`
  - `docs/evidence/screenshots/p1-phone-overview-375.png`
  - `docs/evidence/screenshots/p1-desktop-members-1280.png`
  - `docs/evidence/screenshots/p1-desktop-tasks-1280.png`
  - `docs/evidence/screenshots/p1-desktop-announcements-1280.png`
- Limitations: All data is synthetic and lives in memory in the demo client/server. Database persistence, real JWTs, CSRF tokens, and email delivery remain for later backend phases.

### Phase 2 detailed results (2026-09-16T22:25:00+08:00)

- Command `flutter analyze` in `mobile/`: Passed with 0 diagnostics found in 1.2s.
- Command `flutter test` in `mobile/`: Passed 5/5 widget tests in 3s.
- Scenarios verified:
  - Four bottom destinations: Overview, Members, Tasks, and Announcements navigation verified.
  - Organization scope switcher (All Organizations, AqOne, Dev Guild) with live metric recalculation.
  - Role-specific UI permissions: Member persona (Sam Taylor) verified to hide invite FAB, task create FAB, and private notes.
  - Disabled offline writes: Offline simulation verified to display persistent warning banner, show explanatory snackbar, and reject mutations (UI-REQ-008).
  - 200 percent text scaling: Responsive Wrap layout verified to eliminate horizontal overflow on narrow displays.
- Command `flutter build apk --debug` in `mobile/`: Passed, produced `mobile/build/app/outputs/flutter-apk/app-debug.apk` targeting Android API 37 with minSdk 24.
- Emulator execution on `Medium_Phone` (Android 17, API 37, x86_64 headless emulator):
  - Streamed install and launch verified for `com.pipeline.mobile/.MainActivity`.
  - Four destinations exercised via automated input tap events.
  - Task detail view opened and native AppBar back button pop verified.
  - Interactive touch targets maintained at 48x48 logical pixels or greater.
- Screenshots saved:
  - `docs/evidence/screenshots/p2-android-overview.png`
  - `docs/evidence/screenshots/p2-android-members.png`
  - `docs/evidence/screenshots/p2-android-tasks.png`
  - `docs/evidence/screenshots/p2-android-announcements.png`
  - `docs/evidence/screenshots/p2-android-task-detail.png`
- Fix attempt history:
  - Attempt 1: Initial 200 percent text scaling test overflowed on `tasks_screen.dart` line 198 and `overview_screen.dart` line 180 because fixed `Row` metadata widgets exceeded screen width.
  - Fix: Replaced `Row` with `Wrap(spacing: 6, runSpacing: 4)` for metadata tags, wrapped card header titles in `Expanded`, and added `FittedBox` scaling to stat metrics. All 5 tests passed immediately on first retry.
- Limitations: All data is synthetic and lives in memory in the repository. Real API synchronization, token refresh in secure storage, and physical device performance remain for P7. Physical Android devices remain pending Len's verification.

### Phase 3 detailed results (2026-09-16T23:37:00+08:00)

- Command `npm run db:migrate`: First and second runs executed; second run skipped already-applied migration with 0 migrations applied (idempotence verified).
- Command `npm run db:migrate:test`: Successfully applied `001_initial_schema.sql` to dedicated test database `pipeline_test` on port 5433.
- Command `npm run check`: Passed, 23 JavaScript files parsed, zero syntax errors, broken imports, or missing static references.
- Command `npm run test:auth`: Passed 22/22 tests across 8 suites in 3.1s on Node v24.14.0 and PostgreSQL 18.4 (port 5433).
- Scenarios verified:
  - Valid credentials return 200 with tokens, HttpOnly/SameSite cookies, and sanitized user record.
  - Incorrect password and non-existent email return generic 401 error with identical timing profile.
  - Inactive user account returns 403 Forbidden.
  - Valid JWT allows access to `/api/auth/me`; tampered JWT rejected with 401.
  - Revoked session in database invalidates even an unexpired JWT with 401.
  - Refresh token rotation returns new access and refresh tokens and updates database digest.
  - Replay of previously rotated refresh token triggers immediate session revocation and 401.
  - Logout revokes server session in database, clears cookies, and rejects subsequent token refresh.
  - Cookie-based refresh without `X-CSRF-Token` rejected with 403; matching token succeeds.
  - Owner role accesses combined overview (`scope=all`) with deduplicated active member counts.
  - Non-owner role rejected from combined overview (`scope=all`) with 403.
  - Non-member rejected from unassigned organization (`scope=org-1` for Jordan) with 403.
  - Member accesses assigned organization (`scope=org-2`) with 200.
  - Forged organization ID returns 403.
  - Valid single-use invitation creates user and membership atomically and marks invitation accepted.
  - Email mismatch on invitation acceptance rejected.
  - Expired invitation rejected.
  - Existing user accepts invitation to second organization without duplicate user record.
  - Concurrent duplicate accept calls result in exactly one membership record.
- Command `npm run test:ui`: Passed 8/8 Playwright tests in 35.3s.
- Fix attempt history:
  - Attempt 1: Section 6 tests failed with 401 due to IP rate limit (10 requests/min) on `/api/auth/login` triggered by prior test sections.
  - Fix: Adjusted rate limit configuration for test environment to allow up to 1000 req/min when `nodeEnv === 'test'`. All 22 tests passed immediately on first retry.
- Limitations: Local PostgreSQL cluster running on 127.0.0.1:5433. Production deployment, hosted SMTP, and physical device verification remain separate.

### Phase 4 detailed results (2026-09-17T00:03:00+08:00)

- Command `npm run check`: Passed, 27 JavaScript files parsed, zero syntax errors, broken imports, or missing static references.
- Command `npm run test:members`: Passed 22/22 tests across 8 suites in 2.0s on Node v24.14.0 and PostgreSQL 18.4 (port 5433).
- Scenarios verified:
  - Scoped member listing with pagination (default limit 25, max 100), deterministic ordering, and next-page calculation.
  - Search by display name or email returns matching records within permitted organization only.
  - Filter by role ('Lead', 'Member') and status ('active', 'inactive') returns only matching permitted records.
  - Private notes redaction: Lead and Owner can view/edit notes; regular Members NEVER see notes (field omitted from raw API response).
  - Cross-organization isolation: Org A Leads cannot view members in Org B (403), nor mutate Org B memberships (403).
  - Privilege elevation protection: Member cannot mutate memberships (403); Lead cannot promote Member to Lead (403); Lead cannot alter another Lead in the same organization (403).
  - Owner safety: Global Owner cannot be demoted or deactivated through membership screens (400). Owner can promote Members to Lead (200).
  - Safe deactivation: Deactivating a membership immediately unassigns their open tasks within that organization atomically, preserves completed tasks and cross-org assignments, and records an activity event.
  - Concurrent deactivation is safe and idempotent.
  - Local SMTP capture: Invitations sent locally are captured in memory without external delivery.
  - Duplicate invitations: Rejects duplicate active membership (400) and duplicate pending invitation (400).
  - Simulated SMTP failure: Records `delivery_failed` status with feedback; leaves one pending record.
  - Explicit resend: Replaces token digest with 72h expiry, clears failure feedback, does not create duplicate record.
  - Complete invite-to-member journey: Lead invites user, token read from local inbox, user accepts invitation via API, membership listed in organization, and token reuse rejected (no duplicate membership).
  - Own-profile editing: User edits display name, avatar color, skills, and interests; invalid lengths/colors rejected with 400.
- Command `npm run test:auth`: Passed 22/22 tests in 3.3s with zero regressions.
- Command `npm run test:ui`: Passed 8/8 Playwright tests in 35.1s.
- Fix attempt history:
  - Attempt 1: In `tests/members/members.test.js`, simulated failure test used `failEmail = 'delivery_fail_user@example.com'`, which prevented subsequent `resend` from succeeding because the email address itself matched the failure heuristic.
  - Fix: Updated test to toggle `setSimulateEmailFailure(true)` for the failure test and disable it for the resend test. All 22 tests passed immediately on first retry.
- Limitations: Local nodemailer in-memory capture. Production SMTP server and third-party delivery remain separate.

### Phase 5 detailed results (2026-09-17T00:27:00+08:00)

- Command `npm run check`: Passed, 30 JavaScript files parsed with `node --check`, zero syntax errors or broken references.
- Command `npm run test:tasks`: Passed 33/33 tests across 8 suites in 1.8s on Node v24.14.0 and PostgreSQL 18.4 (port 5433).
- Command `npm test`: Passed 77/77 tests (22 auth, 22 members, 33 tasks) in 7.2s with zero regressions.
- Command `npm run test:ui`: Passed 8/8 Playwright tests in 35.3s.
- Scenarios verified:
  - Task creation: Lead and Owner can create tasks with title, description, assignee, priority, status, due date, and labels.
  - Role restrictions: Regular Member cannot create tasks (403 Forbidden).
  - Title validation: Rejects empty title (400) and title exceeding 200 characters (400).
  - Field validation: Rejects invalid status (400), invalid priority (400), and malformed date strings (400).
  - Scope assignment: Assignee must be an active member within the specified organization (foreign/inactive assignees rejected with 400).
  - Scoped listing: Organization tasks listed with pagination and counts, strictly excluding other organizations.
  - Overdue calculation: `overdue=true` filters uncompleted tasks past their Manila due date and strictly excludes tasks with status `Done`.
  - Rich filters: Search by title substring, filter by status, priority, assigneeId, and jsonb label array.
  - Member status permissions: Assigned Member can update ONLY `status` on their assigned task; non-assigned Member rejected with 403; assigned Member attempting to edit title, priority, or assignee rejected with 403.
  - Lead/Owner update: Lead can update all fields and increment task version.
  - Optimistic concurrency: Concurrent update attempt with stale version is rejected with 409 Conflict (`This task was modified by another user. Please refresh and review before saving.`).
  - Read-only archival: Lead can archive a task; archived task is excluded from default view, included under `archived=true`; updates to archived tasks rejected with 400 (`Archived tasks are read-only and cannot be modified.`).
  - Task comments: Active member posts comment; empty body rejected with 400; author can edit own comment; Lead cannot rewrite author's words (403); Lead can delete comments for moderation; comment author can delete own comment.
  - Activity audit trail: Structured activity events recorded for task creation, status changes, assignment changes, and comments.
  - Cross-organization isolation: Non-member denied access to organization tasks (403); cross-org route tampering rejected with 404/403.
- Fix attempt history:
  - 0 unsuccessful attempts; all 33 task tests passed on first run.
- Limitations: Local PostgreSQL cluster on port 5433. Production deployment, hosted databases, and physical device verification remain separate.

### Phase 6 detailed results (2026-09-17T01:03:00+08:00)

- Command `npm run check`: Passed, 33 JavaScript files verified with `node --check`, zero syntax errors, broken imports, or missing references.
- Command `npm run test:announcements`: Passed 25/25 tests across 8 suites in 1.8s on Node v24.14.0 and PostgreSQL 18.4 (port 5433).
- Command `npm test`: Passed 102/102 tests (22 auth, 22 members, 33 tasks, 25 announcements) in 9.1s with zero regressions.
- Command `npm run test:ui`: Passed 8/8 Playwright tests in 35.1s.
- Scenarios verified:
  - Draft creation: Lead can create draft targeted to permitted organization; Owner can create draft across multiple organizations.
  - Role restrictions: Regular Member cannot create announcements (403 Forbidden).
  - Target boundaries: Lead cannot target organization where they lack Lead authority (403 Forbidden).
  - Input validation: Rejects empty or oversized title and body with 400 Bad Request; rejects empty or non-existent target organizations with 400 Bad Request.
  - Draft privacy protection: Drafts are strictly confidential; only Leads/Owner with authority in all target organizations can see drafts; Members and unrelated Leads cannot see drafts (403 Forbidden).
  - Draft editing and concurrency: Lead can edit draft title and body; stale version edit rejected with 409 Conflict.
  - Publication and immutability: Published announcement is visible to members of target organizations and excluded from non-member organizations; once published, title, body, and targets are strictly immutable (edits rejected with 400 Bad Request); duplicate publication rejected with 400 Bad Request.
  - Archival: Authorized Lead can archive announcement; archived announcements excluded from default list, included with `archived=true`; archived announcements are read-only (edits rejected with 400 Bad Request).
  - Target-scoped activity history: Activity events are recorded per target organization; user only sees events for organizations where they hold active membership.
  - Scoped and combined overview: Scoped overview calculates member, task, overdue, and announcement metrics per organization; combined overview (`scope=all`, Owner only) correctly deduplicates unique users, tasks, and multi-org announcements; non-owner access rejected with 403 Forbidden.
- Fix attempt history:
  - Attempt 1: In `server/announcements/service.js`, `createAnnouncement` omitted the `action` parameter from the parameter array in `INSERT INTO activity_events`, causing a parameter count mismatch error.
  - Fix: Passed `action` into the query parameter list. All 25 tests passed immediately on first retry.
- Limitations: Local PostgreSQL cluster on port 5433. Production deployment, hosted databases, and physical device verification remain separate.

### Phase 7 detailed results (2026-09-17T06:36:00+08:00)

- Command `flutter analyze` in `mobile/`: Passed with 0 diagnostics found in 3.8s.
- Command `flutter test` in `mobile/`: Passed 25/25 tests across 4 suites in 7s.
  - `mobile/test/widget_test.dart`: Passed 5/5 widget navigation, scope switching, role restrictions, disabled offline writes, and text scaling tests.
  - `mobile/test/secure_cache_service_test.dart`: Passed 9/9 snapshot bounding, 512 KiB eviction, account/scope isolation, 24h/session expiry, and corrupt storage handling tests.
  - `mobile/test/api_client_test.dart`: Passed 6/6 network error discrimination, serialized token refresh, session revocation, and HTTP error mapping tests.
  - `mobile/test/app_repository_test.dart`: Passed 5/5 real API sync, offline snapshot fallback, write rejection, 403 scope purge, and sign-out account purge tests.
- Command `flutter build apk --debug` in `mobile/`: Passed, built `build/app/outputs/flutter-apk/app-debug.apk` in 49.6s.
- Emulator execution on `Medium_Phone` (Android 17, API 37, x86_64 headless emulator):
  - Fastify server running on `0.0.0.0:3000` connected to PostgreSQL on port 5433 (`pipeline_dev`).
  - Streamed install of debug APK and launched `com.pipeline.mobile/.MainActivity`.
  - Android emulator accessed backend via `http://10.0.2.2:3000/api`.
  - Four destinations exercised with real backend data: Overview, Members, Tasks, and Announcements.
  - Task detail view opened, displaying labels, dates, priority, assignee, and comments.
  - Disabled offline writes verified: write operations in offline mode rejected with user-facing notification and never queued.
  - Scope revocation verified: 403 Forbidden on revoked organization clears scope cache and blocks stale display.
  - Sign out verified: clears all account cache entries from secure storage.
- Screenshots saved:
  - `docs/evidence/screenshots/p7-android-overview.png`
  - `docs/evidence/screenshots/p7-android-members.png`
  - `docs/evidence/screenshots/p7-android-tasks.png`
  - `docs/evidence/screenshots/p7-android-announcements.png`
  - `docs/evidence/screenshots/p7-android-task-detail.png`
- Fix attempt history:
  - Attempt 1: 200 percent text scaling test overflowed by 29px in `mobile/lib/screens/home_shell.dart` `AppBar.title` when the manual refresh button was added.
  - Fix: Wrapped `title: Row(...)` in `FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft)`. All widget tests passed immediately on first retry.
  - Attempt 2: In `mobile/test/api_client_test.dart`, async error test `expect(() => client.get(...), throwsA(...))` did not await the returned future before subsequent assertions executed.
  - Fix: Replaced with `await expectLater(() => client.get(...), throwsA(...))`. All API client tests passed immediately on first retry.
- Limitations: Headless emulator verified on API 37. API 24 emulator and physical Android devices remain pending Len's verification.

During execution, add a row for each actual check with requirement IDs, literal command or scenario, exit result, ISO timestamp, versions and conditions, and screenshot path where relevant.

Keep failures and fix attempts visible instead of replacing them with a final passing conclusion.

## External release evidence

| Release check | Actual result | Ownership or prerequisite |
| --- | --- | --- |
| Physical Android devices | Not run | Len supplies physical-device results. |
| Real Safari | Not run | Safari-capable hardware/access; WebKit automation is separate. |
| Production HTTPS and hosted performance | Not run | Hosting, domain, and deployment authorization. |
| Real SMTP delivery | Not run | Provider credentials and explicit authorization to send. |
| Automated hosted backups and restore | Not run | Production storage, schedule, and retention configuration. |
| Signed Android distribution | Not run | Signing identity and distribution authorization. |
| Production retention and erasure | Not decided | Len's production release decision. |

Pending external release checks do not block independent local work and prevent claims of production readiness.
