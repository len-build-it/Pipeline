# FEAT-004: Announcements

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Purpose and success

Leads need one reliable place to publish important information to the right organization.

Success means an authorized lead can draft and publish an announcement targeted to AqOne, the dev guild, or both, and permitted members can view it.

## Scope and non-goals

This feature includes drafting, editing, publishing, listing, viewing, targeting, and activity history.

It excludes comments, reactions, scheduling, push notification campaigns, attachments, and read receipts.

## User flows

An owner or lead writes a title and body, selects one or both organizations, saves a draft, and publishes it.

An authorized lead can edit an unpublished draft or archive a published announcement according to policy.

Members see published announcements for their organizations in the dashboard and announcements list.

An announcement with no valid target or missing content is rejected with an actionable error.

Loading, empty, error, permission-denied, and retry states are required.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | Create a draft. | An authorized lead can save a title, body, author, and one or more permitted target organizations as a draft. |
| REQ-002 | Publish to selected organizations. | Publishing makes the announcement visible only to active members of its selected target organizations. |
| REQ-003 | Validate announcement content. | Empty content, missing targets, invalid targets, and unauthorized targets are rejected without publication. |
| REQ-004 | List and view announcements. | A permitted user can list published announcements for their organization and open the full content. |
| REQ-005 | Protect draft visibility. | Drafts are visible only to authorized owners and leads with access to every selected target organization. |
| REQ-006 | Record lifecycle changes. | Creation, edits, publication, and archival appear in activity history. |
| REQ-007 | Preserve publication and audience boundaries. | Publishing freezes body and targets, archiving removes the record from default feeds, and a Lead lacking authority for any target cannot change the record. |
| REQ-008 | Search and handle concurrent drafts. | Title search only returns visible announcements, and stale draft saves show a conflict without discarding the user's unsaved text. |

## Data and interfaces

Uses Announcement, Organization, Membership, User, and Activity event from [DATA_MODEL.md](../product/DATA_MODEL.md).

Announcement list responses must be bounded or paginated and ordered by publication time descending.

## Quality constraints

Uses [CONSTRAINTS.md](../product/CONSTRAINTS.md).

Published content must be escaped or safely rendered so announcement text cannot execute client-side code.

## Decisions and assumptions

The approved proposal allows targeting one organization or both.

The initial release uses immediate publication rather than scheduling.

## Open questions and readiness

Use the publication, archive, field-length, and edit-conflict defaults in [DATA_MODEL.md](../product/DATA_MODEL.md).

Exact approval of this revision is pending.
