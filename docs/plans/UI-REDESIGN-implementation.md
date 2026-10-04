# Implementation plan: Lagoon UI redesign

Created: 2026-10-04T16:08:31+08:00
Updated: 2026-10-04T18:28:10+08:00
Revision: 1
Status: Approved; Phase 1 complete; Phase 2 implementation, review, UI checks, and E2E checks complete; Phase 2 checkpoint pending.
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

State: Implementation, review, and required UI and E2E verification complete; checkpoint commit is pending.

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
- [ ] Stage only reviewed Phase 2 paths and inspect the staged diff.
- [ ] Commit as `feat(ui): restyle web organization pages` and verify Git reports success.

## Phase 3: Web finance and spreadsheet flows

Requirements: PROD-005 revision 4 Finance, Tables, and Charts rules; UI-REQ-004, UI-REQ-006, UI-REQ-007, and UI-REQ-010 through UI-REQ-012.

State: Not started.

### Tasks

- [ ] Reorder the existing Finance report to show a Remaining hero tile with its progress track, then Actual and Estimate tiles, followed by the existing category comparison, trend, and register.
- [ ] Restyle category tracks and over-budget state with visible percentages, over amounts, text labels, and an equivalent table.
- [ ] Restyle the monthly trend while retaining its equivalent table, point labels, in-progress month explanation, and existing data behavior.
- [ ] Restyle the expense register and spreadsheet import preview without changing import validation, duplicate decisions, export contents, or commit behavior.
- [ ] Keep semantic table markup, right-aligned money, and any narrow-screen horizontal scrolling inside the table panel only.

### Verification

- [ ] Run `npm test`, `npm run test:ui`, and `npm run test:e2e` from the repository root and expect existing finance, UI, and end-to-end assertions to pass.
- [ ] Verify the report, register, and import-preview keyboard flows; confirm charts retain their text or table equivalent and import errors remain recoverable.
- [ ] Inspect the Finance and import primary flows at 375, 768, 1024, and 1440 CSS-pixel widths; confirm page-level horizontal overflow is absent.
- [ ] Save available Finance and import screenshots in `docs/evidence/screenshots/ui-redesign/` and record the viewport and browser.

### Review and checkpoint

- [ ] Review money labels, chart equivalents, import and export behavior, focus handling, and unrelated changes.
- [ ] Update plan and current handoff with actual checks and limitations.
- [ ] Stage only reviewed Phase 3 paths and inspect the staged diff.
- [ ] Commit as `feat(ui): restyle web finance workflows` and verify Git reports success.

## Phase 4: Android theme and shell

Requirements: PROD-005 revision 4 Android and visual token rules; UI-REQ-001, UI-REQ-004, UI-REQ-006, UI-REQ-007, UI-REQ-008, and UI-REQ-009.

State: Not started.

### Tasks

- [ ] Apply the approved Lagoon colors, shape themes, typography, and elevations in `mobile/lib/theme.dart` without adding a package.
- [ ] Restyle the app bar organization switcher, four-item bottom bar and selected lime marker, Finance entry on Overview, and offline banner and background.
- [ ] Preserve back behavior, scope selection, accessibility labels, and the existing offline read and write behavior.

### Verification

- [ ] Run `flutter analyze` and `flutter test` from `mobile/` and expect zero analyzer issues and all existing tests to pass.
- [ ] Launch on the available Android emulator at default text scale; inspect organization scope, selected destination, Finance entry, and offline state.
- [ ] Save available emulator screenshots in `docs/evidence/screenshots/ui-redesign/` and record emulator model and API level.

### Review and checkpoint

- [ ] Review Android shell semantics, tap targets, text scaling, offline messaging, and unrelated changes.
- [ ] Update plan and current handoff with actual checks and limitations.
- [ ] Stage only reviewed Phase 4 paths and inspect the staged diff.
- [ ] Commit as `feat(mobile): apply lagoon android shell` and verify Git reports success.

## Phase 5: Android screens and forms

Requirements: PROD-005 revision 4 Android, summary tile, list, table, and chart rules; UI-REQ-001 through UI-REQ-011.

