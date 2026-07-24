# Tartarus Reconciliation Plan

## Purpose

This document defines the corrective implementation sequence for Tartarus
(`I`) before contextual-editor work continues.

The current production implementation is active end to end, but two of its
foundational assumptions are wrong:

1. `I_Story01` is modeled as a fixed entry immediately after `I_Intro`;
2. the game's randomly selected non-goal limit is exposed as authored biome
   state.

Those assumptions make the editor awkward and distort the game topology.
This plan replaces them through independently passing commits. The final
rules belong in `../biomes/I_GAME_RULES.md`; this file is delivery guidance,
not permanent game-rule authority.

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

The following facts are not open implementation choices:

- `I_Intro` is the fixed biome entrance and has one physical exit.
- Entering `I_Intro` initializes five Clockwork Goals.
- Under the ordinary non-dream Underworld baseline, `I_Intro` does not expose
  an editable reward. Its declared RunProgress reward is guarded by the
  dream-run and first-entered-biome conditions.
- The game randomly selects `MaxClockworkNonGoalRewards` from the inclusive
  range `3..6`.
- `I_Story01` is in `RoomSets.I`; it is not a derived room linked directly
  from `I_Intro`.
- `I_Story01` requires an I room to have already been offered in the current
  door batch. It therefore cannot occupy the first door.
- Its save-dependent `AlwaysForceRequirements` also require exactly one
  already offered exit. Forced Story placement therefore targets the second
  physical door; it does not make Story an entered fixed route node.
- `I_Story01` has one physical exit and
  `MaxCreationsThisRun = 1`.
- A created but unpicked Story occurrence consumes that creation. It cannot be
  offered again later in the run.
- A picked Story occurrence acquires neither a Clockwork Goal nor an ordinary
  Tartarus non-goal reward.
- A room inheriting `I_TwoExits` is eligible only when:

  ```text
  nonGoalRewardsAcquired < maxClockworkNonGoalRewards - 1
  ```

- The count of two-exit rooms is not the non-goal acquisition count. A
  two-door batch may offer Story or another special peer, and the player may
  pick the Goal door.

## Current Mismatches

| Area                   | Current production shape                                       | Required shape                                                 |
| ---------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Layout                 | `I_Intro -> I_Story01` are both fixed entries                  | only `I_Intro` is a fixed entry                                |
| Story declaration      | derived `fixedEntry` room                                      | authored Story occurrence                                      |
| Story placement        | always before the first authored decision                      | second-door candidate in a qualifying generated batch          |
| Story outcome          | unavoidable entered route node                                 | picked or unpicked real offer                                  |
| First Clockwork source | fixed Story                                                    | one-exit `I_Intro`                                             |
| Non-goal limit         | authored bounded integer                                       | declaration-owned possible game outcome                        |
| Editor                 | exposes a Biome Settings node and numeric limit selector       | begins with visible Entrance and the active decision frontier  |
| Generic editor         | treats fixed-entry layout as synonymous with I's numeric field | fixed entries and biome fields remain independent capabilities |

## Target Topology

The canonical structure becomes:

```text
I_Intro
  -> Clockwork decision
  -> Clockwork decision
  -> ...
  -> picked I_PreBoss02
  -> I_Boss01
  -> I_PostBoss01
```

`I_Intro` is layout-owned and visible, but it is not an authored Room
Occurrence. The first continuation uses the existing null parent to mean
"after the fixed entry sequence." Because Entrance has one physical exit, its
first generated batch has exactly one target.

The first target receives `ClockworkGoal`. If that picked target has two
physical exits, its subsequent batch can contain:

```text
door 1 -> Clockwork Goal
door 2 -> eligible non-goal or special peer
```

`I_Story01` participates in that second-door domain. It is never synthesized
outside the batch and never represented as a second topology authority.

Removing the false fixed Story entry also removes one false depth contribution.
The first Clockwork target is prepared directly from Entrance. Materialization,
force pressure, room eligibility, candidate evidence, and fixtures must use
that corrected counter schedule rather than adding a compensating offset.

The longest supported topology now includes:

```text
5 picked Goals
+ up to 6 picked NonGoals
+ 1 optionally picked Story
+ 1 picked Preboss
= 13 continuation batches
```

