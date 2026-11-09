# Progressive room Timeline

Status: shape settled by the owner (2026-11-09); not started. Temporary plan;
delete at delivery after promoting durable results.

The room Timeline shows how far the room has settled, and pickups and objects
are authored from a live row at the selected position. Builds on
[Timeline insertion](TIMELINE_INSERTION.md); Part 2 of
[spawned loot](ENCOUNTER_END_PICKUPS.md) follows it.

## Progressive phases

- A phase banner (Room entered, Encounter started/ended, ship and Fields
  phases, Doors open, Leave room) appears only once the engine's walk has
  reached it. No skeleton of unreached phases, as the biome rail already stops
  at its frontier.
- A room that stops (an issue at entry, a required pickup past its deadline)
  ends its Timeline at the stop with the issue.
- Authored rows past the stop never vanish: they sit, in order and without
  phase banners, in one dimmed **Not reached yet** group at the end, their
  controls waiting on the earlier choice. As the Timeline settles further,
  they return to their phases. Rows that are invalid in themselves stay repair
  rows where they are.

## Required pickups: window and deadline

- A required pickup's window opens when it spawns and closes at its deadline,
  the last slot its window and dependencies allow (engine: Timeline insertion).
- Once automatic placement is removed (Part 2), a required pickup not placed
  by its deadline stops the walk there, with a finding naming it ("collect X
  before going on"): one finding per room listing what is missing, at the
  earliest deadline. Placing it lets the Timeline settle further.

## Live row

- Shows what is live at the selected Timeline position: spawned and untaken
  loot, plus the objects usable there. Clicking places the pickup or object
  at that position, through the engine's insert-at-index commands and query.
- Follows the selected row; by default it sits at the room's stop or end.
  Selection is UI-session state, never history.
- One per ship phase. Optional actions disappears into it.

## Order

1. Progressive phases and Not reached yet (planner, over existing engine
   stop and reached-phase products; engine additions only if a reached-phase
   fact is missing).
2. Live row, with automatic placement still on.
3. Part 2: automatic placement off for spawned loot, "Collect all required",
   the missing-pickup finding. Separate, revertible; starts with an inventory
   investigation recording the decision for each pickup kind.
