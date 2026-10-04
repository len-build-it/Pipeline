# FEAT-007: Security hardening from audit candidate leads

Created: 2026-10-04T23:06:52+08:00
Updated: 2026-10-04T23:14:13+08:00
Revision: 1
Status: Draft

## Purpose and success

The project needs security controls that remain safe when it runs with production configuration, untrusted stored data, and growing organization history.

Success means all ten source-derived candidates in EVID-003 receive a documented reproducibility disposition, reproduced issues receive a bounded fix with regression coverage, candidates that cannot be validated remain explicitly unresolved, and existing authorized workflows continue to pass.

The [EVID-003 audit report](../evidence/security-audit-2026-10-04/REPORT.md) marks all ten leads as unvalidated candidates and assigns none a severity.

This feature therefore defines validation and remediation outcomes without treating the audit leads as established vulnerabilities.

Candidate-specific reproduction follows the isolation constraints recorded in NEEDS-VALIDATION.md; if that sandbox is unavailable, the lead is recorded as unable to validate and independent safe work can continue.

## Scope and non-goals

This feature covers production authentication configuration, the development seed command, test and restore database target protection, archived organization access, bounded finance spreadsheet operations, paginated task histories, safe web rendering of stored display names, and mobile protected-memory cleanup after authorization denial.

The feature uses the existing Node.js modular monolith, PostgreSQL, native web modules, Flutter Android client, and test dependencies.

The feature adds no runtime or test dependency.

This feature excludes production deployment changes, secret rotation, reviewing historical production seed executions, completing EVID-003's deferred Android dependency-provenance and demo-server coverage units, changing Android signing, and upgrading packages based only on advisory output.

Production environment and job-history checks remain operational evidence and do not authorize recording secret values.

## User flows

A production server starts only when it has an explicitly configured JWT signing secret that meets the approved minimum and differs from the development fallback.

A developer can seed local development data, while a production seed invocation fails before connecting to a database or changing account state.

A test or restore command can operate on its designated disposable local test database and fails before destructive SQL when the selected target is not an allowed test target.

A non-Owner with an active membership can load an active organization's overview, while an archived organization remains inaccessible even if stale membership data is active.

A member can import supported spreadsheets within the existing upload, expanded-size, and 5,000-data-row limits without work proportional to an attacker-selected sparse row index.

A member can export up to 5,000 matching expenses in one workbook; an over-limit export returns a clear error and never silently omits records.

A task user sees the newest comments and activity first, can request older pages, and remains scoped to the authorized task and organization.

A member display name containing markup is displayed as text in task creation and does not create or execute markup.

After a mobile 401, the app clears protected in-memory and persisted account data; after a 403, the app clears protected in-memory and persisted data for the denied organization before protected screens render again.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | Reject unsafe production JWT configuration. | In production mode, missing, short, or development-fallback JWT configuration fails before listening; development mode retains its existing local default; startup errors and logs never reveal the configured secret. |
| REQ-002 | Prevent production use of development seed data. | Direct seed invocation in production fails before opening a database connection; a synthetic database's user password hash, status, and owner flag remain unchanged; development seeding remains available. |
| REQ-003 | Constrain destructive test and restore tools to disposable targets. | Test migration, test setup, and restore tooling reject a development, production, remote, or otherwise disallowed database target before migration, truncation, drop, or create SQL; normalized URL aliases for the same target are treated as the same target; an explicitly permitted isolated loopback test target still works. |
| REQ-004 | Deny non-Owner overview access to archived organizations. | With a synthetic archived organization and an active non-Owner membership, the scoped overview returns access denied and no organization data; the same membership can read the equivalent active organization; Owner behavior remains unchanged. |
| REQ-005 | Bound XLSX import work by supported worksheet extent. | A normal workbook with 5,000 nonblank data rows imports under the existing rules; a workbook with data beyond the 5,000th data row or a sparse row index beyond worksheet row 5,001 is rejected without scanning every missing row; existing upload and expanded-byte limits remain enforced. |
| REQ-006 | Bound finance export size without silent truncation. | An export of 5,000 matching expenses produces a complete workbook; a request matching more than 5,000 expenses reads no more than 5,001 match rows before returning an actionable error without a partial workbook; organization and date filters remain enforced. |
| REQ-007 | Paginate task comment and activity history. | Each response returns at most 100 records and defaults to the newest 50; a valid next-page cursor returns older records in stable order without gaps or duplicates; each page rechecks organization access and task identity; all existing authorized history remains reachable by following pages. |
| REQ-008 | Render stored display names as text. | A Playwright scenario stores a display name containing HTML and script-like text, opens task creation, and verifies the exact name is visible as text while no injected element, event handler, or script runs. |
| REQ-009 | Clear mobile protected in-memory state on denial. | Repository and screen tests first load synthetic protected data, then simulate a 401 after the existing single refresh retry and a 403; a 401 clears all protected account records and credentials, a 403 clears the denied scope, and no affected record remains visible after the response. |
| REQ-010 | Preserve existing application behavior and boundaries. | The existing auth, member, task, announcement, finance, browser, and Flutter checks pass; no third-party dependency is added; routes and widgets remain adapters while feature policy stays in existing application or repository boundaries. |

## Data and interfaces

Uses the shared User, Organization, Membership, Task, Task comment, Activity event, Expense, and session definitions in [DATA_MODEL.md](../product/DATA_MODEL.md).

The web and Android clients continue using the shared API and do not connect directly to PostgreSQL.

Task history list responses gain bounded page metadata and a validated cursor while preserving the existing record fields.

Finance export behavior is capped at 5,000 matched expenses per workbook.

The existing test database helper and restore script remain local developer tools and must validate the effective target before any destructive operation.

## Quality constraints

Uses the shared security, performance, accessibility, and evidence constraints in [CONSTRAINTS.md](../product/CONSTRAINTS.md).

Business policy remains independent from Fastify request objects, PostgreSQL clients, browser DOM objects, and Flutter widgets.

Existing feature services own their policy; HTTP routes and command-line scripts translate inputs, invoke policy, and format errors.

Use existing repositories, application services, test seams, and standard library facilities; do not create a generic security framework or new dependency.

Test production configuration and target-selection policy without connecting to production or recording credentials.

Run database-backed checks only against an isolated disposable PostgreSQL instance on loopback, using synthetic records and a test-only target.

## Decisions and assumptions

Confirmed audit facts are limited to the source traces and coverage gaps recorded in EVID-003.

The ten candidate leads remain unconfirmed until their reproduction tests and independent evidence are recorded.

The proposed finance export maximum is 5,000 expenses per workbook; users receive an explicit error above the cap and can narrow the selected date range.

The proposed task history page size is 50 records by default and 100 records maximum; newest records appear first and older records are fetched on demand.

A sparse XLSX row beyond worksheet row 5,001 is outside the existing 5,000-data-row contract, including when that row is otherwise nonblank.

An archived organization is inaccessible to a non-Owner for scoped overview data, consistent with the existing organization-list and finance access rules.

Production deployment configuration, seed-command history, and credential rotation cannot be established by repository tests and remain external checks.

## Open questions and readiness

No unresolved implementation choice remains beyond approval of this feature and its paired implementation plan.

Revision 1 is a draft and has not been approved by Len.
