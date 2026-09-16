import 'package:flutter/material.dart';
import '../models/models.dart';

class SyntheticDataRepository extends ChangeNotifier {
  static final List<Org> initialOrgs = [
    const Org(id: 'org-1', name: 'AqOne', status: 'active'),
    const Org(id: 'org-2', name: 'Dev Guild', status: 'active'),
  ];

  static const userLen = UserAccount(
    id: 'usr-owner',
    email: 'len@example.com',
    displayName: 'Len',
    avatarColor: Color(0xFF0F766E),
    status: 'active',
    isGlobalOwner: true,
    skills: ['Architecture', 'Leadership'],
    interests: ['Product Strategy', 'Systems Design'],
    memberships: [
      UserMembership(orgId: 'org-1', role: 'Owner', status: 'active', notes: 'Founder and Global Owner'),
      UserMembership(orgId: 'org-2', role: 'Owner', status: 'active', notes: 'Founder and Global Owner'),
    ],
  );

  static const userAlex = UserAccount(
    id: 'usr-alex',
    email: 'alex@example.com',
    displayName: 'Alex Rivera',
    avatarColor: Color(0xFF2563EB),
    status: 'active',
    isGlobalOwner: false,
    skills: ['Frontend', 'UI Design', 'Flutter'],
    interests: ['Accessibility', 'Mobile'],
    memberships: [
      UserMembership(orgId: 'org-1', role: 'Lead', status: 'active', notes: 'Frontend lead for AqOne'),
      UserMembership(orgId: 'org-2', role: 'Member', status: 'active', notes: 'Regular contributor to dev tools'),
    ],
  );

  static const userSam = UserAccount(
    id: 'usr-sam',
    email: 'sam@example.com',
    displayName: 'Sam Taylor',
    avatarColor: Color(0xFF7C3AED),
    status: 'active',
    isGlobalOwner: false,
    skills: ['Node.js', 'PostgreSQL', 'Testing'],
    interests: ['Backend Systems', 'Performance'],
    memberships: [
      UserMembership(orgId: 'org-1', role: 'Member', status: 'active', notes: 'Backend apprentice in AqOne'),
      UserMembership(orgId: 'org-2', role: 'Member', status: 'active', notes: 'Core developer in Dev Guild'),
    ],
  );

  static const userJordan = UserAccount(
    id: 'usr-jordan',
    email: 'jordan@example.com',
    displayName: 'Jordan Lee',
    avatarColor: Color(0xFFEA580C),
    status: 'active',
    isGlobalOwner: false,
    skills: ['DevOps', 'CI/CD', 'Security'],
    interests: ['Automation', 'Infrastructure'],
    memberships: [
      UserMembership(orgId: 'org-2', role: 'Lead', status: 'active', notes: 'Dev Guild lead engineer'),
    ],
  );

  late UserAccount _currentUser;
  late String _currentScope;
  bool _isOffline = false;

  late List<MemberRecord> _members;
  late List<TaskItem> _tasks;
  late List<AnnouncementItem> _announcements;

  SyntheticDataRepository() {
    resetToInitial();
  }

