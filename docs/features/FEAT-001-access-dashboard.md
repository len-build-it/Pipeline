# FEAT-001: Account access and organization dashboard

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Purpose and success

Users need a safe entry point that shows the current state of the organizations they can manage.

Success means an invited user can activate an account, sign in, select an accessible organization, and reach a useful dashboard without seeing another organization's data.

## Scope and non-goals

This feature includes invite acceptance, sign in, sign out, session expiry handling, organization selection, owner combined overview, and organization dashboard summaries.

It excludes social login, multi-factor authentication, passwordless login, real-time updates, and advanced analytics.

## User flows

An invited user opens an invitation link and either creates an account or signs in to the existing account with the matching email before entering the relevant organization.

A returning user signs in and sees the combined owner overview or their last accessible organization.

An owner can switch between a combined overview and either organization.

A lead or member can switch only among organizations where they have an active membership.

Expired, used, invalid, or mismatched invitations show a recovery message and do not create access.

Unauthenticated users are sent to sign in, and expired sessions require sign in again without losing the intended destination where safe.

Loading, empty, permission-denied, network-error, and retry states are required on both clients.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | Accept a valid invitation. | A valid single-use invitation creates the intended membership and cannot be reused. |
| REQ-002 | Authenticate an active user. | Correct credentials open the user's accessible landing view, while incorrect credentials return a generic error. |
| REQ-003 | Enforce organization isolation. | A user without an active membership or explicit global Owner permission cannot access that organization's data, even with a direct URL or API identifier. |
| REQ-004 | Show dashboard summaries. | The selected view shows member count, open task count, overdue task count, and recent announcements for the permitted scope. |
| REQ-005 | Switch organization scope. | An owner can select combined, AqOne, or dev guild scope, while a lead or member sees only permitted organizations. |
| REQ-006 | Recover from session and network failures. | Expired sessions and failed loads show an actionable message and retry or sign-in path without silently displaying stale protected data. |
| REQ-007 | Enforce account and invitation lifecycle. | Existing-account acceptance requires matching sign-in, expired or consumed tokens cannot grant access, and sign-out revokes the server session. |
| REQ-008 | Produce consistent summaries. | Shared metric definitions yield identical scoped totals on web and Android, including deduplication in the Owner overview. |

## Data and interfaces

Uses the shared User, Organization, Membership, Invitation, Task, and Announcement definitions in [DATA_MODEL.md](../product/DATA_MODEL.md).

Dashboard responses must be scoped by the authenticated user's permissions and must not require clients to filter unauthorized records.

## Quality constraints

Uses the shared security, accessibility, performance, and evidence requirements in [CONSTRAINTS.md](../product/CONSTRAINTS.md).

The combined overview should avoid separate client requests for every metric when one bounded summary response can provide the same result.

## Decisions and assumptions

The approved proposal is email-based invitations, online-first operation, and Android-first native support.

The combined overview is a proposed owner-only convenience view built from the approved organization dashboard concept.

## Open questions and readiness

Use the session policy in [ARCHITECTURE.md](../product/ARCHITECTURE.md), invitation and summary policies in [DATA_MODEL.md](../product/DATA_MODEL.md), and owner provisioning and recovery in [CONSTRAINTS.md](../product/CONSTRAINTS.md).

Exact approval of this revision is pending.
