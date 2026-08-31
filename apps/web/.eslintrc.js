// Audit F-24: `next lint` was declared in package.json with no ESLint config or
// dependency anywhere in the repo, so `pnpm -r lint` failed for anyone who ran
// it and CI never ran it at all — which is why nobody found out.
//
// Audit F-16: the jsx-a11y rules below are the ones that would have caught the
// missing form error semantics automatically. Most are `warn` rather than
// `error` so switching the linter on does not block the build on pre-existing
// violations; tighten them once the backlog is clear.
module.exports = {
  extends: ['next/core-web-vitals', 'plugin:jsx-a11y/recommended'],
  plugins: ['jsx-a11y'],
  rules: {
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/no-noninteractive-element-interactions': 'warn',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
    '@next/next/no-img-element': 'warn',
    'react/no-unescaped-entities': 'off',
    // Frontend audit F-03. `docs/API-MIGRATION-PLAN.md` and `docs/SPRINT-01.md`
    // both describe this rule as already existing — "a PR reintroducing a
    // browser query fails CI". It did not: the architectural boundary that all
    // reads and writes go through `apps/api`, never browser-to-Postgres, was
    // held by convention alone. The allowlist in `overrides` below is the
    // complete set of legitimate exceptions, all of them auth: signing in,
    // signing up, password reset, and reading the session to attach a bearer
    // token. Everything else must go through `@optex/api-client`.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@optex/db', '@optex/db/*'],
            message:
              'Do not query Supabase from the app. Use `@optex/api-client` so the request goes through apps/api, where authorization and audit logging live. Auth flows are the only exception — see the allowlist in .eslintrc.js.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // The auth allowlist: these legitimately talk to Supabase Auth
      // directly, because signing in is what produces the token every
      // other request carries.
      files: [
        'context/AuthContext.js',
        'app/login/page.jsx',
        'app/signup/page.jsx',
        'app/reset-password/page.jsx',
        'lib/api.js',
        'lib/api-server.js',
      ],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // KNOWN VIOLATIONS — not exceptions. These four pages query Postgres
      // straight from the browser (`promo_codes` in the cart, `orders` in the
      // other three), bypassing apps/api and resting entirely on RLS. That is
      // the exact thing the boundary exists to prevent, and enabling this rule
      // is what surfaced them.
      //
      // They are frozen rather than allowlisted so the rule stays `error`
      // everywhere else and a NEW violation still fails the build. Migration to
      // `@optex/api-client` is already in progress outside this change; delete
      // each entry as its page lands, and delete this block when the list is
      // empty. Do not add to it.
      files: [
        'app/profile/page.jsx',
        // Globs, not literal paths: ESLint matches with minimatch, where
        // `[orderId]` is a character class rather than a Next.js route segment.
        'app/order-confirmation/**/page.jsx',
        'app/orders/**/tracking/page.jsx',
      ],
      rules: { 'no-restricted-imports': 'warn' },
    },
  ],
  ignorePatterns: ['.next/**', 'node_modules/**', 'e2e/**'],
};
