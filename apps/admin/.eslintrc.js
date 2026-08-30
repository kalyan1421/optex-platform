// Audit F-24 — see apps/web/.eslintrc.js for the background.
//
// The admin panel is TypeScript throughout and uses shadcn primitives, which
// already carry correct ARIA. The a11y rules stay on regardless: the panel is a
// daily-driver tool for branch staff, and keyboard operability matters more
// there than on a page someone visits once. `components/ui/**` is vendored
// shadcn source and is not ours to lint.
module.exports = {
  extends: ['next/core-web-vitals', 'plugin:jsx-a11y/recommended'],
  plugins: ['jsx-a11y'],
  rules: {
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-is-valid': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
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
        'app/login/page.tsx',
        'app/mfa-challenge/page.tsx',
        'app/mfa-setup/page.tsx',
        'components/layout/AdminSidebar.tsx',
        'lib/api.ts',
      ],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
  ignorePatterns: ['.next/**', 'node_modules/**', 'e2e/**', 'components/ui/**'],
};
