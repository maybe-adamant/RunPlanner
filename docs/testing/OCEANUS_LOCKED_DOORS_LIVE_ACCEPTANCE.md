# Oceanus locked doors live acceptance

Requires a current planner and an installed game module of the same schema
pair. Each section names the plan to send and set to play next. Automated hook
coverage is not live verification; the owner confirms or waives each check.

## Planned locks and fights

Use a plan through Oceanus with one combat room whose second door is locked
and pressed (with a customized fight), one room with both later doors locked
and neither pressed, and the remaining combat rooms with no locks.

- [ ] Each planned room locks exactly its planned doors when the doors open:
      the first door always opens, the planned doors show the lock, and no
      other door locks, even in G_Combat05 (0.80 room chance).
- [ ] A room planned with a challenge switch and no locks never shows a lock.
- [ ] The room guide shows `Unlock door N` for each planned press.
- [ ] Pressing a planned locked door starts its fight with the planned roster
      (or a native roster when uncustomized); the fight cannot be left, drops
      gold and no reward, and the door then shows its reward and opens to a
      second press.
- [ ] After the planned presses, leaving the room through an open door stays
      synchronized: no `lockedDoorFights` mismatch.
- [ ] A planned room whose plan leaves through an unlocked locked door (lock
      the door the plan takes and press it first) reaches the next room in
      sync.

## Unplanned presses

- [ ] Skipping a planned press stops the plan at that room's exit with a
      `lockedDoorFights` mismatch reading `fought 0 locked doors (planned 1)`.
- [ ] With **Snap back to the plan** on, an off-plan fight in a lock room is
      corrected at the room's exit: the encounter depth returns to the plan's.

## Record mode

- [ ] Record an unmodded run that fights a locked door open in Oceanus. The
      import reports that room's lock fights and stops there instead of
      authoring the room without them.
- [ ] Record an unmodded run with locked doors that were never fought. The
      import authors the room with no locks and continues.
