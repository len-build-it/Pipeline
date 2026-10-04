# Unvalidated Candidate Leads

This file records ten source-derived candidates that did not reach independent verification.

They are leads for the next audit pass, not confirmed vulnerabilities, and none has a severity rating.

The required target sandbox was unavailable, the validator-safe file-opening features were unavailable, and the agent service reached its thread limit before the independent verification phases.

Each local plan below requires an OS-enforced sandbox with no external network, an empty allowlisted environment, read-only target and toolchain, scratch-only writes, and explicit low resource and time limits.

## `auth.jwt-secret-fallback`

**Title:** Production may use the committed JWT fallback secret.

**Boundary:** A party who can create a token with the accepted signing key may impersonate an active application user.

**Source trace:** `server/config.js:5` selects a committed fallback when `JWT_SECRET` is absent, `server/app.js:45-50` registers that value with the JWT plugin, and `server/index.js:16-21` logs the production branch without visibly rejecting the fallback.

**Additional evidence:** `server/app.js:75-108` verifies the JWT and reloads an active user by subject, but the session-row lookup runs only when the token contains a `sessionId` claim.

**Blocker:** Production environment configuration is outside the repository, and no dummy signed token was tested against a protected route.

**Local plan:** In the required sandbox, start the real authentication guard with a disposable database and dummy active account, omit `JWT_SECRET`, then submit a token signed with the committed fallback and a dummy account subject, stopping at the first protected-route allow or deny result.

**Owner check:** Have the owner verify that every production replica has a nonempty `JWT_SECRET` whose value differs from the committed fallback, without revealing or recording the value.

**Smallest likely source fix:** Fail startup in production if the configured secret is missing, too short, or equal to the development fallback, then rotate deployments that used the fallback.

## `bootstrap.seed-default-owner-credentials`

**Title:** The seed command can reset seeded accounts to default credentials and owner state.

**Boundary:** Production account credentials and role state must not be overwritten by development bootstrap data.

**Source trace:** `db/seed.js:6-8` opens the configured database, `db/seed.js:20-35` generates a hash for a built-in development password and upserts account password, active status, and owner state, and `db/seed.js:95` invokes the seed command when run directly.

**Additional evidence:** Server startup and the checked-in package scripts do not invoke the seed command automatically.

**Blocker:** Repository source does not show whether an operator or deployment job has ever run this command against a production or shared database, or whether any affected credential was rotated.

**Local plan:** In the required sandbox, invoke the seed command only against a disposable database populated with dummy users, then observe whether rerunning it changes dummy credential hashes, account status, and owner flags.

**Owner check:** Have the owner inspect production job history and migration records for direct execution of the seed command and confirm rotation of any seeded account credentials.

**Smallest likely source fix:** Refuse direct seed execution when `NODE_ENV` is production and separate development bootstrap credentials from any real account provisioning flow.

## `db.migrate.test-url-alias`

**Title:** Test database protection compares connection strings rather than database identity.

**Boundary:** Test setup must not truncate a development, production, or otherwise shared database.

**Source trace:** `tests/helpers/db-helper.js:6-20` reads a test URL, passes it through test migration validation, and truncates application tables through the selected pool, while `db/migrate.js:9-22` rejects exact URL equality and selected substrings.

**Additional evidence:** `db/client.js:5-12` passes the selected URL directly to the PostgreSQL pool.

**Blocker:** No evidence establishes that an untrusted actor controls a test runner's database environment, and equivalence of an alternate connection URL was not demonstrated with the installed PostgreSQL client.

**Local plan:** In the required sandbox, create an isolated disposable database with a synthetic sentinel row, set `DATABASE_URL` and `TEST_DATABASE_URL` to the same database with one connection option changed, and verify whether the guard accepts the URL and setup truncates only that disposable database.

**Owner check:** Have the owner inspect effective test-runner environment variables and database endpoint identity to determine whether test configuration can alias a shared database.

