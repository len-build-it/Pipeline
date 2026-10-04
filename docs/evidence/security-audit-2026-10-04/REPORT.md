# Security Audit Report

Audit date: 2026-10-04, Asia/Manila.

Audit profile: Standard, full repository source-first review.

Source revision: `c274031267191c380098189775736e3189135874` on `codex/organization-manager-mvp`, clean at audit start.

Prior audit use: No compatible prior audit ledger or findings file was present in the project audit workspace or the default external audit path before this run.

Execution policy: Read-only source, configuration, documentation, and locked dependency-source review, with local target execution permitted only inside an OS-enforced sandbox.

## Result

This is an incomplete partial pass, not a clean security assessment.

No candidate was confirmed, and `findings.json` is empty because the required independent candidate and final-record verification could not be completed.

Ten source-derived candidate fingerprints remain in the coverage ledger, but none is presented here as a confirmed vulnerability or assigned severity.

The ledger contains 18 units: 6 covered, 9 candidate, 1 blocked, and 2 deferred.

The 9 candidate units contain 10 unique fingerprints because the database test and restore tooling unit produced two separate leads.

The post-Wave-2 critic found three missing units for database tooling, Android dependency inputs, and the demo server.

One fresh source hunter completed the database tooling unit, but the agent service then reported its thread limit and prevented assignment of the other two units, the next post-wave critic, the final-clean critic, and independent candidate verifiers.

The last completed critic did not return a clean-coverage result, so this audit makes no complete-coverage claim.

The required Windows filesystem safeguards were also unavailable to both report validators.

The exact attempts were `node .agents/skills/security-audit/validate-findings.cjs docs/evidence/security-audit-2026-10-04/findings.json` and `node .agents/skills/security-audit/validate-coverage-ledger.cjs docs/evidence/security-audit-2026-10-04/coverage-ledger.json`.

The findings validator returned `Failed to read findings JSON: OS no-follow and nonblocking input protection is unavailable` with exit code 1, and the ledger validator returned `Failed to read coverage ledger: OS no-follow and nonblocking input protection is unavailable` with exit code 1.

A separate trusted parent-side sanity pass parsed the JSON, checked the 18 canonical coverage IDs for uniqueness and sort order, and checked candidate/deferred state fields and reviewed-path unions; this does not replace the required schema validators.

The exact run status is `incomplete` with `incomplete_reason` `validator_safe_input_protection_unavailable`.

The run metadata records the additional agent-capacity and execution gaps.

No strict agent-count budget was set by the user.

## Security posture summary

Source review found solid authentication, tenant-scoping, upload-bound, and output-escaping controls across the main workflows, alongside specific source paths that need runtime or deployment confirmation.

Because the audit could not execute the required local checks, obtain independent candidate decisions, complete the coverage critic loop, or pass its schema validators, the repository's overall security posture remains undetermined.

| Confirmed findings | Severity | Observed result |
| --- | --- | --- |
| None established | Not assigned | No candidate completed the required independent validation and bounded result checks. |

## Scope and method

The review covered repository application source, configuration, documentation relevant to runtime security, database migration and seed tooling, web and mobile clients, package manifests and lockfiles, and read-only source for the locally installed locked ExcelJS 4.4.0 dependency.

The selected domain material covered HTTP authentication, browser rendering, tenant and lifecycle isolation, resource exhaustion, supply chain and release, mobile local storage, and deployment configuration.

No target code, tests, builds, database commands, browser flows, emulator flows, or production systems were executed.

The host did not expose an OS-enforced sandbox with an empty environment, no network, read-only target and tools, scratch-only writes, and explicit resource limits, so local validation stopped at source review.

The local Docker engine was unavailable, and the audit did not connect to the project database or any external service.

Deployment facts such as production JWT secret configuration, seed history, SMTP transport configuration, runner database endpoints, hosted signing policy, and real organization archive behavior are not visible in the repository.

No checked-in OAuth or SAML identity provider, MFA flow, WebSocket, service worker, message broker, cloud IAM policy, native IPC service, CI release workflow, or updater was identified, so those implementation classes were not applicable to the source review.

The coverage ledger contains no separate `out_of_scope` rows for these absent source surfaces; missing deployment facts are listed as unobserved and were not treated as safe by assumption.

## Candidate leads awaiting independent validation

These are source-derived leads only, not confirmed findings.

