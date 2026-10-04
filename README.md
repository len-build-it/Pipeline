# Team Manager

Team Manager gives Len's teams one place for a shared dashboard, member management, task tracking, announcements, and team finance, with an Android companion app.
Organization names and their number come from database records; the seed data creates AqOne and Dev Guild.

## Architecture

- **Backend:** Fastify (Node.js v24) with pure PostgreSQL 18 persistence, serialized JWT refresh rotation, CSRF validation, and scoped authorization.
- **Finance module:** `server/finance/` keeps money rules, use cases, SQL, and spreadsheet handling in separate files; amounts are integer centavos in PostgreSQL and decimal strings in the API.
- **Web Frontend:** Vanilla modern ES modules, responsive semantic HTML, high-contrast light theme, accessible modal dialogs, CSS and SVG charts, and zero frontend framework dependencies.
- **Android Mobile:** Flutter (Dart 3.12) supporting minSdk 24 through targetSdk 37, light theme, 48px touch targets, encrypted token storage, 512 KiB cached read snapshots, honest stale-data indicators, and online-only Finance.

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

## Finance

Finance is available to every active member of an organization, whatever their role: Owner, Lead, and Member can all view, record, edit, void, import, and export.
The currency is PHP only, amounts are exact to the centavo, and every change is recorded in a history that all members of the organization can read.
Expenses are voided, never deleted; a void expense stays in the register and leaves every total.

### Web workflow

1. Sign in with a real account (Finance is not part of the demo data) and choose an organization.
2. Open **Finance**. The budget report shows budget, actual spending, remaining or over-budget amount, and a month-end estimate for the current month.
3. **Set budget** creates one budget per month and category; **Record expense** adds actual spending dated today or earlier.
4. **Import spreadsheet** previews every row before anything is saved; **Export XLSX** downloads the expenses matching the current date and category filters.

The month-end estimate is month-to-date actual spending multiplied by the days in the month and divided by the elapsed days including today, rounded half up to the centavo.
It is calculated on the server and labeled as an estimate in both clients.

### Spreadsheet import

- Accepted files: `.csv` (UTF-8) and `.xlsx`, up to 5 MiB and 5,000 data rows; only the first worksheet is read.
- Required columns in the first row: `Date`, `Amount`, `Category`, `Description`. Optional columns: `Vendor`, `Reference`. Other columns are ignored and listed in the preview.
- `Date` is `YYYY-MM-DD` text or a date cell and cannot be in the future. `Amount` is a plain positive number with at most two decimals, such as `1250.50`, without currency symbols or thousands separators.
- Formula cells in these columns are rejected. A workbook that expands beyond 20 MiB when unpacked is refused.
- Any invalid row blocks the whole file; nothing is imported until every row is valid.
- A row is a possible duplicate when a stored non-void expense, or an earlier row in the file, has the same date, amount, category, and reference. Choose to skip all possible duplicates or import them all.
- **Download template** in the import dialog gives an empty workbook with the expected header row.

### Workbook export

The exported workbook has an `Expenses` sheet (date, category, description, vendor, reference, amount, source, recorded by, last changed by, last changed at, expense ID) and a `Summary` sheet (organization, currency, period, category filter, generation time in Asia/Manila, count, total, and totals by category and month).
Void expenses are excluded. All text is written as literal text, and the workbook contains no formulas or macros.
It is a neutral handoff format for an accountant, not a formal ledger; there is no tax calculation or double-entry bookkeeping.

### Android

Finance opens from the **Finance: budgets and expenses** button on Overview or from the account menu; the bottom bar keeps four destinations.
Sign in from the account menu first. Budgets, expenses, the report, and recent changes are available; spreadsheet import and export are web-only.
Finance on Android needs a connection: records are never cached on the device and offline changes are refused, not queued.

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

# Full backend integration test suite (auth, members, tasks, announcements, finance)
npm test

# Finance suite alone (money rules, budgets and expenses, import, export, analytics)
npm run test:finance

# Synthetic UI Playwright tests (responsive, navigation, accessibility scenarios)
npm run test:ui

# Integrated E2E Playwright tests against real Fastify server and PostgreSQL database, including Finance
npm run test:e2e

# Dashboard load performance benchmark (20 warm loads with 100ms simulated latency; p95 target <= 2.0s), plus finance report timings
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

To check the Android client against a running local server on the seeded test database:

```bash
cd mobile
FINANCE_LIVE_API=http://127.0.0.1:3000/api flutter test test/finance_live_test.dart
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
| `RATE_LIMIT_MAX` | `200` | Requests allowed per client address per minute, static files included |

Cleartext HTTP networking is permitted exclusively in the Android debug manifest for emulator testing (`10.0.2.2`).
Production deployments require HTTPS.

## Known limitations

- Finance records PHP only and is not a formal accounting ledger; there is no tax, payables, bank feed, or accounting-platform integration.
- Spreadsheet import and export are web-only, and Android Finance is online-only.
- The web demo mode and the Android demo data contain no finance records; Finance requires a real sign-in.
- On Android, creating or changing members, tasks, and announcements still calls routes the server does not serve; reading them and all of Finance use the real routes.
- `npm audit` reports advisories for `@fastify/static`, `nodemailer`, and `uuid` (through `exceljs`); the suggested fixes are breaking upgrades that have not been authorized.

## Pending external release checks

The following checks remain pending Len's explicit authorization and production environment provisioning:

1. Physical Android device validation across screen sizes and hardware vendors.
2. Real Safari browser testing on macOS and iOS hardware.
3. Production HTTPS hosting, domain DNS, and TLS certificate deployment.
4. Production SMTP email delivery provider configuration and verification.
5. Automated cloud backup schedules, retention enforcement, and offsite storage.
6. Android release keystore signing and Google Play Store distribution.