State: Not started.

### Tasks

- [ ] Restyle Overview, Members, Tasks, Announcements, Finance, and finance forms using existing screen modules and small local widgets.
- [ ] Keep lists and forms straight-edged, preserve status labels, and use blobs only for approved decoration and marker shapes.
- [ ] Keep the four-item bottom navigation, Finance card, 48-logical-pixel targets, and 200 percent text-scaling support.
- [ ] Preserve current Finance authorization and online-only behavior; do not change Android member, task, or announcement write routes.

### Verification

- [ ] Run `flutter analyze` and `flutter test` from `mobile/` and expect zero analyzer issues and all existing tests to pass.
- [ ] Inspect Overview, Members, Tasks, Announcements, Finance, and failed expense save on the available emulator at default and 200 percent text scale.
- [ ] Inspect the offline Tasks state and confirm cached age, Retry, disabled-write explanation, neutral background, and removal of decorative blobs remain clear.
- [ ] Save available emulator screenshots in `docs/evidence/screenshots/ui-redesign/` and record emulator model, API level, and text scale.

### Review and checkpoint

- [ ] Review screen semantics, form recovery, touch targets, text scaling, existing workflows, and unrelated changes.
- [ ] Update plan and current handoff with actual checks and limitations.
- [ ] Stage only reviewed Phase 5 paths and inspect the staged diff.
- [ ] Commit as `feat(mobile): restyle lagoon android screens` and verify Git reports success.

## Phase 6: Integrated verification, evidence, and handoff

Requirements: PROD-005 revision 4 and UI-REQ-001 through UI-REQ-012, alongside all current approved feature behavior.

State: Not started.

### Tasks

- [ ] Run the existing web and Android verification gates without deleting or weakening assertions.
- [ ] Verify every text and fill pairing used by the approved token table against WCAG 2.2 AA, and verify control boundaries and focus rings meet at least 3:1 contrast.
- [ ] Verify the primary web flows at 375, 768, 1024, and 1440 CSS-pixel widths, with no page-level horizontal scrolling.
- [ ] Verify keyboard traversal and ensure every visible focus target is unobscured by navigation, banners, or sheets.
- [ ] Verify the available Android emulator at default and 200 percent text scales, including offline Tasks.
- [ ] Create `docs/evidence/UI-redesign-verification.md` with actual commands, scenarios, results, timestamps, environment, screenshots, and limitations.
- [ ] Keep physical-device, TalkBack, production, and field checks pending until Len supplies actual results.
- [ ] Update `docs/SPEC_INDEX.md` and `HANDOFF.md` with approved revisions, evidence, phase checkpoints, and remaining limitations.

### Verification

- [ ] Run `npm test`, `npm run test:ui`, `npm run test:e2e`, and `npm run test:performance` from the repository root; expect all existing gates to pass.
- [ ] Run `flutter analyze`, `flutter test`, and `flutter build apk --debug` from `mobile/`; expect zero analyzer issues, all tests to pass, and a successful debug build.
- [ ] Review evidence against the required responsive, keyboard, contrast, emulator, offline, and accessibility scenarios; distinguish emulator evidence from physical-device evidence.
- [ ] Review the complete diff for behavior changes, unapproved dependencies, secrets, generated files, and unrelated work.

### Review and checkpoint

- [ ] Confirm each prior phase has passed its required checks and has a verified local commit.
- [ ] Stage only reviewed Phase 6 paths and inspect the staged diff.
- [ ] Commit as `test(ui): verify lagoon redesign release` and verify Git reports success.

## Recovery

Follow project `AGENTS.md` for the three-attempt limit and immediate blockers.

Record every attempted fix and actual check result in `HANDOFF.md`; a failed check or commit leaves the phase incomplete and uncommitted.

Stop the dependent work for a required scope or architecture decision, unavailable emulator or test infrastructure, or unavailable permission; continue only independent approved work.

Len authorized this exact PLAN-003 revision 1 and PROD-005 revision 4 in chat on 2026-10-04T16:19:21+08:00.
