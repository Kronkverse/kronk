# FreeTheDream (`freethedream` — prototype)

**Manifest:** `config/korners/freethedream.yaml` · **Mount:** `/hub/freethedream` ·
`enforced: false` (iframe prototype)

## Purpose

FreeTheDream is **a map of the projects people in the community are
running.** Each circle is a project; tap one to see what it is, who runs it
and how to get involved. Anyone can suggest a project the community could
help with. The idea at the centre: people should be rewarded for following
their passions and making the world better.

Source: [`Kashka-25/free-the-dream-map`](https://github.com/Kashka-25/free-the-dream-map).

## What it does

- **How to use this page.** Three numbered steps above the map: tap a
  circle, read "How to get involved", or suggest a project.
- **Travelling into a project.** The logo works like a portal. Selecting a
  project glides it to the centre while the map darkens; its logo lifts and
  pulls you in until it fills the screen, a dark core opens at its heart,
  and the project's full-screen page opens out from inside it, its name
  appearing in the centre before rising into place. Clicks are
  paused until it finishes. "Back to the map" (or Esc) plays it in reverse.
  Reduced motion gets a simple fade.
- **All projects.** A dropdown in the top bar lists every project as dot
  points; choosing one opens it. Works with the keyboard and screen readers.
- **Projects join by approval.** Someone suggests a project, an admin
  reviews it against the guidelines, and once approved it appears on the
  map, run by the person who suggested it.
- **How it works.** A page showing those steps, who does each one, and a
  who-can-do-what table (everyone, the person running a project, admins).
- **Guidelines.** A project belongs on the map if it involves the community.
  Personal goals are pointed to YOU; messages and posts to the Kronk feed.
- **Suggest a project.** "Who is it for?" first, then four questions: name,
  what it is, how the community can get involved, and (optionally) what it's
  connected to.
- **Suggestions.** Its own page (and top-bar button) listing every idea
  waiting for review, most-followed first. Anyone can follow a suggestion they
  like; admins see who follows each one when they review it.
- **Running a project.** Whoever runs it fills in its tagline, about, how to
  get involved, why it matters, reflections, open questions and logo, in
  place.
- **Review** (admins). Approve or decline suggestions and requests to run a
  project; add the founding projects (Kronk, Organisation, YOU, Anthemos,
  CommYOUnity, Mayhem, SoulRise, Space, Empatherapy, The $2 Push) one at a
  time. They arrive with a short description.

## What is built

- **Prototype** — `public/freethedream-preview.html`, a single
  self-contained file (images embedded), rendered at `/hub/freethedream`
  by `FreeTheDream` (`app/javascript/mastodon/features/freethedream/index.tsx`)
  through `KornerIframe`.
- **In this preview everything is local.** Each viewer is the admin of
  their own copy, the map starts empty, and anything they add stays in their
  browser. Review → Founding projects adds the founding projects.
- **Manifest** — no resources, tables, permissions or feed card yet.
  Icon `spiral`. Node `freethedream.index`, `lifecycle: soon`.

## Making it shared: Kronk accounts as members

The map already has a Kronk backend. Setting this before its script runs
turns it on:

```html
<script>
  window.FTD_CONFIG = {
    backend: 'kronk',
    api: '/api/v1/freethedream',
    csrfToken: '…',
  };
</script>
```

**Members are Kronk accounts** — no separate sign-up. Names come from
Kronk, and Kronk decides who the map's admins are (stewards, or a Krew).

It needs four JSON endpoints, same-origin with the session cookie:

| Method | Path          | Who                           | Response / body                                                      |
| ------ | ------------- | ----------------------------- | -------------------------------------------------------------------- |
| `GET`  | `/me`         | anyone                        | `{ "id": "109", "admin": false }`; `401` when signed out (read-only) |
| `GET`  | `/state`      | anyone who can see the korner | `{ members: {id: doc}, map: {docId: doc}, names: {id: "Sam"} }`      |
| `PUT`  | `/members/me` | signed-in accounts            | the viewer's own document, replaced whole                            |
| `PUT`  | `/map/:docId` | admins only (`403` otherwise) | one map document, replaced whole                                     |

Two kinds of JSON document: `members/<account id>` (written only by that
person: the dreams they shared, requests to run a project, project edits and
logos) and `map/<doc>` (admin-only: approved projects, review decisions, who
runs what, admin edits and logos). The page trusts a person's project edits
only if `map/stewards` lists them for that project.

Full data shapes, how a fresh server gets its founding projects, and how to
copy data across from the Claude-hosted version: `KRONK.md` in the source
repo. `kronk-sim/server.py` there is a ~150-line reference server for the
four endpoints, with pretend accounts to try the shared flow locally.

## Deferred

- **The four endpoints** above, and flipping the preview to
  `backend: "kronk"`.
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
it works" page that shows the process.
