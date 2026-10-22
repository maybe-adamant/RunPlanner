# Project Library and App Home

Status: locked 2026-10-21. Base commit: `59d52b0b1`.

## Objective

The app opens on a home with Library, Game and Settings. Projects live in an
app-owned, visible library folder and save continuously. A plan's name is part
of the project. Slots in the game are shown against the library items they came
from. Starter plans ship with the app.

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
4. **App home.**
   - **Library:** items, New (blank or from a starter), Import, Duplicate,
     Delete, Open folder.
   - **Game:** module status and install, game folder target, all slots with
     the library item each links to (by `projectId` and fingerprint), active
     slot, community events as they behave today.
   - **Settings:** app scale.
   - The project editor is entered from the Library. It keeps only the
     project's own game section: send this plan, its slot, current or older.
5. **Starter plans.** Bundled read-only projects within the migration window;
   "New from starter" copies one into the library with a new id.

## Ownership

- **Planner engine:** the `name` field, codec and defaults; the execution plan
  takes `displayName` from it.
- **Planner application:** migration, library and settings adapters, continuous
  save, home and editor UI, slot↔item projection.
- **Tauri host:** library folder commands (list, read, write, rename, delete,
  reveal), index, single-instance guard, starter plan bundling.
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
5. **Starter plans.** Bundling and "New from starter".
6. **Closure.** Independent review, docs, live checks, delete this plan.

## Non-goals

- opening a slot's stored project ("open slot as project"), deferred;
- redesigning community events, deferred until the new home exists;
- cloud sync or multi-device libraries;
- persisting undo history across sessions.
