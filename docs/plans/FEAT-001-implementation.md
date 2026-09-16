# Implementation plan for the organization management MVP

Created: 2026-09-16T21:46:00+08:00
Updated: 2026-09-16T22:00:00+08:00
Revision: 1
Status: Approved
Executor: Gemini 3.8, selected by Len in the execution environment.
Target branch: codex/organization-manager-mvp, created from master at 87f7ec8.
Inspected starting commit: 87f7ec8, initial commit.
Len's chat approval: Approved on 2026-09-16T21:57:07+08:00: "Read and execute /C:/Users/User/Desktop/PersonalProjects/04-FUN-STUFF/Pipeline/docs/plans/FEAT-001-implementation.md you are not allowed to manipulate any files outside of this folder"

## Scope and approval package

This is one coordinated plan for FEAT-001 through FEAT-005 because the two clients share authentication, organization permissions, data, and UI behavior.

Start with usable UI flows on both clients, then connect the backend and complete the full local MVP.

The single task checklist lives here, with [../../IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) serving only as an entry point.

| Document | Revision for this plan | Responsibility |
| --- | --- | --- |
| [PROD-001 Overview](../product/OVERVIEW.md) | 2 | MVP purpose and exclusions. |
| [PROD-002 Architecture](../product/ARCHITECTURE.md) | 2 | Stack, dependencies, sessions, and service boundaries. |
| [PROD-003 Data model](../product/DATA_MODEL.md) | 2 | Roles, field limits, lifecycle, privacy, and dates. |
| [PROD-004 Constraints](../product/CONSTRAINTS.md) | 3 | Platform matrix and verification targets. |
| [PROD-005 UI and UX](../product/UI_UX_DESIGN.md) | 2 | Navigation, visual system, accessibility, and state behavior. |
| [FEAT-001 Access and dashboard](../features/FEAT-001-access-dashboard.md) | 2 | REQ-001 through REQ-008. |
| [FEAT-002 Members](../features/FEAT-002-member-management.md) | 2 | REQ-001 through REQ-009. |
| [FEAT-003 Tasks](../features/FEAT-003-task-management.md) | 2 | REQ-001 through REQ-008. |
| [FEAT-004 Announcements](../features/FEAT-004-announcements.md) | 2 | REQ-001 through REQ-008. |
| [FEAT-005 Mobile](../features/FEAT-005-mobile-offline.md) | 2 | REQ-001 through REQ-008. |

One approval of this table and plan authorizes all eight phases, the named dependencies and normal compatible transitive packages, local test infrastructure, and reviewed local phase commits.

It does not authorize pushing, paid services, production deployment, sending invitations to real people, or store publication.

The earlier approval of proposal bullets and later request to create this plan are recorded as actual decisions, but do not imply approval of newly selected stack or privacy policies.

## Start and resume protocol

1. Read AGENTS.md, GEMINI.md, HANDOFF.md, this plan, and every document in the approval table, then verify that the handoff records approval of these exact revisions.
2. Run `npx len-toolkit start` once in the execution session and inspect any reported differences without overwriting custom instructions.
3. Inspect `git status --short --branch`, `git diff`, `git diff --cached`, and `git log -10 --oneline` before editing.
4. Preserve the existing untracked HANDOFF.md and docs directory as this planning package; do not interpret them as disposable output.
5. If starting from master, create `codex/organization-manager-mvp` without resetting or discarding edits; if that branch already exists, inspect and reuse it only when it is the matching checkpoint branch.
6. Verify tools with `node --version`, `npm --version`, `flutter --version`, `flutter doctor -v`, `flutter emulators`, `flutter devices`, and `pg_isready -h 127.0.0.1 -p 5432`.
7. Use Node 24, installed Flutter 3.44.7, and PostgreSQL 18; do not upgrade the user's global toolchain merely because a newer release is advertised.
8. Reconcile checked tasks with evidence and actual commits; resume the first incomplete phase rather than replaying completed work.

