# Application Shell

The shell is everything around the biome workspace: the Home screens, the
project library and its operations, continuous save, opening and migration,
startup, navigation history, fault recovery, the Game tab and send control,
the Route, Draft and Loadout panels and the Run State sheet.
[Editor Model](EDITOR_MODEL.md) owns the application architecture these sit
on (composition, projections, binding, findings);
[Structured Editor Workspace](STRUCTURED_EDITOR_WORKSPACE.md) owns the biome
workspace itself.

## Home

The app opens on Home with no plan open. Home has About (build identity, the
update check, a bug report and keyboard shortcuts) and the Library, Catalog
(desktop only), Game and Settings tabs. Each screen's first panel heading
carries its context from its projection (counts, module state, next slot),
leaving out what is not known. The Game tab marks a module update or an active
community event. App notices (an update, an ended event) show under the
screen's header.

The shown Home tab, whether the editor shows, and the Library folder shown are
UI-session state. Opening a plan shows its editor; going Home keeps it open;
deleting the open plan closes it and returns to the Library.

**Settings** holds the app scale and the Arcana and Vow presets. App scale is
a device-local presentation preference, outside plans and Undo/Redo, with
keyboard and wheel shortcuts; map zoom is independent of it, and pointer
gestures and floating overlays convert between screen and scaled layout
coordinates. Presets are
device-local planner settings, never project state, history or plan data:
named manual Arcana selections and named Vow ranks, each kind listed with Add,
Edit, Rename and Delete (Undo restores a deleted preset in place). Add and
Edit open the Loadout's Arcana or Fear board on a loadout of the preset's own
through the engine's edit domain. On load, cards and Vows the catalog does not
declare are dropped and Settings says so. While presets of a kind exist, the
editor's Arcana or Fear picker shows them as chips above the board; choosing
one applies it as one undoable step, or refuses with the reason in visible
text when the plan's starting Grasp could not hold it. Fresh File has no
pickers and so no presets.

### Library screen

The Library shows the folder's subfolders above its plans, and per plan its
route, loadout, biomes planned, slots and last edit; a file the planner cannot
open shows why. A search or chip (All, one per route, In game) searches the whole
library and names each result's folder. Sort is kept per folder. A plan's
slots link by `projectId`: current when the slot's fingerprint matches the
plan as it is now, otherwise older with the reason (edited since sent, needs
rebuild, send again). Only plans a slot holds, and the open plan, are compiled
for this, cached by key and modified time.

Each row's In game column is the shared split send control. It names the
plan's default slot (the one that plays next, else its first) with "+N" for
its others and learns whether the plan can be sent only when asked: opening
the picker or sending loads, simulates and compiles the stored file as an
opened and sent plan would be, and a send reuses that compile while the file
is unchanged. The open plan sends through the editor's path. A plan that
cannot be sent opens the picker with the reason and Open in editor; a file
the planner cannot open has no button. A Library send leaves the editor's send
session alone. Deleting a plan never touches a slot; its notice names the
slots that still hold it.

### Catalog screen

The Catalog shows the host's verified catalog index: loading, ready, offline
from the cached index, could not load, or off without a catalog key. Start-up
and showing the Catalog refresh it, the latter retrying a failed fetch.
Category tabs follow the index's order, and a category without entries has no
tab. Entries are searched, filtered by route and tag, and sorted; changing
category clears the tag filter. Each entry offers Add to library, In library
with Open, or Needs a newer planner for a schema the loader does not open. An entry is in the library while a library
plan holds the `projectId` recorded when it was added, so renaming or moving
the copy keeps the link and deleting it offers the entry again; a Duplicate of
that copy is a plan of its own.

## Plan operations

Every open plan is a library item and every authored edit is saved: there is
no Save, no unsaved state and no recovery copy.

- **New plan** opens a route chooser (populated from the catalog route
  collection), creates the route's project in the folder shown and opens it.
  Before a route is chosen there is no project, history, evaluation or library
  write.
- **Open folder** reveals the shown folder on desktop; **Browse catalog** opens
  the Catalog tab.
