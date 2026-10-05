# PLAN-005: FEAT-001 Android sign-in, invitation setup, and demo access

Created: 2026-10-05T08:18:39+08:00
Updated: 2026-10-05T08:34:42+08:00
Plan ID: PLAN-005
Revision: 1
Status: Approved - Phases 1 and 2 verified; Phase 3 next
Feature spec and revision: [FEAT-001 revision 4](../features/FEAT-001-access-dashboard.md), Approved
Approved baseline and architecture revisions: PROD-001 revision 3, PROD-002 revision 3, PROD-003 revision 3, PROD-004 revision 4, PROD-005 revision 4, FEAT-005 revision 2, and FEAT-007 revision 1
Len's chat approval: Len authorized the current FEAT-001 revision 4 and PLAN-005 revision 1 package in chat with: "Execute the implementation plan $clean-code".
Approval recorded: 2026-10-05T08:34:42+08:00
Target branch: codex/organization-manager-mvp

## Scope

Implement FEAT-001/REQ-009 through FEAT-001/REQ-013 for the Flutter Android account entry, session restoration, invitation-based account setup, predictable sign-out, and isolated demo mode.

Preserve FEAT-001/REQ-001 through FEAT-001/REQ-008, the four Android bottom destinations, Finance as a secondary destination, the Lagoon design, current role and organization authorization, and FEAT-005's bounded offline cache policy.

The plan uses the existing Flutter, Node.js, PostgreSQL, secure-storage, and test toolchain and adds no dependency, database migration, public registration route, password-recovery flow, or new product feature.

The baseline is commit `1f588dd7d866cb242d1a867dd25513d749c62a46` on `codex/organization-manager-mvp`; the only pre-existing worktree change when this draft was prepared was FEAT-001 revision 4.

Source inspection found that `TeamManagerApp` currently starts on synthetic records, the sign-in and invitation forms are account-menu dialogs, and the sign-in dialog can prefill development credentials.

Source inspection found that mobile invitation acceptance posts to `/auth/invitations/accept`, while the server exposes `/auth/invitation/accept`, and the client currently expects a user payload that the server acceptance response does not return.

Source inspection found an existing server invitation preview at `GET /api/auth/invitation/:token`, but the Flutter API client does not expose it; matching existing accounts must also be required to sign in before invitation acceptance under DATA_MODEL.md and FEAT-001/REQ-007.

The demo path must use local synthetic data without an authenticated API repository, protected-cache access, or server mutations; public self-registration remains excluded by PROD-004 revision 4.

No application source, tests, builds, database commands, browsers, or emulators were run while preparing this planning package.

## UX and Council review

Observed facts: the Android app starts with synthetic records, sign-in and invitation entry are dialogs, a development account can be prefilled, and the four-destination Lagoon shell is already approved.

Observed facts: the Flutter client has secure token storage and invitation acceptance code, but lacks the server's invitation preview call and currently uses a mismatched acceptance path and response assumption.

Assumption: signup means invited users create an account or existing members sign in to accept an invitation; Len confirmed this interpretation, and PROD-004 revision 4 excludes public registration.

| Perspective | Review finding | Proposed response |
| --- | --- | --- |
| Devil's advocate | A familiar sign-in could still expose the current synthetic account or old account cache on a fresh launch. | Gate protected screens until a live session is revalidated, and restore only the same account's eligible cache within FEAT-005 limits. |
| Simplicity | The app already has an auth API, encrypted token storage, and a local synthetic repository. | Reuse these building blocks and add no dependency, schema, or new public registration endpoint. |
| Security and reliability | A bearer invitation currently can attach a membership to an existing account without proving that account, and route or response mismatches can make the invite flow fail. | Bind existing-account acceptance to its authenticated user at the server and test the real API paths and response shapes. |
| Architecture | The startup path currently mixes the authenticated repository with synthetic defaults. | Give startup explicit restore, signed-out, authenticated, and demo states; keep demo on a separate local repository. |

