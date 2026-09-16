# Product overview: AqOne and Dev Guild Manager

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:37:27+08:00
Revision: 2
Status: Draft

## Purpose and users

The product gives Len one place to manage AqOne and the dev guild.

The primary users are Len as owner, organization leads, and organization members.

The product should replace scattered member lists, task lists, and announcements with a shared source of truth.

Success means a lead can see the state of an organization, update its members, assign work, and publish an announcement from either the responsive web dashboard or the Flutter Android app.

Members may belong to both organizations.

## Planned capabilities and main flows

The first release includes account access, organization switching, a combined owner overview, organization dashboards, member management, task management, announcements, activity history, and basic search and filtering.

The main flow is sign in, choose an organization or the combined owner overview, inspect the dashboard, then open members, tasks, or announcements to manage the selected area.

An owner or lead can invite a member, assign a task, update task progress, and publish an announcement targeted to one organization or both.

The Flutter app provides the same core management actions as the web dashboard and supports cached read access when offline.

The shared UI direction is documented in [UI_UX_DESIGN.md](UI_UX_DESIGN.md).

## Scope and non-goals

The initial scope covers AqOne and the dev guild through one shared product.

The data model supports more organizations without hardcoding the two current names.

The initial release excludes chat, file storage, attendance, voting, recurring tasks, task subtasks, advanced analytics, calendar synchronization, and automated notification campaigns.

The initial mobile target is Android.

iOS support, richer offline editing, and external integrations are deferred until real usage justifies them.

## Open questions and approval

The proposed MVP boundary and operating model were approved in Len's chat message on 2026-09-16: "I approve all of your proposals do not write any code yet lets focus on writing the specs first".

Exact approval of this document revision and the linked architecture and feature revisions remains pending.
