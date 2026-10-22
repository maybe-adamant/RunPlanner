# Project Library and App Home

Status: locked 2026-10-21. Gates 0–4 delivered (gate 4 approved by the owner and
implemented with its tests and docs); gate 5 is next. Base commit: `59d52b0b1`.

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
   - Real subfolders of any depth, mirrored in the app. A plan's key is its
     `/`-separated path inside the library. Folders are created, renamed,
     moved and deleted (to the recycle bin) by host commands; a plan moves
     between folders under the same file name. `projectId` stays unique across
     the whole library.
   - No index file: the app scans the folder recursively, reading only each
     file's head (about 10 ms for 200 plans in a release build). A cache keyed
     by file, size and modified time can come later if cold scans prove slow.
   - Among files sharing a `projectId`, the oldest keeps it and newer copies
     are re-minted.
   - Opening an outside file imports a copy into the folder shown; an id
     already in the library is re-minted. Duplicate creates a new item in the
     same folder with a new id named "X (copy)".
   - "Open folder" reveals the library in the file manager.
   - First run offers once to import the previously active file; a declined
     offer is remembered and Import stays available.
   - The app starts on Home with no plan open; the last plan is not reopened.
   - A single-instance guard keeps one app process writing the library.
   - The web build keeps the same model over browser storage, without a
     folder to reveal; a plan's folder is a path field and folders are their
     own records.
3. **Continuous save.** Every edit writes the open item. There is no Save, no
   unsaved state and no global autosave. Each item keeps a "revert to last
   opened" snapshot. Sending to the game no longer saves first.
4. **App home.** Settled mock-ups (gate 0), revised at the gate 4 review: a
   header with Library / Catalog / Game / Settings tabs and About (version and
   update check); the Game tab shows "· update" or "· event" in visible text
   when the module has an update or a community event is active.
   - **Library:** a breadcrumb ("Library › Practice › Bosses"), folder rows
     (Rename, Delete, Open) above plan rows; per plan name, route and aspect,
     biomes planned, slots with current/older, last edited, and Duplicate,
     Move to… (folder picker), Delete, Open; page actions "Browse catalog",
     Open folder, New folder, Import…, New plan (blank, filed in the folder
     shown). The search box and the chips (All, one per route type as the
     route chooser names it, In game) search the whole library and show each
     result's folder. Sort is kept per folder. Deleting a plan or a folder
     moves it to the OS recycle bin and shows a floating "Deleted · Undo"
     toast (about 8 s); Undo restores from an in-memory copy on every
     platform. Deleting the open plan, or a folder holding it, closes it. No
     drag and drop yet.
   - **Catalog:** see item 5.
   - **Game:** module status and update, game location, the community event
     card, and a table of all slots (library plan or "Not in library",
     current/older with a visible reason, route, loadout, sent date, Play next,
     Open for linked slots) with "Rebuild outdated slots". Home never sends or
     clears slots; development builds keep Import event folder / Clear event.
   - **Settings:** app scale.
   - **Editor header:** ← Home · plan name · Rename · Discard changes ···
     readiness badge · Undo/Redo icon buttons · split send button. "Discard
     changes" (one undoable step back to the plan as opened) shows only after
     an edit since opening, in reserved space; "Not saved · Details" shows
     only on a write failure, in a reserved slot. The split button's main part
     sends and ▾ opens the slot picker: "Send to slot N" (never sent, or the
     slot is older), quiet "Slot N · up to date", or "Send to game…" with no
     slot to choose. Its slot is the plan's own (the one that plays next when
     it has several), else the slot last used this session while still empty,
     else the first empty one. The route label, File, zoom, save status and
     the separate Game and About buttons leave the editor; the Route panel
     drops its readiness badge.
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
4. **App home.** Library (with folders), Game and Settings screens from the
   approved mock-ups; host folder commands; editor header and split send
   button; slot↔item links.
5. **Catalog.** Entry format and bundling, the Catalog screen, Add to library.
6. **Closure.** Independent review, docs, live checks, delete this plan.

## Non-goals

- opening a slot's stored project ("open slot as project"), deferred;
- redesigning community events, deferred until the new home exists;
- cloud sync or multi-device libraries;
- persisting undo history across sessions.
