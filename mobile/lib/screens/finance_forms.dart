import 'package:flutter/material.dart';
import '../data/finance_controller.dart';
import '../models/finance_models.dart';
import '../theme.dart';

const String _amountHelp = 'PHP, digits only, up to two decimals. Example: 1250.50';

String? _validateAmount(String? value) {
  return isValidAmountInput((value ?? '').trim()) ? null : 'Enter a positive amount. $_amountHelp';
}

String? _validateRequired(String? value, String label, int maxLength) {
  final text = (value ?? '').trim();
  if (text.isEmpty) return 'Enter $label.';
  if (text.length > maxLength) return 'Use at most $maxLength characters.';
  return null;
}

/// Announced problem banner shown at the top of a finance dialog.
class _FormProblem extends StatelessWidget {
  final String message;

  const _FormProblem(this.message);

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        key: const Key('finance-form-problem'),
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.dangerBg,
          border: Border.all(color: AppColors.danger),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(message, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

/// Existing categories offered as one-tap suggestions for a category field.
class _CategorySuggestions extends StatelessWidget {
  final List<String> categories;
  final ValueChanged<String> onSelected;

  const _CategorySuggestions({required this.categories, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        spacing: 8,
        children: [
          for (final category in categories.take(8))
            ActionChip(
              label: Text(category),
              tooltip: 'Use category $category',
              onPressed: () => onSelected(category),
            ),
        ],
      ),
    );
  }
}

/// Records a new expense, or edits [expense] when it is given.
/// A failed save keeps the dialog open with everything the member typed.
class ExpenseFormDialog extends StatefulWidget {
  final FinanceController controller;
  final String today;
  final Expense? expense;

  const ExpenseFormDialog({super.key, required this.controller, required this.today, this.expense});

  @override
  State<ExpenseFormDialog> createState() => _ExpenseFormDialogState();
}

class _ExpenseFormDialogState extends State<ExpenseFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _amount;
  late final TextEditingController _category;
  late final TextEditingController _description;
  late final TextEditingController _vendor;
  late final TextEditingController _reference;
  late String _occurredOn;
  late int? _version;
  String? _problem;
  bool _isSaving = false;

  bool get _isEdit => widget.expense != null;

  @override
  void initState() {
    super.initState();
    final expense = widget.expense;
    _amount = TextEditingController(text: expense?.amount ?? '');
    _category = TextEditingController(text: expense?.category ?? '');
    _description = TextEditingController(text: expense?.description ?? '');
    _vendor = TextEditingController(text: expense?.vendor ?? '');
    _reference = TextEditingController(text: expense?.reference ?? '');
    _occurredOn = expense?.occurredOn ?? widget.today;
    _version = expense?.version;
  }

  @override
  void dispose() {
    for (final controller in [_amount, _category, _description, _vendor, _reference]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse(_occurredOn),
      firstDate: DateTime(2000),
      lastDate: DateTime.parse(widget.today),
      helpText: 'Expense date (future dates are not accepted)',
    );
    if (picked != null) setState(() => _occurredOn = picked.toIso8601String().substring(0, 10));
  }

  ExpenseInput _input() {
    String? optional(TextEditingController controller) {
      final text = controller.text.trim();
      return text.isEmpty ? null : text;
    }

    return ExpenseInput(
      occurredOn: _occurredOn,
      amount: _amount.text.trim(),
      category: _category.text.trim(),
      description: _description.text.trim(),
      vendor: optional(_vendor),
      reference: optional(_reference),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _problem = null;
    });

    final result = _isEdit
        ? await widget.controller.changeExpense(widget.expense!.id, _input(), _version!)
        : await widget.controller.recordExpense(_input());
    if (!mounted) return;

    if (result.succeeded) {
      Navigator.of(context).pop(true);
      return;
    }

