# UI/UX design handoff brief: Team Manager

Created: 2026-10-04T14:59:14+08:00
Updated: 2026-10-04T14:59:14+08:00
Revision: 1
Status: Informational design brief derived from approved product specifications. It does not authorize changes to product behavior or scope.

## Brief for the designer

Design a calm, dependable team-management app that helps small teams see what needs attention, who owns it, and what action to take next. The product is called **Team Manager** in the repository. It has a responsive web dashboard and an Android app, both using the same accounts, organization access, and records.

The approved product specifications listed at the end of this brief remain the source of truth for behavior. This brief summarizes those decisions for design work. Do not add product capabilities or change role permissions, workflows, or data rules as part of a visual redesign.

## What the app does

Team Manager replaces separate member lists, task trackers, team announcements, budgets, and expense records with one shared place to manage configured teams. A user signs in, chooses an organization they can access, and works from its dashboard. The owner can also use a combined overview across accessible organizations. A person may belong to more than one organization.

The app has five main areas:

- **Overview:** Shows the current organization or owner-wide scope, active member count, open task count, overdue task count, recent announcements, and the most actionable work. Permission-appropriate quick actions are Add member, New task, and New announcement.
- **Members:** Shows the roster, role, membership status, search and filters, profiles, and invitation or membership controls for authorized users.
- **Tasks:** A list-first workspace for creating and assigning tasks, setting priority and due dates, tracking Backlog, In progress, Blocked, and Done status, adding comments, and reviewing activity.
- **Announcements:** A place for authorized owners and leads to draft and publish messages to permitted organization audiences. Members see published messages for their organizations.
- **Finance:** Shared monthly budgets, actual expenses, category comparisons, remaining or over-budget amounts, monthly trends, and a current-month run-rate estimate. Every active organization member has the same finance permissions. Web also supports spreadsheet import and XLSX export.

Finance is a transparent internal spending tool; formal accounting ledger capabilities are outside its scope. It uses PHP and centavos, tracks actual expenses rather than commitments or unpaid bills, and records who changed financial entries. Voided expenses remain in the register and are excluded from totals.

## Who uses it and what they need

| User | Main needs | Design implications |
| --- | --- | --- |
| Owner | See activity across accessible teams, switch into one team, and manage access and work. | Make combined versus organization scope unmistakable. Keep cross-team summaries distinct from team-level records. |
| Organization lead | Keep the roster current, assign and follow up work, and publish the right updates. | Make operational actions easy to find, show ownership and status in lists, and explain consequential membership actions before confirmation. |
| Organization member | Know what is happening, find their work and updates, contribute to tasks, and see team spending. | Make read and assigned-task work clear without exposing lead-only controls or another organization's information. Keep finance equally usable for every active member. |

People may use the web dashboard for broader management and spreadsheet work, or the Android app while away from a desk. Connectivity can be intermittent. Users should be able to scan rather than remember details from one screen to another.

## Core user outcomes

1. I can tell which organization and area I am looking at before I act.
2. I can quickly see what is overdue, blocked, newly announced, or over budget.
3. I can find who owns a task or who changed a financial record.
4. I can complete an allowed action without guessing what will happen.
5. If a save or load fails, I understand why and can recover without losing what I entered.
6. If I am offline, I can distinguish cached information from current information and know which actions need a connection.

## Design priorities, in order

1. **Orientation and access clarity.** Keep the current organization and destination visible. Make the owner-wide overview visibly different from one organization's workspace. Only show organizations and actions the signed-in user is allowed to access.
2. **Attention and next action.** Put useful work ahead of decoration. Surface overdue or blocked tasks, relevant announcements, and finance variance with a direct path to the related record.
3. **Fast scanning.** Use clear headings, compact summaries, consistent status labels, and readable lists. Users should identify the important fields without opening every item.
4. **Safe, recoverable actions.** Use plain labels, visible save feedback, inline field errors plus a focusable error summary, and consequence-specific confirmation for destructive actions. Preserve input when a safe retry or conflict occurs.
5. **Trustworthy financial information.** Show the organization, month, currency, comparison period, numeric values, and last-change attribution. Charts must include an equivalent table and must not rely on color alone.
6. **Responsive and accessible use.** Keep the main flows usable at 375, 768, 1024, and 1440 CSS pixel widths, by keyboard, touch, and screen reader. Android must support TalkBack, large text, and at least 48 logical-pixel touch targets.
7. **Consistency without overbuilding.** Reuse navigation and interaction patterns across areas and clients where they fit. Keep task management list-first; a Kanban board, decorative dashboard charts, and extra workflow layers are outside the approved MVP.

