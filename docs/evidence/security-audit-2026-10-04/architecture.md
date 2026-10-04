# Architecture summary

Audit run: 2026-10-04-pipeline-security-audit.

Run profile: standard, full repository source and configuration review.

Source ref: c274031267191c380098189775736e3189135874 on codex/organization-manager-mvp; the worktree was clean at audit start.

No prior compatible audit run was found before this run.

## Product and principals

Pipeline is a small team manager for a global Owner, organization Leads, and organization Members. It stores accounts, memberships, tasks, comments, announcements, activity, budgets, and expenses in one PostgreSQL database. The web client and Flutter Android client call one Fastify JSON API. The Owner can cross organization boundaries; other users are scoped by active membership. Finance intentionally permits all active organization members to read and change finance records.

Lower-trust principals include unauthenticated Internet callers if the service is deployed and reachable, ordinary organization members, invitation-link holders, web content authors, uploaded spreadsheet authors, mobile-device users, and anyone with local access to an operator's CLI or device. Main protected resources are owner accounts, session signing and refresh credentials, membership and invitation state, organization records, and local account caches.

## Components and trust boundaries

server/index.js starts the API, server/app.js registers Fastify plugins and routes, and server/config.js loads deployment settings. server/app.js serves web/ and mounts auth, organization, member, task, announcement, and finance route families. Services make role and organization decisions; db/client.js provides parameterized PostgreSQL queries and transactions; db/migrations/*.sql define the relational constraints.

server/demo.js is a separate static demo server bound to loopback. It does not register the real API. The web application is vanilla HTML/CSS/ES modules. The Android client uses Flutter, stores credentials with flutter_secure_storage, and has a bounded secure offline cache for read-only snapshots.

Trust boundaries include unauthenticated-to-authenticated access; Owner-only combined organization overview and member-scoped organization records or aggregates; Owner-to-organization and member-to-resource authorization; cookie-based refresh and CSRF; invitation bearer tokens to membership creation; HTTP input to SQL and spreadsheet parsers; stored record content to browser DOM; mobile credentials and cache across login/logout/account switches; and build/dependency inputs to any release artifact.

Strong source-visible controls include scrypt password hashes, random token generation, SHA-256 digests for refresh/invitation tokens, a database session-revocation check when a JWT contains a session ID plus an active-account check on authenticated requests, current database owner/membership checks, parameterized SQL, finance and spreadsheet request bounds, formula rejection in spreadsheets, and secure mobile credential storage with cache account/scope checks.

## Local validation and deployment visibility

Source-only reconnaissance was completed. Docker CLI is present, but the Docker Engine named pipe is unavailable. The execution environment does not provide an OS-enforced empty environment, network isolation, read-only target/toolchain, scratch-only writes, or explicit resource ceilings. No target-controlled builds, tests, app processes, browsers, migrations, database clients, emulators, or dependency installation were run.

Integration and E2E tests mutate a local PostgreSQL test database and write screenshots. A restore script drops/recreates a database and writes a SQL dump. The handoff also records a shared PostgreSQL test cluster. These paths were not invoked.

No hosting, reverse proxy, CI, container, cloud, or production deployment manifests were found. Production host exposure, TLS termination, secret injection, database roles, SMTP, backup policy, release signing, and distribution cannot be inferred from this repository. server/services/email.js is an in-memory capture implementation and does not send through Nodemailer.

## Coverage companions selected

The audit selects WEB-PROTOCOL-AND-AUTH.md for JWT, CSRF, cookie transport, and invitation identity; DATA-ISOLATION-AND-LIFECYCLE.md for organization scope, aggregate oracles, and stale copies; CLIENT-SIDE.md for DOM rendering; DESKTOP-MOBILE-AND-LOCAL-IPC.md for mobile cache and lifecycle; RESOURCE-EXHAUSTION-AND-AVAILABILITY.md for authentication/import resource bounds; SUPPLY-CHAIN-AND-RELEASE.md for dependency reachability; and CLOUD-AND-DEPLOYMENT.md for production secret, bootstrap, signing, and distribution visibility.

There is no source-visible OAuth/OIDC, SAML, MFA, browser service worker, WebSocket, cloud IAM, queue/broker, native IPC service, or release automation. These attack classes are not applicable to the checked-in source; external deployment and distribution remain unobserved.
