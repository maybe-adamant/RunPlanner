# Project Library and App Home

Status: locked 2026-10-21, gate 0 settled. Base commit: `59d52b0b1`.

## Objective

The app opens on a home with Library, Game and Settings. Projects live in an
app-owned, visible library folder and save continuously. A plan's name is part
of the project. Slots in the game are shown against the library items they came
from. A catalog of template plans ships with the app.

## Current shape (facts)

- Projects are loose `.runplanner.json` files chosen through dialogs; the app
  remembers one active path (`active-profile.json`). The plan name is the
  filename stem. Save As on a saved file mints a new `projectId`; Load keeps
  the file's id, so copies made outside the app share an id.
- Autosave is one global localStorage key, compared with the restored file at
  startup. New and Load have no unsaved-changes confirmation.
- Sending writes `slot-N.runplanner.json`, a full project copy in
  `slot-N.source.runplanner.json`, the overview and `active-slot.json`. The plan
  carries `projectId`, fingerprint and `displayName`. The app links slots to the
  open project live by `projectId` and fingerprint; nothing about slots is
  persisted app-side.
- One window, no single-instance guard. No bundled resources besides the game
  module (`include_bytes!`).

## Model

1. **Plan name in the project.** A required `name` field on the authored project.
   Major schema bump, approved by the owner on 2026-10-21. Migration fills it
   from the file's stem when one is known, else a default. The published
   `displayName` comes from it.
2. **Library.**
   - A visible folder in the platform's documents directory
     (`RunPlanner/Projects/`), plain `.runplanner.json` files named from the
     plan name plus a short id; renaming the plan renames the file.
   - An index in app data keyed by `projectId` (name, route, timestamps). It is
     rebuilt by scanning the folder and is never the only copy of anything.
   - Opening an outside file imports a copy; an id already in the library is
     re-minted. Duplicate creates a new item with a new id.
   - "Open folder" reveals the library in the file manager.
   - First run offers to import the previously active file and other files.
   - A single-instance guard keeps one app process writing the library.
   - The web build keeps the same model over browser storage, without a
     folder.
3. **Continuous save.** Every edit writes the open item. There is no Save, no
   unsaved state and no global autosave. Each item keeps a "revert to last
   opened" snapshot. Sending to the game no longer saves first.
4. **App home.** Settled mock-ups (gate 0): a header with Library / Catalog /
   Game / Settings tabs; the Game tab shows "· update" in visible text when the
   module has one.
   - **Library:** a full-width list (name, route and aspect, biomes planned,
     slots with current/older, last edited); per row Duplicate, Delete, Open;
     page actions "Browse catalog", Open folder, Import…, New plan (blank).
     Delete moves the file to the OS recycle bin and shows a floating
     "Deleted · Undo" toast (about 8 s) that restores it.
   - **Catalog:** see item 5.
   - **Game:** module status and update, game location, the community event card
     as today, and a table of all slots (library plan or "Not in library",
     current/older with a visible reason, route, aspect, sent date, Play next,
     Open for linked slots) with "Rebuild outdated slots". Home never sends or
     clears slots.
   - **Settings:** app scale.
   - **Editor header:** ← Home, the plan name with Rename, "Saved as you edit",
     "Revert to opened", the readiness badge, Undo/Redo as icon buttons,
     "Send · Slot N" and a "Slots · N" button that also shows "· K older" in
     visible text; its popover lists this plan's slots and the picker for other
     slots. The route label, File, the zoom control, save status, the separate
     Game and About buttons leave the editor header (Game and About on Home,
     zoom in Settings).
   - No validity badge on library rows.
5. **Catalog.** A scalable collection of template plans, bundled for now with
   room for a remote source later. Each entry is a project plus metadata: title,
   one-line description, one fixed category (the sub-tabs, e.g. Full runs,
   Practice, Fresh File, Speedrun), free tags (filters, never repeating the
   category), and source. Search, route and tag filters, sort. "Add to library"
   copies the entry with a new id; an added entry shows "In library · Open".
   Entries stay within the migration window.

## Ownership

- **Planner engine:** the `name` field, codec and defaults; the execution plan
  takes `displayName` from it.
- **Planner application:** migration, library and settings adapters, continuous
  save, home and editor UI, slot↔item projection.
- **Tauri host:** library folder commands (list, read, write, rename, delete,
  reveal), index, single-instance guard, catalog bundling.
- **Game module:** no change.

## Gates

0. **Home mock-ups.** Static mock-ups of Home (Library, Game, Settings) and the
   slimmed editor game section, iterated with the owner before any UI is built.
1. **Plan name.** Engine field and codec, migration, `displayName` from the
   name, editor control to rename. `test:engine`, `test:planner`,
   `test:equivalence`; execution fixtures only where `displayName` changes.
2. **Library host.** Tauri commands, index, single-instance guard, web storage
   adapter; import with re-identification; first-run import.
3. **Continuous save.** Retire Save, Save As, the profile session and global
   autosave; revert snapshot; Duplicate; send without saving.
4. **App home.** Library, Game and Settings screens from the approved mock-ups;
   editor game section slimmed; slot↔item links.
5. **Catalog.** Entry format and bundling, the Catalog screen, Add to library.
6. **Closure.** Independent review, docs, live checks, delete this plan.

## Non-goals

- opening a slot's stored project ("open slot as project"), deferred;
- redesigning community events, deferred until the new home exists;
- cloud sync or multi-device libraries;
- persisting undo history across sessions.
