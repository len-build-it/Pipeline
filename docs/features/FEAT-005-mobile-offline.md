# FEAT-005: Flutter mobile companion and offline reads

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Purpose and success

Len needs to manage the organizations from a native mobile experience without requiring a separate mobile backend.

Success means the Android app supports the core dashboard, member, task, and announcement flows through the shared API and remains useful for viewing recently loaded data during short connectivity gaps.

## Scope and non-goals

This feature includes Flutter Android navigation, authenticated API access, local caching of recent reads, offline indicators, retry, and reconnect refresh.

It excludes offline writes, background synchronization, push notifications, iOS release support, and native device integrations.

## User flows

An authenticated user opens the app and sees the dashboard for an accessible organization.

The app loads current data when online and stores the latest successful read responses needed for dashboard, member, task, and announcement views.

When offline, the app shows cached reads with a stale-data indicator and disables mutations that require the server.

When connectivity returns, the user retries or refreshes and the app replaces cached data with the latest authorized response.

An expired session requires sign in again and clears protected cached data when policy requires it.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | Share backend behavior with web. | The same account can sign in on web and Android and sees consistent organization permissions and records. |
| REQ-002 | Cache successful reads. | After an online load, reopening the relevant view offline displays the latest permitted cached data. |
| REQ-003 | Explain offline limits. | Offline views show a clear stale-data state and disable or reject server mutations without data loss. |
| REQ-004 | Recover after reconnect. | A retry after connectivity returns loads current authorized data and removes the stale indicator. |
| REQ-005 | Protect cached data. | Sign out or session invalidation prevents access to protected cached data according to the app's storage policy. |
| REQ-006 | Handle mobile states. | Dashboard, members, tasks, and announcements provide loading, empty, error, denied, offline, and retry states. |
| REQ-007 | Bound and isolate the cache. | Switching accounts cannot reveal another account's cached data; cached reads expire after 24 hours, and capacity eviction shows an explicit unavailable-offline state. |
| REQ-008 | Distinguish authentication failures from network failures. | A failed connection may show eligible cache; known revocation or a 401 after one refresh attempt clears protected cache, and 403 clears the affected organization without showing stale data. |

## Data and interfaces

Uses the shared API and entities defined in [DATA_MODEL.md](../product/DATA_MODEL.md).

The mobile cache is a replaceable client detail and is never treated as the source of truth.

## Quality constraints

Uses [CONSTRAINTS.md](../product/CONSTRAINTS.md).

The app must remain usable with intermittent connectivity and must not imply that an offline mutation succeeded.

## Decisions and assumptions

The approved proposal is Flutter native support for Android first with basic cached read access.

Offline editing is intentionally excluded to keep conflict resolution and recovery out of the first release.

## Open questions and readiness

Use the Android matrix in [CONSTRAINTS.md](../product/CONSTRAINTS.md) and flutter_secure_storage for credentials and a bounded encrypted JSON snapshot cache.

Limit the cache to 512 KiB per signed-in account and the first 25 records of each previously loaded primary list for each selected organization; evict oldest snapshots if the byte cap is reached.

Cache only fields needed for list and dashboard reads, excluding notes, drafts, comment bodies, and activity payloads; uncached details explain that a connection is required.

Cache keys include account, organization or combined scope, destination, and filters; never show a different scope's cached response as a fallback.

Offline snapshots expire after 24 hours or at the session's absolute expiry, whichever comes first; display timestamp and an explicit stale label, and never queue writes.

Revocation cannot be learned while fully offline, so cached access may persist only until this bounded expiry; this limitation requires acceptance with this revision.

On reconnect, revalidate account and memberships before displaying refreshed records; sign out, account changes, known invalid sessions, and storage corruption clear the affected cache.

Disable Android backup of credentials and cached protected data.

Exact approval of this revision is pending.
