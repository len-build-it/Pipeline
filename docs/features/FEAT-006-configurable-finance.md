# FEAT-006: Configurable team finance and spending transparency

Created: 2026-10-03T21:54:00+08:00
Updated: 2026-10-03T22:31:00+08:00
Revision: 2
Status: Approved

## Purpose and success

Small teams need one transparent place to plan budgets, record internal spending, review trends, and share consistent records with an accountant.

Success means any active member can see the same organization-scoped financial information, record or import spending, understand budget performance, and export a usable Excel workbook.

## Scope and non-goals

This feature adds organization-scoped monthly budgets, actual expense records, CSV and XLSX import, XLSX export, and budget and spending analytics.

Every active member has the same read, create, edit, import, export, and void permissions for finance records in their organization.

Financial changes remain visible to all active members with the actor, time, and changed financial values recorded in the activity history.

The first release uses Philippine peso (PHP) only. Amounts support centavos and are stored and calculated exactly.

The app remains one configurable product for Len's teams. Existing organization records supply organization names and IDs; clients and business rules must not branch on the names or assume exactly two organizations.

CSV and XLSX transfers are available in the web client. Finance records and analytics are available in the web and Android clients. Finance data is online-only in the first release and is not added to the Android offline cache.

The feature prepares records for an accountant but is not a formal accounting ledger. It excludes double-entry bookkeeping, tax calculation or filing, bank feeds, payment processing, accounts payable, receipt attachments, exchange-rate conversion, and direct accounting-platform integrations.

Organization creation, renaming, and archival UI are excluded. Organization names continue to come from configured database records and are rendered dynamically.

## User flows

An active member opens Finance within an organization, reviews its monthly budgets and actual expenses, and filters by period or category.

A member records an expense with its date, category, description, amount in PHP, and optional vendor or reference.

A member imports a CSV or XLSX workbook, maps supported columns, reviews valid rows, validation errors, and possible duplicates, then confirms the import.

A member exports a workbook for an organization and date range. The workbook includes a summary and a detailed expense register, with organization, currency, filters, and generation time identified.

A member reviews a budget report that compares budget with actual spending and shows remaining or exceeded amounts, category distribution, and monthly trends.

The system presents clear loading, empty, error, permission-denied, conflict, import-preview, import-result, and offline states. Offline finance actions are rejected without queuing or claiming success.

## Requirements and acceptance criteria

| ID | Required behavior | Observable pass/fail criterion |
| --- | --- | --- |
| REQ-001 | Use organization data generically. | Web and Android clients display organization names returned by the API, correctly render three or more arbitrary organization records, and contain no name-to-ID mapping for AqOne or Dev Guild. |
| REQ-002 | Enforce organization scope. | A member can access finance records only for active organizations where they have an active membership; forged organization IDs are denied on every finance API route. |
| REQ-003 | Share finance access with all members. | Owner, Lead, and Member accounts with active organization access can view, create, edit, import, export, and void financial records without role-specific restrictions. |
| REQ-004 | Record expenses. | A member can create and edit a positive PHP expense with a date, category, description, optional vendor and reference; invalid amounts, dates, or fields are rejected without partial writes. |
| REQ-005 | Define monthly budgets. | A member can set or update one PHP budget per organization, month, and category; duplicate periods/categories are prevented and all changes are recorded. |
| REQ-006 | Preserve a visible change history. | Expense and budget creation, edits, imports, and voids show actor, timestamp, and allowlisted changed financial values to every active member; records are voided rather than permanently deleted. |
| REQ-007 | Import CSV and XLSX safely. | A member can preview row-level validation and duplicate warnings before confirmation; any invalid row blocks the whole batch, and duplicate candidates require one explicit skip-all or include-all choice for the batch before an atomic commit; confirmation resubmits the file and the server fully revalidates it. |
| REQ-008 | Export an accountant-ready workbook. | A member can download a valid XLSX workbook with summary and expense-detail sheets, accurate PHP values, filters and period, and no formulas derived from imported text or macros. |
| REQ-009 | Report budget performance. | For a selected organization and month, totals reconcile to stored records and show budget, actual, remaining/over-budget, and category comparisons. |
| REQ-010 | Show spending trends and a forecast. | The report shows monthly actual spending and a clearly labeled month-end run-rate estimate when enough current-month data exists; the displayed estimate matches the documented calculation and rounding rule to the centavo and is identical on web and Android. |
| REQ-011 | Keep web and Android finance workflows usable. | Members can view and manage budgets and expenses in both clients; spreadsheet upload/download is provided on web and clearly signposted as a web workflow from Android. |
| REQ-012 | Handle recoverable states. | Empty, loading, failed, denied, stale-edit, import-validation, and offline states explain the outcome and preserve user input where retry is safe. |
| REQ-013 | Preserve existing product behavior. | Existing authentication, member, task, announcement, organization isolation, accessibility, and offline-read checks continue to pass. |

