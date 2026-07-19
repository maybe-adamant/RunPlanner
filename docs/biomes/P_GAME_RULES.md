# P Game Rules

## Purpose and Status

This document is the concrete game-rule authority for Mount Olympus (`P`). P
now pressure-tests the normalized catalog without silently inheriting F/G
assumptions.

Shared picker, physical-door, cap, force, offer/acquisition, generated-store,
standard linear, and forked-preboss semantics are defined by
`../GAME_GENERATION_RULES.md`.

P declarations are imported under the progressed-save, NPC-free baseline. P
simulation and editor activation remain dormant until the Surface prefix that
feeds it, especially N and O history, is modeled. A declaration being
normalized does not imply that the biome is an independently valid simulation
entry point.

## Evidence Status

These rules were verified against the Hades II script extraction and physical
map data on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataP.lua
../../../../1GameData/Scripts/ObstacleDataP.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/EncounterData_Opening.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterData_MiniBoss.lua
../../../../1GameData/Scripts/EncounterData_Athena.lua
../../../../1GameData/Scripts/EncounterData_Heracles.lua
../../../../1GameData/Scripts/EncounterData_Icarus.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/EncounterLogic.lua
../../../../1GameData/Maps/bin/
```

The previous Lua declaration and revamp audits are interpreted evidence only.
This audit corrects two legacy projections: indoor target reachability is not
an indoor-room depth predicate, and `P_Intro` is intentionally projected as
empty even though the game can play a non-counting intro combat there.

## Feature Projection Map

The disposition vocabulary is defined by `../CATALOG_MODEL.md`; implementation
coverage is defined by `../MIGRATION_PROVENANCE.md`. P has documentation and
declaration coverage. Authored topology, simulation, and editor activation
remain dormant.

| Feature                              | Verified game behavior                                                                                                  | Disposition and planner projection                                           | Current coverage     | Reconsider when                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Linear layout and terminal           | Fixed `P_Intro`, ordinary generated decisions, and exact-depth-9 `P_PreBoss01`                                          | **Exact:** `LinearBiome` with forked terminal occurrences                    | documented, declared | --                                                                  |
| Typed physical exits                 | Indoor/Outdoor door types impose source-sensitive target-tag rules                                                      | **Exact:** declaration-owned room tags plus normalized exit policies         | documented, declared | --                                                                  |
| Room-set weights                     | Story and Fountain have doubled weight; other supported rooms have positive ordinary weights                            | **Simplified:** preserve support and forced pools, never likelihood          | documented           | Probability analysis or seeded replay becomes a product goal        |
| Intro encounter                      | `P_Intro` may play one non-counting, reward-free combat or an empty alternative                                         | **Simplified:** empty fixed intro with the same modeled counters and rewards | documented, declared | Combat occurrence or encounter-content timing becomes observable    |
| Ordinary combat phases               | A non-counting precombat precedes one counting main combat                                                              | **Simplified:** one counting Olympus combat projection                       | documented, declared | Internal phases acquire modeled rewards, choices, or timing effects |
| `P_Combat03` first-time variant      | Save progression can replace the ordinary phase structure                                                               | **Excluded:** use the progressed-save ordinary combat projection             | documented           | Save-profile state becomes a project input                          |
| Combat and special-room requirements | Current-run caps, counter ranges, force windows, mutual exclusion, and predecessor-exit requirements govern eligibility | **Exact:** explicit declarations and history predicates                      | documented, declared | --                                                                  |
| Reward-store selection               | Surface history drives a `0.20` MetaProgress target and random Run/Meta selection                                       | **Simplified:** retain only possible/forced base-store support               | documented, declared | Probability analysis or exact RNG replay is introduced              |
| Incoming rewards and shops           | Ordinary, fixed, shop, miniboss, and preboss producers use concrete filters and lifecycle timing                        | **Exact:** concrete occurrence reward state and offer/acquisition history    | documented, declared | --                                                                  |
| Miniboss encounter depth             | Talos is non-counting; Mega-Dracon is counting                                                                          | **Exact:** separate encounter profiles                                       | documented, declared | --                                                                  |
| Preboss realizations                 | First terminal creation is Shop; another predecessor exit creates one free RunProgress reward                           | **Exact:** distinct terminal occurrences of the same room declaration        | documented, declared | --                                                                  |
| Fixed boss and postboss tail         | `P_PreBoss01` leads through `P_Boss01` and then `P_PostBoss01` before Q                                                 | **Exact:** layout-derived neutral Prometheus room then postboss              | documented, declared | User-selected difficulty becomes a project input                    |
| Save/profile special-room gates      | Fountain upgrades, Story progression, dialogue, bounty, and other persistent facts affect availability                  | **Excluded:** progressed-save baseline retains current-run rules only        | documented           | Save-profile state becomes a project input                          |

## Possibility Contract

P uses the possibility-only room-selection contract from
`../GAME_GENERATION_RULES.md` and the validation contract from
`../SIMULATION_AND_VALIDATION.md`. Room-set and encounter-set multiplicity changes
relative random weight, not validity. Every positive-weight member that remains
eligible is possible; the simulator does not score how likely it is.

`P_Story01` and `P_Reprieve01` each occur twice in the P room set while the
other supported rooms occur once. This duplication must not become a special
validation rule.

## Layout

P is a `LinearBiome`:

```text
P_Intro
  -> generated batch
  -> picked target
  -> generated batch
  -> ...
  -> P_PreBoss01 terminal transition
