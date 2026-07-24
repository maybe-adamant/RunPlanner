# Q Game Rules

## Purpose and Status

This document is the concrete game-rule authority for the Summit (`Q`). Q
pressure-tests the normalized catalog without inheriting assumptions from
ordinary F/G/P generated biomes.

Shared picker, physical-door, cap, force, offer/acquisition, and occurrence
semantics are defined by `../design/GAME_GENERATION_RULES.md`. Q remains a
`LinearBiome`, but its continuation stages are much more constrained than an
ordinary linear biome and its supported spine is reward-free outside the two
miniboss offers and the preboss shop.

Q declarations are imported under the progressed-save, neutral-difficulty
repeat-run baseline. The authored project boundary and core simulator now
support the staged decision tree, and the complete application product loop is
active after the N/O/P Surface prefix.

## Evidence Status

These rules were verified against the Hades II script extraction and physical
map data on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataQ.lua
../../../../1GameData/Scripts/ObstacleDataQ.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/EncounterData_Intro.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterData_MiniBoss.lua
../../../../1GameData/Scripts/EncounterData_Boss.lua
../../../../1GameData/Scripts/LootData.lua
../../../../1GameData/Scripts/StoreData.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Maps/bin/
```

The previous Lua declaration and revamp audits are interpreted evidence only.
This audit corrects four inherited assumptions:

- `Q_Combat10` and `Q_Combat11` are real foyer candidates, not debug rooms;
- the paired miniboss stages are independently generated exits, not fixed
  distinct pairs;
- a generated batch does not need an authored base reward store when no target
  in that batch observes the generated store;
- Q's canonical repeat-run completion ends after `Q_Boss01`; the Palace
  `Q_PostBoss01 -> Q_Story01` sequence is narrative progression, not the normal
  route tail.

## Feature Projection Map

The disposition vocabulary is defined by `../design/CATALOG_MODEL.md`; implementation
coverage is defined by `../progress/MIGRATION_PROVENANCE.md`. Q has declaration,
authorship, materialization, history, reward, candidate, selected-validation,
editor, profile, and recovery coverage.

| Feature                     | Verified game behavior                                                                                              | Disposition and planner projection                                                | Implementation status | Reconsider when                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| Scripted linear layout      | Fixed intro, foyer, forced two-exit combat, forced miniboss, ordinary combat, a second forced pair, and direct shop | **Exact:** `LinearBiome` with declaration-driven staged candidate pools           | implemented           | --                                                              |
| Room-set weights            | Every listed Q room occurs once                                                                                     | **Simplified:** preserve support and forced pools, never likelihood               | implemented           | Probability analysis or seeded replay becomes a product goal    |
| Foyer variants              | `Q_Combat10/11` are one-exit, reward-free first-stage rooms; `Q_Combat11` has a prior-run encounter-completion gate | **Simplified:** both remain ordinary progressed-save candidates                   | implemented           | Save-profile state becomes a project input                      |
| Forced fork rooms           | Three two-exit rooms are forced at source depth 2 and three at source depth 5                                       | **Exact:** room declarations and physical exit fixtures                           | implemented           | --                                                              |
| Paired miniboss offers      | Each physical exit independently picks from the eligible forced miniboss pool; peers may repeat                     | **Exact:** two ordered target occurrences, one picked                             | implemented           | --                                                              |
| Miniboss progression gates  | Stalker and Eye require prior lifetime encounter completions                                                        | **Excluded:** progressed-save baseline includes both in their stage pools         | documented boundary   | Save-profile state becomes a project input                      |
| Reward-free combat spine    | Intro, foyer, ordinary combat, and forced fork rooms have no normal incoming reward                                 | **Exact:** `none` producers and no generated base-store authoring                 | implemented           | A supported target begins observing the generated store         |
| Miniboss rewards            | Every supported miniboss forces `TyphonBossRewards`                                                                 | **Exact:** counted resolved offer from that store on every physical offer         | implemented           | --                                                              |
| Miniboss encounter depth    | Brute, Stalker, and Tail count; Eye does not                                                                        | **Exact:** separate encounter profiles                                            | implemented           | --                                                              |
| Direct preboss shop         | Exact-depth-7 `Q_PreBoss01` is a single direct `Q_WorldShop`, not shop-then-fill                                    | **Exact:** one terminal occurrence with Q-specific shop state                     | implemented           | --                                                              |
| Boss and route completion   | Neutral `Q_Boss01` ends the canonical repeat-run route after progressed ending state                                | **Exact:** derived boss declaration followed by route completion                  | implemented           | The product supports an explicit narrative-progression run mode |
| Palace postboss and story   | Before the ending-state override, boss links to postboss and postboss links directly to Palace story                | **Excluded:** narrative-progression sequence omitted from the repeat-run baseline | documented boundary   | Narrative progression becomes a project input                   |
| Save/profile and difficulty | Intro combat, foyer/miniboss candidates, ending sequence, and boss variant depend on persistent state               | **Excluded:** progressed-save neutral-difficulty baseline                         | documented boundary   | Save-profile or difficulty state becomes a project input        |
| Automatic boss drops        | Typhon emits boss-specific and equipped-weapon-dependent drops                                                      | **Excluded:** no supported authored choice, store ratio, or execution instruction | documented boundary   | A consumer needs those exact drops                              |
| Optional interactions       | Challenges, Surface shop, gathering, and rerolls can add optional state                                             | **Deferred:** canonical v1 traces never activate or use them                      | documented boundary   | The corresponding authored action enters product scope          |

## Possibility Contract

Q uses the possibility-only picker contract from `../design/GAME_GENERATION_RULES.md`.
The scripted stage determines the eligible or forced pool, but it does not
choose a fixed room identity inside that pool.

This matters most at the two miniboss stages. Doors are generated one by one.
The normal picker does not remove the room chosen for an earlier peer, so a
two-exit predecessor may offer the same concrete miniboss on both exits. Each
offer is a distinct Room Occurrence with its own reward and feedback identity.

Q does not use a distinct-pair invariant, an injective room assignment, or a
special paired-miniboss topology node.

## Canonical Baseline

The supported Q projection assumes:

- an ordinary non-dream Surface run arriving from `P_PostBoss01`;
- a progressed save on which `TyphonIntro`, `MiniBossBrute`, and
  `BossTyphonTail01` have already been completed;
- the neutral boss-difficulty setting;
- the ending-state override that completes the run after Typhon;
- no natural Chaos, optional challenge, optional Surface shop, gathering,
  reroll, or other deferred interaction;
- no modeled automatic Typhon or weapon-dependent boss drop.

Persistent conditions are evidence for why the baseline exists. They are not
production `unsupported` requirements or authored project fields.

## Layout and Stage Sequence

Q is a `LinearBiome` whose declarations constrain each continuation stage:

```text
Q_Intro
  -> Q_Combat10 or Q_Combat11
  -> Q_Combat03, Q_Combat05, or Q_Combat15
  -> two independent offers from Q_MiniBoss02 or Q_MiniBoss05
  -> Q_Combat01/02/04/06/07/08/09/16
  -> Q_Combat12, Q_Combat13, or Q_Combat14
  -> two independent offers from Q_MiniBoss03 or Q_MiniBoss04
  -> Q_PreBoss01
  -> Q_Boss01
  -> route completion
