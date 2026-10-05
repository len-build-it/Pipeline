import 'package:flutter/material.dart';
import 'data/app_repository.dart';
import 'data/synthetic_data.dart';
import 'screens/home_shell.dart';
import 'screens/sign_in_screen.dart';
import 'theme.dart';

void main() => runApp(const TeamManagerApp());

enum _Entry { restoring, signedOut, authenticated, demo }

class TeamManagerApp extends StatefulWidget {
  final SyntheticDataRepository? initialRepo;
  const TeamManagerApp({super.key, this.initialRepo});
  @override
  State<TeamManagerApp> createState() => _TeamManagerAppState();
}

class _TeamManagerAppState extends State<TeamManagerApp> {
  late final AppRepository _account;
  SyntheticDataRepository? _demo;
  _Entry _entry = _Entry.restoring;

  @override
  void initState() {
    super.initState();
    final supplied = widget.initialRepo;
    _account = supplied is AppRepository ? supplied : AppRepository();
    _account.addListener(_sessionChanged);
    if (supplied != null && supplied is! AppRepository) {
      _demo = supplied;
      _entry = _Entry.demo;
    } else {
      _restore();
    }
  }

  Future<void> _restore() async {
    setState(() => _entry = _Entry.restoring);
    final restored = await _account.restoreSession();
    if (mounted) {
      setState(
        () => _entry = restored ? _Entry.authenticated : _Entry.signedOut,
      );
    }
  }

  void _sessionChanged() {
    if (_entry == _Entry.authenticated && !_account.hasSession) {
      setState(() => _entry = _Entry.signedOut);
    }
  }

  @override
  void dispose() {
    _account.removeListener(_sessionChanged);
    if (widget.initialRepo != _account) _account.dispose();
    super.dispose();
  }

  Widget _entryPage() => switch (_entry) {
    _Entry.restoring => Scaffold(
      body: Center(
        child: Semantics(
          liveRegion: true,
          label: 'Restoring your session',
          child: const CircularProgressIndicator(),
        ),
      ),
    ),
    _Entry.signedOut => SignInScreen(
      repository: _account,
      notice: _account.errorMessage,
      onRestore: _restore,
      onAuthenticated: () => setState(() => _entry = _Entry.authenticated),
    ),
    _Entry.authenticated => HomeShell(repo: _account),
    _Entry.demo => HomeShell(repo: _demo!),
  };

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Team Manager',
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    // Replacing this navigator drops protected detail routes after sign-out.
    home: Navigator(
      key: ValueKey(_entry),
      onGenerateRoute: (_) =>
          MaterialPageRoute<void>(builder: (_) => _entryPage()),
    ),
  );
}
