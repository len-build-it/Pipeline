# UI redesign implementation handoff: Lagoon

Created: 2026-10-04T15:56:10+08:00
Updated: 2026-10-04T16:20:57+08:00
Revision: 2
ID: DESIGN-002
Status: Supporting design reference. Implementation is authorized by PROD-005 revision 4 and PLAN-003 revision 1.

## Purpose

This document hands the "Lagoon" visual redesign of Team Manager to an implementing AI agent.
Lagoon replaces the calm grey-and-teal look with a fresh, vibrant look built from flowing blob shapes and soft clay-like surfaces.
Len's stated goal is that the app must not look stale or crowded with data.
The redesign is visual and layout-level only.
It changes no API, data rule, role permission, workflow, or copy meaning.

## Decision record

Len chose the direction in chat on 2026-10-04 (Philippine time) across three messages.
First: "I'm kind of thinking something that has more of a vibrant vibe and imlementing biomorphic ui design."
Second: "flowing blob shapes and soft clay like surfaces not nature inspired palette and texture", a "fresh" palette, and "Sure split it. The main goal is not to make the app look stale and full of data asf".
Third: "Arhive the existing ones and implement the new design. and lets go with lagoon. After creating the design create a handoff for another AI agent to implement the UI re-design".
"Split it" refers to the rule that the shell is organic and data surfaces stay straight-edged.
"Lagoon" is the middle of three proposed intensities (Mist, Lagoon, Splash).

## Approval gate

The approved UI/UX specification, [PROD-005 revision 3](UI_UX_DESIGN.md), still describes the previous look.
Under [AGENTS.md](../../AGENTS.md), a change to an approved specification needs Len's approval against an exact document revision.
Before editing application code, the implementing agent must do the following in order.

1. PROD-005 revision 4 was drafted at [UI_UX_DESIGN.md](UI_UX_DESIGN.md).
2. PLAN-003 revision 1 was drafted at [UI-redesign implementation plan](../plans/UI-REDESIGN-implementation.md).
3. Len approved both exact revisions in chat on 2026-10-04T16:19:21+08:00: "Approve PROD-005 revision 4 and PLAN-003 revision 1". The approval is recorded in [HANDOFF.md](../../HANDOFF.md) and [SPEC_INDEX.md](../SPEC_INDEX.md).
4. Execute the approved plan with the normal phase, check, evidence, and commit rules. Phase 1 is in progress.

Do not record an approval that Len has not given.

## Design reference

The mockups are a private claude.ai design canvas owned by Len, titled "Team Manager design mockups".
The canvas address is https://claude.ai/artifact/8g2jVSDVLztyFDTUgFpbKm.
Len must share it or export it before another agent can open it.
The "Lagoon redesign" page holds twelve artboards, and the "Archive - original" page holds the thirteen superseded artboards.
The mockups were not rendered or visually checked by the agent that produced them, so treat spacing as indicative and this document as the binding description.
All names, tasks, and amounts in the mockups are sample data.

| Artboard | Shows |
| --- | --- |
| Lagoon web - Overview (one organization) | Shell, header blobs, hero tile, metric tiles, attention list. |
| Lagoon web - Owner combined overview | Combined scope with its own tint, organization cards. |
| Lagoon web - Members and invite recovery | Soft roster rows, blob avatars, failed-submit form. |
| Lagoon web - Tasks list and detail | Status tiles, collapsed filters, quiet rows, on-demand detail panel. |
| Lagoon web - Announcements and compose | Feed cards, distinct draft, compose panel. |
| Lagoon web - Finance report and register | Hero remaining tile, category table with bars, trend chart with table, register. |
| Lagoon web - Spreadsheet import preview | Step pills, outcome tiles, blocking error, duplicate choice. |
| Lagoon web at 375 - Tasks stacked | Phone-width header, stacked records. |
| Lagoon Android - Overview | App bar scope, hero tile, Finance entry, bottom bar. |
| Lagoon Android - Tasks offline | Offline banner, neutral background, disabled write. |
| Lagoon Android - Finance | Month stepper, hero tile, category bars, floating action. |
| Lagoon Android - Record expense, failed save | Form sheet, error summary, inline errors. |

## Design principles

1. Organic shell, straight data. Blobs and clay are for the page background, navigation, summary tiles, primary actions, avatars, and sheets. Lists, tables, forms, error summaries, and charts stay straight-edged and aligned.
2. Summary first. Each page opens with one large tile that states the most important number in big type, followed by smaller tiles, then quieter detail.
3. Quieter detail. Lists lose grid lines and heavy chrome, gain row spacing, and put secondary fields on one muted line under the title.
4. Color with a job. Brand colors (teal, aqua, lime) decorate and group. Status colors (red, amber, blue, green, grey) only ever mean status.
5. Nothing is lost. Every field, state, label, and action in the current app remains reachable and worded as before.

