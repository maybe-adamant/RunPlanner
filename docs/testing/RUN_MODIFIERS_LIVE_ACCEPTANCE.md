# Run modifier live acceptance

Use a matching current planner and installed game-module build. Save and send a
valid short prefix with the desired Loadout settings before starting each run.
Source probes and automated tests are not live verification; the owner
confirms or waives each remaining check.

- [ ] With both gold modifiers unchecked, observe ordinary combat drops and
      encounter gold as the native baseline.
- [ ] Check **Enemy gold drop chance** at 100%. Every eligible hostile kill
      drops gold until the encounter's store is exhausted; the final drop may
      overshoot it. Amounts and urn/reaction drops remain native.
- [ ] Check **Encounter gold range** at 100% with enemy gold drop chance also
      at 100%, without money bonuses, and clear an ordinary G combat room
      (15–25 range) whose kills exhaust the store. Capped enemy gold stops
      after the drop that reaches 25; at 0% it stops after the drop that
      reaches 15.
- [ ] With a modifier checked, complete the configured prefix and enter
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
- [ ] On Fresh File, edit and publish both gold modifiers while native
      starting equipment remains fixed.
