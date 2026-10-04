# FEAT-007 Security Hardening Verification

Evidence ID: EVID-004.
Created: 2026-10-04T23:32:17+08:00
Updated: 2026-10-04T23:32:17+08:00
Feature and plan: FEAT-007 revision 1 and PLAN-004 revision 1, approved by Len in chat on 2026-10-04T23:19:00+08:00.
Phase: PLAN-004 Phase 1, production configuration and destructive database target guards.
Implementation revision: pending Phase 1 checkpoint commit.

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

These checks establish the new refusal behavior and regression coverage, not evidence of an exploit in a deployed environment.

Whether a production deployment has a compliant secret, whether seed execution occurred against a production target, and whether any hosted environment has unsafe database overrides remain unable to validate without owner-provided production evidence.

## Verification results

On 2026-10-04 PHT, `npm run test:security` passed all 16 tests with zero failures.

On 2026-10-04 PHT, `npm test` completed successfully with exit code 0 and all 244 tests passing across authentication, members, tasks, announcements, finance, and security suites.

On 2026-10-04 PHT, `npm run test:restore` completed successfully against the isolated loopback PostgreSQL 18 instance.

The restore check seeded 2 organizations, 5 users, 7 active memberships, 5 tasks, 3 announcements, and 4 activity events in the synthetic source database.

The check dumped `pipeline_test`, created `pipeline_restore_test`, restored the dump, matched all listed counts and announcement targets, and exactly matched 2 budgets, 4 expenses, 1 import batch, and 4 finance history events.

The check verified zero orphaned relational records, dropped `pipeline_restore_test`, and removed `.db/restore_temp.sql`.

On 2026-10-04 PHT, `git diff --check` completed with exit code 0.

The test setup validated refusal paths synthetically and verified successful migration, truncation, seeding, and restore only on the isolated loopback test cluster.

## Limitations

Production runtime configuration, production deployment seed history, hosted database connection settings, and actual exploitability in any deployed instance were not verified.

The required OS-enforced audit reproduction sandbox was unavailable during EVID-003, so these results do not replace an independent reproduction in that sandbox.

No browser, Flutter, physical-device, hosting, or production-service checks are in scope for Phase 1.

## Phase status

Phase 1 passed its focused security tests, full Node test gate, isolated restore gate, diff check, and code review; the checkpoint commit is pending.

The approved plan continues to Phase 2 after the Phase 1 checkpoint is committed.