Physical exit constraints produce an exact maximum of 23 target occurrences:
the first batch after Entrance is singular, the batch after picked Story is
singular, and the terminal batch after the final one-exit count-advancing room
is singular. The layout bounds must change from `12 / 22` to
`13 / 23`; they must not retain the fixed-Story-era values.

The generated preboss contract remains unchanged:

- when Goals reach zero, `I_PreBoss02` is forced into the first eligible door;
- a two-exit predecessor may produce Preboss plus one ordinary peer;
- picking Preboss completes I;
- picking its peer leaves the Preboss occurrence unpicked and continues;
- I does not expose a separate `Go to Preboss` frontier action.

## Story Declaration Contract

`I_Story01` must normalize as an authored Story room with:

- template: `Story`;
- one `TartarusExitDoor`;
- fixed `Story` incoming reward;
- non-counting `I_Story01` encounter;
- `maxAppearancesThisBiome = 1`;
- `maxCreationsThisRun = 1`;
- second-door eligibility represented by at least one prior I target in the
  current generated batch;
- same-batch exclusion against `I_Story01`, `I_Reprieve01`,
  `I_MiniBoss01`, and `I_MiniBoss02`;
- declaration-owned depth force window `2..4`;
- no Clockwork capacity requirement, because Story is not an ordinary
  non-goal acquisition.

The save-dependent extra force predicate is outside the production model.
The application does not author `BossChronos01` completion or lifetime
`I_Story01` entry state. The shared policy remains:

- retain structural eligibility and save-independent force pressure;
- do not persist external save-state predicates as zombie requirements;
- document the omitted conditional `AlwaysForceRequirements` as game evidence.

If save-profile state later becomes a project input, the additional force
predicate can be added without changing Story's topology ownership.

## Clockwork Outcome Contract

Every picked I target resolves to one semantic outcome:

| Picked target    | Goal counter | Non-goal acquisition counter | Biome     |
| ---------------- | -----------: | ---------------------------: | --------- |
| Goal             |         `-1` |                    unchanged | continues |
| ordinary NonGoal |    unchanged |                         `+1` | continues |
| Story            |    unchanged |                    unchanged | continues |
| Preboss          |    unchanged |                    unchanged | completes |

Reprieve and miniboss behavior retains its declaration-owned reward and
counter rules. The simulator derives the outcome from batch order, the picked
Room Declaration, and the concrete resolved reward. The authored project does
not store a second Goal/NonGoal mode.

## Non-Goal Limit Authority

### Remove authored authority

Delete `maxNonGoalRewards` from:

- `LinearBiomePlan.state`;
- project defaults;
- project decoding and encoding;
- biome field commands and semantic addresses where they have no other
  consumer;
- the I layout `fields` array;
- structured-workspace biome-field interactions;
- the Biome Settings card and numeric selector.

This is an authored-schema authority switch. Increment
`PROJECT_DOCUMENT_SCHEMA_VERSION` from `5` to `6`. The project is still under
active development, so prefer a clear version failure and profile reset over a
one-off compatibility shim unless migration becomes an explicit product
requirement.

### Add declaration-owned possibility

The Clockwork batch policy owns:

```text
initialGoalCount = 5
nonGoalRewardLimit = inclusive integer domain 3..6
```

The domain is a possible game outcome, not probability metadata. Simulation
does not score the four values.

### Derive compatible limits

Progressive evaluation tracks which values remain compatible with the authored
prefix. It starts with:

```text
{ 3, 4, 5, 6 }
```

Selected topology and acquired producers narrow that domain. For integer
limits, a two-exit candidate with `reserve = 1` at acquisition count `n`
requires:

```text
limit >= n + 2
```

An ordinary picked NonGoal also requires the limit to be at least the resulting
acquisition count. Story changes neither condition.

The implementation may normalize the compatible suffix as an inclusive
`min..6` range, but public evaluation must preserve its semantic meaning:

- possible when at least one supported limit remains;
- impossible when no supported limit remains;
- never pretend that a remaining value was authored by the player.

Complete materialization must carry a deterministic witness selected from the
compatible domain. That witness is derived simulation output. A future
execution artifact may carry both the witness and the accepted domain so the
game module can audit the actual runtime roll.

## History and Lifecycle

The fixed entry history becomes:

