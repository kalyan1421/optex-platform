import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../data/scan_picker.dart';
import '../domain/clinical_json.dart' show parseDecimalCell, parseIntCell;
import '../domain/prescription.dart';
import '../domain/scan_file.dart';
import '../state/prescriptions_providers.dart';
import 'widgets/clinical_chrome.dart';

/// Capture or choose a prescription, confirm it, then upload it.
///
/// The confirm step is not ceremony. A photograph of a prescription is useless
/// if it is blurred, cropped or upside down, and the customer is the only one
/// who can tell before it goes — the optician finds out days later, when the
/// order is already waiting on it. So the first frame is never uploaded
/// blindly: it is shown back, full size and zoomable, with Retake sitting
/// beside Send.
class PrescriptionUploadScreen extends ConsumerStatefulWidget {
  const PrescriptionUploadScreen({super.key});

  @override
  ConsumerState<PrescriptionUploadScreen> createState() =>
      _PrescriptionUploadScreenState();
}

class _PrescriptionUploadScreenState
    extends ConsumerState<PrescriptionUploadScreen> {
  @override
  void initState() {
    super.initState();
    // The controller outlives this screen (so an upload survives navigating
    // away), which means arriving here fresh must clear whatever the last
    // visit left behind.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(prescriptionUploadControllerProvider.notifier).reset();
      }
    });
  }

  void _close() {
    if (context.canPop()) {
      context.pop();
    } else {
      // Reached by deep link with nothing behind it. `go` rather than `pop`
      // so the back affordance always leads somewhere.
      context.go(Routes.prescriptions);
    }
  }

  @override
  Widget build(BuildContext context) {
    final PrescriptionUploadState state = ref.watch(
      prescriptionUploadControllerProvider,
    );

    return PopScope(
      // An upload in flight is not cancellable from here — it lives in the
      // controller and continues regardless — but leaving mid-upload looks
      // like cancelling, so confirm the intent rather than let it surprise.
      canPop: state.phase != UploadPhase.uploading,
      onPopInvokedWithResult: (bool didPop, Object? _) async {
        if (didPop) return;
        final bool leave = await _confirmLeave(context) ?? false;
        if (leave && context.mounted) _close();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Add a prescription'),
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: state.phase == UploadPhase.uploading
                ? () async {
                    final bool leave = await _confirmLeave(context) ?? false;
                    if (leave && context.mounted) _close();
                  }
                : _close,
          ),
        ),
        body: SafeArea(
          child: switch (state.phase) {
            UploadPhase.idle ||
            UploadPhase.picking => _SourceStep(state: state),
            UploadPhase.confirming ||
            UploadPhase.uploading => _ConfirmStep(state: state, onDone: _close),
            UploadPhase.done => _DoneStep(state: state, onClose: _close),
          },
        ),
      ),
    );
  }

  Future<bool?> _confirmLeave(BuildContext context) => showDialog<bool>(
    context: context,
    builder: (BuildContext context) => AlertDialog(
      title: const Text('Leave while uploading?'),
      content: const Text(
        'The upload will keep going in the background. You can check your '
        'prescriptions in a moment to see it arrive.',
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Stay'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Leave'),
        ),
      ],
    ),
  );
}

// ─── Step 1: where does the file come from ───────────────────────────────────

class _SourceStep extends ConsumerWidget {
  const _SourceStep({required this.state});

  final PrescriptionUploadState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final PrescriptionUploadController controller = ref.read(
      prescriptionUploadControllerProvider.notifier,
    );
    final bool busy = state.phase == UploadPhase.picking;