```

The fixed start is `P_Intro`. The terminal room is `P_PreBoss01`, forced at
exact `biomeDepthCache` 9. The authored storage bound is nine continuation
batches and eighteen ordinary targets. Terminal target occurrences are owned
by the terminal transition rather than counted as ordinary continuation
targets.

The standard generated batch contract remains valid: one target occurrence per
active physical exit, one picked target, and downstream continuation owned only
by the picked occurrence.

## Physical Exit Semantics

P proves that exit count alone is insufficient. Every physical P exit has a
door type, and its target restriction depends on the source room's tags.

`OlympusOutdoorExitDoor`
: The target must carry the `Outdoor` tag.

`OlympusIndoorExitDoor`
: When the source carries `Outdoor`, the target must carry `Indoor`. From an
indoor source, this door imposes no target-tag restriction.

The catalog must retain source-room tags and physical exit types. Target
candidate construction must interpret those facts before room eligibility and
force selection. These are topology facts, not leaf state and not room-local
eligibility predicates.

### Source Families

| Source family               | Rooms                                  | Physical exits          |
| --------------------------- | -------------------------------------- | ----------------------- |
| Fixed outdoor intro         | `P_Intro`                              | two Outdoor exits       |
| Outdoor combat              | 01, 03, 05, 06, 11, 13, 14, 16, 17, 19 | one Indoor, one Outdoor |
| Indoor combat               | 02, 04, 07, 08, 09, 10, 12, 15, 18     | two Indoor              |
| Outdoor special             | `P_Shop01`                             | one Indoor, one Outdoor |
| Indoor story                | `P_Story01`                            | one Indoor, one Outdoor |
| Indoor fountain             | `P_Reprieve01`                         | two Indoor              |
| Indoor Talos miniboss       | `P_MiniBoss01`                         | two Indoor              |
| Indoor Mega-Dracon miniboss | `P_MiniBoss02`                         | one Outdoor             |
| Indoor and Outdoor terminal | `P_PreBoss01`                          | one fixed boss exit     |

Consequences include:

- the first generated batch after `P_Intro` can target only Outdoor rooms;
- an ordinary Outdoor predecessor produces one Indoor-constrained target and
  one Outdoor-constrained target;
- an Indoor predecessor's Indoor exits do not add a tag restriction;
- same-batch repetition can be impossible for an Outdoor predecessor but
  possible for an Indoor predecessor;
- generic same-batch room uniqueness would be incorrect.

The old Lua declaration encoded `biomeDepthCache >= 2` on indoor combat rooms
to reproduce the first consequence. That is rejected. Reachability belongs to
exit-target validation and must not be duplicated as room eligibility.

## Fixed Start

`P_Intro` is always forced, appears at most once in the biome, has two Outdoor
exits, and does not provide an incoming reward in a normal Surface route.

The room's legal encounters include ordinary P intro-combat variants, literal
`Empty` alternatives, and a dream-run-only empty variant. All normal baseline
alternatives are equivalent for the currently modeled history facts:

- the intro phase does not increment `biomeEncounterDepth`;
- no incoming reward is offered or acquired;
- no supported downstream rule distinguishes the exact intro encounter name.

These alternatives are intentionally simplified to the existing empty
`FixedIntro` projection. The app preserves the room's structural and counter
effects but does not record whether an internal intro combat occurred. This is
a chosen semantic projection, not missing encounter-profile depth.

`PIntroDreamRunEmpty` and the intro's conditional dream-run reward are external
run-mode behavior and are omitted from the ordinary progressed-save planning
baseline.

## Ordinary Combat Projection

In the game, every supported `P_CombatXX` room has one incoming counted reward
and an ordered two-phase internal sequence:

1. a non-counting precombat phase;
2. a counting main P combat phase.

The room reward belongs to the room occurrence. Internal phases do not create
additional door rewards or reward leaves, and their normal combined effect is
exactly one `biomeEncounterDepth` increment.

The first phase selects from map-specific precombat encounters plus the shared
P intro encounter set. `P_Combat17`, `P_Combat18`, and `P_Combat19` lack
map-specific additions but still have shared precombat candidates.

The planner intentionally simplifies this sequence to one counting Olympus
combat projection. It does not persist or materialize separate precombat and
main phases because no current canonical consumer observes the distinction.
This projection must be revisited if internal phases later own rewards,
authored choices, relevant timing, or configured NPC replacement.

`P_Combat03` contains a first-time Olympus progression variant that can change
its phase structure. That save-file condition is outside the catalog input
surface. The progressed-save baseline uses the ordinary one-count projection
and does not carry a production `unsupported` predicate.

### Combat Eligibility

All nineteen combat rooms have `MaxAppearancesThisBiome = 1`. They do not have
`MaxCreationsThisRun`, so an unentered combat may be offered again later when
exit and eligibility rules permit it.

Only these combat declarations have additional current-run counter rules:

| Room         | Requirement                |
| ------------ | -------------------------- |
| `P_Combat01` | `biomeEncounterDepth >= 3` |
| `P_Combat03` | `biomeEncounterDepth <= 4` |
| `P_Combat17` | `biomeEncounterDepth >= 3` |
| `P_Combat18` | `biomeEncounterDepth >= 3` |

Every other restriction on Indoor versus Outdoor combat candidates comes from
physical exit compatibility, not from a hidden biome-depth range.

## Persistent NPC Composition Boundary

P encounter sets include Heracles, Athena, and Icarus variants. These are not
cosmetic add-ons:

- `HeraclesCombatP` can occupy the precombat slot, counts encounter depth, and
  blocks the ordinary second phase;
- Athena and Icarus variants can replace the main phase;
- their availability depends on persistent NPC and save-file state.

This is concrete P evidence for the project-wide persistent-NPC policy owned by
`../GAME_GENERATION_RULES.md`: a configured persistent NPC is an authored
persistent entity composed into the room spine before history is materialized.
The v1 baseline suppresses all NPC encounter variants. The P room declaration
does not pretend these variants are ordinary equivalent encounter choices.

Persistent NPC authoring remains deferred. The dormant P declaration slice may
declare only the NPC-free baseline spine, provided normalization and future
runtime auditing retain a clear extension point for entity composition.

## Reward and Store Rules

P targets a MetaProgress entered-room ratio of `0.20`. Base-store support is
derived from accumulated Surface history, including N and O. This is why P can
be declaration-complete while its simulation remains dormant.

The globally frozen generated-batch reward authority is compatible with P:

- a generated batch owns its base store;
- a room declaration may force the resolved store;
- each occurrence leaf owns only its complete resolved reward offer;
- internal encounter phases do not own separate incoming rewards.

Base P excludes `Devotion` from ordinary counted rewards. Supported bindings
are:

| Room family     | Producer and store behavior                                                           |
| --------------- | ------------------------------------------------------------------------------------- |
| Ordinary combat | RunProgress or MetaProgress, excluding Devotion                                       |
| `P_Reprieve01`  | RunProgress or MetaProgress, excluding Devotion                                       |
| Minibosses      | forced RunProgress, Boon only                                                         |
| `P_Story01`     | fixed Story producer                                                                  |
| `P_Shop01`      | WorldShop                                                                             |
| `P_PreBoss01`   | first Shop, then free forced-RunProgress rewards excluding Devotion and RoomMoneyDrop |

The fixed Story and Shop producers still receive resolved store provenance for
entered-room ratio history, as described by `../REWARD_MODEL.md`.

## Special Rooms

### Midshop

`P_Shop01`:

- has `MaxCreationsThisRun = 1`;
- requires `biomeEncounterDepth > 4`;
- requires `biomeDepthCache <= 7`;
- uses fixed Shop encounter and WorldShop state;
- has one Indoor and one Outdoor physical exit.

### Fountain

`P_Reprieve01`:

- has `MaxCreationsThisRun = 1`;
- requires `4 <= biomeDepthCache <= 7`;
- owns one ordinary counted RunProgress-or-MetaProgress reward excluding
  Devotion;
- has two Indoor physical exits.

Its world-upgrade requirement is an external progression condition and is
omitted from the progressed-save planning baseline.

### Story

`P_Story01`:

- has `MaxCreationsThisRun = 1`;
- requires `biomeEncounterDepth > 2`;
- requires `biomeDepthCache <= 7`;
- owns the fixed Story producer;
- has one Indoor and one Outdoor physical exit.

Prior-boss, dialogue, bounty, and other save-file requirements are omitted from
the progressed-save baseline. The room's doubled room-set weight does not
change possibility validation.

## Minibosses

P has two mutually exclusive miniboss rooms:

| Room           | Label       | Exits       | Encounter-depth effect |
| -------------- | ----------- | ----------- | ---------------------- |
| `P_MiniBoss01` | Talos       | two Indoor  | non-counting           |
| `P_MiniBoss02` | Mega-Dracon | one Outdoor | counting               |

Both rooms:

- have `MaxCreationsThisRun = 1` and `MaxAppearancesThisBiome = 1`;
- require `biomeDepthCache >= 4`;
- require a predecessor with more than one offered exit;
- require that the other P miniboss has not been entered;
- force within the `biomeDepthCache` 4 through 7 window;
- force RunProgress and allow only Boon rewards.

The predecessor-exit requirement is evaluated while generating the target. It
does not describe the miniboss room's own outgoing exit count. The raw force
maximum is formula input and not a generic eligibility ceiling.

The Talos/Dragon encounter-depth asymmetry is explicit game behavior and must
survive declaration normalization and history fixtures.

## Terminal Preboss

`P_PreBoss01` is forced at exact `biomeDepthCache` 9, carries both Indoor and
Outdoor target tags, and uses the same shop-then-fill policy family as F:

```text
first physical terminal exit -> Shop
remaining terminal exit      -> free RunProgress reward
```

The free reward excludes `Devotion` and `RoomMoneyDrop`. P's supported maximum
is one free reward because ordinary predecessors expose at most two exits.
`P_MiniBoss02` exposes only one exit, so a terminal transition from that room
contains only the Shop realization.

Every terminal target is a distinct occurrence of the same concrete
`P_PreBoss01` declaration. The picked occurrence determines which realization
is entered; unpicked terminal targets still contribute creation and reward-
offer history.

The preboss map's own single exit leads to the fixed P boss. That outgoing boss
exit is separate from the predecessor exits that create preboss occurrences.

## Fixed Boss and Postboss Tail

P completes through a layout-derived sequence:

```text
P_PreBoss01
  -> P_Boss01
  -> P_PostBoss01
  -> Q_Intro
