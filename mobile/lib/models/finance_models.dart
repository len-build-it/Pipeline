/// Finance records as returned by the API (FEAT-006).
/// Amounts stay decimal strings exactly as the server sent them; this app never does money arithmetic.
library;

final RegExp _amountPattern = RegExp(r'^(-?)(\d+)(?:\.(\d{1,2}))?$');
final RegExp _thousands = RegExp(r'\B(?=(\d{3})+(?!\d))');

/// Formats a decimal amount string such as "1250.5" or "-30.00" as "PHP 1,250.50".
String formatPhp(String amount) {
  final match = _amountPattern.firstMatch(amount);
  if (match == null) return 'PHP $amount';
  final pesos = match.group(2)!.replaceAllMapped(_thousands, (_) => ',');
  final centavos = (match.group(3) ?? '').padRight(2, '0');
  return '${match.group(1)}PHP $pesos.$centavos';
}

/// True for a positive amount with at most nine peso digits and two decimals.
bool isValidAmountInput(String text) {
  if (!RegExp(r'^\d{1,9}(\.\d{1,2})?$').hasMatch(text)) return false;
  return text.replaceAll('.', '').replaceAll('0', '').isNotEmpty;
}

class Budget {
  final String id;
  final String month;
  final String category;
  final String amount;
  final int version;
  final String updatedByName;

  const Budget({
    required this.id,
    required this.month,
    required this.category,
    required this.amount,
    required this.version,
    required this.updatedByName,
  });

  factory Budget.fromJson(Map<String, dynamic> json) => Budget(
        id: json['id'] as String,
        month: json['month'] as String,
        category: json['category'] as String,
        amount: json['amount'] as String,
        version: (json['version'] as num).toInt(),
        updatedByName: json['updatedByName'] as String? ?? '',
      );
}

class Expense {
  final String id;
  final String occurredOn;
  final String amount;
  final String category;
  final String description;
  final String? vendor;
  final String? reference;
  final String source;
  final int version;
  final bool voided;
  final String updatedByName;
  final String updatedAt;

  const Expense({
    required this.id,
    required this.occurredOn,
    required this.amount,
    required this.category,
    required this.description,
    required this.vendor,
    required this.reference,
    required this.source,
    required this.version,
    required this.voided,
    required this.updatedByName,
    required this.updatedAt,
  });

  factory Expense.fromJson(Map<String, dynamic> json) => Expense(
        id: json['id'] as String,
        occurredOn: json['occurredOn'] as String,
        amount: json['amount'] as String,
        category: json['category'] as String,
        description: json['description'] as String,
        vendor: json['vendor'] as String?,
        reference: json['reference'] as String?,
        source: json['source'] as String? ?? 'manual',
        version: (json['version'] as num).toInt(),
        voided: json['voided'] as bool? ?? false,
        updatedByName: json['updatedByName'] as String? ?? '',
        updatedAt: json['updatedAt'] as String? ?? '',
      );
}

/// What a member enters for an expense; amounts travel as decimal strings.
class ExpenseInput {
  final String occurredOn;
  final String amount;
  final String category;
  final String description;
  final String? vendor;
  final String? reference;

  const ExpenseInput({
    required this.occurredOn,
    required this.amount,
    required this.category,
    required this.description,
    this.vendor,
    this.reference,
  });

  Map<String, dynamic> toJson() => {
        'occurredOn': occurredOn,
        'amount': amount,
        'category': category,
        'description': description,
        'vendor': vendor,
        'reference': reference,
      };
}

class ExpensePage {
  final List<Expense> expenses;
  final int total;
  final String totalAmount;

  const ExpensePage({required this.expenses, required this.total, required this.totalAmount});

  factory ExpensePage.fromJson(Map<String, dynamic> json) => ExpensePage(
        expenses: (json['expenses'] as List<dynamic>).map((e) => Expense.fromJson(e as Map<String, dynamic>)).toList(),
        total: (json['total'] as num).toInt(),
        totalAmount: json['totalAmount'] as String,
      );
}

class CategoryLine {
  final String category;
  final String? budgetId;
  final int? budgetVersion;
  final String? budget;
  final String actual;
  final String? remaining;

  /// 'under', 'at', 'over', or 'unbudgeted'.
  final String status;

  const CategoryLine({
    required this.category,
    required this.budgetId,
    required this.budgetVersion,
    required this.budget,
    required this.actual,
    required this.remaining,
    required this.status,
  });

  factory CategoryLine.fromJson(Map<String, dynamic> json) => CategoryLine(
        category: json['category'] as String,
        budgetId: json['budgetId'] as String?,
        budgetVersion: (json['budgetVersion'] as num?)?.toInt(),
        budget: json['budget'] as String?,
        actual: json['actual'] as String,
        remaining: json['remaining'] as String?,
        status: json['status'] as String,
      );
}