## Data and interfaces

Use the existing Organization and Membership ownership model and `activity_events` history.

Budget records are organization-owned and identified by organization, calendar month in Asia/Manila, and a trimmed free-text category of 1 to 60 characters. Categories are matched case-insensitively and suggested from existing records. Expense records are organization-owned and include occurred date in Asia/Manila, amount in integer centavos, currency code `PHP`, category, description, optional vendor/reference, source (`manual` or `import`), optional import batch and source row, creator/updater, void time, and timestamps.

Persist one currency per first-release record as `PHP`. Amounts must be positive and no greater than PHP 999,999,999.99; serialize money across API boundaries as decimal strings to avoid JavaScript floating-point arithmetic. Perform sums and comparisons using exact integer-centavo arithmetic. Expense dates cannot be in the future because future commitments are out of scope.

Import fields are date, amount, category, description, optional vendor, and optional reference. XLSX formula cells are rejected for imported financial fields.

An import row is a duplicate candidate when a non-void expense in the same organization, or an earlier row in the same file, has the same occurred date, the same amount in centavos, the same category compared case-insensitively after trimming, and the same reference compared case-insensitively after trimming, where a blank reference matches only a blank reference.
Description and vendor do not affect duplicate detection.
Duplicate candidates are shown in the preview, and the member makes one skip-all or include-all choice for the batch.

The web client sends the file as the raw request body with its CSV or XLSX content type, and the server reads it with a route-level body limit of 5 MiB and rejects larger bodies with HTTP 413.
No multipart parser or additional dependency is used.
The preview request parses and validates the file and stores nothing on the server.
The confirm request resubmits the same file with the duplicate choice, and the server parses, validates, and detects duplicates again before committing every accepted row in one transaction or none.

The month-end run-rate estimate is calculated once on the server for the current Asia/Manila month only, as month-to-date non-void actual centavos multiplied by the days in the month and divided by the elapsed calendar days including today.
The result is rounded half up to the nearest centavo using exact integer arithmetic, and both clients display the server value without recalculating it.

The XLSX adapter is proposed to use `exceljs` 4.4.0 for reading and writing XLSX and CSV. This is a new direct dependency and requires Len's explicit approval under the current architecture constraints.

## Quality constraints

All reads and writes are scoped and authorized on the server; client-supplied organization IDs are never trusted as proof of access.

Money calculations must be exact to one centavo. Budget and analytics totals must reconcile to the same expense query used by the expense register.

File imports have a bounded upload size and row count, validate MIME/type and workbook structure, reject formulas in financial input cells, block commit if any row is invalid, and show errors before committing. Duplicate candidates require an explicit skip-or-include choice. The proposed limits are 5 MiB and 5,000 rows per file.

The row limit is enforced while the file is being parsed: only the first worksheet is read, and parsing aborts with a validation error as soon as a row beyond the 5,000th data row is encountered, so a small compressed workbook cannot expand into unbounded work.

Exports contain only records within the selected organization and filters. Text cells are written as literal text, and the workbook contains no macros or formulas based on user-controlled text.

Web interactions remain keyboard accessible and responsive. Android controls retain minimum 48 logical-pixel targets and TalkBack labels. Charts have visible numeric labels and an equivalent data table; color alone never communicates status.

## Decisions and assumptions

Confirmed by Len in chat on 2026-10-03: this is for Len's own teams, not a separate customer-facing organization; financial data is transparent to all team members; PHP is the intended initial currency; the records should be exportable for later formal accounting; the accounting platform is not selected.

Proposed for approval: active members have equal finance permissions; finance changes are auditable and records are voided rather than deleted; budgets are monthly; actual expenses exclude commitments and unpaid bills; analytics use actual expenses only; month-end forecast equals month-to-date actual divided by elapsed calendar days times days in the month.

Proposed for approval: organization agnosticism means removing fixed organization names and cardinality assumptions while continuing to use configured organization rows; it does not add organization-management UI or multi-customer tenancy.

Proposed for approval: XLSX import/export uses the existing Node backend and the single new direct dependency `exceljs@4.4.0`; spreadsheet transfer controls live on web while financial records and reports are available on Android.

Len approved in chat on 2026-10-03 the council recommendations to define duplicate candidates, the run-rate rounding rule, the raw-body upload mechanism, the stateless preview and revalidating confirm, and parse-time row limits.

The accountant-ready workbook is a neutral handoff format. Its column mapping can be revised when an accountant or accounting platform supplies a target format.

## Open questions and readiness

No open questions block implementation.

Revision 2, including the items marked proposed above, `exceljs@4.4.0`, the upload limits, and the batch-level duplicate choice, was approved by Len in chat on 2026-10-03T22:31:00+08:00: "Yes I approve of the revisions".
That reply answered a request that named FEAT-006 revision 2, PLAN-002 revision 3, the other draft revisions listed in `HANDOFF.md`, and `exceljs@4.4.0`.
