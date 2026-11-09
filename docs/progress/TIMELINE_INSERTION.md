# Timeline insertion at any legal point

Status: shape settled by the owner (2026-11-08); engine pass not started.
Temporary plan; delete at delivery after promoting durable results.

The engine half of the progressive Timeline: every room action the owner
authors by inserting it can be inserted at any point its lifecycle allows, not
only at one engine-chosen slot. The live row (Timeline UI) and Part 2 of
[spawned loot](ENCOUNTER_END_PICKUPS.md) build on it later.

## Settled model

- A required action has a window: it opens when the item exists (spawned,
  unlocked, delivered) and closes at its deadline, the last slot its window
  and dependencies allow. It may be inserted anywhere inside, exactly as a
  placed one may already be moved. Play cannot progress past the deadline
  while it is unplaced: the existing unranked-required block already does
  that.
- Defaults keep their anchoring: a required action is prefix-anchored, placed
  by default at its canonical slot near the front of the room Timeline, ahead
  of later-window rows; a purchase or object interaction is suffix-anchored,
  appended by default at the end, its latest legal point.
- Purchases and other object interactions (Well, Shrine, World Shop and
  Travel Deal refill, challenge switch use, door unlock) are inserted at a
  chosen position within their window and dependencies, in one edit and one
  Undo step, instead of appending and being dragged.
- Legality stays structural: window ordinals, explicit dependencies and
  checkpoints (`afterCheckpoint`), as move proposals already judge it.
  Affordability, switch use and door state at a hypothetical position stay
  simulation findings, not insertion refusals.

## Engine pass

1. Required actions: `InsertRoomAction` accepts any index whose resulting
   order is structurally authorable, instead of only the canonical one, and
   the roster's insert proposals list every legal index for required rows
   (the canonical one stays the default, not necessarily the latest).
2. Required placements with their own commands (`PlaceHermesShrineDelivery`,
   `PlaceEchoGoldPickup`, and the optional `PlaceClockedTraitPickup`) take an
   optional index with the same rule; absent keeps today's placement.
3. Object interactions take an optional index (Well and Shrine purchases,
   Shrine offer purchase, World Shop purchase participation and Travel Deal
   refill, challenge switch use, door unlock); absent keeps today's append.
   A rushed Shrine purchase at a chosen index places the optional pickup it
   drops immediately after it (owner 2026-11-09); Part 2 later stops placing
   that pickup at all.
4. The read side publishes the legal insertion indices for each of these, as
   the generic insert proposals do for optional rows, so the planner can offer
   a position without probing.

Unchanged: automatic insertion and edit settlement (required actions still
land at their canonical slot), default room state, the authored shape and the plan
wire. No schema bump: commands are not persisted.

## Later

- Planner live row following the selected Timeline position.
- Part 2: no automatic insertion of spawned loot, with one "required pickups
  not collected" finding.
