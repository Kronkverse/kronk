# Rebuild decisions

Append-only. Newest first. One entry per decision, dated, with the reasoning
and what it supersedes.

**Why this file exists.** Until 2026-07-19, rebuild decisions were kept
deliberately _outside_ the repo, in the maintainer's working notes. That
produced a failure worth remembering: a settings IA was "locked" on 07-12 in
a note; a different settings IA was written into `docs/kronk_settings_ia.md`
on 07-15; and on 07-18 the node registry was built from the repo doc — the
only one its author could see — matching neither. A decision nobody working
in the repo can see is not a decision; it is a trap for the next person.

**Precedence when sources disagree: code > repo docs > anything outside the
repo.** Repo docs are not automatically right — several describe the intended
end state in the present tense and read as fact. Verify against code.

---

## 2026-07-20 — Korner conformance gates (L1 / L10) + event bus

Decisions taken while building the conformance gates from
`implementation_plan.md` Phases 1.7 / 5.7 / 9.5 (PRs #387–#393). All verified on
a real Postgres + Redis env before merge.

### D2 — Klot's `klot_phase_viewer` is a sanctioned exception, not migrated now

Klot's bespoke visibility scope points at a shared authorization layer (§7) that
does not exist yet. Rather than build §7 to satisfy one scope, `klot_phase_viewer`
stays enforced by its existing ownership check + `KlotShare` allowlist and is
documented as a **sanctioned exception** in `korner_standard.md`. It migrates onto
the shared layer when §7 lands. (Klot's manifest _shape_ was still migrated to the
nested `security:` block — #392.)

### D3 — Nudges and Groups are accepted structural exceptions

Named in `korner_standard.md` so they stop reading as drift: **Nudges** is a
`core:` space (own mount `/nudges`, no Hub tile, not tune-out-able) that carries a
manifest only because a manifest is how anything is declared; **Groups** opts out
of feed projection by design (`render_target: web`, no `status_association`), so
its L3/L4 gates are N/A, not failures.

### §5.7 — a manifest declares only notification types that actually fire

The L10 gate (#388) requires every declared `notifications.types[].name` to be a
registered `Notification` type. Rather than register dead types to satisfy it, the
rule is: **declare only what has a working producer.** Built `proposal_challenged`

- `task_assigned` (real hooks exist); removed the declarations whose trigger
  surfaces don't exist yet — kommons `proposal_backed`/`proposal_comment`, kuestions
  `question_answered`/`answer_frothed`, wachuneed's four `listing_*` — each with a
  manifest comment on when it returns (#393). They come back _with their producers_.

### §9.5 — event-bus wiring is deferred

The bus (`Kronk::KornerEvents`) has publishers but no runtime subscribers and no
handler-naming convention. The entire system has **one** cross-korner listen
(huddle ← `kalendar.event.created`; the names align, so it is not an orphan), its
handler is unbuilt _feature_ work, and huddle is `enforced: false`. Building a
generic wiring framework + convention for a single non-enforced consumer is
premature. Deferred until a second real listener or a concrete need exists; the
`listens:`/`emits:` text check in `korners doctor` remains adequate until then.

### Process — a reverted feature must restore its migrations too

The 2026-04-27 "Kommons" revert deleted 8 migrations; when Kommons was re-added
only `create_tasks` came back, leaving `proposals` (and others) in `schema.rb`
with no creating migration — the from-scratch migration replay was red for weeks.
Recovered verbatim from the pre-revert commit (#390). Lesson: when reverting then
re-landing a feature, the migration set travels with it; the replay job is the
check that catches a half-restore.

## 2026-07-19 — The space model

### A space is the general thing; a korner is one kind of space

"Space" has no strict definition and does not need one: it is any top-level
surface of Kronk. "Korner" is precise — a pluggable, manifest-declared space
that can be added or removed.

**Feed, Profile, Nudges and Hub are spaces that are not korners.** They have
no collective name beyond "spaces"; naming them as a category was considered
and rejected as unnecessary vocabulary.

### The top-level spaces are Feed, Profile, Nudges, Hub

Matching what shipped in `hub_switcher.tsx` — Me / Home / Nudges, with Hub on
the korner rail.

**Consequence, not yet applied:** `Kronk::NodeRegistry::BUCKETS` accepts only
`feed|profile|hub`, and `build_node` returns `nil` for anything else — so a
node declaring `bucket: nudges` is _silently dropped_, with no error, and the
doctor cannot report it because the node never enters the registry.
`docs/korners/korner_standard.md` Layer 6 (§L6) already documents four
buckets including `nudges`; the standard is right and the code is behind.

### The Skeleton is plumbing, not only a map

A Skeleton node is not merely a page. Each node carries what it is _wired to_
— its settings, its notifications, its projections — and other subsystems
read the Skeleton to find out: Nudges reads it to know what can notify,
settings reads it to know what can be configured, feed rendering reads it to
know what projects.

This is why registry drift matters more than bookkeeping. A manifest that
declares five notification types while the code registers one is not untidy;
it is a registry lying to its consumers. (`config/korners/kommons.yaml`
declares `proposal_backed`, `proposal_challenged`, `proposal_comment`,
`task_assigned`, `proposal_status_changed`; `app/models/notification.rb`
registers only the last. The doctor does not currently check this.)

### One mechanism: every space gets a manifest

Supersedes the split between `config/korners/*.yaml` (korners) and
`config/kronk_nodes.yaml` (everything else).

Core spaces — feed, profile, nudges, hub — get manifests like any korner,
flagged non-removable. `config/kronk_nodes.yaml` becomes core manifests.

**Blocked as written.** `config/korners/reserved_slugs.yaml` reserves `feed`,
`hub`, `home` and `settings`, and `docs/korners/korner_standard.md` §L1 fails
any manifest whose slug is reserved — so `feed.yaml` and `hub.yaml` cannot
exist under the current rule. Resolving this needs the reserved-slug check to
distinguish _core_ manifests from korner manifests, rather than forbidding the
slug outright. Noted here rather than quietly worked around, because the
reservation exists for a good reason: it stops a korner claiming a platform
route.

Corroboration that the direction is right: `reserved_slugs.yaml` already
anticipates it — _"Once the Nudges cutover completes (task #30) and the
manifest is retired, `nudges` moves back into this list as a reserved platform
stem."_ The repo was already planning for Nudges to stop being a korner and
become a platform space.

**Reasoning:** if every node must declare what it is wired to, core spaces
need the same declaration surface korners already have, because they have the
same things. Feed has settings (`/home/settings`). Nudges has notification
preferences. Under two mechanisms the core cannot declare what a korner can,
so core wiring lives scattered in code where nothing can read it.

That privileged core is what produced the settings mess: settings had no
honest home, so it was filed under the `profile` bucket in the registry while
`docs/spaces/settings.md` claimed it was a `hub` sub-tree.

### Settings: a hub _and_ contextual entry, converging

Both reachable, both opening the same canonical area — a central hub that
indexes everything, and entry from within each space and korner.

This was never actually in dispute: the 07-12 workshop note (§3) and the
07-15 in-repo IA both said it. Only the section cut differed.

**Mastodon's classic settings pages are to be retired entirely.** That
requires every existing setting to be inventoried and given a home first —
2FA, sessions, authorised apps, migration, delete-account and data
import/export do not belong to any one space and still need somewhere to
live. Retiring before that inventory is complete would silently drop
capabilities users rely on.

### Settings section cut: Privacy → Profile, Notifications → Nudges (2026-07-20)

Resolves the "section cut" open item, confirming `docs/kronk_settings_ia.md`
(07-15). **Privacy is not a standalone page** — it folds into Profile ("Me"),
with its incoming blocks/mutes/filters facet living on Feed. **Notifications has
no standalone section** — notification preferences fold into **Nudges** (IA §3,
"Notifications ≡ Nudges"). The registry still carries `settings.privacy` and
`settings.notifications` as `lifecycle: live` nodes; re-homing them is
implementation follow-up — notifications with the Nudges work, privacy with the
Profile/settings work.

---

### Upstream Mastodon pages: search unified, lists cut, discovery to be rebuilt (2026-07-23)

Audit of the ~29 leftover Mastodon page-components during the Frame migration
(`docs/kronk_frame.md`). Decisions:

- **Search** — KronkSearch (`/hub/search`) is canonical. The Ӂ menu now opens it;
  Mastodon's `/search` + `features/search` are retired.
- **Lists** — cut. Mastodon lists (`features/lists`, `list_timeline`, the deck
  `LIST` column, the list nav panel) are removed; Feed scope
  (Friends / FoF / ₭ommunity) is the only reading filter.
- **DMs** — `/conversations` redirects to Nudges (the messenger is the DM home).
- **Dead code** — `community_timeline`, `public_timeline` (superseded by Firehose)
  and the unrouted `notifications_v2/index` page are removed.
- **Discovery — TODO** — Mastodon's `explore` (trends) and `directory` (profile
  listing) are kept as **placeholders** for now. Kronk should build its **own
  find-people / directory surface** designed for Kronk users (korners, froths,
  presence) rather than the federated Mastodon directory; then retire
  explore/directory. Tracked here until it has a spec.

---

### Two earlier "blocked/consequence" notes are now resolved in code (2026-07-23)

Both landed while their prior notes above still read as open:

- **`NodeRegistry::BUCKETS` (from "The top-level spaces are Feed, Profile,
  Nudges, Hub", 07-19) is caught up.** `app/lib/kronk/node_registry.rb:46` now
  reads `BUCKETS = %w(feed profile hub nudges settings kronk)` — a `bucket:
  nudges` (or `settings`/`kronk`) node is no longer silently dropped. The "not
  yet applied" consequence is applied; the standard's four-bucket §L6 and the
  code agree.
- **Core-space manifests exist (from "One mechanism: every space gets a
  manifest", 07-19) — the reserved-slug block is gone.**
  `config/korners/{feed,hub,profile,settings}.yaml` are all present, and the
  doctor distinguishes core from korner via `manifest.core?`
  (`config/initializers/kronk_korner_registry.rb#core?`; the reserved-slug and
  conformance gates in `lib/mastodon/cli/korners.rb` skip on `next if
  manifest.core?`). A reserved slug no longer forbids its own core manifest.

---

## Open

- Where account-level settings (security, sessions, account lifecycle,
  import/export) live under the subset model.
- Whether `settings.*` nodes survive at all once each space declares its own
  settings, or whether `/settings` becomes purely a view over the Skeleton.
