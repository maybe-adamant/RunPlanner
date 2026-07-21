# I Game Rules

## Purpose and Status

This document is the concrete game-rule authority for Tartarus (`I`). It
defines how Clockwork Goal acquisition,
bounded non-goal progress, second-exit special rooms, and repeatable mixed
preboss batches can pressure-test the shared model without importing the
previous Lua control shape.

Shared picker, physical-door, cap, force, offer/acquisition, occurrence,
counted-bag, and fixed-completion semantics are defined by
`../GAME_GENERATION_RULES.md` and `../REWARD_MODEL.md`. I remains a `LinearBiome`,
but its `ClockworkDoorBatch` is the first verified generated batch whose picked
target can either continue the biome or enter its terminal. That semantic
outcome is derived from the picked Room Declaration, not persisted as a second
mode value.

I declarations, focused parity fixtures, authored topology, canonical
materialization, lifecycle history, selected validation, and candidate
evaluation are ported. Its complete editor, navigation, profile, recovery, and
browser interaction loop is active in production application capabilities.

## Evidence Status

These rules were verified against the Hades II script extraction and physical
map data on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataI.lua
../../../../1GameData/Scripts/RunData.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Scripts/RewardData.lua
../../../../1GameData/Scripts/LootData.lua
../../../../1GameData/Scripts/StoreData.lua
../../../../1GameData/Scripts/RequirementsLogic.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterData_MiniBoss.lua
../../../../1GameData/Scripts/EncounterData_Story.lua
../../../../1GameData/Scripts/EncounterData_Unique.lua
../../../../1GameData/Scripts/EncounterData_Boss.lua
../../../../1GameData/Maps/bin/
```

The previous Lua declarations and revamp audits are interpreted evidence only.
This audit confirms their Clockwork acquisition model and occurrence-based
direction, while correcting three inherited assumptions:

- the progressed-save baseline that selects `I_PreBoss02` also forces
  `I_Story01` from the one-exit intro;
- `I_Shop01` and `I_MiniBoss03` are truly picker-ineligible because their
  concrete declarations set `DebugOnly = true`;
- a post-goal two-exit decision is one real generated batch containing the
  preboss and an ordinary peer, not a terminal object plus a synthetic
  companion or an inferred declined-offer record.

## Feature Projection Map

The disposition vocabulary is defined by `../CATALOG_MODEL.md`; implementation
coverage is defined by `../MIGRATION_PROVENANCE.md`. I currently has normalized
declarations plus dormant authored-topology coverage; simulation and
presentation remain pending.

| Feature                      | Verified game behavior                                                                                       | Disposition and planner projection                                                   | Current coverage | Reconsider when                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| Linear entered spine         | Fixed intro and progressed-save Story lead into a bounded Clockwork loop                                     | **Exact:** `LinearBiome` with `ClockworkDoorBatch` continuations                     | materialized     | --                                                           |
| Room-set weights             | Several combat maps and Reprieve have extra room-set entries                                                 | **Simplified:** preserve support and forced pools, never likelihood                  | documented       | Probability analysis or seeded replay becomes a product goal |
| Clockwork globals            | Intro initializes five remaining goals and randomly chooses a non-goal cap from three through six            | **Exact:** declaration-owned initial five plus one authored possibility-selected cap | validated        | --                                                           |
| Goal offer and acquisition   | The first combat offer in a batch is Goal; entering it decrements remaining goals                            | **Exact:** goal is an acquisition-driven structural producer                         | materialized     | --                                                           |
| Non-goal rewards             | A concrete entered-room reward spawn increments `BiomeRewardsSpawned`; offers alone do not                   | **Exact:** concrete `TartarusRewards` resolution plus derived counter                | validated        | --                                                           |
| Base Run/Meta ratio          | `BaseI` declares `TargetMetaRewardsRatio = 0.25`, but every supported target overrides the resolved store    | **Simplified:** omit an unobservable generated base-store outcome                    | documented       | A later I target consumes the unoverridden store             |
| Two-exit reserve             | Two-exit target maps are ineligible when fewer than two non-goal acquisitions remain                         | **Exact:** declaration-owned Clockwork capacity predicate                            | declared         | --                                                           |
| Special peers                | Story, Reprieve, and minibosses have distinct peer-order, cap, force, reward, and counter rules              | **Exact:** separate Room Declarations and current-history predicates                 | declared         | --                                                           |
| Repeated preboss offers      | `I_PreBoss02` is forced once per predecessor after goals reach zero and may be declined on a two-exit source | **Exact:** a new terminal Room Occurrence in each generated batch                    | validated        | --                                                           |
| Conditional terminal outcome | Picking preboss completes I; picking its ordinary peer continues                                             | **Exact:** picked declaration role determines batch continuation effect              | materialized     | --                                                           |
| Preboss shop                 | Entered `I_PreBoss02` owns the five-group `I_WorldShop`; its Goal marker is structural                       | **Exact:** one shop-only terminal leaf with no free-reward realization               | validated        | --                                                           |
| Boss and postboss            | Neutral Chronos follows through `I_PostBoss01`; later restored-house scenes are progression presentation     | **Exact:** derived boss/postboss completion, then route completion                   | declared         | --                                                           |
| Boss automatic drop          | `MixerIBossDrop` is outside the modeled reward surface and has no downstream ratio consumer                  | **Simplified:** no reward leaf, acquisition, or terminal ledger entry                | documented       | A downstream consumer makes the fact observable              |
| Save/profile variants        | Intro combat, Story availability, preboss map, Reprieve, and combat 24 depend on persistent state            | **Excluded:** progressed-save normal-run baseline                                    | documented       | Save-profile state becomes a project input                   |
| Persistent NPC encounters    | Nemesis can replace an ordinary I encounter                                                                  | **Deferred:** suppress under the shared NPC-free baseline                            | documented       | Persistent NPC entities are implemented                      |
| Optional interactions        | Natural Chaos, wells, challenges, gathering, rerolls, and familiar events add optional state                 | **Deferred:** use the shared no-detour/no-action canonical trace                     | documented       | The corresponding authored action enters product scope       |

## Possibility Contract

I uses the possibility-only picker and reward contracts from
`../GAME_GENERATION_RULES.md` and `../REWARD_MODEL.md`. Duplicate room-set entries
change random weight only. They never make one positive-weight map more valid
than another.

Every room creation is a distinct Room Occurrence. All supported rooms inherit
`MaxAppearancesThisBiome = 1`, so an entered concrete map cannot be entered
again in I. Combat maps have no creation cap and may still be offered more than
once before entry. Unpicked peer occurrences remain real offers and consume
their concrete counted-bag entries.

The non-goal cap is also a possibility-selected game outcome. A project authors
exactly one of `3`, `4`, `5`, or `6`; simulation does not score their equal
random probability.

## Canonical Baseline

The supported I projection assumes:

- an ordinary non-dream Underworld run arriving from `H_PostBoss01`;
- a progressed save with `ReachedTrueEnding` and prior neutral Chronos
  completion, making `I_PreBoss02` and the repeat-run Story behavior canonical;
- the Reprieve world upgrade and the progressed `I_Combat24` map available;
- the neutral boss-difficulty setting selecting `BossChronos01`;
- no persistent Nemesis encounter replacement;
- no natural Chaos or other route-structural detour;
- no challenge, well, gathering, reroll, familiar-progression, or other
  deferred optional action;
- no modeled automatic Chronos or weapon-dependent boss drop.

Persistent conditions explain this baseline. They are not production
`unsupported` requirements and do not become authored project fields.

## Layout and Authored Bounds

The progressed-save entry is fixed:

```text
I_Intro
  -> I_Story01
  -> Clockwork decisions
  -> picked I_PreBoss02
  -> I_Boss01
  -> I_PostBoss01
  -> Underworld route complete
