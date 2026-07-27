# Encounter Selection and Composition Findings

## Status

This is a forward-looking game-data audit and extension-readiness document. It
does not add concrete encounter selection, persistent NPC encounters, enemy
composition, or runtime forcing to the production model.

The current canonical product continues to suppress spontaneous persistent NPC
selection and intentionally abstracts ordinary generated enemy waves.

## Questions

This audit separates two related but different features:

1. Which concrete encounter is assigned to each stable room phase, including
   Artemis, Heracles, Icarus, Athena, and Nemesis variants?
2. Which enemies and waves are generated inside that concrete encounter, and
   at what fidelity can the game be controlled safely?

They share an execution checkpoint, but they must not share one undifferentiated
authored value. Encounter identity changes requirements, events, counter
effects, and sometimes phase shape. Enemy composition is generated content
inside the resolved encounter.

## Current Planner Boundary

The catalog currently gives every Room Declaration an `encounterProfileKey`.
An Encounter Profile is a canonical semantic projection with:

- stable phase keys and order;
- combat or non-combat kind;
- optional phase presence;
- encounter-depth effect;
- baseline encounter identity where current consumers require it;
- phase-owned reward offer points.

`SingleCountedCombat` intentionally collapses ordinary one-combat rooms whose
only currently modeled fact is one counting phase. H and O retain richer
profiles because their ordered phases affect counters and rewards.

The authored occurrence does not currently select a concrete game encounter.
The simulator emits the declaration-owned profile. It does not generate enemy
types, counts, waves, spawn timing, or map placements.

This existing stable phase address is the correct extension seam. A concrete
encounter should resolve a phase; it should not replace the Room Occurrence or
create a second topology.

## Game Encounter Selection

Relevant source:

- `RunLogic.lua::CreateRoom`
- `RunLogic.lua::ChooseEncounter`
- `RunLogic.lua::SetupEncounter`
- `RunLogic.lua::IsEncounterEligible`
- `RoomLogic.lua::SetupRoomMultipleEncountersData`
- `RoomLogic.lua::RecordEncounter`
- `RoomLogic.lua::StartEncounter`
- `EncounterSets.lua`

### Selection and record timing

When a room is created for an offered exit, `CreateRoom` selects its encounter
before the room is entered. `ChooseEncounter`:

1. reads the phase's supplied `LegalEncounters` or the room's set;
2. filters each candidate through encounter eligibility;
3. prefers forced eligible encounters;
4. otherwise chooses one eligible entry;
5. deep-copies and sets up the selected encounter.

`RecordEncounter` immediately updates run, game, biome, and depth caches. This
is an appearance/creation checkpoint, not encounter start.

`StartEncounter` later increments room, biome, and route encounter depth only
when the resolved encounter has `CountsForRoomEncounterDepth`.

The future simulator therefore needs separate facts for:

- encounter selection and occurrence at target creation/materialization;
- encounter start and its counter effect after room entry;
- encounter completion.

### Eligibility inputs

Encounter eligibility can depend on:

- membership in the phase or room's legal encounter set;
- room tags;
- incoming room reward;
- run and biome appearance caps;
- rooms since the same encounter;
- blocked or previously occurring encounters;
- external game-state and named requirements.

Repeated names in `EncounterSets` are weights. They do not create distinct
semantic candidates. The planner should normalize unique possible encounters
and retain weights only as audit metadata if a future probability consumer
actually needs them.

External save/profile predicates remain excluded unless the project adds an
explicit modeled input. An authored choice whose natural eligibility depends
on such a predicate cannot be silently treated as eligible.

## Persistent NPC Findings

Artemis, Heracles, Icarus, Athena, and Nemesis combat entries are members of
the same legal encounter pools as the generated baseline. They generally
inherit a biome-generated encounter and override requirements, events,
difficulty, wave parameters, enemy caps, or room interaction.

Two other mixed-pool encounter families matter to the same model:

