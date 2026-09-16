import 'package:flutter/material.dart';
import '../data/synthetic_data.dart';
import '../models/models.dart';
import '../theme.dart';
import 'tasks_screen.dart';

class OverviewScreen extends StatelessWidget {
  final SyntheticDataRepository repo;
  final VoidCallback onNavigateToTasks;
  final VoidCallback onNavigateToAnnouncements;

  const OverviewScreen({
    super.key,
    required this.repo,
    required this.onNavigateToTasks,
    required this.onNavigateToAnnouncements,
  });

  @override
  Widget build(BuildContext context) {
    final members = repo.getScopedMembers();
    final tasks = repo.getScopedTasks();
    final announcements = repo.getScopedAnnouncements();

    // Active members
    final activeMembersCount = repo.currentScope == 'all'
        ? members.where((m) => m.status == 'active').map((m) => m.userId).toSet().length
        : members.where((m) => m.status == 'active').length;

    // Open tasks
    final openTasks = tasks.where((t) => t.status != 'Done').toList();
    final openTasksCount = openTasks.length;

    // Overdue tasks (due before 2026-09-16)
    const todayManila = '2026-09-16';
    final overdueTasks = openTasks.where((t) => t.dueDate != null && t.dueDate!.compareTo(todayManila) < 0).toList();
    final overdueTasksCount = overdueTasks.length;

    // Recent announcements (last 7 days >= 2026-09-10)
    final recentAnnouncements = announcements.where((a) {
      if (a.publishedAt == null) return false;
      return a.publishedAt!.compareTo('2026-09-10') >= 0;
    }).toList();
    final recentAnnouncementsCount = recentAnnouncements.length;

    // Actionable tasks: overdue first, then In progress / high priority
    final actionableTasks = List<TaskItem>.from(openTasks)..sort((a, b) {
      final aOver = (a.dueDate != null && a.dueDate!.compareTo(todayManila) < 0) ? 1 : 0;
      final bOver = (b.dueDate != null && b.dueDate!.compareTo(todayManila) < 0) ? 1 : 0;
      if (aOver != bOver) return bOver.compareTo(aOver);
      const prioMap = {'High': 3, 'Medium': 2, 'Low': 1};
      return (prioMap[b.priority] ?? 0).compareTo(prioMap[a.priority] ?? 0);
    });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 4 Metric Cards Grid
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: MediaQuery.textScalerOf(context).scale(1.0) > 1.3 ? 1.05 : 1.35,
            children: [
              _buildStatCard(
                context,
                title: 'Active Members',
                value: '$activeMembersCount',
                sub: repo.currentScope == 'all' ? 'Deduplicated' : 'In organization',
                keyName: 'metric-members',
              ),
              _buildStatCard(
                context,
                title: 'Open Tasks',
                value: '$openTasksCount',
                sub: 'Backlog, progress, blocked',
                keyName: 'metric-open-tasks',
              ),
              _buildStatCard(
                context,
                title: 'Overdue Tasks',
                value: '$overdueTasksCount',
                sub: 'Due before today ($todayManila)',
                color: AppColors.danger,
                keyName: 'metric-overdue-tasks',
              ),
              _buildStatCard(
                context,
                title: 'Announcements',
                value: '$recentAnnouncementsCount',
                sub: 'Published past 7 days',
                keyName: 'metric-announcements',
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Actionable Tasks Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Actionable Tasks',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              TextButton(
                onPressed: onNavigateToTasks,
                style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                child: const Text('View all'),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (actionableTasks.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Column(
                    children: [
                      const Icon(Icons.check_circle_outline, size: 36, color: AppColors.success),
                      const SizedBox(height: 8),
                      Text(
                        'All tasks are up to date!',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: actionableTasks.take(4).length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final task = actionableTasks[index];
                final isOverdue = task.dueDate != null && task.dueDate!.compareTo(todayManila) < 0;

                return Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => TaskDetailScreen(repo: repo, task: task),
                        ),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  task.title,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                ),
                              ),
                              const SizedBox(width: 8),
                              _buildStatusBadge(task.status),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                task.orgId == 'org-1' ? 'AqOne' : 'Dev Guild',
                                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                              const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                              Text(
                                task.assigneeName,
                                style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                              ),
                              if (task.dueDate != null) ...[
                                const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                                Text(
                                  task.dueDate!,
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

          const SizedBox(height: 24),

          // Recent Announcements Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Recent Announcements',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              TextButton(
                onPressed: onNavigateToAnnouncements,
                style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
                child: const Text('View all'),
              ),
            ],
          ),
          const SizedBox(height: 8),

          if (recentAnnouncements.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Center(
                  child: Text(
                    'No recent announcements.',
                    style: TextStyle(color: AppColors.textMuted),
                  ),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: recentAnnouncements.take(3).length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final ann = recentAnnouncements[index];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ann.title,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'By ${ann.authorName} • ${ann.publishedAt}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          ann.body,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildStatCard(
    BuildContext context, {
    required String title,
    required String value,
    required String sub,
    Color? color,
    required String keyName,
  }) {
    return Card(
      key: Key(keyName),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textMuted),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: color ?? AppColors.text),
              ),
              const SizedBox(height: 2),
              Text(
                sub,
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
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
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(
        status,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }
}
