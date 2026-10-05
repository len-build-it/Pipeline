import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/app_repository.dart';
import '../widgets/auth_form.dart';

class SignInScreen extends StatefulWidget {
  final AppRepository repository;
  final VoidCallback onAuthenticated;
  final VoidCallback? onRestore;
  final VoidCallback? onCreateAccount;
  final VoidCallback? onTryDemo;
  final String? notice;
  final String initialEmail;

  const SignInScreen({
    super.key,
    required this.repository,
    required this.onAuthenticated,
    this.onRestore,
    this.onCreateAccount,
    this.onTryDemo,
    this.notice,
    this.initialEmail = '',
  });

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  late final _email = TextEditingController(text: widget.initialEmail);
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) => value == null || value.isEmpty
      ? 'Enter your password.'
      : (value.length > 128
            ? 'Password must be at most 128 characters.'
            : null);

  Future<void> _signIn() async {
    if (_submitting || widget.repository.isLoading) return;
    if (!_form.currentState!.validate()) {
      setState(() => _error = 'Check the highlighted fields and try again.');
      (validateEmail(_email.text) != null ? _emailFocus : _passwordFocus)
          .requestFocus();
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _submitting = true;
      _error = null;
    });
    final accepted = await widget.repository.login(
      _email.text.trim(),
      _password.text,
    );
    if (!mounted) return;
    setState(() {
      _submitting = false;
      _error = accepted ? null : widget.repository.errorMessage;
    });
    if (accepted) {
      TextInput.finishAutofillContext();
      widget.onAuthenticated();
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.repository,
    builder: (context, _) {
      final busy = _submitting || widget.repository.isLoading;
      return AuthPage(
        title: 'Sign in',
        subtitle: 'Welcome back. Sign in to manage your team.',
        children: [
          if (_error ?? widget.notice case final String message)
            AuthMessage(message),
          AutofillGroup(
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    key: const Key('sign-in-email'),
                    controller: _email,
                    focusNode: _emailFocus,
                    enabled: !busy,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                    autofillHints: const [
                      AutofillHints.username,
                      AutofillHints.email,
                    ],
                    validator: validateEmail,
                    onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      errorMaxLines: 3,
                    ),
                  ),
                  const SizedBox(height: 16),
                  AuthPasswordField(
                    key: const Key('sign-in-password'),
                    controller: _password,
                    focusNode: _passwordFocus,
                    enabled: !busy,
                    validator: _validatePassword,
                    onSubmit: _signIn,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    key: Key(
                      widget.repository.requiresSignIn
                          ? 'btn-session-sign-in'
                          : 'btn-sign-in',
                    ),
                    onPressed: busy ? null : _signIn,
                    child: Semantics(
                      liveRegion: true,
                      child: Text(_submitting ? 'Signing in...' : 'Sign in'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (widget.onCreateAccount != null) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: busy ? null : widget.onCreateAccount,
              child: const Text('Have an invitation? Create account'),
            ),
          ],
          if (widget.onTryDemo != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: busy ? null : widget.onTryDemo,
              child: const Text('Try demo'),
            ),
            const SizedBox(height: 8),
            const Text(
              'Explore with sample data. No account needed.',
              textAlign: TextAlign.center,
            ),
          ],
          if (widget.onRestore != null && widget.notice != null) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: busy ? null : widget.onRestore,
              child: const Text('Retry saved session'),
            ),
          ],
        ],
      );
    },
  );
}