Planning inspection found Node 24.14.0, Flutter 3.44.7 with Dart 3.12.2, PostgreSQL client 18.4, and a PostgreSQL server accepting connections at localhost:5432.

The toolkit setup check completed with zero installed files and no tracked instruction changes.

Docker CLI exists but its engine was unavailable; database authentication, Android SDK readiness, emulator availability, and browser binaries were not verified.

Do not guess local database passwords or read unrelated credential stores.

Use provided credentials for dedicated development and test databases, or a project-local PostgreSQL 18 container if Docker is available; never repurpose an unrelated database.

Missing database credentials or emulator access blocks the affected integration checks, not independent UI work.

Request any real access issue once with a precise explanation, finish independent approved work, and leave dependent phases incomplete until access is available.

## Execution authority and stop rules

After the one-time approval, implement, verify, review, document, commit, and continue through all remaining phases without asking whether to proceed.

Choose file organization, internal helper names, test data, copy refinements that preserve meaning, and ordinary layout details within the approved design without additional approval.

Resolve and lock compatible versions of the named packages without separate dependency-selection questions.

Do not stop for wireframe approval, mock-data review, a successful phase checkpoint, pending production credentials, or Len's later physical-device validation.

Stop affected work only for a required scope or architecture change, a new direct dependency, inaccessible required infrastructure, a Git conflict that risks unrelated edits, an exhausted three-attempt problem, or an external action outside the approved scope.

Do not disguise a missing verification result as a pass or silently remove a failing gate to continue.

The pending DOCX review artifact and its renderer are unrelated to application execution and never gate these phases.

## Proposed repository and command contract

Use a root npm package for the Node service, web client, and web/API tests, with `server/`, `web/`, `db/migrations/`, `scripts/`, and `tests/` for the minimum necessary separation.

Use `mobile/` for the Flutter Android project, with `mobile/test/` and `mobile/integration_test/` for relevant checks.

These folders and commands do not exist yet; the named phase must create them before their checks can run.

Do not treat the command table as evidence that anything has passed.

| Command and directory | Establish in | Required contract |
| --- | --- | --- |
| `npm run check` at root | P1 | Parse application JavaScript and verify local module/static references; exit nonzero on errors. |
| `npm run demo` at root | P1 | Start a loopback-only web demo with synthetic records and an obvious Demo label. |
| `npm run test:ui` at root | P1 | Run Playwright against synthetic API responses for navigation, responsive layout, forms, and states. |
| `npm start` at root | P3 | Start real Fastify service, API, and static assets with no demo identity fallback. |
| `npm run db:migrate` at root | P3 | Apply ordered SQL migrations transactionally to the selected dedicated development database. |
| `npm run db:migrate:test` at root | P3 | Migrate only a separately configured test database; refuse the development or production URL. |
| `npm run test:auth` at root | P3 | Run Node test-runner authentication, invitation acceptance, and organization isolation checks. |
| `npm run test:members` at root | P4 | Run member lifecycle, privacy, role, and mail-failure API checks against PostgreSQL. |
| `npm run test:tasks` at root | P5 | Run task authorization, dates, filters, comments, and conflict API checks. |
| `npm run test:announcements` at root | P6 | Run audience, publication, archive, search, and dashboard count API checks. |
| `npm test` at root | P3, extend P4-P6 | Run all current Node unit and API checks; required integration configuration missing means failure, not silent skip. |
| `npm run test:e2e` at root | P6 | Run Playwright flows with real API, dedicated test database, and local capture email. |
| `npm run test:performance` at root | P8 | Load deterministic synthetic data and measure the specified dashboard timing scenario. |
| `npm run test:restore` at root | P8 | Dump a synthetic test database, restore into a separately named disposable database, and verify counts and relationships. |
| `flutter analyze` in mobile | P2 | Check Flutter sources with no unresolved diagnostics. |
| `flutter test` in mobile | P2, extend P7 | Run widgets and relevant state, network, and cache behavior tests. |
| `flutter build apk --debug` in mobile | P2 | Produce a debug APK using the recorded SDK, without demo mode as the default. |
| `flutter test integration_test` in mobile | P7 | Run the integration suite on a selected Android emulator against the local API and synthetic accounts. |