```text
enter I_Intro
  -> initialize Clockwork outcome domain
  -> generate first one-door batch
```

History no longer emits `I_Story01` as a fixed-entry event. A Story occurrence
uses the ordinary generated-target lifecycle:

```text
create Story target on door 2
  -> offer Story
  -> if unpicked: retain offer and creation records only
  -> if picked: enter Story, run non-counting encounter, acquire Story,
     generate its one-door continuation
```

Story must not:

- decrement `remainingClockworkGoals`;
- increment `clockworkNonGoalRewardsAcquired`;
- consume a `TartarusRewards` counted entry;
- masquerade as a fixed route transition.

## Candidate and Validation Rules

Room candidate evaluation must use the same generated-batch context as selected
simulation.

Required focused cases:

- Story is impossible for exit 1;
- Story is possible or forced for exit 2 only after an I target occupies exit
  1;
- Story is impossible after any Story occurrence has already been created;
- Story is impossible beside Reprieve or either supported miniboss;
- Story remains constrained by its depth force window;
- selecting Story does not consume non-goal capacity;
- a two-exit room remains possible when at least one limit in `3..6` supports
  it;
- a two-exit room is impossible when the compatible limit domain is empty;
- candidate evidence identifies Clockwork capacity, batch order, creation cap,
  or special-peer conflict without exposing internal state names.

Selected-plan validation and candidate evaluation must share these
authorities. React must not infer second-door eligibility or compatible limit
values.

## Editor Contract

An empty I workspace must present:

```text
Entrance - fixed
Continue authoring here
```

The structure rail must not present:

- a Biome Settings node;
- a fixed Hades node;
- a Maximum NonGoal rewards control.

The inspector behavior is:

- focusing Entrance shows read-only room facts;
- initial/default focus selects the active continuation after Entrance;
- `Add Next Decision` creates the first one-target Clockwork batch;
- later decision workbenches derive target count from the picked predecessor's
  physical exits;
- Hades appears in the contextual room picker only for a supported second
  target;
- a picked Hades card exposes its Story room facts;
- an unpicked Hades card remains inspectable as a real offer;
- generated Preboss continues to appear inside its ordinary decision
  workbench.

Fixed entry rendering must be generic. `LinearBiomeEditor` may not require
`maxNonGoalRewards` merely because a layout uses `fixedEntry`.

## Implementation Slices

Every slice below is one independently reviewed, passing commit.

### Slice 1: Story and topology authority switch

Deliver:

- remove `I_Story01` from `iBiomeLayout.entries`;
- convert the room declaration to authored `Story`;
- add its batch-order, special-peer, cap, and force declarations;
- make `I_Intro` the sole derived entry and the first batch source;
- replace the old `12 / 22` bounds with `13 / 23`;
- remove the false Story depth contribution and rederive early-I counter
  contexts;
- materialize and compose Story through ordinary generated-target history;
- preserve picked and unpicked Story occurrences;
- update I completeness, selected validation, candidate evaluation, and
  minimal editor rendering so the active product remains coherent;
- correct the fixed-Story claims in `I_GAME_RULES.md`.

Gate:

- catalog, authored-project, I simulation, I candidate, I editor, and product
  fixtures pass;
- first I batch has one Goal target;
- first-I depth and force contexts match the direct
  `I_Intro -> Clockwork decision` sequence;
- the 13-batch and 23-target boundary is accepted while one additional batch
  or target is rejected;
- Story cannot occupy exit 1;
- picked Story changes neither Clockwork counter;
- unpicked Story prevents later Story creation;
- Preboss behavior remains unchanged.

Keep the existing authored numeric limit during this slice only. Its removal is
the next atomic authority switch.

### Slice 2: Latent non-goal limit authority switch

Deliver:

- add the declaration-owned inclusive `3..6` Clockwork limit domain;
- remove `maxNonGoalRewards` from authored state and layout fields;
- increment project schema version to `6`;
- update defaults, codec, commands, normalization, profiles, fixtures, and
  undo/redo assertions;
- add progressive compatible-limit state and complete deterministic witness
  resolution;
- update materialization, history, requirements, validation, and candidates to
  consume derived possibility state;
- remove the biome-field interaction and numeric editor control.

Gate:

