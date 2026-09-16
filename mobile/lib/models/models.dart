import 'package:flutter/material.dart';

class Org {
  final String id;
  final String name;
  final String status;

  const Org({required this.id, required this.name, required this.status});
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
    required this.updatedAt,
    required this.comments,
  });
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
}
