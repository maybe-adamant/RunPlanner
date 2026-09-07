# H Fields Spatial Layout Plan

## Status

Architecture refreshed on 2026-09-06 after review of the live H catalog,
authored Fields state, reward materialization, structured workspace, installed
Hades II room-generation contacts, and the completed F/G live executor proof.
The bounded Nemesis source closure is complete. This plan is ready for its
planner-only implementation gates; H execution publication and realization
remain a separate follow-up boundary.

Current rebase baseline: `85c6f3e6`
Current authored schema: `77`; this plan advances it once to schema `78`.

The worktree also contains the new source audit and its audit-index entry:

- `docs/audits/rooms-and-routes/H_FIELDS_SPATIAL_POINTS_GAME_DATA_AUDIT.md`
- `docs/audits/README.md`

Those files are the source evidence for this plan. They predate this plan and
must be preserved when implementation begins.

## Objective

Add exact physical placement authoring for the 15 Mourning Fields combat Room
Declarations while preserving the planner's existing Overview, Timeline, and
Exits responsibilities and introducing one H-specific Layout presentation:

- Exits continue to author the target room, the batch-wide cage-count outcome,
  and each target room's logical cage reward identities.
- The target occurrence gains a dedicated Room Layout tab as the single editor
  for every Fields physical placement: player entry, cage locations,
  optional-reward locations, and the supported Nemesis random-event location.
- Room Overview continues to author room-local semantic content such as
  optional reward identities and Nemesis activation. Layout may show that
  content as read-only placement context, but it cannot edit it.
- Room Timeline remains unchanged. Cage activation, encounter, transformation,
  and pickup order continue to use the existing mixed occurrence chronology.

This is an additive presentation and authoring surface for the new spatial
facts only. Every pre-existing control remains in its current tab with its
current responsibility and interaction shape; this plan does not move or
redesign existing authoring merely to make related placement context visible.

The persisted project must contain stable room-scoped game point identities,
not UI coordinates or rendered marker positions. A later optional `View Map`
projection can annotate a replaceable room image from those same identities
without another authored-schema redesign.

## Source authorities

Primary source evidence:

- [H Fields spatial points](../audits/rooms-and-routes/H_FIELDS_SPATIAL_POINTS_GAME_DATA_AUDIT.md)
- [Fields optional rewards and Artificer](../audits/rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md)
- [Room action order](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md)
- [H game rules](../biomes/H_GAME_RULES.md)

Cross-cutting ownership authorities:

- [Catalog model](../design/CATALOG_MODEL.md)
- [Authored project model](../design/AUTHORED_PROJECT_MODEL.md)
- [Structured editor workspace](../design/STRUCTURED_EDITOR_WORKSPACE.md)
- [Contextual editor UX](../design/CONTEXTUAL_EDITOR_UX.md)

Installed game contacts:

- `RoomLogic.lua` chooses one batch-wide `NumDoorCageRewards`, resolves each
  target room's `CageRewards`, and assigns that prepared room to its exit.
- `RoomLogic.lua:SpawnRewardCages` places those already-resolved cages at
  distinct `LootPoint` objects, then independently rolls and places optional
  rewards at `BonusRewardSpawnPoints`.
- `EncounterData_Story.lua:NemesisRandomEvent` requests
  `BonusRewardSpawnPoints`, checks used reward points, declares
  `BlockMaxBonusRewards`, and requires a minimum player distance.
- `EncounterLogic.lua:StartFieldsEncounter` derives eligible enemy spawn
  points from the selected cage point through the room declaration's
  `RewardCageSpawnPoints` table.
- `RoomPresentation.lua:GatherRoomPresentationObjects` selects one declared
  HeroStart/HeroEnd pair and honors explicit `NextHeroStartPoint` and
  `NextHeroEndPoint` values before applying ordinary direction filtering.
- `RoomLogic.lua:StartRoom` runs the H room's `SpawnRewardCages` event before
  the selected encounter's `SpawnNemesisForRandomEvents` event and before room
  entrance presentation moves the hero.