An automatic verified Android App Link is not included because current invitation URLs use a local development host and production hosting has no approved domain; the proposed form accepts an invitation token or a pasted existing invitation URL, and verified app-link handoff can be revisited after a production domain is chosen.

## Execution protocol

Before execution, read `AGENTS.md`, `GEMINI.md`, `HANDOFF.md`, this plan, FEAT-001 revision 4, PROD-001 revision 3 through PROD-005 revision 4, FEAT-005 revision 2, and FEAT-007 revision 1, and verify that the handoff records approval of the exact FEAT-001 and PLAN-005 revisions.

Run `npx len-toolkit start` once in the execution session and inspect any reported instruction differences without overwriting custom content.

Inspect `git status --short --branch`, `git diff`, `git diff --cached`, and `git log -10 --oneline`, and preserve changes that do not belong to the approved phase.

Run authentication integration tests only against a dedicated disposable PostgreSQL 18 test database bound to loopback, using synthetic users and invitation tokens; do not use a development or production database, real invitation recipients, or live email.

Run the mobile checks from `mobile/` and the server checks from the repository root, and record the actual Flutter, Dart, Node.js, PostgreSQL, Android API, and emulator details in the evidence record.

The approved Android matrix is API 24 and API 36; inspect `flutter emulators` and `flutter devices` before verification, and report any unavailable target as pending instead of treating API 37 as equivalent.

After Len approves both exact revisions, execute each phase continuously when its required checks pass, review its scoped diff, update the evidence and handoff, and create one reviewed local checkpoint commit using that phase's unique message.

## Phase 1: Give signed-out users a dedicated entry and restore live sessions

Requirements: FEAT-001/REQ-002, FEAT-001/REQ-003, FEAT-001/REQ-006, FEAT-001/REQ-009, FEAT-001/REQ-010, FEAT-001/REQ-013, and FEAT-005/REQ-005 through FEAT-005/REQ-008.

State: Complete - checkpoint a3d9e9648abadede8b11dacaede1d9e14ffab325.

### Tasks

- [x] Replace the synthetic first-launch path with explicit restore, signed-out, authenticated, and demo entry states; mount the live HomeShell only for a restored or newly authenticated account, and mount the synthetic HomeShell only after an explicit demo choice.
- [x] Add a dedicated Lagoon-styled Android sign-in page using Flutter's native `Form` validation, visible Email and Password labels, email and current-password autofill hints, password visibility and paste support, a clear primary Sign in action, loading feedback, and an actionable generic error that does not expose credentials or account existence.
- [x] Announce validation and server errors accessibly, keep them near the relevant field or form, focus the first invalid field after submit, and preserve entered values when a retry is appropriate.
- [x] Remove prefilled development credentials from all production-facing entry paths and keep any test credentials inside test fixtures only.
- [x] Revalidate stored credentials through the existing authenticated API flow on launch, restore the last organization only when current permissions allow it, and otherwise select a safe permitted default.
- [x] Persist only the minimum account identity and last-scope metadata needed to reopen the same account's encrypted offline cache, with the existing absolute session expiry; do not store passwords or invitation tokens.
- [x] On network failure, show only that same account's eligible FEAT-005 cached reads with a clear stale/offline label; if no eligible cache exists, keep the sign-in page available with retry, and never fall back to synthetic records.
- [x] On known expiry or revocation, clear the account's protected state and show sign-in; preserve FEAT-007's whole-account 401 and organization-scoped 403 handling.
- [x] Make sign-out return to the signed-out entry after local protected state is cleared and the existing best-effort server revocation runs.
- [x] Add widget, repository, and API-client regression coverage for fresh launch, valid and invalid credentials, session restore, safe scope fallback, offline cache eligibility, known revocation, loading, error recovery, and sign-out.

### Verification

