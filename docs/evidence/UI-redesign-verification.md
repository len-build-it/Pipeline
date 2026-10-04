# Lagoon UI redesign verification

Recorded: 2026-10-04T20:31:10+08:00.

Approval: PROD-005 revision 4 and PLAN-003 revision 1 were approved by Len in chat on 2026-10-04T16:19:21+08:00.

## Automated checks

The web gates ran on 2026-10-04 after the web redesign changes; exact command start times were not retained in the session log.

| Command | Result | Environment and scope |
| --- | --- | --- |
| `npm test` | 122 of 122 passed. | Node test suite, including existing Finance behavior. |
| `npm run test:ui` | 13 of 13 passed in 42.4 seconds. | Headless Microsoft Edge through Playwright 1.63.0. |
| `npm run test:e2e` | 13 of 13 passed in 56.2 seconds. | Headless Microsoft Edge with an isolated PostgreSQL 18 test cluster bound to `127.0.0.1:5433`. |
| `npm run test:performance` | Passed; overall p95 was 126.11 ms and Finance p95 was 126.43 ms, below the 2 second limit. | Local test database and API. |
| `flutter analyze` | No issues found. | Flutter 3.44.7, from `mobile/`, at 2026-10-04T20:30:40+08:00 through 20:30:44+08:00. |
| `flutter test` | 54 passed and one existing live API test skipped because `FINANCE_LIVE_API` was unset. | Flutter 3.44.7, from `mobile/`, passed at 2026-10-04T20:31:00+08:00. |
| `flutter build apk --debug` | Passed. | Flutter 3.44.7, from `mobile/`, passed at 2026-10-04T20:31:10+08:00. |

The web responsive suite covered 375 by 667, 768 by 1024, 1024 by 768, and 1440 by 900 CSS-pixel viewports without page-level horizontal overflow.

Keyboard journeys checked the web navigation, visible focus, filter controls, details, Finance report and register, and spreadsheet import recovery.

The E2E screenshots overwritten by the browser runs were restored from their backups and checked byte-for-byte.

## Contrast check

A luminance calculation checked 34 pairings of primary or muted text against the 17 approved semantic and page fills.

All sampled text pairs met 4.5:1; the primary text on the primary action fill measured 5.36:1.

The approved focus color `#1E40AF` had a minimum 5.85:1 ratio across the checked fills.

The approved control border `#5B7B80` had a minimum 3.07:1 ratio across the checked fills.

The status foregrounds measured 7.27:1 for primary hover on surface, 11.19:1 for text on lime, 6.80:1 for danger, 6.37:1 for warning, 7.15:1 for info, 6.49:1 for success, and 8.40:1 for neutral.

These calculations cover the approved light-theme token pairs exercised by the check; they do not replace assistive-technology or device testing.

## Browser and Android scenarios

The web Overview, Members, Tasks, Announcements, Finance, and import flows were inspected at the four responsive widths above.

The Android build was installed on the `Medium_Phone` AVD (`sdk gphone16k_x86_64`), Android 17/API 37, at 1080 by 2400 pixels and 420 dpi.

Android screens were inspected at system font scales 1.0 and 2.0, including Overview, Members, Tasks, Announcements, Finance, the expense form, a failed expense save, and offline Tasks.

At 2.0 scale, the adaptive action controls remained reachable and the offline banner wrapped with Retry still visible.

The authenticated offline cache scenario used the isolated `pipeline_test` database on `127.0.0.1:5433` and a temporary local API on port 3000.

The emulator loaded Members, Tasks, and Announcements from the API, the API was stopped, and Refresh caused cached reads to appear with age `Just now`, a Retry action, and a read-only explanation.

After the API restarted, tapping Retry fetched `/api/auth/me`, Members, Tasks, and Announcements successfully and cleared the offline banner.

The test account was signed out after the scenario, the temporary API was stopped, and the emulator font scale was restored to 1.0.

