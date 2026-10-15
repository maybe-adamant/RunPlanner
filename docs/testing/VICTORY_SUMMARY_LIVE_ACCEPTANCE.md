# Victory summary live acceptance

Requires ModpackLib 4.5.0 or later and a matching current planner and installed
game module. The planner blocks sending on an older ModpackLib. Automated
tests are not live verification; the owner confirms or waives each check.

- [ ] Complete a fully planned run through the final boss with no mismatch. The
      RunClear screen shows two rows, `Planned run - <plan name>` then
      `Complete`, right-aligned directly beneath the `Modded` label, drawn above
      the victory screen, same font as the label. An unnamed plan shows
      `Planned run - Slot N`.
- [ ] Plan a short prefix (for example Erebus only), finish it, and clear the run
      natively. The second row reads `Complete`.
- [ ] Cause a mismatch mid-run (take an unplanned door in Oceanus) and clear the
      run natively. The second row reads `Out of sync at <room>`, naming the
      room where the run stopped matching.
- [ ] Clear a run started without an admitted plan (an empty active slot). No
      planner rows appear; the `Modded` label still does.
- [ ] During normal play, with and without the room guide, confirm no draw-order
      glitch or stray text appears in the top-right area before the victory
      screen opens.