- [x] Run `flutter analyze` from `mobile/`; expect no analyzer issues.
- [x] Run `flutter test` from `mobile/`; expect the complete Flutter unit and widget suite to pass without live API access.
- [x] Exercise the sign-in and session-recovery widgets at default and 200 percent text scale; verify keyboard traversal, password visibility semantics, on-screen keyboard usability, and 48 logical-pixel touch targets.
- [x] Verify with mocked HTTP and secure storage that a signed-out launch makes no protected-data request and displays no synthetic sample records.
- [x] Record the phase commands, device and text-scale scenarios, actual outcomes, and limitations in `docs/evidence/FEAT-001-auth-entry-verification.md`.

### Review and checkpoint

- [x] Review session and cache ownership, permission-safe scope restoration, accessibility, correctness, scope, dependencies, and unrelated changes.
- [x] Update this plan, the evidence record, and the current handoff with actual results.
- [x] Stage only reviewed Phase 1 paths and inspect the staged diff.
- [x] Commit the reviewed phase as `feat(mobile): add dedicated sign-in and session restore` and verify Git reports success.

Phase completion requires all listed gates and a successful local commit.

Continue automatically to Phase 2 after Phase 1 completes.

## Phase 2: Complete invitation-based account setup

Requirements: FEAT-001/REQ-001, FEAT-001/REQ-007, FEAT-001/REQ-011, and FEAT-001/REQ-013.

State: Verified - checkpoint commit pending.

### Tasks

- [x] Add a clearly labeled `Have an invitation? Create account` entry from sign-in that accepts an invitation code or a pasted existing invitation URL, then previews the invited organization, role, and recipient email before account setup.
- [x] Add a Flutter client method for the existing `GET /api/auth/invitation/:token` endpoint and keep the bearer invitation token out of logs, analytics, error text, and persistent storage.
- [x] Build invitation form states for valid, invalid, expired, already used, mismatched email, loading, network failure, and retry, with a clear path back to sign-in.
- [x] Let a new invitee set a display name and a 12-to-128-character password with visibility and password-manager paste, and explain that the invitation email must match without arbitrary password character rules.
- [x] Offer an `Already have an account? Sign in` route that preserves the pending invitation only in memory and accepts membership only after the signed-in account matches the invitation email.
- [x] Correct the mobile acceptance request to the existing singular `/api/auth/invitation/accept` route and adapt the client to the server's actual acceptance response; after new account creation, sign in with the supplied credentials before opening the invited organization.
- [x] Enforce the existing-account sign-in requirement at the server boundary as well as in the UI, without changing the invitation lifecycle, public signup policy, database schema, or generic account-existence protections.
- [x] Add Flutter and Node authentication regressions proving that a valid invitation creates the intended new user and membership, a matching signed-in existing account may accept, and a mismatched or unauthenticated existing account cannot gain membership.
- [x] Prove invalid, expired, consumed, and email-mismatched invitations grant no account or membership, and that successful acceptance cannot be replayed.

### Verification

- [x] Run `flutter analyze` and `flutter test` from `mobile/`; expect the complete Flutter suite to pass.
- [x] Run `npm run test:auth` from the repository root against the isolated loopback PostgreSQL 18 test database; expect all auth and invitation lifecycle tests to pass.
- [x] Verify the mobile preview and acceptance requests against the real local auth routes using synthetic invitations, including the exact singular route paths and returned response shapes.
- [x] Confirm no live email is sent and no test invitation or account reaches a non-disposable database.
- [x] Record commands, invitation fixtures, account and membership outcomes, and limits in `docs/evidence/FEAT-001-auth-entry-verification.md`.

### Review and checkpoint

- [x] Review server-side account binding, invitation-token handling, generic errors, transaction boundaries, rate limits, UX recovery, correctness, scope, dependencies, and unrelated changes.
- [x] Update this plan, the evidence record, and the current handoff with actual results.
- [x] Stage only reviewed Phase 2 paths and inspect the staged diff.
- [x] Commit the reviewed phase as `feat(auth): add invitation account setup flow` and verify Git reports success.

