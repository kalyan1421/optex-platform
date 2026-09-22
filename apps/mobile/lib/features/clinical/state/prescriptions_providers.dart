import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../data/scan_picker.dart';
import '../domain/prescription.dart';
import '../domain/scan_file.dart';
import 'clinical_providers.dart';

/// The caller's uploaded prescriptions.
///
/// Deliberately NOT auto-disposed. The list is the destination a finished
/// upload returns to, and an auto-disposed provider would be torn down the
/// moment the upload screen covers it and re-fetched on the way back — a
/// visible flash of spinner at exactly the moment the customer wants to see
/// their new row appear.
final FutureProvider<List<Prescription>> prescriptionsProvider =
    FutureProvider<List<Prescription>>(
      (Ref ref) => ref.watch(prescriptionsRepositoryProvider).list(),
    );

/// Where an upload has got to.
enum UploadPhase {
  /// Nothing chosen yet.
  idle,

  /// The picker is open.
  picking,

  /// A file is in hand and waiting on the customer to confirm or retake.
  confirming,

  /// Bytes on the wire.
  uploading,

  /// Stored. [PrescriptionUploadState.uploaded] holds the new row.
  done,
}

/// What the customer is blocked by, when they are blocked by a permission.
enum PermissionBlock { none, camera, gallery, both }

/// The upload screen's whole state, in one immutable value.
class PrescriptionUploadState {
  const PrescriptionUploadState({
    this.phase = UploadPhase.idle,
    this.scan,
    this.sent = 0,
    this.total = 0,
    this.error,
    this.uploaded,
    this.block = PermissionBlock.none,
    this.measurements = PrescriptionMeasurements.empty,
  });

  final UploadPhase phase;
  final ScanFile? scan;
  final int sent;
  final int total;

  /// Customer-safe message. From `ApiException.message` when the server spoke,
  /// written here when it did not.
  final String? error;

  final Prescription? uploaded;
  final PermissionBlock block;
  final PrescriptionMeasurements measurements;

  /// 0..1, or null while the total length is still unknown — which is what
  /// tells the progress bar to render indeterminate rather than sit at zero.
  double? get progress {
    if (phase != UploadPhase.uploading) return null;
    if (total <= 0) return null;
    return (sent / total).clamp(0.0, 1.0);
  }

  bool get isBusy =>
      phase == UploadPhase.picking || phase == UploadPhase.uploading;

  PrescriptionUploadState copyWith({
    UploadPhase? phase,
    ScanFile? scan,
    int? sent,
    int? total,
    String? error,
    Prescription? uploaded,
    PermissionBlock? block,
    PrescriptionMeasurements? measurements,
    bool clearScan = false,
    bool clearError = false,
  }) => PrescriptionUploadState(
    phase: phase ?? this.phase,
    scan: clearScan ? null : (scan ?? this.scan),
    sent: sent ?? this.sent,
    total: total ?? this.total,
    error: clearError ? null : (error ?? this.error),
    uploaded: uploaded ?? this.uploaded,
    block: block ?? this.block,
    measurements: measurements ?? this.measurements,
  );
}

/// Drives prescription capture and upload.
///
/// ## Why this lives above the widget tree
///
/// The provider is not auto-disposed, so the upload keeps running and keeps
/// reporting progress if the customer navigates away mid-upload or the app is
/// backgrounded. Dio's request is owned here, not by a `State` object that
/// `dispose()` would take with it.
///
/// What that does NOT buy: survival of process death. Neither platform lets a
/// plain Dart HTTP request continue once the OS suspends or kills the app —
/// iOS gives roughly thirty seconds after backgrounding and Android may kill a
/// backgrounded process under memory pressure. A genuinely resumable upload
/// needs a native background transfer (`URLSession` background configuration /
/// `WorkManager`), which is platform work outside this slice.
///
/// TODO(core): if background uploads become a requirement, that belongs in
/// `lib/core/network` as a queued transfer service, not in a feature.
class PrescriptionUploadController extends Notifier<PrescriptionUploadState> {
  @override
  PrescriptionUploadState build() => const PrescriptionUploadState();

  /// Clears everything — called when the screen is opened fresh, so a previous
  /// session's finished upload is not still on screen.
  void reset() => state = const PrescriptionUploadState();

  void setMeasurements(PrescriptionMeasurements value) =>
      state = state.copyWith(measurements: value);

  /// Drops the chosen file and returns to the source chooser. This is the
  /// "retake" half of the confirm step.
  void discard() => state = const PrescriptionUploadState();

  Future<void> pickFromCamera() => _pick(fromCamera: true);

  Future<void> pickFromGallery() => _pick(fromCamera: false);

