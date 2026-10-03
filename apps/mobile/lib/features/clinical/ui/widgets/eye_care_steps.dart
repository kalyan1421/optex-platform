import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../domain/clinical_json.dart' show parseDecimalCell, parseIntCell;
import '../../domain/eye_record.dart';
import '../../state/eye_care_providers.dart';
import 'clinical_chrome.dart';

/// Steps 1–3 of the intake form.
///
/// Each keeps its `TextEditingController`s locally but pushes every change up
/// to [IntakeController] immediately, so leaving a step never loses a
/// half-typed answer. The controllers are seeded from the draft in
/// `initState`, which is what makes stepping back and forth lossless.

// ─── Step 1: about you ───────────────────────────────────────────────────────

class AboutStep extends ConsumerStatefulWidget {
  const AboutStep({super.key, required this.state});

  final IntakeState state;

  @override
  ConsumerState<AboutStep> createState() => _AboutStepState();
}

class _AboutStepState extends ConsumerState<AboutStep> {
  late final TextEditingController _name;
  late final TextEditingController _age;
  late final TextEditingController _phone;
  late final TextEditingController _email;

  @override
  void initState() {
    super.initState();
    final EyeRecordDraft draft = widget.state.draft;
    _name = TextEditingController(text: draft.fullName);
    _age = TextEditingController(text: draft.age);
    _phone = TextEditingController(text: draft.phone);
    _email = TextEditingController(text: draft.email);

    // The profile pre-fill lands asynchronously and may arrive after this step
    // is already on screen, so mirror it into the text fields when it does —
    // but only into fields the customer has not touched.
    ref.listenManual<IntakeState>(intakeControllerProvider, (
      IntakeState? previous,
      IntakeState next,
    ) {
      if (!mounted) return;
      _adopt(_name, next.draft.fullName);
      _adopt(_phone, next.draft.phone);
      _adopt(_email, next.draft.email);
    });
  }

  void _adopt(TextEditingController controller, String value) {
    if (controller.text.isEmpty && value.isNotEmpty) controller.text = value;
  }

