# Project library live acceptance

Use a desktop build (Windows unless noted) with the library in
`Documents/RunPlanner/Projects`. Automated tests cover the library operations
over in-memory hosts; these checks need the real folder, recycle bin, window
and catalog feed. The owner confirms or waives each one.

## Saving and closing

- [ ] Edit a plan and close the window at once (within a second of the edit);
      after reopening, the plan shows that last edit.
- [ ] Click the window's close button twice quickly while a plan has unsaved
      edits; the window closes once, after the edit is written.
- [ ] Starting a second copy of the app focuses the running window instead of
      opening another.
- [ ] In the Windows app, focusing or typing in the plan name (and the library
      search) shows no "Saved info" autofill dropdown.

## Deleting and undo

- [ ] Delete a plan, then **Undo** on the toast: the plan returns with its
      content, and the deleted file is in the recycle bin.
- [ ] Delete a folder holding plans and a subfolder, then **Undo**: the folder,
      subfolder and plans return.
- [ ] Delete a plan saved by an older planner (schema 97 or earlier) and one
      that is not valid JSON, then **Undo** each: both files return unchanged.
- [ ] On the Game tab, **Clear** a filled plan slot, then **Undo**: the slot
      holds its plan again.

## Older plans and first run

- [ ] Open a plan saved by an older planner and edit it: a copy named
      `<file> (schema N original).runplanner.json` lands in the recycle bin.
- [ ] On a profile that last ran a pre-library planner with a project open,
      the first launch offers to import that file; **Import** opens it.
- [ ] On a profile whose pre-library planner held unsaved edits, the first
      launch also offers **Recovered unsaved plan**; importing it opens the
      edited project, and the offer does not return.

## Library folder

- [ ] **Import…** with several files files each one in the folder shown and
      sums them up in one notice.
- [ ] Add, rename and remove plans and folders in Explorer; returning to the
      app shows the changes.
- [ ] Once the catalog feed is published, **Add to library** on a catalog
      entry files a copy that shows "In library · Open".
