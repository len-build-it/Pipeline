# Architecture: AqOne and Dev Guild Manager

Created: 2026-09-16T21:15:03+08:00
Updated: 2026-09-16T21:54:37+08:00
Revision: 2
Status: Draft

## Observed facts and assumptions

The repository currently contains project rules, skills, and documentation templates, but no application code, database, or existing service contract.

Len requested both a web dashboard and a Flutter native app.

Len currently leads AqOne and the dev guild.

No hosting provider, identity provider, or existing backend was specified.

The approved proposal is online-first, Android-first, email-based accounts with invite links, one shared backend, and one shared database.

The following implementation choices are proposed defaults and are not evidence of an existing stack.

## Components, boundaries, and flows

The web client is a responsive browser application for desktop and tablet use.

The Flutter client is an Android application that calls the same backend API.

The backend API authenticates users, validates request data, enforces organization and role permissions, and exposes organization-scoped resources.

PostgreSQL is the source of truth for users, organizations, memberships, invitations, tasks, comments, announcements, and activity events.

An email delivery service sends account invitations and account access messages through a provider-neutral adapter.

The web and mobile clients never connect directly to the database.

The normal flow is client request, authenticated API validation, permission check, database transaction, activity event, and response.

The API must reject organization identifiers that the authenticated user cannot access, even when a client sends a forged identifier.

The owner can view both organizations and organization leads are restricted to their assigned organizations.

## Decisions and trade-offs

### Council review

Devil's advocate: a separate web backend and mobile backend would duplicate authorization and create inconsistent behavior.

Simplicity: one modular backend and one database are sufficient for two organizations and avoid premature microservices, synchronization jobs, and duplicated domain logic.

Security and reliability: clients are untrusted, so authentication, validation, authorization, and transaction boundaries belong in the backend, with database constraints enforcing relationships.

Architecture: a modular monolith keeps members, tasks, and announcements separated in code while preserving one deployable service and one source of truth.

The Council synthesis is to use one backend API with PostgreSQL and two thin clients, with organization-scoped authorization at the API boundary.

The main trade-off is that a single service creates a shared deployment failure domain, which is acceptable for the initial scale and can be revisited if uptime or team size requires independent services.

The backend should use a conventional HTTP JSON API.

Authentication should use server-managed password hashes, short-lived access tokens, and revocable refresh sessions unless the selected hosting environment provides an equivalent managed identity service without weakening organization authorization.

Invite links should be single-use, expiring, and bound to the invited email address.

Activity events should be written in the same transaction as the business change where practical.

## Proposed execution baseline

These choices resolve implementation questions for the coordinated plan and remain proposals until that approval package is accepted.

Use Node.js 24, Fastify 5, and PostgreSQL 18 for one service that serves the web assets and the shared JSON API under the same origin.

Build the web client with semantic HTML, CSS, and native JavaScript modules using fetch and browser navigation.

Use Flutter 3.44.7 with the bundled Dart 3.12.2, Material widgets, Navigator, and ChangeNotifier or local widget state for Android.

Do not add a web framework, ORM, state-management package, custom component framework, or background job service for this scope.

Use SQL migrations and parameterized queries with pg, with a transaction-scoped client for related writes and activity records.

The permitted direct runtime packages proposed for approval are fastify, @fastify/static, @fastify/cookie, @fastify/jwt, @fastify/rate-limit, pg, and nodemailer.

The permitted web test dependency is @playwright/test.

Local development infrastructure additionally includes Mailpit for SMTP capture, Playwright browser binaries, and PostgreSQL 18; these are proposed as part of the same approval package.

The permitted Flutter packages are http and flutter_secure_storage, plus Flutter SDK test and integration_test libraries and the official flutter_lints development package.

Approval covers compatible stable versions of this named set and their required transitive dependencies; the executor resolves exact versions once, commits generated lockfiles, and records versions in verification evidence.

Additional direct dependencies or major stack substitutions require approval.

Use Node's asynchronous scrypt password hashing with a unique random salt, recorded parameters, constant-time verification, and a resource limit appropriate to the selected cost.

Use scrypt N=131072, r=8, p=1, a random salt of at least 16 bytes, a 64-byte derived key, and maxmem of at least 256 MiB; measure login latency and memory before release without silently reducing the cost.

JWT access tokens expire after 15 minutes and carry a server session identifier; every protected request also checks the live session and account state and looks up current organization permissions.

Use random opaque refresh tokens stored as digests in PostgreSQL, rotated atomically on use, with seven-day absolute session expiry and revocation on sign out.

A reused rotated refresh token revokes its session; clients serialize refresh requests and retry a rejected access token only once.

The web client keeps access tokens in memory and the refresh token in a Secure, HttpOnly, SameSite=Strict cookie in production.

Cookie-authenticated session endpoints require a matching allowed Origin and a CSRF token; same-origin web requests do not require permissive CORS.

The Android client stores refresh credentials with flutter_secure_storage and keeps the access token in memory.

Use nodemailer SMTP transport with a local mail capture service during development; keep credentials and real invitation delivery out of tests and logs.

Email failure preserves a pending invitation with delivery failure feedback, and explicit retry rotates the invitation token without creating duplicate memberships.

The app is packaged for one generic Node service and PostgreSQL database; choosing a paid host, sending real invitations, production deployment, and app-store distribution are separate release actions.

## References checked for this proposal

Fastify provides schema-based input validation and response serialization, so the project can use its built-in facilities: [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).

The plugin compatibility references are [JWT](https://github.com/fastify/fastify-jwt), [cookies](https://github.com/fastify/fastify-cookie), [static assets](https://github.com/fastify/fastify-static), and [rate limits](https://github.com/fastify/fastify-rate-limit).

Storage and transport references are [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html), [pg transactions](https://node-postgres.com/features/transactions), [SMTP](https://nodemailer.com/smtp), [Flutter HTTP](https://pub.dev/packages/http), and [Flutter secure storage](https://pub.dev/packages/flutter_secure_storage).

## Open questions and approval

Hosting provider and production credentials are deferred release choices, not prerequisites for local implementation.

This revision proposes the stack and dependency authorization together so execution can proceed without repeated package-selection questions.

Exact approval of this revision is pending against the document revision rather than the earlier proposal message.
