# Run modifier live acceptance

Use a matching current planner and installed game-module build. Save and send a
valid short prefix with the desired Loadout settings before starting each run.
Source probes and automated tests are not live verification; the owner
confirms or waives each remaining check.

- [ ] Start with enemy gold chance at ×1. Observe ordinary combat and death
      drops as the native baseline.
- [ ] Increase **Enemy gold-drop chance** enough to saturate ordinary enemy death
      chances. Observe drops arriving earlier from the encounter's existing
      store, then stopping when it is exhausted. Gold amounts and unrelated
      urn/reaction drops remain native; no extra store is created.
- [ ] With the multiplier raised, complete the configured prefix and enter
      native rooms. The modifier continues, while ordinary planner room
      steering stops. On Surface, verify Hub/side-room returns do not disable
      it.
- [ ] Change the selected plan slot mid-run. Active settings remain those of the
      admitted plan. Die, return to the Crossroads, and start another run with
      native defaults; the previous activation does not carry over.
- [ ] Resume a supported pre-entry Postboss save in a fresh game process with
      its matching published plan. The modifier activates only after
      successful admission. A rejected plan, reproduced mismatch, or executor
      fault leaves subsequent combat/drop behavior native.
- [ ] On Fresh File, edit and publish the multiplier while native starting
      equipment remains fixed.
