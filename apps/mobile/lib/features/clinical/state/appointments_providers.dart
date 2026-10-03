import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../domain/appointment.dart';
import '../domain/clinic_branch.dart';
import '../domain/nairobi_time.dart';
import 'clinical_providers.dart';

/// The caller's bookings, soonest first (the API's own ordering).
final FutureProvider<List<Appointment>> appointmentsProvider =
    FutureProvider<List<Appointment>>(
      (Ref ref) => ref.watch(appointmentsRepositoryProvider).list(),
    );

/// Active branches for the wizard's first step.
final FutureProvider<List<ClinicBranch>> clinicBranchesProvider =
    FutureProvider<List<ClinicBranch>>(
      (Ref ref) => ref.watch(appointmentsRepositoryProvider).branches(),
    );

/// Identifies one branch-and-date availability query.
///
/// A record rather than two positional args because it is the family key, and
/// `(branchId: …, date: …)` at every call site is far harder to transpose than
/// two bare strings.
typedef SlotQuery = ({String branchId, String date});

/// Free slots for a branch on a date.
///
/// Auto-disposed: availability is perishable, and a cached answer from ten
/// minutes ago is exactly the thing that lets a customer pick a slot somebody
/// else already took. Scrolling back to a date re-asks the server.
final slotsProvider = FutureProvider.autoDispose
    .family<SlotAvailability, SlotQuery>(
      (Ref ref, SlotQuery query) => ref
          .watch(appointmentsRepositoryProvider)
          .slots(branchId: query.branchId, date: query.date),
    );

/// The steps of the booking wizard, in order. Mirrors the storefront's flow
/// (branch → what → when → confirm), split one step finer because a phone
/// cannot show a date strip and a slot grid comfortably at once.
enum BookingStep {
  branch,
  service,
  date,
  slot,
  confirm;

  String get title => switch (this) {
    BookingStep.branch => 'Choose a branch',
    BookingStep.service => 'What do you need?',
    BookingStep.date => 'Pick a day',
    BookingStep.slot => 'Pick a time',
    BookingStep.confirm => 'Confirm your visit',
  };
}

/// What the wizard has gathered so far.
class BookingDraft {
  const BookingDraft({
    this.step = BookingStep.branch,
    this.branch,
    this.type = AppointmentType.eyeTest,
    this.date,
    this.time,
    this.notes = '',
    this.contactName = '',
    this.contactPhone = '',
    this.submitting = false,
    this.error,
    this.booked,
    this.prefilled = false,
  });

  final BookingStep step;
  final ClinicBranch? branch;
  final AppointmentType type;

  /// Nairobi calendar date, `YYYY-MM-DD`.
  final String? date;

  /// Slot key, `HH:MM`.
  final String? time;

  final String notes;
  final String contactName;
  final String contactPhone;
  final bool submitting;
  final String? error;
  final Appointment? booked;
  final bool prefilled;

  bool get canAdvance => switch (step) {
    BookingStep.branch => branch != null,
    BookingStep.service => true,
    BookingStep.date => date != null,
    BookingStep.slot => time != null,
    BookingStep.confirm => !submitting,
  };

  /// The instant this draft would book, for display on the confirm step.
  DateTime? get instant =>
      (date != null && time != null) ? instantOf(date!, time!) : null;

  BookingDraft copyWith({
    BookingStep? step,
    ClinicBranch? branch,
    AppointmentType? type,
    String? date,
    String? time,
    String? notes,
    String? contactName,
    String? contactPhone,
    bool? submitting,
    String? error,
    Appointment? booked,
    bool? prefilled,
    bool clearTime = false,
    bool clearError = false,
  }) => BookingDraft(
    step: step ?? this.step,
    branch: branch ?? this.branch,
    type: type ?? this.type,
    date: date ?? this.date,
    time: clearTime ? null : (time ?? this.time),
    notes: notes ?? this.notes,
    contactName: contactName ?? this.contactName,
    contactPhone: contactPhone ?? this.contactPhone,
    submitting: submitting ?? this.submitting,
    error: clearError ? null : (error ?? this.error),
    booked: booked ?? this.booked,
    prefilled: prefilled ?? this.prefilled,
  );
}

