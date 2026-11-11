# FreeTheDream (`freethedream`)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** under its Krew, `/hub/krew/<krew>/p/<projekt>` ·
`enforced: true` (native; live since 2026-10-13, no feed card yet) ·
`hub_visible: false` (off the Hub and the rail since 2026-10-30: emergences
live inside Krews and are reached from a Krew's page)

**Called Projekts on screen** since 2026-10-30 (Tal): the space is
**Projekts** and one of its records a **projekt** (`konnect.noun`), in
the manifest and every string. FreeTheDream, emergence and `Project` stay
the names in code, routes and the database, and in this doc. The Konnect
picker offers projekts only, not their gangs and fractals
(`Freethedream::Project.attachment_candidates`); a gang already Konnected
still opens by its id.

## Purpose

FreeTheDream is **a self-organising system for bringing things to life
together.** People **seed emergences**, and the people who join them
organise the work from the bottom up: anyone in an emergence can coalesce a
gang, say what needs bringing, offer what they have and bring an idea to
life. Nobody approves from above.

**Any kind of shared effort** (Tal, 2026-10-30). A projekt is not only an
in-person event: it can be a gathering, a creative work, a tool being built
(the Mainframe Krew with gangs for the app and for shadow) or an
organisation taking shape (gangs for its constitution and its
incorporation). Nothing in the mechanism assumes a date or a place, so the
words don't either. A date is **When (optional)** in Edit, for a day it
happens or is due, **What it needs** asks for things, skills, time, money
or space (the item categories), and an event is an offer on the Overview
(**Getting together for it?**), not a given. Write new copy the same way:
no example or label that only fits a party.

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
| **Krew** (the emergence's people)      | Dreamers                 | the `Krew` it lives in (`krew_id`)  |

It is built on a syntropic framework: collaboration is contributor-driven,
and **Mycelium** (Syntropic World's synergistic audit, Tal 2026-10-19) is
where people list what they have and where it meets what emergences need.

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

| Area       | What it answers                  | Holds                                                                                  | Tables                                                            |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Spaces** | Where does this live?            | An emergence and its gangs; cover; what depends on what                                | `freethedream_projects`, `_dependencies`                          |
| **People** | Who's in, and what are they on?  | Joining, asking to join, handing over; the emergence's Krew                            | `freethedream_memberships`, `krews` (`krew_id`)                   |
| **Work**   | What's needed, and who has it?   | Thing Bringing, Actualise, On offer; bringing and jumping on board; Mycelium           | `freethedream_items`, `_placements`, `_claims`, `_mycelium_items` |
| **Talk**   | What's been said and done?       | Threads on a space or an item; Updates; what's new to you                              | `freethedream_comments`, `_activities`, `_reads`                  |
| **Links**  | What does Kronk already do here? | The Kalendar event (date, place, RSVP), the Map pin, Nudges for mentions; nothing kept | `korner_attachments`, the `freethedream.comment.mentioned` event  |

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
  made by someone in the project counts. A gang can link its own. The event
  shows on the emergence's Krew too, and unlinking it from either takes it
  off both (`Kronk::EventLinks`, docs/spaces/krew.md, Linking).
- An **emergence** can have a **cover photo** (its owner sets it in Edit).
  Gangs and fractals have none of their own and their pages show no hero.
  Without a cover, the emergence's page and its tile in the list show the
  linked Kalendar event's image instead (`Freethedream::View#image_url`,
  only when the viewer can see that event).
- **Meals.** A meal (Dahl for 40) is something in the Kitchen gang's
  Actualise, and its ingredients go in Thing Bringing ("5 kg lentils"), so
  people bring them without doubling up.

### The Krew

**An emergence lives in a Krew, and a Krew can hold several** (Tal,
2026-10-30, the proposals "More interconnectedness with krew space" and
"Access of a FTD space"). The Krew is the home: its page shows its
emergences in their own Projekts section, whose **New projekt** card (or
**Konnect → New projekt**) opens the composer with `?konnect=krew:<id>`
(docs/spaces/krew.md, The surfaces). The composer asks which of your
Krews it lives in (`krew_id`, required for a new emergence; only an active
Krew you're in), and the server Konnects the two
(`Project#join_krew_members!`, `Kronk::AttachmentEffects.link!`). That link
can't be taken off (`Kronk::ProjektLinks`), as a Krew album's can't.

**A projekt lives inside its Krew, not in a space of its own** (Tal,
2026-10-30). Its pages are under the Krew: `/hub/krew/<krew>/p/<projekt>`
(a gang's and a fractal's too, `…/p/<projekt>/<list>` for a list of its
work) and `/hub/krew/<krew>/i/<item>`, so they wear the Krew's badge and
back goes to the Krew (a gang's to its projekt). There is no list of every
projekt and no settings page: `/hub/freethedream`, its views and
`/hub/freethedream/settings` go to your Krews. The composer is
`/hub/krew/composer/projekt` (the manifest's `compose.route`), over the
Krews page; the Krew page's New projekt and the Konnect picker's **Seed a
projekt** open it with `?konnect=krew:<id>`, which is the Krew it lives in,
and Cancel goes back there. The
korner itself stays, out of sight (`hub_visible: false`): its manifest is
what Konnect, link previews and search read. Addresses the server makes
(`path:` on the primary resource, notifications) are still
`/hub/freethedream/p/<id>` and `/i/<id>`; the page moves them under the
Krew once it knows it (`useKrewAddress`, from `krew` on a projekt and
`krew_slug` on an item or a list row).

Until 2026-10-30 it was the other way round: seeding an emergence made a
Krew of its own, named after it (`Project#ensure_krew!`, still there for an
emergence that somehow has none). Those Krews stay, each holding the
emergence it was made with, and `20261030180000_konnect_projekts_to_their_krews`
Konnected each pair so their Krew pages show them.

**The Krew's people are the emergence's people.** Everyone in the Krew is
in each of its emergences: a new emergence starts with all of them, and
joining the Krew, from its page, an invite or its link, joins every
emergence in it (`KrewMembership#join_emergence`). Joining from an
emergence's page joins the Krew (`Freethedream::Membership#join_krew`).
Leaving is the Krew's: an emergence page has no Leave, and leaving the
Krew leaves every emergence in it, taking you off what you were
actualising and out of what you shared from your Mycelium. Removing an
emergence leaves its Krew as it is. The landing page's **Krew** row links
to the Krew's page (**Open the Krew**), and the Krew's page leads back
through the emergence's tile in its Spaces (Tal's proposal "'Open the
Krew' Button", 2026-10-30).

**Who sees it follows the Krew** (Tal, 2026-10-30). An emergence in a
listed Krew (open, Ask to join, or with requirements) can be looked at by
anyone signed in, and only its people act in it; one in an invite-only Krew
is as if it weren't there to anyone outside (`Project#visible_to?`; 404 on
its page, its items and Join, and left out of All emergences). The way in
is the Krew's too (`Project#joining_via_krew`, the `joining` field): **Join
{Krew}** for an open Krew, **Ask to join {Krew}** for an Ask-to-join one,
and **Open the Krew** for the rest, which are joined from the Krew's page.

**One list of requests** (Tal, 2026-10-19: err syntropic). Asking to join an
emergence in an Ask-to-join Krew is a request to that Krew (`Project#ask_to_join!`),
whether asked on the emergence's page or the Krew's, and everyone in hears.
Anyone in can let them in or say not now, from either page; the
emergence's **Asking to join** panel is the Krew's list. Requests made on
the emergence page before then moved over in
`20261019200000_move_freethedream_requests_to_krews`.

### Crossover

Pieces of a project overlap, and the model holds that both ways:

- **Shared items.** Something to bring, to actualise or on offer can sit in
  several gangs at once. _Generator_ is one thing to bring, shown under
  Live Stage and Kitchen; one offer covers both.
- **Dependencies.** A gang can depend on another gang. _Power_ is its own
  gang, and Live Stage and Kitchen depend on it.

### Kinds

A projekt's **kind** is picked first when it's seeded, one large choice
each with a line under it (`kind_chooser.tsx`, as Wachuneed's What are you
offering?), and changed in Edit (decisions.md, 2026-11-10). The eight:
Gathering, Creation, Build, Organisation, Governance, Mutual aid,
Learning, Campaign (`Project::KINDS`, `kinds.ts`). Older projekts have
none. **+ Add a Komponent** offers names the kind suggests, to tap
(Gathering: Site, Kitchen, Sound, On the day; Build: Materials, Stages,
Tools; …). A Komponent's page reads its projekt's kind.

### The checklist

A Komponent's page (and a fractal's) leads with its **checklist**
(`checklist.tsx`; Tal, 2026-11-10). One list, what's not done first, each
entry a kind with its own action:

- **To do** (a `job` item): a tick anyone in the projekt can tick or
  untick (`POST /items/:id/done`, `/undone`, `done_at`), and **I'm on it**
  for whoever is doing it (a claim), their pictures beside it. Adding one
  doesn't put you on it. It counts as sorted once ticked.
- **Bring** (a `need`): "I'll bring it", as before (`BringControl`).
- **Pay** and **Book** (decisions.md, 2026-11-11): To dos of their own kind
  (`items.task`: `todo`, `pay`, `book`), ticked and claimed the same way
  but saying so: "I'll pay it" and Paid, "I'll book it" and Booked. A Pay
  can have an amount in dollars, kept as the item's quantity with unit `$`
  ("$200 hall deposit", or 200 in the How much box), and the list says
  what there is to pay and how much of it is paid. Money still moves
  outside Kronk. Paying is one person settling a bill; chipping in towards
  something is still a Bring of "$400 for permits".
- **Decide** (decisions.md, 2026-11-11): a To do (`task` `decide`) settled
  by a quick Kuestion asked in the Komponent (`items.question_id`), so it
  is in the Komponent's Kuestions too. Its choices go in the Choices box
  ("Sat, Sun", two to four), or none for Yes or No. Everyone in the
  projekt picks one, or changes their pick, right on the entry, which
  shows how many picked each. Anyone ticks it once it's decided, and it
  reads "Decided: Sun" for the choice most picked. Taking the entry off
  takes its Kuestion with it.

Entries go in one line at a time under the list, with To do, Bring, Pay,
Book or Decide picked from a dropdown beside the box (`QuickAdd`), each
kind with its icon, which its entries show too. No pills: Tal, 2026-11-11,
"i really really dont like the pill situation".

### The kinds of item

| List               | What it is                                                     | How people take part                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Thing Bringing** | Gear and supplies needed (a need)                              | People bring part or all of it. Money is just another thing to bring ("$400 for permits"): pledges are tracked here, and the money moves outside Kronk.                                                                                                               |
| **Actualise**      | An idea to bring to life (a job): a spit roast, a fire twirler | **Whoever adds it is on it**, its first actualiser. It's **open-ended**: anyone can **jump on board** and help organise it, however many are on it already, and step off again. With nobody on it, it shows in Still needed.                                          |
| **On offer**       | Something someone can bring (an offer)                         | What people have shared from their **Mycelium** (below): sharing is offering. Against a thing to bring, or on its own. It counts **at once** and shows who is bringing what (partly, too: $150 of $400). Offers past what's needed show as **spares**, never blocked. |

**There are no Ideas** (Tal, 2026-10-15): someone with an idea becomes its
actualiser by adding it to Actualise, and others jump on board. Ideas
nobody had taken on became Actualise items with their owner on them
(`20261015130100_turn_freethedream_ideas_into_actualise`); ideas already
taken on stay in the table as `idea` rows and don't show. Actualise items
have no headcount: "2 set-up crew" is just a title.

**Bringing: one tap for one thing, a number for many** (Tal, 2026-10-15,
refined 2026-10-17 to 19). A need for one thing (_Gas bottle_, _Pots_) is
one tap: **I'll bring it**, and **Bringing ✓** takes it back; bringing two
is extra and great, with no need to say so. A need with an amount ("2 gas
bottles", "5 kg rice": the quick add line has a **How many** box beside
it, Tal 2026-10-19, and so does each of a new gang's or fractal's needs
boxes; _kg rice_ with 5 is 5 kg of rice; typing `2 gas bottles` straight
in still works, and a filled box wins) asks **I'll
bring some** and opens a small − 8 + stepper, so the row can say "12
coming · Sam 8 · Jo 4". **More is welcome only where it is**: more is
better at an event as a general idea, not a rule ("we don't need 20 gas
bottles"), so whoever adds a need says. Once a line being typed has an
amount, a **+ More welcome** toggle shows beside it (quick add and the
needs boxes); it puts the + after the number or takes it out, so typing
`20+ plates` does the same. The item composer has a **More is welcome**
box. Either sets `more_welcome`, and the amount shows as **20+**;
otherwise it shows as typed. The thing counts as
**sorted once that many are coming** (`Item#sorted?`, `covered >= quantity`). Sorted things sink to the bottom
of Thing Bringing, quieter, with a _Sorted_ tag; more is still welcome.
`POST /items/:id/bring` takes `quantity` (0 takes it back). A comment on
what you're bringing is for later.

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
- **Komponents** first, as a row of cards that scrolls sideways, the next
  card peeking in, with **+ Add a Komponent** last (Tal, 2026-11-08:
  "swipable cards rather than grid view"; `GroupTiles row`). They are what a
  projekt is made of, so their card is its own and larger than a space's
  (Tal, 2026-11-09: "Komponents are the important part of a projekt, and
  currently they look the same as kuestions"): the name large, its
  description in brief (two lines), and how far along it is as a bar along
  its foot. No counts of people or fractals on the card (Tal, 2026-11-10:
  "would be better with the brief description of the komponent instead").
  A Komponent is a gang in the code (Tal, 2026-10-30). **Nobody leads a Komponent**, so no owner
  shows on a tile or a Komponent's page (the owner still exists in the
  data, for who may edit it). The ones you have a hand in come first,
  tagged with any new talk. Members get **+ Add a Komponent**.
- **Spaces** (Tal, 2026-11-09: "i really like how the krew setup now
  works"): a projekt's spaces work as a Krew's do. Last on the page,
  after its sections (Tal, 2026-11-10, as a Krew's sit just above its
  posts), under **Spaces**, a tile for each space it has, which scrolls to its
  section, then what it's Konnected to, then **Konnect**. Something
  Konnected with a picture of its own (a Place's map) is a section of its
  own under that, headed with its space's name, on a Krew's page too
  (`AttachmentSection cardsApart`). Konnect → a
  space (the grid's `space` for a projekt: Kalendar, Albutts, Kronikles,
  Kuestions) turns it on (`POST /projects/:id/spaces`, owner only,
  `Project::SPACES`) and goes to its section; anything else is linked as
  before. Each space is a section of its own, in the order its owner set
  in Edit's **Page order** (`section_order`, with Activity among them):
  **Events**, **Albums** and **Kronikles** (a row of cards, New and Add
  existing; Albums and Kronikles below), **Kuestions**. A projekt from
  before keeps what it had: a space it already has something in (an event,
  an album or Kronikle Konnected, a Kuestion asked) shows without being
  turned on (`Project#shown_spaces`). Only the projekt turns spaces on; a
  Komponent's page shows what it has, and always its Events.
- **Kuestions**: the Kuestions asked in the projekt, as a row of cards
  with **Ask** last for its members (docs/spaces/kuestions.md, Kuestions in
  a Krew). Whoever can see the projekt answers them. A space of the
  projekt's own, turned on from Konnect (it used to follow its Krew's), on
  the projekt's own page only, not on its Komponents (Tal, 2026-11-08).
- No lists of work, Krew row or joining on a projekt's own page (Tal,
  2026-10-30): it is part of its Krew, whose page has its people, and a
  clearer view of what needs work is still to be designed. The lists'
  own pages (`/p/:id/needed`, `/bring`, `/actualise`, `/offers`) stay.
  Done, Hand over and Remove are off the page too. A Komponent or a
  fractal can still be removed, by whoever made it, from the Ж menu beside
  Edit (Tal, 2026-10-31).
- **Its own Kuddle** (Konnect → Kuddle, on a Komponent too; Tal,
  2026-11-10) is a call frame at the top of the work, not a tile: join the
  call in the page, and it floats with you when you leave. Members only
  (docs/spaces/huddle.md, A space's own Kuddle).
- **Joining a Komponent** (Tal, 2026-10-30: "the UX for joining should
  be simple and intuitive"): on a Komponent's page, anyone in the projekt
  has one pill at the top, **Join**, then **Joined** (which leaves), with a
  line saying what it does. **Whoever makes a Komponent is in it**, so they
  see Joined, not Join (Tal, 2026-11-08, "Join Button":
  `Project#join_gang_owner!`; the makers of Komponents from before were
  added by the `JoinKomponentMakers` migration). Joined people are in its
  people and its tile says Joined. Joining is how you hear about it: a Nudge when someone says
  something in its talk, a fractal's or a thing's on its lists
  (`freethedream.gang.talked`), or adds to it, brings something or takes
  a job on (`freethedream.gang.updated`; Activity lines). Not the person
  who did it, only people still in the projekt, and a burst collapses
  into one (10 minutes). A fractal is heard about through its Komponent
  (`freethedream_gang_members`, `Freethedream::GangNudges`,
  `POST /projects/:id/join_gang` and `leave_gang`).
- **Events** (Tal, 2026-10-30, as Getting together; since 2026-11-09 the
  same section as a Krew's, so the same thing has one name and one look):
  the Kalendar events made for the projekt or any Komponent or fractal
  inside it that haven't ended, soonest first, as the standard row of
  cards (picture, title, when, and the Komponent it's for), then **New**,
  whose composer offers Add existing (`ProjectEvents` in `event_card.tsx`,
  `SpaceShelf`, `events` on the shape). Going is on the event's page. A Komponent's page lists its own and its
  fractals'. **Anyone in the projekt can make one** (`can.link_event`;
  nobody leads a Komponent, so owner-only left a Komponent with nobody to
  make one): a **+** beside the section's title opens Kalendar's composer
  with this page Konnected, so the event belongs to it and its Krew sees it
  (Kronk::EventLinks). On a projekt's page that is the whole projekt; a
  Komponent's event is made from the Komponent's own page. No picker (Tal,
  2026-11-08, "'Make and event' button"). With nothing planned it says so,
  in one quiet line.
- **Activity**: the latest four things that happened in the last
  fortnight (Tal, 2026-11-09: "only the latest 3 or 4, maybe only recent
  ones too"), with who did them
  ("Isabelle is bringing 2 speakers", "Tomas coalesced the gang
  Ceremony"). It keeps itself up to date while the page is open and in
  view (every 20 seconds, from `GET /projects/:id/activity`), and new
  lines fade in.
- **One column**, as a Krew's page is (Tal, 2026-11-09): Talk was the
  side column's, and is gone (see Chat). An event that already exists is linked with the page's
  Konnect (the old card's "Or link one of your events" went on
  2026-10-27). To bring someone in, **Share** the emergence from the
  Ж menu; there is no Invite (Tal 2026-10-17: "no invite anywhere, only
  share"). The server's invite (`POST /projects/:id/invite` and its nudge)
  went too (Tal 2026-10-19: "the share button is plenty"). Events is
  where linked events show, so the Konnected tiles leave them out
  (`AttachmentSection exclude`) rather than listing them twice.

**A list's page** (`/p/:id/actualise` and the like) is that list in full:
what's on the emergence itself, a one-line box to add to it (type "30
plates" in Thing Bringing or "a spit roast" in Actualise, press Enter, and
the box stays open for the next one), then what's in each gang, under its
name. Still needed is every thing to bring not yet covered and every
Actualise item with nobody on it, each saying which gang it's in, with one
tap to Bring or Jump on board.

**A gang's page** is its overview at a lower level (Tal, 2026-10-15), and
the place the work is done:

- **Who's in it** is a row of their pictures under its description,
  overlapping, then "+7" for the rest (`PeopleRow`, a kit primitive; Tal,
  2026-11-10: "a rough idea of which people, and how many"), whoever is on
  the most first. Each picture opens that person.
- **Fractals** as the same row of cards (description, progress), each opening
  its own page; members get **+ Add a fractal** last.
- Events, Activity and Talk. Kuestions are the projekt's, so a
  gang's page has none of its own.
- **Off the page for now** (Tal, 2026-11-08, "Sections": "We'll build up
  functionality as we need it"): **Thing Bringing**, **Actualise**, **On
  offer** and **Depends on**, and the "12 of 20 needs met" count under the
  title ("Tidy up"). The data, the API and the lists' own pages
  (`/p/:id/bring` and the like) are unchanged. On those pages the add line
  says just "Add what's needed" or "Add an idea to bring to life", with no
  examples ("Tidy up"), and a row has no "Nobody bringing yet" or "Nobody
  on it yet" line, no comments icon and no category pills under the add
  line ("Pills"): a need is Things and an idea is Skills.

**A fractal's page** is the same, without fractals of its own; its back
chip goes to its gang.

- **Lists roll up.** The emergence's list is everything in it: first **For
  all of Mini Doof**, what's placed on the emergence itself, which is
  where power, lighting and water go (what several or all of its gangs
  use); then each gang, under its name.
- **Adding a Komponent** (or a fractal) takes its name and what it's
  about, nothing more (Tal, 2026-10-31: "strip it back to those two and
  build from there"); no fractals, needs or Konnect in its composer. A
  Komponent has no date. After adding, you stay where you were, ready to
  add the next one. **Seeding a projekt** is as bare (Tal, 2026-10-31): a
  title (the box says only "Title"), what it's about and a cover. No Krew
  to pick, because it is seeded from its Krew's page and lives there; no
  date, Komponents or needs, which are added on its page (the date in
  Edit). Opened from anywhere else, the composer says to seed it from the
  Krew page and can't be sent.
- **Talk** (below).

Edit (including the cover) is on the Ж menu, owner only.

**Layout.** Emergence, gang and item pages use `<KornerDetail>`:
the cover (an emergence's) as its hero, the centred purple title, a `<KornerMeta>` line and
`<KornerPill>` actions. On a wide Stage (frame ≥ 1000px) an emergence page
widens to 72rem: what's yours and the gangs (a grid of tiles) across the
top, then a main column (on a projekt: Activity; on a Komponent: its
lists) and a side column (event and Talk; on a Komponent, Activity and
Talk). On a phone it is one column, main
first. The emergence list is the kit's `<SpaceGrid>` of `<SpaceCard>` tiles:
the cover (or the event's image), the title, one meta line (people, end
date, Done) and a Joined or Asked tag; what it's about and its progress
are on its page;
Mycelium a reading column.

### Chat

Tal, 2026-11-09: "'Talk' currently isnt a nudges chat, its some other
weird system which isn't necessary". A projekt's talk is its own **Nudges
group chat**, the same chat a Krew has (`Nudges::Conversation` kind
`projekt`, `freethedream_project_id`): everyone in the projekt is in it,
whoever joins is added and whoever leaves taken out (`Freethedream::
Membership`). It starts on (Tal, 2026-11-10, after finding no chat on a
projekt), projekts made before that included; its owner can turn it off and
on in **Edit** (**Chat**), as a Krew's is in Settings (`nudges` in
`spaces`). While on it is a **Chat** tile
and section on the projekt's page, read and written there (`KrewChat`,
`GET /projects/:id/chat`), and a chat in Nudges named after the projekt.
It can be muted; it can't be left on its own, as it follows the projekt.
A Komponent's page has no chat of its own. The threads below are off the
projekt's and Komponents' pages; their data stays, and an item's page still
has its own.

### Threads (an item's)

Every emergence, gang and item has its own **threads**. A thread has
replies under it, and replies can be answered in turn. Anyone in the
emergence can **resolve** a thread once it's settled; resolved threads fold away under
"3 resolved threads", and can be reopened.

**Talk about a thing on the list** (Tal, 2026-10-18). Each row in Thing
Bringing (and Still needed) has a speech-bubble button. It opens the talk
of the gang or fractal the thing is in (`?quote=<item id>`) with a new
thread quoting it: a card on the thread with its name, amount and how it's
going ("8 coming of 20+", _Sorted_). The card links to the item. Taking
the item off the list keeps the thread, without its card
(`freethedream_comments.quoted_item_id`, nullified).

**Tagging people** (Tal, 2026-10-18). Typing `@` in a talk box suggests
people in the emergence (`GET /comments/mentionable?project_id=&q=`);
picking one writes `@username`. Each person tagged who's in the emergence
gets a Nudge, "tagged you in an emergence's talk", linking to the page
(`freethedream.comment.mentioned`, directed). Tags show as links to the
person. Tagging someone outside the emergence does nothing.

Why threads that resolve, not messaging (Tal, 2026-10-13): people get
overwhelmed by the volume of messages and stop engaging, and once 300
messages have stacked up nobody can tell what's happening or what they've
missed. FreeTheDream is meant to take the weight off messaging: what's
needed lives in the lists, what's changed lives in Updates, and Talk holds
only what's still being worked out.

### Who can do what

- **Joining.** It's the Krew's way in: open, Ask to join, or through the
  Krew's page (see The Krew). An emergence no longer has its own choice.
- **Inside an emergence, anyone who has joined** coalesces gangs and adds
  to Thing Bringing, Actualise and On offer. Whoever adds something
  **owns** it. Nobody has a veto over anyone else's piece, the seeder
  included.
- **Ownership moves.** An owner can hand something to another member. If an
  owner leaves, what they made stays, and anyone in the emergence can take
  it over.

### Mycelium

**Hidden for now** (Tal, 2026-10-30): with FreeTheDream off the Hub there
is no clear home for it, so its view (`/hub/freethedream/mycelium` goes to
every emergence) and **From my Mycelium** (`MYCELIUM_SHOWN` in
`from_my_mycelium.tsx`) are off. Nothing is deleted; the API and what
people listed are untouched. What follows is how it works when shown.

Decided by Tal, 2026-10-19 (`docs/decisions.md`). Mycelium is the
synergistic audit, named for the network under a forest that moves what
some have to where others are growing. It is its own view in FreeTheDream
(`/hub/freethedream/mycelium`; `/inventory` redirects), and it connects
into each emergence.

- **Your Mycelium** is what you have, in six categories: **Skills,
  Things, Space, Time, Money, Connections**. Each thing is a name, how
  many, its category and a note; nothing more. It is **private**: only
  you see it (`Freethedream::MyceliumItem`, `freethedream_mycelium_items`).
- **Sharing is offering.** Share something with an emergence you're in and
  it is **on offer** there: an offer (`Item` kind `offer`) linked back to
  it (`mycelium_item_id`), seen by that emergence's members. Sharing again
  changes how many; unsharing takes the offer back. Offering something on
  its own from an emergence's page puts it in your Mycelium too, so every
  offer lives in someone's Mycelium.
- **Bringing from it.** Bringing a need with one of your Mycelium things
  is the same one offer per person per need as "I'll bring it", linked to
  the thing. Taking something out of your Mycelium takes back what it
  offers on its own; what you said you'd bring against a need stays,
  since someone may be counting on it. Leaving an emergence takes what
  you shared there out with you.
- **Every need and Actualise item has a category.** The quick-add line
  sets Things for a need and Skills for an idea (its chips went on
  2026-11-08); a thing's own page can change it.
  `$400` is Money whatever is picked. Needs with no category (added before
  this) match nothing.
- **Where they meet** (`Freethedream::MyceliumMatch`, one rule: same
  category, ranked by words in common, singular or plural):
  - **Suggestions when you share.** Sharing something shows what it could
    cover in that emergence (needs not yet sorted, and Actualise items,
    which are open-ended), with **Bring it** or **Jump on board**.
  - **From my Mycelium** on a need or Actualise row, and on its page, when
    you have something in its category: your things, closest first; one
    tap brings it (or jumps you on board).
  - **A nudge on a match.** When a need or Actualise item is added, whoever
    has **shared** something there that it fits (a word in common, not
    just the category) gets a Nudge, "{name} needs something you shared
    from your Mycelium" (`freethedream.mycelium.matched`, directed; muted
    like any nudge type). Only what's shared counts, never anything
    private.
- **Not yet:** an emergence-wide view of gaps and spares, category by
  category (the old audit page, retired with this). Kept for later.

### Not in the first build

- Nudges beyond talk mentions and Mycelium matches, and feed cards. The first build is the
  space itself; reach comes after. There is no invite, only Share.
- Moving money. Pledges are recorded; payment happens elsewhere.

### The build split

- **Kronk (this repo)** builds the mechanism as a **native korner**: project,
  part and item pages and Mycelium, on a new API, inside
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
  (polymorphic), and the inventory, now `MyceliumItem` (see Mycelium).
  Owners are nullified when an account goes, so its work stays and is up
  for grabs.
- **API** (`Api::V1::Freethedream::*`, `/api/v1/freethedream/…`): projects
  (list, show, create, update, remove, join, leave, take over, hand over),
  requests (accept, decline), dependencies, items (show, create, update,
  remove, claim, unclaim, bring, take over, hand over), placements,
  comments and Mycelium (`/mycelium`: list, `?for_item=`, create, update,
  remove, offer, withdraw, suggestions). Every shape is
  built for its viewer by `Freethedream::View`, including a `can` block
  saying what they may do. Specs:
  `spec/requests/api/v1/freethedream/mechanism_spec.rb`.
- **Page** (`features/freethedream/`): the landing sits in `<KornerShell>`,
  and its title is the Frame's rotator (`header.rotator: true`), turning
  through **All emergences**, **Mine** and **Mycelium** (`mycelium.tsx`),
  each with its tagline from `views:`. FreeTheDream draws no badge, title
  or tab row of its own (Standard L11); until 2026-10-29 it sat in a bare
  `<Stage>` under a fixed title and a row of text pills, the one korner
  with taglined views that didn't rotate. Spec:
  `spec/system/freethedream_spec.rb`. Detail routes, each in a plain
  `<Stage>`, are
  for a project or section (`/p/:name`) and an item (`/i/:name`), by name
  (`Kronk::NamedLink`; an old number still opens it). From my
  Mycelium on rows is `from_my_mycelium.tsx`; the category chips are
  `CategoryChips` in `shared.tsx`.
  "Seed a projekt" is the manifest's compose route, opened from a Krew's
  page (no Ж menu offers it). Lists add
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
  project shape adds `cover`, `event` (with your RSVP) and
  `can.link_event` (who sees Make the event). (An invite endpoint and its nudge,
  `freethedream.project.invited`, were removed 2026-10-19.) The
  manifest's primary resource is `freethedream/projects` so
  `KornerRegistry.model_for` finds `Freethedream::Project`, and it accepts
  links from any korner. `starts_on` and `location` are ignored on the model;
  drop them in a later migration. Page: `overview.tsx`, `event_card.tsx`;
  `/p/:id` is the project's one page (`/p/:id/kontribute` redirects to
  it), `:id` being its slug (`Kronk::NamedLink`; the number and old names
  still open it), and
  `/hub/freethedream/:id` (where attachments link) redirects to `/p/:id`.
  Specs: `spec/requests/api/v1/freethedream/overview_spec.rb`. The project
  shape's `people` (each member with `organiser`, `leads`, `jobs`,
  `bringing`) feed the page's People; each section row's `description`
  (to 200 characters) its Komponent cards (`groups.tsx`).
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
  lists in `work.tsx`). Specs:
  `overview_spec.rb`, "who's in it" and "the activity".
- **Emergences** (2026-10-15, `20261015130000`–`20261015130200`): the
  words above; `krew_id` on projects (`Project#ensure_krew!`,
  `#add_member!`, `#remove_member!`; `Membership` and `KrewMembership`
  keep the two in step) and `krew` on the emergence shape; Actualise
  open-ended (adding a job claims it for its adder, `Item#actualised?`,
  `Claim` has no cap, `progress.open_jobs` counts items with nobody on
  them); no new ideas, `take_on` gone. Get involved swiped sideways
  until 2026-10-22; its cards reflow now.
  Specs: `mechanism_spec.rb`, "the Krew".
- **Gang pages** (2026-10-15): fractals (`Project#gangs_and_fractals_only`;
  `sections` on create seeds an emergence's gangs or a gang's fractals);
  the gang and fractal shapes add `level`, `crew` (`View#crew`) and `gear`
  (`View#gear`); `Item#sorted?` for a need is enough being brought
  (`covered >= quantity`). Page:
  the gang branch of `project_page.tsx` (`crew` drawn as a `PeopleRow`), one-tap
  `BringControl` (`bring.tsx`). Specs: `coordination_spec.rb`, "a gang's
  page".

Rules the server holds, whatever the page sends:

- Only members coalesce gangs, add items, placements, dependencies and
  comments, or jump on board.
- Only an owner edits, hands over or removes their own thing. A project
  or part can be removed only when nobody else has anything in it; its
  owner sees why instead of Remove (`others_inside` on the shape).
  Removing one takes the gangs and fractals inside through Rails, deepest
  first, so each one's links go with it (`Project#remove!`).
- Whoever adds to Actualise is on it; anyone else can jump on board, with
  no cap. No new ideas. A fractal holds nothing. Something to bring is
  gathered once enough of it is being brought; an offer counts against it
  at once.
- Dependencies stay inside one project and can't loop.
- A reply stays on its thread's subject. Taking back a comment someone has
  replied to keeps the replies; only its words go.
- Your Mycelium is yours alone. Something in it can be offered only into
  an emergence its owner is in. Leaving an emergence (or its Krew) takes
  what you shared from your Mycelium out and takes you off what you were
  actualising.

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
- **Mycelium's gaps and spares.** An emergence-wide view, category by
  category, of what's needed against what's shared (Tal, 2026-10-19:
  later). The six categories stay (Tal, 2026-10-19).
- **Harm and spam.** Nothing can take a project down except its creator.
  Deferred by Tal (2026-10-10).
- **Reach**: Nudges beyond talk mentions and Mycelium matches, feed
  cards (see above).
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

## Albums

A projekt's albums are a section on its page (`components/space_shelf.tsx`,
the Konnect grid, decisions.md 2026-11-08): albums Konnected to the projekt,
then **New** (the album composer with `?konnect=freethedream:<id>`) and
**Add existing**. It shows once Albutts is turned on from Konnect, or an
album is Konnected (The page, Spaces). Albums aren't repeated as Konnected
tiles.

## Kronikles

A projekt's Kronikles are a section the same way (Tal, 2026-11-09): its
written documents, a constitution or a legal document as much as a story
(Kronikle kinds Constitution and Legal document, docs/spaces/kronikles.md).
Konnect → Kronikles turns the section on, and its **New** opens the
Kronikles composer with `?konnect=freethedream:<id>`. Kronikles aren't
repeated as Konnected tiles.
