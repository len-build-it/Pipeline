import 'package:flutter/material.dart';
import '../data/synthetic_data.dart';
import '../models/models.dart';
import '../theme.dart';

class MembersScreen extends StatefulWidget {
  final SyntheticDataRepository repo;

  const MembersScreen({super.key, required this.repo});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  String _search = '';
  String _roleFilter = 'all';
  String _statusFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final isLead = widget.repo.isLeadInScope(widget.repo.currentScope);
    var members = widget.repo.getScopedMembers();

    if (_search.trim().isNotEmpty) {
      final q = _search.trim().toLowerCase();
      members = members.where((m) =>
        m.displayName.toLowerCase().contains(q) || m.email.toLowerCase().contains(q)
      ).toList();
    }

    if (_roleFilter != 'all') {
      members = members.where((m) => m.role.toLowerCase() == _roleFilter.toLowerCase()).toList();
    }

    if (_statusFilter != 'all') {
      members = members.where((m) => m.status.toLowerCase() == _statusFilter.toLowerCase()).toList();
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: isLead
          ? FloatingActionButton.extended(
              key: const Key('btn-fab-invite'),
              onPressed: () => _showInviteDialog(context),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.person_add_alt),
              label: const Text('Invite member'),
            )
          : null,
      body: Column(
        children: [
          // Filter Bar
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search members...',
                    prefixIcon: Icon(Icons.search, size: 20),
                    isDense: true,
                  ),
                  onChanged: (val) {
                    setState(() {
                      _search = val;
                    });
                  },
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _roleFilter,
                        isDense: true,
                        decoration: const InputDecoration(
                          labelText: 'Role',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All roles')),
                          DropdownMenuItem(value: 'Owner', child: Text('Owner')),
                          DropdownMenuItem(value: 'Lead', child: Text('Lead')),
                          DropdownMenuItem(value: 'Member', child: Text('Member')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _roleFilter = val);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _statusFilter,
                        isDense: true,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All statuses')),
                          DropdownMenuItem(value: 'active', child: Text('Active')),
                          DropdownMenuItem(value: 'pending', child: Text('Pending')),
                          DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _statusFilter = val);
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Member List
          Expanded(
            child: members.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'No members match filters.',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: members.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final m = members[index];
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                          leading: CircleAvatar(
                            backgroundColor: m.avatarColor,
                            foregroundColor: Colors.white,
                            child: Text(
                              m.displayName.length >= 2 ? m.displayName.substring(0, 2).toUpperCase() : m.displayName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                          title: Text(
                            m.displayName,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                          subtitle: Text(
                            '${m.orgId == 'org-1' ? 'AqOne' : 'Dev Guild'} • ${m.email}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              _buildRoleBadge(m.role),
                              const SizedBox(height: 4),
                              Text(
                                m.status,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: m.status == 'active' ? AppColors.success : AppColors.textMuted,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => MemberDetailScreen(repo: widget.repo, member: m),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    Color bg = const Color(0xFFE2E8F0);
    Color fg = const Color(0xFF334155);
    if (role == 'Owner') {
      bg = const Color(0xFFEDE9FE);
      fg = const Color(0xFF6D28D9);
    } else if (role == 'Lead') {
      bg = AppColors.infoBg;
      fg = AppColors.info;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Text(
        role,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }

  void _showInviteDialog(BuildContext context) {
    final emailController = TextEditingController();
    String selectedOrg = widget.repo.currentScope != 'all' ? widget.repo.currentScope : 'org-1';
    String selectedRole = 'Member';
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          title: const Text('Invite New Member'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'Email Address *'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (val) {
                    if (val == null || !val.contains('@')) {
                      return 'Enter a valid email address';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedOrg,
                  decoration: const InputDecoration(labelText: 'Organization *'),
                  items: widget.repo.organizations.map((o) {
                    return DropdownMenuItem(value: o.id, child: Text(o.name));
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) selectedOrg = val;
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedRole,
                  decoration: const InputDecoration(labelText: 'Role *'),
                  items: [
                    const DropdownMenuItem(value: 'Member', child: Text('Member')),
                    if (widget.repo.isGlobalOwner)
                      const DropdownMenuItem(value: 'Lead', child: Text('Lead')),
                  ],
                  onChanged: (val) {
                    if (val != null) selectedRole = val;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (widget.repo.isOffline) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cannot invite members while offline (UI-REQ-008).')),
                  );
                  Navigator.pop(dialogCtx);
                  return;
                }
                if (formKey.currentState?.validate() ?? false) {
                  widget.repo.inviteMember(
                    email: emailController.text.trim(),
                    orgId: selectedOrg,
                    role: selectedRole,
                  );
                  Navigator.pop(dialogCtx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Invitation sent to ${emailController.text}')),
                  );
                  setState(() {});
                }
              },
              child: const Text('Send invitation'),
            ),
          ],
        );
      },
    );
  }
}

class MemberDetailScreen extends StatefulWidget {
  final SyntheticDataRepository repo;
  final MemberRecord member;

  const MemberDetailScreen({super.key, required this.repo, required this.member});

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  late TextEditingController _notesController;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController(text: widget.member.notes);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLead = widget.repo.isLeadInScope(widget.member.orgId);
    final isSelf = widget.repo.currentUser.id == widget.member.userId;

    // Private notes: visible ONLY to Leads and Owner. Regular members NEVER see notes.
    final canAccessNotes = isLead;
    final canDeactivate = isLead && !isSelf && widget.member.role != 'Owner';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.member.displayName),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: CircleAvatar(
                radius: 36,
                backgroundColor: widget.member.avatarColor,
                child: Text(
                  widget.member.displayName.length >= 2 ? widget.member.displayName.substring(0, 2).toUpperCase() : '',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                widget.member.displayName,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
            ),
            Center(
              child: Text(
                widget.member.email,
                style: const TextStyle(fontSize: 14, color: AppColors.textMuted),
              ),
            ),
            const SizedBox(height: 24),

            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildInfoRow('Organization', widget.member.orgId == 'org-1' ? 'AqOne' : 'Dev Guild'),
                    const Divider(height: 24),
                    _buildInfoRow('Role', widget.member.role),
                    const Divider(height: 24),
                    _buildInfoRow('Status', widget.member.status),
                    const Divider(height: 24),
                    _buildInfoRow('Joined', widget.member.joinedAt),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Skills & Interests
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Skills', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 6),
                    Text(widget.member.skills.isNotEmpty ? widget.member.skills.join(', ') : 'None listed'),
                    const Divider(height: 24),
                    const Text('Interests', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    const SizedBox(height: 6),
                    Text(widget.member.interests.isNotEmpty ? widget.member.interests.join(', ') : 'None listed'),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Private Notes Section (Leads/Owner only)
            if (canAccessNotes)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text('Private Organization Notes', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.warningBg,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('Lead/Owner Only', style: TextStyle(fontSize: 10, color: AppColors.warning, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text('Visible only to organization leads and global owner.', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                      const SizedBox(height: 12),
                      TextField(
                        key: const Key('input-member-notes'),
                        controller: _notesController,
                        maxLines: 3,
                        decoration: const InputDecoration(hintText: 'Enter internal notes...'),
                      ),
                      const SizedBox(height: 8),
                      ElevatedButton(
                        onPressed: () {
                          if (widget.repo.isOffline) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Cannot save notes while offline (UI-REQ-008).')),
                            );
                            return;
                          }
                          widget.repo.updateMemberNotes(widget.member.id, _notesController.text.trim());
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Notes updated successfully.')),
                          );
                        },
                        child: const Text('Save Notes'),
                      ),
                    ],
                  ),
                ),
              ),

            // Deactivate membership
            if (canDeactivate) ...[
              const SizedBox(height: 16),
              Card(
                color: widget.member.status == 'active' ? AppColors.dangerBg : AppColors.surface,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.member.status == 'active' ? 'Deactivate Membership' : 'Reactivate Membership',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: widget.member.status == 'active' ? AppColors.danger : AppColors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Deactivating immediately revokes access and unassigns all open tasks.',
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: widget.member.status == 'active' ? AppColors.danger : AppColors.primary,
                        ),
                        onPressed: () {
                          final isCurrentlyActive = widget.member.status == 'active';
                          showDialog(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: Text(isCurrentlyActive ? 'Confirm Deactivation' : 'Confirm Reactivation'),
                              content: Text(
                                isCurrentlyActive
                                    ? 'Are you sure you want to deactivate ${widget.member.displayName}? Open task assignments will be cleared atomically.'
                                    : 'Reactivate ${widget.member.displayName} in this organization?',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel'),
                                ),
                                ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    widget.repo.toggleMemberDeactivation(widget.member.id);
                                    setState(() {});
                                  },
                                  child: const Text('Confirm'),
                                ),
                              ],
                            ),
                          );
                        },
                        child: Text(widget.member.status == 'active' ? 'Deactivate' : 'Reactivate'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.textMuted)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