```

Every arrow before the preboss is an ordinary generated decision whose picked
target continues the spine. The two miniboss decisions have two physical
target occurrences; every other supported generated decision has one.

The force depths below are evaluated against the current predecessor's
pre-creation `biomeDepthCache`. The created target enters at the following
depth. The layout must not shift those predicates to a UI row index or to the
target's post-entry depth.

The canonical target-generation view already contains the entered
predecessor's current source depth. The staged evaluator reads that history
value directly; it must not add the predecessor's declaration contribution a
second time. `Q_Intro` therefore generates the foyer at source depth `1` and
commits the cache to `2` before the picked foyer prepares.

| Source `biomeDepthCache` | Candidate stage                          | Physical targets            |
| ------------------------ | ---------------------------------------- | --------------------------- |
| 1                        | `Q_Combat10`, `Q_Combat11`               | one                         |
| 2                        | `Q_Combat03`, `Q_Combat05`, `Q_Combat15` | one of three two-exit rooms |
| 3                        | `Q_MiniBoss02`, `Q_MiniBoss05`           | two independent             |
| 4                        | `Q_Combat01/02/04/06/07/08/09/16`        | one                         |
| 5                        | `Q_Combat12`, `Q_Combat13`, `Q_Combat14` | one of three two-exit rooms |
| 6                        | `Q_MiniBoss03`, `Q_MiniBoss04`           | two independent             |
| 7                        | `Q_PreBoss01`                            | one terminal                |

The authored bound is seven continuation decisions after `Q_Intro`: six
generated batches followed by one terminal transition. Those batches contain
at most eight generated target occurrences: four single-target decisions plus
two two-target miniboss decisions. The preboss adds one terminal occurrence
and is not an ordinary continuation target.

## Fixed Intro and Foyer

`Q_Intro` is forced at `biomeDepthCache` 1, appears at most once, has one exit,
and uses the empty non-counting encounter in the normal Surface projection.
Its conditional RunProgress reward exists only in a dream-run entry case and
is excluded from the canonical baseline.

The first target is one of two concrete foyer maps:

| Room         | Exits | Reward | Encounter projection  |
| ------------ | ----- | ------ | --------------------- |
| `Q_Combat10` | one   | none   | one counting Q combat |
| `Q_Combat11` | one   | none   | one counting Q combat |

Both are real production candidates despite inheriting from a shared data
template marked `DebugOnly`. `Q_Combat11`'s lifetime `TyphonIntro` completion
gate is omitted under the progressed-save baseline. The first-time forced
`TyphonIntro` encounter is likewise excluded rather than retained as a
production requirement.

## Combat Stages

All supported Q combat rooms:

- have `MaxAppearancesThisBiome = 1` through `BaseQ`;
- own no incoming reward;
- use a counting Q encounter projection;
- retain their concrete room identity and physical exits.

The first forced fork stage is:

```text
Q_Combat03 | Q_Combat05 | Q_Combat15
```

Each room is forced at source `biomeDepthCache` 2 and has two physical exits.

The middle ordinary stage is:

```text
Q_Combat01 | Q_Combat02 | Q_Combat04 | Q_Combat06
Q_Combat07 | Q_Combat08 | Q_Combat09 | Q_Combat16
```

Their existing counter requirements reduce to this stage under the canonical
history. They remain concrete declarations rather than one interchangeable
combat placeholder.

The second forced fork stage is:

```text
Q_Combat12 | Q_Combat13 | Q_Combat14
```

Each room is forced at source `biomeDepthCache` 5 and has two physical exits.

The shared `Q_CombatData.DebugOnly` template marker is not a declaration-level
reason to omit its concrete room-set members. Concrete debug-only
`Q_MiniBoss01` is different and is excluded explicitly.

## Miniboss Stages

The first miniboss stage generates each physical exit independently from:

| Room           | Label   | Force depth | Encounter-depth effect | Persistent gate in game |
| -------------- | ------- | ----------- | ---------------------- | ----------------------- |
| `Q_MiniBoss02` | Brute   | 3           | counting               | none                    |
| `Q_MiniBoss05` | Stalker | 3           | counting               | completed Brute         |

The progressed-save projection omits Stalker's lifetime completion gate. Both
rooms are therefore members of the stage's forced support set, and either may
appear on each exit.

The second miniboss stage uses:

| Room           | Label | Force depth | Encounter-depth effect | Persistent gate in game |
| -------------- | ----- | ----------- | ---------------------- | ----------------------- |
| `Q_MiniBoss03` | Tail  | 6           | counting               | none                    |
| `Q_MiniBoss04` | Eye   | 6           | non-counting           | completed Tail          |

The progressed-save projection omits Eye's lifetime completion gate. The Eye
encounter does not inherit `GeneratedQ`, so it must not increment
`biomeEncounterDepth`; Tail does. This difference is observable history and
must survive declaration normalization.

Every supported miniboss forces `TyphonBossRewards`. Each physical exit owns
its own concrete counted reward offer even when both exits reference the same
room declaration. Only the picked and entered occurrence acquires its reward.

`Q_MiniBoss01` is explicitly `DebugOnly` on the concrete declaration and is
excluded from the production candidate pool.

## Reward and Store Rules

Q declares `TargetMetaRewardsRatio = 0.15`, but the supported Q spine never
uses the ordinary generated RunProgress/MetaProgress store:

- `Q_Intro` has no normal-run reward;
- all foyer, fork, and ordinary combat rooms have `NoReward`;
- minibosses force `TyphonBossRewards`;
- `Q_PreBoss01` owns the direct `Q_WorldShop` producer;
- the automatic boss drop is outside the modeled reward surface.

The target ratio remains documented game evidence, but it is unobservable to
the supported reward simulation. A Q generated batch therefore does not own a
meaningless authored `baseRewardStoreKey`. The shared authored schema makes
that field conditional on a layout reward policy that actually exposes a
generated base store.

`TyphonBossRewards` is a counted store containing two duplicate-capable Boon
entries plus Talent, triple Stack, and two Hammer entries with their normal
requirements. The audited reward kernel provides this concrete store and the
Q room declarations bind every supported miniboss to it.

`Q_WorldShop` is distinct from the ordinary `WorldShop`. Under the normal
second-half Surface context it exposes its concrete late-run option groups and
owns its own shop profile and recursive defaults. It is not a
generated counted reward bag and does not derive from Q's target ratio.
Entering it records no RunProgress or MetaProgress store provenance.

## Direct Preboss and Completion

`Q_PreBoss01` is forced at exact source `biomeDepthCache` 7. It is one direct
terminal occurrence with one `Q_WorldShop`; it does not use the F/G/P
shop-then-fill policy and has no free-reward companion occurrences.

The terminal's single exit begins the layout-owned completion sequence:

```text
Q_PreBoss01
  -> Q_Boss01
  -> route completion