## Tokens

These replace the token values in `web/css/styles.css` and `mobile/lib/theme.dart`.
Keep the existing token names where a name exists and add the new ones.
Every text and fill pairing must be contrast-checked during implementation; the values below were chosen to meet WCAG 2.2 AA but have not been measured.

### Color

| Token | Value | Use |
| --- | --- | --- |
| background | #E6FAF7 | Page background for one organization. |
| background-combined | #EEF2FF | Page background in the owner combined view only. |
| background-offline | #EEF2F3 | Android page background while showing cached data. |
| surface | #FFFFFF | Panels, navigation, forms, sheets. |
| text | #0B2A2E | Primary text. |
| text-muted | #3F5B60 | Supporting text. |
| divider | #D9EEF0 | Row dividers inside panels. |
| control-border | #5B7B80 | Input, select, and progress-track borders. |
| primary | #0E7490 | Primary buttons, links on fills, progress fill, chart line. |
| primary-strong | #155E75 | Link text and secondary-button text on white. |
| primary-text | #FFFFFF | Text on primary. |
| aqua | #22D3EE | Wordmark blob only. |
| aqua-soft | #A5F3FC | Background blobs, avatar fills. |
| aqua-tint | #CFFAFE | Clay tile fill, info callouts. |
| mint-tint | #D1FAE5 | Clay tile fill. |
| lime | #BEF264 | Selected navigation marker, current step, Android floating action. |
| lime-soft | #D9F99D | Background blobs, avatar fills. |
| lime-tint | #ECFCCB | Clay tile fill. |
| on-lime | #1A2E05 | Text and icons on lime. |
| combined-soft | #C7D2FE | Background blob in the combined view. |
| combined-tint | #E0E7FF | Clay tile fill in the combined view. |
| danger / danger-bg | #991B1B / #FEE2E2 | Overdue, blocked, over budget, errors, destructive actions. |
| warning / warning-bg | #92400E / #FEF3C7 | Due soon, pending, drafts, possible duplicates, offline. |
| info / info-bg | #1E40AF / #DBEAFE | In progress, informational states, focus ring. |
| success / success-bg | #166534 / #DCFCE7 | Done, active, within budget, saved. |
| neutral / neutral-bg | #334155 / #E2E8F0 | Backlog, inactive, voided, disabled. |

Lime is never used for a status.
Success states always carry a text label so they cannot be confused with lime decoration.

### Shape

| Token | Value | Use |
| --- | --- | --- |
| radius-control | 14px | Inputs and selects (16px on Android). |
| radius-callout | 20px | Alerts and inset groups. |
| radius-panel | 28px | Panels and clay tiles (24px on phone and Android). |
| radius-pill | 999px | Buttons and chips. |
| radius-rail | 0 36px 36px 0 | Web navigation rail. |
| blob-a | 58% 42% 63% 37% / 45% 55% 45% 55% | Large background blob, avatars, wordmark mark. |
| blob-b | 40% 60% 45% 55% / 60% 40% 60% 40% | Small background blob. |
| blob-marker | 26px 18px 28px 16px / 20px 28px 16px 26px | Selected navigation item, current step, Android floating action. |
| blob-hero | 36px 28px 40px 28px / 28px 40px 28px 36px | Hero tile only. |

Form fields, table cells, and error summaries never use a blob radius.

### Elevation

| Token | Value | Use |
| --- | --- | --- |
| shadow-panel | 0 8px 24px rgba(11,42,46,.08) | White panels. |
| shadow-clay | 0 10px 22px rgba(14,116,144,.18), inset 0 2px 0 rgba(255,255,255,.75), inset 0 -5px 10px rgba(14,116,144,.10) | Clay tiles. |
| shadow-primary | 0 6px 14px rgba(14,116,144,.35), inset 0 2px 0 rgba(255,255,255,.3) | Primary buttons. |
| shadow-lime | 0 6px 12px rgba(101,163,13,.3), inset 0 2px 0 rgba(255,255,255,.6) | Lime marker and floating action. |

### Type

The font stack stays the system sans-serif stack; no web font or font package is added.
Page titles are 38px weight 800 on desktop and 28 to 30px on phone and Android.
Section headings are 22px weight 800 on desktop and 18px on Android.
Hero numbers are 52 to 64px weight 800; tile numbers are 28 to 44px weight 800.
Body text stays 16px with 1.5 line height, and supporting text is 14px.
Money uses tabular figures.