- **Import…** files each picked file in the folder shown without opening any,
  with one summary notice.
- **Duplicate** writes an open plan's pending edits, then files "X (copy)" with
  a new `projectId` in the same folder without opening it.
- **Delete** moves the item to the recycle bin and keeps its content in memory
  for the notice's Undo. Folders are created, renamed and deleted the same way,
  a deleted folder keeping its contents for Undo; deleting the open plan, or a
  folder holding it, closes it. **Move to…** refiles a plan;
  the saver follows the open plan wherever it moves.
- **Discard changes** (editor) replaces the project with the document it was
  opened as, as one undoable history step.
- **Add to library** (Catalog) files an entry's verified plan at the top level
  as a copy with its own identity, named after the entry's title, without
  opening it, and records the entry id with the copy's `projectId`.
- An event's project opens like an imported copy that always takes its own
  identity.

Opening a plan first writes the open plan's pending edits; if that fails the
open plan stays and the failure is reported. The opened plan starts a new
history; opening the plan already open only shows its editor.

## Project library

The library adapter stores plans as complete documents addressed by an opaque
key within a folder path, lists every plan and folder, creates, renames, moves
and deletes folders, moves plans, and keeps the library session (which catalog
entry each copy came from). Listing scans each time; there is no index. The
desktop host keeps plain `.runplanner.json` files under
`RunPlanner/Projects/` in the platform documents folder, in subfolders of any
depth; a file is named after its plan plus a short identity hash. It scans
recursively reading only each file's head, reports an unreadable subfolder
instead of failing the scan, writes atomically, refuses a document without an
identity and name, renames a file only when the plan's name or identity
changes (never over another file), and deletes to the system recycle bin. The
browser host keeps the same model in browser storage without a bin.

Library meaning stays in the application. Entries are classified as openable,
too new or unreadable against the loader's supported schemas, never dropped;
a plan without a name takes its file stem. Identity is unique across the
library: a stored copy sharing an older plan's `projectId` (the oldest by
modified time keeps it; the open plan always keeps its own), or an imported
file whose identity the library already holds, is given a new identity and
written whole; a copy stored in an older schema keeps its original first, as
its first edit would. Only a listing re-identifies; other operations read the library
as stored, and library operations run one at a time. A deleted file's bytes
stay in memory so Undo restores them at the same key, readable or not;
undoing a folder deletion restores all of it or nothing.

## Continuous save

The saver watches the present project. An effective authored change (edit,
Undo/Redo, discard) schedules a debounced write of the open item; changes
coalesce, one write runs at a time and each writes the newest snapshot. A
write that refiles the plan moves the saver to the new key; while the open
plan or its folder moves, writes wait and resume there. Nothing announces a
successful save. A failed write shows "Not saved · Details" in the editor
header; the next edit or flush retries and success clears it. Navigation,
findings and derived publication never write.

Pending writes flush before another plan opens, before an update installs,
when the page is hidden, and before the desktop window closes: the host holds
the close while the planner writes and closes silently on success, absorbing
further close requests. A planner that does not take up the request within a
few seconds is closed; once it has, its write gets a longer bound. Only a
write that still fails asks whether to close anyway, and the window stays open
while the user answers. The browser asks before unloading while an edit is
unwritten.

## Opening and migration

Opening prepares the whole document before publication: the shared loader's
compatibility check and strict engine parse, evaluation, and the workspace
projection must all succeed. Every library or imported open goes through that
loader. It inspects the source schema and catalog identity, applies the
registered ordered transitions, one per major from the support floor to the
current schema ([schema history](../../schema/README.md)), and strictly
parses the result; each transition declares its source and target identities,
so an old catalog identity is never blindly replaced. Within the current
major, the current or an earlier revision loads as is; a later revision, an
unsupported older schema or a future one is refused and left untouched.

A migrated plan opens in memory in the current schema and names the repairs
its migrations may need. Its file is untouched until the first edit is saved;
before that first write replaces it, the desktop library recycles a copy named
`<file> (schema N original)` and the write waits for that to succeed, while
the browser library rewrites in place. Saving stamps the current major, and
the revision when it is not 0. Only after preparation succeeds is the project
replaced, with a new history and opened snapshot. Failure leaves the current
project, history, evaluation and library unchanged, except that an import or
New has already filed its item.