Use Node's built-in test runner and Fastify injection for API behavior tests, Playwright only for browser flows, and Flutter SDK testing tools for Android.

Select the emulator using the actual identifier returned by `flutter devices` and append `-d` with that identifier to the integration command; record the literal resolved command in evidence.

Pass the debug emulator API address through `--dart-define=API_BASE_URL=http://10.0.2.2:3000/api` when needed, and keep cleartext networking limited to the debug build.

Use Node's native environment-file loading for local configuration; example environment files contain names and harmless examples, never working credentials.

Tests must use synthetic accounts, prohibit real email delivery, and refuse destructive setup against databases not explicitly dedicated to the test run.

Pin application dependencies through tool-generated lockfiles and use `npm ci` and `flutter pub get` for reproducible subsequent installs.

## Required checkpoint protocol for every phase

1. Complete the phase tasks and its required checks, including every mandatory scenario.
2. Review correctness, permissions, accessibility, data preservation, scope, and unnecessary complexity.
3. Add actual commands, exit results, timestamps, screenshots, environment details, and limitations to [../evidence/MVP-verification.md](../evidence/MVP-verification.md).
4. Update this checklist and HANDOFF.md with the candidate completed phase, next phase, unresolved issues, and fix-attempt counts.
5. Inspect `git diff --check` and review new untracked files directly because ordinary git diff does not inspect them.
6. Stage an explicit list of reviewed phase files only, then inspect `git diff --cached --check` and `git diff --cached` against the intended scope.
7. If unrelated files were already staged, leave their index entries intact and use a reviewed path-scoped commit; do not include or unstage someone else's work.
8. Commit using the phase's exact unique message, then verify `git log -1 --format='%H %s'`, `git show --stat --oneline HEAD`, and `git status --short`.
9. Only a successful commit plus passing gates completes a phase; the committed handoff may identify its own checkpoint by message, and the next phase records the verified hash.
10. Continue immediately to the next phase; do not create an extra commit solely to insert a checkpoint's own hash.

If a commit fails, the phase remains incomplete and its candidate completion text must not be used as proof; record the failure and reconcile status on resume.

At P8, leave the final committed handoff referencing the unique final message and report the verified final hash in the completion response.

## Phase 1 - Responsive web experience

Requirements: PROD-005/UI-REQ-001 through UI-REQ-007 and UI-REQ-009, plus presentation of FEAT-001 through FEAT-004 flows.
State: Complete.

### Tasks

- [x] Establish minimal Node package, web assets, Playwright UI tests, synthetic fixture data, and the P1 command contract.
- [x] Create the four-destination shell, visible organization switcher, account menu, text wordmark, shared form and feedback styles, and responsive list/detail layouts.
- [x] Implement sign-in and invitation-acceptance screens, Overview, Members with invite and profile editing, Tasks with create/edit/comments, and Announcements with compose, preview, publish, and archive flows using synthetic responses.
- [x] Show Owner, Lead, and Member UI permissions with synthetic personas, meaningful empty states, field errors, retry, denied access, unsaved-change handling, and stale-edit feedback.
- [x] Keep test identities and response interception outside the real application startup; mark the demo clearly and keep demo data synthetic.

### Verification

- [x] Run `npm run check` and `npm run test:ui`; both must exit zero.
- [x] At 375, 768, 1024, and 1440 widths, navigate all destinations, switch scope, open and cancel each form, and confirm no horizontal overflow or hidden primary action.
- [x] Invite, assign a task, change status, and publish in the demo; distinguish these interaction checks from backend correctness.
- [x] Verify keyboard navigation, focus restoration after dialogs, error-summary links, 200 percent zoom, and reduced motion.
- [x] Save desktop and phone screenshots and record explicit Mock UI evidence in the verification ledger.

### Review and checkpoint

- [x] Perform the common checkpoint protocol and include the reviewed planning package in this first checkpoint.

Checkpoint message: `feat(ui): complete responsive organization dashboard experience`
Continue automatically to P2.

