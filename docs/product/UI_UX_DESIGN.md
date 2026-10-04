# UI UX system design: Configurable Team Manager

Created: 2026-09-16T21:37:27+08:00
Updated: 2026-10-04T16:20:57+08:00
Revision: 4
Status: Approved.
Approval: Len approved this exact PROD-005 revision 4 in chat on 2026-10-04T16:19:21+08:00: "Approve PROD-005 revision 4 and PLAN-003 revision 1".
Supersedes approved revision 3, which was approved by Len in chat on 2026-10-03T22:31:00+08:00.

## Purpose and design stance

This document defines the shared UI and UX direction for the web dashboard and Flutter Android app.

The product is an internal management tool for a small organization, so the interface should prioritize orientation, fast scanning, and safe actions while feeling fresh and uncluttered through summary-first pages.

The primary design promise is that a lead can answer three questions quickly: what needs attention, who owns it, and what action is available next.

The interface uses progressive disclosure, plain-language labels, consistent placement, and visible feedback after every mutation.

## Observed facts and assumptions

The product has two clients, a responsive web dashboard and a Flutter Android app, backed by one shared API.

The product manages members, tasks, announcements, dashboard summaries, budgets, and expenses for configured teams.

The users are a small team with one owner, organization leads, and members.

No existing brand kit, logo, color palette, or design system was provided.

The Lagoon direction and tokens are a product design choice, not an existing brand kit or brand asset.

## Information architecture and navigation

The web product has Overview, Members, Tasks, Announcements, and Finance destinations. Android keeps no more than four bottom destinations and exposes Finance through a clearly labeled secondary destination.

The current organization scope is always visible near the top of the interface.

Owners can choose the combined overview or any configured organization they can access.

Leads and members can choose only organizations where they have active membership.

### Web navigation

The desktop layout uses a persistent left navigation rail with the product name, organization switcher, five destinations, and account controls.

The main content area has one page title, an optional short description, a primary action, and the content needed for the selected task.

At widths below 768px, the navigation rail becomes a top bar with a Menu button and the organization switcher; the current destination and organization scope remain clear.

Keyboard users receive a skip-to-content link, logical tab order, and visible focus indicators.

### Android navigation

The Android layout uses a top app bar with the current organization scope and a bottom navigation bar with no more than four primary destinations.

Secondary actions appear in the page body or an explicitly labeled overflow menu.

Android back navigation returns to the previous screen or closes the current modal before leaving the app.

The selected destination, current organization, and offline state remain visible without relying on color alone.

## Responsive layout

The design is mobile-first and must remain usable at 375px, 768px, 1024px, and 1440px widths.

At phone width, record lists become stacked panels and filters move behind one clearly labeled control or sheet. Finance, import-preview, and owner combined-view tables retain semantic table markup and may scroll horizontally inside their own white panel; the page itself must not scroll horizontally.

At tablet width, content uses a single column with two-column cards only when each card remains readable.

At desktop width, dashboard cards and detail panels may use a two- or three-column grid within a readable maximum content width.

No screen may require horizontal scrolling for its primary flow.

Dialogs on desktop become full-screen or bottom sheets on mobile when the form would otherwise be cramped.

## Visual system

The proposed Lagoon direction is fresh, high-contrast, and summary-first, with an organic shell and straight-edged data surfaces.

The page should feel vibrant without making operational information feel crowded.

Biomorphic blobs and clay-like surfaces decorate the shell, navigation, summary tiles, primary actions, avatars, and sheets; lists, tables, forms, error summaries, and charts stay straight-edged and aligned.

The MVP uses a system sans-serif font stack and launches in light mode; dark mode remains deferred.

Keep existing token names where present and add the new semantic tokens below in `web/css/styles.css` and `mobile/lib/theme.dart`.

`color.border` remains the token name for control boundaries, while the new `color.divider` token is used for subtle row separators.

