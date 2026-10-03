/// Client-side mirrors of the API's own `class-validator` rules.
///
/// These exist to spare a round trip and to put the error next to the field,
/// not to replace server validation — the API stays the authority, and its
/// message is what gets shown when the two ever disagree.
class Validators {
  const Validators._();

  /// Deliberately permissive. `class-validator`'s `@IsEmail()` is the real
  /// gate; a stricter regex here would reject valid addresses that the server
  /// would have accepted, which is the worse failure.
  static final RegExp _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  /// `UpdateMeDto.phone`: `/^(\+?254|0)[17]\d{8}$/` — Safaricom/Airtel mobile
  /// numbers, in either local or international form.
  static final RegExp kenyanMobile = RegExp(r'^(\+?254|0)[17]\d{8}$');

  static String? email(String? value) {
    final String v = (value ?? '').trim();
    if (v.isEmpty) return 'Enter your email address';
    if (!_email.hasMatch(v)) return 'That does not look like an email address';
    return null;
  }

  /// `LoginDto.password` is `@MinLength(6)`.
  static String? loginPassword(String? value) {
    final String v = value ?? '';
    if (v.isEmpty) return 'Enter your password';
    if (v.length < 6) return 'Passwords are at least 6 characters';
    return null;
  }

  /// `SignupDto.password` is `@MinLength(8) @MaxLength(72)` — the upper bound
  /// is bcrypt's 72-byte cap inside GoTrue, not an arbitrary choice.
  static String? newPassword(String? value) {
    final String v = value ?? '';
    if (v.isEmpty) return 'Choose a password';
    if (v.length < 8) return 'Use at least 8 characters';
    if (v.length > 72) return 'Use 72 characters or fewer';
    return null;
  }

  static String? fullName(String? value) {
    final String v = (value ?? '').trim();
    if (v.isEmpty) return 'Enter your name';
    if (v.length > 120) return 'That name is too long';
    return null;
  }

  /// Optional on the profile — an empty value clears the saved number.
  static String? optionalKenyanPhone(String? value) {
    final String v = (value ?? '').trim();
    if (v.isEmpty) return null;
    if (!kenyanMobile.hasMatch(v.replaceAll(' ', ''))) {
      return 'Use a Kenyan mobile number, e.g. 0712345678';
    }
    return null;
  }

  /// `CreateAddressDto.phone` is only length-bounded (7–20), because a
  /// delivery contact can legitimately be a landline or a foreign number.
  static String? addressPhone(String? value) {
    final String v = (value ?? '').trim();
    if (v.isEmpty) return 'Enter a contact number';
    if (v.length < 7) return 'That number is too short';
    if (v.length > 20) return 'That number is too long';
    return null;
  }

  /// Generic bounded free text, matching the address DTO's `@MinLength` /
  /// `@MaxLength` pairs.
  static String? Function(String?) required(
    String label, {
    int min = 2,
    int max = 240,
  }) {
    return (String? value) {
      final String v = (value ?? '').trim();
      if (v.isEmpty) return 'Enter $label';
      if (v.length < min) return '$label looks too short';
      if (v.length > max) return '$label is too long';
      return null;
    };
  }

  static String? optionalMaxLength(String? value, String label, int max) {
    final String v = (value ?? '').trim();
    if (v.length > max) return '$label is too long';
    return null;
  }
}
