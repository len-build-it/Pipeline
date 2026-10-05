# FEAT-001 Android account entry verification

Created: 2026-10-05T08:41:51+08:00
Updated: 2026-10-05T08:41:51+08:00
Feature: FEAT-001 revision 4
Plan: PLAN-005 revision 1

## Environment and boundaries

Execution is on Windows, branch codex/organization-manager-mvp, baseline 1f588dd7d866cb242d1a867dd25513d749c62a46.
Flutter 3.44.7, Dart 3.12.2, Node 24.14.0, and npm 11.9.0 are the installed toolchain.
The authentication test helper validates a disposable pipeline_test PostgreSQL 18 database at loopback port 5433 against the separate pipeline_dev target before migration, truncation, and synthetic seeding.
Tests use the existing test email capture, not live delivery.
No new dependency or schema migration was introduced.
The installed Medium_Phone AVD uses API 37.1; approved API 24 and API 36 emulator scenarios remain pending for Phase 3.

## Phase 1

At 2026-10-05T08:41:51+08:00, flutter analyze passed with no issues.
The full flutter test --reporter expanded suite passed 67 tests and skipped one existing FINANCE_LIVE_API test because its opt-in variable was not set.
The npm run test:auth suite passed all 27 tests against the dedicated disposable database.
The git diff --check command passed.

The new auth_entry_test.dart covers fresh signed-out launch with zero API requests and no synthetic records, empty credential fields, generic credential errors preserving email, loading and duplicate-submit prevention, keyboard next/done, and password visibility labels.
A 360 by 640 logical-pixel widget viewport at 200 percent text scale with a 260-pixel keyboard inset kept the primary action scrollable, without layout exceptions, with sign-in and password visibility targets at least 48 logical pixels.
Repository tests cover cold restoration with session ID, memory-only access token, saved permitted scope, safe fallback after membership removal, eligible same-account offline cache, no-cache offline rejection while retaining refresh credentials for retry, absolute expiry, known revocation, and logout cleanup.
A root navigation test proves logout removes a pushed protected detail page and returns to sign-in.
These are widget and mocked-HTTP results, not emulator or physical-device evidence.

Initial Flutter checks found an invalid const Semantics constructor, an invalid test focus getter, scope-denial behavior changed by continuing the refresh, and block-style lint findings.
The first correction resolved the compile and scope errors; all tests then passed, with two remaining block-style lint findings.
The second correction resolved those lint findings and analysis passed.
No unresolved failure remains from these checks.

Review confirmed that session context contains only identity, membership role/status, organization metadata, scope, and expiry; access tokens, passwords, invitation codes, membership notes, skills, and interests are excluded.
The server refresh response now carries the original absolute expiry, and refresh cookies do not extend the database session lifetime.
The old sign-in and invitation dialogs and their development-prefilled credentials were removed from the shell.
Live account controls omit demo persona, simulation, and reset controls.
Explicit demo and invitation entry actions are connected in the following approved phases.
Phase 1 checkpoint message: feat(mobile): add dedicated sign-in and session restore.
