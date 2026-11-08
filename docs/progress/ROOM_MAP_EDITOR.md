# Room map editor

Status: phase 1 in progress (owner go 2026-11-07). Temporary plan; delete at
delivery after promoting durable results.

## Shape (owner-settled)

The Overview and Timeline tabs become two columns: the complete keyboard
controls on the left, the room map on the right. The map is a projection of
authored state and engine products; positions are never authority, and every
map hotspot dispatches the same intent as its left-panel control.

- Overview map: the room's setup — doors, Chaos gate point, entry points,
  orientation, object anchors and what sits on each.
- Timeline map: the room at the selected Timeline row, like the Hub editor
  showing doors at Timeline points. Optional actions and chips move below the
  Timeline.
- F is the prototype for F/G/I/P/Q (shared door style, anchors including the
  challenge switch, Chaos points, entries, cocoons). O (wheel), N (Hub, side
  rooms) and H (cages) get their own passes.

## Phases

1. Read-only map on current data (no schema change).
   - 1a Catalog: per-room map points from the game's `Maps/bin/*.thing_bin`
     (exit doors, SecretPoints, ChallengeSwitchBase anchors, HeroStart/HeroEnd,
     Fields cage/optional points, cocoon points) with world positions, keyed
     by (room, native id), for every catalog room. Generated offline by a
     checked script; the catalog test cross-checks existing declarations.
   - 1b Planner: clean F captures replace the F map images with per-image
     calibration; two-column Overview/Timeline layout; read-only markers for
     doors (reward, lock, taken), the authored Chaos gate point, entries and
     anchor spots; Timeline row selection drives door/reward state; Optional
     actions below the Timeline.
2. Room layout data (design below, for owner review).
3. Interactive map: anchors, Chaos point, entries, doors and rewards open the
   same pickers as their left-panel controls.

## Phase 2 design: room layout (schema 102)

Owner-approved major bump (2026-11-07). Rule: whether something exists is
never optional; where an existing thing stands is optional when the game is
free to place it, and unset means the game decides. Each existing thing owns
its optional position; the room owns only its own facts.

### Who owns which position

| Thing (exists by)               | Optional position                       | Today               |
| ------------------------------- | --------------------------------------- | ------------------- |
| Room                            | orientation, entry point (`layout`)     | Fields entry only   |
| Anchor object (room content)    | `anchorId` on its leaf                  | none                |
| Fields cage slot (encounter)    | cage point per slot                     | required per slot   |
| Fields optional reward, Nemesis | optional point per slot / Nemesis point | required per slot   |
| Chaos gate (exit)               | `spawnPointIndex` on the exit           | optional, unchanged |

Fixed, not positions: exit doors and Ephyra side doors (a side room is bound
to a fixed door of its parent room; the authored choice is what lies behind
the door, which is route structure). Cocoon reward points stay in encounter
customization (keyed by phase; already optional). No position decides
rewards, encounters, gold or eligibility (Fields, route-detour and encounter
audits); only the execution assembly requires Fields points today.

### Changes

- **Room layout** `RoomOccurrence.layout?`: `flipped?` (authorable in
  random-flip rooms only; elsewhere preserved and flagged; door-decided rooms
  derive it later) and `entryStartPointId?` (a `HeroStart` id; every room).
  Room replacement clears it.
- **Fields**: the entry moves to the room layout; cage, optional and Nemesis
  points stay per slot and become optional. `fieldsSpatialPointMissing` is
  deleted with its Draft repair, app copy and import handling; the
  unavailable and duplicate rules already ignore unset siblings.
- **Anchors**: `anchorId?` must be an anchor of the room; no two objects on
  one anchor; in the six Well-pinned rooms the Well's anchor is the pin and
  the pin is never offered to others. Findings `roomObjectAnchorUnavailable`
  and `roomObjectAnchorDuplicate` preserve stale values. Open: the
  unmodelled Meta Reward Stand also takes a free anchor.
- **Chaos**: unchanged.
- **Editor**: each placement family is one line of spots sized by the map's
  point count, like the Objects line: cage spots hold C1..Cn, optional spots
  hold optional rewards or Nemesis, anchor spots hold objects. The spot line
  is a projection of "occupant -> point"; storage stays per occupant.

