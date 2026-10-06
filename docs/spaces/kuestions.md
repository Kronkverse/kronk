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
**Today** (the daily prompt), **Answered**, **Yours** (your asks). The
composer opens as the shared compose-shell overlay at
`/hub/kuestions/composer` (`/ask` is a legacy alias). Settings live at
`/hub/kuestions/settings`.

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
- **Editing answers.** The answers API only has `create` (a second
  answer returns `already_answered`), so nobody can edit an answer yet.
- **Stale comments.** `app/controllers/api/v2/kuestions_controller.rb`
  and `config/routes/api.rb` still say `/api/v1/questions` is kept for the
  transition; that route is gone.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes:
`git show 231cca937:docs/spaces/kuestions.md`.
