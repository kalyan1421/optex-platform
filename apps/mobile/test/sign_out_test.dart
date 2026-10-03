import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:optex_mobile/core/auth/auth_repository.dart';
import 'package:optex_mobile/core/auth/session_manager.dart';
import 'package:optex_mobile/core/providers.dart';

/// Sign-out (SPEC-11 P0-1, and B-1 for push).
///
/// The order is the point. Deregistering this handset from push is an
/// authenticated call, so it has to happen while the session is still good —
/// and whether an access token outlives `POST /auth/logout` depends on the auth
/// server's version, so "it probably still works afterwards" is not a plan.
///
/// The other half is that nothing about tidying up can trap someone signed in:
/// a hook that hangs or throws must not stop them signing out.
class _FakeRepo extends Fake implements AuthRepository {
  _FakeRepo(this.log);
  final List<String> log;

  @override
  Future<void> logout() async => log.add('server-logout');
}

class _FakeSession extends Fake implements SessionManager {
  _FakeSession(this.log);
  final List<String> log;

  @override
  Future<void> clear() async => log.add('session-clear');
}

ProviderContainer _container(
  List<String> log, {
  Duration hookTimeout = const Duration(seconds: 5),
}) => ProviderContainer(
  overrides: [
    authRepositoryProvider.overrideWithValue(_FakeRepo(log)),
    sessionManagerProvider.overrideWithValue(_FakeSession(log)),
    sessionCleanupProvider.overrideWithValue(
      SessionCleanupRegistry(timeout: hookTimeout),
    ),
  ],
);

void main() {
  test('runs teardown BEFORE the server revokes the session', () async {
    final List<String> log = <String>[];
    final ProviderContainer container = _container(log);
    addTearDown(container.dispose);
    container.read(sessionCleanupProvider).register(() async {
      log.add('deregister-push');
    });

    await container.read(authControllerProvider.notifier).logout();

    expect(log, <String>['deregister-push', 'server-logout', 'session-clear']);
  });

  test('ends signed out', () async {
    final List<String> log = <String>[];
    final ProviderContainer container = _container(log);
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).logout();

    expect(
      container.read(authControllerProvider).status,
      AuthStatus.unauthenticated,
    );
  });

  test(
    'a teardown hook that throws does not stop the others, or the sign-out',
    () async {
      final List<String> log = <String>[];
      final ProviderContainer container = _container(log);
      addTearDown(container.dispose);
      final SessionCleanupRegistry registry = container.read(
        sessionCleanupProvider,
      );
      registry.register(() async => throw StateError('cache is corrupt'));
      registry.register(() async => log.add('second-hook'));

      await container.read(authControllerProvider.notifier).logout();

      expect(log, <String>['second-hook', 'server-logout', 'session-clear']);
      expect(container.read(authControllerProvider).isAuthenticated, isFalse);
    },
  );

  test(
    'a teardown hook that hangs is abandoned, so it cannot hold up sign-out',
    () async {
      final List<String> log = <String>[];
      // Real hooks that touch the network inherit the API client's 15s/30s
      // timeouts — far too long to leave someone on a sign-out button.
      final ProviderContainer container = _container(
        log,
        hookTimeout: const Duration(milliseconds: 50),
      );
      addTearDown(container.dispose);
      final SessionCleanupRegistry registry = container.read(
        sessionCleanupProvider,
      );
      registry.register(() => Completer<void>().future); // never completes
      registry.register(() async => log.add('after-the-hang'));

      final Stopwatch clock = Stopwatch()..start();
      await container.read(authControllerProvider.notifier).logout();

      expect(clock.elapsed, lessThan(const Duration(seconds: 2)));
      expect(log, <String>['after-the-hang', 'server-logout', 'session-clear']);
    },
  );

  test('signs out even with no teardown registered', () async {
    final List<String> log = <String>[];
    final ProviderContainer container = _container(log);
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).logout();

    expect(log, <String>['server-logout', 'session-clear']);
  });
}
