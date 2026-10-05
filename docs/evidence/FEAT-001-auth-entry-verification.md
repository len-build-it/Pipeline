# FEAT-001 Android account entry verification

Created: 2026-10-05T08:41:51+08:00
Updated: 2026-10-05T09:56:00+08:00
Feature: FEAT-001 revision 4
Plan: PLAN-005 revision 2

## Environment and boundaries

Execution is on Windows, branch codex/organization-manager-mvp, baseline 1f588dd7d866cb242d1a867dd25513d749c62a46.
Flutter 3.44.7, Dart 3.12.2, Node 24.14.0, and npm 11.9.0 are the installed toolchain.
The authentication test helper validates a disposable pipeline_test PostgreSQL 18 database at loopback port 5433 against the separate pipeline_dev target before migration, truncation, and synthetic seeding.
Tests use the existing test email capture, not live delivery.
No new dependency or schema migration was introduced.
The installed Medium_Phone AVD uses API 37.1; the API 24 and API 36 emulator scenarios were dropped by Len in PLAN-005 revision 2 and are unverified, as recorded under Phase 3.

## Phase 1

At 2026-10-05T08:41:51+08:00, flutter analyze passed with no issues.
The full flutter test --reporter expanded suite passed 67 tests and skipped one existing FINANCE_LIVE_API test because its opt-in variable was not set.
The npm run test:auth suite passed all 27 tests against the dedicated disposable database.
The git diff --check command passed.

The new auth_entry_test.dart covers fresh signed-out launch with zero API requests and no synthetic records, empty credential fields, generic credential errors preserving email, loading and duplicate-submit prevention, keyboard next/done, and password visibility labels.
A 360 by 640 logical-pixel widget viewport at 200 percent text scale with a 260-pixel keyboard inset kept the primary action scrollable, without layout exceptions, with sign-in and password visibility targets at least 48 logical pixels.
Repository tests cover cold restoration with session ID, memory-only access token, saved permitted scope, safe fallback after membership removal, eligible same-account offline cache, no-cache offline rejection while retaining refresh credentials for retry, absolute expiry, known revocation, and logout cleanup.
A root navigation test proves logout removes a pushed protected detail page and returns to sign-in.
These are widget and mocked-HTTP results, not emulator or physical-device evidence.

Initial Flutter checks found an invalid const Semantics constructor, an invalid test focus getter, scope-denial behavior changed by continuing the refresh, and block-style lint findings.
The first correction resolved the compile and scope errors; all tests then passed, with two remaining block-style lint findings.
The second correction resolved those lint findings and analysis passed.
No unresolved failure remains from these checks.

Review confirmed that session context contains only identity, membership role/status, organization metadata, scope, and expiry; access tokens, passwords, invitation codes, membership notes, skills, and interests are excluded.
The server refresh response now carries the original absolute expiry, and refresh cookies do not extend the database session lifetime.
The old sign-in and invitation dialogs and their development-prefilled credentials were removed from the shell.
Live account controls omit demo persona, simulation, and reset controls.
Explicit demo and invitation entry actions are connected in the following approved phases.
Phase 1 checkpoint message: feat(mobile): add dedicated sign-in and session restore.

## Phase 2

Recorded: 2026-10-05T08:47:58+08:00
Flutter analysis passed with no issues and the full Flutter suite passed 71 tests with the Finance and auth live opt-in tests skipped in the default run.
The dedicated npm run test:auth suite passed 28 tests, including rejected anonymous acceptance, rejected wrong-account acceptance, untrusted body identity rejection, matching authenticated acceptance, invalid tokens, expired invitations, email mismatch, single-use replay rejection, and concurrent acceptance.
The AUTH_LIVE_API=http://127.0.0.1:3100/api flutter test test/auth_live_test.dart --reporter expanded scenario passed against a server built with the existing test helper and disposable loopback database.
The real Flutter client created a synthetic invitation through the Owner API, previewed its organization/recipient/role, accepted it using the singular route and actual success response, signed in the new account, restored its session, and rejected replay.
A second synthetic invitation rejected anonymous and Sam-account acceptance before accepting Jordan's authenticated account and granting the intended membership.
The local server used nodeEnv test with captured email and no live recipient or delivery.

Widget coverage exercises raw codes and pasted URL fragments, malformed links, new-account recipient validation, account creation before sign-in, existing-account sign-in before explicit acceptance, bearer headers without password on existing-account acceptance, network retry, expired status, and consumed status.
The initial invitation test fixture incorrectly contained 66 hexadecimal characters instead of the server's 64; one fixture correction/check resolved all four invitation failures.
Initial analyzer block-style and unused-import findings were corrected and final analysis passed.
No unresolved Phase 2 failure remains.