    // Camera is offered unless it is the thing that was refused. Gallery is
    // always offered — it is the fallback, and it stays on screen even after a
    // camera refusal precisely so the customer is never stuck.
    final bool cameraBlocked =
        state.block == PermissionBlock.camera ||
        state.block == PermissionBlock.both;
    final bool galleryBlocked =
        state.block == PermissionBlock.gallery ||
        state.block == PermissionBlock.both;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: <Widget>[
        Text(
          'Send us your prescription',
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Lay it flat in good light and fit the whole card in the frame. '
          'We will check it and add the measurements to your file.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        if (state.error != null) ...<Widget>[
          InlineNotice(
            message: state.error!,
            icon: Icons.error_outline_rounded,
            tone: StatusTone.warning,
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        if (state.block != PermissionBlock.none) ...<Widget>[
          _PermissionHelp(block: state.block),
          const SizedBox(height: AppSpacing.md),
        ],

        _SourceTile(
          icon: Icons.photo_camera_outlined,
          title: 'Take a photo',
          subtitle: cameraBlocked
              ? 'Camera access is off for OPTEX'
              : 'Use the camera now',
          enabled: !busy && !cameraBlocked,
          onTap: controller.pickFromCamera,
        ),
        const SizedBox(height: AppSpacing.sm),
        _SourceTile(
          icon: Icons.photo_library_outlined,
          title: 'Choose from photos',
          subtitle: galleryBlocked
              ? 'Photo access is off for OPTEX'
              : 'Pick a photo or scan you already have',
          enabled: !busy && !galleryBlocked,
          onTap: controller.pickFromGallery,
        ),

        if (busy) ...<Widget>[
          const SizedBox(height: AppSpacing.lg),
          const Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
        ],

        const SizedBox(height: AppSpacing.lg),
        const _PrivacyNote(),
      ],
    );
  }
}

/// The never-a-dead-end state.
///
/// Both sources refused is the only combination with genuinely no path
/// forward inside the app, so that is the case that gets the route out to
/// Settings. On iOS that is a real button. On Android there is no URL scheme
/// for the app's settings page and this slice cannot add the package that
/// would provide one, so the customer gets exact written directions instead —
/// worse, but honest, and still a way through.
class _PermissionHelp extends StatelessWidget {
  const _PermissionHelp({required this.block});

  final PermissionBlock block;

  String get _what => switch (block) {
    PermissionBlock.camera => 'the camera',
    PermissionBlock.gallery => 'your photos',
    PermissionBlock.both => 'the camera and your photos',
    PermissionBlock.none => '',
  };

  @override
  Widget build(BuildContext context) {
    final bool fatal = block == PermissionBlock.both;
    return InlineNotice(
      tone: fatal ? StatusTone.warning : StatusTone.muted,
      icon: Icons.lock_outline_rounded,
      message: fatal
          ? 'OPTEX cannot reach $_what, so there is no way to attach a file '
                'from here. Turn one of them on and come straight back.'
          : 'OPTEX cannot reach $_what. You can still use the other option '
                'below, or turn it on in Settings.',
      action: const _OpenSettingsButton(),
    );
  }
}

class _OpenSettingsButton extends StatefulWidget {
  const _OpenSettingsButton();

  @override
  State<_OpenSettingsButton> createState() => _OpenSettingsButtonState();
}

class _OpenSettingsButtonState extends State<_OpenSettingsButton> {
  /// Set when the settings page could not be opened, which is always the case
  /// on Android. Written directions replace the button rather than sitting
  /// underneath a button that does nothing.
  bool _showManualSteps = !Platform.isIOS;

  Future<void> _open() async {
    final bool ok = await openAppSettingsPage();
    if (!ok && mounted) setState(() => _showManualSteps = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_showManualSteps) {
      return Text(
        Platform.isAndroid
            ? 'Open Settings › Apps › OPTEX › Permissions, then allow Camera '
                  'or Photos.'
            : 'Open your phone Settings, find OPTEX, and allow Camera or Photos.',
        style: Theme.of(context).textTheme.labelMedium
            ?.copyWith(color: Theme.of(context).colorScheme.outline),
      );
    }
    return OutlinedButton.icon(
      onPressed: _open,
      icon: const Icon(Icons.settings_outlined, size: 18),
      label: const Text('Open settings'),
    );
  }
}