/// Drives the booking wizard.
///
/// Held above the widget tree so backing out of a step — or being bounced to
/// the login screen partway through — does not lose the customer's choices.
class BookingController extends Notifier<BookingDraft> {
  @override
  BookingDraft build() => const BookingDraft();

  void reset() => state = const BookingDraft();

  /// Seeds contact details from the profile, once, and only into blank fields
  /// so a late response cannot overwrite what is being typed.
  void prefill({String? name, String? phone}) {
    if (state.prefilled) return;
    state = state.copyWith(
      contactName: state.contactName.isEmpty ? (name ?? '') : state.contactName,
      contactPhone: state.contactPhone.isEmpty
          ? (phone ?? '')
          : state.contactPhone,
      prefilled: true,
    );
  }

  /// Selecting never advances the step.
  ///
  /// The wizard has a Continue button at the bottom of every step, and having
  /// a tap *also* jump forward means the customer cannot look at what they
  /// picked before committing to it — and makes that button dead weight on the
  /// steps that auto-advanced. One way forward, always the same one.
  void selectBranch(ClinicBranch branch) {
    // Changing branch invalidates the chosen time: the slot grid is per branch,
    // and carrying `09:30` across to a branch that opens at 10:00 would send a
    // time the API will reject.
    final bool changed = state.branch?.id != branch.id;
    state = state.copyWith(
      branch: branch,
      clearTime: changed,
      clearError: true,
    );
  }

  void selectType(AppointmentType type) =>
      state = state.copyWith(type: type, clearError: true);

  void selectDate(String date) {
    final bool changed = state.date != date;
    state = state.copyWith(date: date, clearTime: changed, clearError: true);
  }

  void selectTime(String time) =>
      state = state.copyWith(time: time, clearError: true);

  void setNotes(String value) => state = state.copyWith(notes: value);
  void setContactName(String value) =>
      state = state.copyWith(contactName: value);
  void setContactPhone(String value) =>
      state = state.copyWith(contactPhone: value);

  void goTo(BookingStep step) =>
      state = state.copyWith(step: step, clearError: true);

  void next() {
    if (!state.canAdvance) return;
    final int index = state.step.index;
    if (index >= BookingStep.values.length - 1) return;
    state = state.copyWith(
      step: BookingStep.values[index + 1],
      clearError: true,
    );
  }

  /// Steps back. Returns false at the first step so the caller can pop the
  /// route instead of trapping the customer inside the wizard.
  bool back() {
    final int index = state.step.index;
    if (index == 0) return false;
    state = state.copyWith(
      step: BookingStep.values[index - 1],
      clearError: true,
    );
    return true;
  }

  /// Books the visit.
  ///
  /// Re-checks availability immediately before posting. The slot list the
  /// customer chose from may be minutes old, and migration 0018's capacity
  /// trigger will reject an over-subscribed slot server-side anyway — but a
  /// 409 landing on the confirm screen is a much worse experience than being
  /// walked back to a refreshed grid with the taken time already gone. The
  /// re-check narrows the race; it does not pretend to close it, which is why
  /// the 409 path below is handled just as carefully.
  Future<bool> submit() async {
    final ClinicBranch? branch = state.branch;
    final String? date = state.date;
    final String? time = state.time;
    if (branch == null || date == null || time == null || state.submitting) {
      return false;
    }

    state = state.copyWith(submitting: true, clearError: true);
    final repo = ref.read(appointmentsRepositoryProvider);

    try {
      final SlotAvailability fresh = await repo.slots(
        branchId: branch.id,
        date: date,
      );
      if (!fresh.slots.contains(time)) {
        state = state.copyWith(
          submitting: false,
          step: BookingStep.slot,
          clearTime: true,
          error:
              'That time was taken while you were booking. '
              'Here are the times still free.',
        );
        _refreshSlots(branch.id, date);
        return false;
      }

      final Appointment created = await repo.create(
        branchId: branch.id,
        date: date,
        time: time,
        type: state.type,
        notes: _composeNotes(),
      );

      state = state.copyWith(submitting: false, booked: created);
      ref.invalidate(appointmentsProvider);
      _refreshSlots(branch.id, date);
      return true;
    } on ApiException catch (e) {
      // 409 is the capacity trigger firing on a genuinely concurrent booking —
      // the case the re-check above cannot reach. Send them back to the grid
      // rather than leaving a dead Confirm button.
      final bool slotGone = e.statusCode == 409;
      state = state.copyWith(
        submitting: false,
        step: slotGone ? BookingStep.slot : state.step,
        clearTime: slotGone,
        error: e.message,
      );
      if (slotGone) _refreshSlots(branch.id, date);
      return false;
    }
  }

