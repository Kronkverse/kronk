# Kuestions (`kuestions`)

**Manifest:** `config/korners/kuestions.yaml` · **Mount:** `/hub/kuestions` · **Status:** in-flight (Phase 8)

## Purpose

Kuestions is a space for the community to **answer prompts and ask
questions of one another**. Born from user requests for "prompts to
respond to", it serves two loosely-coupled modes:

- **Prompt mode** — if you tune in, the post-box placeholder text
  becomes a **daily prompt** drawn from a Kronk-curated seed pool.
  Low-friction inspiration; responses are plain Statuses (no
  aggregation).
- **Ask mode** — you can post a Kuestion for the wider community to
  answer. The catch: **you can't see any answer until you answer
  yourself.** Always-on gate. Swipe-deck UI at `/hub/kuestions`
  surfaces community-asked Kuestions one at a time.

## Current shape (1.7.x)

Kuestions today is a lightweight Q&A affordance built on Status
polymorphism — a Status with `question: true` renders as a Kuestion
card. Under `app/javascript/mastodon/features/questions/` and
`app/controllers/api/v1/kuestions_controller.rb`. Rendered with the
Ƙ glyph in nav.

## Rebuild vision (2.0.0)

The 2.0 rebuild is both architectural and experiential.

**Data model (Phase 8.1 + 8.4):** Dedicated `questions` and `answers`
tables — no more Status polymorphism. Migration backfills existing
question-shaped Statuses. Dual-read for one release.

**Interaction model — Tinder for Kuestions:** The list view retires.
Kuestions surface one card at a time; swipe-left skips, swipe-right
opens the answer affordance. Each card renders:

- The Kuestion text
- Who asked it (avatar + display name)
- Number of answers so far
- Small profile thumbnails of **friends** who have already answered
  (encouragement signal)

**Answer-before-view gate (Phase 8.2):** Central to the space, not
opt-in. `Kuestions::VisibilityGate` policy enforces: unanswered users
see the Kuestion card but never the answers. Once you submit, the
gate opens.

**Answer format — asker picks per-Kuestion:** At creation the asker
chooses one of:

- Free text
- Multiple choice (2–4 options)
- Yes/no

The card and swipe interaction adapt: MC/yes-no is tap-to-choose;
free text opens a small compose surface.

**Feed projection (Phase 8.3):** One card per **ask**, not one per
answer (a busy swipe session would otherwise flood the feed of anyone
tuned into Kuestions). The `kuestions_card` renders in the home/hub
feed and shows the Kuestion, the running answer count, and friend
thumbnails — same signals as the swipe card, so the feed and the
swipe queue are visually consistent.

**Swipe queue:** Purely chronological, latest first. No personalisation
weighting, no Kategory filtering at the queue level. The swipe UI
carries the discovery weight on its own; simpler backend contract.

**Post-gate view (format-aware):** Once you've answered, the answer
view adapts to the Kuestion's format:

- **MC / yes-no** — aggregate chart with percentages per option, plus
  friend avatars grouped under the option they picked.
- **Free text** — chronological feed of others' answers, paginated.

**Lifetime:** Kuestions never close. The count keeps ticking
indefinitely; there is no "result" moment, no timer, no age-out. A
Kuestion is a permanent asking that keeps gathering answers as new
people encounter it in the swipe deck. Implication: the answer count
is meaningfully unbounded; UI treats it as a running total, not a
resolved outcome.

**Prompt source (post-box prompts):** Kronk-curated seed pack — a
separate pool of Kronk-authored "prompt" Kuestions, distinct from
community asks. In prompt mode, the space itself is the asker;
community-asked Kuestions live only in the swipe deck at
`/hub/kuestions`.

**How prompts surface (post-box):** If a user has tuned into the
prompt feature, the placeholder text in the post-box — currently
"What's on your mind?" — is replaced by a **low-opacity daily prompt**
drawn from the seed pool. One prompt per day, **the same prompt for
every user on that day**. Randomized daily, deterministically
(everyone sees Monday's prompt on Monday). No per-user personalisation.

**What happens when a user replies to a prompt:** They just post a
normal Status. The prompt is inspiration, not an aggregation target.
No Kuestion object is created for the daily prompt; no answer count,
no shared aggregate view. This keeps prompt mode extremely light and
means the two modes share almost no runtime path beyond the seed
pool.

Bootstrap plan: seed the pool with ~10 prompts to stand up the
infrastructure; a bigger authored pool arrives as a separate process
later.

**Aesthetic:** Rebuild the UI in line with the current Kronk aesthetic
tokens (post-planet-metaphor). Coordinating on visual mockups with
Claude web.

**Answer edits (transparency-based):** Answers are editable after the
gate opens. Edits do not re-lock the gate. To keep the space honest,
**every edit is preserved as accessible history**, visible to anyone
who can view the answer. No silent revision — you can change your
mind, but the trail is public.

**Kategories:** Kuestions do not participate in the Kategory taxonomy.
The swipe deck is chronological and untagged; Kuestions don't appear
in Kategory feeds or filters. Clean separation from the Statuses
taxonomy graph.

**Notifications (Nudges):** The asker gets a Nudge on **every
answer**. High-signal by design — the asker cares about each
individual voice, not milestone thresholds. Popular Kuestions could
generate volume; the Nudges-as-DMs surface can batch/group at the
UI layer if noise becomes an issue.

## Open decisions

- **Prompt-pack management** — how are Kronk-curated seed prompts
  authored / rotated once we're past the initial 10? Admin UI? YAML
  in-repo? Community-submission with curation?
- **Duplicate prevention (swipe deck)** — persist per-user swipe
  state (skipped / answered) so a Kuestion never re-appears in one
  user's deck. Straightforward implementation detail, but worth
  flagging.
- **Answer permanence on account deletion** — when an account is
  deleted, do their Answers stay (attributed to deleted-user) or
  vanish? Impacts aggregate integrity.

## Related drafts

- `/home/shared/rebuild/plan/quiet-napping-hare.md` §Phase 8 (Kuestions v2)
- `/home/shared/rebuild/memory/project_kronk_rebuild_kategories_spec_draft.md` (if Kuestions carry Kategories)
- `/home/shared/rebuild/spec/kronk_korner_spec.md` §5 (Kuestions)