| Token | Proposed value | Use |
| --- | --- | --- |
| color.background | #E6FAF7 | Page background for one organization. |
| color.backgroundCombined | #EEF2FF | Page background in the owner combined view only. |
| color.backgroundOffline | #EEF2F3 | Android page background while showing cached data. |
| color.surface | #FFFFFF | Panels, navigation, forms, and sheets. |
| color.text | #0B2A2E | Primary text. |
| color.textMuted | #3F5B60 | Supporting text. |
| color.divider | #D9EEF0 | Row dividers inside panels. |
| color.border | #5B7B80 | Input, select, and progress-track boundaries. |
| color.primary | #0E7490 | Primary buttons, links on fills, progress fill, and chart line. |
| color.primaryHover | #155E75 | Link text and secondary-button text on white, and primary hover state. |
| color.primaryText | #FFFFFF | Text on primary. |
| color.accent | #22D3EE | Existing token name retained as an alias of aqua; decorative use only. |
| color.aqua | #22D3EE | Wordmark blob only. |
| color.aquaSoft | #A5F3FC | Background blobs and avatar fills. |
| color.aquaTint | #CFFAFE | Clay tile fill and informational callouts. |
| color.mintTint | #D1FAE5 | Clay tile fill. |
| color.lime | #BEF264 | Selected navigation marker, current step, and Android floating action. |
| color.limeSoft | #D9F99D | Background blobs and avatar fills. |
| color.limeTint | #ECFCCB | Clay tile fill. |
| color.onLime | #1A2E05 | Text and icons on lime. |
| color.combinedSoft | #C7D2FE | Background blob in the combined view. |
| color.combinedTint | #E0E7FF | Clay tile fill in the combined view. |
| color.danger / color.dangerBg | #991B1B / #FEE2E2 | Overdue, blocked, over budget, errors, and destructive actions. |
| color.warning / color.warningBg | #92400E / #FEF3C7 | Due soon, pending, drafts, possible duplicates, and offline. |
| color.info / color.infoBg | #1E40AF / #DBEAFE | In progress, informational states, and focus ring. |
| color.success / color.successBg | #166534 / #DCFCE7 | Done, active, within budget, and saved. |
| color.neutral / color.neutralBg | #334155 / #E2E8F0 | Backlog, inactive, voided, and disabled. |

Lime never carries status meaning, and every success state has a text label.

Status colors are always paired with a text label, icon, or position so status is not communicated by color alone.

The spacing scale keeps 8px increments, with 16px as the default control gap and 24px as the default section gap.

| Shape token | Proposed value | Use |
| --- | --- | --- |
| radius-control | 14px on web and 16px on Android | Inputs and selects. |
| radius-callout | 20px | Alerts and inset groups. |
| radius-panel | 28px on desktop and 24px on phone and Android | Panels and clay tiles. |
| radius-pill | 999px | Buttons and chips. |
| radius-rail | 0 36px 36px 0 | Web navigation rail. |
| blob-a | 58% 42% 63% 37% / 45% 55% 45% 55% | Large background blob, avatars, and wordmark mark. |
| blob-b | 40% 60% 45% 55% / 60% 40% 60% 40% | Small background blob. |
| blob-marker | 26px 18px 28px 16px / 20px 28px 16px 26px | Selected navigation item, current step, and Android floating action. |
| blob-hero | 36px 28px 40px 28px / 28px 40px 28px 36px | Hero tile only. |

Form fields, table cells, and error summaries never use a blob radius.

| Elevation token | Proposed value | Use |
| --- | --- | --- |
| shadow-panel | 0 8px 24px rgba(11,42,46,.08) | White panels. |
| shadow-clay | 0 10px 22px rgba(14,116,144,.18), inset 0 2px 0 rgba(255,255,255,.75), inset 0 -5px 10px rgba(14,116,144,.10) | Clay tiles. |
| shadow-primary | 0 6px 14px rgba(14,116,144,.35), inset 0 2px 0 rgba(255,255,255,.3) | Primary buttons. |
| shadow-lime | 0 6px 12px rgba(101,163,13,.3), inset 0 2px 0 rgba(255,255,255,.6) | Lime marker and floating action. |

Page titles are 38px weight 800 on desktop and 28 to 30px on phone and Android.

Section headings are 22px weight 800 on desktop and 18px on Android.

Hero numbers are 52 to 64px weight 800, and tile numbers are 28 to 44px weight 800.

Body text stays at 16px with 1.5 line height, supporting text is 14px, and money uses tabular figures.

Use built-in Material icons in Flutter and text labels on the web; additional icon dependencies are unnecessary for the MVP.

Every foreground and fill pairing must be measured during implementation against WCAG 2.2 AA, and control boundaries and focus rings must reach at least 3:1 contrast.

Motion stays limited to existing feedback and spatial continuity, blobs do not animate, and reduced-motion settings are honored on both clients.

## Core screens and interaction rules

### Overview

The page begins with the selected organization scope and four summary metrics: overdue tasks, active members, open tasks, and recent announcements.

Overdue tasks is the hero tile; the other three metrics remain available as smaller tiles.

The next section shows the most actionable tasks, followed by recent announcements.

Quick actions are limited to Add member, New task, and New announcement, and are shown only when the user has permission.

