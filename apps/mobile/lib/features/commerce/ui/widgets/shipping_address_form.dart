import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/checkout_draft.dart';
import '../../state/checkout_providers.dart';

/// Where the order is going, and who is receiving it.
///
/// Field lengths mirror `ShippingAddressDto` so a mistake is caught here
/// rather than after a round trip — but the server validates regardless, and
/// its message wins if the two ever disagree.
///
/// The parent reads the result through a `GlobalKey<ShippingAddressFormState>`
/// and [ShippingAddressFormState.read], which validates first and returns null
/// if anything is wrong.
class ShippingAddressForm extends ConsumerStatefulWidget {
  const ShippingAddressForm({
    super.key,
    required this.delivery,
    this.enabled = true,
    this.initialName,
  });

  final DeliveryOption delivery;

  /// False once the order exists — the address is recorded on it server-side
  /// and cannot be changed without placing a different order.
  final bool enabled;

  /// The signed-in customer's name, used as a starting point.
  final String? initialName;

  @override
  ConsumerState<ShippingAddressForm> createState() =>
      ShippingAddressFormState();
}

class ShippingAddressFormState extends ConsumerState<ShippingAddressForm> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _address = TextEditingController();
  final TextEditingController _city = TextEditingController();
  final TextEditingController _county = TextEditingController();
  final TextEditingController _postal = TextEditingController();

  String? _selectedAddressId;
  PickupBranch? _branch;
  bool _prefilled = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialName != null) _name.text = widget.initialName!;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _city.dispose();
    _county.dispose();
    _postal.dispose();
    super.dispose();
  }

  /// The phone the customer typed, for prefilling the M-Pesa field. Empty
  /// until they have filled the form in.
  String get phone => _phone.text.trim();

  /// Validates and returns the payload, or null when something is missing.
  ///
  /// For pickup this is the branch's address under the customer's name — the
  /// same mapping the web checkout uses, so an order reads identically
  /// wherever it was placed.
  ShippingAddress? read() {
    if (!(_formKey.currentState?.validate() ?? false)) return null;

    if (widget.delivery == DeliveryOption.pickup) {
      final PickupBranch? branch = _branch;
      if (branch == null) return null;
      return branch.toShipping(
        name: _name.text.trim(),
        phone: _phone.text.trim(),
      );
    }

    return ShippingAddress(
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      address: _address.text.trim(),
      city: _city.text.trim(),
      county: _county.text.trim(),
      postal: _postal.text.trim().isEmpty ? null : _postal.text.trim(),
    );
  }

  /// True when pickup is selected but no branch has been chosen — the one
  /// failure [read] cannot express through the form validator.
  bool get isMissingBranch =>
      widget.delivery == DeliveryOption.pickup && _branch == null;

  void _applySaved(SavedAddress saved) {
    setState(() {
      _selectedAddressId = saved.id;
      _name.text = saved.shipping.name;
      _phone.text = saved.shipping.phone;
      _address.text = saved.shipping.address;
      _city.text = saved.shipping.city;
      _county.text = saved.shipping.county;
      _postal.text = saved.shipping.postal ?? '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final bool isPickup = widget.delivery == DeliveryOption.pickup;
    final AsyncValue<List<SavedAddress>> saved = ref.watch(
      savedAddressesProvider,
    );

    // One-shot prefill from the default saved address. Guarded so it cannot
    // overwrite something the customer has started typing.
    saved.whenData((List<SavedAddress> list) {
      if (_prefilled || list.isEmpty || _address.text.isNotEmpty) return;
      _prefilled = true;
      final SavedAddress preferred = list.firstWhere(
        (SavedAddress a) => a.isDefault,
        orElse: () => list.first,
      );
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _applySaved(preferred);
      });
    });

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (!isPickup)
            saved.maybeWhen(
              data: (List<SavedAddress> list) => list.isEmpty
                  ? const SizedBox.shrink()
                  : _SavedAddressPicker(
                      addresses: list,
                      selectedId: _selectedAddressId,
                      enabled: widget.enabled,
                      onSelected: _applySaved,
                    ),
              orElse: () => const SizedBox.shrink(),
            ),
          if (isPickup) ...<Widget>[
            _BranchPicker(
              selected: _branch,
              enabled: widget.enabled,
              onSelected: (PickupBranch branch) =>
                  setState(() => _branch = branch),
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          _Field(
            controller: _name,
            label: isPickup ? 'Who is collecting' : 'Full name',
            enabled: widget.enabled,
            textCapitalization: TextCapitalization.words,
            validator: (String? v) => _length(v, 2, 120, 'a name'),
          ),
          _Field(
            controller: _phone,
            label: 'Phone number',
            hint: '07XX XXX XXX',
            enabled: widget.enabled,
            keyboardType: TextInputType.phone,
            validator: (String? v) => _length(v, 7, 20, 'a phone number'),
          ),
          if (!isPickup) ...<Widget>[
            _Field(
              controller: _address,
              label: 'Street address',
              hint: 'Building, street, estate',
              enabled: widget.enabled,
              validator: (String? v) => _length(v, 3, 240, 'an address'),
            ),
            _Field(
              controller: _city,
              label: 'City or town',
              enabled: widget.enabled,
              textCapitalization: TextCapitalization.words,
              validator: (String? v) => _length(v, 2, 120, 'a city'),
            ),
            _Field(
              controller: _county,
              label: 'County',
              enabled: widget.enabled,
              textCapitalization: TextCapitalization.words,
              validator: (String? v) => _length(v, 2, 120, 'a county'),
            ),
            _Field(
              controller: _postal,
              label: 'Postal code (optional)',
              enabled: widget.enabled,
              keyboardType: TextInputType.number,
              validator: (String? v) => (v != null && v.trim().length > 20)
                  ? 'Postal code is too long.'
                  : null,
            ),
          ],
        ],
      ),
    );
  }

  static String? _length(String? value, int min, int max, String what) {
    final String text = (value ?? '').trim();
    if (text.length < min) return 'Please enter $what.';
    if (text.length > max) return 'That is too long — $max characters at most.';
    return null;
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.validator,
    this.hint,
    this.enabled = true,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? Function(String?) validator;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.md),
    child: TextFormField(
      controller: controller,
      enabled: enabled,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      validator: validator,
      decoration: InputDecoration(labelText: label, hintText: hint),
    ),
  );
}

