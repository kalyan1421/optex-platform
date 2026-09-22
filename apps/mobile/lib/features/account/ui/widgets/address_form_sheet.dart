import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/address.dart';
import 'kenya_counties.dart';
import 'validators.dart';

/// Add / edit form for a saved address, presented as a modal sheet.
///
/// A sheet rather than a route: `Routes` has no constant for an address form
/// and inventing a path literal would break the single-source-of-truth rule
/// that keeps deep links honest. Returns the [AddressInput] to save, or null
/// if dismissed — the caller owns the API call so this widget stays free of
/// provider and error-handling concerns.
Future<AddressInput?> showAddressFormSheet(
  BuildContext context, {
  Address? existing,
  bool forceDefault = false,
}) {
  return showModalBottomSheet<AddressInput>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (BuildContext ctx) =>
        _AddressFormSheet(existing: existing, forceDefault: forceDefault),
  );
}

class _AddressFormSheet extends StatefulWidget {
  const _AddressFormSheet({this.existing, this.forceDefault = false});

  final Address? existing;

  /// True when this is the customer's first address: it will be the default
  /// whatever the switch says, so the switch is locked on rather than offering
  /// a choice that the server would overrule anyway.
  final bool forceDefault;

  @override
  State<_AddressFormSheet> createState() => _AddressFormSheetState();
}

class _AddressFormSheetState extends State<_AddressFormSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  late final TextEditingController _label = TextEditingController(
    text: widget.existing?.label ?? '',
  );
  late final TextEditingController _name = TextEditingController(
    text: widget.existing?.name ?? '',
  );
  late final TextEditingController _phone = TextEditingController(
    text: widget.existing?.phone ?? '',
  );
  late final TextEditingController _address = TextEditingController(
    text: widget.existing?.address ?? '',
  );
  late final TextEditingController _city = TextEditingController(
    text: widget.existing?.city ?? '',
  );
  late final TextEditingController _postal = TextEditingController(
    text: widget.existing?.postal ?? '',
  );

  late String? _county = _initialCounty;
  late bool _isDefault =
      widget.forceDefault || (widget.existing?.isDefault ?? false);

  /// A county saved before this list existed (or typed on the web) may not be
  /// in it. Leaving the picker unset is better than silently rewriting the
  /// customer's address to the first entry.
  String? get _initialCounty {
    final String? saved = widget.existing?.county;
    if (saved == null || saved.isEmpty) return null;
    return kenyaCounties.contains(saved) ? saved : null;
  }

  @override
  void dispose() {
    _label.dispose();
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _city.dispose();
    _postal.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(
      AddressInput(
        label: _label.text,
        name: _name.text,
        phone: _phone.text,
        address: _address.text,
        city: _city.text,
        county: _county ?? '',
        postal: _postal.text,
        isDefault: _isDefault,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final bool editing = widget.existing != null;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.92,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (BuildContext ctx, ScrollController controller) {
          return Column(
            children: <Widget>[
              const SizedBox(height: AppSpacing.sm),
              Container(
                height: 4,
                width: 40,
                decoration: BoxDecoration(
                  color: theme.colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.sm,
                  0,
                ),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        editing ? 'Edit address' : 'Add an address',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                      tooltip: 'Cancel',
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Form(
                  key: _formKey,
                  child: ListView(
                    controller: controller,
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.lg,
                    ),
                    children: <Widget>[
                      TextFormField(
                        controller: _label,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Label (optional)',
                          hintText: 'Home, Office…',
                          prefixIcon: Icon(Icons.label_outline_rounded),
                        ),
                        validator: (String? v) =>
                            Validators.optionalMaxLength(v, 'Label', 60),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Recipient name',
                          prefixIcon: Icon(Icons.person_outline_rounded),
                        ),
                        validator: Validators.required(
                          'a recipient name',
                          max: 120,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Contact phone',
                          hintText: '+254712345678',
                          prefixIcon: Icon(Icons.phone_outlined),
                        ),
                        validator: Validators.addressPhone,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _address,
                        textCapitalization: TextCapitalization.sentences,
                        textInputAction: TextInputAction.next,
                        maxLines: 2,
                        minLines: 1,
                        decoration: const InputDecoration(
                          labelText: 'Street, building, estate',
                          hintText: 'Moi Avenue, Bruce House, 4th Floor',
                          prefixIcon: Icon(Icons.home_outlined),
                        ),
                        validator: Validators.required(
                          'a street address',
                          min: 3,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _city,
                        textCapitalization: TextCapitalization.words,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'City / town',
                          prefixIcon: Icon(Icons.location_city_outlined),
                        ),
                        validator: Validators.required(
                          'a city or town',
                          max: 120,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      DropdownButtonFormField<String>(
                        initialValue: _county,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'County',
                          prefixIcon: Icon(Icons.map_outlined),
                        ),
                        items: <DropdownMenuItem<String>>[
                          for (final String county in kenyaCounties)
                            DropdownMenuItem<String>(
                              value: county,
                              child: Text(
                                county,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (String? value) =>
                            setState(() => _county = value),
                        validator: (String? value) =>
                            (value == null || value.isEmpty)
                            ? 'Choose a county'
                            : null,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        controller: _postal,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        decoration: const InputDecoration(
                          labelText: 'Postal code (optional)',
                          hintText: '00100',
                          prefixIcon: Icon(Icons.markunread_mailbox_outlined),
                        ),
                        validator: (String? v) =>
                            Validators.optionalMaxLength(v, 'Postal code', 20),
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SwitchListTile.adaptive(
                        value: _isDefault,
                        onChanged: widget.forceDefault
                            ? null
                            : (bool value) =>
                                  setState(() => _isDefault = value),
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Use as my default address'),
                        subtitle: Text(
                          widget.forceDefault
                              ? 'Your first address is always the default.'
                              : 'Pre-filled at checkout.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.outline,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      FilledButton(
                        onPressed: _submit,
                        child: Text(editing ? 'Save changes' : 'Save address'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
