# OPTEX Mobile — build contract

Read this before writing any code in `apps/mobile`. It exists so that work done
in parallel composes instead of colliding.

Spec: [`docs/specs/SPEC-11-flutter-mobile-app.md`](../../docs/specs/SPEC-11-flutter-mobile-app.md).

## Ownership

| Path | Owner | Rule |
| --- | --- | --- |
| `lib/core/**` | Integrator | **Read constantly, never edit.** If core is missing something you need, write a TODO in your own file and say so in your report. |
| `pubspec.yaml`, `android/**`, `ios/**` | Integrator | **Never edit.** Every dependency you need is already there. Needing a new one is a report item, not an edit. |
| `lib/features/<your-slice>/**` | You, exclusively | Yours alone. No other agent touches it. |

Violating the first two rows is how parallel work turns into merge conflicts,
so treat them as hard boundaries rather than guidance.

## Layout for a feature slice

```
lib/features/<slice>/
  data/     <slice>_repository.dart   API calls, JSON -> models
  domain/   <model>.dart              plain Dart models, hand-written fromJson
  state/    <slice>_providers.dart    Riverpod providers / Notifiers
  ui/       <screen>_screen.dart      screens
  ui/widgets/                         widgets used only by this slice
  <slice>_routes.dart                 exports `List<RouteBase> <slice>Routes()`
```

## Non-negotiables

1. **No code generation.** No `build_runner`, `freezed`, `json_serializable`
   or `riverpod_generator`. Hand-write `fromJson`. Parallel agents running
   codegen race on the same generated files, and the output is unreviewable.
2. **All HTTP goes through `ApiClient`** (`lib/core/network/api_client.dart`).
   Never construct a `Dio` or call an endpoint directly — auth, refresh,
   timeouts, the client-version header and error mapping all live there.
3. **Catch `ApiException`, never `DioException`.** `ApiClient` has already
   normalised it. `e.message` is server-written and safe to show a customer.
4. **Theme tokens only.** `AppColors`, `AppSpacing`, `Theme.of(context)`. No raw
   hex, no magic padding numbers.
5. **Money is `formatKes()`** from `lib/core/models/money.dart`. Never
   `'KSh $x'`.
6. **Totals come from the server.** Never recompute a cart or order total
   client-side; render what the API returns.
7. **Every async surface has three states** — loading, error (with retry where
   retrying could help), and empty. Use `AppLoading`, `AppErrorView`,
   `AppEmptyState` from `lib/core/widgets/async_views.dart`. A bare spinner
   that can hang forever is not acceptable.
8. **Route paths come from `Routes`** (`lib/core/router/routes.dart`). Never
   write a path literal.

## Version gotchas — these break naive code

- **Riverpod 3.4** — use `Notifier` / `AsyncNotifier` subclasses with
  `NotifierProvider<T, S>(T.new)`. No `StateNotifier`, no `ChangeNotifier`.
- **go_router 18** — `GoRoute(path:, builder:)`, `context.go()` / `context.push()`.
- **Dart 3.13** — records, patterns and switch expressions are available; use
  them where they read better.

See `lib/core/providers.dart` and `lib/core/auth/auth_repository.dart` for
worked examples of both the provider style and the repository style.

## The API

Base URL is configured; **write paths relative to `/api`** — e.g. `/products`,
not `/api/products`. `apps/api/src/modules/` is the source of truth for request
and response shapes: read the controller and its DTOs rather than guessing.
`packages/api-client/src/types.ts` has the same shapes in TypeScript and is
often the faster read.

Authentication is automatic. Pass `auth: false` only for genuinely public
endpoints.

## Definition of done

```bash
cd apps/mobile && flutter analyze lib/features/<your-slice>
```

**Must report zero issues** — errors, warnings and infos alike. Do not finish
on a failing analyze. Run it as often as you like; it is fast.

Do not run `flutter build`, do not edit files outside your slice, and do not
`git commit`.

## Reporting back

State plainly: what you built, what you did NOT build and why, anything you
need from core, and anything you found in the API that contradicts the spec.
An honest gap is far more useful than a stub that looks finished.
