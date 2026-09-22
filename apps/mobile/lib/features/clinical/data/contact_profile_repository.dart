import '../../../core/network/api_client.dart';
import '../domain/clinical_json.dart';

/// Just enough of `GET /me` to pre-fill a clinical form.
///
/// Deliberately a local, minimal read rather than a dependency on the account
/// slice: pre-filling a name and phone number must never be able to break
/// because another feature reshaped its own profile model, and this slice has
/// no business knowing about addresses or profile editing.
class ContactProfile {
  const ContactProfile({this.fullName, this.phone, this.email});

  final String? fullName;
  final String? phone;
  final String? email;

  static const ContactProfile empty = ContactProfile();

  factory ContactProfile.fromJson(Map<String, dynamic> json) => ContactProfile(
    fullName: asText(json['full_name']),
    phone: asText(json['phone']),
    email: asText(json['email']),
  );
}

class ContactProfileRepository {
  const ContactProfileRepository(this._api);

  final ApiClient _api;

  /// The caller's profile, or [ContactProfile.empty] if it cannot be read.
  ///
  /// Pre-fill is a convenience and nothing more: a failure here must never
  /// block a booking or an intake submission, so the error is swallowed rather
  /// than surfaced. The customer can always type the fields themselves.
  Future<ContactProfile> load() async {
    try {
      final Map<String, dynamic> data = await _api.get<Map<String, dynamic>>(
        '/me',
      );
      return ContactProfile.fromJson(data);
    } catch (_) {
      return ContactProfile.empty;
    }
  }
}
