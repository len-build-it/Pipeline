# Implementation plan: Lagoon UI redesign

Created: 2026-10-04T16:08:31+08:00
Updated: 2026-10-04T20:37:09+08:00
Revision: 1
Status: Approved; all six phases are complete. Phases 1 through 5 are committed at `2e60838`, `8caa32e`, `58a8d71`, `e64c8c9`, and `75bed89`; Phase 6 is committed as `test(ui): verify lagoon redesign release`.
Feature spec and revision: [PROD-005 revision 4](../product/UI_UX_DESIGN.md), approved by Len together with this plan.
Approved baseline and architecture revisions: PROD-001 revision 3, PROD-002 revision 3, PROD-003 revision 3, PROD-004 revision 4, and PROD-005 revision 4; FEAT-001 revision 3, FEAT-002 revision 2, FEAT-003 revision 2, FEAT-004 revision 3, FEAT-005 revision 2, and FEAT-006 revision 2 remain unchanged.
Len's chat approval: Approved on 2026-10-04T16:19:21+08:00: "Approve PROD-005 revision 4 and PLAN-003 revision 1".
Target branch: codex/organization-manager-mvp.

## Scope

Implement only the visual and layout changes defined by the approved PROD-005 revision 4 and this approved PLAN-003 revision 1.

Before application code changes, record Len's exact chat approvals of both revisions in `HANDOFF.md` and `docs/SPEC_INDEX.md`.

Preserve all behavior in PROD-005 UI-REQ-001 through UI-REQ-012, the approved feature specifications, current validation, permissions, copy meaning, and offline rules.

Do not change the API, database, role permissions, validation rules, or add any dependency.

Do not add the proposed Tasks status tile row because the current task endpoint paginates results and returns no complete per-status counts; it defaults to 25 rows and caps one request at 100 rows.

Keep Android member, task, and announcement write routes out of scope as tracked by ISS-002 in [HANDOFF.md](../../HANDOFF.md).

Preserve the existing local documentation edits and the draft [design brief](../product/UI_UX_HANDOFF_BRIEF.md) and [Lagoon handoff](../product/UI_REDESIGN_LAGOON_HANDOFF.md); do not stage unrelated paths.

Implementation uses the existing plain HTML, CSS, JavaScript modules, Flutter `ThemeData`, shape themes, and small local widgets.

Do not add an icon pack, font, CSS framework, component library, Flutter package, chart dependency, or other direct dependency.

## Phase 1: Web tokens and shell

Requirements: PROD-005 revision 4 visual system and Web shell; UI-REQ-001, UI-REQ-002, UI-REQ-004, UI-REQ-006, and UI-REQ-007.

State: Complete; `feat(ui): apply lagoon web tokens and shell` committed as `2e608380afa128a07c3c542c530b0475bd6dcd9e`.

### Tasks

- [x] Apply the approved color, shape, elevation, type, and focus tokens in `web/css/styles.css`, retaining existing token names where applicable.
- [x] Restyle the desktop rail, account inset, organization select, buttons, inputs, chips, panels, and decorative header blobs.
- [x] Make the rail become the existing labeled top-bar pattern below 768px without hiding destination or organization scope.
- [x] Keep existing element ids, accessible names, routing behavior, and responsive interaction hooks.

### Verification

- [x] Run `npm run test:ui` from the repository root and expect the existing UI suite to pass without weakened assertions.
- [x] Inspect the web shell at 375, 768, 1024, and 1440 CSS-pixel widths; confirm the page has no horizontal overflow and the organization and destination remain clear.
- [x] Use keyboard traversal through every shell control; confirm visible focus is not clipped or hidden behind the rail or top bar.
- [x] Save available shell screenshots in `docs/evidence/screenshots/ui-redesign/` and record the viewport and browser.

The final `npm run test:ui` run passed all 12 tests in 38.0 seconds on 2026-10-04T16:37:15+08:00.

The Playwright configuration used headless Microsoft Edge and Playwright 1.63.0.

The responsive checks covered 375 by 667, 768 by 1024, 1024 by 768, and 1440 by 900 CSS pixels with no horizontal page overflow.

Keyboard checks traversed every visible desktop shell control and the mobile destination and account controls, verified 3px focus rings, and confirmed Escape closes the mobile navigation and returns focus to Menu.

Screenshots for all four target widths are in `docs/evidence/screenshots/ui-redesign/`.

### Review and checkpoint

- [x] Review token use, decorative blob placement, focus visibility, and unrelated changes.
- [x] Update plan and current handoff with actual checks and limitations.
- [x] Stage only reviewed Phase 1 paths and inspect the staged diff.
- [x] Commit as `feat(ui): apply lagoon web tokens and shell` and verify Git reports success.

