# Snap mode live acceptance

Turn on **Snap back to the plan** and play a plan. Desync on purpose in a room,
then take any door. The hero leaves the room in the plan's state, you enter the
planned next room, and the header shows Synchronized. Check each item in the
next room unless it says otherwise.

## Exit correction

- [ ] Take a different boon than planned: the trait tray shows the planned boon
      after the exit, and the Boon list has no stale icon.
- [ ] Accept a different Chaos curse than planned: the planned curse is held
      with its remaining rooms, and a Time curse's timer runs.
- [ ] Invest a different Path of Stars node: the talent tree shows the planned
      nodes, point counts and talent stacks.
- [ ] Take or drop a temporary Arcana card: the card set,
      `TemporaryMetaUpgrades` and Equipped flags match the plan. Re-enable a
      vow Circe disabled: the damage modifier and the biome timer return.
- [ ] Force an essence or boon element difference, including one that needs an
      Elemental essence split: element totals match after the exit.
- [ ] Play two more rooms after a correction: no door or reward proof
      mismatches on run records or reward stores.
- [ ] Save & Quit after a correction, then reload: traits and maxima persist,
      and the run continues unsteered.

## Integrity

- [ ] An undeviated run with snap on shows 0 snaps, and the log has no
      `conformance/snap disagreement` line.
- [ ] After a victory with snaps, the summary shows "Snapped back N times".
