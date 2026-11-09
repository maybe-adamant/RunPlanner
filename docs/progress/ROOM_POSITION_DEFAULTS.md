# Room position defaults

Status: shape settled by the owner (2026-11-09); not started. Temporary plan;
delete at delivery after promoting durable results.

Replaces the approved schema 103 bump: every positioned item always has a
position, without storing defaults.

## Settled model

- Positioned items: object anchors; Fields cage, optional reward and Nemesis
  slots; the Chaos gate point; a rolled flip and a tied entry. Door-decided
  entry and flip stay derived from their door.
- An item with no stored position takes a stable-random default, derived on
  every evaluation like the last-free-anchor rule: each item scores every
  eligible point by a stable hash of (item identity, point) and takes its best
  free one, items claiming in a fixed declaration order (rendezvous hashing),
  so choosing one item's position moves only the defaults whose own best
  point it took. Flip and tied entry use the same hash over their choices.
- A stored position is the owner's choice. It is kept when it becomes
  invalid and raises a finding; a default never does, since it re-derives.
- "The game decides" (`?`) is no longer offered: a planned run is
  predictable, and the game module steers every position.
- Draft and the run import take the defaults without authoring them.

## Compatibility

The authored shape is unchanged and nothing is migrated. An absent position
changes meaning from "the game decides" to "engine default, steered", which
changes the plan wire and can change behaviour of existing saves: a minor
`schemaRevision` bump, announced in the commit. If the engine work finds a
stored-shape change necessary, stop and return to the owner.

## Work

1. Engine: derived defaults for every positioned item, published in the room
   layout products and the execution plan; findings for invalid chosen
   positions; "needs a choice" for unplaced pickups that need an input (the
   Supply Chain Pom Slice's Pom), replacing the planner's Pom-type list.
   Independent review.
2. Game module: steer every published position; the partial-pool native
   fallback path goes. Needs the owner's in-game test.
3. Planner: drop `?` options; show defaults as ordinary positions.

## Ephyra End plan before side visits (planner)

End plan on any Leave room picker in an Ephyra main room means returning to
the Hub there and ending the plan in that room: one edit that cuts the visit
order at that picker (as the Hub option already does) and sets the plan end
on the main room. No schema, wire or game-module change.
