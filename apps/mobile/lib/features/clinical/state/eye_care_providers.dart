import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../domain/eye_record.dart';
import 'clinical_providers.dart';

/// The caller's submitted intake records, newest first.
final FutureProvider<List<EyeRecord>> eyeRecordsProvider =
    FutureProvider<List<EyeRecord>>(
      (Ref ref) => ref.watch(eyeRecordsRepositoryProvider).list(),
    );

/// The steps of the intake form.
///
/// Split this way because each step is a different *kind* of question, and
/// mixing them is what makes long clinical forms feel endless: who you are,
/// what your history is, what your current lenses say, and where you are
/// taking it. Each is short enough to finish in one sitting on a phone.
enum IntakeStep {
  about,
  history,
  prescription,
  review;

  String get title => switch (this) {
    IntakeStep.about => 'About you',
    IntakeStep.history => 'Eye health',
    IntakeStep.prescription => 'Your current lenses',
    IntakeStep.review => 'Check and send',
  };

  String get blurb => switch (this) {
    IntakeStep.about => 'So the optician knows who they are seeing.',
    IntakeStep.history => 'Anything that affects how we test you.',
    IntakeStep.prescription =>
      'Optional — leave blank and we will test you fresh.',
    IntakeStep.review => 'One last look before it reaches the clinic.',
  };
}

/// Validation failures, keyed by the field they belong to.
typedef IntakeErrors = Map<String, String>;

/// The intake form's state: the draft, where we are in it, and what is wrong.
class IntakeState {
  const IntakeState({
    this.step = IntakeStep.about,
    this.draft = const EyeRecordDraft(),
    this.errors = const <String, String>{},
    this.submitting = false,
    this.submitError,
    this.submitted,
  });

  final IntakeStep step;
  final EyeRecordDraft draft;
  final IntakeErrors errors;
  final bool submitting;
  final String? submitError;
  final EyeRecord? submitted;

  /// 0..1 for the progress bar. The review step counts as complete.
  double get progress => (step.index + 1) / IntakeStep.values.length;

  IntakeState copyWith({
    IntakeStep? step,
    EyeRecordDraft? draft,
    IntakeErrors? errors,
    bool? submitting,
    String? submitError,
    EyeRecord? submitted,
    bool clearSubmitError = false,
  }) => IntakeState(
    step: step ?? this.step,
    draft: draft ?? this.draft,
    errors: errors ?? this.errors,
    submitting: submitting ?? this.submitting,
    submitError: clearSubmitError ? null : (submitError ?? this.submitError),
    submitted: submitted ?? this.submitted,
  );
}

/// Drives the eye-care intake form.
///
/// Not auto-disposed, and that is the point: this is a long clinical form, and
/// a customer who backs out to check the spelling of a condition, or gets
/// pulled away by a phone call, must come back to what they typed. The draft
/// is cleared only by [reset], which runs after a successful submission or
/// when the customer explicitly starts over.
///
/// The draft lives in memory only. It does NOT survive the app being killed —
/// persisting a half-finished clinical form to disk is a data-protection
/// decision (DPA 2019) that belongs with the client, not with this slice.
class IntakeController extends Notifier<IntakeState> {
  @override
  IntakeState build() => const IntakeState();

  void reset() => state = const IntakeState();

  /// Seeds identity fields from the profile, once, into blank fields only.
  void prefill({String? name, String? phone, String? email}) {
    if (state.draft.prefilled) return;
    final EyeRecordDraft d = state.draft;
    state = state.copyWith(
      draft: d.copyWith(
        fullName: d.fullName.isEmpty ? (name ?? '') : d.fullName,
        phone: d.phone.isEmpty ? (phone ?? '') : d.phone,
        email: d.email.isEmpty ? (email ?? '') : d.email,
        prefilled: true,
      ),
    );
  }

  void update(EyeRecordDraft Function(EyeRecordDraft draft) mutate) => state =
      state.copyWith(draft: mutate(state.draft), clearSubmitError: true);

  /// Toggles a health-history option, honouring the exclusivity of
  /// "None of the above" exactly as the storefront does.
  void toggleCondition(String label) {
    final List<String> current = state.draft.conditions;
    final List<String> next;
    if (label == kNoConditions) {
      next = current.contains(kNoConditions)
          ? const <String>[]
          : const <String>[kNoConditions];
    } else if (current.contains(label)) {
      next = current.where((String c) => c != label).toList();
    } else {
      next = <String>[
        ...current.where((String c) => c != kNoConditions),
        label,
      ];
    }
    update((EyeRecordDraft d) => d.copyWith(conditions: next));
  }

  /// Validates the current step and moves on. Returns false when it did not.
  bool next() {
    final IntakeErrors found = validateStep(state.step, state.draft);
    if (found.isNotEmpty) {
      state = state.copyWith(errors: found);
      return false;
    }
    final int index = state.step.index;
    if (index >= IntakeStep.values.length - 1) return false;
    state = state.copyWith(
      step: IntakeStep.values[index + 1],
      errors: const <String, String>{},
    );
    return true;
  }

