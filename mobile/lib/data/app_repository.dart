import '../models/models.dart';
import '../services/api_client.dart';
import '../services/secure_cache_service.dart';
import '../services/session_context_store.dart';
import 'synthetic_data.dart';

class AppRepository extends SyntheticDataRepository {
  final ApiClient apiClient;
  final SecureCacheService cacheService;
  final bool isDemoOnly;

  bool _isLoading = false;
  String? _errorMessage;
  String? _cacheAge;
  bool _isStale = false;
  bool _hasAccessToScope = true;
  bool _hasSession = false;
  bool _requiresSignIn = false;
  bool _requiresAuthorization = false;
  final Set<String> _deniedScopes = {};

  AppRepository({
    ApiClient? apiClient,
    SecureCacheService? cacheService,
    this.isDemoOnly = false,
  }) : apiClient = apiClient ?? ApiClient(),
       cacheService = cacheService ?? SecureCacheService(),
       super();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get cacheAge => _cacheAge;
  bool get isStale => _isStale;
  bool get hasAccessToScope => _hasAccessToScope;
  bool get requiresSignIn => _requiresSignIn;
  bool get requiresAuthorization => _requiresAuthorization;

  /// True once a member has signed in to the API in this app run.
  bool get hasSession => _hasSession;

  Future<bool> restoreSession() async {
    clearProtectedData();
    _hasSession = false;
    _requiresSignIn = false;
    _requiresAuthorization = false;
    _errorMessage = null;
    _cacheAge = null;
    _setLoading(true);
    try {
      final context = await SessionContextStore(apiClient.storage).read();
      final refreshToken = await apiClient.getRefreshToken();
      final sessionId = await apiClient.getSessionId();
      final expiry = await apiClient.getSessionExpiry();
      if (refreshToken == null ||
          sessionId == null ||
          (expiry != null && !expiry.isAfter(DateTime.now()))) {
        if (context != null) await cacheService.clearAccount(context.user.id);
        await apiClient.clearTokens();
        return false;
      }
      if (context != null && context.expiresAt.isAfter(DateTime.now())) {
        setOrganizations(context.organizations);
        switchPersona(context.user);
        _selectPermittedScope(context.scope);
      }
      final savedScope = currentScope;
      await refreshCurrentScope();
      if (_hasSession && currentScope != savedScope && !isOffline) {
        await refreshCurrentScope();
      }
      _hasSession =
          !_requiresSignIn &&
          !_requiresAuthorization &&
          currentUser.id.isNotEmpty &&
          (!isOffline || _cacheAge != null);
      return _hasSession;
    } catch (_) {
      clearProtectedData();
      await cacheService.clearAll();
      await apiClient.clearTokens();
      _errorMessage =
          'Your saved session could not be restored. Sign in again.';
      return false;
    } finally {
      _setLoading(false);
    }
  }

  void _selectPermittedScope(String requestedScope) {
    final scopes = availableScopes;
    super.setScope(
      scopes.any((scope) => scope.id == requestedScope)
          ? requestedScope
          : (scopes.isEmpty ? '' : scopes.first.id),
    );
  }

  Future<void> _rememberSession() async {
    final expiry = await apiClient.getSessionExpiry();
    if (expiry == null || currentUser.id.isEmpty) return;
    final allowedOrganizations = organizations
        .where((org) => !_deniedScopes.contains(org.id))
        .toList();
    final userJson = currentUser.toJson();
    userJson['memberships'] = currentUser.memberships
        .where((membership) => !_deniedScopes.contains(membership.orgId))
        .map((membership) => membership.toJson())
        .toList();
    await SessionContextStore(apiClient.storage).save(
      SessionContext(
        user: UserAccount.fromJson(userJson),
        organizations: allowedOrganizations,
        scope: currentScope,
        expiresAt: expiry,
      ),
    );
  }

  Future<void> selectScope(String scope) async {
    if (!availableScopes.any((organization) => organization.id == scope)) {
      return;
    }
    setScope(scope);
    await refreshCurrentScope();
  }