class _SourceTile extends StatelessWidget {
  const _SourceTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Card(
      child: ListTile(
        enabled: enabled,
        onTap: enabled ? onTap : null,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        leading: Icon(icon, size: 28, color: theme.colorScheme.primary),
        title: Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}

class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Icon(Icons.shield_outlined, size: 16, color: theme.colorScheme.outline),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            'Prescriptions are stored privately and only your optician can '
            'open them. Photos are shrunk before sending to save your data.',
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Step 2: look at it, then send it ────────────────────────────────────────

class _ConfirmStep extends ConsumerWidget {
  const _ConfirmStep({required this.state, required this.onDone});

  final PrescriptionUploadState state;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final PrescriptionUploadController controller = ref.read(
      prescriptionUploadControllerProvider.notifier,
    );
    final ScanFile? scan = state.scan;
    if (scan == null) return const SizedBox.shrink();

    final bool uploading = state.phase == UploadPhase.uploading;

    return Column(
      children: <Widget>[
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: <Widget>[
              Text(
                scan.fromCamera ? 'Can you read it?' : 'Is this the right one?',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Pinch to zoom in and check the numbers are sharp before you '
                'send it.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _ScanPreview(scan: scan),
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${scan.mime.extension.toUpperCase()} · ${scan.readableSize}',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (state.error != null) ...<Widget>[
                InlineNotice(
                  message: state.error!,
                  icon: Icons.error_outline_rounded,
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              _MeasurementsPanel(
                enabled: !uploading,
                value: state.measurements,
                onChanged: controller.setMeasurements,
              ),
            ],
          ),
        ),
        _ConfirmBar(
          state: state,
          onRetake: uploading ? null : controller.discard,
          // No navigation on success: the controller moves the phase to `done`
          // and this screen swaps to the confirmation. "It worked" should be
          // seen, not inferred from a screen vanishing.
          onSend: uploading ? null : () => unawaited(controller.upload()),
        ),
      ],
    );
  }
}

class _ScanPreview extends StatelessWidget {
  const _ScanPreview({required this.scan});

