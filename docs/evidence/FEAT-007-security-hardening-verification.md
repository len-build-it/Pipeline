# FEAT-007 Security Hardening Verification

Evidence ID: EVID-004.
Created: 2026-10-04T23:32:17+08:00
Updated: 2026-10-05T01:11:28+08:00
Feature and plan: FEAT-007 revision 1 and PLAN-004 revision 1, approved by Len in chat on 2026-10-04T23:19:00+08:00.
Phase: PLAN-004 Phases 1 through 5 complete and committed locally.
Implementation revision: Phase 1 checkpoint `de94ccbf9503a171364e0a6b4bdbfca49e485ce6`; Phase 2 checkpoint `a201fb3a2dd5cfc86ceb0321df6bc5a0bf286ce8`; Phase 3 checkpoint `27698745a0207b996259ea6de4edf3d1d0d806b5`; Phase 4 checkpoint `ddee080336c97abe0b4c35584165d1628ea7854f`; Phase 5 checkpoint `697bfb27e90aa3bae32069a56ac5de16e437decf`.

## Scope and environment

Phase 1 implemented production JWT configuration validation, production seed refusal, parsed PostgreSQL test-target checks, and restore-target checks before database access.

The implementation and checks used Node.js v24.14.0, npm 11.9.0, and PostgreSQL 18.4.

Database-backed checks used the isolated PostgreSQL 18 instance on loopback at 127.0.0.1:5433, with synthetic data in `pipeline_test` and the disposable `pipeline_restore_test` database.

No production database, deployment environment, production credential, or customer data was accessed.

## Candidate validation

`auth.jwt-secret-fallback` is covered by pure configuration tests and a server CLI subprocess check that refuses the fallback or a short secret before contacting PostgreSQL.

`bootstrap.seed-default-owner-credentials` is covered by function and CLI checks that refuse production seed execution before opening a database.

`db.migrate.test-url-alias` is covered by synthetic URL tests for normalized loopback aliases, a development database alias with differing URL options, remote hosts, blocked connection-target options, and credential-safe refusal messages.

`scripts.test-restore.environment-selected-target` is covered by subprocess checks for remote `PGHOST`, mismatched ports, `PGHOSTADDR`, and `PGSERVICE`; each unsafe case exits before source preparation.

`overview.archived-org-active-membership` is covered with a synthetic archived organization, active non-Owner membership, and task record; the member is denied without the task data while Owner access remains available.

`finance.xlsx-sparse-row-index` is covered by a synthetic workbook with its only data row at worksheet row 5,002; the row-span guard refuses it before the import loop scans missing rows.

`finance.unbounded-xlsx-export` is covered with 5,000 synthetic matching expenses and one additional matching expense; exactly 5,000 exports completely, while the over-limit query reads only 5,001 records and returns a validation error without a workbook.

These checks establish the new refusal behavior and regression coverage, not evidence of an exploit in a deployed environment.

The archived overview scenario is synthetically represented by the checked-in schema but does not establish that a deployed organization was archived with active membership.

The sparse workbook test verifies early row-span rejection but does not benchmark pre-fix CPU or memory use under the unavailable OS-enforced audit sandbox.

The export test establishes the bound with synthetic records but does not measure historical production load or shared service capacity.

Whether a production deployment has a compliant secret, whether seed execution occurred against a production target, and whether any hosted environment has unsafe database overrides remain unable to validate without owner-provided production evidence.

## EVID-003 candidate dispositions after local implementation

EVID-003 remains an incomplete audit, and its candidates remain unconfirmed because its required independent validators and OS-enforced reproduction sandbox were unavailable.

The results below document local regression and remediation evidence; they do not assert that any candidate affected a production deployment or establish a severity.