**Smallest likely source fix:** Parse and compare normalized endpoint and database identity, and use a dedicated test role that cannot modify non-test databases.

## `finance.unbounded-xlsx-export`

**Title:** An authorized organization member can request an unbounded expense export.

**Boundary:** One organization member's report request should not consume disproportionate shared server memory or CPU as organization history grows.

**Source trace:** `server/routes/finance.js:189-198` serves an XLSX export, `server/finance/export.js:30-48` loads all matching expenses and builds a workbook, and `server/finance/repository.js:142-163` contains a separate paginated listing path and an export query without a row limit.

**Additional evidence:** The route authorizes finance access and binds records to the requested organization, so the lead concerns resource use after authorization rather than cross-tenant access.

**Blocker:** The repository sets no maximum expense history and the memory, CPU, and response cost of bounded exports was not measured.

**Local plan:** In the required sandbox, use synthetic organization data at increasing but modest record counts, request the native export function or isolated route, and record the smallest count at which bounded memory or time limits are exceeded.

**Smallest likely source fix:** Add a documented export row cap or paginated/asynchronous export when measurement shows the synchronous path materially affects shared service capacity.

## `finance.xlsx-sparse-row-index`

**Title:** Sparse XLSX row indices may increase parser work beyond the nonblank-row limit.

**Boundary:** A small authenticated upload should not cause work proportional to an attacker-selected row index rather than the number of rows accepted.

**Source trace:** `server/routes/finance.js:162` caps upload bytes, `server/finance/spreadsheet.js:12-16` caps upload and expanded workbook bytes and declares a nonblank data-row cap, and `server/finance/spreadsheet.js:190-200` iterates from row one through `worksheet.rowCount`.

**Dependency evidence:** The installed, lock-matching ExcelJS 4.4.0 source stores rows by parsed worksheet index and derives `rowCount` from the sparse row array length.

**Blocker:** No bounded workbook fixture was parsed, so the real time and memory effect of a high sparse index is unknown.

**Local plan:** In the required sandbox, use a minimal workbook with a header and one populated row at a high but valid worksheet index, compare it with a two-row workbook, enforce low CPU and memory limits, and stop at the first material difference.

**Smallest likely source fix:** Reject row indices outside the supported spreadsheet range and enforce a total row-index span before iterating.

## `mobile.denial-keeps-memory-records`

**Title:** Mobile authorization failures clear persistent cache but retain in-memory records.

**Boundary:** After sign-in expires or organization access is denied, the mobile UI should not continue showing protected cached records.

**Source trace:** `mobile/lib/data/app_repository.dart:226-237` clears persistent scope cache on 403 and all persistent cache and tokens on 401, but does not clear the repository's in-memory record lists in those branches.

**Additional evidence:** `mobile/lib/screens/overview_screen.dart:23-25` reads members, tasks, and announcements directly from the repository, and protected screens do not gate those reads on `hasAccessToScope`.

**Blocker:** No widget or device flow was run to verify whether the application continues to render retained records after the denied request.

**Local plan:** In the required sandbox with dummy accounts and synthetic records, load protected data, trigger one 401 and one 403 in separate runs, and observe whether protected screens continue to render the in-memory records after each response.

**Smallest likely source fix:** Clear or scope-gate protected in-memory state on 401 and 403, and route the user to sign-in or an allowed organization before rendering protected screens.

## `overview.archived-org-active-membership`

**Title:** A scoped overview request checks active membership without checking organization status.

**Boundary:** A non-Owner should receive overview data only for an organization that is active and for which the user has active membership.

**Source trace:** `server/routes/organizations.js:44-53` checks a non-Owner's active membership for the requested scope, and `server/routes/organizations.js:135-205` loads organization-scoped metrics, tasks, and announcements using that scope.

**Additional evidence:** `server/routes/organizations.js:21-28` and `server/auth/service.js:186` filter non-Owner organization lists by active organization status, while `db/migrations/001_initial_schema.sql:29-39` permits organization and membership statuses to vary independently.