## Phase 2: Web operational pages

Requirements: PROD-005 revision 4 Overview, Members, Tasks, and Lists rules; UI-REQ-001 through UI-REQ-009.

State: Complete; implementation, review, and required UI and E2E verification passed; committed as `feat(ui): restyle web organization pages` (`8caa32eef529abc0bbb771fe9063ce137ae1cdd4`).

### Tasks

- [x] Restyle Overview with overdue tasks as the hero tile and the other three existing metrics as supporting tiles.
- [x] Restyle Members, Tasks, and Announcements with summary-first hierarchy where numbers already exist, quiet rows, text-labeled status chips, and straight-edged data surfaces.
- [x] Put member role and status filters behind one labeled Filters control and task filters behind one labeled Filters control, while keeping search visible and active filters visible as chips.
- [x] Open member and task details on selection in the desktop detail panel and retain a visible Close control; keep existing mobile detail flows.
- [x] Preserve every existing field, status, label, action, and loading, empty, error, denied, offline, success, and recovery state.
- [x] Omit the Tasks status count tiles because complete counts are not available from the paginated task API.
- [x] Resolve the Finance refresh races blocking the required E2E gate after Len expanded the authorized scope on 2026-10-04; keep the existing assertions intact.

### Verification

- [x] Run `npm run test:ui` from the repository root; it passed all 13 tests, including the four target widths, active filter chips, card breakpoints, search, details, permissions, and keyboard behavior.
- [x] Run `npm run test:e2e` from the repository root; the three pre-fix runs ended with 11/13, 11/13, and 10/13, then the targeted Finance flows passed 3/3 after the fix and two full runs passed 13/13 each against an isolated PostgreSQL 18 test cluster.
- [x] Exercise organization switching, scope clarity, member search and filters, task search and filters, opening and closing details, and announcement list and compose flows.
- [x] Inspect 375, 768, 1024, and 1440 CSS-pixel layouts; UI checks found no page-level horizontal overflow or hidden page-level primary action.
- [x] Save page screenshots for Overview, Members, Tasks, and Announcements at 375, 768, 1024, and 1440 CSS-pixel widths in `docs/evidence/screenshots/ui-redesign/` using headless Microsoft Edge and Playwright 1.63.0.

### Review and checkpoint

- [x] Review information hierarchy, active filter chips, selection and close behavior, accessibility semantics, and unrelated changes.
- [x] Update plan and current handoff with actual checks and limitations.
- [x] Stage only reviewed Phase 2 paths and inspect the staged diff.
- [x] Commit as `feat(ui): restyle web organization pages` and verify Git reports success.

## Phase 3: Web finance and spreadsheet flows

Requirements: PROD-005 revision 4 Finance, Tables, and Charts rules; UI-REQ-004, UI-REQ-006, UI-REQ-007, and UI-REQ-010 through UI-REQ-012.

State: Complete; implementation and required checks passed; committed as `feat(ui): restyle web finance workflows` (`58a8d718790ceae2381d9a6336a966b64fec9937`).

### Tasks

- [x] Reorder the existing Finance report to show a Remaining hero tile with its progress track, then Actual and Estimate tiles, followed by the existing category comparison, trend, and register.
- [x] Restyle category tracks and over-budget state with visible percentages, over amounts, text labels, and an equivalent table.
- [x] Restyle the monthly trend while retaining its equivalent table, point labels, in-progress month explanation, and existing data behavior.
- [x] Restyle the expense register and spreadsheet import preview without changing import validation, duplicate decisions, export contents, or commit behavior.
- [x] Keep semantic table markup, right-aligned money, and any narrow-screen horizontal scrolling inside the table panel only.

### Verification

- [x] Run `npm test`, `npm run test:ui`, and `npm run test:e2e` from the repository root and expect existing finance, UI, and end-to-end assertions to pass.
- [x] Verify the report, register, and import-preview keyboard flows; confirm charts retain their text or table equivalent and import errors remain recoverable.
- [x] Inspect the Finance and import primary flows at 375, 768, 1024, and 1440 CSS-pixel widths; confirm page-level horizontal overflow is absent.
- [x] Save available Finance and import screenshots in `docs/evidence/screenshots/ui-redesign/` and record the viewport and browser.