| Candidate fingerprint | Local result | Remaining disposition |
| --- | --- | --- |
| `auth.jwt-secret-fallback` | Synthetic configuration tests reject a missing, short, or development-fallback production secret before server startup or database access. | Unable to validate the effective secret or fallback-token acceptance in a hosted deployment. |
| `bootstrap.seed-default-owner-credentials` | Synthetic policy and CLI checks refuse production seeding before a database connection and preserve the development seed path. | Unable to validate any historical production seed execution or credential rotation. |
| `db.migrate.test-url-alias` | Synthetic normalized URL and connection-target cases reject unsafe database targets before destructive SQL; the isolated loopback test database remains usable. | Unable to validate the effective database identity supplied by a hosted or lower-trust runner. |
| `scripts.test-restore.environment-selected-target` | Synthetic host, port, `PGHOSTADDR`, and `PGSERVICE` overrides are refused before source preparation. | Unable to validate actual hosted restore-runner environment or target history. |
| `overview.archived-org-active-membership` | A synthetic archived organization with an active non-Owner membership is denied without returning organization records; Owner and active-organization cases remain covered. | Unable to validate whether a deployed archive lifecycle produced this state. |
| `finance.xlsx-sparse-row-index` | A synthetic nonblank row at worksheet row 5,002 is rejected before iteration across the sparse gap. | Unable to validate pre-fix CPU or memory impact under the unavailable audit sandbox. |
| `finance.unbounded-xlsx-export` | Synthetic exports complete at 5,000 records and reject 5,001 matches after reading at most 5,001 rows, without returning a partial workbook. | Unable to validate historical production record counts or shared-service impact. |
| `tasks.comment-history-unbounded` | Synthetic 105-comment and 105-activity histories are reachable through stable pages capped at 100, with no missing or duplicate IDs. | Unable to validate pre-fix production history sizes or performance impact. |
| `web.stored-display-name-html-injection` | The pre-fix synthetic browser flow created an image element and fired its event marker; the fixed UI displays the same name as text without an element or event. | Local browser behavior is reproduced and remediated; no real external profile payload or hosted browser session was tested. |
| `mobile.denial-keeps-memory-records` | Repository, widget, and API 37 emulator checks verify account cleanup on terminal 401, scoped cleanup on 403, screen gating during cache deletion, and continued access to a second organization. | No physical-device or production session was tested; the pre-fix effect was not separately replayed on the emulator. |

These are local implementation dispositions, not independent audit verification; EVID-003 remains incomplete until its validator and independent-review gaps are resolved.

## Verification results

On 2026-10-04 PHT, `npm run test:security` passed all 16 tests with zero failures.

On 2026-10-04 PHT, `npm test` completed successfully with exit code 0 and all 244 tests passing across authentication, members, tasks, announcements, finance, and security suites.

On 2026-10-04 PHT, `npm run test:restore` completed successfully against the isolated loopback PostgreSQL 18 instance.

The restore check seeded 2 organizations, 5 users, 7 active memberships, 5 tasks, 3 announcements, and 4 activity events in the synthetic source database.

The check dumped `pipeline_test`, created `pipeline_restore_test`, restored the dump, matched all listed counts and announcement targets, and exactly matched 2 budgets, 4 expenses, 1 import batch, and 4 finance history events.

The check verified zero orphaned relational records, dropped `pipeline_restore_test`, and removed `.db/restore_temp.sql`.

On 2026-10-04 PHT, `git diff --check` completed with exit code 0.

On 2026-10-04 PHT, `npm run test:auth` passed all 27 tests, including archived-organization member denial and preserved Owner behavior.

On 2026-10-04 PHT, `npm run test:finance` passed all 124 tests, including the 5,000 and 5,001 export boundary, filtered exports, and the sparse worksheet row test.

On 2026-10-04 PHT, `npm run test:security` passed all 16 security tests.

On 2026-10-04 PHT, the complete `npm test` gate exited 0 with 247 passing tests.

On 2026-10-04 PHT, `npm run test:e2e` passed all 13 Playwright workflows in 52.7 seconds using Playwright 1.63.0.

The first full finance run exposed fixture leakage from the new export-boundary test into the following workbook round-trip test; a `finally` cleanup was added, after which the focused export test and full finance gate passed.

