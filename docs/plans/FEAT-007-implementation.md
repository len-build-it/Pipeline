# Implementation Plan: FEAT-007 Security hardening from audit candidate leads

Created: 2026-10-04T23:06:52+08:00
Updated: 2026-10-04T23:45:00+08:00
Revision: 1
Status: Approved
Feature spec and revision: [FEAT-007 revision 1](../features/FEAT-007-security-hardening.md), Approved
Approved baseline and architecture revisions: PROD-001 revision 3, PROD-002 revision 3, PROD-003 revision 3, PROD-004 revision 4, FEAT-001 revision 3, FEAT-003 revision 2, FEAT-005 revision 2, and FEAT-006 revision 2
Len's chat approval: Approved by Len in chat on 2026-10-04T23:19:00+08:00: "Approve FEAT-007 revision 1 and PLAN-004 revision 1"
Target branch: codex/organization-manager-mvp

## Scope

Implement FEAT-007/REQ-001 through FEAT-007/REQ-010 and preserve existing application behavior outside those requirements.

The source-first audit is [EVID-003](../evidence/security-audit-2026-10-04/REPORT.md) at commit 66e72a0117fa45f7b9635bdec288038daf95abb6.

EVID-003 is incomplete and records ten candidates rather than confirmed vulnerabilities; every candidate must be tested with synthetic data and documented as reproduced, not reproduced, or unable to validate.

The phase order is based on boundary and dependency order, not a severity rating.

Use the existing Node.js, PostgreSQL, native web, Flutter, and Playwright toolchain without adding dependencies.

The baseline worktree was clean on branch codex/organization-manager-mvp at commit 66e72a0 when this draft was prepared.

After Len approves the exact feature and plan revisions, continue automatically from one phase to the next whenever all listed checks pass; do not request routine phase sign-off.

Run every database-backed check only against an isolated disposable PostgreSQL 18 instance bound to loopback, with synthetic data and no production credentials.

Do not run the destructive restore check against the currently used development database or any shared database.

For candidate-specific reproduction steps from NEEDS-VALIDATION.md, use its OS-enforced empty-environment sandbox, no network access, read-only target and toolchain, scratch-only writes, and explicit resource limits when that harness is available.

If the audit reproduction sandbox is unavailable, record that candidate as unable to validate and continue with independent regression work that uses synthetic data and isolated local services.

## Candidate-to-requirement map

| EVID-003 candidate | Source trace in [NEEDS-VALIDATION.md](../evidence/security-audit-2026-10-04/NEEDS-VALIDATION.md) | Requirement | Phase |
| --- | --- | --- | --- |
| auth.jwt-secret-fallback | server/config.js:5, server/app.js:45-50, server/index.js:16-21 | FEAT-007/REQ-001 | 1 |
| bootstrap.seed-default-owner-credentials | db/seed.js:20-35, db/seed.js:95 | FEAT-007/REQ-002 | 1 |
| db.migrate.test-url-alias | tests/helpers/db-helper.js:6-20, db/migrate.js:9-22, db/client.js:5-12 | FEAT-007/REQ-003 | 1 |
| scripts.test-restore.environment-selected-target | scripts/test-restore.js:12-22, scripts/test-restore.js:66-71, scripts/test-restore.js:103-117 | FEAT-007/REQ-003 | 1 |
| overview.archived-org-active-membership | server/routes/organizations.js:44-53, server/routes/organizations.js:135-205 | FEAT-007/REQ-004 | 2 |
| finance.xlsx-sparse-row-index | server/routes/finance.js:162, server/finance/spreadsheet.js:12-16, server/finance/spreadsheet.js:190-200 | FEAT-007/REQ-005 | 2 |
| finance.unbounded-xlsx-export | server/routes/finance.js:189-198, server/finance/export.js:30-48, server/finance/repository.js:142-163 | FEAT-007/REQ-006 | 2 |
| tasks.comment-history-unbounded | server/tasks/service.js:608-626, server/tasks/service.js:632-685, server/tasks/service.js:809-824 | FEAT-007/REQ-007 | 3 |
| web.stored-display-name-html-injection | server/routes/members.js:146-163, server/members/service.js:591-639, web/js/app.js:690-715 | FEAT-007/REQ-008 | 4 |
| mobile.denial-keeps-memory-records | mobile/lib/data/app_repository.dart:226-237, mobile/lib/screens/overview_screen.dart:23-25 | FEAT-007/REQ-009 | 5 |

The source traces describe audit leads and do not by themselves establish exploitability or severity.

## Phase 1: Fail closed on production configuration and destructive database targets

Requirements: FEAT-007/REQ-001, FEAT-007/REQ-002, FEAT-007/REQ-003, FEAT-007/REQ-010