On 2026-10-04T18:58:33+08:00, `npm test` passed 122/122, `npm run test:ui` passed 13/13 in 43.2 seconds, and the final `npm run test:e2e` passed 13/13 in 56.3 seconds against the isolated PostgreSQL 18 test cluster on `127.0.0.1:5433`.
The suites ran with headless Microsoft Edge through Playwright 1.63.0; the responsive journeys covered 375, 768, 1024, and 1440 CSS-pixel widths without page-level horizontal overflow.
The report journey checked exact money values, over-budget labels, matching category and trend tables, the in-progress month explanation, keyboard focus on the budget, trend, and register table regions, and an over-budget total while restoring its Travel budget fixture before existing assertions.
The import journey confirmed keyboard focus on its preview region, recoverable row problems, duplicate choice, and atomic confirmation; the Finance E2E suite also exercised keyboard-only expense entry and checked accessible names.
Reviewed screenshots are in `docs/evidence/screenshots/ui-redesign/`: Finance and import at 375 by 667, 768 by 1024, 1024 by 768, and 1440 by 900 CSS-pixel viewports, plus the report and over-budget report at 1440 pixels.
The isolated PostgreSQL test cluster remained bound to `127.0.0.1:5433`; the service on port 5432 was not changed.

### Review and checkpoint

- [x] Review money labels, chart equivalents, import and export behavior, focus handling, and unrelated changes.
- [x] Update plan and current handoff with actual checks and limitations.
- [x] Stage only reviewed Phase 3 paths and inspect the staged diff.
- [x] Commit as `feat(ui): restyle web finance workflows` and verify Git reports success.

## Phase 4: Android theme and shell

Requirements: PROD-005 revision 4 Android and visual token rules; UI-REQ-001, UI-REQ-004, UI-REQ-006, UI-REQ-007, UI-REQ-008, and UI-REQ-009.

State: Complete; implementation and checks passed; committed as `feat(mobile): apply lagoon android shell` (`e64c8c98b6acffda2c830bf32a0ec17a077d4756`).

### Tasks

- [x] Apply the approved Lagoon colors, shape themes, typography, and elevations in `mobile/lib/theme.dart` without adding a package.
- [x] Restyle the app bar organization switcher, four-item bottom bar and selected lime marker, Finance entry on Overview, and offline banner and background.
- [x] Preserve back behavior, scope selection, accessibility labels, and the existing offline read and write behavior.

### Verification

- [x] Run `flutter analyze` and `flutter test` from `mobile/` and expect zero analyzer issues and all existing tests to pass.
- [x] Launch on the available Android emulator at default text scale; inspect organization scope, selected destination, Finance entry, and offline state.
- [x] Save available emulator screenshots in `docs/evidence/screenshots/ui-redesign/` and record emulator model and API level.

On 2026-10-04T19:21:51+08:00, `flutter analyze` reported no issues and `flutter test` passed 54 tests with one existing live API test skipped because `FINANCE_LIVE_API` was not set.
The app was inspected on the Medium_Phone AVD, SDK gphone16k_x86_64, Android 17/API 37, at 1080 by 2400 pixels and 420 dpi using the default text scale.
The overview screenshot was captured at 2026-10-04T19:13:45+08:00, the Finance entry at 19:14:45+08:00, and the simulated offline shell at 19:16:51+08:00.
The offline image shows the demo simulation state; a real authenticated cache timestamp was not available in that session.
The Retry action is covered by a widget test; a direct emulator tap was not verified.

### Review and checkpoint

- [x] Review Android shell semantics, tap targets, text scaling, offline messaging, and unrelated changes.
- [x] Update plan and current handoff with actual checks and limitations.
- [x] Stage only reviewed Phase 4 paths and inspect the staged diff.
- [x] Commit as `feat(mobile): apply lagoon android shell` and verify Git reports success.

## Phase 5: Android screens and forms

Requirements: PROD-005 revision 4 Android, summary tile, list, table, and chart rules; UI-REQ-001 through UI-REQ-011.

State: Complete; implementation and verification passed; committed as `feat(mobile): restyle lagoon android screens` (`75bed89f035e0a13acc9ad9103f3988697fe3ba6`).

### Tasks

- [x] Restyle Overview, Members, Tasks, Announcements, Finance, and finance forms using existing screen modules and small local widgets.
- [x] Keep lists and forms straight-edged, preserve status labels, and use blobs only for approved decoration and marker shapes.
- [x] Keep the four-item bottom navigation, Finance card, 48-logical-pixel targets, and 200 percent text-scaling support.
- [x] Preserve current Finance authorization and online-only behavior; do not change Android member, task, or announcement write routes.

### Verification

- [x] Run `flutter analyze` and `flutter test` from `mobile/`; analyzer reported no issues and 54 tests passed with one existing live API test skipped because `FINANCE_LIVE_API` was unset.
- [x] Inspect Overview, Members, Tasks, Announcements, Finance, and failed expense save on the available emulator at default and 200 percent text scale.
- [x] Inspect the offline Tasks state with an authenticated cache; verify its age, Retry, disabled-write explanation, neutral background, and removal of decorative blobs at default and 200 percent text scale.
- [x] Save emulator screenshots in `docs/evidence/screenshots/ui-redesign/` and record emulator model, API level, and text scale in [UI redesign verification](../evidence/UI-redesign-verification.md).

