# Active plan slot shared by the planner and the game module

Status: locked 2026-09-28. D1–D6 are owner-approved. No push or release until
the owner requests one.
Base: `main` at `560b1d4e`.

## Objective

The planner can choose which plan slot the game module plays next, and show
which slot is active. The active slot has one source of truth that the planner
and the module both read and write through one owned contract.

User-visible outcome:

- Plans in game has an **Active slot** radio group in the Slot column; picking
  a row makes it active without resending.
- Sending a plan makes its slot active (D2).
- The in-game "Plan for next run / resync" picker keeps working and shows the
  same value the planner shows.

## Current facts

- **Where the slot lives today.** `ActivePlanSlot` is a persisted ModpackLib
  storage field (`game-module/src/mods/host/data.lua`), saved in
  `ReturnOfModding/config/adamantRunPlanner-Run_Planner.cfg`.
- **How ModpackLib saves.** `native_backend.lua` loads the cfg once, keeps
  every section in memory, and rewrites the whole file from memory on each
  save with a plain `io.open(path, "w")`. It rereads only at lifecycle points
  (`_reloadFromConfig`). An outside edit made while the game runs is lost at
  the next save of any field in the module.
- **Readers.** `runtime.data.read("ActivePlanSlot")` feeds run admission
  (`room/hooks.lua`), loadout (`loadout/hooks.lua`) and post-boss resync
  (`runtime/session.lua`, which calls `inbox.load(activeSlot)`).
- **Picker.** `status_ui.lua` binds a ModpackLib dropdown to the field and
  calls `inbox.select` when it changes.
- **Shared folder.** The plan slots
  `config/adamantRunPlanner-Run_Planner/slot-N.runplanner.json` are already
  the planner's and the module's exchange area. The planner writes them
  atomically through `atomic_file.rs`, and the module only reads them. The
  module writes no files there today.
- **Transient fields.** ModpackLib storage supports `persist = false` fields,
  which are staged UI state with no config backing (`storage/schema.lua`).
- **Publishing gate.** The planner sends a plan only when the installed module
  matches this build, so a planner that can set the active slot always faces
  a module that honors it.

## Decisions

- **D1. One source of truth.** The active slot lives only in
  `config/adamantRunPlanner-Run_Planner/active-slot.json`. Neither side keeps
  a persisted copy, and the planner never reads or writes the ModpackLib cfg.
- **D2. Sending activates.** A successful send also makes that slot active.
  Sending is the "I want to play this" gesture, and it removes the manual
  switch in game.
- **D3. No migration.** A missing file means slot 1. The old cfg value is not
  read. Players who had another slot active pick it once, which the release
  notes say. This avoids permanent code for a one-time cost.
- **D4. Game-only preferences stay in ModpackLib.** Room guide, highlights and
  `Enabled` are unchanged and remain module-only.
- **D5. Only present slots can be made active from the planner.** Empty and
  unreadable slots have a disabled radio. The in-game picker still offers all
  six, as it does today.
- **D6. One control for marker and action.** The Slot column holds a radio
  group (`◉ Slot 2`), named "Active slot", with arrow-key navigation. It
  replaces a separate Active marker and a Make active button.

## Locked contract (after review)

### Shared-folder policy

Anything both the planner and the module need lives in
`config/adamantRunPlanner-Run_Planner/` in a format they own together:

- the six plan slots, which only the planner writes;
- `active-slot.json`, which both sides write.

Settings that only the game uses stay in ModpackLib storage. This replaces
"only plan slots are written under `config/`" in
`GAME_INTEGRATION_BOUNDARY.md`.

### `active-slot.json`

```json
{ "format": "run-planner-active-slot", "formatVersion": 1, "slot": 3 }
```

- Exactly these keys. `slot` is an integer from 1 to 6. The file is at most
  1 KiB. Both sides decode strictly.
- **Planner writes** use `atomic_file.rs`, the same as plan slots: temp file,
  then replace. Readers never see a partial file from the planner.
- **Module writes** go to a temp file beside it, then remove the old file,
  then rename, because `os.rename` cannot replace on Windows. A reader can
  briefly find the file missing, but never partial.
- **Missing or invalid file.**
  - The module treats it as slot 1. It rewrites the file only when the player
    picks a slot, never just because it read a bad value.
  - The planner shows no radio selected, and picking one writes the file.
