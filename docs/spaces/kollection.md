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

- **name**, **description** (what it is), **website**, an optional **icon**
  (one of the keeper's uploads; kept from the media vacuum by
  `Vacuum::MediaAttachmentsVacuum::KEEPERS`).
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
  `<SpaceCard>`s: icon, name, "Sign in with Kronk" or "A link", and a
  Connected or Pulled chip. Built on `<KornerShell>` with one view.
- **`/hub/kollection/:id`**: one app on `<Stage>` + `<KornerDetail>`: what
  it is, who keeps it, Connected or not, then **Open**, **Disconnect**
  (when connected), and **Edit** and **Remove** for its keeper and admins.
  "What it can see of you" lists its scopes in plain words. Its keeper and
  admins also see the client key, secret, redirect URIs and the OpenID
  configuration address.
- **`/hub/kollection/composer`**: the composer (`<ComposeShell>`), opened by
  the **Add an app** button above the grid (`<KornerActionBar>` with a
  primary `<KornerPill>`). Kollection adds nothing to the Ж menu: the
  manifest has no `compose:` (Tal, 2026-11-23), an exception to the
  recipe's "the Ж menu is the one place to create things".
  `/hub/kollection/:id/edit` opens the composer over an app's page.
- **`/hub/kollection/settings`** (bespoke, above the generic korner settings
  route): **Connected apps**. The apps you signed in to, each with what it
  sees and Disconnect, and the Anthemos phones linked to your account, each
  with Unlink (`map.md`, Live location). This was the Connected apps section
  of Account & Security until 2026-11-23; that page now has one row
  linking here.
- **Admin**: `/admin/kollection_apps`, under Administration, for
  `manage_settings`: every app with what it sees, its keeper (a username
  field to name a new one, blank for none) and status, with Pull or Restore.

No feed card and no notifications: adding an app is not news.

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

Create and update take `name`, `description`, `website`, `sign_in`,
`redirect_uris` (one per line), `scopes[]` and `icon_id`
(`Kollection::SaveApp`). `REST::KollectionAppSerializer` returns
`client_id`, `client_secret` and `redirect_uris` only to the keeper and
admins (`can_manage`).

## YOU

YOU was a korner of its own until 2026-11-23: a portal page at `/hub/you`
leading out to Kashka's YOU app (repo
[`Kashka-25/you-app-build`](https://github.com/Kashka-25/you-app-build)), a
personal-growth app for values, streaks, an avatar ("Seed Being"), Memory
Bank, mood and kosmic rhythms. It keeps its own look on its own domain, with
its own sign-in; Kronk hosts the door.

Now it is one app in Kollection, a link with no keeper, added by the
migration `AddYouToKollection`. `/hub/you` and `/hub/you/*` 301 to
`/hub/kollection`, and `you` is an ex-slug in
`config/korners/reserved_slugs.yaml`. An admin can name Kashka its keeper.
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