Review confirmed that invitation state stays in screen memory and no token is written to secure context or error text.
Server request-log serialization redacts preview tokens from URLs; existing password/token redactions and rate limits remain.
Existing-account identity comes only from verified authentication, not the request body, and is checked inside the existing acceptance transaction before membership mutation.
The web acceptance caller now supplies its existing in-memory bearer token when authenticated.
Phase 1 checkpoint is a3d9e9648abadede8b11dacaede1d9e14ffab325.
Phase 2 checkpoint message: feat(auth): add invitation account setup flow.

## Phase 3

Recorded: 2026-10-05T09:56:00+08:00
Phase 2 checkpoint is de653b9b52728842ba7e5ebde6660ecc1eb5ac55.

### Software checks

Between 09:50 and 09:54 on 2026-10-05, from `mobile/`, flutter analyze passed with no issues.
The full flutter test suite passed 77 tests and skipped the two opt-in live API tests.
The flutter build apk --debug command built `app-debug.apk`; the APK was not installed on any emulator or device after this build.
From the repository root, npm test passed 251 tests across auth 28, members 22, tasks 36, announcements 25, finance 124, and security 16, on the local PostgreSQL 18 test database at loopback port 5433.
The git diff --check command passed.

The new demo_entry_test.dart covers explicit demo entry with zero API requests and no secure-storage writes, the Demo banner, reset of a local demo change after leaving and re-entering, Android back closing a secondary route before leaving demo, and the four demo destinations at 200 percent text on a 360 by 640 logical-pixel viewport.
These are widget results, not emulator or physical-device evidence.

The first full Flutter run of this session failed one test: the demo navigation test at 200 percent text reported a 28-pixel bottom overflow in the Tasks screen filter bar.
The earlier session's log shows the same test failing at 09:14; how many corrections that session attempted is not recorded.
One correction capped the Tasks filter bar at 30 percent of the screen height and made it scroll, and the next full run passed.
No unresolved Phase 3 software failure remains.

### Emulator results and limits

Len deleted the workspace-local Android SDK and the `Pipeline_API_24` and `Pipeline_API_36` emulators at about 09:50 on 2026-10-05 to reclaim disk space, and dropped the API 24 and API 36 emulator gates in PLAN-005 revision 2.
The complete signed-out, demo, invitation, sign-in, session-restore, offline-cache, account-switch, and sign-out journey was not completed on either emulator.
The last automated scenario run on each emulator, at 09:15, stopped with an unexpected screen state while waiting for the Demo banner; it was not rerun after later corrections.
The earlier session's handoff note reports that the normal-size demo exit, re-entry, and Android back journey passed on API 36 at 09:07; this session did not reproduce it.
No emulator check was made at 200 percent text scale, and no authenticated landing screenshot was captured.
API 24 and API 36 behavior for this feature is therefore unverified, and physical-device validation remains with Len.

### Screenshots

The earlier session captured these on the two emulators at normal text scale through its ignored scenario script; this session inspected each image.

| Screenshot | Emulator | Shows |
| --- | --- | --- |
| [api24-sign-in-100.png](screenshots/FEAT-001-auth-entry/api24-sign-in-100.png) | Pipeline_API_24 | Sign-in page with empty fields, invitation link, and Try demo. |
| [api24-demo-100.png](screenshots/FEAT-001-auth-entry/api24-demo-100.png) | Pipeline_API_24 | Demo overview with the Demo - sample data banner and four destinations. |
| [api36-sign-in-100.png](screenshots/FEAT-001-auth-entry/api36-sign-in-100.png) | Pipeline_API_36 | Sign-in page with empty fields, invitation link, and Try demo. |
| [api36-invitation-100.png](screenshots/FEAT-001-auth-entry/api36-invitation-100.png) | Pipeline_API_36 | Invitation setup for a synthetic example.com recipient. |
| [api36-demo-100.png](screenshots/FEAT-001-auth-entry/api36-demo-100.png) | Pipeline_API_36 | Demo overview with the Demo - sample data banner and four destinations. |

The screenshots predate the final semantics and Tasks filter corrections, so they show appearance at capture time only.

Review confirmed that demo runs on a fresh in-memory repository outside the authenticated repository, that demo-only controls stay in the demo account menu, and that no dependency was added.
Phase 3 checkpoint message: feat(mobile): isolate demo access from live accounts.
