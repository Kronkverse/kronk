---
title: Announcements
updated: 2026-09-15
---

## Kronk 2.0 rebuild

The rebuild is underway on the `rebuild/2.0.0` branch. Everything
Kronk has learned since the 1.x line — the korner framework, the
Nudges paradigm, the Hub landing, the Mates relationship, the
Kommons Directory, the org space you're reading — folds into it.

The rebuild currently lives on
[shadow.kronk.info](https://shadow.kronk.info).
`mastodon.kronk.info` stays on 1.7.x until the branch merges.

## 2.0 headliners

### Relationship & reach

- **Mates** replace one-way followers. Every person-to-person
  relationship is mutual, request-and-accept, both sides consent.
- **Reach ladder** — Mates → Orbit → Kommunity — governs both what
  you see (feed width) and how far a post radiates (visibility).
  **Just me** sits below the ladder, for posts that appear on your
  profile timeline only.
- **Krews** — orthogonal group targets. Post to Mates AND a Krew;
  its members see you whether or not they're on your Mates graph.

### Korners

The Hub grid ships with a lot more spaces than 1.x:

- **Kommons** — proposals, backing, governance.
- **Kalendar** — events + RSVPs.
- **Booth** — audio sets.
- **Moments** — small photo posts.
- **Albutts** — full albums.
- **Kuestions** — Q&A with gated answers.
- **Wachuneed** — asks / offers.
- **Kronikles** — long-form writing.
- **Cinema** — short films.
- **Art / Karporn** — single-author verticals.

Each korner is declared by a manifest, so a new one is a YAML file,
not a redesign.

### Chrome

- **Nudges** — activity in a chat-form messenger, not a bell.
  Person-to-person and korner-triggered events land here.
- **/me hub** — a radial wheel of self-actions (profile, mates,
  timeline, settings, invite, sign out, Kronk).
- **/settings hub** — the same wheel language for personal
  settings.
- **/kronk** — this space. Same wheel, same chrome, same Kosmos
  starfield as everywhere else on Kronk.
- **Ж menu** — a moveable floating action button; writing + space
  controls hang off its ring.

### Settings

The settings audit landed most classic-only preferences on native
SPA pages: appearance (theme, fonts, colours, time zone, emoji
style), posting (defaults, automated post deletion),
[privacy](/settings/privacy) (reach, blocked accounts + domains),
[notifications](/settings/notifications) (email + per-type nudge
mutes), data (import + export), account (email, password,
sessions, sign-in activity).

## Watch this page

Contributor drops land here. When the shadow shell is ready for
wider testing, this page will say so.