State: Complete

Candidate leads: auth.jwt-secret-fallback, bootstrap.seed-default-owner-credentials, db.migrate.test-url-alias, scripts.test-restore.environment-selected-target

### Tasks

- [x] Add focused Node security regression tests under tests/security for production configuration, seed invocation, test database target validation, and restore target validation.
- [x] Add a test:security package script and include it in npm test so the new policy tests run in the routine Node gate.
- [x] Exercise each candidate's refusal path with pure policy tests, subprocess checks, or the isolated loopback database; no production database, real account, or production secret was used.
- [x] Validate JWT configuration before server startup and before opening the database; require an explicit production secret of at least 32 characters that differs from the development fallback; preserve the local development default.
- [x] Keep environment reads and startup composition at the outer boundary; test secret validation as a pure function and ensure errors never include the supplied secret.
- [x] Reject direct production seed invocation before database connection; keep the existing seed fixture available for development and tests.
- [x] Validate the effective PostgreSQL target before test migration, truncation, or restore drop/create operations; normalize connection URL identity and reject non-loopback or non-test targets before issuing SQL.
- [x] Ensure refused database targets do not log passwords, query strings, or complete connection URLs.
- [x] Record candidate limitations without silently changing unrelated setup behavior.

### Verification

- [x] Run npm run test:security with pure configuration tests and database-target tests against synthetic inputs; all 16 checks passed and unsafe targets were rejected before database access.
- [x] Run npm run test:auth and npm test with TEST_DATABASE_URL set only to the isolated loopback pipeline_test database; the full 244-test Node gate passed.
- [x] Run npm run test:restore with PGHOST set to 127.0.0.1, PGPORT set to the isolated test server, PGUSER set to its local test role, TEST_DB_NAME set to pipeline_test, and PG_BIN_DIR set to the installed PostgreSQL 18 binaries; the source and disposable restore database were compared and removed on that server only.
- [x] Verify unsafe remote host, development database name, production database name, normalized alias, PGHOSTADDR, and PGSERVICE overrides are rejected before migration, truncate, drop, or create statements.
- [x] Run git diff --check; no whitespace errors were reported.
- [x] Record actual commands, versions, fixture details, results, and limitations in [Phase 1 evidence](../evidence/FEAT-007-security-hardening-verification.md).

### Review and checkpoint

- [x] Review configuration, CLI, and database-target policy for inward dependencies and fail-closed ordering.
- [x] Review correctness, scope, dependencies, secret redaction, and unrelated changes.
- [x] Update this plan, evidence, and the current handoff with actual results.
- [x] Stage only reviewed Phase 1 paths and inspect the staged diff.
- [x] Commit the reviewed phase and verify Git reports success.

Checkpoint message: fix(security): fail closed on production and test targets
Checkpoint commit: `de94ccbf9503a171364e0a6b4bdbfca49e485ce6`.

Phase completion requires all gates and a successful commit; the message identifies the checkpoint without needing its own hash inside the commit.

Continue automatically to the next approved phase.

## Phase 2: Enforce organization lifecycle and spreadsheet resource bounds

Requirements: FEAT-007/REQ-004, FEAT-007/REQ-005, FEAT-007/REQ-006, FEAT-007/REQ-010

State: Awaiting checkpoint commit

Candidate leads: overview.archived-org-active-membership, finance.unbounded-xlsx-export, finance.xlsx-sparse-row-index

### Tasks

- [x] Exercise the overview scenario with a synthetic archived organization, an active non-Owner membership, and synthetic organization data; the regression now verifies denial without records.
- [x] Enforce active organization status in the existing organization-scoped overview policy and persistence query; retain Owner behavior and active-organization behavior.
- [x] Add import fixtures with 5,000 data rows, 5,001 data rows, and a sparse nonblank row beyond worksheet row 5,001.
- [x] Seed the large export fixture with one synthetic database operation rather than issuing thousands of HTTP writes.
- [x] Reject a workbook whose worksheet row extent exceeds the supported header plus 5,000 data rows before iterating through the sparse gap; preserve the existing compressed upload, expanded workbook byte, formula, and validation checks.
- [x] Cap a single finance workbook export at 5,000 matching expenses and return an actionable validation response when more records match; never emit a silently truncated workbook.
- [x] Keep export organization and date-range filters in the finance feature boundary, and reuse existing SQL parameterization and workbook generation.
- [x] Test each candidate path with synthetic fixtures and record reproduction limits in EVID-004.

### Verification

