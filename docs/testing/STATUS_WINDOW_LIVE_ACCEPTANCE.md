# Status window live acceptance

Requires a current planner and an installed game module of the same schema pair, with
several slots sent (at least one named plan and one Practice start) and one
slot never sent. Open the **Run Planner** window from the ReturnOfModding menu
bar. Automated tests are not live verification; the owner confirms or waives
each check.

- [ ] Send a plan whose aspect, name or keepsake carries accents (for example
      a Melinoë plan): the window shows it with plain letters ("Melinoe") and
      no boxes or question marks, while the planner still shows the accents.
- [ ] **Plan for next run** lists `Slot N (<label>)` for sent slots and
      `Slot N (empty)` for the unsent one. A slot file copied in by hand,
      without resending, shows plain `Slot N`.
- [ ] Choosing a slot saves it (the planner's Game tab shows it as Plays next within
      a second) and its details appear without pressing anything: Plan, Sent in
      local time, Aspect, Route `<route> -> <final biome>`, Keepsake, Fear,
      Practice when set, and `Status: Ready`. The unsent slot shows "Nothing
      sent to this slot yet." A slot file copied in by hand shows
      `No overview - Load to inspect` until **Load** is pressed.
- [ ] With the window open, drawing never hitches, even with a large Surface
      plan in the shown slot; only pressing **Load** may hitch once.
- [ ] Resend a different plan to the shown slot, then close and reopen the
      window: the details follow the new plan without pressing anything. Send
      to an empty slot and reopen: it changes from "Nothing sent" to the
      plan's details.
- [ ] Install a module of another schema pair (or send from a planner of another
      pair) so a slot is outdated: the picker marks it `(outdated)` and its Status
      reads the stale-version note. Starting a run
      then shows `Plan not used` with the update-or-resend reason.
- [ ] Before a run the header shows `No run` and **Current Run** says
      `No plan is running.` and names the next run's slot.
- [ ] Start a planned run: the header shows `Starting - <plan> (Slot N)` until
      the first room, then `Synchronized - <plan> (Slot N)`. **Current Run**
      shows `Room k of N - <room>` in a room and `Next: <room> (room k of N)`
      between rooms, with readable room names.
- [ ] Start a Practice plan: the header adds `- Practice`, **Current Run** adds
      `- Practice from <place>`, and the start room counts as `Room 1 of N`.
- [ ] Take an unplanned door: the header shows `Desynchronized` and
      `Out of sync at <room>.` and `The game continues on its own.` **Current
      Run** shows `Stopped at <room> (<when>) - room k of N` and a
      `What differed:` sentence naming both rooms; **More details** lists
      readable fields.
- [ ] Finish a short prefix plan: the header shows `Plan complete - <plan>`
      both in the last planned room after leaving it and in the next native
      room, and **Current Run** says all planned rooms are done.
- [ ] Save & Quit mid-run and continue: the header shows `Not steering` with
      `Resumed after a reload; this run isn't steered.`
- [ ] The window shows the session header above one tab bar, **Plan |
      Current Run | Diagnostics | Advanced**. **Diagnostics** is greyed and
      points to **Debug Mode** on **Advanced** until it is ticked, then shows the slot file state, schema pair, catalog, project, fingerprint,
      any slot error and the raw expected and observed records.
- [ ] Untick **Enabled** during a planned run: the room guide and planned-choice
      markers disappear, the log shows `session abandoned: module disabled`,
      and the run continues natively. Tick it again: the run stays unsteered
      (header `Not steering`), and the next run uses the plan. Start a run with
      **Enabled** unticked: no plan is admitted and the run is native.
