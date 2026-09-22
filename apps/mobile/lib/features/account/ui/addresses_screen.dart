import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/async_views.dart';
import '../domain/address.dart';
import '../state/account_providers.dart';
import 'widgets/address_form_sheet.dart';

/// Saved delivery addresses: list, add, edit, delete, set default.
///
/// The one rule that shapes this screen is P0-6's: **deleting the default
/// address forces choosing a replacement.** An account with addresses but no
/// default leaves checkout with nothing to pre-fill, which is a bug the
/// customer cannot see until they are already trying to pay.
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Address>> addresses = ref.watch(addressesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Delivery addresses')),
      floatingActionButton: addresses.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => _add(context, ref, isFirst: addresses.value!.isEmpty),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add address'),
            )
          : null,
      body: addresses.when(
        loading: () => const AppLoading(label: 'Loading your addresses…'),
        error: (Object error, StackTrace _) => AppErrorView(
          error: error,
          onRetry: () => ref.read(addressesProvider.notifier).refresh(),
        ),
        data: (List<Address> items) {
          if (items.isEmpty) {
            return AppEmptyState(
              title: 'No saved addresses',
              message: 'Save one now and checkout will fill it in for you.',
              icon: Icons.location_off_outlined,
              action: FilledButton.icon(
                onPressed: () => _add(context, ref, isFirst: true),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add an address'),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(addressesProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.xxl + AppSpacing.xl,
              ),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
              itemBuilder: (BuildContext context, int index) => _AddressCard(
                address: items[index],
                others: items.where((Address a) => a.id != items[index].id).toList(),
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _add(BuildContext context, WidgetRef ref, {required bool isFirst}) async {
    final AddressInput? input =
        await showAddressFormSheet(context, forceDefault: isFirst);
    if (input == null || !context.mounted) return;

    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(addressesProvider.notifier).create(input);
      messenger.showSnackBar(const SnackBar(content: Text('Address saved')));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

class _AddressCard extends ConsumerStatefulWidget {
  const _AddressCard({required this.address, required this.others});

  final Address address;

  /// Every other saved address — the candidates for a replacement default.
  final List<Address> others;

  @override
  ConsumerState<_AddressCard> createState() => _AddressCardState();
}

class _AddressCardState extends ConsumerState<_AddressCard> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, String successMessage) async {
    if (_busy) return;
    setState(() => _busy = true);
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(successMessage)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit() async {
    final AddressInput? input =
        await showAddressFormSheet(context, existing: widget.address);
    if (input == null || !mounted) return;
    await _run(
      () => ref.read(addressesProvider.notifier).edit(widget.address.id, input),
      'Address updated',
    );
  }

  Future<void> _setDefault() => _run(
        () => ref.read(addressesProvider.notifier).setDefault(widget.address.id),
        'Default address updated',
      );

  Future<void> _delete() async {
    final Address address = widget.address;

    // The only case that needs no replacement is the last address standing:
    // there is nothing to promote, and refusing the delete would trap the
    // customer with an address they no longer want.
    if (!address.isDefault || widget.others.isEmpty) {
      final bool confirmed = await _confirmPlainDelete();
      if (!confirmed || !mounted) return;
      await _run(
        () => ref.read(addressesProvider.notifier).remove(address.id),
        'Address removed',
      );
      return;
    }

    final String? replacementId = await showDialog<String>(
      context: context,
      builder: (BuildContext ctx) => _ChooseReplacementDialog(
        candidates: widget.others,
      ),
    );
    if (replacementId == null || !mounted) return;

    await _run(
      () => ref
          .read(addressesProvider.notifier)
          .remove(address.id, replacementDefaultId: replacementId),
      'Address removed and default updated',
    );
  }

  Future<bool> _confirmPlainDelete() async {
    return await showDialog<bool>(
          context: context,
          builder: (BuildContext ctx) => AlertDialog(
            title: const Text('Remove this address?'),
            content: Text(
              '${widget.address.title}\n${widget.address.formatted}\n\n'
              'Orders already placed keep their own copy of the address.',
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Keep'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Remove'),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final Address address = widget.address;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    address.title,
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (address.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Default',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(address.name, style: theme.textTheme.bodyMedium),
            Text(
              address.formatted,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            Text(
              address.phone,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (_busy)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: LinearProgressIndicator(minHeight: 2),
              )
            else
              Wrap(
                spacing: AppSpacing.sm,
                children: <Widget>[
                  TextButton.icon(
                    onPressed: _edit,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Edit'),
                  ),
                  if (!address.isDefault)
                    TextButton.icon(
                      onPressed: _setDefault,
                      icon: const Icon(Icons.star_border_rounded, size: 18),
                      label: const Text('Set default'),
                    ),
                  TextButton.icon(
                    onPressed: _delete,
                    icon: const Icon(Icons.delete_outline_rounded, size: 18),
                    label: const Text('Remove'),
                    style: TextButton.styleFrom(
                      foregroundColor: theme.colorScheme.error,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

/// Forces a replacement default before the current one can be deleted.
///
/// There is no "delete anyway" escape: dismissing cancels the delete outright,
/// which is the point — the choice is *which* address becomes the default, not
/// *whether* to have one (P0-6).
class _ChooseReplacementDialog extends StatefulWidget {
  const _ChooseReplacementDialog({required this.candidates});

  final List<Address> candidates;

  @override
  State<_ChooseReplacementDialog> createState() => _ChooseReplacementDialogState();
}

class _ChooseReplacementDialogState extends State<_ChooseReplacementDialog> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return AlertDialog(
      title: const Text('Choose a new default'),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'This is your default delivery address. Pick which one takes '
              'over before removing it.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
            const SizedBox(height: AppSpacing.sm),
            Flexible(
              // Selection state lives on the RadioGroup ancestor; the tiles
              // carry only their value. `RadioListTile.groupValue`/`onChanged`
              // were deprecated after Flutter 3.32.
              child: RadioGroup<String>(
                groupValue: _selected,
                onChanged: (String? value) => setState(() => _selected = value),
                child: ListView(
                  shrinkWrap: true,
                  children: <Widget>[
                    for (final Address candidate in widget.candidates)
                      RadioListTile<String>(
                        value: candidate.id,
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          candidate.title,
                          style: theme.textTheme.bodyMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text(
                          candidate.formatted,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: theme.colorScheme.outline),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _selected == null
              ? null
              : () => Navigator.of(context).pop(_selected),
          child: const Text('Set and remove'),
        ),
      ],
    );
  }
}