On 2026-10-04, the API 37 Medium_Phone emulator was used at 1080 by 2400 pixels, 420 dpi, and 1.0 and 2.0 system font scales.
The final `flutter analyze`, `flutter test`, and `flutter build apk --debug` run started at 2026-10-04T20:30:40+08:00; analyze passed at 20:30:44, tests passed at 20:31:00 with 54 passes and one existing live API skip, and the debug build passed at 20:31:10.
The authenticated offline cache screenshot showed the real cache age as `Just now`; after the isolated API restarted, Retry refreshed `/api/auth/me`, Members, Tasks, and Announcements successfully and cleared the banner.
The 200 percent review exposed long extended actions covering list content, so a local adaptive action uses a labeled extended target at normal scale and a labeled icon target with a tooltip at large scale.
The offline banner wraps at large scale and keeps Retry available; the Finance save failure kept the entered values and displayed the existing offline recovery message.
No API, database schema, permission, validation, or dependency changes were made in this phase.

### Review and checkpoint

- [x] Review screen semantics, form recovery, touch targets, text scaling, existing workflows, and unrelated changes.
- [x] Update plan and current handoff with actual checks and limitations.
- [x] Stage only reviewed Phase 5 paths and inspect the staged diff.
- [x] Commit as `feat(mobile): restyle lagoon android screens` and verify Git reports success.

## Phase 6: Integrated verification, evidence, and handoff

Requirements: PROD-005 revision 4 and UI-REQ-001 through UI-REQ-012, alongside all current approved feature behavior.

State: Complete; integrated verification and evidence are committed as `test(ui): verify lagoon redesign release`.

### Tasks

- [x] Run the existing web and Android verification gates without deleting or weakening assertions.
- [x] Verify every text and fill pairing used by the approved token table against WCAG 2.2 AA, and verify control boundaries and focus rings meet at least 3:1 contrast.
- [x] Verify the primary web flows at 375, 768, 1024, and 1440 CSS-pixel widths, with no page-level horizontal scrolling.
- [x] Verify keyboard traversal and ensure every visible focus target is unobscured by navigation, banners, or sheets.
- [x] Verify the available Android emulator at default and 200 percent text scales, including offline Tasks.
- [x] Create `docs/evidence/UI-redesign-verification.md` with actual commands, scenarios, results, timestamps, environment, screenshots, and limitations.
- [x] Keep physical-device, TalkBack, production, and field checks pending until Len supplies actual results.
- [x] Update `docs/SPEC_INDEX.md` and `HANDOFF.md` with approved revisions, evidence, phase checkpoints, and remaining limitations.

### Verification

- [x] Run `npm test`, `npm run test:ui`, `npm run test:e2e`, and `npm run test:performance` from the repository root; expect all existing gates to pass.
- [x] Run `flutter analyze`, `flutter test`, and `flutter build apk --debug` from `mobile/`; analyzer and build passed, and 54 tests passed with one existing live API test skipped because `FINANCE_LIVE_API` was unset.
- [x] Review evidence against the required responsive, keyboard, contrast, emulator, offline, and accessibility scenarios; distinguish emulator evidence from physical-device evidence.
- [x] Review the complete diff for behavior changes, unapproved dependencies, secrets, generated files, and unrelated work.

Web gates ran on 2026-10-04; their exact terminal start times were not retained, and their outputs and measured durations are recorded in [UI redesign verification](../evidence/UI-redesign-verification.md).

The final Android gates ran from `mobile/` between 2026-10-04T20:30:40+08:00 and 20:31:10+08:00.

The contrast review checked 34 text/fill pairs, with all text pairings at or above 4.5:1 and the approved control border and focus color at or above 3:1.

The physical-device, TalkBack, API 24, real Safari, production, and field checks remain pending as recorded in the evidence file.

### Review and checkpoint

- [x] Confirm each prior phase has passed its required checks and has a verified local commit.
- [x] Stage only reviewed Phase 6 paths and inspect the staged diff.
- [x] Commit as `test(ui): verify lagoon redesign release` and verify Git reports success.

## Recovery

Follow project `AGENTS.md` for the three-attempt limit and immediate blockers.

Record every attempted fix and actual check result in `HANDOFF.md`; a failed check or commit leaves the phase incomplete and uncommitted.

Stop the dependent work for a required scope or architecture decision, unavailable emulator or test infrastructure, or unavailable permission; continue only independent approved work.

Len authorized this exact PLAN-003 revision 1 and PROD-005 revision 4 in chat on 2026-10-04T16:19:21+08:00.
