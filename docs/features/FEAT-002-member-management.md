# FEAT-002: Member management

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Purpose and success

Leads need an accurate view of who belongs to each organization and enough control to keep access current.

Success means an authorized lead can find, invite, update, and deactivate members without changing another organization's membership.

## Scope and non-goals

This feature includes member lists, search, filters, invitations, role changes, status changes, profile editing, and organization-scoped activity history.

It excludes payroll, attendance, performance scoring, bulk import, and member chat.

## User flows

An owner or lead opens Members, searches or filters the list, and opens a member record.

An authorized Owner or Lead invites a person by email for a permitted organization and role under the shared role policy and receives pending or delivery-failed status.

An invited person accepts the link and becomes an active member.

An Owner changes roles, while an Owner or authorized Lead deactivates or reactivates Member memberships after confirmation under the shared role policy.

A member edits their own allowed profile fields.

Duplicate invitations, inactive memberships, and unauthorized organization access show clear errors and preserve the current data.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | List organization members. | The list shows active and pending members for the selected permitted organization with role and status. |
| REQ-002 | Search and filter members. | Searching by name or email and filtering by role or status returns only matching permitted records. |
| REQ-003 | Invite a member. | An authorized lead can create an expiring invitation for a normalized email and selected role. |
| REQ-004 | Prevent unsafe invitations. | The system rejects duplicate active memberships, duplicate pending invitations, invalid emails, and invitations to inaccessible organizations. |
| REQ-005 | Change membership state. | An owner or lead can change permitted roles or deactivate a membership, and the change appears in activity history. |
| REQ-006 | Protect self and owner access. | A member cannot grant roles, a lead cannot change memberships outside their organization, and the last owner access cannot be removed through this feature. |
| REQ-007 | Support profile editing and private notes. | A Member can edit their own name, initials-avatar color, skills, and interests, while membership notes appear only to Owner and authorized Leads. |
| REQ-008 | Deactivate safely. | Deactivation removes online access and clears the member's open-task assignments only within that organization, preserving completed work and history. |
| REQ-009 | Recover invitation delivery. | A simulated mail failure leaves one pending invitation with clear failure feedback; explicit retry replaces its token and cannot create a duplicate membership. |

## Data and interfaces

Uses User, Organization, Membership, Invitation, and Activity event from [DATA_MODEL.md](../product/DATA_MODEL.md).

Member list endpoints must be organization-scoped and bounded or paginated.

## Quality constraints

Uses [CONSTRAINTS.md](../product/CONSTRAINTS.md).

Invitation acceptance must be safe to retry after a lost response without creating a second membership.

## Decisions and assumptions

The approved proposal includes name, email, avatar, organization, role, status, join date, skills or interests, and notes as member information.

The proposed role and profile policy is specified in [DATA_MODEL.md](../product/DATA_MODEL.md), including membership-private notes and initials avatars without uploaded files.

## Open questions and readiness

Role names and notes visibility are resolved by the shared policy, pending approval of this revised package.

Exact approval of this revision is pending.