- The full map inventory leaves one source-ineligible Nemesis point:
  `H_Combat04` optional point `572886` is within 300 units of that map's fixed
  `_PlayerUnit`. Every other optional point satisfies the native distance
  requirement.

## Locked source facts and planner simplifications

### Logical rewards and physical locations are separate

The native game establishes this sequence:

```text
prepare outgoing H batch
  -> choose one cage count shared by all generated targets
  -> resolve each target's distinct CageRewards
  -> select one target
  -> enter that target
  -> place its prepared cages
  -> independently generate and place optional rewards
  -> execute player-selected room actions
```

The planner preserves all three stages without inventing another chronology:

- the source `ExitDecision` owns the min/max cage outcome;
- each generated target occurrence owns its logical cage reward leaves and its
  complete physical Fields layout;
- the target's cage reward leaves are edited through the preceding door's
  declaration-owned offer surface;
- the target's optional rewards and Nemesis activation remain edited in its
  Overview;
- the target's physical layout is edited in its dedicated Layout tab; and
- the existing Timeline references the same logical reward and encounter
  owners without receiving placement actions.

Where a value is displayed does not create a second persisted owner. The door
card is a projection of its target occurrence's logical cage leaves. Layout may
display those cage identities as read-only placement context, but it must not
add another cage-reward editor or copy.

### One occurrence-owned spatial product

Every authored `FieldsCombatState` gains one H-specific spatial child with:

- one selected player-entry pair;
- one selected cage point for every declaration-supported logical cage slot;
- one selected optional point for every declaration-supported logical optional
  slot; and
- one retained Nemesis point.

The persisted identities are exact source point IDs scoped by the occurrence's
Room Declaration. The entry selection stores the `HeroStart` identity; its
paired `HeroEnd` is declaration data. Cage and optional mappings remain keyed
by the existing logical slot keys such as `cage1` and `optional1`.

An indicative shape is:

```ts
interface FieldsSpatialState {
  readonly entryStartPointId: number | null;
  readonly cagePointIdBySlot: Readonly<Record<string, number | null>>;
  readonly optionalPointIdBySlot: Readonly<Record<string, number | null>>;
  readonly nemesisPointId: number | null;
}

interface FieldsCombatState {
  readonly kind: 'fieldsCombat';
  readonly cages: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly optionalRewardCount: number;
  readonly optionalRewards: Readonly<Record<string, AuthoredRewardState | null>>;
  readonly spatial: FieldsSpatialState;
}
```

The final names may follow the nearest authored-project vocabulary, but the
product may not split placement into parallel room, reward, and encounter
sidecars.

### Activation and uniqueness

Placement values are complete retained leaves. Activation determines which
ones currently consume physical points:

- player entry is always active for an authored H combat occurrence;
- only the batch-derived active cage prefix consumes cage points;
- only the authored active optional prefix consumes optional points;
- the Nemesis point consumes an optional point only when the Passive encounter
  is `NemesisRandomEvent`; and
- dormant selections remain persisted but do not reserve points or produce
  findings.

Active cage placements must be distinct within the room's cage point set.
Active optional rewards and active Nemesis must be distinct within the room's
optional point set. Cage and optional uniqueness remain independent because
the game uses different physical source groups.

Missing active assignments are valid incomplete authored state. Duplicate
active assignments are retained invalid state with exact findings. An
out-of-declaration point is structurally invalid and is rejected by the codec
or semantic command. The engine must not silently move, swap, or clear another
assignment when one value changes.

### Entry direction remains outside the model

The engine does not currently model per-exit `ExitDirection`. Adding that
route-wide presentation dimension only to validate one H entry choice would be
disproportionate. Every source-declared entry pair is therefore an authorable
exact outcome for its room. This remains game-shaped because the native game
explicitly honors a supplied next HeroStart/HeroEnd pair before ordinary
direction filtering.

The entry selection stays occurrence-owned and is edited in Layout. A
predecessor or topology edit does not require transition-owned state or an
entry action.

### Nemesis uses actual point capacity

The existing `fieldsOptionalRewardCountSupport` calls the ordinary optional
reward maximum `physicalMaximum` and subtracts one whenever Nemesis is active.
The source applies `BlockMaxBonusRewards` only when the rolled optional count
would fill every physical `BonusRewardSpawnPoints` member.