The dashboard does not show decorative charts in the MVP; counts and short lists are sufficient for the small-team use case.

### Members

Members opens with visible search, role and status filters behind one labeled Filters control, and an obvious Invite member action for authorized users.

Each record shows name, role, status, organization, and a secondary detail action.

Selecting a member opens the detail panel on desktop; the panel has a Close control. Mobile keeps the full member detail screen.

Role and deactivation changes require confirmation and explain the consequence before the final action.

### Tasks

Tasks defaults to a scannable list with status, priority, assignee, due date, and organization visible without opening every record.

Search remains visible, and status, priority, assignee, label, overdue, and archive filters sit behind one labeled Filters control; active filters remain visible as chips.

Do not add the proposed task-status summary tiles because the existing task API paginates results and does not return complete per-status counts for an organization.

Filters are status, priority, assignee, label, and overdue state.

Task creation uses a short form with advanced fields revealed after the required title and organization fields are complete.

Selecting a task opens its detail panel on desktop; the panel has a Close control. Mobile retains its full task detail view. The detail view groups description, status and ownership, comments, and activity history in that order.

The MVP uses a list-first task experience; a Kanban board is deferred until list usage shows a real need.

### Announcements

Announcements opens with published messages ordered newest first and a clear New announcement action for authorized users.

The compose form places title, audience, and body in that order, with publication status visible before saving.

Drafts are visually distinct from published messages and are never shown to unauthorized members.

### Finance

Finance opens with the selected organization and month visible, then shows a hero Remaining tile with a progress track, smaller Actual and Estimate tiles, the category comparison, monthly spending trend, and register.

Budget and expense lists show PHP amounts, dates, categories, and the member who recorded or changed the entry. All active members can use the same finance actions.

Budget comparisons use a compact bullet or bar chart and monthly spending uses a trend line; both always show numeric values and have a corresponding table. Filters are labeled and work by keyboard, touch, and screen reader.

Spreadsheet upload and export are web workflows. Android identifies this clearly while keeping budget and expense workflows available in the app.

## Component rules

### Web shell

The desktop navigation rail is a white surface with a 0 36px 36px 0 radius and a soft shadow.

It holds a text wordmark with a small decorative aqua blob mark, the labeled organization select, the five destinations, and an account block on a tinted inset.

The selected destination uses the lime blob marker, weight 800, and retains `aria-current="page"`.

The main area has one large aqua blob behind the top-right of the header and one small lime blob beside it.

Background blobs are decorative and hidden from assistive technology, sit behind content, and never sit behind a table or form.

Below 768px the rail becomes a top bar with a Menu button and the organization select.

### Buttons, inputs, and chips

Buttons are pills at least 44px tall on web and 48px tall on Android.

Primary buttons are teal with white text and the primary shadow; secondary buttons are white with a 2px teal border and teal text.

Disabled buttons use the neutral fill, have no shadow, and keep a visible explanation next to them.

Inputs keep a persistent visible label above them, a 1.5px control border, and the control radius.

A field with an error gets a 2px danger border and an error line that starts with "Error:".

Chips are borderless pills using a status background and its matching status text color, and always contain a text label.

The focus ring is a 3px info-colored outline with a 2px offset on every interactive element.

### Summary tiles

Each page with summary numbers opens with a tile row.

The first tile is the hero: white, blob-hero radius, clay shadow, largest number, and one primary action where useful.

Remaining tiles are clay tiles filled with aqua-tint, mint-tint, or lime-tint.

A tile whose number is a problem count shows that number in the danger color and names the problem in words.

### Lists and tables

List rows sit inside one white panel, with a bold linked title, one muted line of secondary fields, and status chips aligned right or in their own column.

Rows use one divider line with no vertical lines or zebra striping; a selected row uses an aqua-tint background and retains `aria-current`.

At phone width, each list record becomes its own small panel with chips first, then title, then the muted line.

Finance tables, the import preview, and the owner combined overview retain semantic table markup with header cells.

Tables sit in white panels, use divider-only row lines, right-align money, and scroll horizontally inside their panel when narrow; the page itself never scrolls horizontally.

### Charts

The budget comparison is a row-level progress track inside the category table, so the table provides its text equivalent.

Tracks are 16px tall with a control border and teal fill.

An over-budget track is fully filled with a red diagonal hatch and also shows the percentage, over amount, and an "Over budget" chip in text.

The monthly trend is a smooth teal line over an aqua-tint area with a value label on every point and a table beside it.

The in-progress month uses a dotted segment and an open point, explained in the caption.

### Scope distinction

The owner combined view uses the combined page background, blobs, and tile tints.