```

`I_Story01` is selected through the normal picker, but it is forced from the
one-exit `I_Intro` when neutral Chronos has previously been completed and Story
has not yet been entered this run. The canonical projection therefore places
it in the layout's derived fixed-entry sequence. Materialization still emits
its real creation, Story offer, entry, and history facts; persistence does not
store a choice whose support set is a permanent singleton under this baseline.

After Story, a complete route acquires exactly five Clockwork Goals and between
zero and the authored maximum number of non-goal rewards before entering the
preboss. Choosing a non-goal peer delays a Goal; choosing Goals immediately can
make the preboss eligible before the non-goal capacity is exhausted.

The longest supported spine uses all five Goals and all six possible non-goal
acquisitions before entering the preboss. The fixed Story is derived entry
rather than authored topology, so the authored bound after that entry is
twelve continuation batches:

```text
11 Clockwork acquisitions + 1 entered preboss = 12
```

Physical-exit and capacity restrictions reduce the exact authored maximum to
22 target occurrences. The first target after one-exit Story is singular. The
final count-advancing target must also be a one-exit room because two-exit
target maps become ineligible at the reserved-capacity boundary; the following
preboss batch therefore has one target.

## Physical Exits

The supported physical map data is:

| Physical exits      | Rooms                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| one                 | `I_Intro`, `I_Story01`, `I_Combat02`, `05..08`, `13`, `14`, `16`, `17`, `19`, `20`, `23`, `24`             |
| two                 | `I_Combat01`, `03`, `04`, `09..12`, `15`, `18`, `21`, `22`, `I_Reprieve01`, `I_MiniBoss01`, `I_MiniBoss02` |
| one fixed boss exit | `I_PreBoss02`                                                                                              |

The declaration named `I_TwoExits` is not a dynamic exit-count rule. It marks
maps that physically own two exits and adds a target-eligibility predicate that
reserves enough non-goal capacity for a later two-door decision.

## Clockwork State and Batch Lifecycle

Entering `I_Intro` initializes:

```text
remainingClockworkGoals = 5
maxClockworkNonGoalRewards = authored one of 3, 4, 5, 6
nonGoalRewardsAcquired = 0
```

The normalized Clockwork batch policy owns `initialGoalCount = 5`; both
materialization and history initialization consume that one declaration fact.
The non-goal cap remains authored project state because it is a
possibility-selected run outcome.

The game generates physical targets first and assigns incoming rewards in door
order afterward. Before the preboss is eligible, every normal first physical
target is a combat room. `ForcedFirstReward = ClockworkGoal` therefore gives
that first combat occurrence the Goal marker. A later combat peer observes the
already-offered Goal and receives a concrete non-goal reward while capacity
remains.

Goal versus NonGoal is therefore derived, never authored. Each combat
occurrence persists one complete potential Tartarus reward leaf. The leaf is
dormant when the occurrence resolves to Goal and active when the same
occurrence resolves to NonGoal. Retaining that dormant value lets ordinary
upstream edits change the derived realization without destructively replacing
room-local intent.

```text
target creation in physical order
  -> reward assignment in the same order
  -> first combat offer becomes ClockworkGoal
  -> later combat offer becomes TartarusRewards, or Goal at the cap
  -> picked occurrence enters
  -> its producer resolves and updates the corresponding counter