- Arachne's F/G cocoon encounters are custom combat encounters that do not
  inherit `Generated` and do not set `CountsForRoomEncounterDepth`;
- `NemesisRandomEvent` inherits `NonCombat` and does not count.

They all replace or transform an encounter phase. They do not replace the
concrete Room Declaration.

### Biome encounter-depth audit

The following matrix compares each NPC or NPC-adjacent encounter against the
baseline phase it can occupy. A missing `CountsForRoomEncounterDepth` is false
at `RoomLogic.lua::StartEncounter`.

| Biome and phase pool                       | Special encounter family           | Baseline count | Resolved count | Whole-room depth delta | Reason                                                                                         |
| ------------------------------------------ | ---------------------------------- | -------------: | -------------: | ---------------------: | ---------------------------------------------------------------------------------------------- |
| F main, `FEncountersDefault`               | Artemis combat and intro variants  |              1 |              1 |                      0 | inherits `GeneratedF`                                                                          |
| F main, `FEncountersDefault`               | Nemesis combat and intro variants  |              1 |              1 |                      0 | inherits `GeneratedF`                                                                          |
| F main, `FEncountersDefault`               | Arachne combat                     |              1 |              0 |                     -1 | custom `BaseArachneCombat` has no counting flag                                                |
| F main, `FEncountersDefault`               | `NemesisRandomEvent`               |              1 |              0 |                     -1 | inherits `NonCombat`                                                                           |
| G main, `GEncountersDefault`               | Artemis combat variants            |              1 |              1 |                      0 | inherits `GeneratedG`                                                                          |
| G main, `GEncountersDefault`               | Nemesis combat                     |              1 |              1 |                      0 | inherits `GeneratedG`                                                                          |
| G main, `GEncountersDefault`               | Arachne combat                     |              1 |              0 |                     -1 | custom `BaseArachneCombat` has no counting flag                                                |
| G main, `GEncountersDefault`               | `NemesisRandomEvent`               |              1 |              0 |                     -1 | inherits `NonCombat`                                                                           |
| H passive room phase                       | `NemesisRandomEvent`               |              0 |              0 |                      0 | replaces `GeneratedH_Passive`, which is already non-counting                                   |
| H reward-cage phase                        | Nemesis combat                     |              1 |              1 |             0 per cage | inherits `GeneratedH`                                                                          |
| I main                                     | Nemesis combat                     |              1 |              1 |                      0 | inherits `GeneratedI`                                                                          |
| N main                                     | Artemis combat variants            |              1 |              1 |                      0 | inherits `GeneratedN`                                                                          |
| N main                                     | Heracles intro and combat variants |              1 |              1 |                      0 | inherits `GeneratedN`                                                                          |
| O intro phase, `OEncountersIntros`         | Heracles combat variants           |              0 |              1 |                     +1 | replaces non-counting `GeneratedO_Intro01` with counting `GeneratedO` inheritance              |
| O main combat phases, `OEncountersDefault` | Icarus intro and combat variants   |              1 |              1 |                      0 | inherits `GeneratedO`                                                                          |
| P pre-combat phase, `PEncountersIntros`    | Heracles combat                    |              0 |              1 |                0 total | counting encounter has `BlockMultipleEncounters`, so the later one-count main phase is omitted |
| P main combat phase, `PEncountersDefault`  | Athena intro and combat variants   |              1 |              1 |                      0 | inherits `GeneratedP`                                                                          |
| P main combat phase, `PEncountersDefault`  | Icarus combat                      |              1 |              1 |                      0 | inherits `GeneratedP`                                                                          |
| Q                                          | none in the audited NPC families   |              — |              — |                      0 | no NPC entry in the Q encounter pools                                                          |

Heracles has encounter declarations in N, O, and P; he has none in G
(Oceanus). The depth-changing Heracles case is specifically O's
`OEncountersIntros` phase, not Oceanus.

Within the audited NPC families, the complete set of whole-room depth changes
is therefore:

