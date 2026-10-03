import 'dart:io';

import 'package:flutter/services.dart' show PlatformException;
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../domain/scan_file.dart';

/// Why a pick did not produce a file.
enum ScanPickFailure {
  /// The customer backed out. Not an error — show nothing.
  cancelled,

  /// Camera permission refused. Offer the gallery.
  cameraDenied,

  /// Photo-library permission refused. Offer the camera.
  galleryDenied,

  /// The device has no usable camera at all.
  noCamera,

  /// A pick is already running (double tap). Ignore quietly.
  busy,

  /// Read as something other than PDF/JPEG/PNG — the server would reject it.
  unsupportedType,

  /// Over the API's 10 MB ceiling even after compression.
  tooLarge,

  /// Anything else.
  unknown,
}

/// The outcome of asking for a file: exactly one of [file] or [failure].
class ScanPickResult {
  const ScanPickResult.picked(ScanFile this.file)
    : failure = null,
      detail = null;
  const ScanPickResult.failed(ScanPickFailure this.failure, {this.detail})
    : file = null;

  final ScanFile? file;
  final ScanPickFailure? failure;

  /// Extra context for [ScanPickFailure.tooLarge] and friends, when there is
  /// something specific worth saying.
  final String? detail;

  bool get isPicked => file != null;
}

/// Capture or choose a prescription scan.
///
/// ## Why the compression settings are what they are
///
/// A modern phone shoots 12 MP. Left alone that is a 4–6 MB JPEG, and the
/// customers this is built for are on Kenyan mobile data — an upload that size
/// is slow at best and a silent failure at worst. `maxWidth`/`maxHeight` cap
/// the long edge at 2000 px and `imageQuality` re-encodes at 75, which lands a
/// typical prescription card around 300–600 KB while keeping the printed
/// numbers legible to the optician who has to read them. Going lower starts to
/// blur decimal points on a `-1.25`, which is the one thing this image exists
/// to convey.
///
/// Note the side effect: setting `imageQuality` makes `image_picker` re-encode,
/// and the result is JPEG regardless of what went in. That is exactly why the
/// MIME type is sniffed from the bytes afterwards rather than taken from the
/// filename — see [sniffScanFile].
class ScanPicker {
  ScanPicker({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  static const double _maxEdge = 2000;
  static const int _quality = 75;

  Future<ScanPickResult> fromCamera() => _pick(ImageSource.camera);

  Future<ScanPickResult> fromGallery() => _pick(ImageSource.gallery);

  Future<ScanPickResult> _pick(ImageSource source) async {
    final XFile? picked;
    try {
      picked = await _picker.pickImage(
        source: source,
        maxWidth: _maxEdge,
        maxHeight: _maxEdge,
        imageQuality: _quality,
        preferredCameraDevice: CameraDevice.rear,
        // The EXIF block is of no use to an optician and carries GPS. Asking
        // for less metadata also skips a photo-library permission prompt on
        // iOS for a camera capture.
        requestFullMetadata: false,
      );
    } on PlatformException catch (e) {
      return ScanPickResult.failed(_mapCode(e.code));
    } catch (_) {
      return const ScanPickResult.failed(ScanPickFailure.unknown);
    }

    if (picked == null) {
      return const ScanPickResult.failed(ScanPickFailure.cancelled);
    }

    final File file = File(picked.path);
    final ScanMime? mime = await sniffScanFile(file);
    if (mime == null) {
      return const ScanPickResult.failed(ScanPickFailure.unsupportedType);
    }

    final int size = await file.length();
    if (size > kMaxScanBytes) {
      return const ScanPickResult.failed(ScanPickFailure.tooLarge);
    }
    if (size == 0) {
      return const ScanPickResult.failed(ScanPickFailure.unknown);
    }

    return ScanPickResult.picked(
      ScanFile(
        path: picked.path,
        bytes: size,
        mime: mime,
        fromCamera: source == ImageSource.camera,
      ),
    );
  }

  /// Maps the plugin's platform error codes onto something the UI can act on.
  ///
  /// The codes are the plugin's own, taken from `FLTImagePickerPlugin.m` and
  /// `ImagePickerDelegate.java`. Both platforms report a refused permission
  /// with the same code, which is what lets one handler cover them.
  ///
  /// Anything unrecognised maps to
  /// [ScanPickFailure.unknown] rather than being guessed at as a refusal —
  /// mislabelling a decode failure as "no permission" would disable the camera
  /// tile and send the customer to Settings to fix something that is not
  /// broken.
  static ScanPickFailure _mapCode(String code) => switch (code) {
    'camera_access_denied' => ScanPickFailure.cameraDenied,
    'photo_access_denied' => ScanPickFailure.galleryDenied,
    'no_available_camera' => ScanPickFailure.noCamera,
    'already_active' || 'multiple_request' => ScanPickFailure.busy,
    _ => ScanPickFailure.unknown,
  };
}

/// Opens the OS settings page for this app, so a "denied forever" permission is
/// never a dead end.
///
/// Returns false when it could not be opened, which the caller must handle by
/// telling the customer where to go by hand — the honest failure, not a
/// pretend-success.
///
/// iOS has a documented URL for this (`app-settings:`, i.e.
/// `UIApplication.openSettingsURLString`) and `url_launcher` can open it.
/// Android has no equivalent scheme: reaching the per-app settings screen needs
/// an `ACTION_APPLICATION_DETAILS_SETTINGS` intent with the package name, which
/// means a platform channel or a package such as `permission_handler` /
/// `app_settings`. Neither is in `pubspec.yaml` and this slice may not add one,
/// so Android returns false here and the UI falls back to written directions.
///
/// TODO(core): if `permission_handler` is ever added for another feature, route
/// this through its `openAppSettings()` and drop the platform split.
Future<bool> openAppSettingsPage() async {
  if (!Platform.isIOS) return false;
  final Uri uri = Uri.parse('app-settings:');
  try {
    if (!await canLaunchUrl(uri)) return false;
    return await launchUrl(uri);
  } catch (_) {
    return false;
  }
}