  void resetToInitial() {
    _currentUser = userLen;
    _currentScope = 'all';
    _isOffline = false;

    _members = [
      MemberRecord(
        id: 'mem-1',
        userId: 'usr-owner',
        orgId: 'org-1',
        displayName: 'Len',
        email: 'len@example.com',
        avatarColor: const Color(0xFF0F766E),
        role: 'Owner',
        status: 'active',
        joinedAt: '2026-08-01',
        skills: ['Architecture', 'Leadership'],
        interests: ['Product Strategy'],
        notes: 'Global owner - manages all organizations.',
      ),
      MemberRecord(
        id: 'mem-2',
        userId: 'usr-owner',
        orgId: 'org-2',
        displayName: 'Len',
        email: 'len@example.com',
        avatarColor: const Color(0xFF0F766E),
        role: 'Owner',
        status: 'active',
        joinedAt: '2026-08-01',
        skills: ['Architecture', 'Leadership'],
        interests: ['Product Strategy'],
        notes: 'Global owner.',
      ),
      MemberRecord(
        id: 'mem-3',
        userId: 'usr-alex',
        orgId: 'org-1',
        displayName: 'Alex Rivera',
        email: 'alex@example.com',
        avatarColor: const Color(0xFF2563EB),
        role: 'Lead',
        status: 'active',
        joinedAt: '2026-08-05',
        skills: ['Frontend', 'UI Design', 'Flutter'],
        interests: ['Accessibility', 'Mobile'],
        notes: 'AqOne team technical lead.',
      ),
      MemberRecord(
        id: 'mem-4',
        userId: 'usr-alex',
        orgId: 'org-2',
        displayName: 'Alex Rivera',
        email: 'alex@example.com',
        avatarColor: const Color(0xFF2563EB),
        role: 'Member',
        status: 'active',
        joinedAt: '2026-08-06',
        skills: ['Frontend'],
        interests: ['Design Systems'],
        notes: 'Guild member collaborating on UI components.',
      ),
      MemberRecord(
        id: 'mem-5',
        userId: 'usr-sam',
        orgId: 'org-1',
        displayName: 'Sam Taylor',
        email: 'sam@example.com',
        avatarColor: const Color(0xFF7C3AED),
        role: 'Member',
        status: 'active',
        joinedAt: '2026-08-10',
        skills: ['Node.js', 'PostgreSQL'],
        interests: ['Backend Systems'],
        notes: 'Works on REST API development.',
      ),
      MemberRecord(
        id: 'mem-6',
        userId: 'usr-sam',
        orgId: 'org-2',
        displayName: 'Sam Taylor',
        email: 'sam@example.com',
        avatarColor: const Color(0xFF7C3AED),
        role: 'Member',
        status: 'active',
        joinedAt: '2026-08-11',
        skills: ['Node.js', 'Testing'],
        interests: ['Automation'],
        notes: 'Helps maintain build scripts.',
      ),
      MemberRecord(
        id: 'mem-7',
        userId: 'usr-jordan',
        orgId: 'org-2',
        displayName: 'Jordan Lee',
        email: 'jordan@example.com',
        avatarColor: const Color(0xFFEA580C),
        role: 'Lead',
        status: 'active',
        joinedAt: '2026-08-02',
        skills: ['DevOps', 'CI/CD'],
        interests: ['Infrastructure'],
        notes: 'Dev Guild lead organizer.',
      ),
    ];

    _tasks = [
      TaskItem(
        id: 'tsk-101',
        orgId: 'org-1',
        title: 'Design responsive navigation rail',
        description: 'Implement responsive drawer behavior for screens under 768px with full keyboard access.',
        creator: 'usr-owner',
        creatorName: 'Len',
        assignee: 'usr-alex',
        assigneeName: 'Alex Rivera',
        status: 'In progress',
        priority: 'High',
        dueDate: '2026-09-25',
        labels: ['frontend', 'ui', 'accessibility'],
        updatedAt: '2026-09-16T12:00:00+08:00',
        comments: [
          TaskComment(
            id: 'cmt-1',
            authorId: 'usr-owner',
            authorName: 'Len',
            body: 'Make sure 48px touch targets are preserved on mobile.',
            createdAt: '2026-09-16 13:00',
          ),
        ],
      ),
      TaskItem(
        id: 'tsk-102',
        orgId: 'org-1',
        title: 'Audit color contrast ratios for light mode',
        description: 'Verify WCAG 2.2 AA contrast compliance across buttons, links, and badges.',
        creator: 'usr-alex',
        creatorName: 'Alex Rivera',
        assignee: 'usr-alex',
        assigneeName: 'Alex Rivera',
        status: 'Done',
        priority: 'Medium',
        dueDate: '2026-09-15',
        labels: ['a11y', 'design'],
        updatedAt: '2026-09-15T18:00:00+08:00',
        comments: [],
      ),
      TaskItem(
        id: 'tsk-103',
        orgId: 'org-1',
        title: 'Review database indexes for membership queries',
        description: 'Ensure composite unique index on user_id and organization_id is properly utilized.',
        creator: 'usr-owner',
        creatorName: 'Len',
        assignee: 'usr-sam',
        assigneeName: 'Sam Taylor',
        status: 'Backlog',
        priority: 'Low',
        dueDate: '2026-09-12', // Overdue
        labels: ['database', 'performance'],
        updatedAt: '2026-09-14T09:00:00+08:00',
        comments: [],
      ),
      TaskItem(
        id: 'tsk-201',
        orgId: 'org-2',
        title: 'Setup automated linting and formatting pipeline',
        description: 'Standardize linter rules and commit verification scripts for guild projects.',
        creator: 'usr-jordan',
        creatorName: 'Jordan Lee',
        assignee: 'usr-sam',
        assigneeName: 'Sam Taylor',
        status: 'In progress',
        priority: 'High',
        dueDate: '2026-09-14', // Overdue
        labels: ['tooling', 'devops'],
        updatedAt: '2026-09-14T15:00:00+08:00',
        comments: [],
      ),
      TaskItem(
        id: 'tsk-202',
        orgId: 'org-2',
        title: 'Prepare workshop on Flutter widget architecture',
        description: 'Draft slides and code examples on widget tree optimization and state isolation.',
        creator: 'usr-jordan',
        creatorName: 'Jordan Lee',
        assignee: 'usr-alex',
        assigneeName: 'Alex Rivera',
        status: 'Blocked',
        priority: 'Medium',
        dueDate: '2026-09-30',
        labels: ['workshop', 'mobile'],
        updatedAt: '2026-09-16T10:00:00+08:00',
        comments: [
          TaskComment(
            id: 'cmt-2',
            authorId: 'usr-alex',
            authorName: 'Alex Rivera',
            body: 'Waiting for sample repository review before finalizing slide examples.',
            createdAt: '2026-09-16 11:00',
          ),
        ],
      ),
    ];

    _announcements = [
      AnnouncementItem(
        id: 'ann-1',
        title: 'Welcome to the AqOne & Dev Guild unified management portal',
        body: 'We have launched the new consolidated management hub. Leads and members can view projects, track tasks, and stay aligned across organizations.',
        authorId: 'usr-owner',
        authorName: 'Len',
        targetOrgs: ['org-1', 'org-2'],
        status: 'published',
        publishedAt: '2026-09-15',
      ),
      AnnouncementItem(
        id: 'ann-2',
        title: 'AqOne Q3 Sprint Kickoff',
        body: 'AqOne sprint goals have been updated. Please inspect your assigned tasks and update status accordingly.',
        authorId: 'usr-alex',
        authorName: 'Alex Rivera',
        targetOrgs: ['org-1'],
        status: 'published',
        publishedAt: '2026-09-16',
      ),
      AnnouncementItem(
        id: 'ann-3',
        title: 'Dev Guild tooling roadmap (Draft)',
        body: 'Draft proposal for upcoming tooling upgrades and code sharing initiatives across guild repositories.',
        authorId: 'usr-jordan',
        authorName: 'Jordan Lee',
        targetOrgs: ['org-2'],
        status: 'draft',
      ),
    ];

    notifyListeners();
  }

