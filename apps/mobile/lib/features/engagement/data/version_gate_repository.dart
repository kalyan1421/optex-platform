import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/version_gate.dart';
import 'firebase_bootstrap.dart';

/// Reads the force-upgrade policy from Firebase Remote Config (SPEC-11 P0-14).
///
/// Remote Config rather than a new API endpoint, for the reason the spec gives:
/// the minimum has to be movable in minutes without a backend deploy, and
/// Firebase is already a dependency of push.
///
/// **Everything fails open.** `fetchConfig` returns null on a timeout, a
/// network error, an unconfigured Firebase, or a malformed value, and null
/// means "no opinion" all the way up to [VersionGateDecision.evaluate]. There
/// is no hardcoded minimum anywhere in this file — the in-binary defaults are
/// empty strings, which parse to null. P0-14 is explicit that a shipped
/// constant is exactly the thing that cannot be changed when it matters.
class VersionGateRepository {
  VersionGateRepository();

  /// How long the whole check is allowed to take. Past this the app proceeds.
  static const Duration fetchTimeout = Duration(seconds: 6);

  /// Remote Config's own cache window. An hour matches the P0-14 cadence
  /// ("cold start, and foreground after > 1h idle") without hammering the
  /// service.
  static const Duration minimumFetchInterval = Duration(hours: 1);

  static const String _lastSoftPromptKey = 'optex.version_gate.last_soft_prompt';
  static const String _lastCheckKey = 'optex.version_gate.last_check';

  /// P0-14: the dismissible prompt is shown at most once per 72h.
  static const Duration softPromptCooldown = Duration(hours: 72);

  /// The version this binary reports, or null if it cannot be read.
  Future<SemanticVersion?> installedVersion() async {
    try {
      final PackageInfo info = await PackageInfo.fromPlatform();
      return SemanticVersion.tryParse(info.version);
    } catch (error) {
      developer.log('Could not read installed version: $error',
          name: 'optex.engagement');
      return null;
    }
  }

  /// Returns the served policy, or null when it could not be read for any
  /// reason whatsoever.
  Future<VersionGateConfig?> fetchConfig() async {
    if (!await FirebaseBootstrap.ensureInitialized()) return null;

    try {
      final FirebaseRemoteConfig remote = FirebaseRemoteConfig.instance;

      await remote.setConfigSettings(
        RemoteConfigSettings(
          fetchTimeout: fetchTimeout,
          minimumFetchInterval: minimumFetchInterval,
        ),
      );

      // Empty defaults, not a baked-in minimum: an empty string parses to null
      // and the gate stays silent.
      await remote.setDefaults(const <String, dynamic>{
        VersionGateConfig.keyMinSupportedVersion: '',
        VersionGateConfig.keyLatestVersion: '',
        VersionGateConfig.keyMessage: '',
        VersionGateConfig.keyStoreUrl: '',
      });

      // Belt and braces: `fetchTimeout` is honoured by the SDK, but a wedged
      // platform channel would not be, and a version check must never be the
      // reason a customer waits.
      await remote.fetchAndActivate().timeout(fetchTimeout + const Duration(seconds: 2));

      return VersionGateConfig(
        minSupportedVersion: SemanticVersion.tryParse(
          remote.getString(VersionGateConfig.keyMinSupportedVersion),
        ),
        latestVersion: SemanticVersion.tryParse(
          remote.getString(VersionGateConfig.keyLatestVersion),
        ),
        message: _nullIfBlank(remote.getString(VersionGateConfig.keyMessage)),
        storeUrl: _nullIfBlank(remote.getString(VersionGateConfig.keyStoreUrl)),
      );
    } catch (error) {
      developer.log(
        'Version gate config unavailable; proceeding without it: $error',
        name: 'optex.engagement',
      );
      return null;
    }
  }

  Future<DateTime?> lastSoftPromptAt() => _readTimestamp(_lastSoftPromptKey);

  Future<void> recordSoftPrompt() => _writeTimestamp(_lastSoftPromptKey);

  Future<DateTime?> lastCheckAt() => _readTimestamp(_lastCheckKey);

  Future<void> recordCheck() => _writeTimestamp(_lastCheckKey);

  /// Whether the 72h cooldown has elapsed. A device that cannot persist the
  /// timestamp errs towards *not* nagging.
  Future<bool> softPromptIsDue() async {
    final DateTime? last = await lastSoftPromptAt();
    if (last == null) return true;
    return DateTime.now().difference(last) >= softPromptCooldown;
  }

  Future<DateTime?> _readTimestamp(String key) async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final int? millis = prefs.getInt(key);
      return millis == null ? null : DateTime.fromMillisecondsSinceEpoch(millis);
    } catch (_) {
      return null;
    }
  }

  Future<void> _writeTimestamp(String key) async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setInt(key, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {
      // Worst case the prompt shows again sooner than 72h. Acceptable; a
      // storage failure must not become a blocked app.
    }
  }

  static String? _nullIfBlank(String value) =>
      value.trim().isEmpty ? null : value.trim();
}
