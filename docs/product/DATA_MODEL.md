# Shared data model: AqOne and Dev Guild Manager

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Entities and ownership

| Entity | Required fields | Ownership and lifecycle |
| --- | --- | --- |
| User | id, email, display name, avatar, status, created at | Global account; deactivation preserves history. |
| Organization | id, name, status, created at | Top-level group; seeded with AqOne and the dev guild. |
| Membership | user id, organization id, role, status, joined at | Connects users to organizations; unique per user and organization. |
| Invitation | id, email, organization id, role, token digest, expires at, status | Single-use pending record that becomes a membership when accepted. |
| Task | id, organization id, title, description, creator, assignee, status, priority, due date, labels, timestamps | Organization-owned work item; completion preserves history. |
| Task comment | id, task id, author, body, created at | Task-owned discussion entry; editable only by its author or an authorized lead. |
| Announcement | id, author, title, body, publication status, target organizations, published at, timestamps | Draft or published message; publication preserves the displayed content. |
| Activity event | id, organization id, actor, entity type, entity id, action, metadata, created at | Append-only management history for important changes. |

User accounts are not organization-owned, while memberships are the source of truth for organization access.

The owner role is represented by a global owner permission in the account or deployment seed configuration.

Organization leads and members are represented by membership roles.

Tasks have statuses Backlog, In progress, Blocked, and Done.

Tasks have priorities Low, Medium, and High.

Announcements have Draft and Published states.

## Interfaces and validation

Every write must validate authentication, required fields, field lengths, enum values, referenced identifiers, and organization access at the API boundary.

Email addresses must be normalized before uniqueness checks.

An active membership is required for organization access except for the global owner, whose explicit permission allows access across organizations.

Only the owner can manage all organizations.

Only an organization lead or owner can invite members, change membership roles, deactivate memberships, create announcements, publish announcements, and manage organization tasks.

Members can view their organizations, view tasks and announcements, update their assigned tasks, and add comments to tasks they can view.

Users cannot grant themselves a role or access an organization by changing client-supplied identifiers.

Invalid or unauthorized requests return a stable error shape without exposing whether inaccessible records exist.

Deletes should be represented by deactivation or archival where history would otherwise be lost.

## Storage and recovery

PostgreSQL is the system of record.

The mobile app may cache the latest successfully loaded read data locally for display, but the server remains authoritative.

Offline writes are not part of the initial release.

The deployment must provide automated backups and a documented restore check before production use.

Schema changes must be forward-migratable and preserve existing activity history.

Secrets and invite tokens must never be stored in source control or specification files.

## Proposed policy defaults for execution

These policies resolve earlier open questions and require approval as part of this revision.

| Area | Required behavior |
| --- | --- |
| Roles | Global Owner, organization Lead, and organization Member are the only roles. |
| Invitations and roles | Owner can invite or assign Leads and Members; Leads can invite Members and deactivate or reactivate Members in their organization, but cannot promote users or edit another Lead's role. |
| Profile | Users edit their own display name, skills, interests, and initials-avatar color from a predefined accessible palette; email changes and image upload are excluded. |
| Organization notes | Notes belong to a membership and are visible and editable only to Owner and that organization's Leads; member-facing responses omit them. |
| Membership removal | Deactivation immediately removes that organization's online access and clears assignment on its open tasks, atomically recording the changes; completed tasks and historical authors remain intact. |
| Owner safety | Membership screens cannot remove or demote the global owner; ownership transfer is outside this release. |
| Task editing | Owner and authorized Leads edit task fields and archive tasks; an active assigned Member can change only status, while any active organization member can comment. |
| Comment policy | Authors can edit or remove their comments while membership is active; Owner and authorized Leads can remove inappropriate comments but cannot rewrite another author's words. |
| Announcement lifecycle | Owner or a Lead authorized for every target organization can manage a draft, publish it, or archive it; published text and targets are immutable. |
| Archived content | Tasks and announcements disappear from default lists but remain readable to authorized users through an Archived filter; archived records are read-only and cannot be restored in the MVP. |
| Retention | No automatic deletion of memberships, archived records, or activity history in the MVP; permanent erasure policy is a production release decision. |
| Search | Members support name or email search; tasks and announcements support case-insensitive title search within permitted scope. |
| Dates | Store event timestamps in UTC; show dates in Asia/Manila and interpret date-only task deadlines as the end of that day in Asia/Manila. |
| Task defaults | New tasks start in Backlog with Medium priority; assignee, description, due date, and labels are optional. |
| Metrics | Open means non-archived and not Done; overdue means open with a due date before today's Manila date; recent announcements means published and not archived within seven Manila calendar days including today. |
| Combined overview | Count distinct active users across both organizations, distinct tasks, and distinct announcements; single-organization counts are scoped to that organization. |
| Pagination | Return 25 records by default, at most 100, with deterministic ordering and an explicit next-page indicator. |

An invitation expires after 72 hours and is bound to its normalized email.

A new user sets name and password through the invitation; an existing user must sign in with the matching account before accepting membership in another organization.

Acceptance atomically consumes the invitation and creates or reactivates its unique membership; a lost-response retry may confirm completion for the matching authenticated account but never issue access to an anonymous bearer of a used link.

Normalized emails are trimmed and compared case-insensitively without stripping plus tags or dots.

Passwords are 12 to 128 characters with spaces and password-manager paste allowed, without arbitrary character-class rules.

Authentication, refresh, and invitation acceptance are rate limited and return generic account-existence errors.

| Input | Limit |
| --- | --- |
| Display and organization names | 1 to 100 characters after trimming. |
| Email | Valid address, at most 254 characters. |
| Task and announcement titles | 1 to 160 characters after trimming. |
| Task description and announcement body | At most 10000 characters; announcement body must not be empty. |
| Comment | 1 to 2000 characters after trimming. |
| Membership notes | At most 2000 characters. |
| Skills, interests, and task labels | At most 10 values per field, each 1 to 40 characters. |

User records include skills and interests, and Membership includes notes; Invitation includes delivery status and Task and Announcement include archived_at.

Refresh sessions contain account identifier, expiry, revocation time, current and used token digests, and no plaintext credentials.

Activity events contain action, actor identifier, target identifier, timestamp, and allowlisted changed field names or non-sensitive enum values.

Events never contain passwords, tokens, profile notes, private text bodies, or full request payloads.

One transaction writes a multi-organization announcement and its target-scoped activity records, and readers see only their authorized target context.

Write requests use an updated_at precondition on edits; stale edits return a conflict with a reload action and preserve the client's unsaved form.

## Open questions and approval

Production retention and erasure decisions remain outside local implementation completion.

Exact approval of this revision is pending.
