import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/appointments_repository.dart';
import '../data/contact_profile_repository.dart';
import '../data/eye_records_repository.dart';
import '../data/prescriptions_repository.dart';
import '../data/scan_picker.dart';

/// The clinical slice's object graph.
///
/// Every repository hangs off `apiClientProvider` from core, so auth, refresh,
/// timeouts and error normalisation are inherited rather than reimplemented.
/// Kept in one file so a test can override the whole slice's I/O in a few
/// lines.

final Provider<PrescriptionsRepository> prescriptionsRepositoryProvider =
    Provider<PrescriptionsRepository>(
      (Ref ref) => PrescriptionsRepository(ref.watch(apiClientProvider)),
    );

final Provider<AppointmentsRepository> appointmentsRepositoryProvider =
    Provider<AppointmentsRepository>(
      (Ref ref) => AppointmentsRepository(ref.watch(apiClientProvider)),
    );

final Provider<EyeRecordsRepository> eyeRecordsRepositoryProvider =
    Provider<EyeRecordsRepository>(
      (Ref ref) => EyeRecordsRepository(ref.watch(apiClientProvider)),
    );

final Provider<ContactProfileRepository> contactProfileRepositoryProvider =
    Provider<ContactProfileRepository>(
      (Ref ref) => ContactProfileRepository(ref.watch(apiClientProvider)),
    );

/// The camera / gallery picker. A provider rather than a constructor call so a
/// widget test can swap in a fake without touching a platform channel.
final Provider<ScanPicker> scanPickerProvider = Provider<ScanPicker>(
  (Ref ref) => ScanPicker(),
);

/// The caller's profile, for pre-filling name and phone.
///
/// Cached for the session — it is read by both the booking wizard and the
/// intake form, and re-fetching it on every step would be pointless traffic.
final FutureProvider<ContactProfile> contactProfileProvider =
    FutureProvider<ContactProfile>(
      (Ref ref) => ref.watch(contactProfileRepositoryProvider).load(),
    );
