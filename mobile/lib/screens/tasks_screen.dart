import 'package:flutter/material.dart';
import '../data/synthetic_data.dart';
import '../models/models.dart';
import '../theme.dart';

class TasksScreen extends StatefulWidget {
  final SyntheticDataRepository repo;

  const TasksScreen({super.key, required this.repo});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  String _search = '';
  String _statusFilter = 'all';
  String _priorityFilter = 'all';
  bool _overdueOnly = false;
  bool _showArchived = false;

  final todayManila = '2026-09-16';

  @override
  Widget build(BuildContext context) {
    final isLead = widget.repo.isLeadInScope(widget.repo.currentScope);
    var tasks = widget.repo.getScopedTasks(includeArchived: _showArchived);

    if (_search.trim().isNotEmpty) {
      final q = _search.trim().toLowerCase();
      tasks = tasks.where((t) =>
        t.title.toLowerCase().contains(q) || t.description.toLowerCase().contains(q)
      ).toList();
    }

    if (_statusFilter != 'all') {
      tasks = tasks.where((t) => t.status.toLowerCase() == _statusFilter.toLowerCase()).toList();
    }

    if (_priorityFilter != 'all') {
      tasks = tasks.where((t) => t.priority.toLowerCase() == _priorityFilter.toLowerCase()).toList();
    }

    if (_overdueOnly) {
      tasks = tasks.where((t) =>
        t.status != 'Done' && t.dueDate != null && t.dueDate!.compareTo(todayManila) < 0
      ).toList();
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: isLead && !_showArchived
          ? FloatingActionButton.extended(
              key: const Key('btn-fab-task'),
              onPressed: () => _showCreateTaskDialog(context),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_task),
              label: const Text('New task'),
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
                    hintText: 'Search tasks by title...',
                    prefixIcon: Icon(Icons.search, size: 20),
                    isDense: true,
                  ),
                  onChanged: (val) => setState(() => _search = val),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _statusFilter,
                        isDense: true,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Status',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All statuses')),
                          DropdownMenuItem(value: 'Backlog', child: Text('Backlog')),
                          DropdownMenuItem(value: 'In progress', child: Text('In progress')),
                          DropdownMenuItem(value: 'Blocked', child: Text('Blocked')),
                          DropdownMenuItem(value: 'Done', child: Text('Done')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _statusFilter = val);
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _priorityFilter,
                        isDense: true,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Priority',
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'all', child: Text('All priorities')),
                          DropdownMenuItem(value: 'Low', child: Text('Low')),
                          DropdownMenuItem(value: 'Medium', child: Text('Medium')),
                          DropdownMenuItem(value: 'High', child: Text('High')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _priorityFilter = val);
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    FilterChip(
                      label: const Text('Overdue only', style: TextStyle(fontSize: 12)),
                      selected: _overdueOnly,
                      onSelected: (val) => setState(() => _overdueOnly = val),
                    ),
                    FilterChip(
                      label: const Text('Show archived', style: TextStyle(fontSize: 12)),
                      selected: _showArchived,
                      onSelected: (val) => setState(() => _showArchived = val),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Tasks List
          Expanded(
            child: tasks.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        'No tasks match active criteria.',
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: tasks.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final t = tasks[index];
                      final isOverdue = !t.archived && t.status != 'Done' && t.dueDate != null && t.dueDate!.compareTo(todayManila) < 0;

                      return Card(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(8),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => TaskDetailScreen(repo: widget.repo, task: t),
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        t.title,
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15,
                                          decoration: t.archived ? TextDecoration.lineThrough : null,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    _buildStatusBadge(t.status),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 4,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      t.orgId == 'org-1' ? 'AqOne' : 'Dev Guild',
                                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                    ),
                                    const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                                    _buildPriorityTag(t.priority),
                                    const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                                    Text(
                                      t.assigneeName,
                                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                    ),
                                    if (t.dueDate != null) ...[
                                      const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                                      Text(
                                        t.dueDate!,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: isOverdue ? FontWeight.w700 : FontWeight.normal,
                                          color: isOverdue ? AppColors.danger : AppColors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
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

  Widget _buildStatusBadge(String status) {
    Color bg = AppColors.border;
    Color fg = AppColors.text;
    switch (status) {
      case 'In progress':
        bg = AppColors.infoBg;
        fg = AppColors.info;
        break;
      case 'Blocked':
        bg = AppColors.dangerBg;
        fg = AppColors.danger;
        break;
      case 'Done':
        bg = AppColors.successBg;
        fg = AppColors.success;
        break;
      default:
        bg = const Color(0xFFE2E8F0);
        fg = const Color(0xFF334155);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Text(
        status,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg),
      ),
    );
  }

  Widget _buildPriorityTag(String priority) {
    Color color = AppColors.textMuted;
    if (priority == 'High') color = AppColors.danger;
    if (priority == 'Medium') color = AppColors.warning;
    return Text(
      priority,
      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
    );
  }

  void _showCreateTaskDialog(BuildContext context) {
    final titleController = TextEditingController();
    final descController = TextEditingController();
    String selectedOrg = widget.repo.currentScope != 'all' ? widget.repo.currentScope : 'org-1';
    String selectedPriority = 'Medium';
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          title: const Text('Create New Task'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: titleController,
                    decoration: const InputDecoration(labelText: 'Task Title *'),
                    validator: (val) {
                      if (val == null || val.trim().isEmpty) return 'Title is required';
                      if (val.trim().length > 160) return 'Max 160 characters';
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
                    initialValue: selectedPriority,
                    decoration: const InputDecoration(labelText: 'Priority'),
                    items: const [
                      DropdownMenuItem(value: 'Low', child: Text('Low')),
                      DropdownMenuItem(value: 'Medium', child: Text('Medium')),
                      DropdownMenuItem(value: 'High', child: Text('High')),
                    ],
                    onChanged: (val) {
                      if (val != null) selectedPriority = val;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: descController,
                    decoration: const InputDecoration(labelText: 'Description (Optional)'),
                    maxLines: 2,
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
            ElevatedButton(
              onPressed: () {
                if (widget.repo.isOffline) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cannot create tasks while offline (UI-REQ-008).')),
                  );
                  Navigator.pop(dialogCtx);
                  return;
                }
                if (formKey.currentState?.validate() ?? false) {
                  widget.repo.createTask(
                    orgId: selectedOrg,
                    title: titleController.text.trim(),
                    description: descController.text.trim(),
                    priority: selectedPriority,
                  );
                  Navigator.pop(dialogCtx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Task created successfully in Backlog.')),
                  );
                  setState(() {});
                }
              },
              child: const Text('Create task'),
            ),
          ],
        );
      },
    );
  }
}

