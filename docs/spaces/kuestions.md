# Kuestions (`kuestions`)

**Manifest:** `config/korners/kuestions.yaml` · **Mount:** `/hub/kuestions` · `enforced: true`

## Purpose

Kuestions is where the community **asks each other questions and answers
prompts**. It came from people asking for "prompts to respond to". It has
two loosely coupled modes:

- **Ask mode.** You post a Kuestion for the community. Others answer it
  in a swipe deck. **You can't see the answers until you answer.**
- **Prompt mode.** Kronk sets one prompt a day, the same for everyone. It
  sits faint in your post box as a starting point. Your reply is a normal
  post.

## Ask mode

### The deck

`/hub/kuestions` shows one Kuestion at a time. You answer or skip.
`Question.deck_for(account)` returns active Kuestions you haven't answered
or skipped, **newest first**. No personalisation, no Kategory filter. Your
own asks stay in your deck until you answer or skip them, so you can weigh
in on your own question.

Views (manifest `views:`, cycled by the header rotator): **Deck**,
**Today** (the daily prompt), **Answered** and **Profile** (see Profile
Kuestions below). The composer opens as the
shared compose-shell overlay at `/hub/kuestions/composer` (`/ask` is a
legacy alias). Settings live at `/hub/kuestions/settings`.

**Answered** lists what you answered and what you asked
(`GET /api/v2/kuestions?filter=involved`), newest first, each row showing
your own answer (`my_answer`). Your asks read "You asked"; one you haven't
answered gets **Answer your own**. A new ask lands here. Tapping a row opens
the reveal sheet. Yours, a separate view of your asks, merged into Answered
on 2026-10-12 to make room for a Profile view; `/hub/kuestions/yours` still
opens Answered.

### Answer formats

`Question::ANSWER_FORMATS` is `text`, `mc` (2–4 options) and `yn` (options
filled in as Yes/No).

### The answer gate

`Kuestions::VisibilityGate` (`app/services/kuestions/visibility_gate.rb`):

- A **locked** Kuestion shows a viewer only their own answer until they
  answer. Then they see every answer. Kuestions are created locked.
- An unlocked Kuestion's answers are open to anyone.
- **The asker is exempt.** They see every answer without answering
  (their question, their answers). If they do answer, it counts like any
  other.
- The gate is the only access control on the answer list. An answer's own
  `visibility_scope` governs how it shows elsewhere, not who sees it
  inside the Kuestion.

The `unlock_confirmation` setting (default on) asks before you answer,
because answering spends the unlock.

### After the gate

Both sheets (answering, and the reveal) share `features/questions/sheet_frame.tsx`.
It renders into `<body>`, because a fixed box inside the Frame's turning drum
is positioned against the drum and not the screen; the sheet scrolls on its
own without moving the page behind, and dragging it down from its top closes
it. The page has no star field of its own: the Kosmos behind every page shows
through (2026-10-12).

The reveal sheet adapts to the format:

- **Multiple choice / yes-no** — a bar per option with the avatars of who
  picked it.
- **Free text** — the answers as a list.

### Edits

The rule: answers may be edited, editing never re-locks anything, and
every prior version stays visible to anyone who can see the answer. You
can change your mind, but the trail is public. The model side is built:
`Answer` pushes the old body or choice onto `answers.edit_history` before
a change, and the reveal sheet shows that history. There is no edit
endpoint yet (see Open).

### Lifetime

Kuestions never close. There is no result moment, timer or age-out; the
answer count is a running total.

### Feed projection

One card per **ask**, not per answer, so deck activity doesn't flood the
feed. Posting a Kuestion runs `Kuestions::PublishQuestion`, which writes a
companion Status with `source_korner='kuestions'`. It renders as
`StatusKuestionsCard`
(`app/javascript/mastodon/components/status_kuestions_card.tsx`): title,
prompt, answer count, recent-answerer avatars and a link.

### Nudges

Each answer publishes `kuestions.question.answered`
(`app/models/answer.rb`). Nudges listens for it
(`config/korners/nudges.yaml`) and routes it into the asker's Mate chat
with the answerer. Like every nudge, it only lands if the two are Mates.
A froth on the Kuestion's Status publishes `kuestions.question.frothed`
(`app/models/favourite.rb`), which Nudges routes the same way.

### Kategories

Kuestions don't take part in the Kategory taxonomy.

## Profile Kuestions

Kuestions people answer and pin to their profile, to say who they are.
They replace profile Fields (Tal, 2026-10-12). **The back end and the
Profile view are built; the profile's own display is not yet.**