- Arachne in F or G: `-1`;
- `NemesisRandomEvent` in F or G: `-1`;
- Heracles in O: `+1`.

Heracles in P is a structural replacement with a net depth delta of zero. It
turns the normally non-counting first phase into a counting phase, then
terminates the sequence before the normally counting main phase.

### Run scope and spacing audit

The field NPC families are experienced at most once per run. Arachne's cocoon
encounter is the exception: it may occur once in F and once in G when its
cross-biome spacing requirement passes.

This common product rule is not represented by one common game field:

| Family   | Same-family run guard                                                                                                      | Cross-family or same-family spacing                                                                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Artemis  | `CurrentRun.UseRecord.NPC_Artemis_Field_01` must be false                                                                  | `NoRecentFieldNPCEncounter`: no listed field NPC encounter in the previous 6 rooms                                    |
| Heracles | no Heracles encounter in `CurrentRun.EncountersCompletedCache`                                                             | `NoRecentHeraclesEncounter`: no Heracles encounter in the previous 20 rooms; also the shared 6-room field-NPC spacing |
| Icarus   | `CurrentRun.UseRecord.NPC_Icarus_01` must be false, with additional current-run occurrence exclusions on concrete variants | shared 6-room field-NPC spacing                                                                                       |
| Athena   | `CurrentRun.UseRecord.NPC_Athena_01` must be false                                                                         | shared 6-room field-NPC spacing                                                                                       |
| Nemesis  | no Nemesis encounter in `CurrentRun.EncountersOccurredCache`; `NoRecentNemesisEncounter` also looks back 99 rooms          | shared 6-room field-NPC spacing; additional Nemesis shopping and biome-local guards                                   |
| Arachne  | no Arachne encounter in `CurrentRun.EncountersOccurredBiomeCache`                                                          | `NoRecentArachneEncounter`: no Arachne encounter in the previous 5 rooms                                              |

`EncountersOccurredBiomeCache` resets at biome transition. Consequently an
Arachne encounter in F does not consume G's biome-local cap; the five-room
lookback decides whether G is far enough from the F occurrence.

One raw-data irregularity needs an explicit disposition before the shared
spacing predicate is normalized: `NoRecentFieldNPCEncounter` lists
`AthenaCombatIntro` and `AthenaCombatP`, but not the production pool member
`AthenaCombatP02`. The P02 encounter still requires the predicate before it can
appear, but its own occurrence is not counted by that predicate when a later
field NPC is evaluated. Treat this as an audited game fact or correct it
deliberately; do not silently assume the list is a complete family expansion.

The planner should normalize the effective route rule while preserving the
checkpoint that proves it:

- encounter occurrence is recorded when an offered room is created;
- NPC use is recorded only through the NPC interaction;
- encounter completion is recorded after combat;
- previous-room spacing reads committed room history;
- biome-local occurrence caches reset at biome transition.

This means `oncePerRun` is an appropriate user-facing summary for field NPCs,
not a sufficient catalog implementation by itself. Candidate evaluation and
runtime conformance must use the declaration-owned occurrence/use/completion
predicate so unpicked generated encounters and committed encounters are not
silently treated as equivalent.

This disproves a simple “NPC name beside the room” model. Selection targets a
stable phase, and the selected encounter may change:

- effective concrete encounter identity;
- whether that phase counts encounter depth;
- whether later phases remain present;
- enemy-generation inputs;
- NPC events and rewards;
- eligibility of later rooms and encounters through occurrence history.

O and P are required proof cases before a concrete schema is locked. A model
that works only for one-phase F combat has not modeled persistent encounters.

## Multiple-Encounter Rooms

`SetupRoomMultipleEncountersData` selects and records every eligible phase when
the room is created. Later entries are marked as subsequent encounters. If a
selected encounter has `BlockMultipleEncounters`, construction stops and that
encounter becomes the last phase.

The current planner already exposes relevant semantic structure:

- O has an intro, a first counting combat, and a context-dependent second
  counting combat;