```

`ClockworkGoal` is a structural countdown producer, not a player reward atom.
Its spawn callback decrements `remainingClockworkGoals` on the entered
occurrence and clamps at zero. It does not increment
`nonGoalRewardsAcquired` and does not consume the Tartarus counted bag.

A spawned concrete Tartarus reward increments the game's
`BiomeRewardsSpawned` after entry. This happens when the reward object spawns,
before its physical pickup. Ordinary rewards reach that boundary after combat;
Devotion reaches it before its before-combat chosen-source acquisition. Because
ordinary room rewards are required before continuation, the canonical trace may
expose the folded semantic counter as `nonGoalRewardsAcquired`; no downstream
room-generation view can observe a spawned-but-unacquired value. An unpicked
non-goal target still contributes an offer and bag consumption but never
increments the counter.

At the selected non-goal cap, every remaining combat reward is forced to Goal.
Separately, any target map with two physical exits is eligible only while:

```text
nonGoalRewardsAcquired < maxClockworkNonGoalRewards - 1
```

Those two rules prevent indefinite avoidance: once capacity is exhausted, the
entered spine is driven through one-exit Goal rooms until Goal completion and
then through a one-exit preboss batch.

## Reward Store and Room Producers

`BaseI` sets `ForcedRewardStore = TartarusRewards`. Every supported I target
therefore resolves the same declaration-owned forced-store override. I
generated batches do not select RunProgress versus MetaProgress and their
normalized batch-store policy is `none`; there is no otherwise-observable base
store to author. `none` does not mean a counted target lacks provenance: its
Room Declaration resolves `TartarusRewards` before its resolved offer is
validated.

`BaseI.TargetMetaRewardsRatio = 0.25` can still make the game compute an
initial RunProgress or MetaProgress value, but each supported target replaces
that value with its forced Tartarus store before reward assignment. The
initial outcome has no supported offer, acquisition, ledger, or downstream
consumer, so persisting it would add authority without information.

The counted `TartarusRewards` bag contains:

- triple money;
- triple Pom;
- two Hammer entries with their distinct current-run requirements;
- Devotion;
- a major Talent drop;
- three duplicate-capable Boon entries.

Concrete room filters then apply:

| Room family     | Incoming producer                                           |
| --------------- | ----------------------------------------------------------- |
| ordinary combat | derived Goal or Tartarus non-goal with Boon excluded        |
| Reprieve        | Tartarus non-goal with Devotion excluded                    |
| miniboss        | Tartarus Boon only                                          |
| Story           | fixed Story                                                 |
| preboss         | structural Goal marker plus local `I_WorldShop` after entry |

Devotion retains its normal two-exit, prior-source, and room-spacing
requirements. It can appear on a qualifying ordinary combat peer but is
excluded from Reprieve and is impossible on a one-exit source.

## Combat Rooms and Encounter Projection

All 24 combat maps are positive-weight room-set candidates except that
`I_Combat24` additionally requires `biomeDepthCache < 6`. Its Reprieve world-
upgrade predicate is omitted under the progressed-save baseline.

The following maps carry the Clockwork capacity predicate because they have
two physical exits:

```text
I_Combat01 I_Combat03 I_Combat04 I_Combat09 I_Combat10 I_Combat11
I_Combat12 I_Combat15 I_Combat18 I_Combat21 I_Combat22
```

Every entered combat uses one counting I encounter. The game distinguishes
ordinary, smaller-map, first-visit, Goal, and first-repeat Chronos-dialogue
variants. Under the progressed NPC-free baseline those variants have the same
modeled counter and reward lifecycle, so the planner intentionally projects
one counting `ClockworkCombat` encounter profile. Enemy composition and wave
difficulty remain outside the product.

## Special Rooms

### Fixed Story

`I_Story01`:

- is the canonical first generated target after `I_Intro`;
- has one physical exit;
- has `MaxCreationsThisRun = 1`;
- owns fixed Story and a non-counting encounter;
- does not increment the non-goal reward counter.

Its alternate ordinary two-exit eligibility and depth `2..4` force pressure
remain game evidence, but the fixed progressed-save entry consumes its one
creation before the Clockwork loop begins.

### Reprieve

`I_Reprieve01`:

- has two physical exits and the Clockwork capacity predicate;
- can be generated only after another I peer in the same batch;
- requires `biomeDepthCache >= 4`;
- has `MaxCreationsThisRun = 1`;
- owns a non-counting HealthRestore encounter;
- retains a concrete Tartarus incoming reward with Devotion excluded.

Entering it therefore increments the non-goal reward counter even though its
encounter itself is non-counting.

### Minibosses

`I_MiniBoss01` (Verminancer) and `I_MiniBoss02` (Goldwrath):

- each has two physical exits and the Clockwork capacity predicate;
- can be generated only after another I peer in the same batch;
- require `biomeDepthCache >= 3`;
- use the raw force window `3..7`;
- have `MaxCreationsThisRun = 1` and one-appearance caps;
- reject the other variant after it has been entered;
- force a Tartarus Boon;
- contribute one counting encounter and one non-goal acquisition when entered.

Their per-predecessor special-room exclusion prevents Story, Reprieve, and the
two supported minibosses from filling both exits of one batch.

### Explicitly Excluded Concrete Rooms

`I_Shop01` and `I_MiniBoss03` set `DebugOnly = true` on their concrete room
declarations. `ProcessDataInheritance` deliberately does not inherit a
template's `DebugOnly` flag, while `IsRoomEligible` rejects a concrete flag.
Those two rooms are therefore excluded even though they appear in `RoomSets.I`.

`I_PreBoss01` is the pre-true-ending/dream variant and is excluded by the
canonical progressed-save baseline. `I_ChronosFlashback01`,
`I_DeathAreaRestored`, and `EndCredits01` are narrative or restored-house
progression rooms rather than editable repeat-run route structure.

## Conditional Preboss Batch

`I_PreBoss02` becomes eligible when `remainingClockworkGoals <= 0`. It has:

- `MaxCreationsPerRoom = 1`;
- `AlwaysForceOncePerRoom = true`;
- additional force when the non-goal cap has been reached;
- one fixed exit linked to `I_Boss01`;
- no free-reward realization;
- the local five-group `I_WorldShop`.

The normalized declaration uses `force: always` behind the Goal eligibility
gate. This is the exact observable union of `AlwaysForceOncePerRoom` and the
additional capacity force; the latter cannot add support once an eligible
preboss is already forced, while `MaxCreationsPerRoom` still excludes a second
copy on the same predecessor.

Doors are generated sequentially. On the first physical exit after Goal
completion, `AlwaysForceOncePerRoom` places the preboss in the forced pool. On
a two-exit predecessor, its per-room creation cap makes the same room
ineligible for the second exit, which is then filled by an ordinary eligible I
candidate.

```text
one-exit predecessor:
  exit 1 -> I_PreBoss02, necessarily picked

