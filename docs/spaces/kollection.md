# Kollection (`kollection`)

**Manifest:** `config/korners/kollection.yaml` · **Mount:** `/hub/kollection` ·
`enforced: true` · members only

## Purpose

Kollection holds every app linked to Kronk: the ones you sign in to with your
Kronk account ("Sign in with Kronk", Kronk's OAuth and OpenID Connect), and
ones Kronk points you to that have their own sign-in. For each it says what
the app is, what it can see of you in plain words, whether you are connected,
and lets you disconnect. Decided by Tal on 2026-11-23 (`../decisions.md`).

**An app belongs to Kronk, not to a person.** Before Kollection an OAuth app
was registered by one member at `/settings/applications` and owned by their
user; delete the user and the app went too. A Kollection app's Doorkeeper
application has no owner. The member who added it is its **keeper**.

## What an app is

A `KollectionApp` (`app/models/kollection_app.rb`, table `kollection_apps`):

- **name**, and the **slug** its page is reached by (`Kronk::NamedLink`,
  below).
- What its page shows: a **tagline** (one line, up to 100 characters), the
  **description** (what it is, up to 4,000), **made by**, a **category**
  (`KollectionApp::CATEGORIES`: wellbeing, social, creative, learning,
  tools, games, other), the **platforms** it runs on (`PLATFORMS`: web,
  Android, iOS), its **website**, a **download link** for a phone app (an
  app store page or the file itself; its page's Get the app), an optional
  **icon** (without one the app shows its first letter, `app_letter.tsx`) and
  **cover**, and up to six **screenshots** in order
  (`kollection_app_screenshots`). Made by starts as the adder's name in the
  composer, since whoever adds an app has usually made it; it stays editable
  for an app added on someone's behalf (YOU, by Kashka). The
  pictures are the keeper's own uploads, through the normal upload path,
  kept from the media vacuum by `Vacuum::MediaAttachmentsVacuum::KEEPERS`.
- **keeper** (`keeper_id`, an account; nullified when the account row goes).
  A keeper whose account is suspended or deleted keeps nothing
  (`current_keeper` is nil), and the app stays.
- **status**: `live` or `pulled`, with `pulled_at`.
- **oauth_application** (optional). Two kinds of app:
  - **Signs in with Kronk.** A Doorkeeper application with `owner: nil`,
    confidential (it has a secret), with the app's redirect URIs (one per
    line; an app may have several, such as a web callback and a phone
    app's `anthemos://kronk`) and scopes. It is otherwise exactly what
    `/settings/applications` makes, so `/oauth/authorize`, `/oauth/token`
    (PKCE S256, client secret), `/oauth/userinfo` and the ID token treat it
    the same (`spec/requests/oauth/kollection_sign_in_spec.rb`).
  - **A link.** No Doorkeeper application, so it needs a website. YOU is
    one (below).

**Hooking up an app that signs in with Kronk**, all from the composer but
the last step:

1. Add it with "People sign in to it with Kronk" ticked, and give where
   Kronk sends people back: the address in the app that a member returns to
   after saying yes on Kronk (for Anthemos Pods,
   `https://pod.anthemos.org/signup/callback`). The app's maker knows it.
2. Saving makes its client key and secret, shown on its page to its keeper
   and admins only, with the OpenID configuration address (the standard
   "Sign in with Kronk" is built on; nothing to do with it but hand it over).
3. Those go into the app's own server, by whoever runs it: the secret is
   how the app proves it is itself, so it lives with the app, never in
   Kronk or a chat.

An app that signs in stays one: turning it into a link would strand
everyone connected to it. Remove it and add it again instead.

**Scopes on offer** (`KollectionApp::SCOPES`), in plain words
(`features/kollection/scopes.ts`):

| Scope     | What a member reads                                                |
| --------- | ------------------------------------------------------------------ |
| `openid`  | Who you are on Kronk, so it can sign you in                        |
| `profile` | Your name, username and profile picture                            |
| `read`    | Everything your account can see: posts, Mates, Nudges and settings |
| `write`   | Post and act on Kronk as you                                       |

The default is `openid profile`. Kronk's other scopes (the granular ones,
`push`, the admin ones) are not offered.

## Who does what

| Who               | Can                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------- |
| Any member        | See every live app; add one (live at once, they keep it); disconnect from any app      |
| The keeper        | See its client key and secret and redirect URIs; edit it; remove it                    |
| Admins            | All of the keeper's; pull and restore it; name a new keeper (`/admin/kollection_apps`) |
| Anyone with Kronk | Sign in to an app with their account, as before. The list itself is members only       |

"Admin" is the `manage_settings` permission (`KollectionAppPolicy`): an app
that signs people in is part of how the instance is set up, and naming a
keeper hands that person its secret.

**Pulling** an app takes it off the list (its keeper still sees it, marked
Pulled), revokes every token and grant it holds, stops their push
subscriptions and live streams, and makes Doorkeeper unable to find it as a
client (`Kronk::KollectionClient#by_uid`), so it can't sign anyone in until
an admin restores it. Restoring brings back the listing, not the tokens:
members sign in again. This follows "err syntropic" in `CLAUDE.md`: anyone
can add, and the undo comes after the fact.

**Disconnect** revokes the current member's tokens and grants for that app,
and nobody else's (`KollectionApp#disconnect!`, the same steps as
`/oauth/authorized_applications`).