The corrected support is:

```text
ordinary reward maximum = min(4 chance trials, optional point count)
available point count   = optional point count - (Nemesis active ? 1 : 0)
effective reward maximum = min(ordinary reward maximum, available point count)
```

Consequently `H_Combat03`, `H_Combat04`, and `H_Combat05` may retain four
optional rewards with Nemesis because they have five, seven, and seven
physical optional points respectively. Rooms whose ordinary maximum fills
their point set lose one optional reward position when Nemesis is active.

Nemesis placement candidates use the active room's optional point set minus
active optional assignments. `H_Combat04` point `572886` is additionally
unavailable because it fails the source-owned player-distance requirement.
The candidate domain does not depend on the authored entry: Nemesis is placed
before entrance presentation moves the hero from the map's fixed `_PlayerUnit`.

This is an engine correction enabled by the new declaration data, not a UI
special case.

### Declaration facts stay distinct

The catalog must retain these independent dimensions:

- the finite entry-pair set;
- the finite physical cage point set;
- the declaration's logical `MaxCageRewards`/bounded-cage capacity;
- the finite physical optional point set; and
- the four-trial optional reward maximum.

`H_Combat09` proves that physical cage point count and logical cage capacity
cannot share one field: it has three `LootPoint` objects but allows only two
cage rewards. `H_Combat03`, `H_Combat04`, and `H_Combat05` similarly prove that
physical optional point count and optional reward maximum are not identical.

The existing bounded-reward `rawCapacity` must not be reinterpreted as a
physical point count.

### Physical placement does not change simulation history

Changing an entry or reward location does not consume a reward store, change a
trait offer, advance an encounter, or reorder an action. Spatial assignments
are materialized room facts used for validation and workspace projection.
They do not add reward branches or Timeline events.

## Ownership by lane

### Hades II catalog

The catalog owns one H-specific spatial declaration for each of
`H_Combat01` through `H_Combat15`:

- ordered HeroStart/HeroEnd pairs;
- ordered `LootPoint` IDs; and
- ordered `BonusRewardSpawnPoints` IDs; and
- the sparse optional-point exclusions imposed by Nemesis's native distance
  requirement (`H_Combat04` point `572886` only).

The raw declaration data should live beside the H room declarations in one
focused data module rather than expanding every room declaration inline. The H
room factory/helper attaches the exact row to its matching declaration.

The normalized catalog contract validates:

- all point IDs are positive integers;
- identities are unique within their own point family and Room Declaration;
- every entry start has exactly one paired end;
- each Fields combat room has a nonempty set for all three families;
- every Nemesis exclusion belongs to that declaration's optional point set;
- bounded cage capacity does not exceed physical cage point count;
- ordinary optional reward capacity is the lesser of four and physical
  optional point count; and
- non-Fields rooms cannot accidentally declare this product.

Coordinates, screenshot marker positions, image paths, presentation ordinals,
room mirroring, distance, and pathfinding do not enter the normalized catalog.
The native `RewardCageSpawnPoints` enemy-group mapping remains source evidence
until a concrete planner consumer requires it. In particular, the planner must
not invent a correction for `H_Combat13`.

### Planner engine

The planner engine owns:

- the persisted `FieldsSpatialState`;
- declaration-shaped defaults with every supported placement leaf present and
  initially unresolved;
- strict codec validation and the focused schema migration;
- one H-specific semantic assignment command covering entry, cage, optional,
  and Nemesis targets;
- stable semantic addresses for each placement finding and workspace control;
- candidate domains, active-placement uniqueness, and repair findings;
- room-replacement reconciliation; and
- corrected optional-count support using actual point capacity.

One discriminated assignment target is sufficient:

```text
entry
cage:<slotKey>
optional:<slotKey>
nemesis
```

The command assigns or clears exactly one target. The engine returns the exact
declaration-owned point domain and selected-validity result for that target.
The application must not reproduce point membership, active-slot, uniqueness,
Nemesis reservation, or the audited Nemesis-eligible point subset.

