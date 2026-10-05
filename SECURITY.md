# Security Policy

If you believe you've found a security vulnerability in Kronk (a bug that
lets something happen that shouldn't be possible), please report it
privately:

- **Preferred:** [report it privately on GitHub](https://github.com/Kronkverse/kronk/security/advisories/new)
  (Security → Report a vulnerability). Only the maintainers can see it.
- **Or email:** <tal@kronk.info>

Please do **not** open a public issue, pull request or post about it until
a fix has shipped. That gives us time to protect Kronk's members first.

## Scope

**In scope:** Kronk's own code in this repository — its korners, spaces,
reach and privacy rules (Mates, the reach ladder, Krews, per-post audience),
signup and the thresholds, and the web client.

**Mastodon's engine:** Kronk runs on Mastodon. If the vulnerability is in
Mastodon itself (it reproduces on an unmodified Mastodon of the same
version), please also report it to the Mastodon project through
[their security advisories](https://github.com/mastodon/mastodon/security/advisories/new)
so every instance gets the fix. We'll follow up on Kronk's side.

**Out of scope:** problems specific to someone else's installation (for
example a misconfiguration) — report those to whoever runs it.

## Supported versions

| Version                       | Supported |
| ----------------------------- | --------- |
| The latest 2.x release        | Yes       |
| `shadow` (the testing branch) | Yes       |
| 1.x and earlier               | No        |
