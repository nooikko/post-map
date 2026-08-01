## What and why

<!--
  What changes, and what problem it solves. The diff shows the what; explain the why.

  If there is no issue discussing this yet, please read CONTRIBUTING.md first —
  PRs without a prior issue often cannot be merged, and I would rather you knew
  that before spending the time than after.
-->

Closes #

## How it was verified

<!-- There is no test suite. Say what you loaded and what you saw. -->

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] Pages checked by hand:

## If this touches the wiki pipeline (`lib/wiki/`)

<!-- Delete this section if it does not. -->

- [ ] Injected `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` into
      a file in `public/data/Faerun/wiki/`, rebuilt, and confirmed neither
      survived into `.next/server/app/place/<slug>.html`
- [ ] Reverted the poisoned file
- [ ] Redirect stubs and the 18 missing-article places still render

## If this touches attribution or licensing

<!-- These are obligations, so they get their own gate. -->

- [ ] `lib/attribution.ts` or `lib/licence-scope.ts` was the thing edited — not
      `NOTICE`, `REUSE.toml`, or `LICENSES/LicenseRef-*.txt` by hand
- [ ] `pnpm licence:check` passes
- [ ] Every article view still carries its CC BY-SA credit and modification notice
- [ ] If a new top-level path holds third-party material, it is excluded in
      `lib/licence-scope.ts` — MIT covers the repo by default, so anything not
      listed there is being given away

## If this touches `next.config.ts`

- [ ] The CSP was not loosened, or the reason it had to be is explained above
- [ ] Checked the deployed headers, not just that the build succeeded
