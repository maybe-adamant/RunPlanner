# Room layout steering live acceptance

Requires a current planner and an installed game module of the same schema
pair, and a complete-valid plan sent and set to play next that sets, in its
rooms' Overview Layout section, a non-default entry and a flipped room, an
anchor for at least one Well, Pool, Shrine or challenge switch, and Fields
cage and optional reward points in a Mourning Fields (H) room. Layout
differences are diagnostics, never mismatches: the run stays synchronized
either way. The owner confirms or waives each check.

## Entry and flip

- [ ] Each room with a planned entry and flip is entered at that door and
      flipped as planned; no `room-entry` or `room-flip` diagnostic. A
      door-decided entry raises at most `room-entry-forced`.

## Object anchors

- [ ] Each planned object stands at its planned anchor, the room's other
      objects included; no `room-anchor` or `room-anchor-unavailable`
      diagnostic.
- [ ] A room with two anchored objects puts each at its own anchor, never the
      other's: the draw each anchor reserves is the object's own.

## Fields points

- [ ] In each H room with planned points, every cage and optional reward
      spawns at its planned point; no `fields-point` or `fields-placement`
      diagnostic. A diagnostic naming every item at once means the game's
      loot or bonus reward point lists came back empty and steering fell back
      to native placement.
- [ ] A room with only some points planned places those and leaves the rest
      to the game.
