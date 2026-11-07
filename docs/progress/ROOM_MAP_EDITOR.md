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
2. Engine slice: anchor identity per object (Well pins), entry point,
   orientation (derived for door-decided rooms, authored for random rooms,
   fixed otherwise) as authored data with game-module steering; Draft and
   run import adapt. Minor schema revision. Verify that a flipped room equals
   the mirrored clean capture before showing flipped maps.
3. Interactive map: anchors, Chaos point, entries, doors and rewards open the
   same pickers as their left-panel controls.

## Evidence

- Point data spec, orientation table, capture tool assessment:
  `~/run-planner-investigations/map-editor/` (outside the repo).
- Clean F captures with their RCMAP records: `captures/raw/F/manifest.json`
  there. Screen pixel = centre + zoom * (width / 1920) * (world - camera
  target), verified on all 35 F rooms.
- Game rules: anchors take a random free anchor in native order with the Well
  pinned in six Postboss rooms (F, G, H and the three Dream) (ROOM_FEATURES_GAME_DATA_AUDIT); flip rule
  RoomLogic.lua:4363-4369; entry choice RoomPresentation.lua:1135-1175.