## Component rules

### Web shell

The left rail is a white surface with the rail radius and a soft shadow.
It holds the wordmark with a small aqua blob mark, the labeled organization select, the five destinations, and an account block on a tinted inset.
The selected destination uses the lime blob marker with weight 800 and keeps `aria-current="page"`.
The main area has one large aqua blob behind the top right of the header and one small lime blob beside it.
Blobs are decorative, are hidden from assistive technology, sit behind content, and never sit behind a table or form.
Below 768px the rail becomes a top bar with a Menu button and the organization select, as it does today.

### Buttons, inputs, chips

Buttons are pills at least 44px tall on web and 48px on Android.
Primary buttons are filled teal with white text and the primary shadow; secondary buttons are white with a 2px teal border.
Disabled buttons use the neutral fill, have no shadow, and keep a visible explanation next to them.
Inputs keep a persistent visible label above them, a 1.5px control border, and the control radius.
A field with an error gets a 2px danger border and an error line that starts with "Error:".
Chips are borderless pills using a status background with its matching status text color and always contain a text label.
The focus ring is a 3px info-colored outline with a 2px offset on every interactive element.

### Summary tiles

Each page that has numbers opens with a tile row.
The first tile is the hero: white, blob-hero radius, clay shadow, largest number, and where useful one primary action.
The remaining tiles are clay tiles filled with aqua-tint, mint-tint, or lime-tint.
A tile whose number is a problem count shows that number in the danger color and names the problem in words.

### Lists

Rows sit inside one white panel.
Each row has a bold linked title, one muted line of secondary fields, and status chips aligned right or in their own column.
Rows are separated by a single divider line with no vertical lines and no zebra striping.
The selected row uses an aqua-tint background and keeps `aria-current`.
At phone width each record becomes its own small panel with chips first, then title, then the muted line.

### Tables

Finance tables, the import preview, and the combined overview keep real table markup with header cells.
They sit in a white panel, use divider-only row lines, right-align money, and scroll horizontally inside their box when narrow.

### Charts

The budget comparison is a row-level progress track inside the category table, so the table is its own text equivalent.
Tracks are 16px tall with a control border; the fill is teal.
An over-budget track is fully filled with a red diagonal hatch, plus the percentage, the over amount, and an "Over budget" chip in text.
The monthly trend is a smooth teal line over an aqua-tint area with a value label on every point and a table beside it.
The in-progress month uses a dotted segment and an open point, explained in the caption.

### Scope distinction

The owner combined view swaps the page background to background-combined and the blobs and tiles to the combined tints.
It also shows a "Combined view" chip above the title and names the organization on every task and announcement row.
The scope must remain identifiable from the title and the organization control without relying on the tint.

### Android

Use the existing four bottom destinations (Overview, Members, Tasks, Announcements); Finance stays reachable from a labeled filled card on Overview.
The bottom bar is a white surface with rounded top corners; the selected destination has the lime blob marker behind its icon and a weight 800 label.
The app bar is transparent over the page background and shows the "Organization" caption and the organization name as the switcher.
Forms sit on a white sheet with 32px top corners.
The floating "Record expense" action is a lime blob-marker shape with on-lime text.
Offline is shown by a warning-colored banner with an icon, the saved time, and Retry, and by switching the page background to background-offline and removing the decorative blob.
All targets stay at least 48 logical pixels and layouts must survive 200 percent text scaling.

### Motion

Keep motion to feedback and continuity as PROD-005 already requires.
Blobs do not animate.
Honor reduced-motion settings on both clients.

## Proposed specification changes

These are the deltas for PROD-005 revision 4.
Everything not listed here stays as approved in revision 3.

| Section of PROD-005 | Current | Proposed |
| --- | --- | --- |
| Purpose and design stance | Prioritize orientation and scanning "over visual novelty". | Keep the priority, and add that the interface should feel fresh and uncluttered through summary-first pages. |
| Visual system, direction | "Calm, high-contrast, grid-based, and content-first." | "Fresh, high-contrast, summary-first, with an organic shell and straight-edged data surfaces." |
| Visual system, tokens | Slate and teal palette. | The color, shape, and elevation tokens in this document. |
| Visual system, borders | `color.border` #CBD5E1 for dividers and control boundaries. | Separate divider and control-border tokens so control edges reach 3:1 contrast. |
| Overview | Four summary metrics shown as equal cards. | The same four metrics, with overdue tasks as the hero tile. |
| Members | "Search, a small set of filters" visible. | Search visible; role and status filters behind one labeled Filters control. |
| Tasks | Filters visible. | Search visible; filters behind one labeled Filters control, with active filters shown as chips. A status tile row is added above the list. |
| Tasks, Members detail | Desktop "may use a detail panel". | The detail panel opens on selection and has a Close control. |
| Finance | Opens with budget versus actual. | Opens with a hero "Remaining" tile with a progress track, then actual and estimate tiles, then the same category table, trend, and register. |
| Open questions | "Text wordmark"; decoration avoided. | Text wordmark with a small decorative blob mark; decorative blobs allowed in the shell only. |

