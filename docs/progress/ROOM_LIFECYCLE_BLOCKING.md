# Room lifecycle blocking

Status: locked 2026-10-05. Base: `b69eea52`. No schema change.

## Objective

A finding stops evaluation at the exact product that cannot settle, and
nothing reached before that product disappears from the workspace. Three
contract corrections:

1. A room's exit belongs to the room; the next room's doors and content belong
   to the next room.
2. Each room settles in three ordered stages: Overview, Timeline, Exit.
3. An invalid product in the middle of a room's Timeline keeps everything
   before it, makes the whole blocking product the repair region, and shows
   everything after it read-only.

## Room lifecycle stages

| Stage    | Question                                   | Contains                                                                                                                                                                    |
| -------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview | What is the room and what does it contain? | Everything defined on entry: encounter selection and Shop, Shrine, Well and Contract inventory. The room's door reward is generated with the source room's doors, not here. |
| Timeline | What happens in the room?                  | Ordered room actions, encounters, acquisitions, purchases, refills, deliveries.                                                                                             |
| Exit     | Where to go next?                          | The room's exit work (pending Shop completion, resource placements, leaving snapshot), then door generation and the door selection.                                         |

Each stage settles before the next starts. The room's exit work settles before
its door generation; door generation belongs to the source room's Exit stage,
and the next room's Overview belongs to the next room.

Any Overview product that reads Timeline-produced state is a modelling error.

## Facts

- The native order is: previous room's exit work, then the next room's content
  generation, then room setup (`RoomLogic.lua:4243-4273`, `:4392-4394`,
  `:1067`). Shrine and Well inventories are generated in that transition
  (`StoreLogic.lua:436-452`) and only unlocked after the encounter
  (`RoomLogic.lua:4056-4078`); their refills and rerolls happen at purchase.
- The planner already orders the room's exit work (`roomExited`:
  pending Shop completion, resource placements, `beforeRoomExit` snapshot)
  before door generation (`beforeTargetGeneration`).
- Today, any finding owned by a room that is a target of decision _i_ clamps to
  "decisions before _i_, frontier at _i_'s exit batch, targets not entered"
  (`simulation/progressive/prefix.ts` `clampPrefix`). The source room never
  runs `roomExited`, and the blocked room's whole Timeline is re-evaluated
  away, then an allowlist of products is spliced back
  (`progressive/selected-products.ts` `retainBlockedRegionProducts`).
- Measured losses today: the source room's `beforeRoomExit` on every
  target-owned block; the Shop's `roomEntered` on a Shop inventory block;
  earlier same-room trait offers and their capabilities, earlier level
  resolutions and Run State snapshots on a Timeline block; the whole fixed room
  on a Boss or Postboss Timeline block; every decision on an opening-room
  Timeline block.
- Positions already exist on the located finding (`historySequence`,
  `historyBoundary`, `roomTimelineIndex`), pickups, acquisition roles,
  encounters, producers, timed effects and Run State snapshots. Trait offer
  capabilities and level resolutions have none.
- Findings already carry an engine atomic region with chronology
  (`simulation/finding-regions.ts`). Shop settlement uses one region for the
  whole Shop (`ownerRegion(room.origin)`).

## Correction 1: the exit belongs to the room

- A block at door generation or later (an invalid door offer, a door-owned
  finding, anything owned by the next room) runs the source room's
  `roomExited` before stopping. The source room keeps its exit work and
  `beforeRoomExit` snapshot.
- An invalid door offer blocks at the source room's door generation: the
  door rewards are the repair region; the source room's Overview, Timeline and
  exit work stay settled.
- Anything in the next room never changes the source room's door selection.
- Door generation reads the source room's settled products only: the Shrine
  re-assessment in `generation/target-policy.ts` reuses the stored entry
  assessment instead of re-running it at the door view.

## Correction 2: stages settle in order

- An Overview finding (Shop, Shrine, Well or Contract inventory, encounter
  selection) blocks at the room's Overview: the room is
  entered and keeps `roomEntered`; the Overview is the repair region; the
  Timeline and Exit show read-only.
- Shop inventory findings move from the door to the room's Overview.
- Gate 2 first classifies every entry-time product against the native order
  (for example Fields cage rewards and encounter selection) and moves any that
  settle later to the Timeline.
- An architecture or engine test enforces that Overview assessments read only
  entry state.

## Correction 3: a Timeline block

- The blocking product is the engine atomic region of the blocking finding.
  Every Timeline row that region owns is editable and carries its findings,
  whatever row shows the first finding. The engine publishes that row set; the
  application never infers it.
- Products positioned before the blocking product are published from the
  selected attempt, not re-evaluated, with their candidate capabilities.
- Rows of the blocking product keep the capabilities they reached; rows past
  the failure inside the product stay editable with declared domains.
- Rows after the blocking product, the room's Exit and later rooms show their
  authored values read-only (existing unreached hint); nothing after the
  blocking product is evaluated.
- Applies to ordinary rooms, fixed Boss and Postboss rooms, the opening room
  and Hub visit local lifecycles.
- Trait offer capabilities and level resolutions gain positions so one
  position cut replaces the allowlist; the superseded clamp branches and
  allowlist code are deleted.
- A coarse region (a whole Shop) makes the whole Timeline region editable;
  nothing is dropped. Splitting coarse regions is a non-goal.

## Ownership

Engine (`packages/planner-engine`): finding location by stage, clamp and
publication, positions, region row set, readiness. Application
(`apps/planner`): read the published row set and reached capabilities; no
chronology inference. Catalog, schema and game module: untouched.

## Gates

1. `fix(engine): settle the room's exit before its doors` — correction 1;
   witnesses for an invalid door offer and a next-room block keeping the source
   room's exit snapshot, Shop completion and resource placements; Shrine
   door-view reuse.
2. `fix(engine): settle the room Overview on entry` — correction 2; Shop
   inventory blocks at the room's Overview with `roomEntered` kept; Overview
   read-only invariant.
3. `feat(engine): publish a room Timeline up to its blocking product` —
   correction 3 for ordinary rooms: positions, region row set, position cut,
   deletion of the superseded allowlist paths; application adapts read-only
   rows.
4. `feat(engine): …` — correction 3 for fixed rooms, the opening room and Hub
   visit lifecycles, deleting their clamp branches.
5. Closure: SIMULATION_AND_VALIDATION (completeness table, readiness),
   ROOM_LIFECYCLE_MODEL (stages), EDITOR_MODEL, STRUCTURED_EDITOR_WORKSPACE;
   delete this plan; full gate.

## Tests

Engine primary owners: `test/simulation/progressive-*` for location, clamp and
publication; witnesses per correction built from existing builders
(`surfaceEncounterShowcaseProject`, Underworld golden G Shop, Echo Gold Anvil,
Travel Deal refill Anvil). Application: projection witnesses that a, b and c
keep their controls and candidates, the blocking product's rows are editable
with findings, and later rows are read-only. Equivalence: simulation and
candidate digests of blocked entries change; list them before rewriting; plan
digests stay unchanged.

## Non-goals

Splitting coarse engine regions, changing what a finding means, schema or
protocol changes, door generation timing beyond the exit ordering.