  // Getters
  UserAccount get currentUser => _currentUser;
  String get currentScope => _currentScope;
  bool get isOffline => _isOffline;
  List<Org> get organizations => initialOrgs;

  bool get isGlobalOwner => _currentUser.isGlobalOwner;

  bool isLeadInScope(String scope) {
    if (_currentUser.isGlobalOwner) return true;
    if (scope == 'all') {
      return _currentUser.memberships.any((m) => m.role == 'Lead');
    }
    final m = _currentUser.memberships.firstWhere(
      (m) => m.orgId == scope,
      orElse: () => const UserMembership(orgId: '', role: '', status: ''),
    );
    return m.role == 'Lead';
  }

  List<Org> get availableScopes {
    if (_currentUser.isGlobalOwner) {
      return [const Org(id: 'all', name: 'All Organizations', status: 'active'), ...initialOrgs];
    }
    return initialOrgs.where((o) => _currentUser.memberships.any((m) => m.orgId == o.id)).toList();
  }

  void switchPersona(UserAccount user) {
    _currentUser = user;
    if (!user.isGlobalOwner) {
      final allowed = user.memberships.map((m) => m.orgId).toList();
      if (_currentScope == 'all' || !allowed.contains(_currentScope)) {
        _currentScope = allowed.isNotEmpty ? allowed.first : 'org-1';
      }
    }
    notifyListeners();
  }