## Where you see it

- **`/hub/kollection`**: the apps, A to Z, as a `<SpaceGrid>` of
  `<SpaceCard>`s: icon, name, its tagline (or "Sign in with Kronk" / "A
  link"), and a Connected or Pulled chip; an app with no icon shows its
  first letter. **Tapping a card opens the app's page** (Tal, 2026-11-24,
  reversing the same day's tap-to-open). Built on `<KornerShell>` with one
  view.
- **`/hub/kollection/<name>`**: one app's page, laid out like an app store
  listing on `<Stage>` + `<KornerDetail>`: the cover over the top, the icon,
  name, tagline and "By …", a big **Open** (the website), **Get the app**
  when it has a download link (the main button when it has no website), and
  **Disconnect** when you are connected, the screenshots in a row that scrolls sideways (each opens
  full size in a new tab), **About** (the description), **Details** (made
  by, category, works on, website, sign-in, keeper), **What it can see of
  you** (its scopes in plain words) and **Mates using it** (below). Its
  keeper and admins also see the client key, secret, redirect URIs and the
  OpenID configuration address. **Edit** is the Ж menu's page action, as on
  an album (`useRegisterPageAction`); there are no Edit or Remove buttons on
  the page, and Remove is at the foot of the edit composer.
- **`/hub/kollection/composer`**: the composer (`<ComposeShell>`), opened by
  the **Add an app** button above the grid (`<KornerActionBar>` with a
  primary `<KornerPill>`). Kollection adds nothing to the Ж menu: the
  manifest has no `compose:` (Tal, 2026-11-23), an exception to the
  recipe's "the Ж menu is the one place to create things".
  `/hub/kollection/<name>/edit` opens the composer over an app's page.
- **`/hub/kollection/settings`** (bespoke, above the generic korner settings
  route): **Connected apps**. The apps you signed in to, each with what it
  sees and Disconnect, and the Anthemos phones linked to your account, each
  with Unlink (`map.md`, Live location). This was the Connected apps section
  of Account & Security until 2026-11-23; that page now has one row
  linking here. It also holds Kollection's one setting, **Show my mates which
  apps I use** (`show_mates_apps`, on by default).
- **Admin**: `/admin/kollection_apps`, under Administration, for
  `manage_settings`: every app with what it sees, its keeper (a username
  field to name a new one, blank for none) and status, with Pull or Restore.

No feed card and no notifications: adding an app is not news.

### Reached by name

An app's page is `/hub/kollection/<slug>`, the slug made from its name
(`Kronk::NamedLink`, decisions.md 2026-10-22): `/hub/kollection/you`, and
`anthemos-2` for a second app called Anthemos. `composer` and `settings` are
Kollection's own pages, so an app called Settings is `settings-1`. A rename
takes a new slug and the old one keeps working (`link_redirects`); the
number still opens the page, and the app puts the name in the address bar
(`useNamedLink`). A pulled app answers not found to anyone but its keeper
and admins, the same as an app that doesn't exist. The migration
`KollectionAppPages` named the apps already there.

### Mates using it

On the page of an app that signs in with Kronk: your Mates (mutual, the one
Mate rule, `Account#mates`) who hold a live token for it, up to 24, as
faces linking to their profiles (`KollectionApp#mates_using`). Only ever
your own Mates, so nobody learns who uses an app beyond the people who would
see each other anyway, and there is no count. A member who turns off **Show
my mates which apps I use** in Kollection's settings is left out of every
list; it is on by default (Tal, 2026-11-24), stored the standard korner way
(`user_korner_settings`, manifest `settings:`). It is only on an app's page,
not in the list. A link, like YOU, shows a quiet line instead: it has its own
sign-in, so Kronk can't tell who uses it.

## API

`Api::V1::Kollection::AppsController`, members only (`require_user!`):

```
GET    /api/v1/kollection/apps                 live apps A to Z, and pulled ones you keep
GET    /api/v1/kollection/apps/:id             one app (a pulled one is a 404 but to its keeper and admins)
POST   /api/v1/kollection/apps                 add one; you keep it
PATCH  /api/v1/kollection/apps/:id             keeper or admin
DELETE /api/v1/kollection/apps/:id             keeper or admin; its tokens go with it
POST   /api/v1/kollection/apps/:id/disconnect  revoke your own tokens for it
```

`:id` is the slug, an old slug or the number. Create and update take `name`,
`tagline`, `description`, `website`, `download_url`, `made_by`, `category`, `platforms[]`,
`sign_in`, `redirect_uris` (one per line), `scopes[]`, `icon_id`, `cover_id`
and `screenshot_ids[]` (in order; more than six is refused)
(`Kollection::SaveApp`). `REST::KollectionAppSerializer` returns
`client_id`, `client_secret` and `redirect_uris` only to the keeper and
admins (`can_manage`); one app (`show` and the writes) adds `screenshots`
and `mates_using`.

## YOU

YOU was a korner of its own until 2026-11-23: a portal page at `/hub/you`
leading out to Kashka's YOU app (repo
[`Kashka-25/you-app-build`](https://github.com/Kashka-25/you-app-build)), a
personal-growth app for values, streaks, an avatar ("Seed Being"), Memory
Bank, mood and kosmic rhythms. It keeps its own look on its own domain, with
its own sign-in; Kronk hosts the door.

Now it is one app in Kollection, a link with no keeper, added by the
migration `AddYouToKollection`. It links to the app's live address,
https://you-app-build.netlify.app/ (`PointYouAtItsLiveAddress`; the old
portal's `you.kronk.info` was never set up). `/hub/you` and `/hub/you/*` 301 to
`/hub/kollection`, and `you` is an ex-slug in
`config/korners/reserved_slugs.yaml`. An admin can name Kashka its keeper.

Its page was filled in by the migration `FillInYouInKollection`, only where
blank: the tagline, description, made by (Kashka), category (wellbeing)
and platforms (web), in plain words from Kashka's own README
(`web-next/README.md`). It has no pictures yet: the repo has an icon and a
few demo screens (`design/demo/`), but pictures are uploads, so its keeper
adds them from the composer rather than a migration fetching them.
When YOU takes Sign in with Kronk, its keeper (or an admin) edits it and
ticks "People sign in to it with Kronk": a link can become an app that signs
in, though not the other way round.

Still open from YOU's own plans: YOU signals on the Kronk profile (the
"✓ Anthemos" chip in `docs/prototypes/kronk-profile-redesign.html`), meant to
come through the Anthemos side rather than by absorbing YOU into Kronk.

## Nodes

`kollection.index` (`/hub/kollection`) and `kollection.settings`
(`/hub/kollection/settings`, Connected apps).

## Open

- **Icon.** The manifest uses the Material Symbol `apps` as scaffolding; a
  Kronk glyph should replace it.
- **Rotating a secret.** A keeper can't regenerate the client secret yet;
  remove and re-add is the way for now.
- **`/settings/applications`** still makes per-user apps. Whether it should
  go, or fold into Kollection, is open.
- **A notice to the keeper** when an admin pulls their app is not built.
