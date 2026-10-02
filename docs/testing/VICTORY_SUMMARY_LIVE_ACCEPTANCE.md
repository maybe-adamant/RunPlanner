# Victory summary live acceptance

Requires ModpackLib 4.2.0 or later and a matching current planner and installed
game-module build. The planner blocks sending on an older ModpackLib. Automated
tests are not live verification; the owner confirms or waives each check.

- [ ] Complete a fully planned run through the final boss with no mismatch. The
      RunClear screen shows `Planned through Tartarus · Boss` (or
      `Summit · Boss` on Surface) right-aligned directly beneath the `Modded`
      label, drawn above the victory screen, same font as the label.
- [ ] Plan a short prefix (for example Erebus only), finish it, and clear the run
      natively. The row names the last planned room, for example
      `Planned through Erebus · Boss`.
- [ ] Cause a mismatch mid-run (take an unplanned door in Oceanus). The row
      names the last room exited before the mismatch, never the mismatched room.
- [ ] Die or mismatch inside the first planned room and clear a later run
      natively. No planner row appears; the `Modded` label still does.
- [ ] During normal play, with and without the room guide, confirm no draw-order
      glitch or stray text appears in the top-right area before the victory
      screen opens.