A later finance run found two assertions expected a comma in the numeric row limit while the error message uses `5000`; the assertions were corrected and the final finance gate passed all 124 tests.

The test setup validated refusal paths synthetically and verified successful migration, truncation, seeding, and restore only on the isolated loopback test cluster.

## Phase 3: Bounded task comment and activity history

The baseline task service selected and returned complete comment and activity histories without a row limit; this source-level behavior motivated the candidate, but no pre-fix production benchmark or production exploitability claim is made.

Both task history APIs now default to 50 rows, accept a validated maximum of 100 rows, and fetch one extra row to determine whether a continuation cursor is needed.

The base64url cursor contains the last returned timestamp and unique row ID; the server bounds and canonicalizes the cursor, validates timestamp calendar and offset fields, and applies a lexicographic timestamp-and-ID predicate to each task-scoped query.

The query order returns newest records first, while older pages continue from the final item in the previous page; a newer synthetic comment inserted between requests did not change the older-page traversal.

The default history query bound is 51 rows for a 50-row page and 101 rows for a requested 100-row page; activity also performs one scoped task-existence lookup before its bounded history query.

The existing list order was retained in the new API response objects, with `nextCursor` added to both `{ comments }` and `{ activity }` responses.

The activity endpoint now confirms that the requested task belongs to the requested organization before returning activity, so a caller who belongs to the URL organization cannot use a foreign task ID to cross the boundary.

Migration `003_task_history_pagination.sql` adds `(task_id, created_at DESC, id DESC)` for comments and a task-event partial index on `(organization_id, entity_id, created_at DESC, id DESC)` because the original indexes did not support the full bounded ordering.

The web task detail modal now fetches its first comments and activity pages, shows the total comment count supplied by task listing, and adds accessible Load older controls with status and retry messaging.

Comment row actions use event delegation so edits and deletes keep working on comments loaded from later pages; the activity section escapes stored actor, action, ID, and timestamp values before rendering.

The shared `[hidden]` CSS rule was added after browser verification found that button display styling overrode the browser default and left exhausted Load older controls visible despite their hidden attribute.

The focused task suite passed 36 tests, including equal-timestamp tie ordering, 50-row defaults, the 100-row maximum, invalid limits, malformed and impossible-date cursors, continuation with no gaps or duplicates, insertion between comment pages, and cross-organization task denial.

The live E2E fixture inserted 105 synthetic comments and 105 synthetic activity events for one isolated test task; the browser read three pages for each history and verified all 105 IDs were unique and present.

The E2E fixture uses PostgreSQL `NOW() + INTERVAL '1 day'` so its equal-timestamp rows sort ahead of the task's ordinary audit events; assertions count the 105 synthetic event IDs separately from those older normal events.

The responsive UI fixture loaded mock cursor pages and verified keyboard activation, visible focus, restored opener focus, and no page-level horizontal overflow at 375, 768, 1024, and 1440 CSS pixels.

The narrow task detail capture showing the continuation control is [FEAT-007-task-history-375.png](screenshots/FEAT-007-task-history-375.png).

The test environment was Node.js v24.14.0, npm 11.9.0, PostgreSQL 18.4 on the isolated loopback test instance, Playwright 1.63.0, and headless Microsoft Edge 138.0.3351.121.

On 2026-10-05 PHT, `npm run test:tasks` passed 36 tests and the complete `npm test` gate passed all 250 tests across six test groups.

On 2026-10-05 PHT, `npm run test:e2e` passed 14 Playwright workflows in 53.3 seconds, including the 105-comment and 105-activity pagination journey.

On 2026-10-05 PHT, `npm run test:ui` passed all 14 UI workflows in 40.1 seconds, including all four planned viewport widths.

Focused screenshot refresh reruns of the task pagination UI and E2E specs also passed after moving the capture to the visible older-comments control; the E2E rerun produced the checked-in narrow screenshot.

