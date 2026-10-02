# Run modifier live acceptance

Use a matching current planner and installed game-module build. Save and send a
valid short prefix with the desired Loadout settings before starting each run.
Use a mature profile for acquired crit/double-damage sources. Source probes and
automated tests are not live verification; the owner confirms or waives each
remaining check.

- [ ] Start with both guarantees unchecked and enemy gold chance at ×1. Observe
      ordinary combat and death drops as the native baseline.
- [ ] Enable only **Guarantee eligible crits**. Compare damage with no crit source
      and with a positive contextual crit source. Only eligible attacks become
      guaranteed crits; a native non-crittable projectile/effect remains blocked.
- [ ] Enable only **Guarantee eligible double damage** with an Ares source.
      Check active versus absent required victim effect, and full versus missing
      hero health for the missing-health source. Native prerequisites still
      govern whether any chance exists. Where reachable, an effect with
      `BlockDoubleDamage` stays blocked.
- [ ] Enable both guarantees with both chances positive. Observe native combined
      crit/double damage and verify disabling either checkbox removes only its
      guarantee on the next admitted run.
- [ ] Increase **Enemy gold-drop chance** enough to saturate ordinary enemy death
      chances. Observe drops arriving earlier from the encounter's existing
      store, then stopping when it is exhausted. Gold amounts and unrelated
      urn/reaction drops remain native; no extra store is created.
- [ ] With modifiers enabled, complete the configured prefix and enter native
      rooms. The options continue, while ordinary planner room steering stops.
      On Surface, verify Hub/side-room returns do not disable the options.
- [ ] Change the selected plan slot mid-run. Active settings remain those of the
      admitted plan. Die, return to the Crossroads, and start another run with
      native defaults; the previous activation does not carry over.
- [ ] Resume a supported pre-entry Postboss save in a fresh game process with
      its matching published plan. Options activate only after successful
      admission. A rejected plan, reproduced mismatch, or executor fault leaves
      subsequent combat/drop behavior native.
- [ ] On Fresh File, edit and publish the modifiers while native starting
      equipment remains fixed. Guarantees do not create absent damage sources.