class _SavedAddressPicker extends StatelessWidget {
  const _SavedAddressPicker({
    required this.addresses,
    required this.onSelected,
    required this.enabled,
    this.selectedId,
  });

  final List<SavedAddress> addresses;
  final ValueChanged<SavedAddress> onSelected;
  final bool enabled;
  final String? selectedId;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('Saved addresses', style: theme.textTheme.labelLarge),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: <Widget>[
              for (final SavedAddress address in addresses)
                ChoiceChip(
                  label: Text(address.title),
                  selected: address.id == selectedId,
                  onSelected: enabled ? (_) => onSelected(address) : null,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _BranchPicker extends ConsumerWidget {
  const _BranchPicker({
    required this.selected,
    required this.onSelected,
    required this.enabled,
  });

  final PickupBranch? selected;
  final ValueChanged<PickupBranch> onSelected;
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<PickupBranch>> branches = ref.watch(
      pickupBranchesProvider,
    );
    final ThemeData theme = Theme.of(context);

    return branches.when(
      loading: () => const LinearProgressIndicator(minHeight: 2),
      error: (Object error, StackTrace stack) => Row(
        children: <Widget>[
          Expanded(
            child: Text(
              "We couldn't load the branch list.",
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ),
          TextButton(
            onPressed: () => ref.invalidate(pickupBranchesProvider),
            child: const Text('Retry'),
          ),
        ],
      ),
      data: (List<PickupBranch> list) => DropdownButtonFormField<String>(
        initialValue: selected?.id,
        decoration: const InputDecoration(labelText: 'Collect from'),
        items: <DropdownMenuItem<String>>[
          for (final PickupBranch branch in list)
            DropdownMenuItem<String>(
              value: branch.id,
              child: Text(branch.name),
            ),
        ],
        onChanged: enabled
            ? (String? id) {
                if (id == null) return;
                onSelected(list.firstWhere((PickupBranch b) => b.id == id));
              }
            : null,
        validator: (String? id) =>
            id == null ? 'Choose a branch to collect from.' : null,
      ),
    );
  }
}