Resolved test setup issues were recorded rather than counted as passing attempts: the activity fixture initially used a timestamp older than ordinary audit events, the first phone UI selector targeted a hidden desktop table row, the E2E login began in demo mode, and the first phone E2E selector likewise targeted the hidden desktop row.

The browser regression then exposed the actual hidden-button CSS behavior; a global hidden-state rule fixed the product behavior, and the focused E2E plus complete browser suites passed afterward.

All history fixture data used synthetic task IDs, users, comments, and activity in the isolated `pipeline_test` database; no production account or customer record was accessed.

## Phase 4: Escape stored member names at web rendering boundaries

The synthetic profile test updated Sam Taylor's display name to markup containing an image with an event counter, then opened task creation as Alex Rivera so the stored value reached another member's assignee selector.

Before the fix, the task-create modal contained one actual `#stored-name-probe` image generated from the assignee option; a separate run updating the active user's own name fired the synthetic event in the shell and malformed the rendered application enough to hide the task-create button.

The regression setup now stores the malicious name for one member and switches to another lead, isolating the stored assignee-name path while the event counter confirms the shell path is also protected.

The fix escapes the current user's initials and display name in the application shell, the display-name value in the profile input, the assignee option's user ID and display name, and the organization option ID with the existing `escapeHtml` helper.

Member list, task-detail, comment, and other task-assignee rendering paths already escaped display names and were reviewed without needing behavior changes.

The focused UI test saves a synthetic profile name, confirms the shell displays it literally, reopens the profile form, and verifies that the task assignee option displays it as text with no injected element or event.

The E2E test performs the same update through the real profile endpoint, verifies the name persisted in isolated PostgreSQL, signs in as a different lead, and checks the resulting member option in task creation.

The focused `npm run test:ui -- tests/ui/security-display.spec.js` passed one test, `npm test` passed all 250 tests, and the full `npm run test:e2e` suite passed all 15 workflows in 55.5 seconds.

The screenshot of task creation with the saved markup visible as literal option text is [FEAT-007-stored-display-1440.png](screenshots/FEAT-007-stored-display-1440.png).

The test used Node.js v24.14.0, npm 11.9.0, PostgreSQL 18.4 on the isolated loopback test instance, Playwright 1.63.0, and headless Microsoft Edge 138.0.3351.121.

The first reproduction changed the active user's own profile; its synthetic event fired in the shell and the injected markup disrupted the following task view.

The flow was adjusted to store the payload on Sam and then switch to Alex, isolating the task-assignee sink; the first diagnostic assertion read the shell after switching users and therefore saw no shell image while detecting one image in the task modal.

The final regression verifies literal output and no event in the profile owner's shell and profile form, then in the other lead's task-assignee option.

The real-backend browser test used only the seeded synthetic Sam and Alex accounts and an isolated test database; no production identity or data was accessed.

## Phase 5: Clear protected mobile state after access denial

The mobile repository now distinguishes a terminal 401 after the API client's refresh and one retry from an organization-scoped 403 and an account-wide 403.

A terminal 401 clears the in-memory user, organizations, members, tasks, and announcements before notifying the shell, clears the active account's cache and tokens, and replaces the protected shell with a sign-in gate.

A scoped 403 immediately removes that organization's member and task rows and subtracts that organization from shared announcement audiences; it clears that organization's snapshots and filters the denied rows from combined snapshots while preserving other account and organization caches.

An account-validation 403 clears the active account's protected state and credentials instead of attributing the denial to whichever organization happened to be selected.

The UI gates every indexed destination while a denied-scope cache cleanup is pending, while the organization selector remains available for switching to a permitted scope.

The boundary review kept API authorization and refresh orchestration in the existing repository, persistent deletion and combined-snapshot filtering in the existing cache adapter, state removal in the shared data repository, and presentation of access gates in the shell; no dependency or new security framework was added, and network exceptions still use the existing offline-cache path.