Requirements UI-REQ-001 through UI-REQ-012 are unchanged and remain the acceptance criteria.

The Tasks status tile row shows counts by status.
If the current API does not already return those counts for the selected organization, do not add an endpoint; raise it with Len or omit the row.

## Out of scope

- Any API, database, permission, validation, or copy-meaning change.
- New dependencies, including fonts, icon packs, CSS frameworks, component libraries, and Flutter packages.
- Dark mode, animation beyond existing feedback, illustrations, and a custom logo.
- The remaining Android write routes for members, tasks, and announcements (ISS-002 in [HANDOFF.md](../../HANDOFF.md)), which stay Len's separate decision.
- Kanban, dashboard charts on Overview, and any feature excluded by the approved specifications.

## Code map

| Area | Files |
| --- | --- |
| Web tokens and all styles | `web/css/styles.css` (tokens in `:root` at the top; about 880 lines). |
| Web shell and routing | `web/index.html`, `web/js/app.js`, `web/js/modal.js`. |
| Web views | `web/js/views/overview.js`, `members.js`, `tasks.js`, `announcements.js`, `finance.js`, `finance-report.js`, `finance-forms.js`, `finance-import.js`, `auth.js`. |
| Android tokens and theme | `mobile/lib/theme.dart` (`AppColors`, `buildAppTheme`). |
| Android shell | `mobile/lib/screens/home_shell.dart`. |
| Android screens | `mobile/lib/screens/overview_screen.dart`, `members_screen.dart`, `tasks_screen.dart`, `announcements_screen.dart`, `finance_screen.dart`, `finance_forms.dart`. |

The web client is plain HTML, CSS, and JavaScript modules with no framework.
Implement the redesign with CSS custom properties and the existing view modules.
On Android, implement it through `ThemeData`, shape themes, and small local widgets; use `CustomPainter` or `ClipPath` only for the blobs.

## Suggested phases

1. Web tokens and shell: replace token values, add new tokens, restyle the rail, buttons, inputs, chips, panels, focus ring, and background blobs.
2. Web pages: Overview, Members, Tasks, Announcements, including collapsed filters and the on-demand detail panel.
3. Web Finance: report tiles, category table bars, trend chart, register, and the import preview.
4. Android theme and shell: `AppColors`, `buildAppTheme`, app bar, bottom bar marker, offline banner.
5. Android screens: Overview, Members, Tasks, Announcements, Finance, and finance forms.
6. Integrated verification, evidence, and handoff update.

## Verification

Run the existing gates unchanged and treat any failure as a regression to fix within the design, not by weakening a test.

- `npm test`
- `npm run test:ui`
- `npm run test:e2e`
- `npm run test:performance`
- `flutter analyze`, `flutter test`, and `flutter build apk --debug` in `mobile/`

Keep element ids, roles, labels, and accessible names that the Playwright and widget tests select on.
If a selector must change because markup moved, change the test selector only and leave the assertion intact.

Add evidence for the following, with screenshots where capture is available.

- Web at 375, 768, 1024, and 1440 widths with no horizontal page scrolling on primary flows.
- Keyboard traversal with a visible focus ring on every control, never hidden behind the rail or a sheet.
- Measured contrast for every text and fill pairing in the token table, and 3:1 for control borders and the focus ring.
- Android emulator screens at default and 200 percent text scale, and the offline Tasks state.
- A statement of which checks ran, their results, and their limits.

Physical-device checks, including TalkBack, remain Len's and stay pending until Len reports them.

## Risks to watch

- Lime sits near the success green; never let lime carry status meaning.
- Clay shadows and tints must not lower text contrast; measure, do not assume.
- Collapsing filters must not hide the fact that a filter is active; show active filters as chips.
- Large radii and asymmetric shapes must not clip text at large text sizes.
- Decorative blobs must not sit behind small text or reduce its contrast.