  final ScanFile scan;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        color: theme.colorScheme.surfaceContainerHighest,
        constraints: const BoxConstraints(maxHeight: 420),
        width: double.infinity,
        child: scan.mime.isImage
            ? InteractiveViewer(
                maxScale: 5,
                child: Image.file(scan.file, fit: BoxFit.contain),
              )
            : Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Icon(
                      Icons.picture_as_pdf_outlined,
                      size: 48,
                      color: theme.colorScheme.outline,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'PDF ready to send',
                      style: theme.textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

class _ConfirmBar extends StatelessWidget {
  const _ConfirmBar({required this.state, this.onRetake, this.onSend});

  final PrescriptionUploadState state;
  final VoidCallback? onRetake;
  final VoidCallback? onSend;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool uploading = state.phase == UploadPhase.uploading;
    final double? progress = state.progress;

    return Material(
      elevation: 8,
      color: theme.scaffoldBackgroundColor,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (uploading) ...<Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  // Null while the total is unknown, which renders the
                  // indeterminate bar instead of a stuck-at-zero one.
                  value: progress,
                  minHeight: 6,
                  backgroundColor: theme.dividerColor,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                progress == null
                    ? 'Sending…'
                    : 'Sending… ${(progress * 100).round()}%'
                          '  ·  ${_kb(state.sent)} of ${_kb(state.total)}',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onRetake,
                    icon: Icon(
                      state.scan?.fromCamera ?? false
                          ? Icons.replay_rounded
                          : Icons.photo_library_outlined,
                      size: 18,
                    ),
                    label: Text(
                      state.scan?.fromCamera ?? false
                          ? 'Retake'
                          : 'Choose another',
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: onSend,
                    icon: const Icon(Icons.send_rounded, size: 18),
                    label: Text(uploading ? 'Sending' : 'Send'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static String _kb(int bytes) => bytes < 1024
      ? '$bytes B'
      : bytes < 1024 * 1024
      ? '${(bytes / 1024).toStringAsFixed(0)} KB'
      : '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

// ─── Optional measurements ───────────────────────────────────────────────────

/// The optional SPH/CYL/AXIS/PD fields `UploadPrescriptionDto` accepts.
///
/// Collapsed by default. Most customers photograph the card and stop there,
/// which is a complete and valid upload — the optician transcribes it during
/// review. Putting seven numeric fields in front of everyone to serve the few
/// who want to type them would cost far more uploads than it gains.
class _MeasurementsPanel extends StatefulWidget {
  const _MeasurementsPanel({
    required this.enabled,
    required this.value,
    required this.onChanged,
  });

  final bool enabled;
  final PrescriptionMeasurements value;
  final ValueChanged<PrescriptionMeasurements> onChanged;

  @override
  State<_MeasurementsPanel> createState() => _MeasurementsPanelState();
}

class _MeasurementsPanelState extends State<_MeasurementsPanel> {
  final Map<String, TextEditingController> _fields =
      <String, TextEditingController>{
        for (final String key in <String>[
          'sphere_od',
          'sphere_os',
          'cyl_od',
          'cyl_os',
          'axis_od',
          'axis_os',
          'pd',
        ])
          key: TextEditingController(),
      };

  @override
  void dispose() {
    for (final TextEditingController controller in _fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _emit() {
    widget.onChanged(
      PrescriptionMeasurements(
        sphereOd: parseDecimalCell(_fields['sphere_od']!.text).value,
        sphereOs: parseDecimalCell(_fields['sphere_os']!.text).value,
        cylOd: parseDecimalCell(_fields['cyl_od']!.text).value,
        cylOs: parseDecimalCell(_fields['cyl_os']!.text).value,
        axisOd: parseIntCell(_fields['axis_od']!.text).value,
        axisOs: parseIntCell(_fields['axis_os']!.text).value,
        pd: parseDecimalCell(_fields['pd']!.text).value,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Card(
      child: ExpansionTile(
        shape: const Border(),
        collapsedShape: const Border(),
        tilePadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        childrenPadding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.md,
        ),
        title: Text(
          'Type the numbers too (optional)',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Text(
          'Speeds things up. Skip it and we will read them off the photo.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        children: <Widget>[
          _EyeRow(
            label: 'Right (OD)',
            enabled: widget.enabled,
            sphere: _fields['sphere_od']!,
            cylinder: _fields['cyl_od']!,
            axis: _fields['axis_od']!,
            onChanged: _emit,
          ),
          const SizedBox(height: AppSpacing.sm),
          _EyeRow(
            label: 'Left (OS)',
            enabled: widget.enabled,
            sphere: _fields['sphere_os']!,
            cylinder: _fields['cyl_os']!,
            axis: _fields['axis_os']!,
            onChanged: _emit,
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: 160,
            child: TextField(
              controller: _fields['pd'],
              enabled: widget.enabled,
              onChanged: (String _) => _emit(),
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'PD (mm)',
                hintText: '62',
                isDense: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EyeRow extends StatelessWidget {
  const _EyeRow({
    required this.label,
    required this.enabled,
    required this.sphere,
    required this.cylinder,
    required this.axis,
    required this.onChanged,
  });

  final String label;
  final bool enabled;
  final TextEditingController sphere;
  final TextEditingController cylinder;
  final TextEditingController axis;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: <Widget>[
            Expanded(child: _cell(sphere, 'SPH', '-1.25', decimal: true)),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: _cell(cylinder, 'CYL', '-0.50', decimal: true)),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: _cell(axis, 'AXIS', '180', decimal: false)),
          ],
        ),
      ],
    );
  }

  Widget _cell(
    TextEditingController controller,
    String label,
    String hint, {
    required bool decimal,
  }) => TextField(
    controller: controller,
    enabled: enabled,
    onChanged: (String _) => onChanged(),
    keyboardType: TextInputType.numberWithOptions(
      decimal: decimal,
      // Sphere and cylinder are routinely negative; a keypad without a
      // minus makes them untypeable on iOS.
      signed: decimal,
    ),
    decoration: InputDecoration(
      labelText: label,
      hintText: hint,
      isDense: true,
    ),
  );
}

// ─── Step 3: done ────────────────────────────────────────────────────────────

class _DoneStep extends ConsumerWidget {
  const _DoneStep({required this.state, required this.onClose});

  final PrescriptionUploadState state;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Icon(
            Icons.check_circle_outline_rounded,
            size: 64,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Prescription received',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'One of our opticians will check it and add the measurements to '
            'your file. You will see it marked reviewed when they have.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          FilledButton(
            onPressed: onClose,
            child: const Text('Back to my prescriptions'),
          ),
          const SizedBox(height: AppSpacing.sm),
          OutlinedButton.icon(
            onPressed: () =>
                ref.read(prescriptionUploadControllerProvider.notifier).reset(),
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Add another'),
          ),
        ],
      ),
    );
  }
}
