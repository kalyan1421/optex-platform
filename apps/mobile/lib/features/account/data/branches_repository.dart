import '../../../core/network/api_client.dart';
import '../domain/branch.dart';

/// The public branch directory.
///
/// `GET /branches` is `@Public()` on the API and returns active branches only,
/// ordered by name — so an unauthenticated customer can find a shop before
/// they ever make an account, which is the whole point of the locator.
class BranchesRepository {
  const BranchesRepository(this._api);

  final ApiClient _api;

  Future<List<Branch>> list({String? query}) async {
    final List<dynamic> json = await _api.get<List<dynamic>>(
      '/branches',
      query: <String, dynamic>{'q': query?.trim().isEmpty ?? true ? null : query!.trim()},
      auth: false,
    );
    return json
        .whereType<Map<String, dynamic>>()
        .map(Branch.fromJson)
        .toList(growable: false);
  }
}
