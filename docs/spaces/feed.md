# Feed

**Node bucket:** `feed` (Kronk::NodeRegistry) · **Cross-cutting** — not owned by a single korner manifest.

## Purpose

Feed is Kronk's home-screen surface — where the platform reads as
**one thing** rather than a set of separate tools. Every korner
projects into the feed via its `feed_projection.card`; the feed is
the place a user encounters the whole of Kronk in one continuous
scroll.

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml` under the `feed` bucket:

- **`feed.home`** — Home timeline. `/home`. Live.
- **`feed.nudges`** — Nudges activity feed (fourth-pillar surface,
  in-flight per PR #331). Path/lifecycle: see the Nudges pillar spec
  draft.

## Cross-references

- The feed-projection contract for each korner is documented on its
  own space doc plus in `docs/kronk_korner_spec.md` §"Feed
  projection".
- Card frame: `StatusKornerCard` — the shared visual frame every
  korner card composes with. Card partials: `_status_<korner>_card.scss`
  in `app/javascript/styles/mastodon/`.
- Card registry: `app/javascript/mastodon/components/korner_cards.tsx`.

## Status

Home feed is a stable Mastodon-inherited surface, dressed in Kronk
chrome. Nudges activity feed lands via PR #331 (Nudges pillar spec).

*This is a stub. Contributions welcome — see the pattern of the
korner-space docs in this folder for the target shape.*
