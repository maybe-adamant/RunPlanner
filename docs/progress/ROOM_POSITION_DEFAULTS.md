# Room position defaults

Status: engine slice (schema 102.1), planner and game module delivered; the
owner's in-game test is pending in
[room layout steering](../testing/ROOM_LAYOUT_STEERING_LIVE_ACCEPTANCE.md).
Temporary plan; delete at delivery. The model lives in
[position defaults](../design/SIMULATION_AND_VALIDATION.md#position-defaults).

## Work

1. Game module: steers every published position; the partial-pool native
   fallback path is gone. Done; needs the owner's in-game test.
2. Planner: the `?` options are gone; Layout shows each default as an
   ordinary position, marked Default in the open list, and a chosen position
   returns to its default through its Default choice. Done.

## Ephyra End plan before side visits (planner)

End plan on any Leave room picker in an Ephyra main room means returning to
the Hub there and ending the plan in that room: one edit that cuts the visit
order at that picker (as the Hub option already does) and sets the plan end
on the main room. No schema, wire or game-module change. Done.