  Future<void> _pick({required bool fromCamera}) async {
    if (state.isBusy) return;
    state = state.copyWith(phase: UploadPhase.picking, clearError: true);

    final ScanPicker picker = ref.read(scanPickerProvider);
    final ScanPickResult result = fromCamera
        ? await picker.fromCamera()
        : await picker.fromGallery();

    if (result.isPicked) {
      state = state.copyWith(
        phase: UploadPhase.confirming,
        scan: result.file,
        block: PermissionBlock.none,
        clearError: true,
      );
      return;
    }

    state = switch (result.failure!) {
      // Backing out of the picker is a decision, not a failure. Returning to
      // idle without a message is the whole handling.
      ScanPickFailure.cancelled || ScanPickFailure.busy => state.copyWith(
        phase: UploadPhase.idle,
        clearError: true,
      ),
      ScanPickFailure.cameraDenied => state.copyWith(
        phase: UploadPhase.idle,
        block: _escalate(PermissionBlock.camera),
        error: 'OPTEX does not have permission to use the camera.',
      ),
      ScanPickFailure.galleryDenied => state.copyWith(
        phase: UploadPhase.idle,
        block: _escalate(PermissionBlock.gallery),
        error: 'OPTEX does not have permission to open your photos.',
      ),
      ScanPickFailure.noCamera => state.copyWith(
        phase: UploadPhase.idle,
        block: _escalate(PermissionBlock.camera),
        error: 'This device has no camera. Choose a photo instead.',
      ),
      ScanPickFailure.unsupportedType => state.copyWith(
        phase: UploadPhase.idle,
        error:
            'That file is not a photo or PDF we can read. '
            'Try a JPG, PNG or PDF of your prescription.',
      ),
      ScanPickFailure.tooLarge => state.copyWith(
        phase: UploadPhase.idle,
        error:
            'That file is larger than 10 MB, even after compressing. '
            'Try photographing the prescription instead of scanning it.',
      ),
      ScanPickFailure.unknown => state.copyWith(
        phase: UploadPhase.idle,
        error: 'That file could not be opened. Please try another.',
      ),
    };
  }

  /// Remembers that BOTH sources are now blocked, rather than overwriting one
  /// refusal with the other. It is the combination that has no way forward and
  /// therefore needs the settings route.
  PermissionBlock _escalate(PermissionBlock next) {
    if (state.block == PermissionBlock.none || state.block == next) return next;
    return PermissionBlock.both;
  }

  /// Sends the confirmed file.
  ///
  /// Returns true on success. The caller uses that to navigate; failure leaves
  /// the file in hand and the error on screen so the customer can simply tap
  /// Send again rather than re-photograph anything.
  Future<bool> upload() async {
    final ScanFile? scan = state.scan;
    if (scan == null || state.phase == UploadPhase.uploading) return false;

    state = state.copyWith(
      phase: UploadPhase.uploading,
      sent: 0,
      total: scan.bytes,
      clearError: true,
    );

    try {
      final Prescription created = await ref
          .read(prescriptionsRepositoryProvider)
          .upload(
            scan: scan,
            measurements: state.measurements,
            onProgress: (int sent, int total) {
              // `total` is -1 when the length is unknown; fall back to the
              // size measured at pick time rather than showing nothing.
              state = state.copyWith(
                sent: sent,
                total: total > 0 ? total : scan.bytes,
              );
            },
          );

      state = state.copyWith(phase: UploadPhase.done, uploaded: created);
      // The list is the screen the customer lands back on; refresh it now so
      // the new row is already there rather than appearing a beat later.
      ref.invalidate(prescriptionsProvider);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(phase: UploadPhase.confirming, error: e.message);
      return false;
    } catch (_) {
      // The repository normalises everything it can into an `ApiException`, so
      // reaching here means something genuinely unexpected. Land back on the
      // confirm step with the file still in hand rather than leaving a
      // progress bar running forever against nothing.
      state = state.copyWith(
        phase: UploadPhase.confirming,
        error: 'The upload stopped unexpectedly. Please try again.',
      );
      return false;
    }
  }
}

final NotifierProvider<PrescriptionUploadController, PrescriptionUploadState>
prescriptionUploadControllerProvider =
    NotifierProvider<PrescriptionUploadController, PrescriptionUploadState>(
      PrescriptionUploadController.new,
    );

/// Requests a fresh signed URL for one prescription.
///
/// A family so each prescription gets its own entry, and auto-disposed so the
/// URL is dropped the instant the viewer closes. Both matter: these links are
/// bearer capabilities for a medical record with a 60-second life, and keeping
/// a dead one around only invites something to try to reuse it.
///
/// Re-opening the same prescription re-reads this provider and therefore issues
/// a brand-new URL, which is the required behaviour rather than an accident.
// The family's own type (`FutureProviderFamily`) is not exported by
// `flutter_riverpod`, so this is one of the few places the slice lets the type
// be inferred rather than writing it out.
final prescriptionDownloadProvider = FutureProvider.autoDispose
    .family<SignedDownload, String>(
      (Ref ref, String id) =>
          ref.watch(prescriptionsRepositoryProvider).signedUrl(id),
    );