  void setScope(String scope) {
    _currentScope = scope;
    notifyListeners();
  }

  void setOffline(bool offline) {
    _isOffline = offline;
    notifyListeners();
  }

  // Scoped queries
  List<MemberRecord> getScopedMembers() {
    var list = _members;
    if (_currentScope != 'all') {
      list = list.where((m) => m.orgId == _currentScope).toList();
    } else if (!_currentUser.isGlobalOwner) {
      final allowed = _currentUser.memberships.map((m) => m.orgId).toSet();
      list = list.where((m) => allowed.contains(m.orgId)).toList();
    }
    return list;
  }

  List<TaskItem> getScopedTasks({bool includeArchived = false}) {
    var list = _tasks;
    if (!includeArchived) {
      list = list.where((t) => !t.archived).toList();
    } else {
      list = list.where((t) => t.archived).toList();
    }

    if (_currentScope != 'all') {
      list = list.where((t) => t.orgId == _currentScope).toList();
    } else if (!_currentUser.isGlobalOwner) {
      final allowed = _currentUser.memberships.map((m) => m.orgId).toSet();
      list = list.where((t) => allowed.contains(t.orgId)).toList();
    }
    return list;
  }

  List<AnnouncementItem> getScopedAnnouncements({bool includeArchived = false}) {
    var list = _announcements;
    if (!includeArchived) {
      list = list.where((a) => !a.archived).toList();
    } else {
      list = list.where((a) => a.archived).toList();
    }

    // Members never see drafts
    if (!_currentUser.isGlobalOwner) {
      list = list.where((a) {
        if (a.status == 'draft') {
          return a.targetOrgs.every((t) {
            final m = _currentUser.memberships.firstWhere(
              (mem) => mem.orgId == t,
              orElse: () => const UserMembership(orgId: '', role: '', status: ''),
            );
            return m.role == 'Lead';
          });
        }
        return true;
      }).toList();
    }

    if (_currentScope != 'all') {
      list = list.where((a) => a.targetOrgs.contains(_currentScope)).toList();
    } else if (!_currentUser.isGlobalOwner) {
      final allowed = _currentUser.memberships.map((m) => m.orgId).toSet();
      list = list.where((a) => a.targetOrgs.any((t) => allowed.contains(t))).toList();
    }

    return list;
  }

  // Mutations
  bool inviteMember({
    required String email,
    required String orgId,
    required String role,
  }) {
    if (_isOffline) return false; // Disabled offline mutation

    _members.add(
      MemberRecord(
        id: 'mem-${DateTime.now().millisecondsSinceEpoch}',
        userId: 'usr-${DateTime.now().millisecondsSinceEpoch}',
        orgId: orgId,
        displayName: email.split('@').first,
        email: email,
        avatarColor: const Color(0xFF0F766E),
        role: role,
        status: 'pending',
        joinedAt: 'Pending',
        skills: [],
        interests: [],
        notes: '',
      ),
    );
    notifyListeners();
    return true;
  }