## Phase 2 - Flutter Android experience

Requirements: PROD-005/UI-REQ-001 through UI-REQ-007 and UI-REQ-009; FEAT-005/REQ-006; equivalent FEAT-001 through FEAT-004 screen flows.
State: Complete.

### Tasks

- [x] Generate the Android Flutter project through Flutter tooling and configure the approved minimum API level without hand-editing generated artifacts.
- [x] Apply the light theme, four bottom destinations, visible organization scope, native back behavior, consistent labels, and mobile forms and detail views.
- [x] Implement the same synthetic scenarios as the web using an injected HTTP client or data source with a small explicit demo mode that cannot become release authentication.
- [x] Add focused widget tests for navigation, role-specific actions, required fields, errors, text scaling, and disabled offline writes.
- [x] Establish the Android build and test commands, keeping all demo evidence clearly labeled.

### Verification

- [x] Run `flutter analyze`, `flutter test`, and `flutter build apk --debug` in mobile; all must succeed.
- [x] Launch the demo on an Android emulator, exercise all four destinations and form flows, and capture screenshots.
- [x] Verify Android back, keyboard avoidance, 200 percent text scaling, TalkBack labels, and 48 logical-pixel targets.
- [x] Record emulator model, API level, SDK version, and any unrun device checks in evidence.

### Review and checkpoint

- [x] Perform the common checkpoint protocol.

Checkpoint message: `feat(mobile): complete Android management interface`
Continue automatically to P3.

## Phase 3 - Shared data and secure access

Requirements: FEAT-001/REQ-001 through REQ-003 and REQ-005 through REQ-007; shared architecture and data boundaries.
State: Complete.

### Tasks

- [x] Create schema migrations for the shared entities, including membership uniqueness, organization foreign keys, invitation digests, sessions, archival fields, and activity history.
- [x] Establish the dedicated development/test database configuration, migration commands, and synthetic setup without modifying unrelated databases.
- [x] Implement Fastify schemas, safe error responses, logging redaction, parameterized SQL, authenticated scope checks, and same-origin static asset serving.
- [x] Implement login, refresh rotation, sign out, invitation acceptance, local owner provisioning, and local password recovery using the approved policies.
- [x] Connect web sign-in, scope selection, and session expiry handling to real endpoints; retain the separate demo only for UI review.
- [x] Use secure cookies, CSRF and Origin checks for cookie endpoints, rate limits, and safe redirect targets.

### Verification

- [x] Run `npm run db:migrate` twice; the second run must perform no duplicate migration or data recreation.
- [x] Run `npm run db:migrate:test`, `npm run check`, `npm run test:auth`, and `npm run test:ui`; all must pass.
- [x] Check invalid credentials, expired access token, refresh success, replayed refresh token, revoked session, inactive account, and logout followed by token replay.
- [x] Check forged organization identifiers on both reads and writes, global Owner access, dual membership, and direct access without a valid membership.
- [x] Check invite email mismatch, expiry, duplicate/concurrent acceptance, and lost-response retry; assert one membership and no used-token access grant.
- [x] Verify CSRF rejection, no tokens or passwords in captured logs, and that production startup cannot use demo personas.

### Review and checkpoint

- [x] Perform the common checkpoint protocol.

Checkpoint message: `feat(auth): establish shared API and organization access boundaries`
Continue automatically to P4.

## Phase 4 - Real member management

Requirements: FEAT-002/REQ-001 through REQ-009 and related FEAT-001 invitation flows.
State: Complete.

### Tasks

- [x] Implement scoped member listing, pagination, search, roles, status filters, own-profile editing, and membership-private notes.
- [x] Implement invitation creation and resend with local SMTP capture, including delivery failure and token replacement feedback.
- [x] Implement permitted role changes, membership deactivation/reactivation, and atomic open-task unassignment with activity recording.
- [x] Connect the web Members screens to the real API and test invalid and failed saves with input retained.

### Verification

