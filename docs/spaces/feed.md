# Feed

**Node bucket:** `feed` (Kronk::NodeRegistry) · **Cross-cutting** — not owned by a single korner manifest.

## Purpose

Feed is Kronk's home-screen surface — where the platform reads as
**one thing** rather than a set of separate tools. Every korner
projects into the feed via its `feed_projection.card`; the feed is
the place a user encounters the whole of Kronk in one continuous
scroll.

## Nodes in the Skeleton

Declared in `config/kronk_nodes.yaml`:

- **`feed.home`** — the feed itself (the one continuous scroll). `/home`. Live.
- **`settings.feed`** — Feed's own settings (`bucket: feed`). `/home/settings`.

Feed is deliberately **one** destination, not a set of timeline tabs. The
local/federated/explore/hashtag timelines are the same feed at a different
**scope** (Friends / FoF / Kommunity), which is a setting — not separate
nodes. Saved collections (froths, bookmarks, lists) are your content, not the
feed; the composer is the global Post action; a post permalink is where every
post lives. None of those are Skeleton destinations, so they carry no node.
(`feed.nudges` lives in the `nudges` bucket — the Nudges pillar — not here.)

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
chrome. The Nudges activity feed shipped (Nudges pillar spec).

*This is a stub. Contributions welcome — see the pattern of the
korner-space docs in this folder for the target shape.*