class TrendPoint {
  final String month;
  final String actual;
  final int expenseCount;

  const TrendPoint({required this.month, required this.actual, required this.expenseCount});

  factory TrendPoint.fromJson(Map<String, dynamic> json) => TrendPoint(
        month: json['month'] as String,
        actual: json['actual'] as String,
        expenseCount: (json['expenseCount'] as num).toInt(),
      );
}

class Forecast {
  final String estimate;
  final int elapsedDays;
  final int daysInMonth;
  final String basis;

  const Forecast({required this.estimate, required this.elapsedDays, required this.daysInMonth, required this.basis});

  factory Forecast.fromJson(Map<String, dynamic> json) => Forecast(
        estimate: json['estimate'] as String,
        elapsedDays: (json['elapsedDays'] as num).toInt(),
        daysInMonth: (json['daysInMonth'] as num).toInt(),
        basis: json['basis'] as String,
      );
}

class FinanceReport {
  final String month;
  final String asOf;
  final String budget;
  final String actual;
  final String remaining;
  final String unbudgetedActual;
  final String status;
  final List<CategoryLine> categories;
  final List<TrendPoint> trend;
  final Forecast? forecast;

  const FinanceReport({
    required this.month,
    required this.asOf,
    required this.budget,
    required this.actual,
    required this.remaining,
    required this.unbudgetedActual,
    required this.status,
    required this.categories,
    required this.trend,
    required this.forecast,
  });

  factory FinanceReport.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] as Map<String, dynamic>;
    final forecast = json['forecast'] as Map<String, dynamic>?;
    return FinanceReport(
      month: json['month'] as String,
      asOf: json['asOf'] as String,
      budget: totals['budget'] as String,
      actual: totals['actual'] as String,
      remaining: totals['remaining'] as String,
      unbudgetedActual: totals['unbudgetedActual'] as String,
      status: totals['status'] as String,
      categories: (json['categories'] as List<dynamic>).map((c) => CategoryLine.fromJson(c as Map<String, dynamic>)).toList(),
      trend: (json['trend'] as List<dynamic>).map((t) => TrendPoint.fromJson(t as Map<String, dynamic>)).toList(),
      forecast: forecast == null ? null : Forecast.fromJson(forecast),
    );
  }
}

class FinanceEvent {
  final String entityType;
  final String action;
  final String actorName;
  final String createdAt;
  final Map<String, dynamic> metadata;

  const FinanceEvent({
    required this.entityType,
    required this.action,
    required this.actorName,
    required this.createdAt,
    required this.metadata,
  });

  factory FinanceEvent.fromJson(Map<String, dynamic> json) => FinanceEvent(
        entityType: json['entityType'] as String,
        action: json['action'] as String,
        actorName: json['actorName'] as String,
        createdAt: json['createdAt'] as String,
        metadata: (json['metadata'] as Map<String, dynamic>?) ?? const {},
      );

  /// "Sam Taylor changed expense: Amount PHP 40.00 → PHP 45.50".
  String get summary {
    const actions = {'create': 'recorded', 'update': 'changed', 'void': 'voided', 'import': 'imported'};
    const entities = {'expense': 'expense', 'budget': 'budget', 'import_batch': 'spreadsheet'};
    final headline = '$actorName ${actions[action] ?? action} ${entities[entityType] ?? entityType}';

    if (action == 'import') {
      return '$headline: ${metadata['importedCount']} expenses, total ${formatPhp('${metadata['totalAmount']}')}';
    }

    final before = (metadata['before'] as Map<String, dynamic>?) ?? const {};
    final after = (metadata['after'] as Map<String, dynamic>?) ?? const {};
    const labels = {'amount': 'Amount', 'occurredOn': 'Date', 'category': 'Category', 'month': 'Month'};
    String text(String key, dynamic value) => key == 'amount' ? formatPhp('$value') : '$value';

    final parts = <String>[];
    for (final key in labels.keys) {
      final hasBefore = before.containsKey(key);
      final hasAfter = after.containsKey(key);
      if (hasBefore && hasAfter) {
        parts.add('${labels[key]} ${text(key, before[key])} → ${text(key, after[key])}');
      } else if (hasAfter) {
        parts.add('${labels[key]} ${text(key, after[key])}');
      } else if (hasBefore) {
        parts.add('${labels[key]} was ${text(key, before[key])}');
      }
    }
    return parts.isEmpty ? headline : '$headline: ${parts.join(', ')}';
  }
}
