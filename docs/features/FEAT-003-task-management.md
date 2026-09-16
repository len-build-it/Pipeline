# FEAT-003: Task management

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Purpose and success

Leads need a lightweight way to assign and track work across each organization.

Success means a user can understand what needs attention, who owns it, and whether work is blocked or complete.

## Scope and non-goals

This feature includes task creation, assignment, status, priority, due date, labels, comments, search, filters, and activity history.

It excludes recurring tasks, subtasks, dependency graphs, time tracking, external issue tracker synchronization, and rich text editing.

## User flows

An owner or lead creates a task for an organization, assigns an active member, sets priority and due date, and saves it.

A member views tasks they can access, updates an assigned task status, and adds a comment.

An authorized user filters by status, priority, assignee, label, or due state.

The task list supports empty, loading, error, permission-denied, and retry states.

The mobile app displays the latest cached task list offline and requires reconnection before saving changes.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | Create a task. | An authorized lead creates a task with title, organization, and creator, and the task appears in the selected organization. |
| REQ-002 | Assign and update work. | A lead can assign an active member, and the assignee can update status on their assigned task. |
| REQ-003 | Validate task data. | Missing titles, invalid dates, invalid enum values, inaccessible organizations, and inactive assignees are rejected without partial writes. |
| REQ-004 | Filter task views. | A permitted user can filter by status, priority, assignee, label, and overdue state. |
| REQ-005 | Discuss a task. | A permitted user can add a comment, and the comment author or authorized lead can edit or remove it according to policy. |
| REQ-006 | Record important changes. | Creation, assignment, status, priority, due date, and archival changes appear in the task activity history. |
| REQ-007 | Preserve organization isolation. | A task cannot be read or changed through a client route or API request outside the user's permitted organization scope. |
| REQ-008 | Handle search, archival, and concurrent edits. | Title search remains scoped, archived tasks are read-only under Archived, and a stale update produces a conflict without overwriting the other user's save. |

## Data and interfaces

Uses Task, Task comment, Membership, Organization, and Activity event from [DATA_MODEL.md](../product/DATA_MODEL.md).

Task list responses must be bounded or paginated and support server-side filters.

## Quality constraints

Uses [CONSTRAINTS.md](../product/CONSTRAINTS.md).

Task updates must be atomic so a failed assignment or validation cannot leave a partially updated task.

## Decisions and assumptions

The approved proposal includes title, description, organization, assignee, creator, status, priority, due date, labels, comments, and activity history.

The initial status set is Backlog, In progress, Blocked, and Done.

The initial priority set is Low, Medium, and High.

## Open questions and readiness

Use the proposed defaults, comment moderation, archival, date, and edit-conflict rules in [DATA_MODEL.md](../product/DATA_MODEL.md).

Exact approval of this revision is pending.
