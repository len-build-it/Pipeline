# Pipeline Organization Manager MVP

The AqOne and Dev Guild Organization Manager MVP provides a shared multi-organization dashboard, member management, task tracking, announcements, and an Android mobile companion with secure offline reads.

## Architecture

- **Backend:** Fastify (Node.js v24) with pure PostgreSQL 18 persistence, serialized JWT refresh rotation, CSRF validation, and scoped authorization.
- **Web Frontend:** Vanilla modern ES modules, responsive semantic HTML, high-contrast light theme, accessible modal dialogs, and zero frontend framework dependencies.
- **Android Mobile:** Flutter (Dart 3.12) supporting minSdk 24 through targetSdk 37, light theme, 48px touch targets, encrypted token storage, 512 KiB cached read snapshots, and honest stale-data indicators.

## Local setup and prerequisites

- Node.js v24.14.0 or later.
- PostgreSQL 18.x running locally on port 5433 (or configured via environment variables).
- Flutter 3.44.7 or later with Android SDK and emulator.
- Microsoft Edge or Chromium for Playwright test execution.

## Database initialization

Initialize and migrate the local PostgreSQL databases:

```bash
# Migrate development database
npm run db:migrate

# Migrate dedicated test database
npm run db:migrate:test

# Seed deterministic initial accounts and data
node db/seed.js
```

### Seed accounts and bootstrap credentials

All seed users have the initial password `password123456`:

| User | Email | Global Role | AqOne Role | Dev Guild Role |
| --- | --- | --- | --- | --- |
| Len | len@example.com | Owner | Lead | Lead |
| Alex Rivera | alex@example.com | - | Lead | Member |
| Jordan Lee | jordan@example.com | - | - | Lead |
| Sam Taylor | sam@example.com | - | Member | Member |

## Running the application

### Web application

Start the production-configured Fastify server:

```bash
npm start
```

Access the application in your browser at `http://127.0.0.1:3000/`.

To run the loopback demo mode with synthetic data and visible demo badges:

```bash
npm run demo
```

### Mobile application

The compiled debug APK is located at:
`mobile/build/app/outputs/flutter-apk/app-debug.apk`

To run the Flutter app on a running Android emulator:

```bash
cd mobile
flutter run
```

On the Android emulator, the app automatically communicates with the host API at `http://10.0.2.2:3000/api`.

## Verification commands

Run all local verification suites from the project root:

```bash
# JavaScript syntax and static asset reference verification
npm run check

# Full backend integration test suite (102 tests: auth, members, tasks, announcements)
npm test

# Synthetic UI Playwright tests (8 responsive, navigation, accessibility scenarios)
npm run test:ui

# Integrated E2E Playwright test against real Fastify server and PostgreSQL database
npm run test:e2e

# Dashboard load performance benchmark (20 warm loads with 100ms simulated latency; p95 target <= 2.0s)
npm run test:performance

# Backup and restore verification into a separate disposable database
npm run test:restore
```

Run Flutter mobile checks in `mobile/`:

```bash
cd mobile
flutter analyze
flutter test
flutter build apk --debug
```

## Backup and restore procedures

### Local database backup

```bash
pg_dump -h 127.0.0.1 -p 5433 -U postgres -d pipeline_dev -F p -f backup.sql
```

### Local database restore

```bash
psql -h 127.0.0.1 -p 5433 -U postgres -d pipeline_restore -f backup.sql -v ON_ERROR_STOP=1
```

Verify table counts, foreign keys, active memberships, and activity events after restore.

## Service configuration

The server is configured via environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port for the HTTP server |
| `HOST` | `127.0.0.1` | Host address (set to `0.0.0.0` for emulator access) |
| `DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/pipeline_dev` | PostgreSQL database connection string |
| `TEST_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/pipeline_test` | Dedicated test database URL |
| `JWT_SECRET` | Auto-generated or custom string | Secret for signing JWT access tokens (minimum 32 chars) |
| `COOKIE_SECRET` | Auto-generated or custom string | Secret for cookie signing (minimum 32 chars) |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`) |

Cleartext HTTP networking is permitted exclusively in the Android debug manifest for emulator testing (`10.0.2.2`).
Production deployments require HTTPS.

## Pending external release checks

The following checks remain pending Len's explicit authorization and production environment provisioning:

1. Physical Android device validation across screen sizes and hardware vendors.
2. Real Safari browser testing on macOS and iOS hardware.
3. Production HTTPS hosting, domain DNS, and TLS certificate deployment.
4. Production SMTP email delivery provider configuration and verification.
5. Automated cloud backup schedules, retention enforcement, and offsite storage.
6. Android release keystore signing and Google Play Store distribution.