two-exit predecessor:
  exit 1 -> I_PreBoss02
  exit 2 -> ordinary I target
  exactly one is picked
```

If the ordinary peer is picked, the preboss occurrence remains an unpicked
dead leaf and a new `I_PreBoss02` occurrence can be generated from the later
predecessor. `MaxCreationsPerRoom` is local to one predecessor; it is not a
run-wide cap.

The authored domain represents this as one `ClockworkDoorBatch`. A target that
resolves to the terminal Room Declaration has `completeBiome`; every other
supported target has `continueBiome`. The picked target's declaration role
selects the effect. No separate authored terminal mode, synthetic companion,
or singleton preboss state is needed.

The editor advances this policy only through `Add Next Decision`. Before Goal
completion the policy derives a Goal on the first exit; after Goal completion
the same action derives `I_PreBoss02` there. That preboss target is directly
pickable. I does not expose `Go to Preboss`, because its preboss is part of the
generated door batch rather than an independent terminal transition.

The preboss itself inherits the structural Clockwork Goal marker. Entering it
only clamps the already-zero Goal counter and creates no authored reward leaf.
Every offer has its own occurrence ID. An unpicked occurrence is a dead-leaf
door offer and requires no shop state. Picking it atomically installs complete
`I_WorldShop` defaults when absent; only that entered occurrence materializes
its five shop offers and purchases.

## Fixed Completion

Picking `I_PreBoss02` closes editable topology and materializes:

```text
I_PreBoss02
  -> I_Boss01 with neutral BossChronos01
  -> I_PostBoss01
  -> Underworld route complete
