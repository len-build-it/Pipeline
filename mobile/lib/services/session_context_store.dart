import 'dart:convert';
import '../models/models.dart';
import 'secure_cache_service.dart';

class SessionContext {
  final UserAccount user;
  final List<Org> organizations;
  final String scope;
  final DateTime expiresAt;

  const SessionContext({
    required this.user,
    required this.organizations,
    required this.scope,
    required this.expiresAt,
  });
}

/// Minimal previously verified identity for bounded offline reads after restart.
class SessionContextStore {
  static const key = 'auth_account_context';
  final SecureStorageAdapter storage;

  SessionContextStore(this.storage);

  Future<SessionContext?> read() async {
    final raw = await storage.read(key: key);
    if (raw == null) return null;
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final user = UserAccount.fromJson(data['user'] as Map<String, dynamic>);
    if (user.id.isEmpty || user.status != 'active') {
      throw const FormatException('Invalid session context');
    }
    return SessionContext(
      user: user,
      organizations: (data['organizations'] as List)
          .map((org) => Org.fromJson(org as Map<String, dynamic>))
          .toList(),
      scope: data['scope'] as String,
      expiresAt: DateTime.parse(data['expiresAt'] as String),
    );
  }

  Future<void> save(SessionContext context) => storage.write(
    key: key,
    value: jsonEncode({
      'user': {
        'id': context.user.id,
        'email': context.user.email,
        'displayName': context.user.displayName,
        'avatarColor': colorToHex(context.user.avatarColor),
        'status': context.user.status,
        'isGlobalOwner': context.user.isGlobalOwner,
        'memberships': context.user.memberships
            .map(
              (membership) => {
                'orgId': membership.orgId,
                'role': membership.role,
                'status': membership.status,
              },
            )
            .toList(),
      },
      'organizations': context.organizations
          .map((org) => org.toJson())
          .toList(),
      'scope': context.scope,
      'expiresAt': context.expiresAt.toIso8601String(),
    }),
  );

  Future<void> clear() => storage.delete(key: key);
}