The new `mobile/test/security_access_test.dart` covers final 401 retry behavior, account-wide 403, scoped 403 and combined-cache filtering, screen gating during asynchronous deletion, and a post-401 sign-in gate; the existing repository test now verifies automatic movement to the user's still-authorized organization after fresh membership data removes the selected scope.

`flutter analyze` reported no issues. `flutter test` passed 59 tests, with one existing live API test skipped because `FINANCE_LIVE_API` was unset.

On 2026-10-05 PHT, `npm test` passed all 250 tests, `npm run test:e2e` passed all 15 workflows, and `npm run test:ui` passed all 15 workflows.

The running app used the `Medium_Phone` Android emulator, Android 17/API 37, at 1080 by 2400 pixels, with Flutter 3.44.7 and Dart 3.12.2.

For the 401 scenario, a synthetic test account signed in, its isolated test session was revoked, and the API refresh flow ended in HTTP 401; the app removed the protected views and displayed the sign-in gate. The emulator was then signed in again and later signed out through the UI.

For the 403 scenario, a temporary loopback proxy connected the emulator to the local API using only the isolated `pipeline_test` database. A synthetic membership was revoked after the successful user-validation response and before the organization members request; the API returned HTTP 403, the denied organization's protected content disappeared, and switching to a second still-authorized organization followed by refresh returned HTTP 200 and task records.

The inspected [post-401 sign-in capture](screenshots/FEAT-007-mobile-401-api37.png) contains no protected records, and the inspected [post-403 denied-scope capture](screenshots/FEAT-007-mobile-403-api37.png) shows the access-denied gate and scope selector.

The software environment was Node.js v24.14.0, npm 11.9.0, PostgreSQL 18.4 on loopback port 5433, Flutter 3.44.7, Dart 3.12.2, Android 17/API 37, Playwright 1.63.0, and headless Microsoft Edge 138.0.3351.121.

The 401 and 403 emulator scenarios used synthetic records and the isolated local test database; no production credentials, production services, customer records, or physical devices were used.

## Limitations

Production runtime configuration, production deployment seed history, hosted database connection settings, and actual exploitability in any deployed instance were not verified.

The required OS-enforced audit reproduction sandbox was unavailable during EVID-003, so these results do not replace an independent reproduction in that sandbox.

The E2E run updated existing tracked screenshot outputs under `docs/evidence/screenshots`; those generated changes are preserved and excluded from the FEAT-007 phase checkpoint.

The later browser rerun regenerated the tracked Phase 3 screenshot `FEAT-007-task-history-375.png`; it remains preserved but is excluded from the Phase 4 checkpoint, while `FEAT-007-stored-display-1440.png` is included.

No production-service, deployment, or physical-device check was performed. The required OS-enforced audit sandbox and independent EVID-003 validators remain unavailable, so these local implementation checks do not complete the source-first security audit.

## Phase status

Phase 1 passed its focused security tests, full Node test gate, isolated restore gate, diff check, code review, and checkpoint commit `de94ccbf9503a171364e0a6b4bdbfca49e485ce6`.

Phase 2 passed its focused auth, finance, and security suites, the full Node gate, E2E gate, diff check, code review, and checkpoint commit `a201fb3a2dd5cfc86ceb0321df6bc5a0bf286ce8`.

Phase 3 passed its focused, complete Node, E2E, UI, and diff checks and is committed as `27698745a0207b996259ea6de4edf3d1d0d806b5`.

Phase 4 passed the focused stored-display UI regression, the complete 250-test Node gate, 15 E2E workflows, and its review; it is committed as `ddee080336c97abe0b4c35584165d1628ea7854f`.

Phase 5 passed Flutter analysis, 59 Flutter tests with one existing live API skip, the complete 250-test Node gate, 15 E2E workflows, 15 UI workflows, the API 37 emulator scenarios, and staged diff review; it is committed as `697bfb27e90aa3bae32069a56ac5de16e437decf` (`fix(mobile): clear protected state on denial`).
