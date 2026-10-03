# Implementation plan: Configurable team finance and spending transparency

Created: 2026-10-03T21:54:00+08:00
Updated: 2026-10-03T23:28:00+08:00
Revision: 3
Status: Approved, in progress
Feature spec and revision: [FEAT-006 revision 2](../features/FEAT-006-configurable-finance.md), Approved
Approved baseline revisions: PROD-001 revision 3, PROD-002 revision 3, PROD-003 revision 3, PROD-004 revision 4, PROD-005 revision 3, FEAT-001 revision 3, FEAT-004 revision 3, and FEAT-006 revision 2. Existing FEAT-002, FEAT-003, and FEAT-005 remain at approved revision 2.
Len's chat approval: Approved by Len in chat on 2026-10-03T22:31:00+08:00: "Yes I approve of the revisions". The reply answered a request naming FEAT-006 revision 2, PLAN-002 revision 3, the baseline revisions above, and `exceljs@4.4.0`.
Target branch: codex/organization-manager-mvp

## Scope

Implement only the behavior in FEAT-006 revision 2 under the approved baseline revisions above and this plan. Those approvals and the `exceljs@4.4.0` dependency are recorded above.

The phase sequence is organization-data generalization, exact-money persistence and API, web finance and workbook workflows, analytics, Android finance workflows, then integrated verification. Existing untracked toolkit setup files and any unrelated staged or unstaged files must be preserved.

The user asked for accuracy and full verification rather than speed. The executing AI must read `AGENTS.md`, `HANDOFF.md`, `GEMINI.md`, this plan, and every approved linked revision first; follow their scope rules and the Recovery section of this plan; implement each approved phase completely; and run every existing required check plus the new finance checks. Do not claim a check passed unless it ran and passed in the recorded environment. If project instructions or approved documents conflict, apply the narrower reading that adds no behavior, record the conflict in `HANDOFF.md` for Len, and continue.

