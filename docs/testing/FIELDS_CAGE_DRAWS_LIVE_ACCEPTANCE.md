# Fields cage draws live acceptance

Requires a current planner and an installed game module of the same schema
pair, and a complete-valid plan through Mourning Fields (H) sent and set to
play next. Use a plan with at least one `max` cage outcome and one `min`.
Automated hook coverage is not live verification; the owner confirms or waives
each check.

## Cage rewards

- [ ] Leave H_Intro and each later Fields combat room. Every door shows its
      planned cage rewards and gods, the unpicked door's included, and the run
      stays synchronized.
- [ ] Record the run and import it. The import reaches past H r26 with no
      `stores` `entryMismatch` on RunProgress: each Fields batch's cage draws,
      the untaken peer's included, left the store before the next entry save.
- [ ] Reroll a planned cage after the doors unlock. The cage shows its planned
      reroll, and the run stays synchronized.

## Max-door counter

- [ ] After each Fields batch offering three cages per door,
      `CurrentRun.FieldsMaxDoorsRolled` grew by one; after a two-cage batch it
      stayed. The import authors each such batch's planned outcome.
- [ ] With a door into a two-cage room offered, every door shows two cages and
      the counter stays, whichever outcome the plan chose; no `cageCount`
      mismatch.
