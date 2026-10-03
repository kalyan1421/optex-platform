import 'dart:io';
import 'dart:typed_data';

/// A file the customer has chosen but not yet uploaded.
///
/// Carries the MIME type we *sniffed from the bytes*, not the one the OS
/// guessed from the extension. That is not fussiness — `PrescriptionsService`
/// rejects the upload outright when the declared `Content-Type` disagrees with
/// what the leading bytes say ("File contents do not match the declared
/// type"), and `image_picker` re-encodes to JPEG whenever `imageQuality` is
/// set, so a file that arrived as `scan.png` may well be JPEG by the time we
/// see it. Sniffing is the only way to declare a type that is guaranteed to
/// match.
class ScanFile {
  const ScanFile({
    required this.path,
    required this.bytes,
    required this.mime,
    required this.fromCamera,
  });

  final String path;

  /// Size in bytes, read once at pick time so the UI can show it and refuse an
  /// oversized file before touching the network.
  final int bytes;

  final ScanMime mime;

  /// Whether this came from the camera. Drives the copy on the confirm step —
  /// "Retake" only makes sense for a photo just taken.
  final bool fromCamera;

  File get file => File(path);

  /// A filename with an extension matching the sniffed type. The service
  /// sanitises this into the storage object key, so it wants to be sane.
  String get uploadName =>
      'prescription-'
      '${DateTime.now().toUtc().millisecondsSinceEpoch}.${mime.extension}';

  String get readableSize {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

/// The three types the API accepts, from `ALLOWED_MIME` in
/// `prescriptions.service.ts`.
enum ScanMime {
  jpeg('image', 'jpeg', 'jpg'),
  png('image', 'png', 'png'),
  pdf('application', 'pdf', 'pdf');

  const ScanMime(this.type, this.subtype, this.extension);

  final String type;
  final String subtype;
  final String extension;

  bool get isImage => this != ScanMime.pdf;
}

/// The API's ceiling, from `MAX_FILE_BYTES`. Mirrored so an oversized file can
/// be refused locally instead of being pushed up a Kenyan mobile link only to
/// come back 413.
const int kMaxScanBytes = 10 * 1024 * 1024;

/// Identifies a file from its leading bytes.
///
/// A direct port of `detectFileType` in `prescriptions.service.ts` — the same
/// three signatures, checked the same way — so that anything this accepts, the
/// server will accept too. Returns null for anything else.
ScanMime? sniffScanMime(Uint8List head) {
  if (head.length < 8) return null;

  // "%PDF"
  if (head[0] == 0x25 &&
      head[1] == 0x50 &&
      head[2] == 0x44 &&
      head[3] == 0x46) {
    return ScanMime.pdf;
  }

  // JPEG SOI marker.
  if (head[0] == 0xFF && head[1] == 0xD8) return ScanMime.jpeg;

  // PNG: \x89PNG\r\n\x1a\n
  const List<int> pngMagic = <int>[
    0x89,
    0x50,
    0x4E,
    0x47,
    0x0D,
    0x0A,
    0x1A,
    0x0A,
  ];
  for (int i = 0; i < pngMagic.length; i++) {
    if (head[i] != pngMagic[i]) return null;
  }
  return ScanMime.png;
}

/// Reads just enough of a file to identify it, without loading the whole thing.
///
/// A 10 MB scan held in the heap purely to check eight bytes is exactly the
/// waste the server-side `limits.fileSize` fix was about, and the upload itself
/// streams from the path anyway.
Future<ScanMime?> sniffScanFile(File file) async {
  RandomAccessFile? handle;
  try {
    handle = await file.open();
    final Uint8List head = await handle.read(8);
    return sniffScanMime(head);
  } on FileSystemException {
    return null;
  } finally {
    await handle?.close();
  }
}