Dependency: `exceljs@4.4.0` is the only approved new direct dependency; add it in Phase 3 and never add any other direct dependency. The verified ExcelJS package supports XLSX and CSV read/write and declares Node.js `>=8.3.0` compatibility: [official package metadata](https://github.com/exceljs/exceljs/blob/master/package.json) and [official releases](https://github.com/exceljs/exceljs/releases).

Use the existing Fastify, PostgreSQL, browser-native file input/download, and Flutter architecture. Keep finance policy separate from route, SQL, and workbook formats through feature-specific use cases and narrow adapters. Do not refactor unrelated modules, add a generic import/export framework, add chart or state-management packages, create a microservice, or implement formal double-entry accounting.

## Phase 1: Remove fixed organization assumptions

Requirements: FEAT-006/REQ-001, REQ-002, REQ-013
State: Complete

### Tasks

- [x] Trace organization names and IDs through API responses, web views, Flutter views, demo data, seed data, tests, and documentation; remove name-to-ID conditionals from runtime clients.
- [x] Render organization labels from organization data returned by the API or repository; preserve existing access rules and scope selection.
- [x] Replace assumptions that exactly two organizations exist with data-driven lists and a fixture containing at least three unrelated organization names.
- [x] Keep organization create, rename, and archive workflows out of scope; do not add customer tenancy or billing.
- [x] Add regression coverage for arbitrary organization names, target labels, member/task labels, and scoped overview totals.

### Verification

- [x] Run `npm run check`, `npm test`, and `npm run test:ui`; expect all checks to pass and all existing behavior to remain intact.
- [x] Run `flutter analyze` and `flutter test` from `mobile/`; expect zero analyzer issues and all tests to pass.
- [x] Record the three-organization web and Android scenarios in `docs/evidence/MVP-verification.md` with actual versions and results.

### Review and checkpoint

- [x] Search runtime code and tests for organization-name-to-ID mappings and document any remaining occurrences that are intentional seed content.
- [x] Review the diff for unrelated changes, dependency additions, and preserved pre-existing work.
- [x] Update evidence, plan state, and `HANDOFF.md`; stage only reviewed phase paths and inspect the staged diff.
- [x] Commit as `refactor(orgs): remove fixed team assumptions` and verify the commit hash.

## Phase 2: Add exact-money budgets and expenses

Requirements: FEAT-006/REQ-002 through REQ-006
State: Complete

### Tasks

- [x] Add a forward-only PostgreSQL migration for organization-scoped monthly budgets, expenses, import provenance, and indexes/constraints.
- [x] Store amounts as integer centavos and currency as `PHP`; expose decimal strings at the API boundary and never use JavaScript floating-point arithmetic for money.
- [x] Add finance use cases and thin route/persistence adapters for list, create, edit, and void operations; keep every query organization-scoped and validate active membership server-side.
- [x] Normalize category text by trimming, enforce its length, compare categories case-insensitively, and suggest existing categories without adding a category-management subsystem.
- [x] Allow active Owner, Lead, and Member users equal finance permissions as approved; record actor, timestamp, and allowlisted before/after financial values for every budget and expense mutation.
- [x] Apply existing optimistic concurrency conventions to edits; void rather than hard-delete expense records.
- [x] Add targeted integration coverage for exact centavo sums, validation, permissions, organization isolation, duplicate budgets, audit visibility, voiding, and stale edits.
- [x] Add the finance tests to both `npm run test:finance` and the existing `npm test` command.

### Verification

- [x] Run `npm run db:migrate` and `npm run db:migrate:test`; expect idempotent success and no destructive schema changes.
- [x] Run the new `npm run test:finance` and existing `npm test`; expect every test to pass.
- [x] Run `npm run test:restore`; verify budgets, expenses, audit history, membership relationships, and foreign keys survive restore.

### Review and checkpoint

- [x] Review arithmetic, constraints, transaction boundaries, permission checks, and audit contents for exactness and data leakage.
- [x] Review dependency changes; only add `exceljs@4.4.0` after its explicit approval, in the phase that needs it.
- [x] Update evidence, plan state, and `HANDOFF.md`; stage only reviewed phase paths and inspect the staged diff.
- [x] Commit as `feat(finance): add budgets and expense records` and verify the commit hash.

## Phase 3: Deliver web finance and spreadsheet workflows

Requirements: FEAT-006/REQ-003 through REQ-009, REQ-012
State: Complete

### Tasks

- [x] Add a Finance workspace to the responsive web app with budget periods, expense list, category/date filters, create/edit/void actions, and visible change history.
- [x] Add CSV and XLSX import with strict field validation, a row-level preview, and explicit confirmation before a single atomic commit; block the entire commit if any row is invalid.
- [x] Send the file as the raw request body with its CSV or XLSX content type; register a buffer content-type parser for those types and set a 5 MiB route body limit so larger uploads return HTTP 413; add no multipart parser.
- [x] Enforce the 5,000 data-row limit while parsing: read only the first worksheet and abort with a validation error at the first row beyond the limit.
- [x] Keep preview stateless: the preview route stores nothing, and the confirm route receives the same file again with the duplicate choice, then parses, validates, and detects duplicates again inside the committing transaction.
- [x] Detect duplicate candidates exactly as FEAT-006 defines them (same organization or same file, date, centavo amount, normalized category, and normalized reference) and require one skip-all or include-all choice for the batch.
- [x] Add the explicitly approved `exceljs@4.4.0` dependency and lockfile update only after the approval gate is recorded; add no other direct dependency.
- [x] Reject malformed or unsupported workbooks and formula cells in imported financial fields; preserve the user's file and form state when validation fails.
- [x] Add XLSX export with a summary and detail sheet, exact numeric values, organization and period, active filters, and generated-at timestamp; write all user-provided text as literal cells and include no macros.
- [x] Add tests that inspect generated workbook structure and values and verify formula-like input remains literal on export.
- [x] Keep CSV/XLSX controls on web; do not introduce mobile file-picker or sharing dependencies.

### Verification

- [x] Run `npm run check`, `npm run test:finance`, `npm test`, and `npm run test:ui`; expect all checks to pass.
- [x] Verify valid and invalid CSV/XLSX imports, mixed valid/invalid rows, duplicate warnings, the HTTP 413 size limit, the parse-time row limit, a confirm whose data changed after preview, each duplicate-definition field, formula-cell rejection, organization isolation, export filters, and round-trip centavo values.
- [x] Verify keyboard-only use, accessible labels/errors, and responsive layouts at 375, 768, 1024, and 1440 CSS pixels.

### Review and checkpoint

- [x] Review upload validation, workbook parsing, formula safety, output scoping, accessible preview states, and no new dependency beyond the approved ExcelJS version.
- [x] Update evidence, plan state, and `HANDOFF.md`; stage only reviewed phase paths and inspect the staged diff.
- [x] Commit as `feat(finance): add web budgets imports and exports` and verify the commit hash.

## Phase 4: Add explainable budget and cost analytics

Requirements: FEAT-006/REQ-009, REQ-010, REQ-012, REQ-013
State: Complete

### Tasks

- [x] Add organization- and month-scoped budget-versus-actual totals, remaining/over-budget amounts, category comparison, and monthly historical trend using exact money arithmetic.
- [x] Calculate the month-end run rate once on the server for the current Asia/Manila month as month-to-date actual centavos multiplied by days in the month and divided by elapsed calendar days including today, rounded half up to the centavo with exact integer arithmetic; label it as an estimate and omit it when there is no actual data.
- [x] Use a compact bullet or bar chart for budget/target comparison and a trend line for monthly spending, with visible labels, keyboard-accessible details, and matching tables; rely on existing CSS/SVG/native capabilities and add no chart library.
- [x] Make web totals match the expense register for the same organization and filters, and return every total and the forecast from the API so no client recalculates money.
- [x] Add tests for month boundaries, leap years, empty periods, negative remaining budget, PHP formatting, category totals, forecast math including half-centavo rounding, and organization isolation.

### Verification

- [x] Run `npm run check`, `npm run test:finance`, `npm run test:ui`, and `npm test`; expect all checks to pass.
- [x] Verify every chart has visible numeric labels, keyboard-accessible details, and an equivalent data table.
- [x] Compare report totals against independently summed fixture rows for at least three organizations and multiple months.
- [x] Run `npm run test:performance`; preserve the established dashboard p95 target and record analytics timings separately without claiming production performance.

### Review and checkpoint

- [x] Review formulas and labels with hand-calculated examples; ensure no projected amount is presented as actual spending.
- [x] Update evidence, plan state, and `HANDOFF.md`; stage only reviewed phase paths and inspect the staged diff.
- [x] Commit as `feat(finance): add transparent budget analytics` and verify the commit hash.

## Phase 5: Add Android finance workflows

Requirements: FEAT-006/REQ-002, REQ-003, REQ-009 through REQ-013
State: Approved, not started

### Tasks

- [ ] Add Finance views for budgets, expenses, analytics summaries, and the approved create/edit/void workflows using the shared API and current repository patterns; display the server-computed totals and forecast without client-side money arithmetic.
- [ ] Keep the existing four-item bottom navigation limit; expose Finance through an explicitly labeled secondary destination.
- [ ] Show online-only finance behavior clearly, including retry and reconnect states; do not cache finance records or queue offline writes.
- [ ] Make spreadsheet import/export discoverable as a web workflow for all organization members.
- [ ] Add widget and repository coverage for permission-equivalent member access, money formatting, scope switching, loading/empty/error/denied/offline states, and form recovery.

### Verification

- [ ] Run `flutter analyze`, `flutter test`, and `flutter build apk --debug`; expect zero analyzer issues and successful tests/build.
- [ ] Verify on the available Android emulator that all finance controls are TalkBack-labeled, support 200 percent text scaling, have at least 48 logical-pixel touch targets, and show current organization and currency.
- [ ] Verify Android totals and forecast equal the web values for the same organization and filters.
- [ ] Record emulator type/API and screenshots separately; physical-device results remain pending until Len tests a physical device.

### Review and checkpoint

- [ ] Review navigation, offline messaging, exact money display, and role parity against the web client.
- [ ] Update evidence, plan state, and `HANDOFF.md`; stage only reviewed phase paths and inspect the staged diff.
- [ ] Commit as `feat(mobile): add team finance workflows` and verify the commit hash.

## Phase 6: Integrated verification and local handoff

Requirements: FEAT-006/REQ-001 through REQ-013 and existing FEAT-001 through FEAT-005
State: Approved, not started

### Tasks

- [ ] Run the complete local gate set and resolve only failures caused by or blocking this approved work.
- [ ] Run the end-to-end flow: member records a budget, adds an expense, imports reviewed rows, inspects audit history and analytics, exports XLSX, and verifies the workbook values and organization scope.
- [ ] Verify all existing seed/demo/auth/member/task/announcement workflows and the existing Android offline-read behavior still work.
- [ ] Update the spec index and handoff with exact approved revisions and actual evidence; do not change approved behavior or architecture without new approval.
- [ ] Update `README.md` with the approved Finance workflow, workbook template, import limits, and local verification commands.
- [ ] Record limitations: neutral accountant export only, no tax/formal bookkeeping, web-only spreadsheet transfer, online-only Android finance, and physical/production checks still pending.

### Verification

- [ ] From the repository root run `npm ci`, `npm run check`, `npm test`, `npm run test:ui`, `npm run test:e2e`, `npm run test:performance`, and `npm run test:restore`; expect every command to pass.
- [ ] From `mobile/` run `flutter pub get`, `flutter analyze`, `flutter test`, and `flutter build apk --debug`; expect every command to pass.
- [ ] Run the combined finance, role, cross-organization isolation, import/export, accessibility, restore, and end-to-end scenarios; save actual results and screenshots when available.
- [ ] Review final tracked and staged content for secrets, unapproved dependencies, out-of-scope changes, and unrelated work.

### Review and checkpoint

- [ ] Confirm all phases have successful checks and verified commits; inspect the final staged diff and preserve unrelated changes.
- [ ] Update the verification ledger and current handoff with exact commands, results, environment, limitations, and commit hashes.
- [ ] Commit as `test(finance): verify configurable team finance release` and verify the commit hash.

## Recovery

Follow project `AGENTS.md` for scope and commits.
Len directed on 2026-10-03 that this plan has no hard stop on failing checks; for PLAN-002 this replaces the `AGENTS.md` three-attempt stop.
When a check or commit fails, the phase stays incomplete and uncommitted, and the executor loops: diagnose the root cause, fix within the approved design, and rerun the phase checks.
Advance to the next phase only after every listed check of the current phase has actually run and passed and Git confirms the phase commit.
Record each attempt, its fix, and its actual result in `HANDOFF.md`, and do not repeat a fix that already failed.
Never make a check pass by deleting, skipping, or loosening a test or assertion, by special-casing test mode, or by changing approved behavior.
Looping cannot supply missing access, hardware, an unapproved dependency, or a scope or architecture change; record such an item as pending for Len, keep its phase incomplete, and continue all work that does not depend on it.
Preserve existing untracked toolkit files, and never push, reset, discard edits, or stage the whole repository.
Execution is authorized for FEAT-006 revision 2 under this PLAN-002 revision 3 once Len names the executor.
