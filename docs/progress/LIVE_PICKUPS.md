# Part 2: live pickups

Status: framing settled by the owner (2026-11-10); step A delivered on
`live-pickups`; B's Draft half delivered, awaiting review; the run import's
half waits on an owner decision; C and D not started. Temporary
plan; delete at delivery after promoting durable results. Follows the
progressive room Timeline and spawned-loot notices, both delivered.

You either interact with pickups or active objects.

## Engine changes

1. **No automatic placement of required pickups.** Edit settlement and
   default room state stop inserting spawned loot (the room reward collect,
   required deliveries, Echo gold, a rushed Shrine purchase's optional
   pickup); other required actions (cage completions, unlock presses, the
   fountain, Nemesis) keep theirs. A required pickup still loose past its
   deadline (the last slot its window and dependencies allow) is a finding,
   and the walk stops there: one finding per room naming what is missing, at
   the earliest deadline. An event is then passed once it happens, even while
   items it spawned are unresolved; an unresolved spawned item stops the walk
   at its own row or deadline, never at the event that spawned it. Until
   then a missing required pickup stops the walk at its spawn.
2. **Live at Timeline position k.** The engine publishes what is live at k:
   loose pickups and active objects, each with its legal actions. The live
   row is that product at the walk frontier; the `+` at a gap is that product
   at that gap.

## Order

- **A.** The live-at-k product, a pure addition. Delivered: the
  [Live at a point](../design/ROOM_LIFECYCLE_MODEL.md#live-at-a-point) query,
  composed from the spawned loot, the room's published stop, the roster's
  proposals and the positioned commands' accepted indices (purchases and
  derived placements share one rule); no evaluation work, equivalence
  unchanged. Its witnesses (golden Underworld and Surface checkpoints) stand
  every reached row live at its own gap; in the shortest room of each action
  kind, the walk takes every offered placement and move at every gap through
  the frontier and takes none it was not offered at the gaps bounding each
  row's offered runs; each purchase and derived placement kind gets the same
  check; and a required row's deadline is the last gap the walk takes it at. Provisional classifications, current
  engine ownership, for the owner to confirm or change (classification, not
  structure):
  - Boss forced drop: a pickup (spawned-loot `requiredDrop`), required.
  - NPC and encounter contacts (Nemesis, Gorgon, Eris, field NPCs): actions on
    objects, required; what they drop is a pickup.
  - `completeFieldsCage`: an action on a `fieldsCage` object, required; the
    cage's reward is a caged pickup.
  - Hermes deliveries and Gold Gold Gold's duplicate: pickups at their derived
    host, placed by `PlaceHermesShrineDelivery` / `PlaceEchoGoldPickup` at any
    index the command accepts; required as the engine says today.
  - W8 rekey: settlement-time only; the product is read-only and carries
    nothing about it.

  Open items, temporary limits of today's walk and scope:
  - While a required pickup is unplaced, the walk stops at the event or source
    action that spawns it, so the pickup may not be live where it could go: a
    deferred Ship wheel's reward (its encounter end waits on it), an
    Artificer's replacement, a Nemesis trade's result, a delivery due after a
    wheel reward, a Fields cage reward (the stop rewinds to room entry), and a
    Boss room's reward after its forced drop (the stop rewinds before the
    drop's row). The witness pins each by room, row and kind; C's walk change
    should turn each into an offer at its own gap and empty the pin.
  - Not offered: a new door, cage, wheel, Well or Pool reroll, a Pool sale of a
    slot not yet chosen and a rack keepsake, each needing its own choice
    first; their rows are. Owner to decide whether the live row offers them
    (with the choice still to make) or they stay on their objects.
  - The walk takes Gold Gold Gold's duplicate before the purchase that spawns
    it: its row has no order dependency on that purchase. The live product
    offers it only once spawned; the witness pins this leniency for C or the
    owner to settle.
  - A choice's values (a blank Travel Deal item) are read where the room's
    reached actions end, not at the gap; the indices are value-independent.
  - Exported on the `simulation` entry with Draft, its first consumer.

- **B.** Draft and the run import author pickups from it, placing what they
  relied on being inserted.
  - Draft: a room's placement finding (required action, Hermes delivery, Gold
    Gold Gold duplicate) places, one at a time, each required pickup or object
    action live at the room's frontier by its offered command, the canonical
    restore when offered anywhere through the frontier, otherwise at the
    frontier. A required row the product does not offer at all falls back to
    the canonical schedule; witnessed only for a deferred Ship wheel's reward,
    pinned by the Draft witness for C to remove with that open item. Against
    the old schedule, 105 of 110 stripped golden rooms restore identically;
    the rest place at the frontier where the canonical index lies past it (a
    Boss room's reward before its forced drop) or complete every Fields cage
    before collecting the rewards. A stripped Hermes delivery lands at the
    frontier rather than settlement's due contact.
  - Run import: waits on the owner (canonical position vs. a "place all
    required here" engine helper).
- **C.** Remove automatic placement (change 1). If placements are derived,
  fold any old-plan materialization into the unreleased schema 103.
  Equivalence and Draft corpus lanes before and after; separate and
  revertible.
- **D.** The UI product as a whole:
  - the live row (one per Ship phase), placing through the engine's
    insert-at-index commands and query;
  - `+` and Reset on the Timeline spine as a gap menu: one control per action
    position; its menu lists what can be inserted there plus Reset from here
    (the engine command exists); hidden where nothing applies; which gap is
    open is UI-session state, never history;
  - removal of the Optional actions section (object pins later move onto
    their map objects);
  - chronology presentation: one chronology of events the engine announces
    (emphasized, may host choices), notices (Spawned, Unlocks, Delivered,
    Restock; quiet) and authored actions (handle and trash), with no rows
    nested under banners; ship phase tabs and the Combat order header stay;
  - two or three styling candidates (emphasis levels; optionally a moment's
    spawn chips folded into its event line) on an ordinary combat room,
    H Fields, an O ship room and a Postboss;
  - one copy pass.

Earlier shape to reconfirm against this framing: a **Collect all required**
action on a spawn notice placing every remaining required pickup as a plain
collect in spawn order, in one edit, never placing optional pickups.

## Also carried

- An engine-published reach/stop product, so the planner stops deriving
  `walkReached` and the room-stop cut from the walk's history (planner review
  follow-up).
- Rooms off the selected path hidden while the biome has a stop, shown again
  when it completes.
- Map clustering: each notice maps to one cluster per room at a display spot
  away from other markers, a generated default with a small hand-override
  table.

## Inventory

Inventory: pending (Part 2 step 0), recording the decision for each pickup
kind.
