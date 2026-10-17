# Inflow (`inflow`)

**Manifest:** `config/korners/inflow.yaml` · **Mount:** `/hub/inflow`

Inflow is the space for being in flow with the sky and the seasons: attuning
to the rhythms around and within us (sun, moon, stars, seasons, birds, plants)
and responding to them. It invites rather than prescribes. It never says "you should do X
today"; it shows what is happening and leaves room to respond. This doc
describes what is built as of 2026-10-05.

## The veil

Inflow's surface is the **veil**: the home feed parts to show a night sky that
was always there, then closes again over your posts.

- **In the feed.** `VeilScene` (`features/inflow/veil_scene.tsx`) is inserted
  into the home feed as a gap. The sky is a fixed backdrop rendered through a
  portal, so as you scroll the post above uncovers the moon and the post below
  covers it again. It also brightens the `KronkKosmos` backdrop for the moment.
- **On its own.** `/hub/inflow` renders the same scene in a `Stage`
  (`features/inflow/veil.tsx`).
- **Tune out** of Inflow and the veil is left out of your feed. The page stays
  reachable.
- **Once a day.** If you collapse the veil it stays collapsed for the rest of
  the day, and reopens for everyone the next day (stored in the browser under
  `kronk.inflow_veil.collapsed_on`).

**What it shows.** Tonight's moon (phase, illumination, waxing or waning,
rise and set), daylight, and a short reflection from
`buildDailyIntegrationText` (`components/daily_integration.tsx`), which weaves
in the season, cross-quarter days, orbital events, supermoons and meteor
showers. All of it is computed in the browser by `celestial_calendar.ts` (in
`features/events/components/`) and `earth_calendar.ts`. **Where the sky is
read from** (`features/inflow/sky_place.ts`, Tal 2026-10-17): your own Map
pin if you have one, which the server has already coarsened; otherwise
Melbourne. With a pin, the day boundary and the times follow your device's
time zone, since a pin carries none; without one they are Melbourne's.

Inflow has no feed card by design (`card: null`). The veil is the view.

## Server side

Two scheduled pieces exist. Neither feeds the veil today.

- **`KosmicUpdate`** (`kosmic_updates`): one row per day, made by
  `Scheduler::KosmicDailyScheduler` at 00:05 UTC with placeholder text
  ("Today's kosmic weather is unwritten.") unless someone wrote that day's row
  first. It can link to a `Status`, but nothing publishes one, and nothing
  reads the rows.
- **Nature observation** (`NatureObservationGenerator`): gets Melbourne weather
  from Open-Meteo and recent sightings in Victoria from iNaturalist, asks
  Claude (Haiku) for a short observation, and caches the text in Redis for 48
  hours. `Scheduler::NatureObservationScheduler` makes it once a day (19:00
  UTC, early morning in Melbourne) unless it already exists.
  `GET /api/v1/inflow/observation` serves it without sign-in. No client calls
  that endpoint.

`/in-flow` and `/hub/in-flow` 301 to `/hub/inflow`.

## Open

- **Wire the server data into the veil, or retire it.** `KosmicUpdate` and the
  generated observation are both produced and never shown. The observation
  job calls an external model once a day (when `ANTHROPIC_API_KEY` is set) for
  text nobody reads.
- **Unused manifest entries.** The `daily_delivery_time` and
  `strands_of_interest` settings, the `inflow.kosmic_update.published` event
  (never published) and the `observations` resource (there's no model, only
  the cached text).
- **Location.** The moon and daylight follow your Map pin, but the season
  and the Earth calendar (`earth_calendar.ts`, Melbourne basin phenology)
  are still Melbourne's, so someone pinned in the northern hemisphere reads
  a southern season.
- **Observations by people.** The design (from Tomas, July 2026) has the daily
  moment invite a response: a photo, a reflection, something planted or
  harvested. Not built. Open: who sees them, whether they gather into a shared
  record, and whether there's any game in it.
- **Soil.** Community feedback said Soil draws people most. Designed depth
  (chop-and-drop timing by moon, more plants, local edible and medicinal
  plants) is not built, and needs some notion of where the user is.
- **Inflow as a kind of profile.** Tomas floated an Inflow "profile" holding
  past daily moments and your responses. Undecided against Inflow staying a
  space.
- **Kalendar.** Kalendar's spiral computes its own moons and solstices.
  Undecided whether Inflow should be the shared source, and whether local
  events (planting days, full-moon gatherings) should show in Inflow.

## History

Rewritten 2026-10-05 to describe what is built. Earlier designs and notes
(Tomas's Round 1 feedback, the four-strand tabs, the Kosmic Update plan):
`git show 231cca937:docs/spaces/inflow.md`.