- [x] Run `npm run check`, `npm run test:auth`, `npm run test:members`, and `npm run test:ui`; all must pass.
- [x] Prove Members cannot read notes even by requesting raw API responses, and organization A Leads cannot mutate organization B memberships.
- [x] Prove Leads cannot elevate privileges or alter other Leads, and the global Owner cannot be demoted through membership screens.
- [x] Simulate duplicate invitation, SMTP failure, explicit resend, existing-account acceptance, and concurrent deactivation; verify no duplicate records or cross-organization assignment changes.
- [x] Complete the invite-to-member flow through the local inbox and web UI and capture the result with secrets redacted.

### Review and checkpoint

- [x] Perform the common checkpoint protocol.

Checkpoint message: `feat(members): deliver invitations profiles and membership controls`
Continue automatically to P5.

## Phase 5 - Real task management

Requirements: FEAT-003/REQ-001 through REQ-008.
State: Complete.

### Tasks

- [x] Implement task creation, editing, assignment, permitted member status updates, date and label validation, search, filters, and pagination.
- [x] Implement comments, author editing, lead moderation, activity display, read-only archival, and update-conflict handling.
- [x] Connect all web task controls to the API and provide clear errors for inactive assignees, stale edits, and permissions lost during editing.

### Verification

- [x] Run `npm run check`, `npm test`, and `npm run test:ui`; all must pass with task tests included.
- [x] Verify a Member can update only status on their assigned task, cannot change assignee or organization, and can comment only while they have access.
- [x] Check due-date boundaries in Manila, completed-task exclusion from overdue counts, empty titles, oversized fields, and inactive or foreign assignees.
- [x] Use two clients to trigger an edit conflict and prove neither silent overwrites nor partial activity writes occur.
- [x] Verify cross-organization task/comment identifiers, escaped script-like text, archive read-only behavior, and search/filter combination results.

### Review and checkpoint

- [x] Perform the common checkpoint protocol.

Checkpoint message: `feat(tasks): deliver assignments comments and activity tracking`
Continue automatically to P6.

## Phase 6 - Announcements and actionable overview

Requirements: FEAT-004/REQ-001 through REQ-008 and FEAT-001/REQ-004 and REQ-008.
State: Complete.

### Tasks

- [x] Implement draft creation/editing, audience selection, preview, publication, archive, search, and target-scoped activity history.
- [x] Enforce authorization for every target organization and published-content immutability.
- [x] Implement scoped and combined dashboard summaries with deduplicated users and announcements, plus actionable task and announcement lists.
- [x] Connect the remaining web screens to the real API and establish real-backend Playwright flows.

### Verification

- [x] Run `npm run check`, `npm test`, `npm run test:ui`, and `npm run test:e2e`; all must pass.
- [x] Publish to AqOne only, dev guild only, and both; verify Member visibility, draft privacy, denied partial-audience editing, and archive results.
- [x] Verify cross-organization activity and response metadata do not expose private notes, other target names, or inaccessible drafts.
- [x] Check dashboard totals against known synthetic counts with overlapping memberships, shared announcements, archived tasks, and date-boundary cases.
- [x] In a browser, invite a Member through the local inbox, assign work, complete it as that Member, and publish an announcement as Lead; confirm overview totals and evidence screenshots.

### Review and checkpoint

- [x] Perform the common checkpoint protocol.

Checkpoint message: `feat(announcements): deliver audience publishing and live overview`
Continue automatically to P7.

## Phase 7 - Connected Android and offline reads

Requirements: FEAT-005/REQ-001 through REQ-008; Android parity for all FEAT-001 through FEAT-004 requirements; PROD-005/UI-REQ-008.
State: Complete.

### Tasks

- [x] Connect Android authentication, scope, member, task, comment, announcement, and dashboard screens to the same real API.
- [x] Implement secure credential storage, serialized token refresh, bounded encrypted read snapshots, cache expiry, account/scope isolation, and cleanup on revocation or sign out.
- [x] Implement honest stale-data display, uncached-detail messaging, disabled offline writes, and revalidation before refresh on reconnect.
- [x] Add emulator integration tests against real local services, plus deterministic clock/network tests for cache expiry and auth failures.
- [x] Keep release networking HTTPS-only, protect debug-only emulator networking settings, and disable backup of protected local storage.