The **Profile** view (`/hub/kuestions/profile`) is a grid of every profile
Kuestion under its group heading, Kronk's first and members' last under
"From members". A tile shows your answer, or the question if you haven't
answered; pinned tiles are outlined, unpinned ones say so. Tapping one opens
a sheet to answer, edit, change reach, take it off your profile or remove
the answer. The input follows the format (a date picker, a link field, a
paragraph box). In the composer, **Where does it go?** picks the deck or
**For profiles**; a profile Kuestion takes the profile formats and lands in
this view.

- **Kind.** `questions.kind` is `community` (everything above) or
  `profile`. Profile Kuestions are unlocked, stay out of the Deck and the
  Answered and asked lists, make no feed post (`PublishQuestion` skips them)
  and send no answer nudge. Anyone can ask one (`POST /api/v2/kuestions`
  with `kind: profile`).
- **Kronk-written ones.** `config/kuestions_profile_seeds.yml` holds 28,
  one per old profile Field and keyed the same (`seed_key`), each with a
  short `label` and a `group` heading. `Kuestions::ProfileSeeds.sync!`
  loads them (a migration runs it; safe to re-run). They have no author.
- **Formats.** On top of `text`, `mc` and `yn`, profile Kuestions take
  `longtext`, `list`, `link` and `date`. A date answer is `YYYY-MM-DD`; a
  link has no spaces; a list is comma-separated text.
- **Answering pins.** Answering a profile Kuestion pins it to your profile
  (`answers.pinned_at`, order in `pin_position`, tile size in
  `settings.size`). Reach defaults to Kronkverse, like the rest of a
  profile. Profile answers keep no edit trail. Answering returns the
  Kuestion with your `my_answer`.
- **Who sees a pinned answer.** Its author always; anyone else needs the
  profile itself to be visible to them, then the answer's own reach on the
  same ladder as profile cards (`Answer#visible_on_profile_to?`,
  `ProfileVisibility.reach_allows?`). The reveal sheet for a profile
  Kuestion lists answers by the same rule.

API:

- `GET /api/v2/kuestions?filter=profile`: every profile Kuestion, Kronk's
  in file order then members' newest first, with your `my_answer` (body,
  pinned, reach, size).
- `PATCH /api/v2/kuestions/:id/answer`: edit your answer (`body` or
  `choice_index`), its `visibility_scope`, and for profile Kuestions
  `pinned` and `size`. `DELETE` removes a profile answer; a community answer
  stays, because answering is what unlocked the others.
- `GET /api/v2/kuestions/pinned?account_id=`: what you may see of that
  person's pins, in their order. `PATCH /api/v2/kuestions/pinned` with
  `question_ids[]` reorders your own.

## Prompt source

The daily prompt comes from `config/kuestions_daily_prompts.yml`, a
Kronk-authored seed pack (10 prompts today), separate from community asks.
`Kuestions::DailyPrompt` (`app/lib/kuestions/daily_prompt.rb`) picks one
per calendar day by hashing the date, so everyone sees the same prompt and
no per-user state is stored. Replying makes a normal Status: no Kuestion
object, no answer count, no aggregate.

The prompt shows in the post box if `daily_prompt_in_post_box` is on
(default on), and on the **Today** view.

## Code

- **Models** — `Question`, `Answer`, `QuestionSkip`. A `Question` links to
  its feed Status via `status_id`.
- **API** — `/api/v2/kuestions` (`index`, `show`, `create`), nested
  `answers` (`create`), `skip` (`create`, `destroy`), and
  `kuestions/prompt/today` (`config/routes/api.rb`).
- **Frontend** — `app/javascript/mastodon/features/questions/`.
- **Redirects** — `/questions` and `/questions/*` 301 to `/hub/kuestions`.

## Open

- **No per-Kuestion page.** The feed card links to `/hub/kuestions/<id>`
  and the answer nudge to `/hub/kuestions/q/<id>`, but the SPA has no
  route for either; both land on the deck.
- **Prompt pack.** How the seed pool grows past 10, and who curates it
  (YAML in the repo, admin UI, community submissions), is undecided.
- **Deleted accounts.** Answers cascade-delete with the account. Whether
  they should instead stay, attributed to a deleted user, to keep the
  aggregate intact, is undecided.
- **Editing answers.** `PATCH /api/v2/kuestions/:id/answer` exists, but
  nothing in the Deck or Answered calls it yet.
- **Stale comments.** `app/controllers/api/v2/kuestions_controller.rb`
  and `config/routes/api.rb` still say `/api/v1/questions` is kept for the
  transition; that route is gone.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes:
`git show 231cca937:docs/spaces/kuestions.md`.
