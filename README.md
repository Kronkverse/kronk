# Kronk

Kronk is a community-owned social platform at [kronk.info](https://kronk.info),
run and built by the people who use it.

Every relationship on Kronk is mutual — a **Mate**, never a one-way follow.
You choose how far each post reaches (Mates, Orbit, Kronkverse) and how wide your
feed reads, and no algorithm decides for you. Activity arrives in **Nudges**, a
messenger, not a bell. Everything else lives in **korners**: self-contained
spaces with one job each — Kalendar for events, Kommons for proposals and votes,
Booth for music, Kuestions, Moments, Albutts, Wachuneed and more — plugged into
the **Hub**, declared by a manifest, and wearing one shared Kronk-purple
identity. How the platform changes is decided in the open, in Kommons, on the
instance itself.

Kronk began as a fork of [Mastodon](https://github.com/mastodon/mastodon), and
with 2.0.0 "Rose" (September 2026) it became its own platform. Mastodon is still
the engine underneath — Rails, accounts, media, the API — and we still take its
security and framework updates. Everything a member sees is Kronk's.

**[`CLAUDE.md`](CLAUDE.md)** is the one guide to building Kronk — what it is,
what it holds to, its language and look, how korners are built, and the
workflow. It is written for people and for Claude, which does most of the work
alongside our developers.

## Contributing

New here? Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to pick up a
bug, how to add something new that fits, and how several people land work at
once without stepping on each other.

The loop, in one breath: branch off `shadow`, open a PR into `shadow`, add it
to the merge queue when the checks are green, and see it live on
[shadow.kronk.info](https://shadow.kronk.info) about two minutes later.
Releases move `shadow` to `main`, which is what production runs.

## Where to find things

| You want to…                                                   | Read                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Make your first contribution                                   | [`CONTRIBUTING.md`](CONTRIBUTING.md)                     |
| Build anything — principles, language, look, korners, workflow | [`CLAUDE.md`](CLAUDE.md)                                 |
| Understand one space or korner                                 | [`docs/spaces/<slug>.md`](docs/spaces/README.md)         |
| Know why something is the way it is                            | [`docs/rebuild/decisions.md`](docs/rebuild/decisions.md) |

When a doc and the code disagree, **the code wins** — and the doc deserves a PR.

## Tech stack

Ruby on Rails (Ruby 3.4.7), PostgreSQL, Redis and Sidekiq, Node.js for
streaming, React and Redux for the web client — the engine Kronk inherited from
Mastodon.
See **Building Locally** in [`CLAUDE.md`](CLAUDE.md) for setup.

## Links

- Kronk: https://kronk.info
- Shadow (integration preview): https://shadow.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
- Mastodon, the engine underneath: https://github.com/mastodon/mastodon

## License

Kronk is free software under the GNU Affero General Public License v3, as is
Mastodon, which it is built on.

Copyright (c) 2016-2025 Eugen Rochko (+ [`mastodon authors`](AUTHORS.md)), and
the Kronk contributors.

```text
Copyright (c) 2016-2025 Eugen Rochko & other Mastodon contributors

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see https://www.gnu.org/licenses/
```
