# Tartarus Reconciliation Plan

## Purpose

This document records the corrective Tartarus (`I`) implementation sequence
that must close before contextual-editor work continues. Final game behavior
belongs in `../biomes/I_GAME_RULES.md`; this file is delivery guidance.

The correction has three linked goals:

1. model `I_Story01` as a real generated second-door occurrence;
2. make `I_Intro` an authored single-choice Entrance and the source of the
   first Clockwork decision;
3. persist one explicit simulated `MaxClockworkNonGoalRewards` roll from
   `3..6`.

## Verified Game Facts

The correction is grounded in:

```text
../../../../1GameData/Scripts/RoomDataI.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Scripts/RequirementsLogic.lua
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Maps/bin/I_Intro.thing_bin
../../../../1GameData/Maps/bin/I_Story01.thing_bin
```

The following facts are fixed:

- entering `I_Intro` initializes five Clockwork Goals and rolls an inclusive
  integer from `3` through `6`;
- `I_Intro` has one physical exit;
- `I_Story01` belongs to `RoomSets.I`, requires an earlier target in the same
  generated batch, and therefore cannot occupy exit one;
- Story has one physical exit and `MaxCreationsThisRun = 1`;
- picked Story changes neither the Goal countdown nor the non-goal reward
  count; an unpicked Story still consumes its creation;
- a room inheriting `I_TwoExits` is eligible only while:

  ```text
  nonGoalRewardsAcquired < maxClockworkNonGoalRewards - 1
  ```

- normal reward acquisition increments the non-goal count; an unpicked offer
  does not;
- after all five Goals are acquired, generated batches may contain Preboss and
  an ordinary peer; only picking Preboss terminates the biome.

## Modeling Decision

The app models possibility, not probability. The random `3..6` roll is
therefore an explicit authored simulation input:

```text
maxNonGoalRewards: 3 | 4 | 5 | 6
```

This is intentionally more explicit than the game UI. It avoids hidden
compatibility inference and makes each saved project describe one concrete
possible run. The declaration owns the range but no member as a default.
Authorship remains unresolved until one explicit selection. Materialization,
history, requirements, validation, and candidates consume the selected value
without selecting a second witness.

The field is not a contextual candidate query. Every declared value is a
supported game outcome, so the editor may render the stable declaration-owned
range directly.

## Target Topology

```text
authored I_Intro Entrance
  -> Clockwork decision
  -> Clockwork decision
  -> ...
  -> picked I_PreBoss02
  -> I_Boss01
  -> I_PostBoss01
```

The first continuation is owned by the authored `I_Intro` occurrence. Null
parent identity remains reserved for truly layout-derived fixed-entry
sequences and must not represent I.

The first target receives `ClockworkGoal`. A later two-exit source may produce:

```text
door 1 -> Clockwork Goal
door 2 -> eligible non-goal or special peer
```

`I_Story01` participates in the second-door domain. It is never synthesized
outside a batch and never represented as another topology authority.

The longest supported topology remains:

```text
5 picked Goals
+ up to 6 picked NonGoals
+ 1 optionally picked Story
+ 1 picked Preboss
= 13 continuation batches
```

Physical exit constraints yield the existing 23-target bound.

## Persistence Contract

Schema version `7` owns the authority switch:

- I layout start is `authoredStart` with fixed choice `I_Intro`;
- I layout state contains exactly `maxNonGoalRewards`;
- the field is a bounded integer with declaration-owned minimum `3`, maximum
  `6`, and default `3`;
- project creation writes the default;
- `ReplaceBiomeField` replaces the value atomically;
- codec validation rejects absent, extra, non-integer, or out-of-range values;
- older schema versions fail clearly; no compatibility shim is retained.

## Simulation and History Contract

Entering the authored Entrance produces the ordinary room lifecycle and then
the first one-door generation point. Clockwork state begins with:

```text
goalsRemaining = 5
nonGoalRewardsAcquired = 0
maxNonGoalRewards = authored biome field
```

Every batch records the exact pre-generation state. Goal versus NonGoal is
derived from offer order and room role:

- the first eligible combat target is Goal;
- Goal suppresses its dormant concrete Tartarus reward leaf;
- an ordinary peer activates its concrete reward leaf;
- picked Goal decrements the Goal countdown at acquisition;
- picked ordinary reward increments the non-goal count when its reward spawns;
- Story affects neither counter;
- Preboss terminates only when picked.

Capacity failure is evaluated against the one authored maximum. There is no
compatible-limit domain and no deterministic materialization witness.

## Editor Contract

An empty I plan presents one Entrance picker. Selecting it creates the
`I_Intro` occurrence and exposes the first frontier.

The Entrance inspector also owns the compact `Rolled non-goal limit` selector.
There is no separate Biome Settings structure node. The selector dispatches
`ReplaceBiomeField` and its values come from the normalized field descriptor.

Decision summaries derive Clockwork Goal before inspecting room reward
controls. A dormant reward attached to a Goal room must not leak into the
structure summary.

## Delivery Slices

### Slice 1: Story topology correction — complete

Delivered:

- `I_Story01` moved from fixed entry to authored generated target;
- I bounds corrected to thirteen batches and 23 targets;
- Story placement, creation cap, picked/unpicked lifecycle, and counters
  covered;
- generated Preboss behavior preserved.

### Slice 2: Explicit roll and authored Entrance authority switch — complete

Deliver:

- change `I_Intro` to an authored single-choice Entrance;
- add the bounded `maxNonGoalRewards` layout field;
- increment schema version to `7`;
- remove latent compatible-limit and witness state;
- thread the authored value through materialization, history, requirements,
  validation, and candidate preparation;
- place the field editor inside the Entrance inspector;
- update fixtures, codec tests, undo/redo coverage, and docs.

Gate:

- encoded I projects contain one bounded roll and an authored Entrance;
- first Clockwork continuation is parented by the Entrance occurrence;
- each supported roll changes two-exit capacity at the correct boundary;
- no production Clockwork compatibility domain or selected witness remains;
- focused and complete checks pass.

### Slice 3: Structured workspace and I authoring closure — complete

Deliver:

- project Clockwork batch facts once in the workspace;
- render Entrance, decisions, Goal summaries, Story peers, and terminal peers
  from that projection;
- keep React free of Clockwork counter interpretation;
- retain exact semantic focus and candidate activation boundaries.

Gate:

- I is authorable from an empty plan;
- Goal summaries never show dormant ordinary rewards;
- Story is inspectable only as a real target;
- generated Preboss peer presentation remains accurate;
- focused browser and product-loop tests pass.

### Slice 4: Cross-layer closure — complete

Deliver:

- rebuild the representative complete Underworld fixture through authored I;
- cover rolls `3..6`, Goal, NonGoal, Story picked, Story declined, repeated
  Preboss, profile persistence, undo/redo, and finding navigation;
- remove obsolete fixed-Intro and latent-limit terminology;
- run the complete quality gate.

Gate:

- `npm run check` passes;
- production contains no fixed `I_Story01`, fixed `I_Intro`, Clockwork
  compatible-limit domain, or materialization witness;
- authority and progress docs describe schema version `7`;
- Phase 7 contextual UI work may resume.
