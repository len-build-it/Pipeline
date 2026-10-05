import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/data/app_repository.dart';
import 'package:mobile/data/synthetic_data.dart';
import 'package:mobile/main.dart';
import 'package:mobile/screens/home_shell.dart';
import 'package:mobile/services/secure_cache_service.dart';
import 'support/auth_entry_fixtures.dart' as fixtures;

class RecordingStorage extends InMemoryStorageAdapter {
  final writes = <String>[];
  @override
  Future<void> write({required String key, required String value}) async {
    writes.add(key);
    await super.write(key: key, value: value);
  }
}

void main() {
  testWidgets(
    'explicit demo is local, labeled and reset after exit and re-entry',
    (tester) async {
      final storage = RecordingStorage();
      var requests = 0;
      final account = fixtures.repository(storage, (request) async {
        requests++;
        return fixtures.live(request);
      });
      await tester.pumpWidget(TeamManagerApp(initialRepo: account));
      await tester.pumpAndSettle();
      expect(find.text('Demo - sample data'), findsNothing);
      await tester.ensureVisible(find.text('Try demo'));
      await tester.tap(find.text('Try demo'));
      await tester.pumpAndSettle();
      expect(find.text('Demo - sample data'), findsOneWidget);
      final demo = tester.widget<HomeShell>(find.byType(HomeShell)).repo;
      expect(demo, isNot(isA<AppRepository>()));
      expect(demo, isA<SyntheticDataRepository>());
      demo.setTasks([]);
      expect(demo.allTasks, isEmpty);
      await tester.tap(find.byKey(const Key('popup-persona')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Leave demo'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('sign-in-email')), findsOneWidget);
      await tester.ensureVisible(find.text('Try demo'));
      await tester.tap(find.text('Try demo'));
      await tester.pumpAndSettle();
      final fresh = tester.widget<HomeShell>(find.byType(HomeShell)).repo;
      expect(identical(demo, fresh), isFalse);
      expect(fresh.allTasks, isNotEmpty);
      expect(requests, 0);
      expect(storage.writes, isEmpty);
      expect(await account.apiClient.getAccessToken(), isNull);
      expect(await account.apiClient.getRefreshToken(), isNull);
    },
  );

  testWidgets('Android back closes secondary route then leaves demo', (
    tester,
  ) async {
    await tester.pumpWidget(
      TeamManagerApp(
        initialRepo: fixtures.repository(
          InMemoryStorageAdapter(),
          fixtures.live,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Try demo'));
    await tester.tap(find.text('Try demo'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('popup-persona')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Finance'));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Demo - sample data'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('sign-in-email')), findsOneWidget);
  });

  testWidgets('demo banner is announced to screen readers', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      TeamManagerApp(
        initialRepo: fixtures.repository(
          InMemoryStorageAdapter(),
          fixtures.live,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Try demo'));
    await tester.tap(find.text('Try demo'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Demo - sample data'), findsOneWidget);
    handle.dispose();
  });

  testWidgets(
    'demo navigation remains readable at 200 percent text on a phone',
    (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpWidget(
        TeamManagerApp(
          initialRepo: fixtures.repository(
            InMemoryStorageAdapter(),
            fixtures.live,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Try demo'));
      await tester.tap(find.text('Try demo'));
      await tester.pumpAndSettle();
      expect(find.text('Demo - sample data'), findsOneWidget);
      for (final icon in [
        Icons.people_outline,
        Icons.check_box_outlined,
        Icons.campaign_outlined,
      ]) {
        await tester.tap(find.byIcon(icon));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
    },
  );
}
