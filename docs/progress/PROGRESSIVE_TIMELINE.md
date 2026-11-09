# Progressive room Timeline

Status: shape settled by the owner (2026-11-09); not started. Temporary plan;
delete at delivery after promoting durable results.

The room Timeline shows how far the room has settled, and pickups and objects
are authored from a live row. Builds on the engine's insertion at any legal
index (room action insert proposals, the purchase commands' optional index and
their insertion-index query); Part 2 of [spawned loot](ENCOUNTER_END_PICKUPS.md)
follows it.

## Banners are events the engine announces

A phase banner (Room entered, Encounter started/ended, Next phase ready,
Doors open, Leave room) is never placed by the owner: it is an event the
engine announces when the walk reaches it, brought about by the rows before
it (clearing the encounter announces Encounter ended; using the fountain or
completing the last required action announces Doors open). Banners share the
Timeline with rows and can host choices, but cannot be inserted, moved or
deleted. Insert here on a banner places a row right after that event; Reset
from here removes rows, and banners those rows would have brought about
disappear until the walk reaches them again.

## Presentation direction (owner 2026-11-09, after the engine work)

Banners stop being the Timeline's spine. The Timeline is one chronology of
three tiers: events the engine announces (Room entered, Encounter
started/ended, Next phase ready, Doors open) styled as emphasized notices,
which may host choices; notices (Spawned, Unlocks, Delivered, Restock) in the
quiet notice style; and authored actions with handle and trash. No nesting of
rows under banners; ship phase tabs and the Combat order header stay. Shape
iteration with two or three styling candidates (emphasis levels; optionally a
moment's spawn chips folded into its event line) on an ordinary combat room,
H Fields, an O ship room and a Postboss.

## Events pass independently of what they spawn (owner 2026-11-09)

- An event is passed once it happens: Encounter ended is passed when the
  encounter ends, even while items it spawned are unresolved; an action that
  spawns (the Artificer once its output is chosen) is passed, and its output
  resolves on its own row. An unresolved spawned item stops the walk at that
  item (its row or its deadline), never at the event that spawned it. Engine
  change folded into Part 2, where pickups get their own deadlines.
- Encounter events (owner 2026-11-09, settled):
  - **Encounter started** holds only what genuinely belongs at the start:
    Fig Leaf (fought or skipped; the game rolls it before enemies spawn, and
    a skip short-circuits the fight, so no outcome follows).
  - **Encounter outcome** carries everything about how the fight ended, shown
    only when a choice is eligible and the fight was not skipped: the Aetos
    wave, the Gorgon condition, the Nemesis bet, the Nemesis event result,
    Anomaly cleared; in Boss rooms Boss defeated returns as the outcome with
    Judgment and Figurine. At most two choices per phase ({Aetos, Gorgon});
    Nemesis, Anomaly and Boss choices are alone.
  - **Encounter ended** is a pure event: it announces what spawns from the
    outcome; each spawned item settles on its own row.
  - The walk reads each choice at the event hosting it: Aetos and the Gorgon
    condition move from the encounter start to the outcome point (Fig Leaf
    stays read at the start). Engine point: the walk's existing encounter
    completion, published as a Timeline boundary; no plan-wire change while
    it stays a Timeline event.
  - Arachne cocoon rooms fold into the ordinary room model with the game's
    timing: cocoons appear on entry with the reward hidden (not spawned, no
    locked notice); breaking the reward cocoon spawns the reward and ends the
    encounter; collecting it opens the doors. The "during the encounter"
    spawn moment is removed.
  - Order: after the stale-row task, before the presentation round;
    equivalence before/after and independent review.

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

A prefix is invalid when a required action's deadline falls inside it and
the action is not in it: a placed required action of an earlier window after
k has its deadline before k, so k is not reached ("<action> must come
first"). This is the rule itself, not a stricter variant. Postboss: using the
fountain opens the doors, and the Well, Pool and Shrine are usable only from
then (owner); the walk must stop at an object interaction placed before the
fountain rather than flag the fountain (to fix).

## Owner answers (2026-11-09 morning)

- Doors, door picks, side-visit picks and the Leave row appear only once the
  walk reaches Doors open (the door unlock event); a stop after Doors open in
  a Postboss also hides them until the earlier rows are correct.
- A room stopped before its Timeline starts (an Overview issue), or a ship
  phase waiting on an earlier phase, shows one plain line on its Timeline
  saying issues before it must be fixed first.
- Not reached yet rows cannot be reordered (no drag handle); deleting them
  stays, as clean-up. The group is collapsed by default and expands on click.
- A missing required pickup's stop is where the walk actually stops (its
  spawn) until Part 2 moves the walk's stop to the deadline.

## Notices follow settled sources

A spawn notice (Spawned, Unlocks, Delivered, an action's spawned row) appears
only once the walk has settled its source and actually produced the item: an
unresolved source (e.g. an Artificer transform whose output is not chosen)
shows no notice, its own row marks what is missing (owner 2026-11-09). The
engine's spawned-loot product publishes only settled spawns; the planner does
not filter. Spawning and resolving are separate: when the walk reaches a
moment, everything the game spawns there together is listed, even while one
item's resolution (a Pom target, a delivery's boon) is what blocks; the
Artificer differs because its unchosen output is the spawn itself. Ship wheel
deferred items spawn only after the wheel reward is collected.

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

## Stale and invalid rows (owner 2026-11-09)

- A row whose context is gone (stale: nothing in the room offers it any more)
  is removed by the edit that orphans it, in the same edit and Undo step, and
  the planner announces it ("N actions no longer apply", with Undo). Nothing
  is kept hidden and nothing revives on its own later: the Timeline shows
  what is saved. Old saves' stale rows are removed the first time their room
  is edited, with the same announcement.
- A row that is merely invalid (a purchase the game refuses, e.g. a Shop boon
  past the god cap, a Purging Pool sale of a trait that cannot be sold, a row
  out of order) stays visible with a finding to repair or remove it. The
  Purging Pool sale is reclassified from stale to invalid.
- A reward swap re-keys its pickup rows in place: settlement pairs the old
  rows with the reward's new pickup roles by the catalog's declared role
  order, keeping each row's position; leftover old rows are removed and new
  roles placed at their default. Rows of the owner an edit addresses change
  silently; only rows orphaned elsewhere are announced.
- Rooms the run stops entering keep their rows (an unselected leaf keeps its
  room-local state, as reanchoring does); cleanup applies to entered rooms.
- Reset from here is a clean slate: before the Postboss keepsake rack it also
  returns the rack's keepsake choice to its default (keep the held keepsake).

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