  /// Sign in with credentials via real API
  Future<bool> login(String email, String password) async {
    if (isDemoOnly) {
      // Demo persona lookup
      if (email == SyntheticDataRepository.userLen.email) {
        switchPersona(SyntheticDataRepository.userLen);
        return true;
      } else if (email == SyntheticDataRepository.userAlex.email) {
        switchPersona(SyntheticDataRepository.userAlex);
        return true;
      } else if (email == SyntheticDataRepository.userSam.email) {
        switchPersona(SyntheticDataRepository.userSam);
        return true;
      } else if (email == SyntheticDataRepository.userJordan.email) {
        switchPersona(SyntheticDataRepository.userJordan);
        return true;
      }
      return false;
    }

    _setLoading(true);
    try {
      final res = await apiClient.login(email, password);
      final user = _accountFrom(res);

      // Account switch isolation: if switching away from another account, clear old account cache
      if (currentUser.id.isNotEmpty && currentUser.id != user.id) {
        await cacheService.clearAccount(currentUser.id);
      }

      clearProtectedData();
      _storeOrganizationsFrom(res);

      _hasSession = true;
      _requiresSignIn = false;
      _requiresAuthorization = false;
      _deniedScopes.clear();
      switchPersona(user);
      _selectPermittedScope(currentScope);
      await _rememberSession();
      await refreshCurrentScope();
      if (!_requiresSignIn && !_requiresAuthorization) _errorMessage = null;
      return !_requiresSignIn && !_requiresAuthorization;
    } on NetworkException {
      _errorMessage = 'Unable to connect. Check your connection and try again.';
      notifyListeners();
      return false;
    } on ApiException {
      _errorMessage =
          'Sign-in was not accepted. Check your email and password, then try again.';
      notifyListeners();
      return false;
    } catch (_) {
      _errorMessage = 'Unable to sign in. Please try again.';
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign out and clear protected cached data (REQ-005, REQ-007)
  Future<void> logout() async {
    final accountId = currentUser.id;
    _setLoading(true);
    _hasSession = false;
    _requiresSignIn = true;
    _errorMessage = null;
    _cacheAge = null;
    _isStale = false;
    _deniedScopes.clear();
    clearProtectedData();
    try {
      if (accountId.isNotEmpty) await cacheService.clearAccount(accountId);
      await SessionContextStore(apiClient.storage).clear();
    } finally {
      try {
        await apiClient.logout();
      } finally {
        _setLoading(false);
      }
    }
  }

  /// Accept an invitation token (REQ-001)
  Future<bool> acceptInvitation({
    required String token,
    required String email,
    required String password,
    required String displayName,
  }) async {
    if (isOffline) {
      _errorMessage = 'Cannot accept invitations while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    _setLoading(true);
    try {
      final res = await apiClient.acceptInvitation(
        token: token,
        email: email,
        password: password,
        displayName: displayName,
      );
      final user = _accountFrom(res);
      _storeOrganizationsFrom(res);

      _hasSession = true;
      _requiresSignIn = false;
      _requiresAuthorization = false;
      _deniedScopes.clear();
      switchPersona(user);
      await refreshCurrentScope();
      if (!_requiresSignIn && !_requiresAuthorization) _errorMessage = null;
      return !_requiresSignIn && !_requiresAuthorization;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Invitation acceptance failed: $e';
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Refresh / synchronize data for the currently selected scope
  Future<void> refreshCurrentScope() async {
    if (isDemoOnly) {
      notifyListeners();
      return;
    }

    _setLoading(true);
    _errorMessage = null;
    var readingScope = currentScope;
    var readingOrganizationData = false;
    var readingCombinedAnnouncements = false;

    try {
      final requestedScope = currentScope;

      // 1. Revalidate user account & memberships (REQ-004, REQ-007)
      final meRes = await apiClient.getCurrentUser();
      final freshUser = _accountFrom(meRes);
      _storeOrganizationsFrom(meRes);

      // Verify requested scope access before switching persona alters currentScope
      if (requestedScope != 'all') {
        final hasMembership = freshUser.memberships.any(
          (m) => m.orgId == requestedScope && m.status == 'active',
        );
        if (!freshUser.isGlobalOwner && !hasMembership) {
          _denyOrganization(requestedScope);
          await cacheService.clearOrganization(
            accountId: freshUser.id,
            organizationId: requestedScope,
          );
          _errorMessage =
              'Access denied: Active membership required for this organization.';
          switchPersona(freshUser);
          _hasAccessToScope = !_deniedScopes.contains(currentScope);
          _hasSession = true;
          notifyListeners();
          return;
        }
      }
      _hasAccessToScope = true;
      switchPersona(freshUser);
      _selectPermittedScope(currentScope);
      _hasSession = true;

      // 2. Fetch fresh records from server
      // Members and tasks are served per organization; the combined scope reads each one.
      final scopedOrgIds = currentScope == 'all'
          ? organizations.map((o) => o.id).toList()
          : (currentScope.isEmpty ? <String>[] : [currentScope]);
      final membersJson = <dynamic>[];
      final tasksJson = <dynamic>[];
      for (final orgId in scopedOrgIds) {
        readingScope = orgId;
        readingOrganizationData = true;
        membersJson.addAll(
          (await apiClient.getMembers(orgId, limit: 25))['members']
                  as List<dynamic>? ??
              const [],
        );
        tasksJson.addAll(
          (await apiClient.getTasks(orgId, limit: 25))['tasks']
                  as List<dynamic>? ??
              const [],
        );
      }
      readingScope = currentScope == 'all' ? '' : currentScope;
      readingOrganizationData = currentScope != 'all';
      readingCombinedAnnouncements = currentScope == 'all';
      final annRes = currentScope.isEmpty
          ? <String, dynamic>{'announcements': []}
          : await apiClient.getAnnouncements(currentScope, limit: 25);

      final membersList = _excludeDeniedMembers(
        membersJson
            .map((m) => MemberRecord.fromJson(m as Map<String, dynamic>))
            .toList(),
      );
      final tasksList = _excludeDeniedTasks(
        tasksJson
            .map((t) => TaskItem.fromJson(t as Map<String, dynamic>))
            .toList(),
      );
      final annList = _excludeDeniedAnnouncements(
        (annRes['announcements'] as List<dynamic>?)
                ?.map(
                  (a) => AnnouncementItem.fromJson(a as Map<String, dynamic>),
                )
                .toList() ??
            [],
      );

      // Replace local state
      _updateScopedData(membersList, tasksList, annList);

      // 3. Cache successful snapshots (REQ-002, FEAT-005 bounds)
      final sessionExpiry = await apiClient.getSessionExpiry();
      await cacheService.saveSnapshot(
        accountId: freshUser.id,
        scope: currentScope,
        destination: 'members',
        rawPayload: membersJson,
        sessionExpiry: sessionExpiry,
      );
      await cacheService.saveSnapshot(
        accountId: freshUser.id,
        scope: currentScope,
        destination: 'tasks',
        rawPayload: tasksJson,
        sessionExpiry: sessionExpiry,
      );
      await cacheService.saveSnapshot(
        accountId: freshUser.id,
        scope: currentScope,
        destination: 'announcements',
        rawPayload: annRes['announcements'],
        sessionExpiry: sessionExpiry,
      );

      // Online success: remove stale indicator
      setOffline(false);
      _isStale = false;
      _cacheAge = null;
      _errorMessage = null;
      await _rememberSession();
    } on NetworkException catch (_) {
      // Offline fallback: load cached read snapshots (REQ-002, REQ-008)
      await _loadFromCacheFallback();
    } on AuthorizationException catch (e) {
      // Gate a selected organization and remove its memory data before awaiting cache storage.
      if (readingOrganizationData &&
          readingScope.isNotEmpty &&
          readingScope != 'all') {
        _denyOrganization(readingScope);
        await cacheService.clearOrganization(
          accountId: currentUser.id,
          organizationId: readingScope,
        );
      } else if (readingCombinedAnnouncements) {
        // A combined announcement denial does not identify one affected organization.
        setAnnouncements([]);
        await cacheService.clearSnapshot(
          accountId: currentUser.id,
          scope: 'all',
          destination: 'announcements',
        );
      } else {
        // A 403 from account validation applies to the complete account, not this organization.
        final accountId = currentUser.id;
        _requiresAuthorization = true;
        _hasSession = false;
        clearProtectedData();
        try {
          await cacheService.clearAccount(accountId);
        } finally {
          await apiClient.clearTokens();
        }
      }
      _errorMessage = 'Permission denied (403): ${e.message}';
      setOffline(false);
      if (_hasSession) {
        await _rememberSession();
      }
    } on AuthenticationException catch (_) {
      // A final 401 arrives after the API client's refresh and single retry fail.
      final accountId = currentUser.id;
      _requiresSignIn = true;
      _hasSession = false;
      clearProtectedData();
      try {
        await cacheService.clearAccount(accountId);
      } finally {
        await apiClient.clearTokens();
      }
      _errorMessage = 'Session expired (401). Please sign in again.';
      setOffline(false);
    } catch (_) {
      _errorMessage = 'Unable to load this view. Please retry.';
    } finally {
      _setLoading(false);
    }
  }

  /// Organization rows of an auth response: id, name, status, role, membership_status.
  List<Map<String, dynamic>> _organizationRows(
    Map<String, dynamic> authResponse,
  ) {
    final rows = authResponse['organizations'] as List<dynamic>? ?? const [];
    return rows.cast<Map<String, dynamic>>();
  }

  /// The API reports the owner flag as `isOwner` and memberships as organization rows.
  UserAccount _accountFrom(Map<String, dynamic> authResponse) {
    final userJson = Map<String, dynamic>.of(
      authResponse['user'] as Map<String, dynamic>,
    );
    userJson['isGlobalOwner'] ??= userJson['isOwner'];
    userJson['memberships'] ??= _organizationRows(authResponse)
        .map(
          (org) => {
            'orgId': org['id'],
            'role': org['role'],
            'status': org['membership_status'] ?? 'active',
          },
        )
        .toList();
    return UserAccount.fromJson(userJson);
  }

  void _storeOrganizationsFrom(Map<String, dynamic> authResponse) {
    final rows = _organizationRows(authResponse);
    if (authResponse.containsKey('organizations')) {
      setOrganizations(rows.map(Org.fromJson).toList());
    }
  }

  @override
  void setScope(String scope) {
    _hasAccessToScope = !_deniedScopes.contains(scope);
    super.setScope(scope);
  }

  void _denyOrganization(String organizationId) {
    _deniedScopes.add(organizationId);
    if (currentScope == organizationId) _hasAccessToScope = false;
    clearOrganizationRecords(organizationId);
  }

  List<MemberRecord> _excludeDeniedMembers(List<MemberRecord> records) =>
      records.where((record) => !_deniedScopes.contains(record.orgId)).toList();

  List<TaskItem> _excludeDeniedTasks(List<TaskItem> records) =>
      records.where((record) => !_deniedScopes.contains(record.orgId)).toList();

  List<AnnouncementItem> _excludeDeniedAnnouncements(
    List<AnnouncementItem> records,
  ) => records
      .map((announcement) {
        final targets = announcement.targetOrgs
            .where((id) => !_deniedScopes.contains(id))
            .toList();
        if (targets.isEmpty) return null;
        if (targets.length == announcement.targetOrgs.length) {
          return announcement;
        }
        return AnnouncementItem(
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          authorId: announcement.authorId,
          authorName: announcement.authorName,
          targetOrgs: targets,
          status: announcement.status,
          publishedAt: announcement.publishedAt,
          archived: announcement.archived,
        );
      })
      .whereType<AnnouncementItem>()
      .toList();

  Future<void> _loadFromCacheFallback() async {
    final accountId = currentUser.id;
    if (accountId.isEmpty) {
      setOffline(true);
      _isStale = true;
      _cacheAge = null;
      notifyListeners();
      return;
    }

    final membersSnap = await cacheService.getSnapshot(
      accountId: accountId,
      scope: currentScope,
      destination: 'members',
    );
    final tasksSnap = await cacheService.getSnapshot(
      accountId: accountId,
      scope: currentScope,
      destination: 'tasks',
    );
    final annSnap = await cacheService.getSnapshot(
      accountId: accountId,
      scope: currentScope,
      destination: 'announcements',
    );

    if (membersSnap != null || tasksSnap != null || annSnap != null) {
      // Valid snapshot exists
      final mList = membersSnap != null && membersSnap.payload is List
          ? (membersSnap.payload as List)
                .map((m) => MemberRecord.fromJson(m as Map<String, dynamic>))
                .toList()
          : <MemberRecord>[];

      final tList = tasksSnap != null && tasksSnap.payload is List
          ? (tasksSnap.payload as List)
                .map((t) => TaskItem.fromJson(t as Map<String, dynamic>))
                .toList()
          : <TaskItem>[];

      final aList = annSnap != null && annSnap.payload is List
          ? (annSnap.payload as List)
                .map(
                  (a) => AnnouncementItem.fromJson(a as Map<String, dynamic>),
                )
                .toList()
          : <AnnouncementItem>[];

      _updateScopedData(
        _excludeDeniedMembers(mList),
        _excludeDeniedTasks(tList),
        _excludeDeniedAnnouncements(aList),
      );

      final representativeSnap = tasksSnap ?? membersSnap ?? annSnap;
      setOffline(true);
      _isStale = true;
      _cacheAge = representativeSnap?.formattedAge ?? 'Cached';
    } else {
      _updateScopedData([], [], []);
      // No valid cache or expired (REQ-007 capacity eviction or 24h expiry)
      setOffline(true);
      _isStale = true;
      _cacheAge = null;
      _errorMessage =
          'Offline: No cached data available for this view (connection required).';
    }
    notifyListeners();
  }

  void _updateScopedData(
    List<MemberRecord> membersList,
    List<TaskItem> tasksList,
    List<AnnouncementItem> annList,
  ) {
    if (currentScope == 'all') {
      // Replace all
      setMembers(membersList);
      setTasks(tasksList);
      setAnnouncements(annList);
    } else {
      // Update records for currentScope while preserving other organizations
      final otherMembers = allMembers
          .where((m) => m.orgId != currentScope)
          .toList();
      setMembers(_excludeDeniedMembers([...otherMembers, ...membersList]));

      final otherTasks = allTasks
          .where((t) => t.orgId != currentScope)
          .toList();
      setTasks(_excludeDeniedTasks([...otherTasks, ...tasksList]));

      final otherAnn = allAnnouncements
          .where((a) => !a.targetOrgs.contains(currentScope))
          .toList();
      setAnnouncements(_excludeDeniedAnnouncements([...otherAnn, ...annList]));
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // --- Overridden Mutations with Offline Protection & API Sync ---

  @override
  bool inviteMember({
    required String email,
    required String orgId,
    required String role,
  }) {
    if (isOffline) {
      _errorMessage = 'Cannot invite members while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.inviteMember(email: email, orgId: orgId, role: role);
    }

    // Async server call in background, update immediately on success
    apiClient
        .inviteMember(organizationId: orgId, email: email, role: role)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to invite: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool updateMemberNotes(String memberId, String notes) {
    if (isOffline) {
      _errorMessage = 'Cannot edit notes while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.updateMemberNotes(memberId, notes);
    }

    apiClient
        .updateMemberNotes(memberId, notes)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to update notes: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool toggleMemberDeactivation(String memberId) {
    if (isOffline) {
      _errorMessage = 'Cannot change member status while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.toggleMemberDeactivation(memberId);
    }

    final m = getScopedMembers().firstWhere((x) => x.id == memberId);
    final newStatus = m.status == 'active' ? 'inactive' : 'active';

    apiClient
        .updateMemberStatus(memberId, newStatus)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to update member status: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool createTask({
    required String orgId,
    required String title,
    required String description,
    required String priority,
    String? assignee,
    String? dueDate,
    List<String> labels = const [],
  }) {
    if (isOffline) {
      _errorMessage = 'Cannot create tasks while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.createTask(
        orgId: orgId,
        title: title,
        description: description,
        priority: priority,
        assignee: assignee,
        dueDate: dueDate,
        labels: labels,
      );
    }

    apiClient
        .createTask(
          organizationId: orgId,
          title: title,
          description: description,
          priority: priority,
          assigneeId: assignee,
          dueDate: dueDate,
          labels: labels,
        )
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to create task: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool updateTaskStatus(String taskId, String newStatus) {
    if (isOffline) {
      _errorMessage = 'Cannot update task status while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.updateTaskStatus(taskId, newStatus);
    }

    final task = getScopedTasks(
      includeArchived: true,
    ).firstWhere((t) => t.id == taskId);
    apiClient
        .updateTaskStatus(taskId, newStatus, task.version)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to update status: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool addTaskComment(String taskId, String body) {
    if (isOffline) {
      _errorMessage = 'Cannot add comments while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.addTaskComment(taskId, body);
    }

    apiClient
        .addTaskComment(taskId, body)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to post comment: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool archiveTask(String taskId) {
    if (isOffline) {
      _errorMessage = 'Cannot archive tasks while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.archiveTask(taskId);
    }

    apiClient.archiveTask(taskId).then((_) => refreshCurrentScope()).catchError(
      (err) {
        _errorMessage = 'Failed to archive task: $err';
        notifyListeners();
      },
    );

    return true;
  }

  @override
  bool createAnnouncement({
    required String title,
    required String body,
    required List<String> targetOrgs,
    required bool publishNow,
  }) {
    if (isOffline) {
      _errorMessage = 'Cannot create announcements while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.createAnnouncement(
        title: title,
        body: body,
        targetOrgs: targetOrgs,
        publishNow: publishNow,
      );
    }

    apiClient
        .createAnnouncement(
          title: title,
          body: body,
          targetOrganizations: targetOrgs,
          publishNow: publishNow,
        )
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to create announcement: $err';
          notifyListeners();
        });

    return true;
  }

  @override
  bool archiveAnnouncement(String annId) {
    if (isOffline) {
      _errorMessage =
          'Cannot archive announcements while offline (UI-REQ-008).';
      notifyListeners();
      return false;
    }

    if (isDemoOnly) {
      return super.archiveAnnouncement(annId);
    }

    apiClient
        .archiveAnnouncement(annId)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
          _errorMessage = 'Failed to archive announcement: $err';
          notifyListeners();
        });

    return true;
  }
}
