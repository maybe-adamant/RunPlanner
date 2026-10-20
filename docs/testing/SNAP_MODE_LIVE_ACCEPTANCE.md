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
- [ ] Re-rank or swap a keepsake at a rack: the planned keepsake is equipped
      with its counters; the Silver Wheel max-Magick grant is right, Silken
      Sash armor is kept, and Reincarnation and cat Death Defiance pips are as
      before the exit.
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

## Doors and returns

- [ ] In an in-sync room with several doors, take a door the plan did not
      choose: that door leads to the planned room, with no extra room.
- [ ] Desync, then take a door the plan did not choose: you still arrive in the
      planned room.
- [ ] With snap on, take a Chaos gate the plan did not choose: you arrive in
      the planned room.
- [ ] Desync in a Postboss room, then leave: the next biome opens in its
      planned opening room, in sync.
- [ ] Dream run: desync in a Dream Postboss, then take the exit: the planned
      next biome opens in its planned opening room, in sync, and the Dream
      biome order afterwards follows the plan.

## Ephyra

- [ ] Ephyra Hub, in sync: take a main-room door the plan did not choose. You
      enter the planned main room and the header shows Synchronized.
- [ ] Ephyra main room, in sync: take the wrong side door. You enter the
      planned side room. Back in the main room, you return through the planned
      side door, and the taken side room can still be entered.
- [ ] Ephyra main room, plan returns to the Hub: take a side door. You arrive
      in the Hub at the return entrance, and the side door stays open.
- [ ] Ephyra main room, plan goes to a side room: take the Hub return. You
      enter the planned side room. Back in the main room, the Hub return is
      still open and you start at the side-door entrance.
- [ ] Desync in a main room whose plan goes to a side room (e.g. a wrong boon
      before the doors open), then take any side door: you enter the planned
      side room, synchronized.
- [ ] Desync in a side room (e.g. a wrong boon), then return: the main room
      shows Synchronized and the hero is in the plan's state.
- [ ] Desync in a main room whose plan returns to the Hub, then take a side
      door: you arrive in the Hub, synchronized, with the hero corrected.
- [ ] Use the Hub fountain with the Aromatic Phial at a visit the plan did not
      choose, then leave the Hub: the Phial's charge, keepsake uses and the
      upgraded trait's rarity are back to the plan.
- [ ] Out of sync in the Hub, take a main-room door the plan did not choose:
      you enter the planned main room.
- [ ] The Hub slide (the camera pans to the planned door and the hero walks
      there) is acceptable.
- [ ] After an Ephyra correction, the pylon count is right and the Hub exit
      opens after the sixth pylon, not before.
- [ ] Desync in the room before the Hub (e.g. a wrong boon), then enter the
      Hub: the Hub shows the planned board and the header shows Synchronized.

## Integrity

- [ ] An undeviated run with snap on shows 0 snaps, and the log has no
      `conformance/snap disagreement` line.
- [ ] After a victory with snaps, the summary shows "Snapped back N times".

## Store markers

With **Highlight planned choices** on:

- [ ] A Hermes Shrine with a planned purchase and rush marks only the next one,
      and its marker sits clear of the rush sticker.
- [ ] A Purging Pool with a planned sale marks only that trait's row, whatever
      its position in the trait tray.
