# Rebuild decisions

Append-only. Newest first. One entry per decision, dated, with the reasoning
and what it supersedes.

**Why this file exists.** Until 2026-07-19, rebuild decisions were kept
deliberately *outside* the repo, in the maintainer's working notes. That
produced a failure worth remembering: a settings IA was "locked" on 07-12 in
a note; a different settings IA was written into `docs/kronk_settings_ia.md`
on 07-15; and on 07-18 the node registry was built from the repo doc — the
only one its author could see — matching neither. A decision nobody working
in the repo can see is not a decision; it is a trap for the next person.

**Precedence when sources disagree: code > repo docs > anything outside the
repo.** Repo docs are not automatically right — several describe the intended
end state in the present tense and read as fact. Verify against code.

---

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
node declaring `bucket: nudges` is *silently dropped*, with no error, and the
doctor cannot report it because the node never enters the registry.
`docs/korners/korner_standard.md` Layer 6 (§L6) already documents four
buckets including `nudges`; the standard is right and the code is behind.

### The Skeleton is plumbing, not only a map

A Skeleton node is not merely a page. Each node carries what it is *wired to*
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
distinguish *core* manifests from korner manifests, rather than forbidding the
slug outright. Noted here rather than quietly worked around, because the
reservation exists for a good reason: it stops a korner claiming a platform
route.

Corroboration that the direction is right: `reserved_slugs.yaml` already
anticipates it — *"Once the Nudges cutover completes (task #30) and the
manifest is retired, `nudges` moves back into this list as a reserved platform
stem."* The repo was already planning for Nudges to stop being a korner and
become a platform space.

**Reasoning:** if every node must declare what it is wired to, core spaces
need the same declaration surface korners already have, because they have the
same things. Feed has settings (`/home/settings`). Nudges has notification
preferences. Under two mechanisms the core cannot declare what a korner can,
so core wiring lives scattered in code where nothing can read it.

That privileged core is what produced the settings mess: settings had no
honest home, so it was filed under the `profile` bucket in the registry while
`docs/spaces/settings.md` claimed it was a `hub` sub-tree.

### Settings: a hub *and* contextual entry, converging

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

---

## Open

- Where account-level settings (security, sessions, account lifecycle,
  import/export) live under the subset model.
- Whether `settings.*` nodes survive at all once each space declares its own
  settings, or whether `/settings` becomes purely a view over the Skeleton.
- The section cut. `docs/kronk_settings_ia.md` (07-15) says "Privacy is not a
  page" and "no standalone Notifications section"; the registry currently
  registers both as `lifecycle: live`. Neither has been applied.