- P currently collapses internal phases where they have no supported consumer;
- H has its own Fields phase sequence.

Concrete encounter work may require expanding a previously collapsed profile,
but only when a supported concrete choice creates an observable distinction.
Do not transcribe all internal phases preemptively.

## Enemy Composition Findings

Relevant source:

- `RunLogic.lua::SetupEncounter`
- `RunLogic.lua::GenerateEncounter`
- `RunLogic.lua::FillEnemyTypes`
- `RunLogic.lua::FillEnemyCounts`
- `RunLogic.lua::IsEnemyEligible`
- `EncounterData.lua::Generated`
- biome entries in `EncounterData_Generated.lua`
- `EnemySets` and `EnemyData`

### Generation pipeline

For a generated encounter, the game:

1. resolves difficulty from base values, biome/run/encounter depth, modifiers,
   and multipliers;
2. computes the active-enemy cap;
3. chooses a wave count and wave templates;
4. allocates difficulty across waves;
5. chooses highlight or family encounter generation;
6. filters an `EnemySet` through introduction, elite, blacklist, grouping,
   trait, and enemy-specific requirements;
7. chooses enemy types;
8. allocates counts from each enemy's difficulty rating and count caps.

After generation, `SetupEncounter` can replace the entire result with an enemy
introduction encounter if a generated enemy has an unseen eligible intro.

Enemy composition is therefore a function of more than
`encounter key + biome depth`. It consumes run history, game profile,
room/map facts, traits, enemy declarations, RNG, and encounter-specific
overrides.

### Control feasibility

| Requested control                                   | Likely adapter                                                               | Current confidence                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| concrete encounter identity                         | narrow the legal set at `ChooseEncounter`, then call the game implementation | high; an older BiomeControl module already demonstrates this seam       |
| enemy pool, game-generated waves                    | replace or constrain `EnemySet` before `GenerateEncounter`                   | plausible; needs a live probe                                           |
| exact enemy types with game-derived counts          | seed or post-process generated waves                                         | unproven; introduction and eligibility repair may replace the encounter |
| exact types and counts for every wave               | provide a complete `SpawnWaves` result or replace generation output          | technically reachable but high risk; no validated adapter               |
| spawn points, timing, elite attributes, AI behavior | several later runtime systems                                                | outside this feature until a concrete consumer requires them            |

The global debug-style `ForceNextEncounter` path bypasses normal behavior such
as intro checks and is not the recommended production contract. The safer
encounter adapter narrows a declaration-validated legal set and lets the base
game perform setup and generation.

No equivalent conclusion is yet justified for exact waves. “The Lua table can
be overwritten” is not sufficient evidence of safe control.

## Recommended Extension Contract

### Layer 1: concrete encounter selection

When implementation begins, add normalized concrete Encounter Declarations
separate from Encounter Profiles. They should carry only planner-observable
facts:

- concrete game encounter key;
- normalized requirements and force rules;
- occurrence/spacing caps;
- room tag and reward compatibility;
- encounter-depth effect;
- phase-sequence effects such as terminating later phases;
- references to the enemy-generation policy needed by later work.

Room Declarations bind stable profile phases to finite candidate sources.
Authored Room Occurrences own the selected concrete encounter at each addressed
phase.

The resolved encounter spine is produced before history:

```text
baseline profile
  + authored per-phase concrete selections
  + declaration-owned sequence effects
  -> resolved ordered phases
  -> history and validation
```

History consumes only the resolved spine. It must not emit a baseline phase and
then append an unrelated “NPC happened” side channel.

Persistent NPC state is route-wide only where the game rule is route-wide:
spacing, prior occurrence, availability, and one-per-run behavior belong in
history and requirements. The selected destination remains the addressed phase
of one Room Occurrence. Do not create a floating NPC topology node.

### Layer 2: enemy-generation intent and result

Do not put enemy waves inside Encounter Profiles. Profiles describe semantic
room-phase structure; generated composition is a lower-level product of the
resolved concrete encounter.

