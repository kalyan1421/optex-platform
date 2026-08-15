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
  },
  ignorePatterns: ['.next/**', 'node_modules/**', 'e2e/**', 'components/ui/**'],
};
