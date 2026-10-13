# FreeTheDream (`freethedream`)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** `/hub/freethedream` ·
`enforced: false` (native; feed card and settings page still to come)

## Purpose

FreeTheDream is **a self-organising system for running projects together.**
People start projects, and the people who join them organise the work from
the bottom up: anyone in a project can start a piece of it, say what it
needs, offer what they have and take on a job. Nobody approves from above.

It is built on a syntropic framework: collaboration is contributor-driven,
and the **synergistic audit** (from Syntropic World) shows what the community
already has against what its projects need.

The working model is an **in-person mini doof**. Someone starts _Mini Doof_.
Someone else wants a live stage, so they start _Live Stage_ inside it, list
what it needs (a PA, lighting, a generator), suggest jobs (sound tech, set-up
crew) and add ideas (a fire twirler). Others join, claim a slot on the set-up
crew, say they'll bring their generator, and take on the fire twirler idea
themselves.

The same mechanism has to carry very different projects: releasing an album,
buying a property for communal living, starting a not-for-profit, fitting out
a warehouse for community use.

The idea at its heart, in Kashka's words: people should be rewarded for
following their passions and for making the world a better place (heART).

## The mechanism

Decided by Tal, 2026-10-12 (`docs/decisions.md`). Clean and clear like the
rest of Kronk: no busy pages, straight to the point.

### Projects and sections

- A **project** can hold **sections**, and a section is a project in its own
  right, so they nest to any depth (Mini Doof → Kitchen → Wash station).
  The code calls them parts (`Freethedream::Project` with a `parent`).
- A section shares its project's membership; it has no join setting of its
  own.
- A project can have an **end** (a date, or a done moment: the doof happens,
  the album is released), or keep going (a communal house). Whoever owns it
  marks it done.
- For an **in-person event**, the project carries a start and end date and a
  place.
- **Meals are sections.** Kitchen › Meals holds the meal ideas; a meal people
  take on (Dahl for 40) becomes its own section, and its list is its
  ingredients ("5 kg lentils"), so people bring them without doubling up.

### Crossover

Pieces of a project overlap, and the model holds that both ways:

- **Shared items.** A need, job, idea or offer can sit in several parts at
  once. _Generator_ is one need, shown under Live Stage and Kitchen; one
  offer covers both.
- **Dependencies.** A part can depend on another part. _Power_ is its own
  part, and Live Stage and Kitchen depend on it.

### The four kinds of item

| Item      | What it is                          | How people take part                                                                                                                                                                |
| --------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Idea**  | Something someone would like to see | Anyone in the project can tap **I'll make this happen**: the idea becomes a part or a job they own, and keeps its thread.                                                           |
| **Need**  | Something the project requires      | People offer against it. Money is just another need ("$400 for permits"): pledges are tracked here, and the money moves outside Kronk.                                              |
| **Job**   | Something someone could take on     | A job has **slots** (set-up crew ×4). Claiming a slot is instant, until it's full. You can let a slot go.                                                                           |
| **Offer** | Something someone can bring         | Against a need, or on its own. An offer counts **at once** and shows who is bringing what (partly, too: $150 of $400). Offers past what's needed show as **spares**, never blocked. |

Amounts carry a **unit** ("30 plates", "5 kg rice", "$400 permits").
Someone **brings** part of a need by setting how much they'll bring; it
counts at once, they can change it or set it to 0, and the need shows who's
bringing what and what's left ("Sam 12 · Jo 14 · 4 left").

### The page

Decided by Tal, 2026-10-13: simple, clean, and adding things has to be easy.

- **Sections first**, each with its progress ("3 of 8 sorted").
- **Still needed**: every need not yet met and job not yet filled, here and
  in every section inside, each saying which section it's in, with one tap
  to Bring or Claim. A section with no sections inside skips this; its own
  lists already say it.
- **Gear & supplies, Jobs, Ideas, On offer**: this section's own lists. Each
  has a one-line box under it: type "30 plates" or "2 set-up crew", press
  Enter, and the box stays open for the next one.
- **Updates**: who added what, who's bringing what, who took a job, here and
  in every section inside.
- **Talk** (below).

### Talk

Every project, section and item has its own **threads**. A thread has
replies under it, and replies can be answered in turn. Anyone in the project
can **resolve** a thread once it's settled; resolved threads fold away under
"3 resolved threads", and can be reopened.

Why threads that resolve, not messaging (Tal, 2026-10-13): people get
overwhelmed by the volume of messages and stop engaging, and once 300
messages have stacked up nobody can tell what's happening or what they've
missed. FreeTheDream is meant to take the weight off messaging: what's
needed lives in the lists, what's changed lives in Updates, and Talk holds
only what's still being worked out.

### Who can do what

- **Joining.** The creator chooses per project: open to anyone, or by request.
- **Inside a project, anyone who has joined** adds parts, ideas, needs, jobs
  and offers. Whoever adds something **owns** it. Nobody has a veto over
  anyone else's piece, the project's creator included.
- **Ownership moves.** An owner can hand something to another member. If an
  owner leaves, what they made stays, and anyone in the project can take it
  over.

### The synergistic audit

- **Your inventory.** Each person keeps an inventory of what they have, in
  six categories: **Skills, Things, Space, Time, Money, Connections**. It is
  private: only you see it.