If runtime probes justify enemy authoring, distinguish:

- authored generation intent: pool, allowed types, or exact requested waves;
- materialized composition: concrete wave/type/count result;
- runtime observation: what the game actually spawned.

The portable authored project should initially persist only the narrowest
control the product needs. A full copied `SpawnWaves` table is not an
appropriate default domain model.

Enemy keys must be catalog declarations with player-facing labels and verified
generator compatibility. UI strings, rendered wave rows, and selector order
remain outside persisted state.

## Validation and Findings

Concrete encounter candidates must be evaluated at the same pre-history
checkpoint the game uses for selection. Findings need stable phase ownership
and typed evidence for:

- encounter not legal for this phase or room;
- room tag or incoming reward conflict;
- appearance or spacing cap exhausted;
- required modeled history absent;
- required external profile input unavailable;
- selected encounter changes the resolved sequence incompatibly;
- selected encounter has no supported runtime adapter.

Enemy-composition findings, if added later, should separately identify:

- enemy not in the resolved pool;
- introduction or profile prerequisite unavailable;
- enemy pairing/group cap conflict;
- difficulty/count bounds incompatible;
- exact-wave runtime support unavailable.

Encounter invalidity must not be reported as a room-topology failure.

## Probe and Delivery Order

### Probe 1: encounter matrix

Build a source-backed matrix for every supported NPC encounter:

- concrete key and NPC;
- biome and legal phase pool;
- room-tag/reward restrictions;
- occurrence and spacing requirements;
- inherited baseline encounter;
- effective counting flag;
- sequence-termination behavior;
- NPC-specific reward or lifecycle effect.

Include at least Arachne F, `NemesisRandomEvent` F, Artemis F, Heracles O,
Heracles P, and Icarus O as contrasting fixtures. These cover negative,
positive, structural-zero, and ordinary-zero depth deltas.

### Probe 2: selection timing and runtime control

Instrument one normal and one NPC encounter from target-room creation through
completion. Prove that narrowing the legal set:

- selects the requested eligible encounter;
- records the correct occurrence at room creation;
- preserves base setup and introduction checks;
- emits the expected encounter-depth change at start;
- can suppress unplanned NPC variants.

### First implementation slice

Implement concrete encounter selection without enemy authoring:

1. normalized Encounter Declarations and phase candidate bindings;
2. occurrence-owned phase selections and strict codec;
3. resolved-spine materialization;
4. history, requirements, candidates, and findings;
5. UI phase selection;
6. runtime selection/suppression probe fixtures.

Use one-phase Artemis as the first vertical fixture, then close Heracles O and
P before declaring the model general.

### Probe 3: enemy-generation observation

Log the complete generation input and output for representative F, O, and P
encounters at several depths. Identify which inputs are reproducible in the app
and which remain external.

### Probe 4: bounded enemy control

Test, in order:

1. constrain the enemy pool and let the game generate;
2. request exact types while the game chooses counts;
3. request complete waves.

At each step, verify intro replacement, eligibility, active caps, map
compatibility, encounter completion, and runtime conformance reporting. Stop at
the narrowest level that satisfies the intended product workflow.

Enemy authoring becomes an implementation target only after one of these
levels has a repeatable safe adapter and a clear user-facing need.

## Open Questions

- Which persistent NPCs are in the desired first product scope beyond Artemis,
  Heracles, and Icarus?
- Does the user need to author the exact NPC occurrence, or only constrain/force
  route-level availability?
- Which P internal phases must become explicit once Heracles and Athena are
  supported?
- Which NPC rewards or post-encounter interactions affect supported reward
  history?
- Is enemy control intended as a pool constraint, exact types, or exact
  type/count waves?
- Can exact waves survive `SetupEncounter` introduction replacement and every
  supported room map?
- Which external progression predicates should become explicit project inputs?

These questions should be answered by focused fixtures and runtime probes, not
by generic schema options.
