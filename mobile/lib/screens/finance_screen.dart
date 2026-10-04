import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../data/app_repository.dart';
import '../data/finance_controller.dart';
import '../data/synthetic_data.dart';
import '../models/finance_models.dart';
import '../models/models.dart';
import '../services/finance_api.dart';
import '../theme.dart';
import '../widgets/adaptive_action_fab.dart';
import 'finance_forms.dart';

/// Today's calendar date in Asia/Manila (UTC+8, no daylight saving) as YYYY-MM-DD.
String manilaToday([DateTime? now]) {
  final manila = (now ?? DateTime.now()).toUtc().add(const Duration(hours: 8));
  return manila.toIso8601String().substring(0, 10);
}

String _shiftMonth(String month, int by) {
  final year = int.parse(month.substring(0, 4));
  final monthNumber = int.parse(month.substring(5, 7));
  return DateTime.utc(year, monthNumber + by, 1).toIso8601String().substring(0, 7);
}

const Map<String, String> _statusLabels = {
  'under': 'Within budget',
  'at': 'Budget fully used',
  'over': 'Over budget',
  'unbudgeted': 'No budget set',
};

/// "Remaining PHP 380.00" or "Over budget by PHP 20.30", so the sign is never the only cue.
String _remainingText(String? remaining) {
  if (remaining == null) return 'No budget set';
  return remaining.startsWith('-')
      ? 'Over budget by ${formatPhp(remaining.substring(1))}'
      : 'Remaining ${formatPhp(remaining)}';
}

/// Bar length for drawing only; no displayed amount is derived from it.
double _drawingFraction(String part, String whole) {
  final wholeValue = double.tryParse(whole) ?? 0;
  if (wholeValue <= 0) return 0;
  return ((double.tryParse(part) ?? 0) / wholeValue).clamp(0.0, 1.0);
}

/// Finance workspace for one organization: budget report, expenses, and recent changes.
/// Requirements: FEAT-006/REQ-002, REQ-003, REQ-009 through REQ-013.
class FinanceScreen extends StatefulWidget {
  final SyntheticDataRepository repo;

  const FinanceScreen({super.key, required this.repo});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  String? _orgId;
  FinanceController? _controller;

  AppRepository? get _session {
    final repo = widget.repo;
    return repo is AppRepository && repo.hasSession ? repo : null;
  }

  List<Org> get _organizations => widget.repo.availableScopes.where((o) => o.id != 'all').toList();

