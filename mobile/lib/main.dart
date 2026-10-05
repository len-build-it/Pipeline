import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'data/app_repository.dart';
import 'data/synthetic_data.dart';
import 'screens/home_shell.dart';
import 'screens/sign_in_screen.dart';
import 'screens/invitation_screen.dart';
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
  final _navigators = {
    for (final entry in _Entry.values) entry: GlobalKey<NavigatorState>(),
  };
  GlobalKey<NavigatorState> get _navigator => _navigators[_entry]!;

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

  void _tryDemo() {
    setState(() {
      _demo = SyntheticDataRepository();
      _entry = _Entry.demo;
    });
  }

  void _leaveDemo() {
    final demo = _demo;
    setState(() {
      _demo = null;
      _entry = _Entry.signedOut;
    });
    if (demo != widget.initialRepo) {
      WidgetsBinding.instance.addPostFrameCallback((_) => demo?.dispose());
    }
  }

  @override
  void dispose() {
    _account.removeListener(_sessionChanged);
    if (widget.initialRepo != _account) _account.dispose();
    if (_demo != widget.initialRepo) _demo?.dispose();
    super.dispose();
  }

  Future<void> _openInvitation(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => InvitationScreen(
          repository: _account,
          onJoined: () => Navigator.of(context).pop(),
        ),
      ),
    );
    if (mounted && _account.hasSession) {
      setState(() => _entry = _Entry.authenticated);
    }
  }

  Widget _entryPage(BuildContext context) => switch (_entry) {
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
      onTryDemo: _tryDemo,
      onCreateAccount: () => _openInvitation(context),
      onAuthenticated: () => setState(() => _entry = _Entry.authenticated),
    ),
    _Entry.authenticated => HomeShell(
      repo: _account,
      onInvitation: () => _openInvitation(context),
    ),
    _Entry.demo => HomeShell(repo: _demo!, onLeaveDemo: _leaveDemo),
  };

  Widget _navigation() => KeyedSubtree(
    key: ValueKey(_entry),
    // Child notifications must not disable Android back handling at entry.
    child: NotificationListener<NavigationNotification>(
      onNotification: (_) => true,
      child: Navigator(
        key: _navigator,
        onGenerateRoute: (_) =>
            MaterialPageRoute<void>(builder: (context) => _entryPage(context)),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Team Manager',
    debugShowCheckedModeBanner: false,
    theme: buildAppTheme(),
    // Replacing this navigator drops protected detail routes after sign-out.
    home: PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await _navigator.currentState!.maybePop()) return;
        if (!mounted) return;
        if (_entry == _Entry.demo) {
          _leaveDemo();
        } else {
          await SystemNavigator.pop();
        }
      },
      child: _entry == _Entry.demo
          ? Material(
              color: AppColors.aquaTint,
              child: SafeArea(
                bottom: false,
                child: Column(
                  children: [
                    Container(
                      constraints: const BoxConstraints(minHeight: 48),
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: const Text(
                        'Demo - sample data',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    Expanded(child: _navigation()),
                  ],
                ),
              ),
            )
          : _navigation(),
    ),
  );
}
