/// Mirrors `AuthUserView` in `apps/api/src/modules/auth/dto/auth-views.ts`.
///
/// Every field except `id` is nullable server-side, and a social signup really
/// can arrive without a name, so nothing here is made non-null for convenience.
class AuthUser {
  const AuthUser({
    required this.id,
    this.email,
    this.fullName,
    this.role,
    this.branchId,
    this.permissions = const <String>[],
  });

  final String id;
  final String? email;
  final String? fullName;

  /// Staff role from `app_metadata.role`. **Null for every customer**, which is
  /// the normal case in this app — customers are not in `staff_users` at all.
  final String? role;
  final String? branchId;

  /// Only `GET /auth/me` populates this; login/signup/refresh return the
  /// slimmer `AuthUserView`.
  final List<String> permissions;

  /// A display name that never renders as "null". Falls back to the local part
  /// of the email, then to a neutral label.
  String get displayName {
    if (fullName != null && fullName!.trim().isNotEmpty) return fullName!.trim();
    final String? mail = email;
    if (mail != null && mail.contains('@')) return mail.split('@').first;
    return 'There';
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String?,
        fullName: json['fullName'] as String?,
        role: json['role'] as String?,
        branchId: json['branchId'] as String?,
        permissions: (json['permissions'] as List<dynamic>?)
                ?.map((dynamic e) => e.toString())
                .toList() ??
            const <String>[],
      );
}

/// Mirrors `SessionView`.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresIn;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 3600,
      );
}

/// Mirrors `AuthResult`.
///
/// [session] is null in exactly one case: signup when email confirmation is
/// enabled. The UI must handle it as "check your inbox", not as a failure.
class AuthResult {
  const AuthResult({required this.user, this.session});

  final AuthUser user;
  final AuthSession? session;

  bool get needsEmailConfirmation => session == null;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
        session: json['session'] == null
            ? null
            : AuthSession.fromJson(json['session'] as Map<String, dynamic>),
      );
}
