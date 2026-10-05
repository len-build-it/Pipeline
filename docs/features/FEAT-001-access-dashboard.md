# FEAT-001: Account access and organization dashboard

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-10-05T08:23:40+08:00
Revision: 4
Status: Approved

## Purpose and success

Users need a safe entry point that shows the current state of the organizations they can manage.

Success means a returning user can sign in through a dedicated Android entry page, an invited user can create an account from that page, and either user reaches the correct accessible view without seeing another organization's data.

## Scope and non-goals

This feature includes the dedicated Android sign-in page, secure session restoration, invitation-based account creation, explicit demo access, sign out, session expiry handling, organization selection, owner combined overview, and organization dashboard summaries.

It excludes public self-registration, password reset, social login, multi-factor authentication, passwordless login, real-time updates, and advanced analytics.

## User flows

An invited user opens an invitation link and either creates an account or signs in to the existing account with the matching email before entering the relevant organization.

A new installation checks for a restorable authenticated session before showing protected pages. If no valid session exists, the user sees the dedicated sign-in page.

A returning user signs in and sees the combined owner overview or their last accessible organization.

An invitee chooses Create account from the sign-in page, enters the invitation code and matching email, completes the account fields, and enters the invited organization after successful acceptance.

A visitor can choose Try demo to open clearly labeled synthetic data. Demo changes remain temporary and local to the demo session, and leaving demo resets that sample state.

A user who signs out returns to the sign-in page. Protected cached data remains governed by FEAT-005 and is not shown after a known revoked or expired session.

An owner can switch between the combined overview and any configured organization they can access.

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
| REQ-005 | Switch organization scope. | An owner can select the combined overview or any configured organization they can access, while a lead or member sees only organizations where they have active membership. |
| REQ-006 | Recover from session and network failures. | Expired sessions and failed loads show an actionable message and retry or sign-in path without silently displaying stale protected data. |
| REQ-007 | Enforce account and invitation lifecycle. | Existing-account acceptance requires matching sign-in, expired or consumed tokens cannot grant access, and sign-out revokes the server session. |
| REQ-008 | Produce consistent summaries. | Shared metric definitions yield identical scoped totals on web and Android, including deduplication in the Owner overview. |
| REQ-009 | Provide a dedicated signed-out entry on Android. | A fresh installation or signed-out session shows a labeled sign-in page before any protected records; email and password fields support platform autofill and password paste, the password has a visibility control, submit shows loading feedback, validation and server errors are announced with a recovery path, and development credentials are not prefilled. |
| REQ-010 | Restore valid sessions safely. | On launch, a stored session is revalidated and opens the user's permitted last scope or a safe default; known revocation or expiry clears protected state and shows sign-in. If the network is unavailable, only the same locally verified account's unexpired cached reads may appear, bounded by FEAT-005's session and cache limits and clearly marked stale. |
| REQ-011 | Make invited account creation discoverable. | Create account opens invitation-based account setup, accepts only a valid unexpired invitation matching the submitted email, requires an existing account to sign in before accepting membership, and reports invalid, expired, used, or mismatched invitations without granting access. Public self-registration remains unavailable. |
| REQ-012 | Separate demo use from live accounts. | Try demo opens visibly labeled synthetic records through a repository isolated from the live API; demo mutations never reach the server or protected cache, and leaving demo resets its temporary changes. |
| REQ-013 | Keep exit and recovery predictable. | Sign out returns to sign-in after revoking the session and clearing protected data; users can cancel invitation setup and return to sign-in without losing the intended live account state. |

## Data and interfaces

Uses the shared User, Organization, Membership, Invitation, Task, and Announcement definitions in [DATA_MODEL.md](../product/DATA_MODEL.md).

Dashboard responses must be scoped by the authenticated user's permissions and must not require clients to filter unauthorized records.

The sign-in and invitation screens use the existing authentication endpoints and secure token storage. This revision adds no public registration endpoint or account database fields.

## Quality constraints

Uses the shared security, accessibility, performance, and evidence requirements in [CONSTRAINTS.md](../product/CONSTRAINTS.md).

The combined overview should avoid separate client requests for every metric when one bounded summary response can provide the same result.

## Decisions and assumptions

The approved proposal is email-based invitations, online-first operation, and Android-first native support.

The combined overview is a proposed owner-only convenience view built from the approved organization dashboard concept.

This draft interprets sign up as account creation through an existing invitation. Public self-registration remains excluded under the approved [CONSTRAINTS.md](../product/CONSTRAINTS.md) revision 4.

This draft proposes a temporary in-memory demo session using the existing synthetic data repository. Demo access never authenticates a real account or calls live mutation endpoints, and demo-only persona and reset controls stay inside the labeled demo session.

## Open questions and readiness

Use the session policy in [ARCHITECTURE.md](../product/ARCHITECTURE.md), invitation and summary policies in [DATA_MODEL.md](../product/DATA_MODEL.md), and owner provisioning and recovery in [CONSTRAINTS.md](../product/CONSTRAINTS.md).

Revision 3 was approved by Len in chat on 2026-10-03T22:31:00+08:00: "Yes I approve of the revisions". Len approved the current revision 4 and PLAN-005 revision 1 in chat with: "Execute the implementation plan $clean-code".
Approval recorded: 2026-10-05T08:34:42+08:00