- encoded project JSON contains no I non-goal limit;
- identical authored topology produces deterministic simulation;
- compatible limits narrow from selected topology without user input;
- impossible capacity produces a semantic finding;
- existing v5 documents fail at the schema boundary with a clear version
  message;
- full engine and planner lanes pass.

### Slice 3: Structured workspace and I authoring closure

Deliver:

- remove the obsolete Biome Settings structure node;
- render Entrance as the only fixed entry;
- focus the active continuation after Entrance by default;
- expose Story only in supported second-door contextual domains;
- retain picked/unpicked Story cards and semantic finding navigation;
- verify generated Preboss peer presentation after the topology correction;
- remove fixed-entry/I-field coupling from the generic linear editor.

Gate:

- an empty I project is authorable without selecting a hidden simulation
  parameter;
- every visible room or reward control resolves through a workspace
  interaction;
- no React branch interprets Clockwork counters, capacity, or Story ordering;
- focused I UI, planner, and product tests pass.

### Slice 4: Cross-layer closure and documentation audit

Deliver:

- rebuild the representative complete Underworld fixture through corrected I;
- cover Goal, NonGoal, Story picked, Story declined, repeated Preboss, and
  compatible-limit narrowing in the golden product loop;
- audit save/load, autosave, undo/redo, import failure, and finding navigation;
- reconcile `I_GAME_RULES.md`, `AUTHORED_PROJECT_MODEL.md`,
  `SIMULATION_AND_VALIDATION.md`, `CANDIDATE_EVALUATION_MODEL.md`,
  `EDITOR_MODEL.md`, migration provenance, and implementation progress;
- remove obsolete fixed-Story and authored-limit tests and terminology rather
  than retaining compatibility aliases.

Gate:

- `npm run check` passes;
- the production application contains no fixed `I_Story01` assumption;
- the production application contains no authored `maxNonGoalRewards`;
- the docs describe current behavior, not the superseded model;
- Phase 7 contextual UI work may resume.

## Required Test Matrix

### Catalog

- `I_Intro` is the sole fixed entry and has one exit.
- `I_Story01` is authored, one-exit, one-creation, and Story-producing.
- Story owns second-door/special-peer eligibility and depth force pressure.
- Clockwork policy owns five Goals and the `3..6` non-goal limit domain.

### Authored project

- empty I has no authored occurrence and no biome-specific scalar state;
- first batch uses null parent after fixed Entrance;
- Story is a normal target occurrence;
- distinct picked and unpicked Story states round-trip;
- schema v6 JSON round-trips without a non-goal limit.

### Simulation and history

- Entrance initializes Clockwork state and generates one door;
- the first Clockwork target uses the corrected post-Entrance depth without a
  synthetic Story increment;
- exit 1 is Goal;
- eligible exit 2 may be Story;
- picked Story changes neither Clockwork counter;
- declined Story remains in creation/offer history only;
- later Story creation is rejected;
- Story's one exit restores a one-target next batch;
- compatible cap values narrow correctly;
- no compatible value yields an addressed finding;
- picked generated Preboss still completes the biome.
- 13 batches and 23 targets are accepted as the exact authored maximum.

### Candidates

- Story exit-1 rejection;
- Story exit-2 support;
- same-batch special-peer rejection;
- prior-creation rejection;
- depth force evidence;
- two-exit capacity support against the compatible limit domain;
- selected-plan parity for every candidate outcome.

### UI and product loop

- Entrance visible;
- no fixed Hades node;
- no Biome Settings node or maximum selector;
- first decision authorable immediately;
- contextual Story choice appears only in the correct target;
- picked and unpicked Story inspectable;
- undo/redo and profile reload preserve corrected topology;
- Underworld route still reaches valid completion.

## Explicit Non-Goals

This correction does not:

- add save-profile progression inputs;
- simulate probability or random weights;
- model Nemesis replacement, Chaos, or deferred optional interactions;
- change I WorldShop contents;
- change generated Preboss semantics;
- add execution-plan compilation or runtime game control;
- introduce a general branching simulator beyond the bounded Clockwork outcome
  domain required by I.

## Completion Definition

Tartarus reconciliation is complete when a user can author the biome from its
visible fixed Entrance through generated Clockwork decisions, choose or decline
Story only where the game can offer it, reach Preboss without authoring hidden
RNG state, and receive candidate findings derived from one shared possibility
model.
