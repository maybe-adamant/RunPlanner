# Progressive room Timeline

Status: shape settled by the owner (2026-11-09); not started. Temporary plan;
delete at delivery after promoting durable results.

The room Timeline shows how far the room has settled, and pickups and objects
are authored from a live row. Builds on the engine's insertion at any legal
index (room action insert proposals, the purchase commands' optional index and
their insertion-index query); Part 2 of [spawned loot](ENCOUNTER_END_PICKUPS.md)
follows it.

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

## Insertion is judged by its prefix

Settlement works inside a room the way the engine walks rooms in a biome. A
row inserted or moved to position k is legal when rows 1…k-1 with it at k are
valid as the walk reaches k: its window is open, its dependencies are in the
prefix, no later-window row precedes it. Rows after k take no part; a later row
the edit invalidates gets its finding when the walk reaches it, or the room
stops there and the row joins Not reached yet. Nothing is refused for a
downstream problem and nothing is deleted. One shared engine rule serves
commands, insert and move proposals and the purchase insertion query
(owner 2026-11-09). Engine step on this branch, independently reviewed,
before the planner work.

## Required pickups: window and deadline

- A required pickup's window opens when it spawns and closes at its deadline,
  the last slot its window and dependencies allow (engine: Timeline insertion).
- Once automatic placement is removed (Part 2), a required pickup not placed
  by its deadline stops the walk there, with a finding naming it ("collect X
  before going on"): one finding per room listing what is missing, at the
  earliest deadline. Placing it lets the Timeline settle further.

## Live row

- Shows what is live at a Timeline position: spawned and untaken loot, plus
  the objects usable there. Clicking places the pickup or object at that
  position, through the engine's insert-at-index commands and query.
- By default it sits at the room's frontier (its stop or end). **Insert here**
  (`+`) on any row or phase banner opens it right after that row, or at the
  phase's start; which one is open is UI-session state, never history.
- One per ship phase. Optional actions disappears into it.

## Reset from here

- **Reset from here** on a row removes this room's Timeline actions after it,
  as one engine command, one edit and one Undo step, no dialog: the frontier
  returns to that row. Door picks, encounter settings and other rooms are
  untouched; later rooms re-settle.
- Until Part 2, required pickups placed automatically return at once; the
  reset fully restores the frontier only once automatic placement is off.

## Row actions

`+` and reset sit beside the trash can, in its quiet style, shown on the
hovered or focused row only; the trash can keeps its current visibility.

## Order

0. Prefix-judged insertion and moves (engine).
1. Progressive phases and Not reached yet (planner, over existing engine
   stop and reached-phase products; engine additions only if a reached-phase
   fact is missing).
2. Live row, Insert here and Reset from here, with automatic placement still
   on.
3. Part 2: automatic placement off for spawned loot, "Collect all required",
   the missing-pickup finding. Separate, revertible; starts with an inventory
   investigation recording the decision for each pickup kind.