  @override
  void dispose() {
    _name.dispose();
    _age.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );
    final IntakeErrors errors = widget.state.errors;
    final EyeRecordDraft draft = widget.state.draft;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.next,
          onChanged: (String value) => controller.update(
            (EyeRecordDraft d) => d.copyWith(fullName: value),
          ),
          decoration: InputDecoration(
            labelText: 'Full name',
            helperText:
                'The person being tested — a parent may book for a child.',
            helperMaxLines: 2,
            errorText: errors['fullName'],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            SizedBox(
              width: 110,
              child: TextField(
                controller: _age,
                keyboardType: TextInputType.number,
                onChanged: (String value) => controller.update(
                  (EyeRecordDraft d) => d.copyWith(age: value),
                ),
                decoration: InputDecoration(
                  labelText: 'Age',
                  errorText: errors['age'],
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                onChanged: (String value) => controller.update(
                  (EyeRecordDraft d) => d.copyWith(phone: value),
                ),
                decoration: InputDecoration(
                  labelText: 'Phone',
                  hintText: '+254700123456',
                  errorText: errors['phone'],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          onChanged: (String value) =>
              controller.update((EyeRecordDraft d) => d.copyWith(email: value)),
          decoration: InputDecoration(
            labelText: 'Email (optional)',
            errorText: errors['email'],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          'Gender (optional)',
          style: Theme.of(context).textTheme.labelLarge
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: <Widget>[
            for (final String option in kGenderOptions)
              ChoiceChip(
                label: Text(option),
                selected: draft.gender == option,
                onSelected: (bool selected) => controller.update(
                  (EyeRecordDraft d) => selected
                      ? d.copyWith(gender: option)
                      : d.copyWith(clearGender: true),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

// ─── Step 2: eye health ──────────────────────────────────────────────────────

class HistoryStep extends ConsumerStatefulWidget {
  const HistoryStep({super.key, required this.state});

  final IntakeState state;

  @override
  ConsumerState<HistoryStep> createState() => _HistoryStepState();
}

class _HistoryStepState extends ConsumerState<HistoryStep> {
  late final TextEditingController _notes = TextEditingController(
    text: widget.state.draft.historyNotes,
  );

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );
    final EyeRecordDraft draft = widget.state.draft;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        Text(
          'Do any of these apply to you?',
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Tick everything that is true. It changes how we test you.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final String condition in kEyeConditions)
          CheckboxListTile(
            value: draft.conditions.contains(condition),
            onChanged: (bool? _) => controller.toggleCondition(condition),
            title: Text(condition),
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: EdgeInsets.zero,
            dense: true,
          ),
        if (widget.state.errors['conditions'] != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          InlineNotice(message: widget.state.errors['conditions']!),
        ],
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: _notes,
          maxLines: 5,
          maxLength: 2000,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (String value) => controller.update(
            (EyeRecordDraft d) => d.copyWith(historyNotes: value),
          ),
          decoration: InputDecoration(
            labelText: 'Anything else? (optional)',
            hintText: 'Past prescriptions, surgery, medication, headaches…',
            alignLabelWithHint: true,
            errorText: widget.state.errors['historyNotes'],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

// ─── Step 3: current lenses ──────────────────────────────────────────────────

class PrescriptionStep extends ConsumerStatefulWidget {
  const PrescriptionStep({super.key, required this.state});

  final IntakeState state;

  @override
  ConsumerState<PrescriptionStep> createState() => _PrescriptionStepState();
}

class _PrescriptionStepState extends ConsumerState<PrescriptionStep> {
  /// One controller per cell, keyed `<eye>.<column>`.
  late final Map<String, TextEditingController> _cells;

  /// Cells whose text is present but unreadable as a number. Tracked
  /// separately from the draft because an unparseable value has no home in a
  /// typed model — and silently dropping it would be worse than saying so.
  final Set<String> _unparseable = <String>{};

  static const List<String> _columns = <String>[
    'sphere',
    'cylinder',
    'axis',
    'add',
    'pd',
  ];

  @override
  void initState() {
    super.initState();
    final EyeRecordDraft draft = widget.state.draft;
    _cells = <String, TextEditingController>{
      for (final String eye in <String>['od', 'os'])
        for (final String column in _columns)
          '$eye.$column': TextEditingController(
            text: _initial(
              eye == 'od' ? draft.rightEye : draft.leftEye,
              column,
            ),
          ),
    };
  }

  static String _initial(EyeReading reading, String column) {
    final num? value = switch (column) {
      'sphere' => reading.sphere,
      'cylinder' => reading.cylinder,
      'axis' => reading.axis,
      'add' => reading.add,
      'pd' => reading.pd,
      _ => null,
    };
    if (value == null) return '';
    return value is int ? '$value' : value.toString();
  }

  @override
  void dispose() {
    for (final TextEditingController controller in _cells.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _emit(String eye) {
    final IntakeController controller = ref.read(
      intakeControllerProvider.notifier,
    );

    final Set<String> bad = <String>{};

    double? decimal(String column, {int decimals = 2}) {
      final String key = '$eye.$column';
      final ({bool ok, double? value}) parsed = parseDecimalCell(
        _cells[key]!.text,
        decimals: decimals,
      );
      if (!parsed.ok) bad.add(key);
      return parsed.value;
    }

    final String axisKey = '$eye.axis';
    final ({bool ok, int? value}) axis = parseIntCell(_cells[axisKey]!.text);
    if (!axis.ok) bad.add(axisKey);

    final EyeReading reading = EyeReading(
      sphere: decimal('sphere'),
      cylinder: decimal('cylinder'),
      axis: axis.value,
      add: decimal('add'),
      pd: decimal('pd', decimals: 1),
    );

    setState(() {
      _unparseable
        ..removeWhere((String key) => key.startsWith('$eye.'))
        ..addAll(bad);
    });

    controller.update(
      (EyeRecordDraft d) => eye == 'od'
          ? d.copyWith(rightEye: reading)
          : d.copyWith(leftEye: reading),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final IntakeErrors errors = widget.state.errors;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      children: <Widget>[
        const InlineNotice(
          tone: StatusTone.muted,
          icon: Icons.info_outline_rounded,
          message:
              'Copy these from your current glasses prescription. '
              'Leave anything blank if you are unsure — we will test it.',
        ),
        const SizedBox(height: AppSpacing.md),
        _EyeCard(
          title: 'Right eye (OD)',
          eye: 'od',
          cells: _cells,
          errors: errors,
          unparseable: _unparseable,
          onChanged: () => _emit('od'),
        ),
        const SizedBox(height: AppSpacing.md),
        _EyeCard(
          title: 'Left eye (OS)',
          eye: 'os',
          cells: _cells,
          errors: errors,
          unparseable: _unparseable,
          onChanged: () => _emit('os'),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          'SPH is the main strength, CYL and AXIS correct astigmatism, ADD is '
          'the reading boost on varifocals, and PD is the distance between '
          'your pupils in millimetres.',
          style: theme.textTheme.labelMedium?.copyWith(
            color: theme.colorScheme.outline,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

class _EyeCard extends StatelessWidget {
  const _EyeCard({
    required this.title,
    required this.eye,
    required this.cells,
    required this.errors,
    required this.unparseable,
    required this.onChanged,
  });

  final String title;
  final String eye;
  final Map<String, TextEditingController> cells;
  final IntakeErrors errors;
  final Set<String> unparseable;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return ClinicalCard(
      title: title,
      child: Column(
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(child: _field('sphere', 'SPH', '-1.25', signed: true)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _field('cylinder', 'CYL', '-0.50', signed: true)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(child: _field('axis', 'AXIS', '180', integer: true)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _field('add', 'ADD', '+2.00', signed: true)),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: _field('pd', 'PD', '31.5')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _field(
    String column,
    String label,
    String hint, {
    bool signed = false,
    bool integer = false,
  }) {
    final String key = '$eye.$column';
    return TextField(
      controller: cells[key],
      onChanged: (String _) => onChanged(),
      keyboardType: TextInputType.numberWithOptions(
        decimal: !integer,
        // Sphere, cylinder and add are routinely negative, and iOS gives no
        // minus key without this.
        signed: signed,
      ),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        isDense: true,
        errorText: unparseable.contains(key) ? 'Not a number' : errors[key],
        errorMaxLines: 2,
      ),
    );
  }
}