## Platform and navigation expectations

### Web

- Use a persistent left navigation rail at desktop sizes with the product name, organization switcher, Overview, Members, Tasks, Announcements, Finance, and account controls.
- At tablet sizes, the rail may collapse, but the current destination and organization scope remain clear.
- Each page should have one clear title, a short explanation only where it helps, a discoverable primary action, and the content needed for that task.
- At phone widths, convert dense tables into stacked records and move filters into a labeled sheet. Avoid horizontal scrolling for primary work.
- Keep spreadsheet import and export on web, where selecting, previewing, and downloading files make sense.

### Android

- Use an Android-native Flutter experience with the organization scope and offline state visible in the app shell.
- Keep the bottom navigation to no more than four primary destinations. Finance remains clearly discoverable from Overview or a labeled secondary/account destination.
- Use platform-appropriate back behavior and forms that remain usable with the keyboard and large text.
- Finance requires a connection. The app does not cache finance data or queue offline edits. Clearly direct users to web for spreadsheet exchange.

## Visual and interaction baseline

The approved starting direction is calm, high-contrast, grid-based, and content-first, using a light theme and a system sans-serif stack. Use the palette, spacing, typography, and icon guidance in the approved UI/UX specification as the baseline. No existing custom logo or brand kit is documented. Avoid inventing brand claims or visual decoration that competes with operational information.

Every important screen needs loading, empty, error, permission-denied, offline, success, and recovery states where applicable. Keep layout stable while loading. Empty states should offer one relevant next action. Place errors near the affected control, and keep visible keyboard focus and persistent form labels.

## Scope boundaries and caveats

- Organization names and count are configured data. Do not design fixed AqOne/Dev Guild navigation or assume there will always be exactly two teams.
- Roles are Global Owner, organization Lead, and organization Member. Finance is the exception to role-specific write access: all active members have equal finance permissions.
- Do not introduce chat, attendance, voting, recurring tasks, task subtasks, read receipts, scheduled announcements, receipt attachments, tax features, bank feeds, payment processing, accounting integrations, or organization creation and administration.
- Dark mode, iOS support, offline editing, push notifications, and richer device integrations are outside the approved initial scope.
- **Current implementation gap:** Android member, task, and announcement write calls are not served by the backend routes at present. Treat this as a known engineering gap rather than a deliberate product constraint or a completed flow. Confirm implementation status before presenting those actions as working in a shipped app.
- **Release context:** The local software MVP is verified, while production hosting, real email delivery, physical-device validation, and store release remain pending. Do not describe the product as production-deployed.

## Suggested design handoff outputs

For design exploration, prioritize the shared navigation shell and these screens: Overview, Members list and member detail/invitation, Tasks list and task detail/create, Announcements list and compose, and Finance report/register/expense entry. Show the differences needed for web and Android rather than assuming one layout fits both.

Include key responsive states and interaction states for representative flows, especially changing organization scope, inviting a member, creating or updating a task, publishing an announcement, recording an expense, importing a spreadsheet on web, and recovering from an error or offline state. Explain design decisions against the priorities above. Keep proposed visual changes separate from any suggested product-behavior changes so Len can review scope changes explicitly.

## Source of truth

This brief is a design aid, not a replacement specification. Read the approved documents for exact rules and acceptance criteria:

- [Product overview](OVERVIEW.md)
- [Architecture](ARCHITECTURE.md)
- [Data model and role policy](DATA_MODEL.md)
- [Shared constraints](CONSTRAINTS.md)
- [Approved UI/UX design specification](UI_UX_DESIGN.md)
- [Account access and dashboard](../features/FEAT-001-access-dashboard.md)
- [Member management](../features/FEAT-002-member-management.md)
- [Task management](../features/FEAT-003-task-management.md)
- [Announcements](../features/FEAT-004-announcements.md)
- [Android and offline reads](../features/FEAT-005-mobile-offline.md)
- [Configurable finance](../features/FEAT-006-configurable-finance.md)
- [Current implementation and known limitations](../../README.md)
