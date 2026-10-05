import 'package:flutter/material.dart';
import '../theme.dart';

class AuthPage extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> children;

  const AuthPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: Navigator.of(context).canPop() ? AppBar() : null,
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: (constraints.maxHeight - 48).clamp(
                  0,
                  double.infinity,
                ),
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Icon(
                            Icons.groups_outlined,
                            size: 40,
                            color: AppColors.primary,
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'Team Manager',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 24),
                          Semantics(
                            header: true,
                            child: Text(
                              title,
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            subtitle,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 24),
                          ...children,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}

class AuthMessage extends StatelessWidget {
  final String message;
  const AuthMessage(this.message, {super.key});

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warningBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(message, style: const TextStyle(color: AppColors.warning)),
    ),
  );
}

class AuthPasswordField extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final String? Function(String?) validator;
  final String label;
  final String autofillHint;
  final VoidCallback onSubmit;
  final bool enabled;

  const AuthPasswordField({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.validator,
    required this.onSubmit,
    this.label = 'Password',
    this.autofillHint = AutofillHints.password,
    this.enabled = true,
  });

  @override
  State<AuthPasswordField> createState() => _AuthPasswordFieldState();
}

class _AuthPasswordFieldState extends State<AuthPasswordField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: widget.label,
    child: TextFormField(
      controller: widget.controller,
      focusNode: widget.focusNode,
      enabled: widget.enabled,
      validator: widget.validator,
      obscureText: _obscured,
      enableSuggestions: false,
      autocorrect: false,
      autofillHints: [widget.autofillHint],
      textInputAction: TextInputAction.done,
      onFieldSubmitted: (_) => widget.onSubmit(),
      decoration: InputDecoration(
        labelText: widget.label,
        errorMaxLines: 3,
        suffixIcon: IconButton(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          tooltip: _obscured ? 'Show password' : 'Hide password',
          onPressed: widget.enabled
              ? () => setState(() => _obscured = !_obscured)
              : null,
          icon: Icon(
            _obscured
                ? Icons.visibility_outlined
                : Icons.visibility_off_outlined,
          ),
        ),
      ),
    ),
  );
}

String? validateEmail(String? value) {
  final email = value?.trim() ?? '';
  if (email.isEmpty ||
      email.length > 254 ||
      !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
    return 'Enter a valid email address.';
  }
  return null;
}
