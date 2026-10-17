# FreeTheDream (`freethedream`)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** `/hub/freethedream` ·
`enforced: true` (native; live on the Hub since 2026-10-13, no feed card yet)

## Purpose

FreeTheDream is **a self-organising system for bringing things to life
together.** People **seed emergences**, and the people who join them
organise the work from the bottom up: anyone in an emergence can coalesce a
gang, say what needs bringing, offer what they have and bring an idea to
life. Nobody approves from above.

**The words** (Tal, 2026-10-15). The nucleus is the people creating
something, not the thing itself, so the words name the people:

| Say                                    | Not                      | In the code                         |
| -------------------------------------- | ------------------------ | ----------------------------------- |
| **emergence**; you **seed** one        | project; start a project | a top-level `Freethedream::Project` |
| **gang**; you **coalesce** one         | working group, section   | a `Project` with a `parent`         |
| **fractal** (a piece of a gang)        | section                  | a `Project` under a gang            |
| **Thing Bringing** (gear and supplies) | Gear & supplies, needs   | `Item` kind `need`                  |
| **Actualise** (bring an idea to life)  | Jobs, Ideas              | `Item` kind `job`, `Claim`          |
| **actualiser**; you **jump on board**  | claim a slot             | `Claim`                             |
| **On offer**                           |                          | `Item` kind `offer`                 |
| **Krew** (the emergence's people)      | Dreamers                 | the `Krew` it was made with         |

It is built on a syntropic framework: collaboration is contributor-driven,
and the **synergistic audit** (from Syntropic World) shows what the community
already has against what its projects need.

The working model is an **in-person mini doof**. Someone seeds _Mini Doof_.
Someone else wants a live stage, so they coalesce the _Live Stage_ gang,
list what needs bringing (a PA, lighting, a generator) and add to Actualise
what they'd love to see (a fire twirler at sunset), which puts them on it.
Others join, say they'll bring their generator, and jump on board the fire
twirler.

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
| **Spaces** | Where does this live?            | An emergence and its gangs; cover; what depends on what                               | `freethedream_projects`, `_dependencies`                             |
| **People** | Who's in, and what are they on?  | Joining, asking to join, inviting, handing over; the emergence's Krew                 | `freethedream_memberships`, `krews` (`krew_id`)                      |
| **Work**   | What's needed, and who has it?   | Thing Bringing, Actualise, On offer; bringing and jumping on board; inventory, audit  | `freethedream_items`, `_placements`, `_claims`, `_assets`, `_shares` |
| **Talk**   | What's been said and done?       | Threads on a space or an item; Updates; what's new to you                             | `freethedream_comments`, `_activities`, `_reads`                     |
| **Links**  | What does Kronk already do here? | The Kalendar event (date, place, RSVP), the Map pin, Nudges for invites; nothing kept | `korner_attachments`, the `freethedream.project.invited` event       |

What's yours on an emergence's page is not a sixth area: it reads the other
five for one person
(`Freethedream::View#mine`). The same goes for Still needed.

### Emergences, gangs and fractals

- An **emergence** holds **gangs** (Kitchen, Sound, Wash station), and a
  gang holds **fractals**: the pieces of the pie that make up the gang as
  a whole (Kitchen → Cooking, Cleaning, Storage, Logistics; Tal,
  2026-10-15). A fractal holds nothing; the server refuses anything
  inside one. The code calls all three projects (`Freethedream::Project`,
  `#gang?`, `#fractal?`; the shape's `level`).
- Gangs and fractals share their emergence's membership; they have no join
  setting of their own. **Nobody leads a gang**: who's in it is whoever has
  a hand in it (coalesced it, or added, brings or is actualising anything
  in it).
- An emergence can have an **end** (a date, or a done moment: the doof happens,
  the album is released), or keep going (a communal house). Whoever owns it
  marks it done.
- For an **in-person event**, the project links a **Kalendar event**, which
  holds the date, the place (a map pin) and the RSVPs. The link is a korner
  attachment from the event (`kalendar → freethedream`), and only an event
  made by someone in the project counts.
- Every project can have a **cover photo**.
- **Meals.** A meal (Dahl for 40) is something in the Kitchen gang's
  Actualise, and its ingredients go in Thing Bringing ("5 kg lentils"), so
  people bring them without doubling up.

### The Krew

Everyone in an emergence is in **its Krew** (Tal, 2026-10-15). The Krew is
made when the emergence is seeded (`Project#ensure_krew!`; emergences seeded
before then got theirs in `20261015130200_make_freethedream_krews`), named
after it, seeded by its owner, and **open** or **Ask to join** to match the
emergence. It's a real Krew: its page, its chat in Nudges, posting to it.

**The two hold the same people, both ways** (Tal: two-way). Joining the
emergence puts you in the Krew and leaving takes you out
(`Freethedream::Membership`); joining the Krew, from its page, an invite or
its link, joins the emergence, and leaving the Krew leaves it
(`KrewMembership`). Each side checks before it acts, so they don't loop.
Leaving either takes you off what you were actualising and takes your
shared inventory out. Removing the emergence archives its Krew. The
landing page's **Krew** row links to the Krew's page.

### Crossover

Pieces of a project overlap, and the model holds that both ways:

- **Shared items.** Something to bring, to actualise or on offer can sit in
  several gangs at once. _Generator_ is one thing to bring, shown under
  Live Stage and Kitchen; one offer covers both.
- **Dependencies.** A gang can depend on another gang. _Power_ is its own
  gang, and Live Stage and Kitchen depend on it.

### The kinds of item

| List               | What it is                                                     | How people take part                                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Thing Bringing** | Gear and supplies needed (a need)                              | People bring part or all of it. Money is just another thing to bring ("$400 for permits"): pledges are tracked here, and the money moves outside Kronk.                                                                                                                          |
| **Actualise**      | An idea to bring to life (a job): a spit roast, a fire twirler | **Whoever adds it is on it**, its first actualiser. It's **open-ended**: anyone can **jump on board** and help organise it, however many are on it already, and step off again. With nobody on it, it shows in Still needed.                                                     |
| **On offer**       | Something someone can bring (an offer)                         | Against a thing to bring, or on its own. It counts **at once** and shows who is bringing what (partly, too: $150 of $400). Offers past what's needed show as **spares**, never blocked. On offer is going to tie into the synergistic audit (Tal, 2026-10-15); that comes later. |

**There are no Ideas** (Tal, 2026-10-15): someone with an idea becomes its
actualiser by adding it to Actualise, and others jump on board. Ideas
nobody had taken on became Actualise items with their owner on them
(`20261015130100_turn_freethedream_ideas_into_actualise`); ideas already
taken on stay in the table as `idea` rows and don't show. Actualise items
have no headcount: "2 set-up crew" is just a title.

**Bringing is one tap, less about numbers** (Tal, 2026-10-15). The list
says _Pots_; someone who can bring one taps **I'll bring it**, and the row
shows who's bringing ("Jo · Sam"). Bringing two is extra and great, with
no need to say so. Tap **Bringing ✓** to take it back. Something to bring
counts as **gathered once anyone is bringing it**, whatever the amount. An
amount typed when adding ("30 plates") stays on the row as a hint. (The
API still takes an amount, `POST /items/:id/bring` with `quantity`; the
page sends 1 or 0.) A comment on what you're bringing is for later.

### The page

Decided by Tal, 2026-10-13: simple, clean, and adding things has to be easy.
**An emergence is one page**, built phone first (Tal, 2026-10-15). It was split into Overview and Kontribute for
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
  **New talk**, the gangs with talk from other people they haven't
  looked at, with a count (opening a gang clears its count); and **On
  you**, what they're actualising and what they're bringing.
- **Gangs** as tiles, each with how many people have a hand in it and its
  progress ("3 of 8 sorted"). **Nobody leads a gang**, so no owner shows on
  a tile or a gang's page (the owner still exists in the data, for who may
  edit it). The gangs you have a hand in come first, tagged with any new
  talk. Members get **+ Coalesce a gang**.
- **Get involved**: a row of cards you **swipe sideways** (scroll-snap; the
  next card peeks in at the edge): **Still needed**, **Thing Bringing**
  ("Gear and supplies needed"), **Actualise** ("Bring an idea to life")
  and **On offer**, each with a count. Each opens its own page,
  `/p/:id/needed`, `/bring`, `/actualise`, `/offers` (the old `/gear`,
  `/jobs` and `/ideas` redirect).
- **Krew**: everyone in the emergence as larger cards in a row you scroll
  sideways, **whoever did something in it most recently first**, each with
  what they're on (actualising 2, bringing 3 things) and when they were
  last active, and **Open the Krew** to its page. Doing something is an
  update (adding, bringing, jumping on board, marking done), a comment, or
  joining. Looking at a page is not counted: that would be watching people.
- **Activity**: the latest eight things that happened, with who did them
  ("Isabelle is bringing 2 speakers", "Tomas coalesced the gang
  Ceremony"). It keeps itself up to date while the page is open and in
  view (every 20 seconds, from `GET /projects/:id/activity`), and new
  lines fade in.
- **Beside it** (below it, on a phone): the **event card** (name into
  Kalendar, map pin, who's going, your RSVP; the owner sees **Make the
  event** or **Link one of your events** until there is one), **Asking to
  join** for the owner, and **Join** (or Ask to join). Then Talk and the
  owner's actions. To bring someone in, **Share** the emergence from the
  Ж menu; there is no Invite (Tal 2026-10-17: "no invite anywhere, only
  share"). `POST /projects/:id/invite` stays for now, unused by the web.

**A list's page** (`/p/:id/actualise` and the like) is that list in full:
what's on the emergence itself, a one-line box to add to it (type "30
plates" in Thing Bringing or "a spit roast" in Actualise, press Enter, and
the box stays open for the next one), then what's in each gang, under its
name. Still needed is every thing to bring not yet covered and every
Actualise item with nobody on it, each saying which gang it's in, with one
tap to Bring or Jump on board.

**A gang's page** is its overview at a lower level (Tal, 2026-10-15), and
the place the work is done:

- **Who's in it** comes first: everyone with a hand in the gang, side by
  side, each with what they're bringing and actualising there ("Bringing
  pots, gas · Actualising dahl for 40"), whoever is on the most first.
- The meta line under the title says **how much gear is gathered** ("12 of
  20 gear gathered").
- **Fractals** as tiles (people, progress), each opening its own page;
  members get **+ Add a fractal**.
- **Thing Bringing**, **Actualise** and **On offer** in full: what's on the
  gang itself (**For all of Kitchen**: power, water, what every fractal
  uses), then each fractal under its name. Each row says who's on it, with
  one tap to bring or jump on board, and a one-line box adds to the list.
- What it depends on, and its Activity, Talk and the owner's actions
  beside.

**A fractal's page** is the same, without fractals of its own; its back
chip goes to its gang.

- **Lists roll up.** The emergence's list is everything in it: first **For
  all of Mini Doof**, what's placed on the emergence itself, which is
  where power, lighting and water go (what several or all of its gangs
  use); then each gang, under its name.
- **Coalescing a gang** takes its name, what it's about, its **first
  fractals** and **what all of it needs**, one per line, so a gang is set
  up in one step. A gang has no date. After adding, you stay where you
  were, ready to coalesce the next one. **Seeding an emergence** takes its
  first gangs and gear the same way; **adding a fractal**, its gear.
- **Talk** (below).

Edit (including the cover) is on the Ж menu, owner only.

**Layout.** Emergence, gang, item and audit pages use `<KornerDetail>`:
the cover as its hero, the centred purple title, a `<KornerMeta>` line and
`<KornerPill>` actions. On a wide Stage (frame ≥ 1000px) an emergence page
widens to 72rem: what's yours and the gangs (a grid of tiles) across the
top, then a main column (on an emergence: Get involved, Krew, Activity; on
a gang: its lists) and a side column (event, joining, Talk, the owner's
actions; on a gang, Activity and Talk). On a phone it is one column, main
first. The emergence list is a grid of cover cards;
Inventory a reading column.

### Talk

Every emergence, gang and item has its own **threads**. A thread has
replies under it, and replies can be answered in turn. Anyone in the
emergence can **resolve** a thread once it's settled; resolved threads fold away under
"3 resolved threads", and can be reopened.

Why threads that resolve, not messaging (Tal, 2026-10-13): people get
overwhelmed by the volume of messages and stop engaging, and once 300
messages have stacked up nobody can tell what's happening or what they've
missed. FreeTheDream is meant to take the weight off messaging: what's
needed lives in the lists, what's changed lives in Updates, and Talk holds
only what's still being worked out.

### Who can do what

- **Joining.** The seeder chooses per emergence: open to anyone, or by
  request. Joining or leaving its Krew does the same (see The Krew).
- **Inside an emergence, anyone who has joined** coalesces gangs and adds
  to Thing Bringing, Actualise and On offer. Whoever adds something
  **owns** it. Nobody has a veto over anyone else's piece, the seeder
  included.
- **Ownership moves.** An owner can hand something to another member. If an
  owner leaves, what they made stays, and anyone in the emergence can take
  it over.

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

- Nudges beyond the project invite, inventory matching ("Live Stage
  needs a generator; you have one") and feed cards. The first build is the
  space itself; reach comes after. The one Nudge built is **Invite to have
  a look** (`freethedream.project.invited`, see The build split).
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
  update, remove, claim, unclaim, take over, hand over),
  placements, comments and assets (with share and unshare). Every shape is
  built for its viewer by `Freethedream::View`, including a `can` block
  saying what they may do. Specs:
  `spec/requests/api/v1/freethedream/mechanism_spec.rb`.
- **Page** (`features/freethedream/`): the Frame's view picker over **All
  emergences**, **Mine** and **Inventory**; detail routes for a project or
  section (`/p/:id`), its audit (`/p/:id/audit`) and an item (`/i/:id`).
  "Seed an emergence" is the Ж menu's compose route (`/composer`). Lists add
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
  lists in `work.tsx`); the Krew row in `krew_row.tsx`. Specs:
  `overview_spec.rb`, "who's in it" and "the activity".
- **Emergences** (2026-10-15, `20261015130000`–`20261015130200`): the
  words above; `krew_id` on projects (`Project#ensure_krew!`,
  `#add_member!`, `#remove_member!`; `Membership` and `KrewMembership`
  keep the two in step) and `krew` on the emergence shape; Actualise
  open-ended (adding a job claims it for its adder, `Item#actualised?`,
  `Claim` has no cap, `progress.open_jobs` counts items with nobody on
  them); no new ideas, `take_on` gone. Get involved swipes sideways.
  Specs: `mechanism_spec.rb`, "the Krew".
- **Gang pages** (2026-10-15): fractals (`Project#gangs_and_fractals_only`;
  `sections` on create seeds an emergence's gangs or a gang's fractals);
  the gang and fractal shapes add `level`, `crew` (`View#crew`) and `gear`
  (`View#gear`); `Item#sorted?` for a need is anyone bringing it. Page:
  `crew.tsx`, the gang branch of `project_page.tsx`, one-tap
  `BringControl` (`bring.tsx`). Specs: `coordination_spec.rb`, "a gang's
  page".

Rules the server holds, whatever the page sends:

- Only members coalesce gangs, add items, placements, dependencies and
  comments, or jump on board.
- Only an owner edits, hands over or removes their own thing. A project
  or part can be removed only when nobody else has anything in it.
- Whoever adds to Actualise is on it; anyone else can jump on board, with
  no cap. No new ideas. A fractal holds nothing. Something to bring is
  gathered once anyone is bringing it; an offer counts against it at
  once.
- Dependencies stay inside one project and can't loop.
- A reply stays on its thread's subject. Taking back a comment someone has
  replied to keeps the replies; only its words go.
- An inventory item can be shared only into a project its owner is in.
  Leaving an emergence (or its Krew) takes your shares out and takes you
  off what you were actualising. Only members see the audit.

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
- **Reach**: Nudges beyond the project invite, inventory matches, feed
  cards (see above).
- **Two ways to ask.** An emergence "by request" has its own requests
  (the owner accepts) and its Krew has Krew join requests (any Krew member
  accepts). Either way in joins both; whether one queue should go is
  open.
- **On offer and the audit.** On offer is to tie into the synergistic
  audit (Tal, 2026-10-15); not designed yet.
- **Rename in code?** Emergence and gang are only in copy; the code,
  tables, API and CSS still say project and section.
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