```

`P_Boss01` is the sole boss room declaration. Under the neutral difficulty
baseline it uses `BossPrometheus01`; the `BossPrometheus02` encounter variant
is excluded until user-selected difficulty becomes a project input. Both
automatic Mixer and weapon-dependent drops are intentionally outside the
modeled reward surface because no current consumer authors, validates, or
executes them.

The linked boss offer still receives a resolved RunProgress or MetaProgress
store in the game's bookkeeping. `P_Boss01` therefore records
`resolvedOffer` store history without owning reward leaf state, bag depletion,
or acquisition history. `P_PostBoss01` uses the empty non-counting encounter,
has no modeled reward or store contribution, and precedes the fixed `Q_Intro`
entry.

Both rooms are derived Room Declarations referenced by the P layout completion
sequence. They are not generated candidates, authored topology, or editor
controls.

## Counter and History Projection

P history preserves:

- one room creation and one reward offer per generated target occurrence;
- one room appearance and optional reward acquisition for the picked target;
- zero encounter-depth increment for the normalized P intro;
- one encounter-depth increment for the intentionally collapsed ordinary P
  combat projection;
- the explicit non-counting Talos and counting Mega-Dracon difference;
- derived `P_Boss01` and `P_PostBoss01` history followed by `Q_Intro`;
- one resolved boss-offer store contribution and no automatic boss-drop
  concrete acquisition or history projection;
- NPC-composed replacement/blocking behavior only after persistent entities
  promote that deferred dimension into the model.

`biomeDepthCache`, `biomeEncounterDepth`, and route-wide room-history ordinal
remain separate axes.

## Declaration-Port Contract

The dormant P declaration slice is faithful because the normalized catalog
expresses:

1. source-room `Indoor` and `Outdoor` tags;
2. physical exit types and their source-sensitive target compatibility;
3. the existing reward-free empty `FixedIntro` projection;
4. one counting ordinary Olympus combat profile;
5. explicit miniboss encounter-depth asymmetry;
6. the existing forked-preboss policy with one free-reward capacity;
7. the derived neutral boss/postboss completion sequence and explicit
   store-history policies;
8. the NPC-free baseline as distinct from future entity-composed variants.

All P rooms and exact physical exits are covered by readable parity matrices.
The import does not activate P in the editor, materialize P history without
N/O, or implement persistent NPC entities.

## Model Conclusions

P keeps these shared contracts intact:

- concrete Room Declarations are unique while occurrences may repeat;
- `LinearBiome` and generated batches remain valid topology concepts;
- reward leaves own concrete state rather than internal encounter structure;
- simulation validates possibility rather than probability;
- forked preboss targets are occurrences, not singleton room controls.
- fixed boss/postboss rooms are declaration-driven canonical history, not
  authored topology.

P strengthens the shared model in three places:

- exit compatibility is typed and source-sensitive, not merely an exit count;
- documented observational equivalence can deliberately collapse internal game
  phases without pretending the game lacks them;
- persistent NPCs can alter the spine and must be composed before history.

The generated-batch base-store authority is not contradicted by P. Q has since
proved that the field is conditional for reward-free batches, H has confirmed
that batch-global state can coexist with room-owned local reward slots, and O
has proved that a batch can derive its store from a source-owned offer point.
I has since confirmed declaration-owned forced-store resolution and a
conditional-terminal generated batch. N has now confirmed the fixed-slot
persistent-hub form without revising that reward ownership. The combined shape
is frozen for the Phase 3 simulator contract.
