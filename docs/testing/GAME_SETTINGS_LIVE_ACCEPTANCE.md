# Game settings live acceptance

Requires the desktop planner and the module from this checkout installed in
the established target, and a plan sent and set to play next. Automated
coverage is not live verification; the owner confirms or waives each check.

- [ ] With an older module's options ticked in the window, update the module
      and start the game. `settings.json` appears with those ticks, and the
      Game tab and window show them.
- [ ] With no `settings.json` and no older ticks, the Game tab's In-game options and the window's
      **Plan** tab show all three options off, and the room guide, highlights
      and snap mode stay off in a run.
- [ ] Tick **Show room guide** in the Game tab while a run is in a planned
      room. The guide appears within about a second, and the window's
      checkbox shows it ticked.
- [ ] Untick **Highlight planned choices** in the window. The door markers go
      at once, and the Game tab shows it unticked when the app regains focus.
- [ ] Turn **Snap back to the plan** on in the Game tab mid-run, then go out
      of sync. The next room exit snaps back.
- [ ] Toggle Debug Mode in the window's **Advanced** tab after an option
      change in the Game tab. The option keeps the Game tab's value.
- [ ] Restart the game. Every option keeps its last value.
