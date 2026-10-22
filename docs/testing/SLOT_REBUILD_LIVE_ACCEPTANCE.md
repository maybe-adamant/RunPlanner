# Slot rebuild live acceptance

Requires a desktop planner and a game target with the module installed, and a
second planner build whose schema revision or major is newer (a development
build with a bumped `PROJECT_DOCUMENT_SCHEMA_REVISION` serves). Automated tests
are not live verification; the owner confirms or waives each check.

- [ ] Send two saved plans to slots 2 and 3 and pick slot 3 in **Active plan**.
      `slot-2.source.runplanner.json` and `slot-3.source.runplanner.json` appear
      beside the slots in the module's config folder; the game's **Plan for next
      run** lists only the twelve slots, never a source file.
- [ ] Start the newer planner: the installed module still admits the old
      plans, so both slots read normally and the Game tab asks to update the
      game module, with no **Rebuild outdated slots**. Update the module from
      the Game tab: the slots become outdated and rebuild without further action, the
      summary reads `Rebuilt 2 slots`, Sent shows the rebuild time, slot 3 stays
      active, and in game both slots load with Status Ready.
- [ ] Send a plan whose project the newer schema makes invalid (or whose source
      file was edited to an incomplete project under an older major), then update
      the module: that slot stays outdated, its row reads “couldn’t rebuild”, and
      the line under the table asks to open the project and resend.
- [ ] A slot sent by a planner before slots kept their source reads **older,
      send again** and is not rebuilt.
- [ ] With an outdated slot that has a source and the module already current
      (for example after an update whose automatic rebuild failed to write),
      press **Rebuild outdated slots**: it rebuilds and the summary counts it.