## Startup, navigation and recovery

Startup shows the Library with no plan open. A working file left by a planner from
before the library is offered once on the Library for import; importing or
declining is remembered. That planner's autosave is offered beside it only
when it differs from the file, and kept until imported or declined.

Navigation is mirrored into browser history. Each change of Home tab, Library
folder, open plan or editor section (Route, Draft, Loadout, a biome, an index)
that follows user input pushes one entry; a change that leaves the location
unchanged pushes none, the first location replaces the initial entry, and a change the
app makes by itself rewrites the shown
entry so entries ahead are kept. Back and forward (browser, mouse buttons,
Alt+←/→) restore the entry: a Home entry shows that tab and folder, writing the
open plan's pending edits when leaving the editor; an editor entry reopens its
plan, found by key or by `projectId` after a rename or move, and shows its
section. A plan no longer in the library lands on the Library with a short
notice and the entry is rewritten. Navigation never touches authored history.
The desktop app steps history itself on the mouse buttons and Alt+←/→ when the
WebView has not.

A route-local index (NPCs, Resources and the like) shows only while its panel
has rows, judged from those same rows; if the active index empties
after an edit, the editor returns to Route.

A fault boundary catches rendering errors and unhandled browser errors and
rejections. It never continues an unknown partial interaction. It states that
the plan is saved in the library and offers **Back to Library** while a plan is
open, a bug report carrying the fault in the desktop app, **Reload** (which
flushes pending writes first and starts on Home), and the error's technical
details.

## Game tab and send control

The host owns the [distribution](GAME_MODULE_DISTRIBUTION.md) and
[slot](PLAN_SLOTS_AND_PUBLICATION.md) contracts and every compatibility and
install decision; the Game tab presents them. One status controller shares the
latest host status between Home and the editor, refreshed when either shows,
on window focus and after every game action.

- **Game module:** its status, install or update as the one primary action,
  and its facts grouped into location, one overall state and ordered steps.
- **Game location:** the platform's r2modman profiles (none on macOS), a
  folder picker and Forget. Switching away from a planner install asks whether
  to keep or remove that copy; replacing a copy the planner did not install,
  or one r2modman manages, asks first. The ModpackLib step links to its
  Thunderstore page.
- **Slot table:** the event row while slot 0 holds a plan (no send action) and
  the twelve plan slots, each with its library plan as current or older with
  the reason, or the plan's name marked not in the library, its route,
  loadout and send time. Next run is a radio group; choosing a playable slot
  sets the active slot without resending (a failed write leaves a notice), and
  an outdated or unreadable slot cannot be chosen. A linked slot opens its
  plan. **Rebuild** appears while an outdated slot has a source,
  with how many need it; a slot that could not be rebuilt says why. **Clear**
  offers Undo for a few seconds. The Game tab plays a slot next, clears and
  rebuilds slots and opens a linked plan, but sends only through the Library
  and editor controls; development builds add Import event folder and Clear
  event.
- **Event notice:** one notice at a time, an app update first, otherwise the
  active event with Set as active (absent while the event cannot be played,
  shown as Active while it is), Details, Open project, Copy link and Dismiss.
  Dismissal is remembered per event; the event slot is still written. When an
  event ends while its slot was active, the notice says which slot the next
  run uses.

The editor's split send button sends the open plan. It chooses the plan's own
slot (the one that plays next if several), else the slot last sent this
session while still empty, else the first empty slot, judging eligibility from
the evaluation and compiling only when the plan is in a slot.

| State                              | Clicking                             |
| ---------------------------------- | ------------------------------------ |
| Module not ready                   | nothing; the Game tab sets it up     |
| Engine reports the plan unsendable | nothing; the picker gives the reason |
| The slot holds the plan as it is   | opens the slot picker                |
| A slot to send to                  | sends to that slot                   |
| No slot to choose                  | opens the slot picker                |
| Sending, then a brief result       | nothing                              |

