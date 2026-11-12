# Room layout steering live acceptance

Requires a current planner and an installed game module of the same schema
pair, and a complete-valid plan sent and set to play next. Every positioned
item the game would place at random has a planned position, chosen or default,
and the module steers each one. Use two plans, or one plan with both kinds of
room: one where no position is chosen (every room on its defaults, as Draft or
the run import leaves it), and one that chooses, in its rooms' Overview Layout
section, a non-default entry, a flip, an anchor, Fields points and a Chaos gate
point. Before each run, note the planner's Layout values for the rooms below.
Layout differences are diagnostics, never mismatches: the run stays
synchronized either way. The owner confirms or waives each check.

## Entry and flip (any combat room with a rolled flip or a choice of entries)

- [ ] Each such room is entered at the entry its Layout shows and flipped as
      shown, default or chosen; no `room-entry` or `room-flip` diagnostic. A
      door-decided entry raises at most `room-entry-forced`.
- [ ] Replaying the default-only plan enters each room the same way again.

## Object anchors (rooms with a Well, Pool, Shrine or challenge switch)

- [ ] Each object stands on the anchor its Layout shows, default or chosen;
      no `room-anchor` or `room-anchor-unavailable` diagnostic.
- [ ] A room with two or more objects puts each on its own shown anchor; a
      Meta Reward Stand, when one spawns, takes a remaining anchor.
- [ ] A Well on its room's pin stands there.

## Fields points (Mourning Fields H combat rooms)

- [ ] Every cage and optional reward spawns at the point its Layout shows,
      default or chosen; no `fields-point` or `fields-placement` diagnostic.
      A diagnostic naming every item at once means the game's loot or bonus
      reward point lists came back empty.
- [ ] A Nemesis event appears at its shown point; no `fields-nemesis-point`
      diagnostic.

## Chaos gate (a room hosting a Chaos gate with several gate points)

- [ ] The gate spawns at the point its Layout shows, default or chosen; no
      `chaos-position-unavailable` diagnostic.