  void _refreshSlots(String branchId, String date) =>
      ref.invalidate(slotsProvider((branchId: branchId, date: date)));

  /// Mirrors the storefront's note format so branch staff reading the booking
  /// see the same `Contact: Name (phone)` prefix from either client.
  String? _composeNotes() {
    final String name = state.contactName.trim();
    final String phone = state.contactPhone.trim();
    final String body = state.notes.trim();
    final List<String> parts = <String>[
      if (name.isNotEmpty || phone.isNotEmpty)
        'Contact: ${name.isEmpty ? '—' : name}${phone.isEmpty ? '' : ' ($phone)'}',
      if (body.isNotEmpty) body,
    ];
    if (parts.isEmpty) return null;
    // `notes` is capped at 1000 characters by CreateAppointmentDto.
    final String joined = parts.join(' | ');
    return joined.length <= 1000 ? joined : joined.substring(0, 1000);
  }
}

final NotifierProvider<BookingController, BookingDraft>
bookingControllerProvider = NotifierProvider<BookingController, BookingDraft>(
  BookingController.new,
);

/// Cancel / reschedule, kept apart from the wizard because they act on an
/// existing booking and are reachable from the list without entering it.
class AppointmentActionsController extends Notifier<bool> {
  /// The state is simply "is an action in flight", which is all the list needs
  /// to disable its buttons.
  @override
  bool build() => false;

  /// Cancels a booking. Returns null on success, or a customer-safe message.
  Future<String?> cancel(String id) async {
    if (state) return null;
    state = true;
    try {
      await ref.read(appointmentsRepositoryProvider).cancel(id);
      ref.invalidate(appointmentsProvider);
      return null;
    } on ApiException catch (e) {
      return e.message;
    } finally {
      state = false;
    }
  }

  /// Moves a booking. Re-checks the target slot first, for the same reason
  /// [BookingController.submit] does.
  Future<String?> reschedule({
    required Appointment appointment,
    required String date,
    required String time,
  }) async {
    if (state) return null;
    state = true;
    final repo = ref.read(appointmentsRepositoryProvider);
    try {
      final SlotAvailability fresh = await repo.slots(
        branchId: appointment.branchId,
        date: date,
      );
      if (!fresh.slots.contains(time)) {
        ref.invalidate(
          slotsProvider((branchId: appointment.branchId, date: date)),
        );
        return 'That time has just been taken. Please choose another.';
      }
      await repo.reschedule(id: appointment.id, date: date, time: time);
      ref.invalidate(appointmentsProvider);
      ref.invalidate(
        slotsProvider((branchId: appointment.branchId, date: date)),
      );
      return null;
    } on ApiException catch (e) {
      return e.message;
    } finally {
      state = false;
    }
  }
}

final NotifierProvider<AppointmentActionsController, bool>
appointmentActionsProvider =
    NotifierProvider<AppointmentActionsController, bool>(
      AppointmentActionsController.new,
    );