Its slot picker lists the plan's own slots with Update for an older one,
every slot to send to (Replace asks first), why the plan cannot be sent with
Show findings, and the last send's failure. A compile failure is explained
from the compiler's error code (route, extent or opening each get a sentence;
anything else asks to resolve findings), never as raw compiler text. A send
compiles the plan as it stands and adds no authored edit or history step. The
last sent slot and the latest failure (including a send whose slot was not
made active) are UI-session state cleared by any document replacement; a
status region announces each result. The game target is neither authored nor
Redux state.

## Editor panels

The editor's route rail leads with three route-level panels before the biomes
([Structured Editor Workspace](STRUCTURED_EDITOR_WORKSPACE.md#route-rail)).
The editor works on one route per project and never holds sibling route runs;
no route-specific reducer or second authored navigation tree exists.

### Route

Route holds Plan up to (the plan's extent), the run modifiers with Practice
mode, and the whole-plan status. It carries no finding marker.

Run modifiers render from the engine's
[run modifier declarations](RUN_START_INSTALLATION.md#run-modifiers) by declared kind, on
every route including Fresh File: a toggle for a boolean, and for an optional
percentage a checkbox with a 0–100% slider that is disabled and shows no value
while unchecked (unchecked means native). Labels and hints come from the
declaration. Application binding reads engine-owned defaults and validates the
complete replacement through the engine before dispatch. A slider stays local
until pointer release, key release, blur or Enter, giving one history edit per
gesture; sibling and unrelated edits keep that local value and its commit uses
the current siblings. An authored change to it refreshes it, and any accepted
document replacement clears it. The last enabled value is kept in UI state
only, so re-enabling restores it while the panel stays open; with none,
enabling starts at 100%. Each control carries its hint as an accessible
description, and the editor-session replacement revision that clears local
values is transient and outside history. Stored values outside the domain clamp on decode.
`internal` declarations render only in development builds and builds made with
`VITE_INTERNAL_FEATURES=1`.

Practice mode is the last row ([Practice mode start](RUN_START_INSTALLATION.md#practice-mode-start)):
a checkbox, a Start at picker and a Gold field, the latter two disabled while
unchecked. Checking opens the picker over the engine's start-point domain
(evaluated when it opens): biome rows of Opening, Preboss and Boss, an
unavailable option disabled and hinted only when branches disagree. Only a
choice sets the value; dismissing an unchosen picker unchecks and returns
focus to the checkbox. Unchecking removes the start point and its gold in one
edit. Gold is added to the game's own starting gold; empty adds none. A saved
start point that became ineligible stays checked and marked unavailable; the
slot picker states why.

### Draft

Draft describes a world and basket and runs [Draft mode](DRAFT_MODE.md) on
the route in a worker; the result applies as one edit. It has Draft and
Advanced tabs. Draft holds the run (loadout controls, rack keepsakes for each
planned biome's Postboss; god keepsakes are refused), the god pool in click
order with its rules and a reset, story and field NPCs per planned biome, and
the basket. When the route already has topology the tab notes that drafting
replaces it.

The basket shows read-only as three lines (God, Bonus and NPC traits), each
giver's icon then its traits, numbered in pick order for queued givers, with
refused traits marked and order refusals as notes. Clicking a line opens the
basket dialog on the matching tab, scrolled to the clicked giver. The dialog
lists each tab's givers with their caps; queued sections (pool gods, Hermes,
Hammer) keep pick order and have a per-section reset. A Duo appears in both
its gods' sections: picking it under one leaves it disabled under the other
with the host named in a hover hint. Refused traits stay listed but cannot be
added.

Advanced holds god-boon targets per biome and the per-god cap, room forcing,
resource rooms, Shop buys per biome, the filler ranking with an optional
per-run amount for each ranked kind, Prefer midshops, Pursue the Tartarus
goal, and retries, with Reset to defaults.

The action row shows the seed, share code copy and paste, and Draft and
Reroll, disabled with the refusal as a hint while the spec cannot be drafted;
while running it shows elapsed time and Cancel. Afterwards it lists unmet
targets and extras; a failed draft says no plan was found (naming the biome
when known), a refused spec says it cannot be drafted, an unexpected stop says
so, and a project changed during the draft reports that nothing was applied.

### Loadout

Loadout holds the starting choices (on Fresh File only its fixed weapon) and
is the anchor for route-scoped and route-start findings; it carries the same
status marker and finding count as a biome.

## Run State sheet

A launcher opens the read-only sheet for the exact engine Run State snapshot
it binds ([where launchers appear](STRUCTURED_EDITOR_WORKSPACE.md#run-state-launchers)).
The sheet is non-modal, anchored beside the workspace so the active inspector
stays in place, and carries no authored control. Its header names the moment
("Before Combat 12 · Oceanus") and keeps the close control in reach. Opening
focuses the close control; Escape or close restores focus to the launcher. The
open target, tab and disclosures are transient state outside history and
persistence; an open sheet clears when its snapshot or launcher disappears.
Opening, closing or navigating it issues no command, candidate preparation or
simulation.

Every fact comes from the snapshot, formatted by the application into finished
rows; React counts no lifecycle events, evaluates no thresholds and predicts
no automatic target. Rows use catalog labels, never internal keys or raw
engine states. Each row is a name, one bracket and a right column. The bracket
is one engine-published effect: a countdown of what is left, a build-up toward
its total, a current value, or an on/off or one-use state, qualified by the
engine's clock unit. The right column holds rarity and level, Hammer rank,
talent level, keepsake stars, Arcana rank (always shown) or Vow rank, or a
value; rarityless traits and Rank I Hammers leave it blank. An Infusion shows
its activation or element count instead of its rarity, with no bracket; Chant
keeps its rarity. Source-only
markers are omitted: a keepsake-granted Hammer is an ordinary Hammer row with
its encounters left.

The effects product covers the aspect rank, the keepsake block and per-biome
keepsake history, trait clocks (Steady Growth, clocked producers,
`RoomsPerUpgrade` growth, keepsake-granted Hammer encounters), Infusion
activation and element counts, Gold Gold Gold's pending state, the
acquisition order of non-slot traits and matured Chaos blessings, Arcana
growth and Artificer charges, Barren, timed Well instances and held Well
charges, Chaos curses, Shrine deliveries and Path of Stars talent levels.
Equipped and banned traits, Forfeit's state from the Arcana/Fear ledger, and
keepsake history all come from the snapshot rather than the loadout, room
list or inventories.

Six tabs are always present in this order; a section without rows is omitted
and an empty tab says nothing is active:

- **Overview:** the loadout (the aspect at Rank V, VI once made Perfect, then
  the familiar), Max Health and Max Magick with their sources, Armor assuming
  no damage; the keepsake block (equipped keepsake, then each running effect of
  it or a kept keepsake: a forced-boon keepsake is Ready until its boon is
  delivered and Used after, Jeweled Pom Active until invalidated);
  non-zero element counts; traits with the slot boons first, then other traits,
  matured Chaos blessings and consumed Gold Gold Gold in acquisition order; the
  Hex and its invested talents.
- **Effects:** Well (timed buffs, remaining charges), Shrine (pending
  deliveries) and Chaos (active curses with their blessings).
- **Keepsakes:** history only, one row per entered biome (a Postboss rack swap
  shown on the biome it ends), then kept keepsakes, then Fated status once
  known.
- **Arcana:** equipped, then temporary cards, then Barren.
- **Fear:** active Vows, then Forfeit, Circe-disabled Vows and banned traits.
- **More Info:** gods already in the ordinary pool (not possible future
  sources or the source-cap state), Hex details (layout, capacity, God Sent,
  Path points banked and invested, shown before a Hex once Moon Beam has
  banked points), the Reward Store Ratio
  (run-wide entered-store tallies, the current ratio and the biome's target in
  effect; a biome where no door rolls says it ignores the store or rolls only
  one), counters, and the reward bags with their eligible and ineligible
  groups, without claiming which upcoming door can be selected.
