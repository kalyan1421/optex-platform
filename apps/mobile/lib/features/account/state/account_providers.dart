import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/account_repository.dart';
import '../domain/address.dart';
import '../domain/profile.dart';

final Provider<AccountRepository> accountRepositoryProvider =
    Provider<AccountRepository>((Ref ref) => AccountRepository(ref.watch(apiClientProvider)));

/// The signed-in customer's `/me` profile.
///
/// Kept separate from `authControllerProvider`'s [AuthUser] on purpose: that
/// one is the token identity and has no setter, so a name edited here would
/// otherwise never be reflected anywhere. Screens read this for display and
/// fall back to the auth user only while it loads.
class ProfileController extends AsyncNotifier<MeProfile> {
  AccountRepository get _repo => ref.read(accountRepositoryProvider);

  @override
  Future<MeProfile> build() => _repo.getProfile();

  Future<void> refresh() async {
    state = const AsyncValue<MeProfile>.loading();
    state = await AsyncValue.guard(_repo.getProfile);
  }

  /// Saves the editable fields and adopts the server's response as the new
  /// state — never the values we sent, so server-side normalisation (or a
  /// freshly created `customers` row) shows up immediately.
  ///
  /// Throws `ApiException` on failure so the calling form can show it inline;
  /// the provider's own state is left untouched rather than flipped to an
  /// error screen over a rejected phone number.
  Future<MeProfile> save({
    String? fullName,
    String? phone,
    bool clearPhone = false,
  }) async {
    final MeProfile updated = await _repo.updateProfile(
      fullName: fullName,
      phone: phone,
      clearPhone: clearPhone,
    );
    state = AsyncValue<MeProfile>.data(updated);
    return updated;
  }
}

final AsyncNotifierProvider<ProfileController, MeProfile> profileProvider =
    AsyncNotifierProvider<ProfileController, MeProfile>(ProfileController.new);

/// Saved addresses, default first.
class AddressesController extends AsyncNotifier<List<Address>> {
  AccountRepository get _repo => ref.read(accountRepositoryProvider);

  @override
  Future<List<Address>> build() => _repo.listAddresses();

  Future<void> refresh() async {
    state = const AsyncValue<List<Address>>.loading();
    state = await AsyncValue.guard(_repo.listAddresses);
  }

  /// Reloads from the server rather than splicing the response into the local
  /// list. Setting a default mutates a *second* row (the old default), so a
  /// local patch would leave two addresses marked default on screen.
  Future<void> _reload() async {
    state = AsyncValue<List<Address>>.data(await _repo.listAddresses());
  }

  Future<void> create(AddressInput input) async {
    await _repo.createAddress(input);
    await _reload();
  }

  /// Named `edit` rather than `update`: `AsyncNotifier` already defines an
  /// `update(cb)` for transforming state, and shadowing it is an error.
  Future<void> edit(String id, AddressInput input) async {
    await _repo.updateAddress(id, input);
    await _reload();
  }

  Future<void> setDefault(String id) async {
    await _repo.setDefaultAddress(id);
    await _reload();
  }

  /// Deletes [id], first promoting [replacementDefaultId] if one was chosen.
  ///
  /// The promotion runs first and deliberately is not rolled back if the
  /// delete then fails: the customer picked that replacement, and ending up
  /// with the intended default plus an address they wanted gone is a far
  /// better failure than ending up with no default at all (P0-6).
  Future<void> remove(String id, {String? replacementDefaultId}) async {
    if (replacementDefaultId != null && replacementDefaultId != id) {
      await _repo.setDefaultAddress(replacementDefaultId);
    }
    await _repo.deleteAddress(id);
    await _reload();
  }
}

final AsyncNotifierProvider<AddressesController, List<Address>> addressesProvider =
    AsyncNotifierProvider<AddressesController, List<Address>>(AddressesController.new);