- [x] Run npm run test:security, npm run test:auth, and npm run test:finance with only the isolated loopback test database configured; the archived scope regression denies without returning records.
- [x] Verify the 5,000-row import and export boundaries succeed completely, the next row is rejected, the export repository reads at most 5,001 matches before rejecting an over-limit request, the sparse high-index fixture is rejected before scanning through missing rows, and a rejected export has no workbook body.
- [x] Verify valid finance filters still return only the selected organization and date range.
- [x] Run npm test and npm run test:e2e against the isolated database; all existing API and browser workflows passed.
- [x] Run git diff --check and record fixture sizes, record counts, test results, and limitations in [EVID-004](../evidence/FEAT-007-security-hardening-verification.md).

### Review and checkpoint

- [x] Review that route handlers remain translators and the organization and finance rules remain with their existing feature services and data adapters.
- [x] Review correctness, scope, database migration necessity, dependencies, and unrelated changes.
- [x] Review the current schema and indexes; no migration was required for the row bounds or limited export query.
- [x] Update this plan, evidence, and the current handoff with actual results.
- [x] Stage only reviewed Phase 2 paths and inspect the staged diff.
- [ ] Commit the reviewed phase and verify Git reports success.

Checkpoint message: fix(finance): bound spreadsheet operations

Phase completion requires all gates and a successful commit; the message identifies the checkpoint without needing its own hash inside the commit.

Continue automatically to the next approved phase.

## Phase 3: Paginate task comment and activity histories

Requirements: FEAT-007/REQ-007, FEAT-007/REQ-010

State: Not started

Candidate lead: tasks.comment-history-unbounded

### Tasks

- [ ] Reproduce full-history query and response growth with a synthetic task and comment/activity history.
- [ ] Add validated page-size handling with a default of 50 and a maximum of 100 for both comment and task activity readers.
- [ ] Use a stable keyset cursor based on the current history timestamp and unique record ID; scope every page by authorized organization and task.
- [ ] Return the newest 50 records first and expose a continuation cursor for older records; do not silently discard older history.
- [ ] Update existing web task detail readers to load the first page and provide an accessible control for loading older comments and activity.
- [ ] Inspect all existing task-history consumers and update any consumer that currently assumes a complete unbounded response.
- [ ] Add deterministic tests for page caps, ordering, continuation, no gaps or duplicates, invalid cursors, and cross-organization denial.
- [ ] Add or reuse an index only when the existing schema does not support the bounded keyset query.

### Verification

- [ ] Run npm run test:tasks with the isolated test database; expect each page to contain no more than 100 rows and authorized users to be able to reach all synthetic history pages.
- [ ] Run npm test and npm run test:e2e with synthetic task history greater than 100 comments and activity rows; expect no unauthorized page and no missing or duplicated record across successive pages.
- [ ] Run npm run test:ui and verify keyboard access, visible focus, and the older-history control at 375, 768, 1024, and 1440 CSS-pixel widths.
- [ ] Capture a screenshot of the task detail with the older-history control at a narrow viewport when screenshot capture is available.
- [ ] Run git diff --check and record query counts, page-size boundaries, browser versions, and screenshots in the evidence file.

### Review and checkpoint

- [ ] Review keyset ordering and cursor validation for stable behavior when new comments are added between page requests.
- [ ] Review that authorization runs for each request and data access remains in the task feature boundary.
- [ ] Review correctness, accessibility, scope, dependencies, and unrelated changes.
- [ ] Update this plan, evidence, and the current handoff with actual results.
- [ ] Stage only reviewed Phase 3 paths and inspect the staged diff.
- [ ] Commit the reviewed phase and verify Git reports success.

Checkpoint message: fix(tasks): paginate comment and activity history

Phase completion requires all gates and a successful commit; the message identifies the checkpoint without needing its own hash inside the commit.

Continue automatically to the next approved phase.

## Phase 4: Render stored member names as text

Requirements: FEAT-007/REQ-008, FEAT-007/REQ-010

State: Not started

Candidate lead: web.stored-display-name-html-injection

### Tasks

- [ ] Reproduce the stored display-name flow from member update through task creation using a synthetic account and browser fixture.
- [ ] Replace dynamic name interpolation into the task-create HTML template with DOM text assignment or the existing context-safe escaping function.
- [ ] Keep generated option values and all other dynamic fields protected in their correct HTML contexts.
- [ ] Add a Playwright regression that proves a markup payload remains literal visible text and cannot create an element or execute an event.

### Verification

- [ ] Run npm run test:ui -- tests/ui/security-display.spec.js in headless Microsoft Edge; expect the injected element and event counters to remain absent while the full display name is visible as text.
- [ ] Run npm run test:e2e and npm test against the isolated database; expect existing task and member workflows to pass.
- [ ] Run git diff --check and record the browser version, scenario, and screenshot in the evidence file.