  bool updateMemberNotes(String memberId, String notes) {
    if (_isOffline) return false;
    final m = _members.firstWhere((x) => x.id == memberId);
    m.notes = notes;
    notifyListeners();
    return true;
  }

  bool toggleMemberDeactivation(String memberId) {
    if (_isOffline) return false;
    final m = _members.firstWhere((x) => x.id == memberId);
    if (m.role == 'Owner') return false; // Owner protected

    final isCurrentlyActive = m.status == 'active';
    m.status = isCurrentlyActive ? 'inactive' : 'active';

    // Atomically unassign open tasks if deactivating
    if (isCurrentlyActive) {
      for (final t in _tasks) {
        if (t.orgId == m.orgId && t.assignee == m.userId && t.status != 'Done') {
          t.assignee = null;
          t.assigneeName = 'Unassigned';
        }
      }
    }
    notifyListeners();
    return true;
  }

  bool createTask({
    required String orgId,
    required String title,
    required String description,
    required String priority,
    String? assignee,
    String? dueDate,
    List<String> labels = const [],
  }) {
    if (_isOffline) return false;

    String assigneeName = 'Unassigned';
    if (assignee != null && assignee.isNotEmpty) {
      final mem = _members.firstWhere(
        (m) => m.userId == assignee && m.orgId == orgId,
        orElse: () => MemberRecord(
          id: '',
          userId: '',
          orgId: '',
          displayName: 'Unassigned',
          email: '',
          avatarColor: Colors.grey,
          role: '',
          status: '',
          joinedAt: '',
          skills: [],
          interests: [],
          notes: '',
        ),
      );
      assigneeName = mem.displayName;
    }

    _tasks.insert(
      0,
      TaskItem(
        id: 'tsk-${DateTime.now().millisecondsSinceEpoch}',
        orgId: orgId,
        title: title,
        description: description,
        creator: _currentUser.id,
        creatorName: _currentUser.displayName,
        assignee: assignee,
        assigneeName: assigneeName,
        status: 'Backlog',
        priority: priority,
        dueDate: dueDate,
        labels: labels,
        updatedAt: DateTime.now().toIso8601String(),
        comments: [],
      ),
    );
    notifyListeners();
    return true;
  }

  bool updateTaskStatus(String taskId, String newStatus) {
    if (_isOffline) return false;
    final t = _tasks.firstWhere((x) => x.id == taskId);
    t.status = newStatus;
    t.updatedAt = DateTime.now().toIso8601String();
    notifyListeners();
    return true;
  }

  bool addTaskComment(String taskId, String body) {
    if (_isOffline) return false;
    final t = _tasks.firstWhere((x) => x.id == taskId);
    t.comments.add(
      TaskComment(
        id: 'cmt-${DateTime.now().millisecondsSinceEpoch}',
        authorId: _currentUser.id,
        authorName: _currentUser.displayName,
        body: body,
        createdAt: 'Just now',
      ),
    );
    notifyListeners();
    return true;
  }

  bool archiveTask(String taskId) {
    if (_isOffline) return false;
    final t = _tasks.firstWhere((x) => x.id == taskId);
    t.archived = true;
    notifyListeners();
    return true;
  }

  bool createAnnouncement({
    required String title,
    required String body,
    required List<String> targetOrgs,
    required bool publishNow,
  }) {
    if (_isOffline) return false;
    _announcements.insert(
      0,
      AnnouncementItem(
        id: 'ann-${DateTime.now().millisecondsSinceEpoch}',
        title: title,
        body: body,
        authorId: _currentUser.id,
        authorName: _currentUser.displayName,
        targetOrgs: targetOrgs,
        status: publishNow ? 'published' : 'draft',
        publishedAt: publishNow ? '2026-09-16' : null,
      ),
    );
    notifyListeners();
    return true;
  }

  bool archiveAnnouncement(String annId) {
    if (_isOffline) return false;
    final a = _announcements.firstWhere((x) => x.id == annId);
    a.archived = true;
    notifyListeners();
    return true;
  }
}