Changing optional count, cage outcome, or Nemesis encounter activation retains
dormant assignments. Replacing an occurrence with a different Room Declaration
resets every spatial assignment, even if the two declarations happen to reuse
the same numeric object ID. Point identity is room-scoped; equal numbers across
different maps are not compatible state.

Schema 77 advances once. The schema-77-to-78 migration adds the
complete spatial leaf shape without fabricating exact historical placements;
existing H rooms remain editable but incomplete until their active placements
are authored. Repository fixtures receive explicit reviewed assignments rather
than relying on migration defaults.

### Later execution contact

The persisted point IDs are also the only exact facts a later H execution
adapter should consume. Entry has a direct native override through
`NextHeroStartPoint`/`NextHeroEndPoint`. Native cage, optional-reward, and
Nemesis functions do not expose exact point-ID arguments; they select randomly
from map groups. Their later executor support therefore requires a bounded
selection contact at those native functions. The compiler must serialize the
planner-selected identities without deriving placement, and the executor must
not reconstruct the planner's point legality or uniqueness policy.

This constraint does not add execution work to the current plan. It records
why mapping the pre-spatial H product into the executor first would create a
temporary inference path that must later be removed.

### Planner application and React

The application projects the engine product into a dedicated Layout tab for H
combat occurrences. It owns only presentation labels, grouping, focus, tab
availability, and picker composition. The tab is conditional: occurrences
without an H Fields spatial product do not render an empty Layout tab.

The H combat room tab order is:

```text
Overview | Layout | Timeline | Doors
```

The intended Layout tab is:

```text
Fields Layout

Entry                         [Entry 1]

Cage placements
Cage 1 · Hermes               [Cage Point 2]
Cage 2 · Hammer               [Cage Point 1]

Optional pickups              [3]
Optional 1 · Max Health       [Optional Point 4]
Optional 2 · Bones            [Optional Point 1]
Optional 3 · Pom Slice        [Optional Point 3]

Nemesis                       [Optional Point 2]
```

Only active cage and optional rows are shown. The Nemesis row appears only
when the supported Nemesis room feature is active. Cage and optional reward
summaries are read-only context: cage editing remains on the preceding door
card, while optional reward count and identity editing remain in Overview.
Nemesis activation and outcome authoring likewise remain in Overview. Layout
contains only the location picker for each active item.

Picker labels are application vocabulary derived from declaration order:
`Entry 1`, `Cage Point 1`, and `Optional Point 1`. Raw native object IDs must
not appear in the editor. Occupied or otherwise ineligible choices remain
visible but unavailable with an engine-provided reason; retained invalid
selections remain visible and repairable.

Findings navigate directly to the exact placement control in Room Layout. No
finding or placement control points to Room Overview, Room Timeline, or Room
Doors.

## Explicit product split

```text
Preceding Room · Exits
  batch cage outcome
  target room identity
  target cage reward identities
                 |
                 | same target occurrence; no copied rewards
                 v
Target Room · Overview
  optional reward count and identities
  Nemesis activation and outcome
  existing room-local features

Target Room · Layout
  entry pair
  cage physical assignments, labeled by read-only cage identities
  optional physical assignments, labeled by read-only reward identities
  Nemesis physical assignment, shown only while Nemesis is active

Target Room · Timeline
  existing cage/encounter/pickup order only
```

This plan adds the Layout projection without moving the existing Exits or
Overview authorities. It neither adds nor removes a Timeline participant.

## Pre-implementation source closure — complete

Source closure established that optional rewards are placed and recorded before
Nemesis selection, entry choice is irrelevant at that time, and exactly one map
point has an additional source restriction: `H_Combat04` optional point
`572886` fails the 300-unit minimum distance from the fixed `_PlayerUnit`.
Every supported authored Nemesis state retains at least one eligible preferred
optional point, so the `LootPoint` fallback stays outside the modeled domain.

The catalog declares the resulting per-room Nemesis-eligible optional subset.
The engine consumes that subset directly; it must not add coordinate arithmetic,
entry-dependent distance checks, or a generic spatial model.

## Gate A — Catalog and engine spatial authority