  @override
  void initState() {
    super.initState();
    if (_session != null && widget.repo.currentScope != 'all') _openOrganization(widget.repo.currentScope);
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _openOrganization(String orgId) {
    _controller?.dispose();
    final controller = FinanceController(
      FinanceApi(_session!.apiClient, orgId),
      month: manilaToday().substring(0, 7),
    );
    setState(() {
      _orgId = orgId;
      _controller = controller;
    });
    controller.load();
  }

  Future<void> _openDialog(Widget dialog, String successMessage) async {
    final saved = await showDialog<bool>(context: context, builder: (_) => dialog);
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMessage)));
    }
  }

  Future<void> _voidExpense(Expense expense) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Void this expense?'),
        content: Text(
          '${expense.occurredOn} · ${formatPhp(expense.amount)} · ${expense.description}\n\n'
          'It stays in the register as void and leaves every total.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Keep expense')),
          ElevatedButton(
            key: const Key('confirm-void'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Void expense'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final result = await _controller!.voidExpense(expense);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result.message ?? 'Expense voided.')));
    if (result.isConflict) _controller!.load();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Finance'),
        actions: [
          if (controller != null)
            IconButton(
              key: const Key('finance-refresh'),
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh finance records',
              onPressed: controller.load,
            ),
        ],
      ),
      body: _session == null
          ? const _Notice(
              icon: Icons.lock_outline,
              title: 'Sign in to use Finance',
              message: 'Finance always shows live team records and is not part of the demo data. '
                  'Sign in from the account menu on the home screen.',
            )
          : controller == null
              ? ListView(padding: const EdgeInsets.all(16), children: [_organizationCard()])
              : ListenableBuilder(listenable: controller, builder: (context, _) => _workspace(controller)),
      floatingActionButton: controller == null
          ? null
          : ListenableBuilder(
              listenable: controller,
              builder: (context, _) => controller.hasData
                  ? AdaptiveActionFab(
                      heroTag: 'fab-finance',
                      buttonKey: const Key('finance-record-expense'),
                      label: 'Record expense',
                      icon: const Icon(Icons.add),
                      onPressed: () => _openDialog(
                        ExpenseFormDialog(controller: controller, today: manilaToday()),
                        'Expense recorded.',
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
    );
  }

  Widget _organizationCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              key: const Key('finance-organization'),
              initialValue: _orgId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Organization'),
              hint: const Text('Choose an organization'),
              items: [
                for (final org in _organizations)
                  DropdownMenuItem(value: org.id, child: Text(org.name, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (orgId) {
                if (orgId != null && orgId != _orgId) _openOrganization(orgId);
              },
            ),
            const SizedBox(height: 8),
            const Text('Currency: PHP · All members can view and change these records.'),
          ],
        ),
      ),
    );
  }

  Widget _workspace(FinanceController controller) {
    return ColoredBox(
      color: controller.problem == FinanceProblem.offline ? AppColors.backgroundOffline : AppColors.background,
      child: RefreshIndicator(
        onRefresh: controller.load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            _organizationCard(),
            _monthSelector(controller),
            if (controller.isLoading) const LinearProgressIndicator(semanticsLabel: 'Loading finance records'),
            if (controller.problem != FinanceProblem.none) _problemNotice(controller),
            if (controller.hasData) ...[
              _totals(controller.report!),
              _categoryComparison(controller),
              _trend(controller.report!),
              _expenses(controller),
              _recentChanges(controller),
            ],
            const _SpreadsheetNote(),
          ],
        ),
      ),
    );
  }

  Widget _monthSelector(FinanceController controller) {
    final isCurrentMonth = controller.month == manilaToday().substring(0, 7);
    return Row(
      children: [
        IconButton(
          key: const Key('finance-previous-month'),
          icon: const Icon(Icons.chevron_left),
          tooltip: 'Previous month',
          onPressed: () => controller.showMonth(_shiftMonth(controller.month, -1)),
        ),
        Expanded(
          child: Text(
            'Report month: ${controller.month}',
            key: const Key('finance-month'),
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        IconButton(
          key: const Key('finance-next-month'),
          icon: const Icon(Icons.chevron_right),
          tooltip: 'Next month',
          onPressed: isCurrentMonth ? null : () => controller.showMonth(_shiftMonth(controller.month, 1)),
        ),
      ],
    );
  }

  Widget _problemNotice(FinanceController controller) {
    final isOffline = controller.problem == FinanceProblem.offline;
    return _Notice(
      icon: isOffline ? Icons.wifi_off : Icons.error_outline,
      title: switch (controller.problem) {
        FinanceProblem.offline => 'Finance needs a connection',
        FinanceProblem.denied => 'No access to this organization',
        FinanceProblem.sessionExpired => 'Session expired',
        _ => 'Finance records could not be loaded',
      },
      message: controller.problemMessage ?? '',
      action: controller.problem == FinanceProblem.denied
          ? null
          : OutlinedButton.icon(
              key: const Key('finance-retry'),
              onPressed: controller.load,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
    );
  }

  Widget _totals(FinanceReport report) {
    final isOver = report.remaining.startsWith('-');
    final forecast = report.forecast;
    final budget = double.tryParse(report.budget) ?? 0;
    final actual = double.tryParse(report.actual) ?? 0;
    final hasBudget = budget > 0;
    final fraction = hasBudget ? (actual / budget).clamp(0.0, 1.0) : 0.0;
    return _Section(
      title: 'Budget report',
      children: [
        Text('Non-void expenses in PHP for ${report.month}, as of ${report.asOf} (Asia/Manila).'),
        const SizedBox(height: 12),
        Card(
          key: const Key('finance-stat-remaining'),
          color: AppColors.surface,
          elevation: 2,
          shadowColor: AppColors.primary.withAlpha(42),
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.only(
              topLeft: Radius.elliptical(36, 28),
              topRight: Radius.elliptical(28, 40),
              bottomRight: Radius.elliptical(40, 28),
              bottomLeft: Radius.elliptical(28, 36),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isOver ? 'Over budget by' : 'Remaining', style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w700)),
                Text(
                  formatPhp(isOver ? report.remaining.substring(1) : report.remaining),
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: isOver ? AppColors.danger : AppColors.text),
                ),
                const SizedBox(height: 8),
                if (hasBudget) ...[
                  _progressTrack(fraction, over: isOver),
                  const SizedBox(height: 8),
                  Text('Actual ${formatPhp(report.actual)} of ${formatPhp(report.budget)} budget.'),
                ] else
                  const Text('No budget set for this period.'),
                Padding(
                  key: const Key('finance-stat-budget'),
                  padding: const EdgeInsets.only(top: 12),
                  child: Text('Budget ${formatPhp(report.budget)}'),
                ),
              ],
            ),
          ),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final largeText = MediaQuery.textScalerOf(context).scale(1) > 1.3;
            final width = largeText || constraints.maxWidth < 340 ? constraints.maxWidth : (constraints.maxWidth - 12) / 2;
            return Wrap(
              spacing: 12,
              children: [
                SizedBox(
                  width: width,
                  child: _Figure(
                    statKey: 'actual',
                    label: 'Actual spending',
                    value: formatPhp(report.actual),
                    note: 'Includes ${formatPhp(report.unbudgetedActual)} without a budget',
                    fill: AppColors.aquaTint,
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _Figure(
                    statKey: 'forecast',
                    label: 'Month-end estimate',
                    value: forecast == null ? 'Not available' : formatPhp(forecast.estimate),
                    note: forecast == null
                        ? 'Shown for the current month once spending is recorded'
                        : 'Estimate, not actual: ${forecast.elapsedDays} of ${forecast.daysInMonth} days elapsed. ${forecast.basis}',
                    fill: AppColors.limeTint,
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _categoryComparison(FinanceController controller) {
    final lines = controller.report!.categories;
    return _Section(
      title: 'Budget compared with actual',
      action: OutlinedButton.icon(
        key: const Key('finance-set-budget'),
        onPressed: () => _openDialog(BudgetFormDialog(controller: controller), 'Budget set.'),
        icon: const Icon(Icons.add),
        label: const Text('Set budget'),
      ),
      children: [
        if (lines.isEmpty) Text('No budgets or spending for ${controller.month}.'),
        for (final line in lines) _categoryLine(controller, line),
      ],
    );
  }

  Widget _categoryLine(FinanceController controller, CategoryLine line) {
    final hasBudget = line.budget != null;
    final budget = hasBudget ? double.tryParse(line.budget!) ?? 0 : 0;
    final actual = double.tryParse(line.actual) ?? 0;
    final percent = budget > 0 ? actual / budget * 100 : null;
    final figures = hasBudget
        ? '${formatPhp(line.actual)} of ${formatPhp(line.budget!)} · ${_remainingText(line.remaining)}'
        : '${formatPhp(line.actual)} spent · No budget set';
    final scale = hasBudget && _drawingFraction(line.actual, line.budget!) < 1 ? line.budget! : line.actual;

    return Padding(
      key: Key('category-line-${line.category}'),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(line.category, style: const TextStyle(fontWeight: FontWeight.w700)),
          Text(figures),
          Text('Status: ${_statusLabels[line.status] ?? line.status}'),
          if (percent != null) Text('${percent.toStringAsFixed(0)}% of budget used.'),
          const SizedBox(height: 4),
          if (hasBudget) _progressTrack(_drawingFraction(line.actual, scale), over: line.status == 'over'),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => _openDialog(
                BudgetFormDialog(controller: controller, line: line),
                hasBudget ? 'Budget updated.' : 'Budget set.',
              ),
              child: Text(hasBudget ? 'Change budget for ${line.category}' : 'Set budget for ${line.category}'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _trend(FinanceReport report) {
    final pointWidth = MediaQuery.textScalerOf(context).scale(1) > 1.3 ? 224.0 : 136.0;
    final chartHeight = MediaQuery.textScalerOf(context).scale(1) > 1.3 ? 320.0 : 240.0;
    final chartWidth = (report.trend.length * pointWidth).clamp(320.0, double.infinity).toDouble();
    final values = report.trend.map((point) => double.tryParse(point.actual) ?? 0).toList();
    final currentMonth = manilaToday().substring(0, 7);
    return _Section(
      title: 'Monthly actual spending',
      children: [
        Text(report.month == currentMonth ? 'The selected month is in progress.' : 'Monthly totals for the selected report.'),
        if (report.trend.isNotEmpty) ...[
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: chartWidth,
              height: chartHeight,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final maxValue = values.fold<double>(0, (max, value) => value > max ? value : max);
                  final step = report.trend.length <= 1
                      ? 0.0
                      : (constraints.maxWidth - pointWidth) / (report.trend.length - 1);
                  double pointY(int index) => maxValue <= 0
                      ? 108
                      : 68 + (1 - values[index] / maxValue) * 88;
                  return Stack(
                    children: [
                      Positioned.fill(
                        child: CustomPaint(
                          painter: _TrendLinePainter(
                            values: values,
                            maxValue: maxValue,
                            pointWidth: pointWidth,
                            currentIndex: report.trend.indexWhere((point) => point.month == currentMonth),
                          ),
                        ),
                      ),
                      for (var index = 0; index < report.trend.length; index++)
                        Positioned(
                          left: report.trend.length <= 1 ? 0 : step * index,
                          top: (pointY(index) - 66).clamp(4.0, 90.0),
                          width: pointWidth,
                          child: Text(
                    '${formatPhp(report.trend[index].actual)} · ${report.trend[index].expenseCount} expense(s)',
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.visible,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ),
                      for (var index = 0; index < report.trend.length; index++)
                        Positioned(
                          left: report.trend.length <= 1 ? 0 : step * index,
                          top: chartHeight - 56,
                          width: pointWidth,
                          child: Text(
                            '${report.trend[index].month}\n${report.trend[index].expenseCount} expenses',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columns: const [
                DataColumn(label: Text('Month · actual')),
                DataColumn(label: Text('Expenses')),
              ],
              rows: [
                for (final point in report.trend)
                  DataRow(cells: [
                    DataCell(Text('${point.month}: ${formatPhp(point.actual)}')),
                    DataCell(Text('${point.expenseCount} expense(s)')),
                  ]),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _progressTrack(double fraction, {required bool over}) {
    return Container(
      height: 18,
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border, width: 1.5),
        borderRadius: BorderRadius.circular(5),
      ),
      clipBehavior: Clip.antiAlias,
      child: over
          ? const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  tileMode: TileMode.repeated,
                  colors: [AppColors.danger, AppColors.danger, AppColors.dangerBg, AppColors.dangerBg],
                  stops: [0, 0.38, 0.38, 0.72],
                ),
              ),
            )
          : Align(
              alignment: AlignmentDirectional.centerStart,
              child: FractionallySizedBox(
                widthFactor: fraction,
                heightFactor: 1,
                child: const ColoredBox(color: AppColors.primary),
              ),
            ),
    );
  }

  Widget _expenses(FinanceController controller) {
    final page = controller.expensePage!;
    return _Section(
      title: 'Expenses',
      children: [
        SwitchListTile(
          key: const Key('finance-show-voided'),
          contentPadding: EdgeInsets.zero,
          title: const Text('Show void expenses'),
          value: controller.includeVoided,
          onChanged: controller.showVoided,
        ),
        Text(
          '${page.total} expense(s) · Total of non-void expenses: ${formatPhp(page.totalAmount)}',
          key: const Key('finance-expense-total'),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        if (page.expenses.isEmpty) const Padding(padding: EdgeInsets.only(top: 8), child: Text('No expenses in this month.')),
        for (var index = 0; index < page.expenses.length; index++) ...[
          if (index > 0) const Divider(height: 1, color: AppColors.divider),
          _expenseTile(controller, page.expenses[index]),
        ],
      ],
    );
  }

  Widget _expenseTile(FinanceController controller, Expense expense) {
    final struck = TextStyle(decoration: expense.voided ? TextDecoration.lineThrough : null);
    final details = [expense.occurredOn, expense.category, ?expense.vendor, ?expense.reference].join(' ? ');
    final changedAt = expense.updatedAt.isEmpty ? null : expense.updatedAt.replaceFirst('T', ' ').split('.').first;

    return Padding(
      key: Key('expense-${expense.id}'),
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  expense.voided ? '${expense.description} (Void)' : expense.description,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(decoration: struck.decoration),
                ),
              ),
              if (!expense.voided)
                PopupMenuButton<String>(
                  key: Key('expense-actions-${expense.id}'),
                  tooltip: 'Actions for ${expense.description}',
                  onSelected: (action) {
                    if (action == 'edit') {
                      _openDialog(
                        ExpenseFormDialog(controller: controller, today: manilaToday(), expense: expense),
                        'Expense updated.',
                      );
                    } else {
                      _voidExpense(expense);
                    }
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'edit', child: Text('Edit')),
                    PopupMenuItem(value: 'void', child: Text('Void')),
                  ],
                ),
            ],
          ),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: Text(formatPhp(expense.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
          Text(details, style: const TextStyle(color: AppColors.textMuted)),
          Text(
            'Last changed by ${expense.updatedByName}${changedAt == null ? '' : ' on $changedAt UTC'}',
            style: const TextStyle(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _recentChanges(FinanceController controller) {
    return _Section(
      title: 'Recent changes',
      children: [
        const Text('Every budget, expense, import, and void is recorded with the member and time.'),
        if (controller.recentChanges.isEmpty) const Text('No changes have been recorded yet.'),
        for (final event in controller.recentChanges)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text('${event.summary}\n${event.createdAt.replaceFirst('T', ' ').split('.').first} UTC'),
          ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget? action;
  final List<Widget> children;

  const _Section({required this.title, required this.children, this.action});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
            ?action,
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// One labeled amount, stacked so it never overflows at large text sizes.
class _Figure extends StatelessWidget {
  final String statKey;
  final String label;
  final String value;
  final String? note;
  final Color fill;

  const _Figure({required this.statKey, required this.label, required this.value, this.note, this.fill = AppColors.aquaTint});

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('finance-stat-$statKey'),
      color: fill,
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: MergeSemantics(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              if (note != null) Text(note!, style: const TextStyle(color: AppColors.textMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrendLinePainter extends CustomPainter {
  final List<double> values;
  final double maxValue;
  final double pointWidth;
  final int currentIndex;

  const _TrendLinePainter({required this.values, required this.maxValue, required this.pointWidth, required this.currentIndex});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final step = values.length <= 1 ? 0.0 : (size.width - pointWidth) / (values.length - 1);
    final points = [
      for (var index = 0; index < values.length; index++)
        Offset(
          pointWidth / 2 + step * index,
          maxValue <= 0 ? 108 : 68 + (1 - values[index] / maxValue) * 88,
        ),
    ];
    final baseline = 172.0;
    final line = Path()..moveTo(points.first.dx, points.first.dy);
    for (var index = 1; index < points.length; index++) {
      final midpoint = (points[index - 1].dx + points[index].dx) / 2;
      line.quadraticBezierTo(points[index - 1].dx, points[index - 1].dy, midpoint, (points[index - 1].dy + points[index].dy) / 2);
      if (index == points.length - 1) line.lineTo(points[index].dx, points[index].dy);
    }

    final area = Path.from(line)
      ..lineTo(points.last.dx, baseline)
      ..lineTo(points.first.dx, baseline)
      ..close();
    canvas.drawPath(area, Paint()..color = AppColors.aquaTint.withAlpha(190));
    canvas.drawPath(
      line,
      Paint()
        ..color = AppColors.primary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    if (currentIndex > 0 && currentIndex < points.length) {
      final from = points[currentIndex - 1];
      final to = points[currentIndex];
      final erase = Paint()
        ..color = AppColors.aquaTint.withAlpha(190)
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(from, to, erase);
      final dx = to.dx - from.dx;
      final dy = to.dy - from.dy;
      final distance = math.sqrt(dx * dx + dy * dy);
      final dashPaint = Paint()
        ..color = AppColors.primary
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round;
      for (var offset = 0.0; offset < distance; offset += 8) {
        final end = math.min(offset + 4, distance).toDouble();
        canvas.drawLine(
          Offset(from.dx + dx * offset / distance, from.dy + dy * offset / distance),
          Offset(from.dx + dx * end / distance, from.dy + dy * end / distance),
          dashPaint,
        );
      }
    }

    final gridPaint = Paint()
      ..color = AppColors.divider
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, baseline), Offset(size.width, baseline), gridPaint);
    for (var index = 0; index < points.length; index++) {
      final isCurrent = index == currentIndex;
      canvas.drawCircle(points[index], 6, Paint()..color = isCurrent ? Colors.white : AppColors.primary);
      canvas.drawCircle(
        points[index],
        6,
        Paint()
          ..color = AppColors.primary
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _TrendLinePainter oldDelegate) =>
      oldDelegate.maxValue != maxValue ||
      oldDelegate.pointWidth != pointWidth ||
      oldDelegate.currentIndex != currentIndex ||
      oldDelegate.values.length != values.length ||
      oldDelegate.values.asMap().entries.any((entry) => values[entry.key] != entry.value);
}

class _Notice extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  const _Notice({required this.icon, required this.title, required this.message, this.action});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            if (action != null) Padding(padding: const EdgeInsets.only(top: 12), child: action),
          ],
        ),
      ),
    );
  }
}

/// Tells members where spreadsheet transfer lives, since it is a web workflow.
class _SpreadsheetNote extends StatelessWidget {
  const _SpreadsheetNote();

  @override
  Widget build(BuildContext context) {
    return const Card(
      margin: EdgeInsets.only(top: 16),
      child: ListTile(
        leading: Icon(Icons.table_view_outlined),
        title: Text('Spreadsheet import and export'),
        subtitle: Text(
          'Available to every member in the web app: open Finance in the web dashboard to import CSV or XLSX files '
          'or export an XLSX workbook.',
        ),
      ),
    );
  }
}
