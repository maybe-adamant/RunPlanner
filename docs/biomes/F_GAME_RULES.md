# F Game Rules

## Purpose and Scope

This document is the concrete game-rule authority for Erebus (`F`). Shared
picker, physical-door, cap, force, offer/acquisition, generated-store, standard
linear, and forked-preboss semantics are defined by
`../design/GAME_GENERATION_RULES.md`.

Exact room-local exits, requirements, caps, labels, encounter-profile keys,
and reward bindings appear explicitly in catalog declarations. This document
owns how those facts form the F biome and how vanilla behavior projects into
the planner.

## Evidence Status

These rules were verified against the Hades II script extraction and map data
on 2026-07-16, with reward-store behavior rechecked on 2026-07-18. Primary
sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataF.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Maps/bin/
```

## Feature Projection Map

The disposition vocabulary is defined by `../design/CATALOG_MODEL.md`; implementation
coverage is defined by `../progress/MIGRATION_PROVENANCE.md`.

| Feature                                      | Verified game behavior                                                                                                    | Disposition and planner projection                                                                     | Implementation status | Reconsider when                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------- |
| Generated decisions                          | F uses sequential physical doors, forced pools, and repeatable unpicked room creations                                    | **Exact:** standard generated batches with distinct Room Occurrences                                   | implemented           | --                                                         |
| Opening baseline                             | `F_Opening01..03` use counting `OpeningGeneratedF` and forced RunProgress in the progressed-save route                    | **Exact:** one counting opening encounter and its resolved reward offer                                | implemented           | --                                                         |
| Progression encounter variants               | `OpeningEmpty`, `FCastTutorialFight`, and `FIntroFight` depend on persistent progression                                  | **Excluded:** absent from the progressed-save baseline                                                 | documented boundary   | Save-profile state becomes a project input                 |
| Ordinary combat identity                     | Maps choose internal enemy waves while each supported combat has its relevant room and counter effects                    | **Simplified:** preserve concrete room identity and encounter-depth effect, not enemy-wave composition | implemented           | Combat composition becomes an authored or validated output |
| Room eligibility and force                   | Concrete current-run counters, caps, predecessor-exit requirements, mutual exclusion, and force windows govern candidates | **Exact:** declaration-owned predicates evaluated from history                                         | implemented           | --                                                         |
| Reward-store selection                       | F targets MetaProgress ratio `0.315` with adjustment speed `10`                                                           | **Simplified:** preserve only possible and forced RunProgress/MetaProgress support                     | implemented           | Probability analysis or exact RNG replay is introduced     |
| Incoming rewards and shops                   | Openings, `F_Combat01`, minibosses, and preboss force RunProgress; other producers retain concrete filters and shops      | **Exact:** occurrence reward state plus declaration-owned overrides                                    | implemented           | --                                                         |
| Forked preboss                               | Every predecessor exit creates `F_PreBoss01`; first is Shop and at most one additional exit is a free reward              | **Exact:** one or two terminal occurrences of the same declaration                                     | implemented           | --                                                         |
| Fixed boss and postboss tail                 | `F_PreBoss01` leads through one mutually exclusive Hecate variant and then `F_PostBoss01`                                 | **Exact:** layout-derived `F_Boss01` then `F_PostBoss01` under the neutral difficulty baseline         | implemented           | User-selected difficulty becomes a project input           |
| Story, Fountain, and other progression gates | Dialogue, world upgrades, and persistent progression alter availability                                                   | **Excluded:** progressed-save baseline retains current-run rules only                                  | documented boundary   | Save-profile state becomes a project input                 |

## Layout

F has one selected start from:

```text
F_Opening01
F_Opening02
F_Opening03
```

Openings are start-only and cannot appear as ordinary later targets. F then
uses standard generated batches and terminates through `F_PreBoss01`, forced at
`biomeDepthCache = 10`.

## Progressed-Save Encounter Projection

The game has progression-controlled opening alternatives. The supported
baseline uses counting `OpeningGeneratedF` for all three opening maps.
`OpeningEmpty` and `FCastTutorialFight` are excluded save-profile variants.
`F_Combat01` likewise uses its ordinary `GeneratedF` encounter rather than the
progression-controlled `FIntroFight`. None of these variants are production
choices or production `unsupported` predicates.

The opening begins with `biomeDepthCache = 0` and
`biomeEncounterDepth = 1`. Its counting encounter increments encounter depth
to `2` at encounter start, before outgoing doors are generated. Its later room
commit advances biome depth cache to `1`; encounter completion is not either
counter's mutation point.

Every opening forces RunProgress and excludes `Devotion`, `RoomMoneyDrop`,
`MaxHealthDrop`, and `MaxManaDrop`.

## Physical Exits

- every F opening has one exit;
- `F_Combat01`, `F_Combat09`, and `F_Combat10` have one exit;
- other supported `F_Combat02..22` rooms have two exits;
- `F_Story01`, `F_Reprieve01`, and `F_Shop01` have two exits;
- `F_MiniBoss01..03` have one exit.

Exit indexes and physical order are semantic. The terminal predecessor can
therefore expose at most one free preboss reward.

## Room Families and Caps

- 22 ordinary combat declarations use `StandardCombat`;
- three miniboss declarations use `Miniboss` with concrete encounter profiles;
- one Story room produces fixed `Story`;
- one Reprieve uses `Fountain`;
- one Midshop uses `Shop` and `WorldShop`;
- one terminal room uses the forked preboss policy.

Ordinary F combat rooms have `MaxAppearancesThisBiome = 1` and no
`MaxCreationsThisRun`, so an unentered combat can be offered again later when
eligible. Special rooms carry their exact creation caps.

Shop and miniboss force windows, shop predecessor-exit requirements, miniboss
mutual exclusion, and creation caps remain explicit requirement trees. The
layout engine does not special-case their names.

## Reward-Store Projection

F targets a MetaProgress entered-room ratio of `0.315` and uses adjustment
speed `10` under the neutral progressed-save baseline. It uses the shared
support-only formula from `../design/REWARD_MODEL.md` within the generated-door lifecycle
defined by `../design/GAME_GENERATION_RULES.md`.

After F's forced RunProgress opening, `currentMetaRatio = 0` and:

```text
pMeta = 0.315 + 10 * 0.315 = 3.465
```

The first ordinary F batch therefore has forced MetaProgress base-store support
under the current candidate model. Target-level forced overrides still control
their concrete resolved stores.

`F_Combat01` forces RunProgress and excludes Devotion. Other ordinary F combat
rooms use the RunProgress/MetaProgress domain. F minibosses force RunProgress
and Boon. Fixed Story and Shop producers retain resolved store provenance for
future entered-room ratio history.

## Terminal Preboss

`F_PreBoss01` uses the shared shop-then-fill policy:

```text
exit 1 -> F_PreBoss01 with Shop
exit 2 -> F_PreBoss01 with free RunProgress reward, when present
```

The free reward excludes `Devotion` and `RoomMoneyDrop`. Because no supported F
predecessor has more than two exits, F's maximum free-reward capacity is one.
Each target is a distinct occurrence of the same concrete room declaration.

## Fixed Boss and Postboss Tail

F completes through the layout-derived sequence `F_Boss01` then
`F_PostBoss01`. `F_Boss02` is the mutually exclusive user-difficulty variant
and remains excluded under the neutral baseline. Automatic Mixer and
weapon-dependent boss drops are intentionally outside the modeled reward
surface. `F_Boss01` also records no reward-store history contribution because
the game marks the boss ignored for that ledger. `F_PostBoss01` owns its fixed
non-counting story encounter, no modeled reward, and no store contribution
before the route enters `G_Intro`.

Both rooms are derived Room Declarations referenced by the layout completion
sequence. They are not generated candidates, authored topology, or editor
controls.

## Current Product Boundary

F editable-room declarations, authored topology, semantic commands, and editor
projection exist. Complete topology now materializes one canonical F snapshot,
including the layout-derived `F_Boss01`/`F_PostBoss01` completion sequence.
The picked spine now composes into canonical lifecycle history with sequential
peer creation, timing-specific counter/store ledgers, completion-room history,
and declared biome-local resets. F room-generation legality now validates
physical exits, compatibility, requirements, distinct caps, mutual exclusion,
and exact forced-pool support and emits addressed semantic findings. Reward
simulation and its addressed legality findings are live through the common
project evaluator and editor candidate projection.
Generated batches own the authored base store, Room Declarations own forced
overrides, and counted leaves persist only their complete resolved offer under
the current project schema.