Intended commit: `feat(fields): author spatial layouts`

### Production work

- Add the exact 15-room point inventory as focused H declaration data.
- Normalize and validate the H-specific spatial declaration without exposing
  coordinates or presentation labels.
- Add the occurrence-owned spatial state, semantic assignment address, command,
  codec, defaults, and room-replacement behavior.
- Add engine candidate support and precise missing/conflicting placement
  findings.
- Materialize the selected spatial product for application consumption without
  adding simulation branches or history events.
- Correct Fields optional-count support so Nemesis reserves a physical point
  rather than unconditionally subtracting one reward.
- Advance the authored schema to 78 and provide one focused migration from
  schema 77.
- Update H-bearing repository fixtures with explicit reviewed assignments and
  advance the fixture manifest.

### Primary tests

- Catalog regression covers all 15 rooms' entry, cage-point, optional-point,
  Nemesis-exclusion, logical-cage-capacity, and ordinary optional-reward
  counts, including `H_Combat04`, `H_Combat09`, and the three rooms with
  surplus optional points.
- Catalog normalization rejects duplicate IDs, missing entry partners,
  impossible logical capacities, and spatial data on a non-Fields room.
- The project codec round-trips every spatial selection and rejects point IDs
  outside the selected Room Declaration.
- The schema migration creates every spatial leaf without inventing a selected
  point.
- Assigning and clearing each target changes only that exact occurrence leaf
  and participates normally in semantic Undo/redo.
- Active cage slots require distinct cage points; dormant cage slots retain
  values without consuming points.
- Active optional slots and Nemesis share one uniqueness domain; the Nemesis
  candidate domain excludes `H_Combat04` point `572886` without consulting the
  selected entry. Inactive optional slots and dormant Nemesis retain values
  without consuming points.
- Nemesis reduces the optional reward maximum only when the active rewards
  would otherwise fill the concrete point set. `H_Combat04` still supports four
  optionals with Nemesis, while a two-point room supports only one.
- Replacing one H combat declaration with another clears all spatial choices
  even when a numeric point ID exists in both maps.
- Changing a spatial assignment leaves reward history and the existing room
  action chronology unchanged in a representative H fixture.

Narrow validation: `npm run test:catalog`, focused authored-project and H engine
tests, `npm run typecheck`, `npm run lint`, `npm run format:check`, and
`git diff --check`.

### Audit-against

- No execution-plan or Plan Executor file changes.
- No Timeline action, dependency, lifecycle, or ordering changes.
- No generic cross-biome spatial framework.
- No second cage-reward or optional-reward identity store.
- No raw point ID treated as globally unique.
- No correction invented for the `H_Combat13` enemy-group discrepancy.

## Gate B — Fields Layout authoring

Intended commit: `feat(planner): edit Fields spatial layouts`

### Production work

- Add a conditional Room Layout workspace surface for H combat occurrences and
  populate it with the complete engine-derived placement rows and contextual
  interactions.
- Keep cage reward editing on the preceding door offer surface and project only
  a read-only cage summary beside each Layout placement picker.
- Keep optional reward count and identity authoring and Nemesis activation in
  Room Overview; project their active identities into Layout as read-only
  placement context.
- Do not place spatial controls in Overview's existing Features grouping.
- Render the selected entry and active cage, optional, and Nemesis placement
  controls with stable aligned rows and human labels.
- Route every placement finding and marker to its exact Layout control.
- Render the H combat tab order as Overview, Layout, Timeline, Doors while
  preserving each existing tab's behavior and keyboard/accessibility
  primitives. Do not show Layout for occurrences without the spatial product.
- Leave every existing Overview, Timeline, and Doors authoring interaction in
  place; Layout adds only the new spatial assignment controls and read-only
  context needed to identify what is being placed.

### Primary tests

- A prepared H target's preceding door still owns the editable cage reward
  controls and exposes every active cage summary.
- Opening that target's Room Layout shows the same cage identities as
  read-only labels alongside independently editable physical points.
- Optional count and reward identities remain editable only in Overview; each
  active optional receives one location control in Layout.