```

`BossChronos02` is the user-selected increased-difficulty variant and is
excluded from the neutral baseline. `MixerIBossDrop` and the weapon-dependent
automatic drop are outside the modeled reward surface. Because I ends the
route, no later generated-store ratio consumes a boss store-history entry; the
canonical projection records neither a reward leaf nor otherwise-dead ledger
state.

The postboss room's linked flashback, restored-house, and credits chain is
persistent narrative flow after the modeled route. It does not extend the
editable or canonical repeat-run room history.

## Deferred and Excluded Systems

The canonical I trace omits or suppresses:

- first-visit `ClockworkIntro` and other save-progression encounter variants;
- `I_PreBoss01`, dream-run rewards, and dream-only behavior;
- persistent Nemesis encounter replacement;
- natural Chaos and other route-structural detours;
- challenges, wells, gathering, rerolls, familiar events, and similar
  optional player actions;
- enemy-wave composition, difficulty, and presentation;
- automatic boss and weapon drops;
- post-run restored-house narrative rooms.

Deferred or excluded behavior remains documented here. It does not create
production `unsupported` predicates or dormant validation codes.

## Declaration-Port Contract

The I implementation delivers:

1. the derived fixed `I_Intro -> I_Story01` entry sequence with real canonical
   creation, offer, and entry facts;
2. fixed five Goals and authored `maxNonGoalRewards` in `{3,4,5,6}`;
3. all 24 supported combat declarations with exact physical exits;
4. the two-exit Clockwork capacity predicate and `I_Combat24` BDC ceiling;
5. fixed `TartarusRewards` store ownership, exact room filters, and one dormant-
   capable complete resolved-offer leaf per combat occurrence;
6. derived Goal/NonGoal realization from physical offer order with no authored
   discriminant;
7. entered-producer-driven Goal and non-goal counters with their exact spawn
   timing;
8. Reprieve and both supported miniboss declarations with peer-order rules;
9. explicit exclusion of concrete debug-only Shop and miniboss 03;
10. one `ClockworkDoorBatch` policy that admits terminal and ordinary peers;
11. repeated `I_PreBoss02` occurrences with picked-target continuation effect;
12. the five-slot `I_WorldShop` terminal leaf;
13. derived neutral `I_Boss01` and `I_PostBoss01` completion;
14. the NPC-free, no-detour, no-action baseline without production
    `unsupported` requirements.

The declaration import, authored topology, canonical/history projection,
selected validation, candidates, and editor projection are active through the
application capability boundary. Schema version 4 persists
`maxNonGoalRewards`, attaches the first batch to the final fixed entry without
a fake occurrence, admits repeated generated preboss targets, and requires
complete WorldShop state only on the picked preboss. Materialization and the
editor share one offer-time Goal/NonGoal projection; history advances only
entered producers. Production navigation, profiles, recovery, and the complete
F/G/H/I product loop are covered by the final activation fixture.

## Required Fixtures

I's focused and product-loop fixtures prove:

- the forced `I_Intro -> I_Story01` progressed-save entry;
- one- and two-exit combat batches before Goal completion;
- Goal decrement only for the picked and entered Goal occurrence;
- non-goal offer bag consumption for unpicked peers without counter increment;
- each authored non-goal cap from three through six;
- two-exit target ineligibility at the reserved-capacity boundary;
- Reprieve and miniboss peer-order, force, reward, and counter effects;
- preboss ineligibility before five Goal acquisitions;
- a one-exit post-goal batch that necessarily enters preboss;
- a two-exit post-goal batch that enters preboss;
- a two-exit post-goal batch that declines preboss, continues through its peer,
  and later creates a new preboss occurrence;
- terminal `I_WorldShop` completeness and materialization only on the entered
  occurrence;
- derived neutral boss/postboss history and route completion;
- exact twelve-batch and 22-target authored bounds.

## Audit Closure

I is closed as a game-rule and design audit when this document and the shared
model agree that:

- Goal and non-goal realization is derived rather than authored, while its
  potential concrete non-goal leaf remains stable;
- Goal and non-goal progress follows entered-producer timing;
- Tartarus uses a fixed store context rather than generated Run/Meta choice;
- the progressed Story is part of the canonical entered spine;
- repeated preboss offers use ordinary occurrence identity;
- a mixed preboss/ordinary batch is one domain decision whose picked target
  determines continuation;
- N completed the final hub pressure test in `N_GAME_RULES.md`; the declaration
  freeze now includes both conditional-terminal and persistent-hub forms.
