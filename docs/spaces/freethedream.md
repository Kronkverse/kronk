# FreeTheDream (`freethedream`)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** `/hub/freethedream` ·
`enforced: true` (native; live on the Hub since 2026-10-13, no feed card yet)

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

### The five areas

Everything in the mechanism belongs to one of five areas. Keep new work
inside one of them, and name which (Tal, 2026-10-13: "group the different
areas and functionalities in a way that can help keep track").

| Area       | What it answers                  | Holds                                                                                 | Tables                                                               |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Spaces** | Where does this live?            | A project, its working groups, their sections; cover; what depends on what            | `freethedream_projects`, `_dependencies`                             |
| **People** | Who's in, and what are they on?  | Joining, asking to join, inviting, leading, handing over                              | `freethedream_memberships`                                           |
| **Work**   | What's needed, and who has it?   | Needs, jobs, ideas, offers; bringing and claiming; inventory and the audit            | `freethedream_items`, `_placements`, `_claims`, `_assets`, `_shares` |
| **Talk**   | What's been said and done?       | Threads on a space or an item; Updates; what's new to you                             | `freethedream_comments`, `_activities`, `_reads`                     |
| **Links**  | What does Kronk already do here? | The Kalendar event (date, place, RSVP), the Map pin, Nudges for invites; nothing kept | `korner_attachments`, the `freethedream.project.invited` event       |

What's yours on a project's page is not a sixth area: it reads the other
five for one person
(`Freethedream::View#mine`). The same goes for Still needed.

### Projects and sections

- A **project** can hold **sections**, and a section is a project in its own
  right, so they nest to any depth (Mini Doof → Kitchen → Wash station).
  The code calls them parts (`Freethedream::Project` with a `parent`).
- A section shares its project's membership; it has no join setting of its
  own.
- A project can have an **end** (a date, or a done moment: the doof happens,
  the album is released), or keep going (a communal house). Whoever owns it
  marks it done.
- For an **in-person event**, the project links a **Kalendar event**, which
  holds the date, the place (a map pin) and the RSVPs. The link is a korner
  attachment from the event (`kalendar → freethedream`), and only an event
  made by someone in the project counts.
- Every project can have a **cover photo**.
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
**A project is one page.** It was split into Overview and Kontribute for
half a day; Tal the same day: "we can probably just do it all from the one
page". `/p/:id/kontribute` redirects to `/p/:id`.

**The landing page** (Tal, 2026-10-15) is for getting your bearings and
getting involved, not for doing the work itself:

- **Header**: the cover photo (or the event's image), the title, what it's
  about directly under it, then one quiet line: when and where, from the
  Kalendar event (the place linked to its pin on the Kronk Map,
  `/hub/map?event=<slug>`). No creator, no people count, no "By" date, no
  sorted bar.
- **What's yours** (a member, each only when there's something in it):
  **New talk**, the sections with talk from other people they haven't
  looked at, with a count (opening a section clears its count); and **On
  you**, the jobs they've taken and what they're bringing.
- **Working groups** as tiles, each with how many people have a hand in it
  and its progress ("3 of 8 sorted"). **Nobody leads a working group**, so
  no owner shows on a tile or a section's page (the owner still exists in
  the data, for who may edit it). The groups you have a hand in come first,
  tagged with any new talk. Inside a group they're called sections.
- **Get involved**: one card each for **Still needed**, **Gear &
  supplies**, **Jobs**, **Ideas** and **On offer**, with a count and a
  line saying what's there ("Got gear? See what's needed"). Each opens its
  own page, `/p/:id/needed`, `/gear`, `/jobs`, `/ideas`, `/offers`, so
  someone looking for something to do goes to Jobs and someone with gear
  goes to what's needed.
- **Dreamers**: everyone in the project as larger cards in a row you
  scroll sideways, **whoever did something in it most recently first**,
  each with what they're on (2 jobs, bringing 3 things) and when they were
  last active. Doing something is an update (adding, bringing, claiming,
  marking done), a comment, or joining. Looking at a page is not counted:
  that would be watching people.
