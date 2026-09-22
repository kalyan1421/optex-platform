import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/nairobi_time.dart';
import '../domain/prescription.dart';
import '../state/prescriptions_providers.dart';
import 'prescription_viewer.dart';
import 'widgets/clinical_chrome.dart';
import 'widgets/measurement_table.dart';

/// The customer's prescription library.
///
/// This screen — and the upload flow behind it — is the first user interface
/// the prescriptions API has ever had. The endpoints, the private bucket, the
/// signed-URL downloads and the pending→processed review queue have all been
/// live and e2e-tested for months with no way for a customer to reach them.
class PrescriptionsScreen extends ConsumerWidget {
  const PrescriptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Prescription>> async = ref.watch(
      prescriptionsProvider,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('My prescriptions')),
      floatingActionButton: async.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => context.push(Routes.prescriptionUpload),
              icon: const Icon(Icons.add_a_photo_outlined),
              label: const Text('Add'),
            )
          : null,
      body: async.when(
        loading: () => const AppLoading(label: 'Loading your prescriptions'),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.invalidate(prescriptionsProvider),
        ),
        data: (List<Prescription> items) => RefreshIndicator(
          onRefresh: () async => ref.refresh(prescriptionsProvider.future),
          child: items.isEmpty
              ? _Empty(onUpload: () => context.push(Routes.prescriptionUpload))
              : _List(items: items),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.onUpload});

  final VoidCallback onUpload;

  @override
  Widget build(BuildContext context) {
    // Inside a scroll view so pull-to-refresh still works on an empty list —
    // otherwise the one gesture a stuck customer will try does nothing.
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
      children: <Widget>[
        AppEmptyState(
          title: 'No prescriptions yet',
          message:
              'Photograph the prescription your optician gave you and we '
              'will keep it on file — ready whenever you order lenses.',
          icon: Icons.description_outlined,
          action: FilledButton.icon(
            onPressed: onUpload,
            icon: const Icon(Icons.add_a_photo_outlined),
            label: const Text('Add a prescription'),
          ),
        ),
      ],
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.items});

  final List<Prescription> items;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        // Clears the FAB, so the last card is never half-hidden behind it.
        AppSpacing.xxl + AppSpacing.lg,
      ),
      itemCount: items.length,
      separatorBuilder: (BuildContext _, int _) =>
          const SizedBox(height: AppSpacing.md),
      itemBuilder: (BuildContext context, int index) =>
          _PrescriptionCard(prescription: items[index]),
    );
  }
}

class _PrescriptionCard extends StatelessWidget {
  const _PrescriptionCard({required this.prescription});

  final Prescription prescription;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool processed = prescription.status == PrescriptionStatus.processed;

    return ClinicalCard(
      title: 'Uploaded ${formatShortDate(prescription.createdAt)}',
      trailing: StatusPill(
        label: prescription.status.label,
        tone: processed ? StatusTone.positive : StatusTone.progress,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            processed
                ? 'An optician has read this and entered the measurements.'
                : 'With our opticians. We will add the measurements once it '
                      'has been checked.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
          if (prescription.hasMeasurements) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            MeasurementTable(
              columns: const <String>['SPH', 'CYL', 'AXIS'],
              rightEye: <String>[
                formatSigned(prescription.sphereOd),
                formatSigned(prescription.cylOd),
                formatPlain(prescription.axisOd),
              ],
              leftEye: <String>[
                formatSigned(prescription.sphereOs),
                formatSigned(prescription.cylOs),
                formatPlain(prescription.axisOs),
              ],
            ),
            if (prescription.pd != null) ...<Widget>[
              const SizedBox(height: AppSpacing.xs),
              Text(
                'PD ${formatPlain(prescription.pd, decimals: 1)} mm',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),
            ],
          ],
          const SizedBox(height: AppSpacing.md),
          Row(
            children: <Widget>[
              if (prescription.hasFile)
                OutlinedButton.icon(
                  onPressed: () =>
                      openPrescriptionViewer(context, prescription),
                  icon: Icon(
                    prescription.isPdf
                        ? Icons.picture_as_pdf_outlined
                        : Icons.image_outlined,
                    size: 18,
                  ),
                  label: const Text('View file'),
                )
              else
                Expanded(
                  child: Text(
                    'No file stored with this record.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
