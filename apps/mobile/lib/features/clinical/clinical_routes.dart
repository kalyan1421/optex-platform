import 'package:go_router/go_router.dart';

import '../../core/router/routes.dart';
import 'ui/appointment_booking_screen.dart';
import 'ui/appointments_screen.dart';
import 'ui/eye_care_screen.dart';
import 'ui/prescription_upload_screen.dart';
import 'ui/prescriptions_screen.dart';

/// Routes contributed by the clinical slice.
///
/// Merged into the app router by `lib/core/router/feature_routes.dart`.
///
/// Every path comes from [Routes]; none is spelled out here. The two
/// sub-screens (`/prescriptions/upload`, `/appointments/book`) are declared as
/// top-level routes with their full paths rather than as go_router children,
/// because a child needs a *relative* path segment — which would mean writing
/// `'upload'` as a literal, exactly what the build contract forbids. The cost
/// is that a deep link straight to one of them arrives with an empty back
/// stack; both screens handle that by checking `context.canPop()` and falling
/// back to `context.go()` on their parent list, so the close button always
/// leads somewhere sensible.
///
/// All five are inside `_protectedPrefixes` in `app_router.dart`
/// (`/prescriptions`, `/appointments`) or reachable only when signed in —
/// except `/eye-care`, which is NOT in that list. That is worth flagging:
/// `POST /eye-records` and `GET /eye-records` both require a JWT, so an
/// anonymous visitor can open the intake form, fill in four steps and only
/// then hit a 401. See the note in the slice's report.
List<RouteBase> clinicalRoutes() => <RouteBase>[
  GoRoute(
    path: Routes.prescriptions,
    builder: (_, _) => const PrescriptionsScreen(),
  ),
  GoRoute(
    path: Routes.prescriptionUpload,
    builder: (_, _) => const PrescriptionUploadScreen(),
  ),
  GoRoute(
    path: Routes.appointments,
    builder: (_, _) => const AppointmentsScreen(),
  ),
  GoRoute(
    path: Routes.appointmentBooking,
    builder: (_, _) => const AppointmentBookingScreen(),
  ),
  GoRoute(path: Routes.eyeCare, builder: (_, _) => const EyeCareScreen()),
];
