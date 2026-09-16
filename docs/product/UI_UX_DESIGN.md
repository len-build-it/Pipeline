# UI UX system design: AqOne and Dev Guild Manager

Created: 2026-09-16T21:37:27+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Purpose and design stance

This document defines the shared UI and UX direction for the web dashboard and Flutter Android app.

The product is an internal management tool for a small organization, so the interface should prioritize orientation, fast scanning, and safe actions over visual novelty.

The primary design promise is that a lead can answer three questions quickly: what needs attention, who owns it, and what action is available next.

The interface uses progressive disclosure, plain-language labels, consistent placement, and visible feedback after every mutation.

## Observed facts and assumptions

The product has two clients, a responsive web dashboard and a Flutter Android app, backed by one shared API.

The first release manages members, tasks, announcements, and dashboard summaries for AqOne and the dev guild.

The users are a small team with one owner, organization leads, and members.

No existing brand kit, logo, color palette, or design system was provided.

The UI/UX guidance search returned a relevant minimal Swiss style but returned marketing-oriented page patterns, so no marketing pattern is adopted.

The visual recommendations below are therefore proposed product defaults and must not be treated as existing brand facts.

## Information architecture and navigation

The product has four primary destinations: Overview, Members, Tasks, and Announcements.

The current organization scope is always visible near the top of the interface.

Owners can choose All organizations, AqOne, or Dev guild.

Leads and members can choose only organizations where they have active membership.

### Web navigation

The desktop layout uses a persistent left navigation rail with the product name, organization switcher, four destinations, and account controls.

The main content area has one page title, an optional short description, a primary action, and the content needed for the selected task.

The navigation rail collapses at tablet width but must not hide the current destination or organization scope.

Keyboard users receive a skip-to-content link, logical tab order, and visible focus indicators.

### Android navigation

The Android layout uses a top app bar with the current organization scope and a bottom navigation bar with no more than four primary destinations.

Secondary actions appear in the page body or an explicitly labeled overflow menu.

Android back navigation returns to the previous screen or closes the current modal before leaving the app.

The selected destination, current organization, and offline state remain visible without relying on color alone.

## Responsive layout

The design is mobile-first and must remain usable at 375px, 768px, 1024px, and 1440px widths.

At phone width, tables become stacked records with the most important fields first and filters move into a labeled sheet.

At tablet width, content uses a single column with two-column cards only when each card remains readable.

At desktop width, dashboard cards and detail panels may use a two- or three-column grid within a readable maximum content width.

No screen may require horizontal scrolling for its primary flow.

Dialogs on desktop become full-screen or bottom sheets on mobile when the form would otherwise be cramped.

## Visual system

The proposed visual direction is calm, high-contrast, grid-based, and content-first.

The MVP uses a system sans-serif font stack so the interface remains fast, native-feeling, and dependency-light.

The MVP launches in light mode; dark mode is deferred until the light theme and contrast checks are stable.

| Token | Proposed value | Use |
| --- | --- | --- |
| color.background | #F8FAFC | Page background. |
| color.surface | #FFFFFF | Cards, tables, forms, and sheets. |
| color.text | #0F172A | Primary text. |
| color.textMuted | #475569 | Supporting text. |
| color.border | #CBD5E1 | Dividers and control boundaries. |
| color.primary | #0F766E | Primary actions and current navigation. |
| color.primaryText | #FFFFFF | Text on primary actions. |
| color.accent | #D97706 | Attention and secondary emphasis. |
| color.success | #15803D | Completed or healthy states. |
| color.warning | #B45309 | Due soon, pending, or stale states. |
| color.danger | #B91C1C | Destructive or blocked states. |
| color.info | #1D4ED8 | Informational states. |

Color is always paired with a text label, icon, or position so status is not communicated by color alone.

The spacing scale uses 8px increments, with 16px as the default control gap and 24px as the default section gap.

Body text starts at 16px with approximately 1.5 line height, and headings use a clear size and weight hierarchy rather than all-caps labels.

Use built-in Material icons in Flutter and text labels on the web, with matching action names; additional icon dependencies are unnecessary for the MVP.

Motion is subtle, limited to feedback and spatial continuity, and disabled or reduced when the user requests reduced motion.

## Core screens and interaction rules

### Overview

The page begins with the selected organization scope and four summary metrics: active members, open tasks, overdue tasks, and recent announcements.

The next section shows the most actionable tasks, followed by recent announcements.

Quick actions are limited to Add member, New task, and New announcement, and are shown only when the user has permission.

The dashboard does not show decorative charts in the MVP; counts and short lists are sufficient for the small-team use case.

### Members

Members opens with search, a small set of filters, and an obvious Invite member action for authorized users.

Each record shows name, role, status, organization, and a secondary detail action.

Desktop may use a detail panel, while mobile uses a full member detail screen.

Role and deactivation changes require confirmation and explain the consequence before the final action.

### Tasks

Tasks defaults to a scannable list with status, priority, assignee, due date, and organization visible without opening every record.

Filters are status, priority, assignee, label, and overdue state.

Task creation uses a short form with advanced fields revealed after the required title and organization fields are complete.

The task detail view groups description, status and ownership, comments, and activity history in that order.

The MVP uses a list-first task experience; a Kanban board is deferred until list usage shows a real need.

### Announcements

Announcements opens with published messages ordered newest first and a clear New announcement action for authorized users.

The compose form places title, audience, and body in that order, with publication status visible before saving.

Drafts are visually distinct from published messages and are never shown to unauthorized members.

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

## Open questions and approval

Use the product name as a text wordmark and the specified light palette; custom logos and dark mode are outside the initial execution scope.

Use the platform matrix in [CONSTRAINTS.md](CONSTRAINTS.md) and the icon defaults above.

The retained System Design DOCX could not be rendered because the required bundled LibreOffice executable is unavailable in this environment, so no template-based DOCX is being presented as verified.

Exact approval of this revision is pending.
