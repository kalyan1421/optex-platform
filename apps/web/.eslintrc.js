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
  },
  ignorePatterns: ['.next/**', 'node_modules/**', 'e2e/**'],
};