### Review and checkpoint

- [ ] Review all HTML insertion sites changed by the fix and confirm stored values remain text at the rendering boundary.
- [ ] Review correctness, scope, dependencies, and unrelated changes.
- [ ] Update this plan, evidence, and the current handoff with actual results.
- [ ] Stage only reviewed Phase 4 paths and inspect the staged diff.
- [ ] Commit the reviewed phase and verify Git reports success.

Checkpoint message: fix(web): render stored names as text

Phase completion requires all gates and a successful commit; the message identifies the checkpoint without needing its own hash inside the commit.

Continue automatically to the next approved phase.

## Phase 5: Clear protected mobile state after access denial

Requirements: FEAT-007/REQ-009, FEAT-007/REQ-010

State: Not started

Candidate lead: mobile.denial-keeps-memory-records

### Tasks

- [ ] Reproduce separate 401 and 403 responses after loading synthetic records into repository memory and persistent cache.
- [ ] Exercise 401 handling after the API client's existing single refresh retry so an ordinary expired access token is not confused with final session denial.
- [ ] Clear all account-protected in-memory records and credentials after 401, and clear records and cache for only the denied organization after 403.
- [ ] Gate screen rendering so a denied scope cannot display protected records while repository cleanup is in progress.
- [ ] Preserve eligible cached reads on ordinary network failure and preserve other authorized organization scopes after a scoped 403.
- [ ] Add repository and widget regression tests for overview, member, task, and announcement records after both denial statuses.

### Verification

- [ ] From mobile/, run flutter analyze; expect no analyzer issues.
- [ ] From mobile/, run flutter test; expect all existing and new tests to pass, with any existing live API test skip reported accurately.
- [ ] Run the app on the existing Medium_Phone API 37 emulator with a synthetic test account; load protected records, revoke the test session and verify a 401 clears protected views, then deny one organization and verify a 403 clears that scope while another authorized scope remains usable.
- [ ] Capture emulator screenshots of the post-401 sign-in state and post-403 denied-scope state when the harness permits capture.
- [ ] Run npm test as the final shared-backend regression gate and git diff --check; record actual emulator, Flutter, and Node versions and limitations in the evidence file.

### Review and checkpoint

- [ ] Review repository state transitions and screen gating so network errors remain distinct from known authorization failures.
- [ ] Review correctness, scope, accessibility, dependencies, and unrelated changes.
- [ ] Update this plan, evidence, and the current handoff with actual results.
- [ ] Stage only reviewed Phase 5 paths and inspect the staged diff.
- [ ] Commit the reviewed phase and verify Git reports success.

Checkpoint message: fix(mobile): clear protected state on denial

Phase completion requires all gates and a successful commit; the message identifies the checkpoint without needing its own hash inside the commit.

## Final review and evidence

- [ ] Confirm every EVID-003 candidate has a reproduced, not-reproduced, or unable-to-validate disposition supported by actual evidence.
- [ ] Confirm each reproduced candidate has its regression test and each remediation passes its phase gates.
- [ ] Confirm the complete Node, browser, and Flutter check set passes after the last phase.
- [ ] Record local verification separately from production, physical-device, and hosting evidence.
- [ ] Record owner-only production checks as pending unless Len supplies actual evidence; never record a secret value.
- [ ] Update EVID-003 or a linked addendum without converting unresolved candidates into confirmed findings by assumption.
- [ ] Update docs/SPEC_INDEX.md, this plan, and HANDOFF.md with verified status and final checkpoint hashes.

## Recovery

After approval, continue through passing phase gates without routine approval stops.

For a failing check, keep working on the same approved requirement, inspect the failure, correct the cause, and rerun the smallest relevant check followed by that phase's full gate before advancing.

Follow project AGENTS.md for the three unsuccessful correction attempts on the same unresolved failure, immediate access or user-decision blockers, and evidence of every attempt; do not mark a failed gate as passed or commit an incomplete phase.

If a candidate cannot be reproduced, record the exact synthetic setup and result, do not claim a vulnerability or make an unsupported fix, and continue to independent approved work.

If the Android emulator, isolated PostgreSQL instance, or required local toolchain is unavailable, record the actual access limitation and continue only with phases that do not depend on it.

## Approval record

Len approved FEAT-007 revision 1 and PLAN-004 revision 1 in chat on 2026-10-04T23:19:00+08:00 with the exact message: "Approve FEAT-007 revision 1 and PLAN-004 revision 1".

The approved document package was committed as 7de56533f4422545197ab80a513c7828bdcf56e9 and pushed to origin before approval was recorded.

Phase 1 execution started after approval on 2026-10-04T23:21:09+08:00; no application test has been run for this plan yet.