    var problem = result.message!;
    if (result.isConflict && _isEdit) problem = await _conflictGuidance(problem);
    if (!mounted) return;
    setState(() {
      _isSaving = false;
      _problem = problem;
    });
  }

  /// After a stale edit, adopt the latest version so saving again applies the member's input on top of it.
  Future<String> _conflictGuidance(String serverMessage) async {
    final latest = await widget.controller.latestExpense(widget.expense!.id);
    if (latest == null) return serverMessage;
    _version = latest.version;
    final latestValues = '${latest.occurredOn}, ${formatPhp(latest.amount)}, ${latest.category}';
    if (latest.voided) return '$serverMessage The expense has since been voided and can no longer be edited.';
    return '$serverMessage Latest saved values: $latestValues, changed by ${latest.updatedByName}. '
        'Your edits are still here. Save again to apply them.';
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isEdit ? 'Edit expense' : 'Record expense'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_problem != null) _FormProblem(_problem!),
              OutlinedButton.icon(
                key: const Key('expense-date'),
                onPressed: _isSaving ? null : _pickDate,
                icon: const Icon(Icons.event),
                label: Text('Date: $_occurredOn'),
              ),
              TextFormField(
                key: const Key('expense-amount'),
                controller: _amount,
                decoration: const InputDecoration(labelText: 'Amount (PHP) *', helperText: _amountHelp, helperMaxLines: 3),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: _validateAmount,
              ),
              TextFormField(
                key: const Key('expense-category'),
                controller: _category,
                decoration: const InputDecoration(labelText: 'Category *'),
                validator: (value) => _validateRequired(value, 'a category', 60),
              ),
              _CategorySuggestions(
                categories: widget.controller.categories,
                onSelected: (category) => setState(() => _category.text = category),
              ),
              TextFormField(
                key: const Key('expense-description'),
                controller: _description,
                decoration: const InputDecoration(labelText: 'Description *'),
                maxLines: 2,
                validator: (value) => _validateRequired(value, 'a description', 500),
              ),
              TextFormField(
                key: const Key('expense-vendor'),
                controller: _vendor,
                decoration: const InputDecoration(labelText: 'Vendor (optional)'),
              ),
              TextFormField(
                key: const Key('expense-reference'),
                controller: _reference,
                decoration: const InputDecoration(labelText: 'Reference (optional)'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          key: const Key('expense-save'),
          onPressed: _isSaving ? null : _save,
          child: Text(_isEdit ? 'Save changes' : 'Record expense'),
        ),
      ],
    );
  }
}

/// Sets a new budget for the controller's month, or changes the amount of [line]'s budget.
class BudgetFormDialog extends StatefulWidget {
  final FinanceController controller;
  final CategoryLine? line;

  const BudgetFormDialog({super.key, required this.controller, this.line});

  @override
  State<BudgetFormDialog> createState() => _BudgetFormDialogState();
}

class _BudgetFormDialogState extends State<BudgetFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _category;
  late final TextEditingController _amount;
  String? _problem;
  bool _isSaving = false;

  /// An existing budget keeps its month and category; only its amount changes.
  bool get _isEdit => widget.line?.budgetId != null;

  @override
  void initState() {
    super.initState();
    _category = TextEditingController(text: widget.line?.category ?? '');
    _amount = TextEditingController(text: widget.line?.budget ?? '');
  }

  @override
  void dispose() {
    _category.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _problem = null;
    });

    final amount = _amount.text.trim();
    final result = _isEdit
        ? await widget.controller.changeBudget(widget.line!, amount)
        : await widget.controller.setBudget(category: _category.text.trim(), amount: amount);
    if (!mounted) return;

    if (result.succeeded) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _isSaving = false;
        _problem = result.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(_isEdit ? 'Change budget' : 'Set budget'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_problem != null) _FormProblem(_problem!),
              Text('Month: ${widget.controller.month} · Currency: PHP'),
              TextFormField(
                key: const Key('budget-category'),
                controller: _category,
                enabled: !_isEdit,
                decoration: const InputDecoration(labelText: 'Category *'),
                validator: (value) => _validateRequired(value, 'a category', 60),
              ),
              if (!_isEdit)
                _CategorySuggestions(
                  categories: widget.controller.categories,
                  onSelected: (category) => setState(() => _category.text = category),
                ),
              TextFormField(
                key: const Key('budget-amount'),
                controller: _amount,
                decoration: const InputDecoration(labelText: 'Budget amount (PHP) *', helperText: _amountHelp, helperMaxLines: 3),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: _validateAmount,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          key: const Key('budget-save'),
          onPressed: _isSaving ? null : _save,
          child: Text(_isEdit ? 'Save budget' : 'Set budget'),
        ),
      ],
    );
  }
}