- Activating Nemesis in Overview adds its Layout location row and uses the
  audited eligible subset of the optional-point domain; removing Nemesis hides
  the row without deleting its dormant value.
- H combat occurrences render `Overview | Layout | Timeline | Doors`, while a
  representative non-H occurrence does not render Layout.
- Occupied points are unavailable, while a retained conflicting or missing
  value remains visible with an exact finding and repair destination.
- `H_Combat04` exposes seven optional physical choices despite allowing at most
  four ordinary optional reward slots, while its active Nemesis picker exposes
  the six source-eligible points.
- No raw object ID is rendered in summaries, labels, findings, or picker rows.
- Editing placement does not change rendered Timeline rows or their order.

Narrow validation: focused structured-workspace, interaction, and Fields React
tests; `npm run test:planner`; typecheck, lint, format, and diff checks.

### Audit-against

- React dispatches complete bound commands and contains no point legality or
  uniqueness policy.
- Room Layout is the only physical-placement editor.
- Room Overview retains optional-reward and Nemesis semantic authoring and does
  not gain placement controls.
- Room Doors does not gain placement controls.
- Room Timeline does not gain placement controls, rows, or markers.
- Room Layout contains no reward, encounter, feature-activation, or action-order
  editor.
- No existing authoring control is moved, duplicated, or redesigned as part of
  introducing Layout.
- No map canvas, image loader, marker-drag system, or CSS-coordinate model is
  introduced.

## Gate C — Closure

Intended commit: `docs(fields): close spatial layout plan`

- Update `H_GAME_RULES.md` with the occurrence-owned spatial layout, the
  Exits/Overview/Layout/Timeline projection split, and corrected Nemesis
  optional capacity.
- Update the spatial audit's current planner contact and final disposition
  without erasing its source facts or unresolved `H_Combat13` discrepancy.
- Add the completed schema and feature result to
  `IMPLEMENTATION_PROGRESS.md`.
- Absorb any genuinely cross-cutting authored or editor ownership statement
  into its smallest stable design authority.
- Remove this temporary plan.
- Run one complete `npm run check` phase-closure gate. Do not rerun the complete
  gate after individually passing sequential repairs unless production changes
  again.

## Deferred visual projection

A later visual slice may add one `View Map` control to Room Layout.
That view may:

- select the Room Declaration's replaceable map image;
- look up image-relative marker positions by room, point family, and exact
  source point ID;
- annotate the selected entry, cage rewards, optional rewards, and Nemesis;
  and
- dispatch the same spatial assignment commands as the nonvisual pickers.

The visual asset, crop, and marker pixel coordinates are application-owned
calibration data. They do not alter `FieldsSpatialState`, catalog source point
identity, reward generation, or Timeline chronology. This future seam is a
consequence of the current product; Gate A and Gate B must not build dormant
visual infrastructure for it.

## Explicit non-goals

- H execution-plan publication or game-module realization.
- Physical placement for noncombat H rooms, doors, generic room features,
  resources, or Artificer-created replacements.
- Player travel distance, route optimization, room mirroring, or pathfinding.
- Screenshot ingestion, map stitching, marker calibration, or a graphical map
  editor.
- Authoring enemy spawn groups or repairing the native H_Combat13 mapping.
- Modeling optional reward probabilities beyond the existing possibility
  surface.
- Replacing the existing cage reward, optional reward, encounter, acquisition,
  or room-action models.
- Moving cage reward identity editing from the preceding door into Layout.
- Moving optional reward identity, Nemesis activation, encounter, or action
  authoring into Layout.
- Any Timeline schema, action, dependency, or ordering change.
- A generic spatial-point abstraction prepared for unknown future biomes.

## Final acceptance

The plan is complete when an H combat target renders
`Overview | Layout | Timeline | Doors` and can be authored with one exact
room-scoped physical layout; its cage identities still originate from the
preceding door surface; its optional rewards and Nemesis remain Room Overview
facts; Layout edits only their physical locations; its existing Timeline is
byte-for-byte semantically unchanged; every active placement is
declaration-valid and collision-free; inactive values are retained without
consuming space; and the same persisted point identities are sufficient for a
later read-only annotated map without changing the authored schema.