**Blocker:** The repository does not show an organization archive transition, so a supported application state with an archived organization and active membership is not established.

**Local plan:** In the required sandbox, use the checked-in schema and dummy records to create an archived organization with an active non-Owner membership, then request the scoped overview and stop at the first response containing the synthetic records or an access denial.

**Smallest likely source fix:** Join the membership check and scoped overview queries to the organization row and require active organization status if archived organizations must be inaccessible.

## `scripts.test-restore.environment-selected-target`

**Title:** The restore check can drop a fixed database on an environment-selected PostgreSQL server.

**Boundary:** A test or restore utility must not destroy a shared or production database selected by environment configuration.

**Source trace:** `scripts/test-restore.js:12-22` allows `PGHOST` and `PGPORT` overrides, `scripts/test-restore.js:66-71` uses them for the maintenance connection, and `scripts/test-restore.js:103-117` drops and recreates `pipeline_restore_test` on that server.

**Additional evidence:** The package script invokes the utility for backup and restore verification, and source does not validate that an override still points to a disposable local database.

**Blocker:** Neither control of these environment variables by a lower-trust caller nor the presence and grants for a shared server database with this fixed name are established by repository source.

**Local plan:** In the required sandbox, create an isolated disposable loopback PostgreSQL instance with a synthetic database named `pipeline_restore_test`, point only the fixture process at that instance, and observe whether the script's drop and recreation are limited to the fixture.

**Owner check:** Have the owner inspect the effective runner `PGHOST`, `PGPORT`, server identity, and database-role grants without connecting to or modifying a shared server.

**Smallest likely source fix:** Require an explicit disposable target identity and fail closed for remote hosts or unexpected database names before issuing destructive SQL.

## `tasks.comment-history-unbounded`

**Title:** Comment writes accumulate two unbounded history streams.

**Boundary:** One authorized organization member should not be able to make shared reads and storage disproportionately expensive through repeated comments.

**Source trace:** `server/routes/tasks.js:154-176` accepts comment writes with a bounded body, `server/tasks/service.js:632-685` stores each comment and a second activity record, and `server/tasks/service.js:608-626` and `server/tasks/service.js:809-824` read complete histories without a limit or cursor.

**Additional evidence:** Task and comment queries are organization-scoped, and the application has a global default request-rate limit, so the unresolved issue is measurable resource impact rather than an authorization bypass.

**Blocker:** No database or response-size measurement was run for synthetic histories, and the real shared-service impact is unknown.

**Local plan:** In the required sandbox, create a small synthetic task with gradually increased comment and activity histories, call the real list functions, and record query duration and response size under strict process and database limits.

**Smallest likely source fix:** Add bounded pagination to both history readers and consider a retention or per-task comment quota only if measurements show it is needed.

## `web.stored-display-name-html-injection`

**Title:** A stored member display name reaches a task-create HTML template without escaping.

**Boundary:** A member must not cause attacker-controlled markup to be interpreted in another organization's Lead or Owner browser session.

**Source trace:** `server/routes/members.js:146-163` accepts self-service profile changes, `server/members/service.js:591-639` stores the trimmed display name without HTML encoding, `server/members/service.js:99-147` returns names in the member list, and `web/js/app.js:690-715` interpolates the name into an option template parsed with `insertAdjacentHTML`.

**Additional evidence:** `web/js/app.js:72` copies member records into application state, and the independent sibling-sink pass found other raw profile/navigation sinks limited to the account holder's own data while the other reviewed persisted display templates use escaping.

**Blocker:** No browser reproduction established whether the select/option fragment permits active markup or event execution, and the required sandbox was unavailable.

**Local plan:** In the required sandbox with dummy Member and same-organization Lead accounts, store a short benign markup/event marker in the Member display name, load members in the Lead session, open New task, and stop at the first active markup node or benign event result.

**Smallest likely source fix:** Build the option element and set the display name through `textContent`, or apply context-correct HTML escaping before parsing.