### Plan wire and game module

- `layout` block per room (orientation, entry: start plus the declared end
  where the catalog pairs it, else the module pairs the closest end); Fields
  points per slot become optional on the wire; objects publish `anchorId`.
- Steering: entry and orientation preset on the native room at realize;
  Fields and anchor picks through scoped `RemoveRandomValue` wraps that remove
  every planned point from the pool before an unset slot draws natively;
  conformance tolerates unset slots. The Lua decoder stops requiring the
  Fields block and the cage-count match.

### Migration 101 -> 102

Loss-free and small: `fieldsCombat.state.spatial.entryStartPointId` moves to
`layout.entryStartPointId` (null omitted); everything else keeps its place.
Follows the 100 -> 101 pattern (persistence transition, schema test, legacy
body, README history). Checkpoints and execution fixtures regenerate; Draft
settings and share codes are unaffected.

### Derivation (orientation and entry are mostly derived)

Native chain: the previous room's door and flip give its exit direction; a
room with a fixed entrance side flips exactly when that side differs from the
exit direction; the room's eligible entries are those whose direction matches
it, and the game picks randomly only among ties. Authorable choices are
limited to real rolls: flip in rooms without a fixed entrance side, and in
door-decided rooms entered with no exit direction (after Chaos or Dream)
unless their chance is 0; entry only among eligible ties. Everything else is
derived and shown. The rule is implemented from a static read and confirmed
by the in-game flip probe (capture tool `RCFLIP`/`RCENTRY`); corrections stay
inside the one derivation rule.

### Slices

1. Catalog: resolved flip facts per room, `HeroExit` points, and entry pairs
   (start, closest end, canonical direction).
2. Engine and schema 102: the derivation chain (derived flip and eligible
   entries per room), room layout, optional Fields points, object `anchorId`,
   findings, commands, migration, wire, fixtures; Draft and run import adapt.
3. Game module: layout and anchor steering with partial-plan pools and
   conformance.
4. Planner: spot lines for cages/optional/anchors, orientation and entry
   controls; the map shows them (phase 3 makes them clickable).
5. In-game probe confirms or corrects the derivation; flipped map display.

## N pass (owner-settled 2026-11-07, after O)

- The Side Rooms tab goes away. The Ephyra main room's Overview (Spawns)
  authors which side doors open and what each side room rewards; the game
  forces the open count by biome depth (0/1/1/2/2/3), so open-but-unvisited
  doors stay valid.
- The main room's Timeline owns the visits: Leave room picks the Hub or an
  open side room; a side room page leaves back to its main room, whose
  Timeline shows the next Leave choice, until the Hub is picked
  (`LocalVisitDecision.visitOrder`).
- Changing an earlier visit keeps later visits; a repeated room stays
  authored with an "already visited" finding (engine: allow repeats in the
  visit order and add the finding; no save becomes invalid).

## Follow-ups (recorded, not scheduled)

- `HeroStartPointEndPointLinkIds` is not modelled: the no-match fallback
  always pairs the lowest start with the lowest end, where the game uses the
  start's linked end when the room declares one.
- Chaos gates and the Zagreus Contract door are spawned at runtime and have
  no exit direction on record, so the next room's exit is unknown.
- N_PreHub01's `nextRoomEntries` keys on `EphyraExitDoorReturn` while its
  map door is `EphyraExitDoorReturnNE`, so that forced entry is never found;
  N_Hub's own fixed entry (the same pair) masks it today.

## Evidence

- Point data spec, orientation table, capture tool assessment:
  `~/run-planner-investigations/map-editor/` (outside the repo).
- Clean F captures with their RCMAP records: `captures/raw/F/manifest.json`
  there. Screen pixel = centre + zoom * (width / 1920) * (world - camera
  target), verified on all 35 F rooms.
- Game rules: anchors take a random free anchor in native order with the Well
  pinned in six Postboss rooms (F, G, H and the three Dream) (ROOM_FEATURES_GAME_DATA_AUDIT); flip rule
  RoomLogic.lua:4363-4369; entry choice RoomPresentation.lua:1135-1175.
