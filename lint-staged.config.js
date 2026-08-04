// Pre-commit runs ONLY fast, changed-file auto-fixers, so the hook never
// tempts a `--no-verify` bypass. A bypass skips this whole hook — including
// `prettier --write` — which is how unformatted code reaches PRs and fails
// the `lint` merge gate (see docs/rebuild/decisions.md, 2026-08-04).
//
// Project-wide `tsc --noEmit` is deliberately NOT here: it can't be scoped to
// changed files (TS needs the full project graph), so lint-staged ran it over
// the entire codebase on every `.tsx` commit — ~2 GB, slow, and the reason the
// hook got bypassed. CI already runs the identical check (`yarn typecheck` in
// .github/workflows/lint-js.yml), so nothing is lost. Run `yarn typecheck`
// locally before pushing if you want the signal early.
const config = {
  '*': 'prettier --ignore-unknown --write',
  'Gemfile|*.{rb,ruby,ru,rake}': 'bin/rubocop --force-exclusion -a',
  '*.{js,jsx,ts,tsx}': 'eslint --fix',
  '*.{css,scss}': 'stylelint --fix',
  '*.haml': 'bin/haml-lint -a',
};

module.exports = config;
