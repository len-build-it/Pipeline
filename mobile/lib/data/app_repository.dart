import '../models/models.dart';
import '../services/api_client.dart';
import '../services/secure_cache_service.dart';
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

  AppRepository({
    ApiClient? apiClient,
    SecureCacheService? cacheService,
    this.isDemoOnly = false,
  })  : apiClient = apiClient ?? ApiClient(),
        cacheService = cacheService ?? SecureCacheService(),
        super();

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String? get cacheAge => _cacheAge;
  bool get isStale => _isStale;
  bool get hasAccessToScope => _hasAccessToScope;

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
      final userJson = res['user'] as Map<String, dynamic>;
      final user = UserAccount.fromJson(userJson);

      // Account switch isolation: if switching away from another account, clear old account cache
      if (currentUser.id.isNotEmpty && currentUser.id != user.id) {
        await cacheService.clearAccount(currentUser.id);
      }

      switchPersona(user);
      await refreshCurrentScope();
      _errorMessage = null;
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Login error: $e';
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign out and clear protected cached data (REQ-005, REQ-007)
  Future<void> logout() async {
    final accountId = currentUser.id;
    if (accountId.isNotEmpty) {
      await cacheService.clearAccount(accountId);
    }
    await apiClient.logout();
    resetToInitial();
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
      final userJson = res['user'] as Map<String, dynamic>;
      final user = UserAccount.fromJson(userJson);

      switchPersona(user);
      await refreshCurrentScope();
      _errorMessage = null;
      return true;
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

    try {
      final requestedScope = currentScope;

      // 1. Revalidate user account & memberships (REQ-004, REQ-007)
      final meRes = await apiClient.getCurrentUser();
      final freshUser = UserAccount.fromJson(meRes['user'] as Map<String, dynamic>);

      // Verify requested scope access before switching persona alters currentScope
      if (requestedScope != 'all') {
        final hasMembership = freshUser.memberships.any(
          (m) => m.orgId == requestedScope && m.status == 'active',
        );
        if (!freshUser.isGlobalOwner && !hasMembership) {
          _hasAccessToScope = false;
          // Purge cached records for this revoked scope (REQ-008)
          await cacheService.clearScope(accountId: freshUser.id, scope: requestedScope);
          _errorMessage = 'Access denied: Active membership required for this organization.';
          switchPersona(freshUser);
          notifyListeners();
          return;
        }
      }
      _hasAccessToScope = true;
      switchPersona(freshUser);

      // 2. Fetch fresh records from server
      final membersRes = await apiClient.getMembers(currentScope, limit: 25);
      final tasksRes = await apiClient.getTasks(currentScope, limit: 25);
      final annRes = await apiClient.getAnnouncements(currentScope, limit: 25);

      final membersList = (membersRes['members'] as List<dynamic>?)
              ?.map((m) => MemberRecord.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [];
      final tasksList = (tasksRes['tasks'] as List<dynamic>?)
              ?.map((t) => TaskItem.fromJson(t as Map<String, dynamic>))
              .toList() ??
          [];
      final annList = (annRes['announcements'] as List<dynamic>?)
              ?.map((a) => AnnouncementItem.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [];

      // Replace local state
      _updateScopedData(membersList, tasksList, annList);

      // 3. Cache successful snapshots (REQ-002, FEAT-005 bounds)
      final sessionExpiry = await apiClient.getSessionExpiry();
      await cacheService.saveSnapshot(
        accountId: freshUser.id,
        scope: currentScope,
        destination: 'members',
        rawPayload: membersRes['members'],
        sessionExpiry: sessionExpiry,
      );
      await cacheService.saveSnapshot(
        accountId: freshUser.id,
        scope: currentScope,
        destination: 'tasks',
        rawPayload: tasksRes['tasks'],
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
    } on NetworkException catch (_) {
      // Offline fallback: load cached read snapshots (REQ-002, REQ-008)
      await _loadFromCacheFallback();
    } on AuthorizationException catch (e) {
      // 403 clears the affected organization without showing stale data (REQ-008)
      _hasAccessToScope = false;
      await cacheService.clearScope(accountId: currentUser.id, scope: currentScope);
      _errorMessage = 'Permission denied (403): ${e.message}';
      setOffline(false);
    } on AuthenticationException catch (_) {
      // 401 after one refresh attempt clears protected cache and requires sign-in (REQ-008)
      await cacheService.clearAll();
      await apiClient.clearTokens();
      _errorMessage = 'Session expired (401). Please sign in again.';
      setOffline(false);
    } catch (e) {
      _errorMessage = 'Unexpected error: $e';
    } finally {
      _setLoading(false);
    }
  }

  Future<void> _loadFromCacheFallback() async {
    final accountId = currentUser.id;
    if (accountId.isEmpty) {
      setOffline(true);
      _isStale = true;
      _cacheAge = 'No cache available';
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
              .map((a) => AnnouncementItem.fromJson(a as Map<String, dynamic>))
              .toList()
          : <AnnouncementItem>[];

      _updateScopedData(mList, tList, aList);

      final representativeSnap = tasksSnap ?? membersSnap ?? annSnap;
      setOffline(true);
      _isStale = true;
      _cacheAge = representativeSnap?.formattedAge ?? 'Cached';
    } else {
      // No valid cache or expired (REQ-007 capacity eviction or 24h expiry)
      setOffline(true);
      _isStale = true;
      _cacheAge = null;
      _errorMessage = 'Offline: No cached data available for this view (connection required).';
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
      final otherMembers = allMembers.where((m) => m.orgId != currentScope).toList();
      setMembers([...otherMembers, ...membersList]);

      final otherTasks = allTasks.where((t) => t.orgId != currentScope).toList();
      setTasks([...otherTasks, ...tasksList]);

      final otherAnn = allAnnouncements
          .where((a) => !a.targetOrgs.contains(currentScope))
          .toList();
      setAnnouncements([...otherAnn, ...annList]);
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

    final task = getScopedTasks(includeArchived: true).firstWhere((t) => t.id == taskId);
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

    apiClient
        .archiveTask(taskId)
        .then((_) => refreshCurrentScope())
        .catchError((err) {
      _errorMessage = 'Failed to archive task: $err';
      notifyListeners();
    });

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
      _errorMessage = 'Cannot archive announcements while offline (UI-REQ-008).';
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
