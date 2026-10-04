import 'package:flutter/material.dart';
import '../data/app_repository.dart';
import '../data/synthetic_data.dart';
import '../theme.dart';
import 'overview_screen.dart';
import 'members_screen.dart';
import 'tasks_screen.dart';
import 'announcements_screen.dart';
import 'finance_screen.dart';

class HomeShell extends StatefulWidget {
  final SyntheticDataRepository repo;

  const HomeShell({super.key, required this.repo});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _currentIndex = 0;

  /// Finance is a secondary destination: the bottom bar keeps its four items.
  void _openFinance() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => FinanceScreen(repo: widget.repo)));
  }

  Future<void> _retryConnection() async {
    if (widget.repo is AppRepository) {
      final repo = widget.repo as AppRepository;
      await repo.refreshCurrentScope();
      if (!mounted || repo.errorMessage == null) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(repo.errorMessage!)));
      return;
    }
    widget.repo.setOffline(false);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.repo,
      builder: (context, _) {
        final appRepo = widget.repo is AppRepository ? widget.repo as AppRepository : null;
        if (appRepo?.requiresSignIn == true || appRepo?.requiresAuthorization == true) {
          final accessRevoked = appRepo?.requiresAuthorization == true;
          return Scaffold(
            appBar: AppBar(title: Text(accessRevoked ? 'Account access denied' : 'Session expired')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.lock_outline, size: 40),
                    const SizedBox(height: 12),
                    Text(accessRevoked
                        ? 'This account no longer has access. Sign in again after access is restored.'
                        : 'Your session expired. Sign in again to continue.'),
                    const SizedBox(height: 12),
                    FilledButton(
                      key: const Key('btn-session-sign-in'),
                      onPressed: () => _showSignInDialog(context, useDevelopmentDefaults: false),
                      child: const Text('Sign in'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        final availableScopes = widget.repo.availableScopes;
        final textScaler = MediaQuery.textScalerOf(context);
        final largeText = textScaler.scale(1) > 1.3;
        final offlineMessage = widget.repo is AppRepository && (widget.repo as AppRepository).cacheAge != null
            ? 'Offline: Showing cached reads (${(widget.repo as AppRepository).cacheAge}). Mutations disabled.'
            : 'Offline: Showing cached reads. Mutations disabled.';
        const offlineTextStyle = TextStyle(color: AppColors.warning, fontSize: 12, height: 1.3, fontWeight: FontWeight.w700);
        final offlineTextPainter = TextPainter(
          text: TextSpan(text: offlineMessage, style: offlineTextStyle),
          textDirection: Directionality.of(context),
          textScaler: textScaler,
        )..layout(maxWidth: (MediaQuery.sizeOf(context).width - 56).clamp(120.0, double.infinity).toDouble());
        final offlineBannerHeight = largeText
            ? (offlineTextPainter.height + 60).clamp(104.0, double.infinity).toDouble()
            : (textScaler.scale(12) * 3 + 8).clamp(56.0, double.infinity).toDouble();

        return Scaffold(
          backgroundColor: widget.repo.isOffline
              ? AppColors.backgroundOffline
              : widget.repo.currentScope == 'all'
                  ? AppColors.backgroundCombined
                  : AppColors.background,
          appBar: AppBar(
            title: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.58),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Organization',
                    style: TextStyle(fontSize: 11, height: 1.1, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                  ),
                  Semantics(
                    label: 'Organization scope',
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        key: const Key('dropdown-scope'),
                        value: widget.repo.currentScope,
                        dropdownColor: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        isExpanded: true,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.text),
                        items: availableScopes.map((s) {
                          return DropdownMenuItem(
                            value: s.id,
                            child: Text(s.name, overflow: TextOverflow.ellipsis),
                          );
                        }).toList(),
                        onChanged: (newScope) {
                          if (newScope != null) {
                            widget.repo.setScope(newScope);
                          }
                        },
                      ),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              IconButton(
                key: const Key('btn-refresh'),
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh / Sync',
                onPressed: () async {
                  if (widget.repo is AppRepository) {
                    await (widget.repo as AppRepository).refreshCurrentScope();
                    if (context.mounted && (widget.repo as AppRepository).errorMessage != null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text((widget.repo as AppRepository).errorMessage!)),
                      );
                    }
                  }
                },
              ),
              // Persona Switcher Popup
              PopupMenuButton<String>(
                key: const Key('popup-persona'),
                icon: CircleAvatar(
                  radius: 14,
                  backgroundColor: widget.repo.currentUser.avatarColor,
                  child: Text(
                    widget.repo.currentUser.displayName.substring(0, 1).toUpperCase(),
                    style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold),
                  ),
                ),
                tooltip: 'Account & Demo Personas',
                onSelected: (persona) {
                  switch (persona) {
                    case 'finance':
                      _openFinance();
                      break;
                    case 'sign_in':
                      _showSignInDialog(context);
                      break;
                    case 'accept_invite':
                      _showAcceptInviteDialog(context);
                      break;
                    case 'sign_out':
                      if (widget.repo is AppRepository) {
                        (widget.repo as AppRepository).logout();
                      } else {
                        widget.repo.resetToInitial();
                      }
                      break;
                    case 'len':
                      widget.repo.switchPersona(SyntheticDataRepository.userLen);
                      break;
                    case 'alex':
                      widget.repo.switchPersona(SyntheticDataRepository.userAlex);
                      break;
                    case 'sam':
                      widget.repo.switchPersona(SyntheticDataRepository.userSam);
                      break;
                    case 'jordan':
                      widget.repo.switchPersona(SyntheticDataRepository.userJordan);
                      break;
                    case 'offline_toggle':
                      widget.repo.setOffline(!widget.repo.isOffline);
                      break;
                    case 'reset':
                      widget.repo.resetToInitial();
                      break;
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'finance',
                    child: Text('Finance'),
                  ),
                  const PopupMenuItem(
                    value: 'sign_in',
                    child: Text('Sign In (API)'),
                  ),
                  const PopupMenuItem(
                    value: 'accept_invite',
                    child: Text('Accept Invitation (API)'),
                  ),
                  const PopupMenuItem(
                    value: 'sign_out',
                    child: Text('Sign Out'),
                  ),
                  const PopupMenuDivider(),
                  const PopupMenuItem(
                    enabled: false,
                    child: Text('DEMO PERSONAS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  PopupMenuItem(
                    value: 'len',
                    child: Text('Len (Owner) ${widget.repo.currentUser.id == 'usr-owner' ? '✓' : ''}'),
                  ),
                  PopupMenuItem(
                    value: 'alex',
                    child: Text('Alex Rivera (Lead) ${widget.repo.currentUser.id == 'usr-alex' ? '✓' : ''}'),
                  ),
                  PopupMenuItem(
                    value: 'sam',
                    child: Text('Sam Taylor (Member) ${widget.repo.currentUser.id == 'usr-sam' ? '✓' : ''}'),
                  ),
                  PopupMenuItem(
                    value: 'jordan',
                    child: Text('Jordan Lee (Lead) ${widget.repo.currentUser.id == 'usr-jordan' ? '✓' : ''}'),
                  ),
                  const PopupMenuDivider(),
                  PopupMenuItem(
                    value: 'offline_toggle',
                    child: Text(widget.repo.isOffline ? 'Go Online (Currently Offline)' : 'Simulate Offline (UI-REQ-008)'),
                  ),
                  const PopupMenuItem(
                    value: 'reset',
                    child: Text('Reset Demo Data'),
                  ),
                ],
              ),
              const SizedBox(width: 8),
            ],
            bottom: widget.repo.isOffline
                ? PreferredSize(
                    preferredSize: Size.fromHeight(offlineBannerHeight),
                    child: Container(
                      color: AppColors.warningBg,
                      width: double.infinity,
                      padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 8, 4),
                      child: largeText
                          ? Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.wifi_off, size: 18, color: AppColors.warning),
                                    const SizedBox(width: 8),
                                    Expanded(child: Text(offlineMessage, style: offlineTextStyle)),
                                  ],
                                ),
                                Align(alignment: AlignmentDirectional.centerEnd, child: _retryButton()),
                              ],
                            )
                          : Row(
                              children: [
                                const Icon(Icons.wifi_off, size: 18, color: AppColors.warning),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    offlineMessage,
                                    style: offlineTextStyle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                _retryButton(),
                              ],
                            ),
                    ),
                  )
                : null,
          ),
          body: appRepo != null && !appRepo.hasAccessToScope
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('Access to this organization was denied. Choose another organization to continue.'),
                  ),
                )
              : IndexedStack(
                  index: _currentIndex,
                  children: [
                    OverviewScreen(
                      repo: widget.repo,
                      onNavigateToTasks: () => setState(() => _currentIndex = 2),
                      onNavigateToAnnouncements: () => setState(() => _currentIndex = 3),
                      onOpenFinance: _openFinance,
                    ),
                    MembersScreen(repo: widget.repo),
                    TasksScreen(repo: widget.repo),
                    AnnouncementsScreen(repo: widget.repo),
                  ],
                ),
          bottomNavigationBar: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: NavigationBar(
              selectedIndex: _currentIndex,
              onDestinationSelected: (index) => setState(() => _currentIndex = index),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  selectedIcon: Icon(Icons.dashboard),
                  label: 'Overview',
                ),
                NavigationDestination(
                  icon: Icon(Icons.people_outline),
                  selectedIcon: Icon(Icons.people),
                  label: 'Members',
                ),
                NavigationDestination(
                  icon: Icon(Icons.check_box_outlined),
                  selectedIcon: Icon(Icons.check_box),
                  label: 'Tasks',
                ),
                NavigationDestination(
                  icon: Icon(Icons.campaign_outlined),
                  selectedIcon: Icon(Icons.campaign),
                  label: 'Announcements',
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showSignInDialog(BuildContext context, {bool useDevelopmentDefaults = true}) {
    final emailCtrl = TextEditingController(text: useDevelopmentDefaults ? 'len@example.com' : '');
    final passCtrl = TextEditingController(text: useDevelopmentDefaults ? 'LocalDevPass123!' : '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign In to Account'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: emailCtrl,
              decoration: const InputDecoration(labelText: 'Email Address'),
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: passCtrl,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              if (widget.repo is AppRepository) {
                final success = await (widget.repo as AppRepository).login(
                  emailCtrl.text.trim(),
                  passCtrl.text,
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        success ? 'Signed in successfully.' : ((widget.repo as AppRepository).errorMessage ?? 'Sign in failed.'),
                      ),
                    ),
                  );
                }
              }
            },
            child: const Text('Sign In'),
          ),
        ],
      ),
    );
  }

  void _showAcceptInviteDialog(BuildContext context) {
    final tokenCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final passCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Accept Invitation'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: tokenCtrl,
                decoration: const InputDecoration(labelText: 'Invitation Token / Code'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailCtrl,
                decoration: const InputDecoration(labelText: 'Email Address'),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Display Name'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: passCtrl,
                decoration: const InputDecoration(labelText: 'New Password'),
                obscureText: true,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              if (widget.repo is AppRepository) {
                final success = await (widget.repo as AppRepository).acceptInvitation(
                  token: tokenCtrl.text.trim(),
                  email: emailCtrl.text.trim(),
                  password: passCtrl.text,
                  displayName: nameCtrl.text.trim(),
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        success ? 'Invitation accepted! Welcome.' : ((widget.repo as AppRepository).errorMessage ?? 'Failed to accept invitation.'),
                      ),
                    ),
                  );
                }
              }
            },
            child: const Text('Accept & Join'),
          ),
        ],
      ),
    );
  }

  Widget _retryButton() => TextButton(
        key: const Key('btn-retry-sync'),
        onPressed: _retryConnection,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.warning,
          minimumSize: const Size(48, 48),
          padding: const EdgeInsets.symmetric(horizontal: 8),
        ),
        child: const Text('Retry'),
      );
}