The Finance failure scenario stopped the local API before submitting the entered test expense; the app retained the dialog and entered values and showed its existing offline recovery message.

No expense was sent to the API in that failed-save scenario.

## Screenshots

The web screenshots use headless Microsoft Edge through Playwright 1.63.0.

| Web flow | Representative screenshots |
| --- | --- |
| Overview at the four target widths | [375](screenshots/ui-redesign/p2-phone-overview-375.png), [768](screenshots/ui-redesign/p2-tablet-overview-768.png), [1024](screenshots/ui-redesign/p2-small-desktop-overview-1024.png), [1440](screenshots/ui-redesign/p2-desktop-overview-1440.png) |
| Members, Tasks, and Announcements at all four target widths | [Screenshot directory](screenshots/ui-redesign/) contains the `p2-phone-*`, `p2-tablet-*`, `p2-small-desktop-*`, and `p2-desktop-*` captures. |
| Finance report at the four target widths | [375](screenshots/ui-redesign/p3-finance-phone-375.png), [768](screenshots/ui-redesign/p3-finance-tablet-768.png), [1024](screenshots/ui-redesign/p3-finance-small-desktop-1024.png), [1440](screenshots/ui-redesign/p3-finance-desktop-1440.png) |
| Spreadsheet import at the four target widths | [375](screenshots/ui-redesign/p3-import-phone-375.png), [768](screenshots/ui-redesign/p3-import-tablet-768.png), [1024](screenshots/ui-redesign/p3-import-small-desktop-1024.png), [1440](screenshots/ui-redesign/p3-import-desktop-1440.png) |

The Android screenshots use the API 37 emulator at the stated system font scale.

| Scenario | Screenshot |
| --- | --- |
| Overview at 1.0 scale | [p5 overview default](screenshots/ui-redesign/p5-android-overview-api37-default.png) |
| Overview at 2.0 scale | [p5 overview 200 percent](screenshots/ui-redesign/p5-android-overview-api37-200.png) |
| Members at 1.0 and 2.0 scales | [default](screenshots/ui-redesign/p5-android-members-api37-default.png), [200 percent](screenshots/ui-redesign/p5-android-members-api37-200.png) |
| Tasks at 1.0 and 2.0 scales | [default](screenshots/ui-redesign/p5-android-tasks-api37-default.png), [200 percent](screenshots/ui-redesign/p5-android-tasks-api37-200.png) |
| Announcements at 1.0 and 2.0 scales | [default](screenshots/ui-redesign/p5-android-announcements-api37-default.png), [200 percent](screenshots/ui-redesign/p5-android-announcements-api37-200.png) |
| Authenticated cached Tasks at 1.0 and 2.0 scales | [default](screenshots/ui-redesign/p5-android-tasks-offline-cache-api37-default.png), [200 percent](screenshots/ui-redesign/p5-android-tasks-offline-cache-api37-200.png) |
| Finance entry and authenticated report | [entry](screenshots/ui-redesign/p5-android-finance-entry-api37-default.png), [report default](screenshots/ui-redesign/p5-android-finance-api37-default.png), [report 200 percent](screenshots/ui-redesign/p5-android-finance-api37-200.png) |
| Finance form and failed save at 2.0 scale | [form](screenshots/ui-redesign/p5-android-finance-expense-form-api37-200.png), [failed save](screenshots/ui-redesign/p5-android-finance-failed-save-api37-200.png), [retained description](screenshots/ui-redesign/p5-android-finance-failed-save-retained-api37-200.png) |
| Authenticated Retry recovery at 1.0 scale | [Retry success](screenshots/ui-redesign/p5-android-retry-online-api37-default.png) |

## Limits

The web and mobile gates used local test environments; production hosting and production data were not exercised.

The mobile live API test remains skipped unless `FINANCE_LIVE_API` is set.

Physical Android devices, TalkBack, the API 24 emulator, real Safari, production, and field behavior remain unverified.

The Android offline and Finance scenarios used seeded local test data and do not establish real-world service availability or physical-device behavior.
