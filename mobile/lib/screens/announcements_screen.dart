import 'package:flutter/material.dart';
import '../data/synthetic_data.dart';
import '../theme.dart';

class AnnouncementsScreen extends StatefulWidget {
  final SyntheticDataRepository repo;

  const AnnouncementsScreen({super.key, required this.repo});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  String _search = '';
  bool _showArchived = false;

  @override
  Widget build(BuildContext context) {
    final isLead = widget.repo.isLeadInScope(widget.repo.currentScope);
    var announcements = widget.repo.getScopedAnnouncements(includeArchived: _showArchived);

    if (_search.trim().isNotEmpty) {
      final q = _search.trim().toLowerCase();
      announcements = announcements.where((a) =>
        a.title.toLowerCase().contains(q) || a.body.toLowerCase().contains(q)
      ).toList();
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: isLead && !_showArchived
          ? FloatingActionButton.extended(
              key: const Key('btn-fab-announcement'),
              onPressed: () => _showComposeDialog(context),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.campaign),
              label: const Text('New announcement'),
            )
          : null,
      body: Column(
        children: [
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(
                      hintText: 'Search announcements...',
                      prefixIcon: Icon(Icons.search, size: 20),
                      isDense: true,
                    ),
                    onChanged: (val) => setState(() => _search = val),
                  ),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Archived', style: TextStyle(fontSize: 12)),
                  selected: _showArchived,
                  onSelected: (val) => setState(() => _showArchived = val),
                ),
              ],
            ),
          ),

          Expanded(
            child: announcements.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('No announcements found.', style: TextStyle(color: AppColors.textMuted)),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: announcements.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final a = announcements[index];
                      final isDraft = a.status == 'draft';

                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isDraft ? AppColors.warningBg : AppColors.successBg,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      isDraft ? 'Draft' : 'Published',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                        color: isDraft ? AppColors.warning : AppColors.success,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Audience: ${a.targetOrgs.map((o) => o == 'org-1' ? 'AqOne' : 'Dev Guild').join(', ')}',
                                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                  ),
                                  if (a.archived) ...[
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(4)),
                                      child: const Text('Archived', style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                a.title,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'By ${a.authorName} • ${a.publishedAt ?? 'Unpublished draft'}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                a.body,
                                style: const TextStyle(fontSize: 14, height: 1.5),
                              ),
                              if (isLead && !a.archived) ...[
                                const SizedBox(height: 12),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                    style: TextButton.styleFrom(
                                      foregroundColor: AppColors.danger,
                                      minimumSize: const Size(48, 48),
                                    ),
                                    onPressed: () {
                                      widget.repo.archiveAnnouncement(a.id);
                                      setState(() {});
                                    },
                                    child: const Text('Archive'),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  void _showComposeDialog(BuildContext context) {
    final titleController = TextEditingController();
    final bodyController = TextEditingController();
    final targetOrgs = <String>{'org-1'};
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: const Text('Compose Announcement'),
              content: SingleChildScrollView(
                child: Form(
                  key: formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: titleController,
                        decoration: const InputDecoration(labelText: 'Title *'),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Title is required';
                          if (val.trim().length > 160) return 'Max 160 characters';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      const Text('Target Audience *', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      ...widget.repo.organizations.map((org) {
                        final checked = targetOrgs.contains(org.id);
                        return CheckboxListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          title: Text(org.name),
                          value: checked,
                          onChanged: (val) {
                            setDialogState(() {
                              if (val ?? false) {
                                targetOrgs.add(org.id);
                              } else {
                                targetOrgs.remove(org.id);
                              }
                            });
                          },
                        );
                      }),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: bodyController,
                        decoration: const InputDecoration(labelText: 'Body *'),
                        maxLines: 4,
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Body is required';
                          return null;
                        },
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.warningBg,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'Notice: Published announcements cannot have body or audience altered.',
                          style: TextStyle(fontSize: 11, color: AppColors.warning),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () {
                    if (widget.repo.isOffline) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Cannot save drafts while offline (UI-REQ-008).')),
                      );
                      Navigator.pop(dialogCtx);
                      return;
                    }
                    if (targetOrgs.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Select at least one audience organization.')),
                      );
                      return;
                    }
                    if (formKey.currentState?.validate() ?? false) {
                      widget.repo.createAnnouncement(
                        title: titleController.text.trim(),
                        body: bodyController.text.trim(),
                        targetOrgs: targetOrgs.toList(),
                        publishNow: false,
                      );
                      Navigator.pop(dialogCtx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Draft saved.')),
                      );
                      setState(() {});
                    }
                  },
                  child: const Text('Save draft'),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (widget.repo.isOffline) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Cannot publish while offline (UI-REQ-008).')),
                      );
                      Navigator.pop(dialogCtx);
                      return;
                    }
                    if (targetOrgs.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Select at least one audience organization.')),
                      );
                      return;
                    }
                    if (formKey.currentState?.validate() ?? false) {
                      widget.repo.createAnnouncement(
                        title: titleController.text.trim(),
                        body: bodyController.text.trim(),
                        targetOrgs: targetOrgs.toList(),
                        publishNow: true,
                      );
                      Navigator.pop(dialogCtx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Announcement published!')),
                      );
                      setState(() {});
                    }
                  },
                  child: const Text('Publish'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
