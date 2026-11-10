# Room position defaults

Status: engine slice delivered (schema 102.1); game module and planner steps
pending. Temporary plan; delete at delivery. The model lives in
[position defaults](../design/SIMULATION_AND_VALIDATION.md#position-defaults).

## Work

1. Game module: steer every published position; the partial-pool native
   fallback path goes. Needs the owner's in-game test.
2. Planner: drop the "the game decides" (`?`) options; show defaults as
   ordinary positions. A planned run is predictable, and the game module
   steers every position.

## Ephyra End plan before side visits (planner)

End plan on any Leave room picker in an Ephyra main room means returning to
the Hub there and ending the plan in that room: one edit that cuts the visit
order at that picker (as the Hub option already does) and sets the plan end
on the main room. No schema, wire or game-module change.
