import '../models/finance_models.dart';
import 'api_client.dart';

/// Finance endpoints of one organization, on top of the shared authenticated [ApiClient].
/// Nothing is cached: finance is online-only on Android (FEAT-006/REQ-011).
class FinanceApi {
  final ApiClient client;
  final String organizationId;

  const FinanceApi(this.client, this.organizationId);

  String get _base => '/organizations/$organizationId/finance';

  Future<Map<String, dynamic>> _get(String path, [Map<String, String>? query]) async {
    final res = await client.request(method: 'GET', path: '$_base$path', queryParams: query);
    return res as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _send(String method, String path, Map<String, dynamic> body) async {
    final res = await client.request(method: method, path: '$_base$path', body: body);
    return res as Map<String, dynamic>;
  }

  Future<FinanceReport> report(String month) async {
    return FinanceReport.fromJson(await _get('/report', {'month': month}));
  }

  Future<List<Budget>> budgets(String month) async {
    final json = await _get('/budgets', {'month': month});
    return (json['budgets'] as List<dynamic>).map((b) => Budget.fromJson(b as Map<String, dynamic>)).toList();
  }

  Future<Budget> createBudget({required String month, required String category, required String amount}) async {
    return Budget.fromJson(await _send('POST', '/budgets', {'month': month, 'category': category, 'amount': amount}));
  }

  Future<Budget> updateBudget(String budgetId, {required String amount, required int version}) async {
    return Budget.fromJson(await _send('PATCH', '/budgets/$budgetId', {'amount': amount, 'version': version}));
  }

  Future<ExpensePage> expenses({required String from, required String to, bool includeVoided = false}) async {
    return ExpensePage.fromJson(await _get('/expenses', {
      'from': from,
      'to': to,
      'limit': '200',
      if (includeVoided) 'includeVoided': 'true',
    }));
  }

  Future<Expense> expense(String expenseId) async => Expense.fromJson(await _get('/expenses/$expenseId'));

  Future<Expense> createExpense(ExpenseInput input) async {
    return Expense.fromJson(await _send('POST', '/expenses', input.toJson()));
  }

  Future<Expense> updateExpense(String expenseId, ExpenseInput input, int version) async {
    return Expense.fromJson(await _send('PATCH', '/expenses/$expenseId', {...input.toJson(), 'version': version}));
  }

  Future<Expense> voidExpense(String expenseId, int version) async {
    return Expense.fromJson(await _send('POST', '/expenses/$expenseId/void', {'version': version}));
  }

  Future<List<String>> categories() async {
    final json = await _get('/categories');
    return (json['categories'] as List<dynamic>).map((c) => c as String).toList();
  }

  Future<List<FinanceEvent>> recentChanges() async {
    final json = await _get('/activity', {'limit': '20'});
    return (json['events'] as List<dynamic>).map((e) => FinanceEvent.fromJson(e as Map<String, dynamic>)).toList();
  }
}
