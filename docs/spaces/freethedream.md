# FreeTheDream (`freethedream` — prototype)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** `/hub/freethedream` ·
`enforced: false` (iframe prototype; the mechanism below is decided, not built)

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

### Projects and parts

- A **project** can hold **parts**, and a part is a project in its own right,
  so they nest to any depth (Mini Doof → Live Stage → Lighting).
- A part shares its parent project's membership; it has no join setting of
  its own.
- A project can have an **end** (a date, or a done moment: the doof happens,
  the album is released), or keep going (a communal house). Whoever owns it
  marks it done.

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

Every project, part and item has its own short **comment thread**, so the
talk sits next to the thing it's about.

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

## Today: the prototype

Until the native build lands, `/hub/freethedream` renders Kashka's
self-contained page, `public/freethedream-preview.html`, through
`KornerIframe` (`app/javascript/mastodon/features/freethedream/index.tsx`).
It is a map of project circles drawn on the YOU yin-yang: anyone adds a
project and it is on the map straight away (decision 2026-10-10), the
creator chooses open or ask-first helpers, and visitors can follow.

`public/freethedream-config.js` switches the page to Kronk's backend inside
Kronk: `Api::V1::FreethedreamController` at `/api/v1/freethedream` (`/me`,
`/state`, `PUT /members/me`), storing one JSON document per member in
`freethedream_documents` (`FreethedreamDocument`), with each viewer's view
filtered on the server by `FreethedreamDocument.view_for`. The server checks
that a member writes only their own document, rejects prototype-polluting
keys and unsafe ids, and pulls future `at` stamps back to now. Opened on its
own, the page keeps everything in the browser. The full data shape is in
`FreethedreamDocument` and the PRs #2043 and #2048.

## Open

- **The data model** for the native build: projects, parts, items, shared
  placements, dependencies, inventory and shares.
- **The Syntropic audit itself.** The six categories are a starter set; map
  them to Syntropic World's framework once we have its detail.
- **Harm and spam.** Nothing can take a project down except its creator.
  Deferred by Tal (2026-10-10).
- **Reach**: Nudges, inventory matches, feed cards (see above).
- **Krews**: whether a project's members should also be a Krew.
- **A Kommons proposal** for the korner, per `docs/korners/adding_a_korner.md`.
- **A Content-Security-Policy** for the prototype page while it is live.

## History

Added 2026-10-06 as an iframe prototype, the Dream Web: community dreams,
grown by admin approval. 2026-10-07: plain language and a calmer screen
("a map of community projects"). 2026-10-10: made open (no approval, no
admins, creators choose open or ask-first helpers) and shared through Kronk
accounts. 2026-10-12: Tal set the purpose as a self-organising system for
running projects, modelled on a mini doof and the synergistic audit, with
Kronk building the mechanism natively and Kashka leading the map.
