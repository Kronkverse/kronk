# FreeTheDream (`freethedream` — prototype)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** `/hub/freethedream` ·
`enforced: false` (iframe prototype)

## Purpose

FreeTheDream is **a map of the projects people in the community are
running.** Each circle is a project; tap one to see what it is, who runs it
and how to get involved. Anyone can add a project, and it's on the map
straight away. Nobody approves what goes on it (Tal, 2026-10-10: gatekeeping
what can be proposed isn't syntropic). The idea at the centre: people should be rewarded for following
their passions and making the world better.

Source: [`Kashka-25/free-the-dream-map`](https://github.com/Kashka-25/free-the-dream-map).

## What it does

- **How to use this page.** Three numbered steps above the map: tap a
  circle, read "How to get involved", or add a project.
- **Travelling into a project.** The logo works like a portal. Selecting a
  project glides it to the centre while the map darkens; its logo lifts and
  pulls you in until it fills the screen, a dark core opens at its heart,
  and the project's full-screen page opens out from inside it, its name
  appearing in the centre before rising into place. Clicks are
  paused until it finishes. "Back to the map" (or Esc) plays it in reverse.
  Reduced motion gets a simple fade.
- **All projects.** A dropdown in the top bar lists every project as dot
  points; choosing one opens it. Works with the keyboard and screen readers.
- **Add a project.** "Who is it for?" first (personal goals are pointed to
  YOU, posts to the Kronk feed), then name, what it is, how the community can
  get involved, optional links, and **who can help run it**: "Anyone can
  join" or "I'll accept helpers" (the default). Saving puts it on the map,
  run by you.
- **Running a project.** Whoever runs it fills in its tagline, about, how to
  get involved, why it matters, reflections, open questions and logo, in
  place.
- **Helping run one.** On an open project, **Join in running this** makes
  you a runner straight away. On an ask-first one, **Ask to help run this**;
  the creator accepts or says "not now", and you can withdraw. Anyone running
  it can **Stop helping**.
- **The creator's Helpers section.** Switch between open and ask-first,
  accept or turn down requests, remove helpers they accepted, and **Remove
  this project from the map**.
- **Follow.** Follow a project to show interest; the people running it see
  who follows it.
- **How it works** and **Guidelines** explain the above. Founding projects
  (Kronk, YOU and the rest) are added by their people like any other.

## What is built

- **The page** — `public/freethedream-preview.html`, Kashka's single
  self-contained file, rendered at `/hub/freethedream` by `FreeTheDream`
  (`app/javascript/mastodon/features/freethedream/index.tsx`) through
  `KornerIframe`. Kronk's copy carries the open-map rework (2026-10-10);
  Kashka asked for it to be tidied, and her source will take it in.
- **`public/freethedream-config.js`**, loaded before the page's script:
  inside Kronk it sets `FTD_CONFIG = { backend: 'kronk', api:
'/api/v1/freethedream', csrfToken }` from the Kronk page around it. Opened
  on its own, the page stays a standalone copy that keeps everything in the
  browser.
- **The backend** — `Api::V1::FreethedreamController`, documents in
  `freethedream_documents` (`FreethedreamDocument`), one per member.

### Data

Everything a person writes lives in **their own document**, replaced whole
on save. There are no admins and no map-wide documents.

| Field     | What                                                                                          |
| --------- | --------------------------------------------------------------------------------------------- |
| `drops`   | projects they added: name, what, links… plus `open`, `runners` (accepted), `dismissed`        |
| `claims`  | keys of projects they run or have asked to help run (on an open project, claiming is joining) |
| `edits`   | their edits to projects, counted only where they run it                                       |
| `logos`   | likewise, for logos (`data:image/(jpeg\|png\|webp);base64,…` only)                            |
| `follows` | keys of projects they follow                                                                  |

A project's key is `<creator account id>~<drop id>`. **Runners** are the
creator, the people they accepted, and (if it's open) everyone who claimed
it.

### Endpoints (`/api/v1/freethedream`, same-origin, session cookie)

| Method | Path          | Answer                                                                |
| ------ | ------------- | --------------------------------------------------------------------- |
| `GET`  | `/me`         | `{ "id": "109", "admin": false }`; `401` when signed out (read-only)  |
| `GET`  | `/state`      | `{ members, map: {}, names }`, filtered for you; `304` when unchanged |
| `PUT`  | `/members/me` | your own document, replaced whole; `413` over 2 MB; `422` if refused  |

Writes need the page's `X-CSRF-Token`; without it the session is dropped and
the write is refused.

### What each person sees (`FreethedreamDocument.view_for`)

- A request to help run a project is visible only to the person asking and
  the project's creator, unless the project is open (then asking is joining,
  and everyone sees who runs it).
- Edits and logos are sent only from people who run that project.
- Who a creator said "not now" to stays with the creator.

### What the server enforces, whatever page writes

- A member writes only their own document, and only the five fields above.
- No `__proto__` / `constructor` / `prototype` key anywhere, and project,
  link and claim ids are safe ids (no quotes, no `|`): the page looks ids up
  in objects, where those names once crashed the map for everyone.
- Project ids are the page's own base36 ids; `tpl` is dropped; `open` is a
  boolean; `runners` / `dismissed` are account ids.
- Any `at` stamp later than now is pulled back to now, so nobody can date an
  edit into the future to outrank everyone else's.

A security read of the page (2026-10-10) found no stored XSS: every member
string reaches HTML through `esc()`. The page-side fixes it asked for are in
the rework (prototype-safe lookups, skipping malformed documents, no
selectors built from data, aligned logo caps, no bearer token).

## Open

- **Harm and spam.** Nothing can take a project down except its creator.
  Deferred by Tal (2026-10-10).
- **"Not now" is permanent.** A creator can't yet undo turning someone down.
- **People who joined while a project was open** can't be removed one by
  one; switching to ask-first turns them back into requests.
- **A Content-Security-Policy** for the page itself.
- **A Kommons proposal** for the korner, per `docs/korners/adding_a_korner.md`.
- **A native port** — the Standard's layers (KornerShell, feed projection,
  settings) once the shape is agreed.
- **Krews and Nudges** — the people of a project as a Krew, project news as
  Nudges.

## History

Added 2026-10-06 as an iframe prototype so it can be seen on shadow.
Updated 2026-10-07 to the Dream Web: grows by approval, guidelines, Share a
dream, How it works. Updated again the same day after testing on shadow:
plain language, a calmer screen, a "How to use this page" strip, and a "How
it works" page that shows the process. 2026-10-10: made open (no approval,
no admins, creators choose open or ask-first helpers) and shared through
Kronk accounts, with each person's view filtered on the server.
