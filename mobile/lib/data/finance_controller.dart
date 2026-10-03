import 'package:flutter/foundation.dart';
import '../models/finance_models.dart';
import '../services/api_client.dart';
import '../services/finance_api.dart';

/// Why the finance workspace cannot show records right now.
enum FinanceProblem { none, offline, denied, sessionExpired, failed }

/// Outcome of a save: [message] is null on success.
class FinanceSaveResult {
  final String? message;
  final bool isConflict;

  const FinanceSaveResult.ok()
      : message = null,
        isConflict = false;
  const FinanceSaveResult.failed(String this.message, {this.isConflict = false});

  bool get succeeded => message == null;
}

const String offlineFinanceMessage =
    'You are offline. Finance needs a connection, so nothing was saved. Reconnect and try again.';

/// Loads and changes the finance records of one organization and month.
/// Online-only: records are held in memory for display and are never cached or queued.
class FinanceController extends ChangeNotifier {
  final FinanceApi api;

  FinanceController(this.api, {required this.month});

  String month;
  bool includeVoided = false;

  bool isLoading = false;
  FinanceProblem problem = FinanceProblem.none;
  String? problemMessage;

  FinanceReport? report;
  ExpensePage? expensePage;
  List<String> categories = const [];
  List<FinanceEvent> recentChanges = const [];

  bool get hasData => report != null && expensePage != null;

  static String lastDayOf(String month) {
    final year = int.parse(month.substring(0, 4));
    final monthNumber = int.parse(month.substring(5, 7));
    final day = DateTime.utc(year, monthNumber + 1, 0).day;
    return '$month-${day.toString().padLeft(2, '0')}';
  }

  Future<void> load() async {
    isLoading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        api.report(month),
        api.expenses(from: '$month-01', to: lastDayOf(month), includeVoided: includeVoided),
        api.categories(),
        api.recentChanges(),
      ]);
      report = results[0] as FinanceReport;
      expensePage = results[1] as ExpensePage;
      categories = results[2] as List<String>;
      recentChanges = results[3] as List<FinanceEvent>;
      problem = FinanceProblem.none;
      problemMessage = null;
    } on ApiException catch (error) {
      _recordProblem(error);
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  /// A failed load never leaves earlier figures on screen as if they were current.
  void _recordProblem(ApiException error) {
    report = null;
    expensePage = null;
    recentChanges = const [];
    if (error is NetworkException) {
      problem = FinanceProblem.offline;
      problemMessage = 'You are offline. Finance records are not stored on this device. Reconnect and try again.';
    } else if (error is AuthorizationException) {
      problem = FinanceProblem.denied;
      problemMessage = 'Finance records are visible only to active members of this organization.';
    } else if (error is AuthenticationException) {
      problem = FinanceProblem.sessionExpired;
      problemMessage = 'Your session has expired. Sign in again to use Finance.';
    } else {
      problem = FinanceProblem.failed;
      problemMessage = error.message;
    }
  }

  Future<void> showMonth(String newMonth) async {
    month = newMonth;
    await load();
  }

  Future<void> showVoided(bool show) async {
    includeVoided = show;
    await load();
  }

  /// Runs a change and reloads on success, so every total shown comes from the server.
  Future<FinanceSaveResult> _save(Future<void> Function() change) async {
    try {
      await change();
    } on NetworkException {
      return const FinanceSaveResult.failed(offlineFinanceMessage);
    } on ConflictException catch (error) {
      return FinanceSaveResult.failed(error.message, isConflict: true);
    } on ApiException catch (error) {
      return FinanceSaveResult.failed(error.message);
    }
    await load();
    return const FinanceSaveResult.ok();
  }

  Future<FinanceSaveResult> recordExpense(ExpenseInput input) => _save(() => api.createExpense(input));

  Future<FinanceSaveResult> changeExpense(String expenseId, ExpenseInput input, int version) =>
      _save(() => api.updateExpense(expenseId, input, version));

  Future<FinanceSaveResult> voidExpense(Expense expense) => _save(() => api.voidExpense(expense.id, expense.version));

  Future<FinanceSaveResult> setBudget({required String category, required String amount}) =>
      _save(() => api.createBudget(month: month, category: category, amount: amount));

  Future<FinanceSaveResult> changeBudget(CategoryLine line, String amount) =>
      _save(() => api.updateBudget(line.budgetId!, amount: amount, version: line.budgetVersion!));

  /// The latest stored version of an expense, used to recover from a stale edit.
  Future<Expense?> latestExpense(String expenseId) async {
    try {
      return await api.expense(expenseId);
    } on ApiException {
      return null;
    }
  }
}
