import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/app_repository.dart';
import '../services/api_client.dart';
import '../widgets/auth_form.dart';
import 'sign_in_screen.dart';

String? invitationCode(String input) {
  final value = input.trim();
  final format = RegExp(r'^[a-fA-F0-9]{64}$');
  if (format.hasMatch(value)) return value;
  try {
    final uri = Uri.parse(value);
    if (!['http', 'https'].contains(uri.scheme)) return null;
    final fragment = uri.fragment;
    final query = fragment.contains('?')
        ? fragment.substring(fragment.indexOf('?') + 1)
        : fragment;
    final token =
        uri.queryParameters['token'] ?? Uri.splitQueryString(query)['token'];
    return token != null && format.hasMatch(token) ? token : null;
  } on FormatException {
    return null;
  }
}

class InvitationScreen extends StatefulWidget {
  final AppRepository repository;
  final VoidCallback onJoined;
  const InvitationScreen({
    super.key,
    required this.repository,
    required this.onJoined,
  });
  @override
  State<InvitationScreen> createState() => _InvitationScreenState();
}

class _InvitationScreenState extends State<InvitationScreen> {
  final _code = TextEditingController();
  final _email = TextEditingController();
  final _name = TextEditingController();
  final _password = TextEditingController();
  final _codeFocus = FocusNode();
  final _emailFocus = FocusNode();
  final _nameFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _form = GlobalKey<FormState>();
  Map<String, dynamic>? _preview;
  String? _token;
  String? _error;
  bool _busy = false;
  bool _created = false;

  @override
  void dispose() {
    for (final controller in [_code, _email, _name, _password]) {
      controller.dispose();
    }
    for (final focus in [_codeFocus, _emailFocus, _nameFocus, _passwordFocus]) {
      focus.dispose();
    }
    super.dispose();
  }

