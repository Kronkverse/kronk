# Kronk

Kronk is a community-owned social space at [kronk.info](https://kronk.info),
run and built by the people who use it. It is a fork of
[Mastodon](https://github.com/mastodon/mastodon): the social core — posts,
follows, timelines, moderation — is Mastodon's, and Kronk adds **korners** on
top of it.

A korner is a self-contained space with one job: Kalendar for events, Kommons
for proposals and votes, Booth for music sets, Kuestions for Q&A, Moments,
Wachuneed and more. Each one is declared by a manifest in `config/korners/`,
lives under `/hub/<slug>`, and wears the same Kronk-purple identity as
everything else.

## Contributing

New here? Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to pick up a
bug, how to add something new that fits, and how several people land work at
once without stepping on each other.

The loop, in one breath: branch off `shadow`, open a PR into `shadow`, add it
to the merge queue when the checks are green, and see it live on
[shadow.kronk.info](https://shadow.kronk.info) about two minutes later.
Releases move `shadow` to `main`, which is what production runs.

## Where to find things

| You want to…                                 | Read                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Make your first contribution                 | [`CONTRIBUTING.md`](CONTRIBUTING.md)                                         |
| Know the exact workflow, CI gates, releasing | [`CLAUDE.md`](CLAUDE.md) — the source of truth, for people and agents alike  |
| Understand one space or korner               | [`docs/spaces/`](docs/spaces/README.md) — one doc per space                  |
| Build or change a korner                     | [`docs/korners/korner_standard.md`](docs/korners/korner_standard.md), then [`adding_a_korner.md`](docs/korners/adding_a_korner.md) |
| Propose a new korner                         | [`docs/korners/proposing_a_korner.md`](docs/korners/proposing_a_korner.md)   |
| Match the look                               | [`docs/kronk_aesthetic_system.md`](docs/kronk_aesthetic_system.md)           |
| Use the right words                          | [`docs/kronk_korner_spec.md`](docs/kronk_korner_spec.md) §2 Language and §14 Glossary |
| Know why something is the way it is          | [`docs/rebuild/decisions.md`](docs/rebuild/decisions.md)                     |

When a doc and the code disagree, **the code wins** — and the doc deserves a PR.

## Tech stack

Ruby on Rails (Ruby 3.4.7), PostgreSQL, Redis and Sidekiq, Node.js for
streaming, React and Redux for the web client — the same as upstream Mastodon.
See **Building Locally** in [`CLAUDE.md`](CLAUDE.md) for setup.

## Links

- Kronk: https://kronk.info
- Shadow (integration preview): https://shadow.kronk.info
- Issues: https://github.com/Kronkverse/kronk/issues
- Upstream Mastodon: https://github.com/mastodon/mastodon

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
