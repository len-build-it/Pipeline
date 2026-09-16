import 'package:flutter/material.dart';

Color parseHexColor(dynamic hex, {Color fallback = const Color(0xFF0F766E)}) {
  if (hex is! String || hex.isEmpty) return fallback;
  final clean = hex.replaceAll('#', '');
  if (clean.length == 6) {
    return Color(int.parse('FF$clean', radix: 16));
  } else if (clean.length == 8) {
    return Color(int.parse(clean, radix: 16));
  }
  return fallback;
}

String colorToHex(Color color) {
  return '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}';
}

class Org {
  final String id;
  final String name;
  final String status;

  const Org({required this.id, required this.name, required this.status});

  factory Org.fromJson(Map<String, dynamic> json) {
    return Org(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'status': status,
  };
}

class UserMembership {
  final String orgId;
  final String role; // 'Owner', 'Lead', 'Member'
  final String status;
  final String notes;

  const UserMembership({
    required this.orgId,
    required this.role,
    required this.status,
    this.notes = '',
  });

  factory UserMembership.fromJson(Map<String, dynamic> json) {
    return UserMembership(
      orgId: json['orgId'] as String? ?? json['organization_id'] as String? ?? '',
      role: json['role'] as String? ?? 'Member',
      status: json['status'] as String? ?? 'active',
      notes: json['notes'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'orgId': orgId,
    'role': role,
    'status': status,
    'notes': notes,
  };
}

class UserAccount {
  final String id;
  final String email;
  final String displayName;
  final Color avatarColor;
  final String status;
  final bool isGlobalOwner;
  final List<String> skills;
  final List<String> interests;
  final List<UserMembership> memberships;

  const UserAccount({
    required this.id,
    required this.email,
    required this.displayName,
    required this.avatarColor,
    required this.status,
    required this.isGlobalOwner,
    required this.skills,
    required this.interests,
    required this.memberships,
  });

  factory UserAccount.fromJson(Map<String, dynamic> json) {
    return UserAccount(
      id: json['id'] as String? ?? '',
      email: json['email'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      avatarColor: parseHexColor(json['avatarColor'] ?? json['avatar_color']),
      status: json['status'] as String? ?? 'active',
      isGlobalOwner: json['isGlobalOwner'] as bool? ?? json['is_global_owner'] as bool? ?? false,
      skills: (json['skills'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      interests: (json['interests'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      memberships: (json['memberships'] as List<dynamic>?)
              ?.map((e) => UserMembership.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'displayName': displayName,
    'avatarColor': colorToHex(avatarColor),
    'status': status,
    'isGlobalOwner': isGlobalOwner,
    'skills': skills,
    'interests': interests,
    'memberships': memberships.map((m) => m.toJson()).toList(),
  };
}

class MemberRecord {
  final String id;
  final String userId;
  final String orgId;
  String displayName;
  final String email;
  Color avatarColor;
  String role;
  String status;
  final String joinedAt;
  List<String> skills;
  List<String> interests;
  String notes;

  MemberRecord({
    required this.id,
    required this.userId,
    required this.orgId,
    required this.displayName,
    required this.email,
    required this.avatarColor,
    required this.role,
    required this.status,
    required this.joinedAt,
    required this.skills,
    required this.interests,
    required this.notes,
  });

  factory MemberRecord.fromJson(Map<String, dynamic> json) {
    return MemberRecord(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      orgId: json['orgId'] as String? ?? json['organizationId'] as String? ?? json['organization_id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? json['display_name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      avatarColor: parseHexColor(json['avatarColor'] ?? json['avatar_color']),
      role: json['role'] as String? ?? 'Member',
      status: json['status'] as String? ?? 'active',
      joinedAt: json['joinedAt'] as String? ?? json['joined_at'] as String? ?? '',
      skills: (json['skills'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      interests: (json['interests'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      notes: json['notes'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'userId': userId,
    'orgId': orgId,
    'displayName': displayName,
    'email': email,
    'avatarColor': colorToHex(avatarColor),
    'role': role,
    'status': status,
    'joinedAt': joinedAt,
    'skills': skills,
    'interests': interests,
    'notes': notes,
  };
}

class TaskComment {
  final String id;
  final String authorId;
  final String authorName;
  String body;
  final String createdAt;

  TaskComment({
    required this.id,
    required this.authorId,
    required this.authorName,
    required this.body,
    required this.createdAt,
  });

  factory TaskComment.fromJson(Map<String, dynamic> json) {
    return TaskComment(
      id: json['id'] as String? ?? '',
      authorId: json['authorId'] as String? ?? json['author_id'] as String? ?? '',
      authorName: json['authorName'] as String? ?? json['author_name'] as String? ?? 'Unknown',
      body: json['body'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'authorId': authorId,
    'authorName': authorName,
    'body': body,
    'createdAt': createdAt,
  };
}

class TaskItem {
  final String id;
  final String orgId;
  String title;
  String description;
  final String creator;
  final String creatorName;
  String? assignee;
  String assigneeName;
  String status; // 'Backlog', 'In progress', 'Blocked', 'Done'
  String priority; // 'Low', 'Medium', 'High'
  String? dueDate; // 'YYYY-MM-DD'
  List<String> labels;
  bool archived;
  int version;
  String updatedAt;
  List<TaskComment> comments;

  TaskItem({
    required this.id,
    required this.orgId,
    required this.title,
    required this.description,
    required this.creator,
    required this.creatorName,
    this.assignee,
    required this.assigneeName,
    required this.status,
    required this.priority,
    this.dueDate,
    required this.labels,
    this.archived = false,
    this.version = 1,
    required this.updatedAt,
    required this.comments,
  });

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    return TaskItem(
      id: json['id'] as String? ?? '',
      orgId: json['orgId'] as String? ?? json['organizationId'] as String? ?? json['organization_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      creator: json['creator'] as String? ?? json['creator_id'] as String? ?? json['creatorId'] as String? ?? '',
      creatorName: json['creatorName'] as String? ?? json['creator_name'] as String? ?? 'Unknown',
      assignee: json['assignee'] as String? ?? json['assignee_id'] as String? ?? json['assigneeId'] as String?,
      assigneeName: json['assigneeName'] as String? ?? json['assignee_name'] as String? ?? 'Unassigned',
      status: json['status'] as String? ?? 'Backlog',
      priority: json['priority'] as String? ?? 'Medium',
      dueDate: json['dueDate'] as String? ?? json['due_date'] as String?,
      labels: (json['labels'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      archived: json['archived'] as bool? ?? json['is_archived'] as bool? ?? false,
      version: (json['version'] as num?)?.toInt() ?? 1,
      updatedAt: json['updatedAt'] as String? ?? json['updated_at'] as String? ?? '',
      comments: (json['comments'] as List<dynamic>?)
              ?.map((c) => TaskComment.fromJson(c as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'orgId': orgId,
    'title': title,
    'description': description,
    'creator': creator,
    'creatorName': creatorName,
    'assignee': assignee,
    'assigneeName': assigneeName,
    'status': status,
    'priority': priority,
    'dueDate': dueDate,
    'labels': labels,
    'archived': archived,
    'version': version,
    'updatedAt': updatedAt,
    'comments': comments.map((c) => c.toJson()).toList(),
  };
}

class AnnouncementItem {
  final String id;
  String title;
  String body;
  final String authorId;
  final String authorName;
  final List<String> targetOrgs;
  String status; // 'draft', 'published'
  String? publishedAt;
  bool archived;

  AnnouncementItem({
    required this.id,
    required this.title,
    required this.body,
    required this.authorId,
    required this.authorName,
    required this.targetOrgs,
    required this.status,
    this.publishedAt,
    this.archived = false,
  });

  factory AnnouncementItem.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['publicationStatus'] as String? ??
        json['publication_status'] as String? ??
        json['status'] as String? ??
        'draft';
    final normalizedStatus = rawStatus.toLowerCase() == 'published' ? 'published' : 'draft';
    final isArchived = json['archived'] as bool? ??
        json['is_archived'] as bool? ??
        rawStatus.toLowerCase() == 'archived';

    final orgs = (json['targetOrganizations'] as List<dynamic>?) ??
        (json['target_organizations'] as List<dynamic>?) ??
        (json['targetOrgs'] as List<dynamic>?);

    return AnnouncementItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      authorId: json['authorId'] as String? ?? json['author_id'] as String? ?? '',
      authorName: json['authorName'] as String? ?? json['author_name'] as String? ?? 'Unknown',
      targetOrgs: orgs?.map((e) => e.toString()).toList() ?? [],
      status: normalizedStatus,
      publishedAt: json['publishedAt'] as String? ?? json['published_at'] as String?,
      archived: isArchived,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'authorId': authorId,
    'authorName': authorName,
    'targetOrgs': targetOrgs,
    'status': status,
    'publishedAt': publishedAt,
    'archived': archived,
  };
}

class OverviewMetrics {
  final String scope;
  final int activeMembersCount;
  final int openTasksCount;
  final int overdueTasksCount;
  final int publishedAnnouncementsCount;
  final List<TaskItem> actionableTasks;
  final List<AnnouncementItem> recentAnnouncements;

  const OverviewMetrics({
    required this.scope,
    required this.activeMembersCount,
    required this.openTasksCount,
    required this.overdueTasksCount,
    required this.publishedAnnouncementsCount,
    this.actionableTasks = const [],
    this.recentAnnouncements = const [],
  });

  factory OverviewMetrics.fromJson(Map<String, dynamic> json) {
    return OverviewMetrics(
      scope: json['scope'] as String? ?? 'all',
      activeMembersCount: (json['activeMembersCount'] as num?)?.toInt() ?? 0,
      openTasksCount: (json['openTasksCount'] as num?)?.toInt() ?? 0,
      overdueTasksCount: (json['overdueTasksCount'] as num?)?.toInt() ?? 0,
      publishedAnnouncementsCount: (json['publishedAnnouncementsCount'] as num?)?.toInt() ?? 0,
      actionableTasks: (json['actionableTasks'] as List<dynamic>?)
              ?.map((t) => TaskItem.fromJson(t as Map<String, dynamic>))
              .toList() ??
          [],
      recentAnnouncements: (json['recentAnnouncements'] as List<dynamic>?)
              ?.map((a) => AnnouncementItem.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
    'scope': scope,
    'activeMembersCount': activeMembersCount,
    'openTasksCount': openTasksCount,
    'overdueTasksCount': overdueTasksCount,
    'publishedAnnouncementsCount': publishedAnnouncementsCount,
    'actionableTasks': actionableTasks.map((t) => t.toJson()).toList(),
    'recentAnnouncements': recentAnnouncements.map((a) => a.toJson()).toList(),
  };
}
