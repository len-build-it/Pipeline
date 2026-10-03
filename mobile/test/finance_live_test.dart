// Contract check against a running local server, skipped unless FINANCE_LIVE_API is set.
// Start the server on the seeded test database, then run:
//   FINANCE_LIVE_API=http://127.0.0.1:3000/api flutter test test/finance_live_test.dart
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/data/finance_controller.dart';
import 'package:mobile/models/finance_models.dart';
import 'package:mobile/screens/finance_screen.dart';
import 'package:mobile/services/api_client.dart';
import 'package:mobile/services/finance_api.dart';
import 'package:mobile/services/secure_cache_service.dart';

void main() {
  final baseUrl = Platform.environment['FINANCE_LIVE_API'];
  final skipReason = baseUrl == null ? 'FINANCE_LIVE_API is not set' : null;

  test('Android client and the real API agree on organizations, records, totals, and the estimate', () async {
    final storage = InMemoryStorageAdapter();
    final apiClient = ApiClient(baseUrl: baseUrl, httpClient: http.Client(), storageAdapter: storage);
    final repo = AppRepository(apiClient: apiClient, cacheService: SecureCacheService(storageAdapter: InMemoryStorageAdapter()));

    // Sign-in and the existing per-organization reads work against the real routes.
    expect(await repo.login('sam@example.com', 'password123456'), isTrue, reason: repo.errorMessage);
    expect(repo.hasSession, isTrue);
    expect(repo.errorMessage, isNull);
    expect(repo.organizations.map((o) => o.name), containsAll(['AqOne', 'Dev Guild']));
    expect(repo.isGlobalOwner, isFalse);
    repo.setScope('org-1');
    await repo.refreshCurrentScope();
    expect(repo.errorMessage, isNull);
    expect(repo.getScopedMembers().map((m) => m.displayName), contains('Alex Rivera'));
    expect(repo.getScopedTasks(), isNotEmpty);

    // Finance: a Member records, edits, and voids through the same API the web uses.
    final today = manilaToday();
    final month = today.substring(0, 7);
    final controller = FinanceController(FinanceApi(apiClient, 'org-1'), month: month);
    final category = 'Live ${DateTime.now().microsecondsSinceEpoch}';

    expect((await controller.setBudget(category: category, amount: '100.00')).succeeded, isTrue);
    for (final amount in ['0.10', '0.20', '120.00']) {
      final result = await controller.recordExpense(
        ExpenseInput(occurredOn: today, amount: amount, category: category, description: 'Live check $amount'),
      );
      expect(result.succeeded, isTrue, reason: result.message);
    }

    final line = controller.report!.categories.firstWhere((c) => c.category == category);
    expect(line.budget, '100.00');
    expect(line.actual, '120.30');
    expect(line.remaining, '-20.30');
    expect(line.status, 'over');

    // Every figure the app shows is the server's own value for the same organization and month.
    final token = await apiClient.getAccessToken();
    final raw = await http.get(
      Uri.parse('$baseUrl/organizations/org-1/finance/report?month=$month'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final web = jsonDecode(raw.body) as Map<String, dynamic>;
    final totals = web['totals'] as Map<String, dynamic>;
    expect(controller.report!.budget, totals['budget']);
    expect(controller.report!.actual, totals['actual']);
    expect(controller.report!.remaining, totals['remaining']);
    expect(controller.report!.forecast!.estimate, (web['forecast'] as Map<String, dynamic>)['estimate']);
    expect(controller.expensePage!.totalAmount, totals['actual']);

    // Edit with the current version, then a stale version is refused as a conflict.
    final expense = controller.expensePage!.expenses.firstWhere((e) => e.description == 'Live check 120.00');
    final edited = ExpenseInput(occurredOn: today, amount: '99.90', category: category, description: 'Live check edited');
    expect((await controller.changeExpense(expense.id, edited, expense.version)).succeeded, isTrue);
    final stale = await controller.changeExpense(expense.id, edited, expense.version);
    expect(stale.isConflict, isTrue);

    final latest = (await controller.latestExpense(expense.id))!;
    expect(latest.amount, '99.90');
    expect((await controller.voidExpense(latest)).succeeded, isTrue);
    final after = controller.report!.categories.firstWhere((c) => c.category == category);
    expect(after.actual, '0.30');
    expect(after.remaining, '99.70');

    // The change history names the member.
    expect(controller.recentChanges.first.actorName, 'Sam Taylor');
    expect(controller.recentChanges.first.action, 'void');

    // Another organization the member does not belong to is refused.
    final denied = FinanceController(FinanceApi(apiClient, 'org-missing'), month: month);
    await denied.load();
    expect(denied.problem, FinanceProblem.denied);
  }, skip: skipReason);
}
