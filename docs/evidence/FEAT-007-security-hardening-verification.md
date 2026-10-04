# FEAT-007 Security Hardening Verification

Evidence ID: EVID-004.
Created: 2026-10-04T23:32:17+08:00
Updated: 2026-10-04T23:45:00+08:00
Feature and plan: FEAT-007 revision 1 and PLAN-004 revision 1, approved by Len in chat on 2026-10-04T23:19:00+08:00.
Phase: PLAN-004 Phases 1 and 2, with Phase 2 awaiting its checkpoint commit.
Implementation revision: Phase 1 checkpoint commit `de94ccbf9503a171364e0a6b4bdbfca49e485ce6`; Phase 2 changes are under review.

## Scope and environment

Phase 1 implemented production JWT configuration validation, production seed refusal, parsed PostgreSQL test-target checks, and restore-target checks before database access.

The implementation and checks used Node.js v24.14.0, npm 11.9.0, and PostgreSQL 18.4.

Database-backed checks used the isolated PostgreSQL 18 instance on loopback at 127.0.0.1:5433, with synthetic data in `pipeline_test` and the disposable `pipeline_restore_test` database.

No production database, deployment environment, production credential, or customer data was accessed.

## Candidate validation

`auth.jwt-secret-fallback` is covered by pure configuration tests and a server CLI subprocess check that refuses the fallback or a short secret before contacting PostgreSQL.

`bootstrap.seed-default-owner-credentials` is covered by function and CLI checks that refuse production seed execution before opening a database.

`db.migrate.test-url-alias` is covered by synthetic URL tests for normalized loopback aliases, a development database alias with differing URL options, remote hosts, blocked connection-target options, and credential-safe refusal messages.

`scripts.test-restore.environment-selected-target` is covered by subprocess checks for remote `PGHOST`, mismatched ports, `PGHOSTADDR`, and `PGSERVICE`; each unsafe case exits before source preparation.

`overview.archived-org-active-membership` is covered with a synthetic archived organization, active non-Owner membership, and task record; the member is denied without the task data while Owner access remains available.

`finance.xlsx-sparse-row-index` is covered by a synthetic workbook with its only data row at worksheet row 5,002; the row-span guard refuses it before the import loop scans missing rows.

`finance.unbounded-xlsx-export` is covered with 5,000 synthetic matching expenses and one additional matching expense; exactly 5,000 exports completely, while the over-limit query reads only 5,001 records and returns a validation error without a workbook.

These checks establish the new refusal behavior and regression coverage, not evidence of an exploit in a deployed environment.

The archived overview scenario is synthetically represented by the checked-in schema but does not establish that a deployed organization was archived with active membership.

The sparse workbook test verifies early row-span rejection but does not benchmark pre-fix CPU or memory use under the unavailable OS-enforced audit sandbox.

The export test establishes the bound with synthetic records but does not measure historical production load or shared service capacity.

Whether a production deployment has a compliant secret, whether seed execution occurred against a production target, and whether any hosted environment has unsafe database overrides remain unable to validate without owner-provided production evidence.

## Verification results

On 2026-10-04 PHT, `npm run test:security` passed all 16 tests with zero failures.

On 2026-10-04 PHT, `npm test` completed successfully with exit code 0 and all 244 tests passing across authentication, members, tasks, announcements, finance, and security suites.

On 2026-10-04 PHT, `npm run test:restore` completed successfully against the isolated loopback PostgreSQL 18 instance.

The restore check seeded 2 organizations, 5 users, 7 active memberships, 5 tasks, 3 announcements, and 4 activity events in the synthetic source database.

The check dumped `pipeline_test`, created `pipeline_restore_test`, restored the dump, matched all listed counts and announcement targets, and exactly matched 2 budgets, 4 expenses, 1 import batch, and 4 finance history events.

The check verified zero orphaned relational records, dropped `pipeline_restore_test`, and removed `.db/restore_temp.sql`.

On 2026-10-04 PHT, `git diff --check` completed with exit code 0.

On 2026-10-04 PHT, `npm run test:auth` passed all 27 tests, including archived-organization member denial and preserved Owner behavior.

On 2026-10-04 PHT, `npm run test:finance` passed all 124 tests, including the 5,000 and 5,001 export boundary, filtered exports, and the sparse worksheet row test.

On 2026-10-04 PHT, `npm run test:security` passed all 16 security tests.

On 2026-10-04 PHT, the complete `npm test` gate exited 0 with 247 passing tests.

On 2026-10-04 PHT, `npm run test:e2e` passed all 13 Playwright workflows in 52.7 seconds using Playwright 1.63.0.

The first full finance run exposed fixture leakage from the new export-boundary test into the following workbook round-trip test; a `finally` cleanup was added, after which the focused export test and full finance gate passed.

A later finance run found two assertions expected a comma in the numeric row limit while the error message uses `5000`; the assertions were corrected and the final finance gate passed all 124 tests.

The test setup validated refusal paths synthetically and verified successful migration, truncation, seeding, and restore only on the isolated loopback test cluster.

## Limitations

Production runtime configuration, production deployment seed history, hosted database connection settings, and actual exploitability in any deployed instance were not verified.

The required OS-enforced audit reproduction sandbox was unavailable during EVID-003, so these results do not replace an independent reproduction in that sandbox.

The E2E run updated existing tracked screenshot outputs under `docs/evidence/screenshots`; those generated changes are preserved and excluded from the FEAT-007 phase checkpoint.

No Flutter, physical-device, hosting, or production-service checks are in scope for Phases 1 and 2.

## Phase status

Phase 1 passed its focused security tests, full Node test gate, isolated restore gate, diff check, code review, and checkpoint commit `de94ccbf9503a171364e0a6b4bdbfca49e485ce6`.

Phase 2 passed its focused auth, finance, and security suites, the full Node gate, E2E gate, diff check, and code review; its checkpoint commit is pending.
