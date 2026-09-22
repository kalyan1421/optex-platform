/// Mirrors `MeProfileDto` (`apps/api/src/modules/account/dto/me-profile.dto.ts`).
///
/// [id] is the Supabase `auth.users.id`, not `customers.id` — the API
/// deliberately returns the stable token identity so callers key on the same
/// value the JWT carries.
class MeProfile {
  const MeProfile({
    required this.id,
    this.email,
    this.fullName,
    this.phone,
    this.hasProfile = false,
  });

  final String id;
  final String? email;
  final String? fullName;
  final String? phone;

  /// False when no `customers` row exists yet and the response is a
  /// token-only identity. `PATCH /me` creates the row, so an edit is still
  /// the right affordance — this only changes what we can show before one.
  final bool hasProfile;

  String get displayName {
    final String? name = fullName?.trim();
    if (name != null && name.isNotEmpty) return name;
    final String? mail = email;
    if (mail != null && mail.contains('@')) return mail.split('@').first;
    return 'There';
  }

  /// Initials for the avatar. Falls back to a single letter rather than an
  /// empty circle.
  String get initials {
    final List<String> parts = displayName
        .split(RegExp(r'\s+'))
        .where((String p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.firstChar.toUpperCase();
    return (parts.first.firstChar + parts[1].firstChar).toUpperCase();
  }

  factory MeProfile.fromJson(Map<String, dynamic> json) => MeProfile(
    id: json['id'] as String,
    email: json['email'] as String?,
    fullName: json['full_name'] as String?,
    phone: json['phone'] as String?,
    hasProfile: json['has_profile'] as bool? ?? false,
  );
}

extension on String {
  /// First character, or an empty string — `String[0]` on an empty string
  /// throws, and a nameless social signup really can get here.
  String get firstChar => isEmpty ? '' : substring(0, 1);
}