- **Conflicts.** Last writer wins. Each side reads the file fresh at each
  decision point, so there is no cached copy to drift.
- **Timing.** The module reads the file at run admission, loadout and
  post-boss resync, the same points that read the field today. A change made
  mid-run therefore takes effect at the next resync, just like changing the
  in-game picker mid-run today.

### Game module

- A new host module owns reading and writing the file. It is the only place
  that touches it.
- `loadoutRuntime.activePlanSlot` reads the file instead of
  `runtime.data.read("ActivePlanSlot")`.
- The `ActivePlanSlot` storage field becomes `persist = false`, so it is a
  view of the file for the ModpackLib dropdown.
  - The view is refreshed from the file when the menu opens and after each
    write, never by reading the file every frame.
  - A player change to the dropdown writes the file, then selects the slot
    in the inbox as today.
  - If ModpackLib offers no open hook, refresh on a short throttle while the
    menu draws. Gate A settles which one applies.
- The module logs one line per slot change it writes, and one per invalid
  file it reads, deduplicated.

### Host (`run-planner-game-host`)

- `plan_slots` gains the active-slot read. The slot inspection product
  returns `activeSlot` as present with a slot, missing, or invalid, alongside
  the six slot facts.
- A new `set_active_slot(target, slot)` has the same preconditions as publish:
  an established target, a module that matches this build, and a present
  slot. It writes atomically.
- Publish writes the plan, then the active slot (D2). If the plan was written
  but the active-slot write failed, the result says so; the plan is not
  rolled back.
- The bug report adds `plans-in-game/active-slot.json` when plans in game are
  included.

### Application

- The projection supplies the radio group: the selected slot (or none when
  the file is missing or invalid), which rows are enabled (D5), and the bound
  set intent. React renders it.
- While a write is pending the group is disabled. Afterwards the slot facts are
  re-read and the selection shows the file, not the click. A failed write
  shows a short notice and leaves the selection unchanged.
- A successful send moves the selection to the sent slot (D2).
- Header send feedback keeps its fixed-width labels ("Sent to slot 2"). The
  tooltip adds "now active".
- A failed activation after a successful send shows as a notice, not as a
  send failure.

## Delivery gates

Each gate follows the AGENTS.md routine: one write-capable executor, an
independent review, one remediation pass, and commits by the main session.
Gates A and B ship in the same planner release.

### A: Game module owns the file

- A file-access module with strict decode and encode, the read points
  switched over, the picker as a view, and the write path.
- Luacheck and Lua tests for:
  - read missing, invalid and valid files;
  - the Windows remove-then-rename write;
  - the picker writing and refreshing;
  - admission, loadout and resync reading the file;
  - no per-frame file I/O.
- Docs: the shared-folder policy and the `active-slot.json` contract in
  `GAME_INTEGRATION_BOUNDARY.md`, and the picker note in the
  `game-module/README.md`.
- Acceptance: `npm run test:game-module`.

### B: Planner reads and sets it

- The host read, `set_active_slot`, publish activation, the bug-report entry,
  the Tauri command, and the adapter.
- The projection's radio group, pending and failure states, and send
  feedback.
- Tests:
  - Rust: strict decode, atomic write, preconditions, a present slot only,
    publish then activate, partial failure, and a missing or invalid file;
  - projection and UI: the selection, arrow-key choice, disabled rows,
    pending and re-read, and the failure notice;
  - contract, for the adapter.
- Acceptance: `npm run test:game-host`, `test:planner`, `test:contract` and
  `test:ui`.

### C: Closure

- The full `npm run check`.
- Owner live check:
  - pick a slot's radio in the planner, then start a run: that plan plays;
  - change the slot in game, and the planner shows it after refresh;
  - change the slot in the planner while the game is open: the next run uses
    it, and toggling the room guide does not revert it;
  - send with D2;
  - delete the file: the game uses slot 1 and the planner shows unknown.
- Promote the durable facts and delete this plan.

## Exclusions

- Planner control of ModpackLib's `Enabled` or other preferences.
- Reading or migrating the old cfg `ActivePlanSlot` (D3).
- Live notification between the planner and a running game. Each side reads
  the file when it needs the value.
- Execution protocol or authored schema changes.