It shows a "Combined view" chip above the title and names the organization on every task and announcement row.

Scope remains identifiable from the title and organization control without relying on tint.

### Android

Keep the existing four bottom destinations: Overview, Members, Tasks, and Announcements; Finance stays reachable from a labeled filled card on Overview.

The bottom bar is a white surface with rounded top corners; the selected destination has the lime blob marker behind its icon and a weight 800 label.

The app bar is transparent over the page background and shows the "Organization" caption and organization name as the switcher.

Forms sit on a white sheet with 32px top corners.

The floating "Record expense" action uses the lime blob-marker shape with on-lime text.

Offline state uses a warning-colored banner with an icon, saved time, and Retry; it switches the page background to the offline color and removes decorative blobs.

All Android targets remain at least 48 logical pixels, and layouts remain usable at 200 percent text scaling.

## Feedback and state rules

Every screen defines loading, empty, error, permission-denied, offline, and recovery states.

Loading states preserve the final layout shape where practical so content does not jump when it arrives.

Empty states explain what is absent and provide one relevant next action, such as Invite a member or Create a task.

Errors appear near the failed control and include a retry or recovery action.

Form errors appear inline and in a focusable summary at the top after a failed submit.

Destructive actions use a confirmation step with a specific consequence rather than a generic confirmation message.

Successful saves provide immediate, non-blocking confirmation and update the visible record in place.

Offline views identify cached data and its age, and disabled mutations explain that reconnecting is required.

## Accessibility and usability requirements

The web interface targets WCAG 2.2 AA outcomes for contrast, keyboard access, focus visibility, labels, and error recovery.

Interactive controls must have accessible names, native semantics where available, and a visible focus ring.

The visible focus target must not be hidden behind sticky navigation, sheets, banners, or dialogs.

All form fields have persistent visible labels, useful helper text where needed, and errors connected to the affected field.

The Android app uses Flutter semantics, supports TalkBack, respects large text settings, and keeps touch targets at least 48 logical pixels.

Screen reader order follows the visual reading order, and headings are sequential and descriptive.

## UI requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| UI-REQ-001 | Make scope and location clear. | A user can identify the current organization and destination from every primary screen without opening a menu. |
| UI-REQ-002 | Keep primary actions discoverable. | Authorized users can find the main action for Members, Tasks, and Announcements within the first viewport or first scroll. |
| UI-REQ-003 | Keep lists scannable. | A user can identify the key fields and status of a member, task, or announcement without opening every record. |
| UI-REQ-004 | Make state changes understandable. | Loading, empty, error, denied, offline, and success states explain what happened and what the user can do next. |
| UI-REQ-005 | Make forms recoverable. | A failed form submission moves focus to a summary, links to invalid fields, and retains valid user input. |
| UI-REQ-006 | Keep responsive behavior consistent. | The primary flows work at 375px, 768px, 1024px, and 1440px without horizontal scrolling or hidden primary actions. |
| UI-REQ-007 | Support accessible interaction. | Web primary flows work with keyboard and visible focus, and Android primary flows expose labels and states to TalkBack. |
| UI-REQ-008 | Keep offline behavior honest. | Cached reads show their age, and offline mutations are visibly disabled or rejected without claiming success. |
| UI-REQ-009 | Avoid unnecessary complexity. | The first release uses list-first task management, count-based dashboard summaries, and one consistent navigation model across clients. |
| UI-REQ-010 | Keep finance data legible. | Budget reports display PHP values, comparison period, labels, and a table equivalent; chart color is never the only carrier of meaning. |
| UI-REQ-011 | Make finance changes transparent. | Finance records identify the member and time of the last change, and users can inspect the allowlisted change history. |
| UI-REQ-012 | Keep spreadsheet exchange recoverable. | Web imports preview row outcomes before commit, retain user input after validation errors, and exports identify their organization, period, filters, and generation time. |

## Open questions and approval

Use the product name as a text wordmark with a small decorative blob mark and the specified light palette; custom logos and dark mode are outside the initial execution scope.

Use the platform matrix in [CONSTRAINTS.md](CONSTRAINTS.md) and the icon defaults above.

The retained System Design DOCX could not be rendered because the required bundled LibreOffice executable is unavailable in this environment, so no template-based DOCX is being presented as verified.

Revision 4 was approved by Len in chat on 2026-10-04T16:19:21+08:00: "Approve PROD-005 revision 4 and PLAN-003 revision 1".

Revision 3 is preserved at [UI_UX_DESIGN_REVISION_3.md](../archive/UI_UX_DESIGN_REVISION_3.md).