| Fingerprint | Boundary and source path | Exact unresolved fact |
| --- | --- | --- |
| `auth.jwt-secret-fallback` | JWT verification in `server/config.js:5`, `server/app.js:45-50`, and `server/index.js:16-21`. | Whether production sets a non-default secret and whether a token signed with the committed fallback is accepted by the protected request guard. |
| `bootstrap.seed-default-owner-credentials` | Seed command in `db/seed.js:6-35` and `db/seed.js:95`. | Whether the seed command has ever targeted a production or shared database and whether seeded credentials were rotated. |
| `db.migrate.test-url-alias` | Test database guard and destructive setup in `db/migrate.js:9-22`, `tests/helpers/db-helper.js:6-20`, and `db/client.js:5-12`. | Whether a lower-trust runner can supply an alternate URL for the same shared database and whether the database identity is treated as equivalent. |
| `finance.unbounded-xlsx-export` | Unbounded organization export in `server/routes/finance.js:189-198`, `server/finance/export.js:30-48`, and `server/finance/repository.js:142-163`. | Whether realistic history sizes and bounded synthetic measurements show material shared-service resource impact. |
| `finance.xlsx-sparse-row-index` | XLSX row iteration in `server/finance/spreadsheet.js:12-16` and `server/finance/spreadsheet.js:190-200`, with ExcelJS 4.4.0 row-index behavior. | Whether a bounded sparse-row workbook causes materially greater processing than the configured data-row limit. |
| `mobile.denial-keeps-memory-records` | Denial handling in `mobile/lib/data/app_repository.dart:226-237` and direct screen reads such as `mobile/lib/screens/overview_screen.dart:23-25`. | Whether the authenticated screens continue to render retained protected records after a 401 or 403 response. |
| `overview.archived-org-active-membership` | Scoped overview authorization and result queries in `server/routes/organizations.js:44-53` and `server/routes/organizations.js:135-205`. | Whether the supported archive lifecycle can leave active memberships and whether the scoped endpoint returns records in that state. |
| `scripts.test-restore.environment-selected-target` | Environment-selected restore target and database drop in `scripts/test-restore.js:12-22`, `scripts/test-restore.js:66-71`, and `scripts/test-restore.js:103-117`. | Whether a lower-trust runner can direct the command to a shared server containing a droppable `pipeline_restore_test` database. |
| `tasks.comment-history-unbounded` | Comment writes and unbounded history reads in `server/routes/tasks.js:136-176` and `server/tasks/service.js:608-626`, `server/tasks/service.js:632-685`, and `server/tasks/service.js:809-824`. | Whether bounded synthetic histories show material storage, query, or response cost after the existing request limits. |
| `web.stored-display-name-html-injection` | Display-name storage and the task-create option template in `server/routes/members.js:146-163`, `server/members/service.js:591-639`, and `web/js/app.js:690-715`. | Whether the browser parses the option fragment as active attacker-controlled markup or executes a benign event marker. |

The two deferred coverage units are Android release dependency provenance and the loopback demo server static-file boundary.

Their fingerprints are not candidates because no source hunter was assigned after the agent limit was reached.

The blocked unit is Android release signing and deployment, which is not represented by repository source sufficient to establish the final artifact policy.

## Coverage summary

Six units received source coverage without an unresolved candidate: the runtime package graph, invitation acceptance, password hashing, refresh and CSRF flow, announcement authorization, and organization member authorization.

The covered source paths show Scrypt password hashing with random salts, refresh-token rotation and reuse handling, strict refresh-cookie settings, CSRF checking for browser refresh, active membership checks, organization-bound reads and writes, and escaped rendering for most persisted task, announcement, finance, and member-directory content.

The candidate units cover bootstrap credentials, bearer-token secret handling, mobile denial and cache lifecycle, task comment history, spreadsheet parsing, finance export, organization overview scope, cross-user browser rendering, and database test and restore tooling.

The deferred units and unresolved candidates are listed in [`NEEDS-VALIDATION.md`](NEEDS-VALIDATION.md), with source traces, decisive blockers, and bounded next steps.

The separately reviewed sibling browser sinks did not establish another cross-user candidate beyond the stored display-name path.

The mobile lockfile pins hosted package versions and includes package hashes, but Android dependency input review remains deferred because the assigned source hunter could not be started.

## Dependency advisory notes

`@fastify/static` 8.3.0 is within the affected ranges for two advisories describing route-guard bypasses for protected static files, with fixes listed in later releases.

The current API static root is the public `web` directory in `server/app.js:57-60`, and the source review did not identify protected files served through route guards, so this is a conditional upgrade note rather than a project finding.

See [GHSA-83w8-p2f5-377r](https://github.com/advisories/GHSA-83w8-p2f5-377r) and [GHSA-x428-ghpx-8j92](https://github.com/advisories/GHSA-x428-ghpx-8j92).

Nodemailer 6.10.1 falls within the advisory's affected range for message-level raw content, but `server/services/email.js` currently captures invitation messages in memory and does not create a transport or pass untrusted data to `sendMail`.

This is a pre-integration upgrade note, not a reachable vulnerability in the reviewed code.

See [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f).

The locked uuid 8.3.2 advisory applies to v3, v5, and v6 APIs with caller-provided buffers, while the inspected ExcelJS path uses v4 without a caller buffer.

No reachable impact was established for this code path.

See [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

The project handoff already tracks these dependency updates as pending, and no dependencies were changed during this audit.

## Hardening notes without a confirmed boundary violation

Keep `db/seed.js` limited to disposable development databases, fail closed in production, and require explicit rotation of any default seeded account credentials.

Enforce a non-default JWT secret before production startup and rotate any deployment that used the committed fallback.

Use parsed and normalized database identity checks or a separate database role and endpoint for test commands instead of raw connection-string equality and substring checks.

Keep the restore utility constrained to a disposable local target even when `PGHOST` and `PGPORT` are overridden.

Bound or paginate comment and activity histories and export queries if bounded measurements confirm material service cost.

Reject excessive spreadsheet row indices before iterating, even when the number of nonblank rows is small.

Clear or scope-gate protected mobile in-memory state on 401 and 403 responses, then add a sign-in or organization-selection guard before protected screens render.

Escape the task-create assignee display name for its HTML context or construct option elements and assign `textContent`.

Join scoped overview authorization to the organization row and require active organization status if archived organizations must not be visible to former members.

## Next actions

Run the two required validators in an environment that supports race-safe no-follow and nonblocking file access.

Complete source review for the two deferred units, then run a fresh post-wave critic and a distinct final-clean critic.

Assign a fresh independent candidate verifier and a separate final-record verifier to each surviving fingerprint, and run only the smallest local fixtures in the required OS-enforced sandbox.

Have the owner check production JWT secret configuration, seed execution history, and effective test and restore runner database targets without disclosing secret values or contacting live services.

Update this report and its JSON and ledger artifacts only after those checks are completed, and preserve the current source revision reference for comparison.
