import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/nairobi_time.dart';
import '../domain/prescription.dart';
import '../state/prescriptions_providers.dart';

/// Opens a prescription file.
///
/// Presented as a plain fullscreen dialog rather than a route, deliberately:
/// `Routes` has no prescription-detail path, and giving one a deep link would
/// mean a URL that resolves to somebody's medical record living in a launcher
/// history. It is reachable only from the list, by the owner, in-session.
Future<void> openPrescriptionViewer(
  BuildContext context,
  Prescription prescription,
) {
  return Navigator.of(context).push<void>(
    MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (BuildContext _) =>
          _PrescriptionViewer(prescription: prescription),
    ),
  );
}

/// Renders one prescription from a freshly-minted signed URL.
///
/// ## The rules this screen exists to keep
///
/// 1. **A new URL every time.** `prescriptionDownloadProvider` is an
///    auto-disposed family, so opening this screen always issues a fresh
///    `GET /prescriptions/:id/download` and closing it throws the URL away.
///    Nothing anywhere holds a signed link between viewings.
/// 2. **Nothing touches shared storage.** An image is decoded into Flutter's
///    in-memory `ImageCache` and evicted on the way out. There is no download
///    button, no save-to-gallery, no `path_provider` write. These are medical
///    records; a copy sitting in `/sdcard/Download` outlives every access
///    control the API has.
/// 3. **Expiry is visible.** The link lives for `expiresIn` seconds (60 today,
///    read from the response rather than hardcoded). When it lapses the screen
///    says so and offers to fetch another, instead of showing a broken image.
class _PrescriptionViewer extends ConsumerStatefulWidget {
  const _PrescriptionViewer({required this.prescription});

  final Prescription prescription;

  @override
  ConsumerState<_PrescriptionViewer> createState() =>
      _PrescriptionViewerState();
}

class _PrescriptionViewerState extends ConsumerState<_PrescriptionViewer> {
  /// Every URL this screen has resolved, so all of them can be evicted from the
  /// image cache on the way out — including ones superseded by a refresh.
  final Set<String> _seenUrls = <String>{};

  @override
  void dispose() {
    for (final String url in _seenUrls) {
      // Drops the decoded bytes from the in-memory cache. Fire-and-forget: the
      // widget is already going away and nothing awaits the result.
      NetworkImage(url).evict().ignore();
    }
    super.dispose();
  }

  void _refresh() =>
      ref.invalidate(prescriptionDownloadProvider(widget.prescription.id));

  @override
  Widget build(BuildContext context) {
    final AsyncValue<SignedDownload> async = ref.watch(
      prescriptionDownloadProvider(widget.prescription.id),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Prescription · ${formatShortDate(widget.prescription.createdAt)}',
        ),
        actions: <Widget>[
          IconButton(
            tooltip: 'Reload',
            onPressed: async.isLoading ? null : _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: async.when(
        loading: () => const AppLoading(label: 'Opening securely'),
        error: (Object error, StackTrace _) =>
            AppErrorView(error: error, onRetry: _refresh),
        data: (SignedDownload link) {
          _seenUrls.add(link.url);
          return widget.prescription.isPdf
              ? _PdfHandoff(link: link, onRefresh: _refresh)
              : _ImageView(link: link, onRefresh: _refresh);
        },
      ),
    );
  }
}

class _ImageView extends StatelessWidget {
  const _ImageView({required this.link, required this.onRefresh});

  final SignedDownload link;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        Expanded(
          child: InteractiveViewer(
            // Prescriptions are photographed at arm's length and the numbers
            // are small; pinch-zoom is the difference between checking a value
            // and squinting at it.
            minScale: 1,
            maxScale: 5,
            child: Center(
              child: Image.network(
                link.url,
                fit: BoxFit.contain,
                loadingBuilder:
                    (
                      BuildContext context,
                      Widget child,
                      ImageChunkEvent? progress,
                    ) {
                      if (progress == null) return child;
                      final int? total = progress.expectedTotalBytes;
                      return AppLoading(
                        label: total == null
                            ? 'Loading'
                            : '${((progress.cumulativeBytesLoaded / total) * 100).round()}%',
                      );
                    },
                errorBuilder: (BuildContext context, Object _, StackTrace? _) =>
                    _Expired(onRefresh: onRefresh),
              ),
            ),
          ),
        ),
        _ExpiryFooter(link: link),
      ],
    );
  }
}

/// PDFs open outside the app, and the customer is told so before it happens.
///
/// There is no PDF renderer in `pubspec.yaml` and this slice may not add one,
/// so the only way to show a PDF prescription today is to hand the signed URL
/// to the system browser. That is a real weakening of rule 2 above — the
/// browser may keep its own copy in its download folder or cache, outside
/// anything OPTEX controls — so it is an explicit, explained choice rather
/// than a silent one, and images (the overwhelmingly common case for a phone
/// upload) never take this path.
///
/// TODO(core): adding `pdfx` or `syncfusion_flutter_pdfviewer` to the app's
/// dependencies would let this render in-process like the image path does, and
/// close the gap properly.
class _PdfHandoff extends StatelessWidget {
  const _PdfHandoff({required this.link, required this.onRefresh});

  final SignedDownload link;
  final VoidCallback onRefresh;

  Future<void> _open(BuildContext context) async {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    bool ok = false;
    try {
      ok = await launchUrl(
        Uri.parse(link.url),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      ok = false;
    }
    if (!ok) {
      messenger.showSnackBar(
        const SnackBar(content: Text('No app on this phone can open a PDF.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Icon(
            Icons.picture_as_pdf_outlined,
            size: 56,
            color: theme.colorScheme.outline,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'This prescription is a PDF',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'OPTEX cannot display PDFs yet, so it will open in your browser. '
            'Your browser may keep a copy — close the tab when you are done.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: () => _open(context),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('Open in browser'),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Get a new link'),
          ),
          const SizedBox(height: AppSpacing.md),
          _ExpiryFooter(link: link),
        ],
      ),
    );
  }
}

class _Expired extends StatelessWidget {
  const _Expired({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => AppEmptyState(
    title: 'That link has expired',
    message:
        'Prescription links last a minute for your safety. '
        'Fetch a new one to keep reading.',
    icon: Icons.lock_clock_outlined,
    action: FilledButton.icon(
      onPressed: onRefresh,
      icon: const Icon(Icons.refresh_rounded),
      label: const Text('Get a new link'),
    ),
  );
}

class _ExpiryFooter extends StatelessWidget {
  const _ExpiryFooter({required this.link});

  final SignedDownload link;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            Icons.shield_outlined,
            size: 14,
            color: theme.colorScheme.outline,
          ),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              'Private link, valid for ${link.expiresIn} seconds. '
              'Nothing is saved to this phone.',
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
