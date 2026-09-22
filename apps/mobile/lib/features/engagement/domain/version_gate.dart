/// A dotted numeric version, tolerant of the suffixes real build systems add.
///
/// `package_info_plus` reports `version` as `1.2.3`, and the app's pubspec
/// carries `1.0.0+1`, so `+build` is stripped. A `-beta` pre-release tag is
/// stripped too: pre-release ordering is not something a force-upgrade policy
/// should be deciding, and treating `1.2.3-beta` as `1.2.3` errs towards *not*
/// blocking, which is the direction P0-14 asks us to err in.
class SemanticVersion implements Comparable<SemanticVersion> {
  const SemanticVersion(this.major, this.minor, this.patch);

  final int major;
  final int minor;
  final int patch;

  /// Returns null for anything unparseable — including the empty string, which
  /// is what Remote Config yields for a key that was never published. Callers
  /// treat null as "no opinion", which is how the gate fails open.
  static SemanticVersion? tryParse(String? raw) {
    final String value = (raw ?? '').trim();
    if (value.isEmpty) return null;

    final String core = value.split('+').first.split('-').first.trim();
    if (core.isEmpty) return null;

    final List<String> parts = core.split('.');
    if (parts.isEmpty || parts.length > 4) return null;

    final List<int> numbers = <int>[];
    for (final String part in parts.take(3)) {
      final int? parsed = int.tryParse(part.trim());
      if (parsed == null || parsed < 0) return null;
      numbers.add(parsed);
    }
    while (numbers.length < 3) {
      numbers.add(0);
    }

    return SemanticVersion(numbers[0], numbers[1], numbers[2]);
  }

  @override
  int compareTo(SemanticVersion other) {
    if (major != other.major) return major.compareTo(other.major);
    if (minor != other.minor) return minor.compareTo(other.minor);
    return patch.compareTo(other.patch);
  }

  bool operator <(SemanticVersion other) => compareTo(other) < 0;

  @override
  String toString() => '$major.$minor.$patch';

  @override
  bool operator ==(Object other) =>
      other is SemanticVersion &&
      other.major == major &&
      other.minor == minor &&
      other.patch == patch;

  @override
  int get hashCode => Object.hash(major, minor, patch);
}

/// The four values P0-14 says Remote Config serves. Every field is optional:
/// a half-published config must degrade, not block.
class VersionGateConfig {
  const VersionGateConfig({
    this.minSupportedVersion,
    this.latestVersion,
    this.message,
    this.storeUrl,
  });

  final SemanticVersion? minSupportedVersion;
  final SemanticVersion? latestVersion;
  final String? message;
  final String? storeUrl;

  /// Remote Config parameter names. Kept here so the console and the client
  /// cannot drift apart silently.
  static const String keyMinSupportedVersion = 'minSupportedVersion';
  static const String keyLatestVersion = 'latestVersion';
  static const String keyMessage = 'message';
  static const String keyStoreUrl = 'storeUrl';
}

enum VersionGateStatus {
  /// Nothing to show.
  current,

  /// Dismissible prompt, at most once per 72h.
  updateAvailable,

  /// Non-dismissible block with a store link.
  unsupported,
}

/// The outcome of one check, ready to render.
class VersionGateDecision {
  const VersionGateDecision({
    required this.status,
    required this.installedVersion,
    this.latestVersion,
    this.message,
    this.storeUrl,
  });

  final VersionGateStatus status;
  final SemanticVersion installedVersion;
  final SemanticVersion? latestVersion;
  final String? message;
  final String? storeUrl;

  bool get blocks => status == VersionGateStatus.unsupported;
  bool get nudges => status == VersionGateStatus.updateAvailable;

  /// Compares the installed version against the served config.
  ///
  /// Every uncertainty resolves to [VersionGateStatus.current]. An absent or
  /// unparseable minimum is *not* a reason to block someone — P0-14 is explicit
  /// that the check fails open, and that the minimum is never hardcoded in the
  /// binary, so "we could not read it" is the normal state when Remote Config
  /// is unreachable.
  static VersionGateDecision evaluate({
    required SemanticVersion installed,
    required VersionGateConfig? config,
  }) {
    if (config == null) {
      return VersionGateDecision(
        status: VersionGateStatus.current,
        installedVersion: installed,
      );
    }

    final SemanticVersion? minimum = config.minSupportedVersion;
    final SemanticVersion? latest = config.latestVersion;

    final VersionGateStatus status;
    if (minimum != null && installed < minimum) {
      status = VersionGateStatus.unsupported;
    } else if (latest != null && installed < latest) {
      status = VersionGateStatus.updateAvailable;
    } else {
      status = VersionGateStatus.current;
    }

    return VersionGateDecision(
      status: status,
      installedVersion: installed,
      latestVersion: latest,
      message: config.message,
      storeUrl: config.storeUrl,
    );
  }
}
