import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/providers.dart';
import '../data/branches_repository.dart';
import '../domain/branch.dart';

final Provider<BranchesRepository> branchesRepositoryProvider =
    Provider<BranchesRepository>(
      (Ref ref) => BranchesRepository(ref.watch(apiClientProvider)),
    );

/// How the locator currently stands with the device's location.
///
/// Every value except [granted] still yields a usable, alphabetically sorted
/// list — permission is an enhancement here, never a gate (P0-7).
enum LocationAccess {
  /// Not asked yet. The screen offers a "Sort by nearest" action.
  notAsked,

  /// Granted and a fix was obtained; the list is distance-sorted.
  granted,

  /// Declined this time. Asking again is allowed.
  denied,

  /// Declined permanently — only the OS settings screen can change it.
  deniedForever,

  /// Permission is fine but location services are switched off device-wide.
  serviceDisabled,

  /// Granted, but no fix came back (indoors, airplane mode, timeout).
  unavailable,
}

class BranchLocatorState {
  const BranchLocatorState({
    required this.branches,
    this.access = LocationAccess.notAsked,
    this.locating = false,
  });

  /// Sorted: by distance when a fix exists, alphabetically otherwise.
  final List<BranchDistance> branches;
  final LocationAccess access;

  /// True while the permission prompt or the GPS fix is in flight, so the
  /// button can show progress without blanking the list behind it.
  final bool locating;

  BranchLocatorState copyWith({
    List<BranchDistance>? branches,
    LocationAccess? access,
    bool? locating,
  }) => BranchLocatorState(
    branches: branches ?? this.branches,
    access: access ?? this.access,
    locating: locating ?? this.locating,
  );
}

class BranchLocatorController extends AsyncNotifier<BranchLocatorState> {
  BranchesRepository get _repo => ref.read(branchesRepositoryProvider);

  Position? _fix;

  @override
  Future<BranchLocatorState> build() async {
    final List<Branch> branches = await _repo.list();

    // Check the *existing* grant without prompting. Throwing a system
    // permission dialog at someone the moment a screen opens is how people
    // learn to tap "Deny" reflexively; the prompt belongs behind a button
    // that says what it is for.
    LocationAccess access = LocationAccess.notAsked;
    try {
      final LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.deniedForever) {
        access = LocationAccess.deniedForever;
      } else if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        final Position? fix = await _currentFix();
        if (fix != null) {
          _fix = fix;
          access = LocationAccess.granted;
        } else {
          access = LocationAccess.unavailable;
        }
      }
    } catch (_) {
      // A platform that cannot answer is the same as not having asked: the
      // alphabetical list still renders.
      access = LocationAccess.notAsked;
    }

    return BranchLocatorState(branches: _sort(branches, _fix), access: access);
  }

  Future<void> refresh() async {
    state = const AsyncValue<BranchLocatorState>.loading();
    state = await AsyncValue.guard(() async {
      final List<Branch> branches = await _repo.list();
      return BranchLocatorState(
        branches: _sort(branches, _fix),
        access: state.value?.access ?? LocationAccess.notAsked,
      );
    });
  }

  /// Asks for coarse location and re-sorts on success.
  ///
  /// Every failure path ends in a state the screen can explain and recover
  /// from — a denial leaves the alphabetical list exactly as it was.
  Future<void> requestLocation() async {
    final BranchLocatorState? current = state.value;
    if (current == null || current.locating) return;

    state = AsyncValue<BranchLocatorState>.data(
      current.copyWith(locating: true),
    );

    LocationAccess access;
    Position? fix;
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      switch (permission) {
        case LocationPermission.denied:
        case LocationPermission.unableToDetermine:
          access = LocationAccess.denied;
        case LocationPermission.deniedForever:
          access = LocationAccess.deniedForever;
        case LocationPermission.whileInUse:
        case LocationPermission.always:
          if (!await Geolocator.isLocationServiceEnabled()) {
            access = LocationAccess.serviceDisabled;
          } else {
            fix = await _currentFix();
            access = fix == null
                ? LocationAccess.unavailable
                : LocationAccess.granted;
          }
      }
    } catch (_) {
      access = LocationAccess.unavailable;
    }

    _fix = fix ?? _fix;
    final List<Branch> branches = current.branches
        .map((BranchDistance b) => b.branch)
        .toList();

    state = AsyncValue<BranchLocatorState>.data(
      BranchLocatorState(
        branches: _sort(
          branches,
          access == LocationAccess.granted ? _fix : null,
        ),
        access: access,
        locating: false,
      ),
    );
  }

  /// Opens the OS settings page that can undo a permanent denial, or turn
  /// location services back on. Returns false when the platform refuses.
  Future<bool> openSettings({required bool locationServices}) async {
    try {
      return locationServices
          ? await Geolocator.openLocationSettings()
          : await Geolocator.openAppSettings();
    } catch (_) {
      return false;
    }
  }

  /// Coarse accuracy with a hard time limit: this powers a sort order, not
  /// turn-by-turn navigation, and a locator that hangs waiting for a precise
  /// fix is worse than one that quietly stays alphabetical.
  Future<Position?> _currentFix() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      // Fall back to the last known fix before giving up — a slightly stale
      // position still sorts the list better than no position at all.
      try {
        return await Geolocator.getLastKnownPosition();
      } catch (_) {
        return null;
      }
    }
  }

  /// Distance-sorts when a fix exists, alphabetically otherwise. Branches
  /// without coordinates always sink to the bottom of a distance sort rather
  /// than being dropped — they are still real shops with a phone number.
  static List<BranchDistance> _sort(List<Branch> branches, Position? fix) {
    final List<BranchDistance> withDistance = branches.map((Branch b) {
      if (fix == null || !b.hasCoordinates) {
        return BranchDistance(branch: b);
      }
      return BranchDistance(
        branch: b,
        distanceMetres: Geolocator.distanceBetween(
          fix.latitude,
          fix.longitude,
          b.lat!,
          b.lng!,
        ),
      );
    }).toList();

    withDistance.sort((BranchDistance a, BranchDistance b) {
      final double? da = a.distanceMetres;
      final double? db = b.distanceMetres;
      if (da != null && db != null && da != db) return da.compareTo(db);
      if (da != null && db == null) return -1;
      if (da == null && db != null) return 1;
      return a.branch.name.toLowerCase().compareTo(b.branch.name.toLowerCase());
    });

    return withDistance;
  }
}

final AsyncNotifierProvider<BranchLocatorController, BranchLocatorState>
branchLocatorProvider =
    AsyncNotifierProvider<BranchLocatorController, BranchLocatorState>(
      BranchLocatorController.new,
    );
