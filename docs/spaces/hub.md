# Hub

**Node:** `hub.landing` (Kronk::NodeRegistry) · **Cross-cutting.**

## Purpose

Hub is the discovery + entry surface for **the korners themselves**.
Landing at `/hub` shows the grid of korner tiles — each korner card
communicates its identity (icon, name, tune-in gate, current
lifecycle) and taps through to `/hub/<slug>`.

Hub is one of the three top-level nav surfaces (Feed / Profile /
Hub) in the 2.0 nav chrome; every korner in the platform is reachable
from it.

## Nodes in the Tree

Declared in `config/kronk_nodes.yaml`:

- **`hub.landing`** — the Hub grid at `/hub`.

Every korner declares its own `<slug>.index` (and often more) — those
nodes live under the Hub bucket, but are documented on each korner's
space doc in this folder.

## Cross-references

- Every `config/korners/<slug>.yaml` manifest — the Hub grid reads
  the registry.
- Ordering: sort key is per-user tune-in count (fresh + backed by
  `Kronk::TuneInCounts`), then alpha.
- Card grid: `.hub-page__grid` uses
  `auto-fill(minmax(15rem, 1fr))` so columns collapse gracefully on
  narrow viewports.
- Kronk::TuneInGate — determines which korners a given user sees
  (feature-flag gated via `tune_in_enforced`).

## Status

Hub landing shipped. Card visuals + tune-in ordering are live.
Kronk-purple aesthetic locked in; grid layout responsive.

*This is a stub. Contributions welcome.*
