import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/synthetic_data.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('Navigation across all four bottom destinations', (WidgetTester tester) async {
    final repo = SyntheticDataRepository();
    await tester.pumpWidget(AqOneDevGuildApp(initialRepo: repo));
    await tester.pumpAndSettle();

    // 1. Overview destination
    expect(find.text('Actionable Tasks'), findsOneWidget);
    expect(find.text('Recent Announcements'), findsOneWidget);
    expect(find.byKey(const Key('metric-members')), findsOneWidget);

    // 2. Switch to Members destination
    await tester.tap(find.byIcon(Icons.people_outline));
    await tester.pumpAndSettle();
    expect(find.text('All roles'), findsOneWidget);
    expect(find.text('Alex Rivera'), findsAtLeastNWidgets(1));

    // 3. Switch to Tasks destination
    await tester.tap(find.byIcon(Icons.check_box_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Design responsive navigation rail'), findsOneWidget);
    expect(find.text('Overdue only'), findsOneWidget);

    // 4. Switch to Announcements destination
    await tester.tap(find.byIcon(Icons.campaign_outlined));
    await tester.pumpAndSettle();
    expect(find.text('Welcome to the AqOne & Dev Guild unified management portal'), findsOneWidget);
  });

  testWidgets('Organization scope switching updates displayed records', (WidgetTester tester) async {
    final repo = SyntheticDataRepository();
    await tester.pumpWidget(AqOneDevGuildApp(initialRepo: repo));
    await tester.pumpAndSettle();

    // Verify initial All Organizations scope
    expect(repo.currentScope, equals('all'));
    expect(find.text('Deduplicated'), findsOneWidget);

    // Switch scope to AqOne
    repo.setScope('org-1');
    await tester.pumpAndSettle();
    expect(repo.currentScope, equals('org-1'));
    expect(find.text('In organization'), findsOneWidget);

    // Switch scope to Dev Guild
    repo.setScope('org-2');
    await tester.pumpAndSettle();
    expect(repo.currentScope, equals('org-2'));
  });

  testWidgets('Role-specific UI permissions: Member role hides management actions', (WidgetTester tester) async {
    final repo = SyntheticDataRepository();
    // Set to Member persona (Sam Taylor)
    repo.switchPersona(SyntheticDataRepository.userSam);

    await tester.pumpWidget(AqOneDevGuildApp(initialRepo: repo));
    await tester.pumpAndSettle();

    // Overview should NOT show invite FAB or admin actions
    // Switch to Members
    await tester.tap(find.byIcon(Icons.people_outline));
    await tester.pumpAndSettle();

    // FAB for invite member should NOT exist for Member role
    expect(find.byKey(const Key('btn-fab-invite')), findsNothing);

    // Switch to Tasks
    await tester.tap(find.byIcon(Icons.check_box_outlined));
    await tester.pumpAndSettle();

    // FAB for task creation should NOT exist for Member role
    expect(find.byKey(const Key('btn-fab-task')), findsNothing);

    // Open Alex Rivera member detail
    await tester.tap(find.byIcon(Icons.people_outline));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Alex Rivera').first);
    await tester.pumpAndSettle();

    // Private notes field must NOT be in the widget tree for Member
    expect(find.byKey(const Key('input-member-notes')), findsNothing);
  });

  testWidgets('Disabled offline writes: mutation shows snackbar and rejects changes (UI-REQ-008)', (WidgetTester tester) async {
    final repo = SyntheticDataRepository();
    // Simulate offline mode
    repo.setOffline(true);

    await tester.pumpWidget(AqOneDevGuildApp(initialRepo: repo));
    await tester.pumpAndSettle();

    // Verify offline banner is shown
    expect(find.text('Offline: Showing cached reads. Mutations disabled.'), findsOneWidget);

    // Attempt mutation: invite member
    await tester.tap(find.byIcon(Icons.people_outline));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('btn-fab-invite')));
    await tester.pumpAndSettle();

    // Enter email in dialog
    await tester.enterText(find.byType(TextFormField).first, 'offline_test@example.com');
    await tester.tap(find.text('Send invitation'));
    await tester.pumpAndSettle();

    // Verify rejection snackbar appears
    expect(find.text('Cannot invite members while offline (UI-REQ-008).'), findsOneWidget);

    // Verify member was NOT added
    expect(repo.getScopedMembers().any((m) => m.email == 'offline_test@example.com'), isFalse);
  });

  testWidgets('200 percent text scaling does not cause unhandled layout crash', (WidgetTester tester) async {
    final repo = SyntheticDataRepository();

    // Render with 2.0 text scaling
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          size: Size(375, 667),
          textScaler: TextScaler.linear(2.0),
        ),
        child: AqOneDevGuildApp(initialRepo: repo),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Actionable Tasks'), findsOneWidget);

    // Navigate to tasks
    await tester.tap(find.byIcon(Icons.check_box_outlined));
    await tester.pumpAndSettle();

    expect(find.byType(Card), findsWidgets);
  });
}
