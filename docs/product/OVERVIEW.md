# Product overview: Configurable Team Manager

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-10-03T22:31:00+08:00
Revision: 3
Status: Approved

## Purpose and users

The product gives Len one place to manage configured teams in a single deployment.

The primary users are Len as owner, organization leads, and organization members.

The product should replace scattered member lists, task lists, announcements, budgets, and expense records with a shared source of truth.

Success means a member can see the state of an accessible team, manage its work, review transparent budgets and expenses, and use the responsive web dashboard or Flutter Android app.

Members may belong to multiple configured teams.

## Planned capabilities and main flows

The product includes account access, team switching, an owner overview across accessible teams, team dashboards, member management, task management, announcements, activity history, basic search and filtering, budgeting, expense tracking, spreadsheet transfer, and spending analytics.

The main flow is sign in, choose an accessible team or the owner overview, inspect the dashboard, then open the area to manage.

Authorized users can invite members, assign tasks, publish announcements to permitted teams, and view team finance records.

The Flutter app provides the same core management actions as the web dashboard and supports cached read access when offline.

The shared UI direction is documented in [UI_UX_DESIGN.md](UI_UX_DESIGN.md).

## Scope and non-goals

Organization names and count are configured data, not application code assumptions. The current teams remain initial data in this deployment.

The product is for Len's teams and is not a customer-facing multi-tenant SaaS service. Organization creation and management UI are outside this proposed scope.

The initial release excludes chat, receipt/file storage, attendance, voting, recurring tasks, task subtasks, formal double-entry bookkeeping, tax calculation or filing, bank feeds, payment processing, exchange-rate conversion, direct accounting integrations, calendar synchronization, and automated notification campaigns.

The initial mobile target is Android.

iOS support, richer offline editing, and external integrations are deferred until real usage justifies them.

## Open questions and approval

The proposed MVP boundary and operating model were approved in Len's chat message on 2026-09-16: "I approve all of your proposals do not write any code yet lets focus on writing the specs first".

Revision 3 was approved by Len in chat on 2026-10-03T22:31:00+08:00: "Yes I approve of the revisions".
