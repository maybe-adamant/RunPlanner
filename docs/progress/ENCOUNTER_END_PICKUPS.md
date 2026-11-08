# Encounter-end pickups

Status: shape settled by the owner (2026-11-08); not started. Temporary
plan; delete at delivery after promoting durable results.

## Shape

- After **Encounter ended**, one spawned-loot chip lists every pickup that
  spawns at that moment, in the game's spawn order: the room reward, then
  Hermes deliveries, then Supply Chain drops (RoomLogic.lua encounter end:
  `RunEvents` spawns the reward, then `EndEncounterEffects` expires delivery
  traits, then `CheckChamberTraits` drops Supply Chain). The order is a game
  fact, not authored.
- Pickups spawned together can be taken in any order. Clicking an item in the
  chip places its action (collect, Time Piece goldify, Artificer transform)
  as an ordinary Timeline row; the Timeline order stays the authored order
  and works as today.
- No automatic insertion: the room reward's collect and required Hermes
  deliveries are no longer inserted by edit settlement. A required pickup
  left unplaced is a finding.
- **Collect all required** on the chip places every remaining required
  pickup as a plain collect in spawn order, in one edit; it reproduces what
  automatic insertion does today. Optional pickups (Supply Chain, a rushed
  same-room delivery) are never placed by it.
- No authored-shape change: placed actions are stored as today. Engine edit
  settlement changes, so Draft and run import must place what they relied on
  being inserted, and the equivalence and Draft corpus lanes run before and
  after.

## Later (map)

The spawned chip maps to one cluster per room at a display spot away from
other markers: a generated default (the free area furthest from other
markers) with a small hand-override table, like the Hub board nudges.