class TaskDetailScreen extends StatefulWidget {
  final SyntheticDataRepository repo;
  final TaskItem task;

  const TaskDetailScreen({super.key, required this.repo, required this.task});

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  final _commentController = TextEditingController();
  bool _conflictSimulated = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLead = widget.repo.isLeadInScope(widget.task.orgId);
    final isAssignee = widget.repo.currentUser.id == widget.task.assignee;
    final canUpdateStatus = (isLead || isAssignee) && !widget.task.archived;
    final canComment = !widget.task.archived;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.task.title),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_conflictSimulated)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.dangerBg,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.danger),
                ),
                child: const Text(
                  'Conflict: This task was modified by another user. Reload to view the latest version.',
                  style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold),
                ),
              ),

            Text(
              widget.task.title,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.task.orgId == 'org-1' ? 'AqOne' : 'Dev Guild'} • ${widget.task.id}',
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 16),

            // Details card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _buildRow('Status', widget.task.status),
                    const Divider(height: 20),
                    _buildRow('Priority', widget.task.priority),
                    const Divider(height: 20),
                    _buildRow('Assignee', widget.task.assigneeName),
                    const Divider(height: 20),
                    _buildRow('Due Date', widget.task.dueDate ?? 'None'),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Description
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Description', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(
                      widget.task.description.isNotEmpty ? widget.task.description : 'No description provided.',
                      style: const TextStyle(height: 1.5),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Status Update Control
            if (canUpdateStatus)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Update Status', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              initialValue: widget.task.status,
                              items: const [
                                DropdownMenuItem(value: 'Backlog', child: Text('Backlog')),
                                DropdownMenuItem(value: 'In progress', child: Text('In progress')),
                                DropdownMenuItem(value: 'Blocked', child: Text('Blocked')),
                                DropdownMenuItem(value: 'Done', child: Text('Done')),
                              ],
                              onChanged: (val) {
                                if (val != null) {
                                  if (widget.repo.isOffline) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Cannot update status while offline (UI-REQ-008).')),
                                    );
                                    return;
                                  }
                                  widget.repo.updateTaskStatus(widget.task.id, val);
                                  setState(() {});
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 16),

            // Conflict simulation button
            OutlinedButton(
              key: const Key('btn-conflict-sim'),
              onPressed: () {
                setState(() {
                  _conflictSimulated = true;
                });
              },
              child: const Text('Simulate Edit Conflict'),
            ),

            const SizedBox(height: 24),

            // Comments
            Text(
              'Comments (${widget.task.comments.length})',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: 8),

            if (widget.task.comments.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('No comments yet.', style: TextStyle(color: AppColors.textMuted)),
              )
            else
              ...widget.task.comments.map((c) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(c.authorName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                            Text(c.createdAt, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(c.body, style: const TextStyle(fontSize: 14)),
                      ],
                    ),
                  ),
                );
              }),

            if (canComment) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _commentController,
                decoration: const InputDecoration(hintText: 'Add a comment...'),
                maxLines: 2,
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () {
                  if (widget.repo.isOffline) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Cannot post comments while offline (UI-REQ-008).')),
                    );
                    return;
                  }
                  final body = _commentController.text.trim();
                  if (body.isNotEmpty) {
                    widget.repo.addTaskComment(widget.task.id, body);
                    _commentController.clear();
                    setState(() {});
                  }
                },
                child: const Text('Post comment'),
              ),
            ],

            if (isLead && !widget.task.archived) ...[
              const SizedBox(height: 24),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Archive Task'),
                      content: const Text('Archived tasks become read-only and disappear from active lists.'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
                          onPressed: () {
                            Navigator.pop(ctx);
                            widget.repo.archiveTask(widget.task.id);
                            Navigator.pop(context);
                          },
                          child: const Text('Archive'),
                        ),
                      ],
                    ),
                  );
                },
                child: const Text('Archive Task'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