  /// Steps back. Returns false at the first step, so the caller pops the route.
  ///
  /// Never validates: a customer must always be able to go back, including out
  /// of a step they have half-filled.
  bool back() {
    final int index = state.step.index;
    if (index == 0) return false;
    state = state.copyWith(
      step: IntakeStep.values[index - 1],
      errors: const <String, String>{},
    );
    return true;
  }

  void goTo(IntakeStep step) =>
      state = state.copyWith(step: step, errors: const <String, String>{});

  /// Submits the record. Returns true on success.
  Future<bool> submit() async {
    if (state.submitting) return false;

    // Re-validate every step, not just the last one: a customer can jump back
    // from Review and edit, and the only thing standing between a bad value
    // and a 400 is this.
    final IntakeErrors found = <String, String>{
      for (final IntakeStep step in IntakeStep.values)
        ...validateStep(step, state.draft),
    };
    if (found.isNotEmpty) {
      final IntakeStep firstBad = IntakeStep.values.firstWhere(
        (IntakeStep step) => validateStep(step, state.draft).isNotEmpty,
        orElse: () => IntakeStep.about,
      );
      state = state.copyWith(errors: found, step: firstBad);
      return false;
    }

    state = state.copyWith(submitting: true, clearSubmitError: true);
    try {
      final EyeRecord created = await ref
          .read(eyeRecordsRepositoryProvider)
          .create(state.draft);
      state = state.copyWith(submitting: false, submitted: created);
      ref.invalidate(eyeRecordsProvider);
      return true;
    } on ApiException catch (e) {
      state = state.copyWith(submitting: false, submitError: e.message);
      return false;
    }
  }
}

final NotifierProvider<IntakeController, IntakeState> intakeControllerProvider =
    NotifierProvider<IntakeController, IntakeState>(IntakeController.new);

// ─── Validation ──────────────────────────────────────────────────────────────

/// Phone shape from `CreateEyeRecordDto` — a leading `+` or digit, then 6–19
/// more digits, spaces or hyphens. Copied rather than loosened: anything this
/// accepts, the API accepts.
final RegExp _phonePattern = RegExp(r'^[+\d][\d\s-]{6,19}$');

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Validates one step of the draft against the DTO's own constraints.
///
/// Every bound here comes from `create-eye-record.dto.ts`, which in turn
/// mirrors the CHECK constraints and column precision in `0037_eye_records.sql`
/// — `numeric(4,2)` cannot hold a value outside ±99.99, and axis is checked
/// between 0 and 180 in the table itself. Catching them here turns a 400 into
/// an inline message next to the offending box.
IntakeErrors validateStep(IntakeStep step, EyeRecordDraft draft) {
  final IntakeErrors errors = <String, String>{};

  switch (step) {
    case IntakeStep.about:
      final String name = draft.fullName.trim();
      if (name.isEmpty) {
        errors['fullName'] = 'Please tell us your name.';
      } else if (name.length > 200) {
        errors['fullName'] = 'That name is too long.';
      }

      final String phone = draft.phone.trim();
      if (phone.isEmpty) {
        errors['phone'] = 'We need a phone number to confirm by SMS.';
      } else if (!_phonePattern.hasMatch(phone)) {
        errors['phone'] = 'Enter a valid phone number, e.g. +254700123456.';
      }

      final String email = draft.email.trim();
      if (email.isNotEmpty && !_emailPattern.hasMatch(email)) {
        errors['email'] = 'Enter a valid email address.';
      }

      final String age = draft.age.trim();
      if (age.isNotEmpty) {
        final int? parsed = int.tryParse(age);
        if (parsed == null || parsed < 0 || parsed > 120) {
          errors['age'] = 'Enter an age between 0 and 120.';
        }
      }

    case IntakeStep.history:
      if (draft.conditions.length > 30) {
        errors['conditions'] = 'That is more options than we can record.';
      }
      if (draft.historyNotes.trim().length > 2000) {
        errors['historyNotes'] = 'Please keep this under 2000 characters.';
      }

    case IntakeStep.prescription:
      errors.addAll(_validateEye('od', draft.rightEye));
      errors.addAll(_validateEye('os', draft.leftEye));

    case IntakeStep.review:
      break;
  }

  return errors;
}

IntakeErrors _validateEye(String eye, EyeReading reading) {
  final IntakeErrors errors = <String, String>{};

  void checkDecimal(
    String field,
    double? value, {
    double min = -99.99,
    double max = 99.99,
  }) {
    if (value == null) return;
    if (value < min || value > max) {
      errors['$eye.$field'] = 'Must be between $min and $max.';
    }
  }

  checkDecimal('sphere', reading.sphere);
  checkDecimal('cylinder', reading.cylinder);
  checkDecimal('add', reading.add);
  checkDecimal('pd', reading.pd, min: 0, max: 999.9);

  final int? axis = reading.axis;
  if (axis != null && (axis < 0 || axis > 180)) {
    errors['$eye.axis'] = 'Axis runs from 0 to 180.';
  }

  return errors;
}