```

`Q_Boss01` is the canonical neutral-difficulty Room Declaration. `Q_Boss02` is
the mutually exclusive difficulty variant and remains excluded until
difficulty is an explicit project input. Typhon's automatic Mixer and
weapon-dependent drops do not consume RunProgress or MetaProgress stores and
do not affect the target ratio ledger; they therefore have no modeled reward
leaf or store-history contribution.

The game data also contains:

```text
Q_Boss01 or Q_Boss02
  -> Q_PostBoss01
  -> Q_Story01
```

That is the Palace narrative-progression path. `Q_PostBoss01` links directly
to `Q_Story01`, and the story exit itself is not gated; the gating decision is
the boss-level ending-state override. After `ZeusPalacePostTrueEnding01`, the
boss sets `SkipLoadNextMap` and ends the run without loading either room.

The canonical progressed repeat-run projection models that boss-level route
completion. `Q_PostBoss01` and `Q_Story01` are excluded rather than declared as
normal fixed completion rooms. Supporting the Palace sequence later requires
an explicit narrative-progression mode, not an eligibility predicate on
`Q_Story01`.

## Counter and History Projection

Q history preserves:

- one non-counting fixed `Q_Intro` appearance;
- one creation per physical generated target, including repeated peer room
  identities;
- no reward offer for ordinary Q combat targets;
- one counted `TyphonBossRewards` offer per miniboss target occurrence;
- acquisition only from the picked miniboss occurrence;
- one encounter-depth increment for foyer, combat, Brute, Stalker, and Tail;
- no encounter-depth increment for Eye;
- one direct `Q_WorldShop` preboss occurrence;
- derived `Q_Boss01` history followed by route completion;
- no Q RunProgress/MetaProgress store-ratio ledger contribution from the
  supported ordinary or boss spine.

`biomeDepthCache`, `biomeEncounterDepth`, and route-wide room-history ordinal
remain separate axes. Miniboss force stages read the source room's pre-creation
depth, not the resulting target's entered depth.

## Excluded and Deferred Systems

The Q v1 baseline excludes:

- first-time `TyphonIntro` progression;
- lifetime gates on `Q_Combat11`, `Q_MiniBoss05`, and `Q_MiniBoss04`;
- concrete debug-only `Q_MiniBoss01`;
- difficulty variant `Q_Boss02`;
- Palace `Q_PostBoss01` and `Q_Story01` narrative progression;
- dream-run intro rewards and other dream variants;
- automatic Typhon and weapon-dependent boss drops.

It defers challenges, optional Surface shop interactions, gathering, rerolls,
and similar optional player actions. Natural Chaos remains suppressed by the
shared route-predictability policy.

## Declaration Coverage

The normalized catalog now expresses:

1. staged declaration-driven candidate pools inside `LinearBiome`;
2. fixed intro and `RewardlessCombat` foyer rooms with no incoming reward;
3. concrete one-exit and two-exit Q combat declarations;
4. independently generated repeated miniboss peers;
5. the Brute/Stalker/Tail counting and Eye non-counting encounter profiles;
6. concrete `TyphonBossRewards` counted-store rules;
7. a generated-batch policy with no authored base store when it is
   unobservable;
8. the direct `Q_WorldShop` terminal policy and concrete shop profile;
9. derived neutral `Q_Boss01` followed directly by route completion;
10. the progressed-save exclusions without production `unsupported`
    predicates.

The readable declaration file and focused parity matrix cover every supported
Q room and exact physical exit. Catalog and browser fixtures prove that the
same declaration, simulator, candidate, and editor authorities close Q through
the complete application product loop.

## Model Conclusions

Q keeps these shared contracts intact:

- concrete Room Declarations are unique while occurrences may repeat;
- `LinearBiome` remains a structural language rather than a synonym for
  unrestricted generated rooms;
- one physical exit owns one target occurrence and, when a producer exists,
  one incoming reward offer;
- validation models possibility rather than probability;
- room-local facts remain in declarations while layout owns stage order.

Q strengthens the shared model in four places:

- staged candidate support can be expressed by declarations and history
  without introducing a Q-specific topology kind;
- same-batch repeated room identities are valid even in a scripted miniboss
  fork;
- base reward-store authoring is conditional on an observable generated-store
  policy;
- completion is a layout-owned ordered sequence that may end after the boss
  and need not universally contain a postboss room.

F, G, P, Q, H, O, I, and N are closed as game-rule/design audits. Their shared
vocabulary and declaration imports are reconciled. Q's staged plan is
authorable, simulatable, and editable through the active application surface.
The complete N/O/P/Q route is the representative Surface profile and recovery
contract.
