# Loadout install live acceptance

Use a matching current planner and installed game-module build. Before each
check, set the profile's loadout in the Crossroads to differ from the plan in
every input: another weapon and Aspect, other Arcana with some Grasp left over,
other Fear vows, another keepsake and another familiar (or none). Note the
profile's values to compare after the run. Automated tests are not live
verification; the owner confirms or waives each check.

## Installed run

- [ ] Start the planned run. The hero holds the plan's weapon and Aspect at
      rank V, the active Arcana are exactly the plan's at their planned
      rarities, the Fear vows and total are the plan's configured ranks, the
      keepsake is the plan's at its planned rank and the familiar is the plan's
      with its upgraded effect. The executor log shows the session admitted and
      no `loadout-install` fault; the opening steers as planned.
- [ ] A weapon, Aspect, card or familiar the profile has not unlocked still
      installs for the run and is still locked in the Crossroads afterwards.
- [ ] Clear a room that advances the keepsake. The keepsake keeps its planned
      rank and is not re-equipped at a lower one.
- [ ] Swap to another keepsake at a Keepsake rack mid-run, including one the
      profile has not ranked up. It equips at rank III.
- [ ] Receive temporary Arcana (Judgment, or Crystal Figurine). Cards the
      profile has not unlocked can be drawn, and the unlock-all-cards quest
      does not complete.

## Profile restored

- [ ] Die in the planned run. In the Crossroads the profile's weapon, Aspect,
      Arcana, Fear, keepsake and familiar are back as noted, Grasp and Fear
      totals match them, and no temporary card stays equipped.
- [ ] Clear a planned run. The victory screen and run records credit the
      planned loadout, and the rooms after the boss (for example Chronos's
      Postboss and flashback) still show the plan's weapon and familiar; back
      in the Crossroads the profile is restored as after a death.
- [ ] Save & Quit mid-run and continue. The status line says the run was
      resumed after a reload and continues unsteered (no mismatch); the planned
      loadout and ranks stay in effect, and after death or a clear the profile
      is restored.
- [ ] Practice mode: start a practice run on a mismatched profile. The start
      room shows the plan's loadout with the practice start state on top, and
      the profile is restored after the run.

## Guards

- [ ] Fresh File: on a brand-new save, a Fresh File plan admits and the run
      starts with the fixed native Staff, no keepsake and no familiar. On an
      existing save the same plan is rejected (`fresh-file`) and the profile is
      unchanged.
- [ ] Chaos Trial: start a Chaos Trial with a plan selected. Admission is
      rejected (`chaos-trial`), the trial's own loadout is used, and the
      profile returns after the trial as natively.
