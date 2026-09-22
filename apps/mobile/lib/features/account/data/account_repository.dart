import '../../../core/network/api_client.dart';
import '../domain/address.dart';
import '../domain/profile.dart';

/// Profile (`/me`) and saved addresses (`/addresses`).
///
/// Both surfaces are scoped server-side to the caller's own `customers` row,
/// so nothing here passes an id the client made up.
class AccountRepository {
  const AccountRepository(this._api);

  final ApiClient _api;

  // ── Profile ─────────────────────────────────────────────────────────────

  Future<MeProfile> getProfile() async {
    final Map<String, dynamic> json = await _api.get<Map<String, dynamic>>('/me');
    return MeProfile.fromJson(json);
  }

  /// `PATCH /me`. Only `full_name` and `phone` are editable; everything else
  /// on the row is server-controlled.
  ///
  /// A key is sent only when the caller passed it, because the service treats
  /// `undefined` as "leave alone" and `null` as "clear". Passing an explicit
  /// null for [phone] is therefore how a customer removes their number.
  Future<MeProfile> updateProfile({
    String? fullName,
    String? phone,
    bool clearPhone = false,
  }) async {
    final Map<String, dynamic> body = <String, dynamic>{
      if (fullName != null) 'full_name': fullName.trim(),
      if (clearPhone) 'phone': null else if (phone != null) 'phone': phone.trim(),
    };
    final Map<String, dynamic> json =
        await _api.patch<Map<String, dynamic>>('/me', body: body);
    return MeProfile.fromJson(json);
  }

  // ── Addresses ───────────────────────────────────────────────────────────

  /// Default first, then newest first — the server's ordering, not ours.
  Future<List<Address>> listAddresses() async {
    final List<dynamic> json = await _api.get<List<dynamic>>('/addresses');
    return json
        .whereType<Map<String, dynamic>>()
        .map(Address.fromJson)
        .toList(growable: false);
  }

  Future<Address> createAddress(AddressInput input) async {
    final Map<String, dynamic> json = await _api.post<Map<String, dynamic>>(
      '/addresses',
      body: input.toJson(),
    );
    return Address.fromJson(json);
  }

  Future<Address> updateAddress(String id, AddressInput input) async {
    final Map<String, dynamic> json = await _api.patch<Map<String, dynamic>>(
      '/addresses/$id',
      body: input.toJson(),
    );
    return Address.fromJson(json);
  }

  Future<void> deleteAddress(String id) => _api.delete<dynamic>('/addresses/$id');

  Future<Address> setDefaultAddress(String id) async {
    final Map<String, dynamic> json =
        await _api.post<Map<String, dynamic>>('/addresses/$id/default');
    return Address.fromJson(json);
  }
}