- **Sharing into a project.** When you're in a project, you choose which of
  your items to share with it (ten of your forty-five, say). Only shared
  items are seen, and only by that project's members.
- **The project's audit** sets what the project needs against what its
  members have shared, so gaps and spares are plain at a glance.

### Not in the first build

- Nudges, inventory matching ("Live Stage needs a generator; you have one")
  and feed cards. The first build is the space itself; reach comes after.
- Moving money. Pledges are recorded; payment happens elsewhere.

### The build split

- **Kronk (this repo)** builds the mechanism as a **native korner**: project,
  part and item pages, the inventory and the audit, on a new API, inside
  `<KornerShell>`.
- **Kashka** leads the **map and aesthetics**: the map becomes the overview,
  reading the same API.
- The open-map prototype's data is not carried over; the native build starts
  fresh.

## What is built

The mechanism above, first build (2026-10-12), so it can be tried on
shadow.

- **Data** (`db/migrate/20261012140000_create_freethedream_projects.rb`,
  `app/models/freethedream/`): `Project` (a project or part: `parent`,
  `root`, `joining`, `ends_on`, `done_at`), `Membership` (member or
  requested, on the root), `Dependency`, `Item` (`kind`, `category`,
  `quantity`, `need` for an offer, `asset` it brings, `source_idea`),
  `Placement` (item in a part), `Claim` (job slot), `Comment`
  (polymorphic), `Asset` (inventory) and `Share` (asset into a project).
  Owners are nullified when an account goes, so its work stays and is up
  for grabs.
- **API** (`Api::V1::Freethedream::*`, `/api/v1/freethedream/…`): projects
  (list, show, create, update, remove, join, leave, take over, hand over,
  audit), requests (accept, decline), dependencies, items (show, create,
  update, remove, claim, unclaim, take on, take over, hand over),
  placements, comments and assets (with share and unshare). Every shape is
  built for its viewer by `Freethedream::View`, including a `can` block
  saying what they may do. Specs:
  `spec/requests/api/v1/freethedream/mechanism_spec.rb`.
- **Page** (`features/freethedream/`): the Frame's view picker over **All
  projects**, **Mine** and **Inventory**; detail routes for a project or
  section (`/p/:id`), its audit (`/p/:id/audit`) and an item (`/i/:id`).
  "Start a project" is the Ж menu's compose route (`/composer`). Lists add
  through `QuickAdd` (one line, read by `parseLine`); Bring is
  `BringControl`; Talk is `talk.tsx`. Adding a section, editing, offering
  something not on a list and handing over use `<ComposeShell>`.
- **Coordination** (2026-10-13,
  `db/migrate/20261013130000_add_freethedream_coordination.rb`): `unit` on
  items; `starts_on` and `location` on projects; `parent_id`, `resolved_at`
  and `resolved_by_id` on comments; `Activity` for Updates. `POST
/items/:id/bring` sets your amount on a need; `POST
/comments/:id/resolve` and `/unresolve`. The project shape adds
  `progress`, `sections`, `still_needed` and `updates`, all worked out over
  the whole project in one load (`Freethedream::View::Tree`). Specs:
  `spec/requests/api/v1/freethedream/coordination_spec.rb`.

Rules the server holds, whatever the page sends:

- Only members add parts, items, placements, dependencies and comments,
  claim slots or take on ideas.
- Only an owner edits, hands over or removes their own thing. A project
  or part can be removed only when nobody else has anything in it.
- A job takes claims until its slots are full. An offer counts against a
  need at once; past the need it shows as spare.
- Dependencies stay inside one project and can't loop.
- A reply stays on its thread's subject. Taking back a comment someone has
  replied to keeps the replies; only its words go.
- An inventory item can be shared only into a project its owner is in.
  Leaving a project takes your shares out and frees your job slots. Only
  members see the audit.

Kashka's earlier map page, `public/freethedream-preview.html`, and its
document backend (`Api::V1::FreethedreamController`,
`freethedream_documents`) are still in the repo for her standalone copy.
`/hub/freethedream` no longer shows it.

## Open

- **The map**: Kashka's overview on top of the new API.
- **Retire the prototype backend** (`FreethedreamController`,
  `freethedream_documents`) once Kashka's page reads the new API.
- **Feed card and settings page**, the Standard's remaining layers before
  `enforced: true`.
- **The Syntropic audit itself.** The six categories are a starter set; map
  them to Syntropic World's framework once we have its detail.
- **Harm and spam.** Nothing can take a project down except its creator.
  Deferred by Tal (2026-10-10).
- **Reach**: Nudges, inventory matches, feed cards (see above).
- **Krews**: whether a project's members should also be a Krew.
- **A Kommons proposal** for the korner, per `docs/korners/adding_a_korner.md`.

## History

Added 2026-10-06 as an iframe prototype, the Dream Web: community dreams,
grown by admin approval. 2026-10-07: plain language and a calmer screen
("a map of community projects"). 2026-10-10: made open (no approval, no
admins, creators choose open or ask-first helpers) and shared through Kronk
accounts. 2026-10-12: Tal set the purpose as a self-organising system for
running projects, modelled on a mini doof and the synergistic audit, with
Kronk building the mechanism natively and Kashka leading the map. The
first native build went to shadow the same day.
