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
- Fields: cage and optional rewards notify at room entry, where they spawn,
  each item marked by its cage.
- Action-driven spawns (Quick Buck and Buried Treasure on taking their boon,
  Echo gold on a World Shop purchase, Echo's last reward, Nemesis and Eris
  gifts after their dialogue, challenge-switch loot when claimed) get a
  read-only row under their source action, like the Travel Deal follow-up
  row: "Gold spawned", "Buried Treasure spawned X, Y, Z".
- Intentional conversions (Artificer) are not spawned loot.
- Engine: one read-only spawn-moments query per room (moment kind, phase,
  stable key, items in game spawn order with participation, placed state and
  placement command) plus each action's spawned children, built from what
  spawned rather than from placed rows so Part 2 needs no new source.
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
