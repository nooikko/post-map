# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue.

Use GitHub's private vulnerability reporting: go to the **Security** tab of this
repository and choose **Report a vulnerability**. That opens a private thread
visible only to the maintainer.

Please include what you found, how to reproduce it, and what an attacker could
actually do with it. A proof of concept helps. I will acknowledge reports as
soon as I reasonably can, and I will tell you plainly if I think something is
not exploitable rather than leaving you waiting.

This is a hobby project with no bounty and no formal response-time commitment.

## Scope

This is a static site: no database, no accounts, no user input persisted
anywhere, no server code. That rules out most of the usual categories. What is
genuinely in scope:

- **Cross-site scripting via article content.** Wiki HTML is the only untrusted
  input, and it is the one thing rendered as raw HTML. It passes through an
  allowlist sanitizer (`lib/wiki/sanitize.ts`) at build time. A way to get
  markup past that allowlist and into a rendered page is the highest-value bug
  here.
- **Content-Security-Policy weaknesses** in `next.config.ts` — a bypass, or a
  directive that is looser than it needs to be.
- **Path traversal in the mirror tooling.** `scripts/fetch-redirect-targets.ts`
  turns wiki page titles into filenames and guards this with `isSafeName`; a way
  around that guard counts.
- **Dependency vulnerabilities** that are actually reachable from the deployed
  site rather than only from the build toolchain.

## Out of scope

- Content of the Forgotten Realms Wiki articles themselves. The mirror reflects
  what the wiki published; report inaccuracies to the wiki.
- The fact that Wizards of the Coast can revoke Fan Content Policy permission at
  any time. That is a known and accepted condition of the project existing, not
  a vulnerability. See [NOTICE](NOTICE).
- Missing security headers that do not apply to a static site with no cookies,
  no authentication, and no sessions.
- Findings from automated scanners with no demonstrated impact.

## A note on the CSP

`script-src-elem` allows `'unsafe-inline'`, and this is deliberate rather than
an oversight. Pages are statically prerendered with no middleware, so Next.js
cannot mint a per-request nonce for its inline bootstrap scripts. The
compensating control is `script-src-attr 'none'`, which blocks inline event
handlers. Reports pointing out that `'unsafe-inline'` is present are already
known; reports showing a way to *exploit* it are not, and are welcome.