  Future<void> _previewInvitation() async {
    if (_busy) return;
    final token = invitationCode(_code.text);
    if (token == null) {
      setState(
        () => _error =
            'Enter the invitation code or paste the full invitation link.',
      );
      _codeFocus.requestFocus();
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final preview = await widget.repository.apiClient.previewInvitation(
        token,
      );
      if (!mounted) return;
      if (preview['valid'] != true) {
        setState(
          () => _error = preview['status'] == 'expired'
              ? 'This invitation has expired. Ask your team lead for a new invitation.'
              : 'This invitation has already been used or is no longer valid. Ask your team lead for a new invitation.',
        );
        return;
      }
      setState(() {
        _preview = preview;
        _token = token;
        _email.text = preview['email'] as String;
      });
    } on NetworkException {
      _showError('Unable to connect. Keep your invitation and try again.');
    } catch (_) {
      _showError(
        'Invitation not found. Check the code or ask your team lead for a new invitation.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(String message) {
    if (mounted) setState(() => _error = message);
  }

  String? _validateRecipient(String? value) =>
      validateEmail(value) ??
      (value!.trim().toLowerCase() !=
              (_preview!['email'] as String).toLowerCase()
          ? 'Use the email address shown in your invitation.'
          : null);
  String? _validateName(String? value) =>
      value == null || value.trim().isEmpty || value.trim().length > 100
      ? 'Enter your name (1 to 100 characters).'
      : null;
  String? _validateNewPassword(String? value) =>
      value == null || value.length < 12 || value.length > 128
      ? 'Use 12 to 128 characters. Spaces are allowed.'
      : null;

  Future<void> _join() async {
    if (_busy) return;
    final repo = widget.repository;
    final existingAccount = repo.hasSession;
    if (existingAccount) {
      if (repo.currentUser.email.toLowerCase() !=
          (_preview!['email'] as String).toLowerCase()) {
        setState(
          () => _error =
              'Sign in with the email address shown in your invitation.',
        );
        return;
      }
    } else if (!_form.currentState!.validate()) {
      setState(() => _error = 'Check the highlighted fields and try again.');
      (_validateRecipient(_email.text) != null
              ? _emailFocus
              : _validateName(_name.text) != null
              ? _nameFocus
              : _passwordFocus)
          .requestFocus();
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (!_created) {
        await repo.apiClient.acceptInvitation(
          token: _token!,
          email: _email.text.trim(),
          password: existingAccount ? null : _password.text,
          displayName: existingAccount ? null : _name.text.trim(),
        );
        _created = !existingAccount;
      }
      if (!existingAccount &&
          !await repo.login(_email.text.trim(), _password.text)) {
        _showError(
          'Your account is ready, but sign-in could not finish. Try again or return to sign-in.',
        );
        return;
      }
      await repo.openInvitedOrganization(_preview!['organizationId'] as String);
      if (mounted && repo.hasSession) {
        TextInput.finishAutofillContext();
        widget.onJoined();
      }
    } on NetworkException {
      _showError('Unable to connect. Try again when your connection returns.');
    } on AuthorizationException {
      _showError('Sign in with the invitation email before accepting.');
    } on ApiException {
      _showError(
        'This invitation could not be accepted. Check the details or ask your team lead for a new invitation.',
      );
    } catch (_) {
      _showError('Unable to finish account setup. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signInExisting() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => SignInScreen(
          repository: widget.repository,
          initialEmail: _preview!['email'] as String,
          notice:
              'Sign in with your invitation email to join ${_preview!['organizationName']}.',
          onAuthenticated: () => Navigator.of(context).pop(),
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final signedIn = widget.repository.hasSession;
    return AuthPage(
      title: preview == null ? 'Have an invitation?' : 'Join your team',
      subtitle: preview == null
          ? 'Account setup is by invitation. Enter your code or paste the invitation link.'
          : 'You are invited to ${preview['organizationName']} as ${preview['role']}.',
      children: [
        if (_error != null) AuthMessage(_error!),
        if (preview == null) ...[
          TextField(
            key: const Key('invitation-code'),
            controller: _code,
            focusNode: _codeFocus,
            enabled: !_busy,
            autocorrect: false,
            enableSuggestions: false,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _previewInvitation(),
            decoration: const InputDecoration(
              labelText: 'Invitation code or link',
              errorMaxLines: 3,
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy ? null : _previewInvitation,
            child: Text(_busy ? 'Checking invitation...' : 'Continue'),
          ),
        ] else ...[
          Text('Invitation email: ${preview['email']}'),
          const SizedBox(height: 16),
          if (signedIn) ...[
            Text('Signed in as ${widget.repository.currentUser.email}'),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _join,
              child: Text(_busy ? 'Joining...' : 'Accept invitation'),
            ),
            TextButton(
              onPressed: _busy
                  ? null
                  : () async {
                      await widget.repository.logout();
                      if (mounted) setState(() {});
                    },
              child: const Text('Use a different account'),
            ),
          ] else ...[
            const Text('Use the same email address to create your account.'),
            const SizedBox(height: 16),
            AutofillGroup(
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _email,
                      focusNode: _emailFocus,
                      enabled: !_busy,
                      validator: _validateRecipient,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      textInputAction: TextInputAction.next,
                      onFieldSubmitted: (_) => _nameFocus.requestFocus(),
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        errorMaxLines: 3,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _name,
                      focusNode: _nameFocus,
                      enabled: !_busy,
                      validator: _validateName,
                      autofillHints: const [AutofillHints.name],
                      textInputAction: TextInputAction.next,
                      onFieldSubmitted: (_) => _passwordFocus.requestFocus(),
                      decoration: const InputDecoration(
                        labelText: 'Your name',
                        errorMaxLines: 3,
                      ),
                    ),
                    const SizedBox(height: 16),
                    AuthPasswordField(
                      controller: _password,
                      focusNode: _passwordFocus,
                      enabled: !_busy,
                      validator: _validateNewPassword,
                      label: 'Create password',
                      autofillHint: AutofillHints.newPassword,
                      onSubmit: _join,
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '12 to 128 characters. Spaces and paste are allowed.',
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _busy ? null : _join,
                      child: Text(
                        _busy
                            ? 'Setting up account...'
                            : _created
                            ? 'Retry sign-in'
                            : 'Create account and join',
                      ),
                    ),
                  ],
                ),
              ),
            ),
            TextButton(
              onPressed: _busy ? null : _signInExisting,
              child: const Text('Already have an account? Sign in'),
            ),
          ],
          if (!_created)
            TextButton(
              onPressed: _busy
                  ? null
                  : () => setState(() {
                      _preview = null;
                      _token = null;
                      _error = null;
                    }),
              child: const Text('Use another invitation'),
            ),
        ],
        const SizedBox(height: 8),
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(),
          child: const Text('Back'),
        ),
      ],
    );
  }
}
