# Spawned loot notifications

Status: shape settled by the owner (2026-11-08); not started. Temporary
plan; delete at delivery after promoting durable results.

Two independent parts, delivered separately so part 2 can be rolled back.

## Part 1: spawn notifications (current engine)

- A Timeline notification row appears at each moment the game spawns loot
  on its own, listing what spawned there in the game's spawn order: room
  entry in Opening rooms; Encounter ended (room reward, Hermes deliveries,
  Supply Chain drops; `RunEvents` spawns the reward, then
  `EndEncounterEffects` expires delivery traits, then `CheckChamberTraits`);
  in O combat phases a second moment after the reward is collected
  (`WaitForNextEncounterReady`); the Preboss delivery flush at room entry.
  Echo gold, Quick Buck and Buried Treasure join where they spawn
  (timing to confirm).
- Pickups spawned together can be taken in any order; the Timeline order
  stays the authored order and works as today. Clicking an item opens or
  places its action (collect, Time Piece goldify, Artificer transform).
- Intentional conversions (Artificer) are not spawned loot.
- Engine behaviour is unchanged: automatic insertion stays. The engine
  publishes the spawned set per moment (or the planner composes it from
  existing products if they suffice).

## Part 2: no automatic insertion (separate, revertible)

- Edit settlement and default room state stop inserting spawned loot (room
  reward collect, required deliveries, Echo gold); other required actions
  (cage completions, unlock presses, fountain, Nemesis) keep theirs.
- One generic "required pickups not collected" finding.
- **Collect all required** on a notification places every remaining
  required pickup as a plain collect in spawn order, in one edit; optional
  pickups are never placed by it.
- Draft and run import place what they relied on being inserted;
  equivalence and Draft corpus lanes run before and after.

## Later (map)

Each notification maps to one cluster per room at a display spot away from
other markers: a generated default with a small hand-override table.