Phase completion requires all listed gates and a successful local commit.

Continue automatically to Phase 3 after Phase 2 completes.

## Phase 3: Separate demo access and verify the complete first-run journey

Requirements: FEAT-001/REQ-009, FEAT-001/REQ-012, FEAT-001/REQ-013, FEAT-005/REQ-005, and PROD-005 revision 4 Android navigation and accessibility rules.

State: Approved - pending execution.

### Tasks

- [ ] Add an explicit `Try demo` action on the signed-out page and show a persistent, text-labeled Demo indicator while sample data is open.
- [ ] Open demo with a fresh in-memory `SyntheticDataRepository`, keeping it outside the authenticated `AppRepository`, secure account cache, and live API mutation path.
- [ ] Keep demo-only persona switching, offline simulation, and sample reset controls inside the labeled demo session, and keep them out of signed-in account controls.
- [ ] Make leaving demo discard its temporary changes and return to sign-in; re-entering demo starts from the original sample state.
- [ ] Preserve the four approved bottom destinations, secondary Finance entry, existing Lagoon tokens, Android back behavior, and normal signed-in account menu.
- [ ] Add tests that create a local demo mutation, leave and re-enter demo, and prove the mutation resets without network requests, live tokens, or protected-cache writes.
- [ ] Run the complete signed-out, demo, invitation, sign-in, session-restore, offline-cache, account-switch, and sign-out journey on the approved Android API 24 and API 36 emulator targets, using the actual available AVDs and recording any missing target as pending.
- [ ] Capture and inspect screenshots for sign-in, invitation setup, visibly labeled demo data, and authenticated landing at normal text and 200 percent text scale.

### Verification

- [ ] Run `flutter analyze`, `flutter test`, and `flutter build apk --debug` from `mobile/`; expect all checks to pass.
- [ ] Run `npm run test:auth` and `npm test` from the repository root against the isolated loopback PostgreSQL 18 test database; expect the auth suite and full Node suite to pass.
- [ ] Run `flutter emulators` and `flutter devices`, install the debug APK on the available API 24 and API 36 emulator targets, and execute the scenario sequence listed above; record each actual API level and device name.
- [ ] At 200 percent text scale, verify no primary action is clipped by the software keyboard or device navigation and all error, loading, and stale-cache messages remain readable.
- [ ] Store the inspected screenshots under `docs/evidence/screenshots/FEAT-001-auth-entry/` and record their scenario, emulator, scale, verification command, and limitation in `docs/evidence/FEAT-001-auth-entry-verification.md`.
- [ ] Run `git diff --check`; expect no whitespace errors.

### Review and checkpoint

- [ ] Review demo isolation, account boundaries, first-run and return-user navigation, accessibility, screenshots, correctness, scope, dependencies, and unrelated changes.
- [ ] Update this plan, the evidence record, the specification index, and the current handoff with actual results.
- [ ] Stage only reviewed Phase 3 paths and inspect the staged diff; preserve any unrelated test-generated screenshot changes.
- [ ] Commit the reviewed phase as `feat(mobile): isolate demo access from live accounts` and verify Git reports success.

Phase completion requires all listed gates and a successful local commit.

## Recovery

Follow project `AGENTS.md` for the three-attempt limit, immediate user-decision and access blockers, preserved unrelated work, and handoff updates.

An unavailable emulator target, isolated test database, or required tool blocks only the checks that depend on that resource; keep those gates explicitly pending and continue independent approved work when safe.

Any proposed public registration, password recovery, database schema change, new dependency, authentication policy change outside FEAT-001/REQ-007, or alteration of FEAT-005 cache rules requires a revised approval package before implementation.

Interrupted or failing work remains uncommitted, and the affected phase remains incomplete.