- **Activity**: the latest eight things that happened, with who did them
  ("Isabelle is bringing 2 speakers", "Tomas started a new working group:
  Ceremony"). It keeps itself up to date while the page is open and in
  view (every 20 seconds, from `GET /projects/:id/activity`), and new
  lines fade in.
- **Beside it** (below it, on a phone): the **event card** (name into
  Kalendar, map pin, who's going, your RSVP; the owner sees **Make the
  event** or **Link one of your events** until there is one), **Asking to
  join** for the owner, **Join** (or Ask to join) and, for members,
  **Invite to have a look**: a Nudge linking to the project. Joining stays
  the invited person's choice. Then Talk and the owner's actions.

**A list's page** (`/p/:id/jobs` and the like) is that list in full: what's
on the project itself, a one-line box to add to it (type "30 plates" or
"2 set-up crew", press Enter, and the box stays open for the next one), then
what's in each section inside, under that section's name. Still needed is
every need not yet met and job not yet filled anywhere inside, each saying
which section it's in, with one tap to Bring or Claim.

**A section's page** keeps its work on the page: its sections as tiles, its
sorted bar, then every list in full (Still needed only when it has sections
inside), what it depends on, and its Activity and Talk beside.

- **Lists roll up** (Tal, 2026-10-13, for gear; since 2026-10-15 every
  list). A section's list is everything under it: first **For all of
  Kitchen**, what's placed on the section itself, which is where power,
  lighting and water go (what several or all of its sections use); then
  each section inside, under its name.
- **Adding a section** takes its name, what it's about, the **sections
  inside it** (Cooking, Washing up, Food, Storage, Eating) and **what all
  of it needs**, one per line, so a section is set up in one step. A
  section has no date. After adding, you stay where you were, ready to add
  the next one. Starting a project takes its first working groups and
  gear the same way.
- **Talk** (below).

Edit (including the cover) is on the Ж menu, owner only.

**Layout.** Project, section, item and audit pages use `<KornerDetail>`:
the cover as its hero, the centred purple title, a `<KornerMeta>` line and
`<KornerPill>` actions. On a wide Stage (frame ≥ 1000px) a project page
widens to 72rem: what's yours and the working groups (a grid of tiles)
across the top, then a main column (on a project: Get involved, Dreamers,
Activity; on a section: its lists) and a side column (event, joining,
Talk, the owner's actions; on a section, Activity and Talk). On a phone
it is one column, main first. The project list is a grid of cover cards;
Inventory a reading column.

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
  **Hidden for now** (2026-10-14): the page and its route
  (`/p/:id/audit`) are still there, but nothing links to it while it is
  reworked. Needs added from a list carry no category, so it shows little.

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
- **Overview** (2026-10-13,
  `db/migrate/20261013160000_add_cover_to_freethedream_projects.rb`):
  `cover_media_attachment_id` on projects (an image the person setting it
  uploaded); `Project#event_link` finds the linked Kalendar event, and the
  project shape adds `cover`, `event` (with your RSVP) and `can.invite` /
  `can.link_event`. `POST /projects/:id/invite` publishes
  `freethedream.project.invited`, which Nudges delivers (directed). The
  manifest's primary resource is `freethedream/projects` so
  `KornerRegistry.model_for` finds `Freethedream::Project`, and it accepts
  links from any korner. `starts_on` and `location` are ignored on the model;
  drop them in a later migration. Page: `overview.tsx`, `event_card.tsx`,
  `invite.tsx`; `/p/:id` is the project's one page (`/p/:id/kontribute`
  redirects to it), and
  `/hub/freethedream/:id` (where attachments link) redirects to `/p/:id`.
  Specs: `spec/requests/api/v1/freethedream/overview_spec.rb`. The project
  shape's `people` (each member with `organiser`, `leads`, `jobs`,
  `bringing`) and each section row's `people_count` feed the page's
  People and working-group tiles (`groups.tsx`).
- **The dashboard** (2026-10-13,
  `db/migrate/20261013190000_create_freethedream_reads.rb`):
  `freethedream_reads` keeps when each person last looked at a space's talk
  (`POST /projects/:id/seen`, sent when its page opens). The project
  shape's `mine` (members, top level) carries `groups`, `unseen`, `jobs`,
  `bringing`, `needed` and `needed_count`. New talk counts comments on the
  project or a section, from someone else, since the viewer's last look or
  since they joined; comments on items are not counted yet.
- **One-step sections and rolled-up gear** (2026-10-13): `POST /projects`
  also takes `sections` (names) and `needs` (`title`, `quantity`, `unit`),
  up to 20 of each, made with the project in one transaction. The project
  shape's `inside` lists what's in the sections inside (every kind),
  section by section. Specs: `coordination_spec.rb`, "setting up a section
  in one step".
- **The landing page** (2026-10-15): `people` rows carry `last_active`
  (latest update or comment anywhere in the project, else joining) and
  come newest first; `GET /projects/:id/activity` returns the updates
  alone for the page to poll. List pages at `/p/:id/:list` (`work_page.tsx`,
  lists in `work.tsx`); Dreamers in `dreamers.tsx`. Specs:
  `overview_spec.rb`, "who's in it" and "the activity".

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
- **Feed card.** The korner went live on the Hub on 2026-10-13 (Tal) with
  no feed card: projects don't post to the feed. Its settings page is the
  shared `/hub/:slug/settings`.
- **The Syntropic audit itself.** The six categories are a starter set; map
  them to Syntropic World's framework once we have its detail.
- **Harm and spam.** Nothing can take a project down except its creator.
  Deferred by Tal (2026-10-10).
- **Reach**: Nudges, inventory matches, feed cards (see above).
- **Krews**: whether a project's members should also be a Krew.
- **Split the code by the five areas.** `Freethedream::View` (one file)
  and `project_page.tsx` hold all five; split them along the areas.
- **New talk on items.** Comments on an item don't count as new talk yet.
- **Drop `starts_on` and `location`** from `freethedream_projects` (ignored
  since 2026-10-13).
- **A Kommons proposal** for the korner, per `docs/korners/adding_a_korner.md`.

## History

Added 2026-10-06 as an iframe prototype, the Dream Web: community dreams,
grown by admin approval. 2026-10-07: plain language and a calmer screen
("a map of community projects"). 2026-10-10: made open (no approval, no
admins, creators choose open or ask-first helpers) and shared through Kronk
accounts. 2026-10-12: Tal set the purpose as a self-organising system for
running projects, modelled on a mini doof and the synergistic audit, with
Kronk building the mechanism natively and Kashka leading the map. The
first native build went to shadow the same day. 2026-10-13: reshaped for
in-person events (sections, bring, units, updates, threads that resolve),
then split into an Overview (cover, Kalendar event, people, invites) and
Kontribute (the work), and put back on one page the same day.
