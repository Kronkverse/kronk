# docs/rebuild

The 2.x rebuild **shipped**. 2.0.0 "Rose" reached production on 2026-09-20.

That makes most of this folder history rather than plan. Read it with that in
mind: several files describe an end state in the present tense, and were
accurate on the day they were written.

Still useful:

| File                            | What it is                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decisions.md`                  | The running log of decisions and the reasoning behind them. The one file here with ongoing value — append to it when you decide something structural. |
| `upstream-merge.md`             | The plan for merging upstream Mastodon, which is still outstanding and is how the Rails upgrade happens.                                              |
| `production-readiness-audit.md` | The cutover worklist. Historical now, but the shape of it is a useful checklist for the next big release.                                             |
| `cutover.md`                    | What the 2.0 cutover actually involved, written against the branch and the live server at the time.                                                   |

Topical specs (`per_post_audience.md`, `nudges_bus_state.md`,
`notification_retirement_plan.md`, `krew_axis_migration.md`,
`settings_inventory.md`, `comments.md`, `test_runsheet.md`,
`implementation_plan.md`) are reference for how a subsystem came to be shaped
the way it is. Verify against code before acting on any of them.

`archive/` holds the dated audits and work lists, which are purely historical.

**For how to work on Kronk today, read `CLAUDE.md` in the repo root.**