### Verification

- [x] Run `flutter analyze`, `flutter test`, `flutter build apk --debug`, and the resolved `flutter test integration_test` emulator command; all must pass.
- [x] On an emulator, create a task on web, see it on Android after refresh, change status on Android, and verify web reflects it after refresh.
- [x] Complete invitation acceptance and role-restricted management flows in Android, including local-inbox link entry, comments, and announcement audience selection.
- [x] Load each primary list, disconnect networking, restart the app, and verify eligible snapshots and visible age; attempt a write and verify no fake success or queue.
- [x] Verify 24-hour and session expiry, size eviction, cold start with no cache, corrupt storage, sign out, account switch, and scope/filter mismatch.
- [x] Deactivate a membership from web, reconnect Android, and verify the affected cache is cleared and access denied; distinguish this from a network timeout.
- [x] Run required emulator flows on API 24 and API 36, including TalkBack and large text, recording each environment separately.

### Review and checkpoint

- [x] Perform the common checkpoint protocol.

Checkpoint message: `feat(mobile): connect shared workflows and secure offline reads`
Continue automatically to P8.

## Phase 8 - Integrated verification and local release handoff

Requirements: All feature requirements and PROD-005/UI-REQ-001 through UI-REQ-009; shared reliability and evidence constraints.
State: Complete.

### Tasks

- [x] Resolve regressions from integrated browser/emulator checks within the approved scope and attempt limit.
- [x] Complete the requirement-to-evidence map, including role denials, input validation, empty/loading/error states, and conflict recovery.
- [x] Add concise local setup, owner bootstrap/recovery, run, backup/restore, dependency lock, and future deployment documentation.
- [x] Supply a deployable service configuration and Android debug APK; keep store signing, real email, hosted backups, and external deployment explicitly pending.
- [x] Establish performance and safe local restore commands and record real outcomes.

### Verification

- [x] From the locked dependencies, run `npm ci`, `npm run check`, `npm test`, `npm run test:ui`, and `npm run test:e2e`; all must pass.
- [x] In mobile, run `flutter pub get`, `flutter analyze`, `flutter test`, `flutter build apk --debug`, and the required emulator integration commands.
- [x] Run `npm run test:performance` against the stated dataset and network conditions and meet the documented p95 target.
- [x] Run `npm run test:restore`; verify relationships, active memberships, tasks, publication targets, and activity counts in the separate restored database.
- [x] Check Chrome, Edge, Firefox, and Playwright WebKit with recorded versions and screenshots; mark real Safari separately if unavailable.
- [x] Verify keyboard and TalkBack flows, 200 percent scaling, target sizes, palette contrast, offline behavior, and no unintended horizontal overflow.
- [x] Check the final tracked/staged content for secrets, synthetic-only account data, unintended generated output, and unrelated files.

### Review and checkpoint

- [x] Perform the common checkpoint protocol and mark local software completion only when every required local gate and all eight commits are verified.

Checkpoint message: `test(release): verify integrated MVP and document local release`

After success, provide the eight verified commit hashes, local run instructions, debug APK path, evidence links, and the separate pending release checks.

## Recovery and completion rules

For each issue, record the initial failure, affected requirement, exact check, cause investigation, and each subsequent fix-and-check attempt in HANDOFF.md.

After three unsuccessful attempts on the same issue, stop dependent work and report the evidence, outstanding changes, and smallest decision or access required.

A renamed error or new session does not reset the count.

Continue independent approved work where dependencies permit; do not mark out-of-order completed work as passing a blocked earlier integration gate.

Interrupted or failing work stays uncommitted; preserve it and write the exact next action before ending the session.

An unavailable emulator, database, or required browser leaves its phase incomplete, even if the corresponding build or unit tests passed.

External release decisions and physical-device checks remain pending without preventing verified local completion as defined in the shared constraints.

No phase completion message should end with a routine request to continue.
