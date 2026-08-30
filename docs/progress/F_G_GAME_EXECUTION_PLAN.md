# F/G Game Execution Plan

## Status

**Implementation-ready.**

This temporary cross-repository plan starts current-project game execution for
the complete-valid Erebus (`F`) and Oceanus (`G`) route prefix. It is grounded
in the standalone planner at base commit
`c5278df8c0ce2710967fc99f21eabadfbf822c71` and the Plan Executor repository at
commit `a5149cc276756de18a439a66db9d94231e28f6c9` plus its explicitly inventoried
dirty prototype work.

Implementation spans:

- this Run Planner repository, which owns validation, canonical simulation,
  execution compilation, publication, and the wire fixtures;
- `../run-planner-modpack/Submodules/adamantRunPlanner-Plan_Executor`, which owns
  the thin Hades II decoder, runtime adapters, trace observation, and mismatch
  reporting; and
- `../run-planner-modpack` only when a completed Plan Executor gate is ready to
  be pinned by the shell repository.

The earlier app implementation at `../RunPlanner` is read-only historical
evidence. No old execution model, compiler, bundle, or application code is
ported or cherry-picked. The existing Plan Executor prototype is preserved
inside its own repository before active implementation is replaced.

## Objective and user-visible outcome

A player can author a complete-valid Underworld project from the real run start
through F or through F/G, publish its execution-only JSON from the desktop app,
start a new Hades II run, and follow the authored route. The game module
realizes the facts the planner controls, observes the actions that remain under
player control, and stops applying the plan at the first loss of contact.

At F/G closure:

- every simulation-relevant fact present in a complete-valid F or F/G canonical
  product has an explicit runtime disposition;
- planner Run State at each supported lifecycle checkpoint is compared with a
  bounded live-game observation and participates in first-mismatch blocking;
- the app never exports an incomplete, invalid, or execution-unsupported F/G
  product;
- the game module does not revalidate planner semantics or reconstruct a
  possible route;
- the player must begin a new run after publication; a plan can never attach to
  a run already in progress;
- stopping after F or G is a successful configured execution extent, not a
  mismatch; and
- later vanilla play may continue after that terminal boundary without the
  module claiming conformance.

This plan does not attempt to implement the whole game module. H, I, N, O, P,
Q, Dream Dives, Hub visits, Fields topology, Ship wheels, and their special
commands belong to later plans.

## Authorities and evidence

Stable planner authority remains in:

- `docs/design/ARCHITECTURE.md`;
- `docs/design/SIMULATION_AND_VALIDATION.md`;
- `docs/design/ROOM_LIFECYCLE_MODEL.md`;
- `docs/design/REWARD_MODEL.md`;
- `docs/design/GAME_GENERATION_RULES.md`;
- `docs/biomes/F_GAME_RULES.md`; and
- `docs/biomes/G_GAME_RULES.md`.

`docs/design/GAME_INTEGRATION_BOUNDARY.md` currently records the deferred
boundary. Gate A replaces its deferred status with the stable current boundary
established by this plan; the temporary gate sequence remains here.

Historical evidence establishes that these contacts worked in a live game:

- desktop/app publication to the module's fixed profile slot;
- module receipt of that published file;
- starting and next-room forcing; and
- reward-store, reward-type, and Boon-source forcing.

Those successes justify re-probing the same seams. They do not make the old
protocol or implementation authoritative. Encounter, trait, Room Action,
object, Chaos, Anomaly, and complete F/G behavior still require current-protocol
tests and live contact.

## Locked trust boundary

The trust chain is:

```text
complete-valid current ProjectEvaluationAssembly
  -> app execution compiler
  -> execution-only JSON
  -> strict Plan Executor decoder
  -> fixed runtime translation and execution
```

The app compiler accepts the exact immutable evaluation assembly from one
simulation. It checks that the already-published execution eligibility product
admits compilation and then projects its complete-valid canonical snapshots and
histories. It does not rerun validation, recompute candidates, or inspect the
authored project to recover missing semantic facts.

The Plan Executor trusts the decoded execution plan's semantic conclusions. It
must not:

- evaluate room, reward, encounter, trait, or action eligibility;
- choose a different legal room, reward, trait, or fallback;
- replay lifecycle counters to reconstruct topology;
- repair a route after a mismatch;
- consume the editable project document; or
- interpret planner findings, candidate domains, or UI products.

Strict JSON shape, byte and collection bounds, protocol/catalog compatibility,
closed reference checks, and live identifier existence are decoder or contact
safety. They are not semantic revalidation.

The game module is a thin translator/executor, not a second compiler. It may
build bounded lookup indexes for decoded plan-local identities, but those
indexes cannot derive semantic instructions absent from the wire product.

## Start-of-run and execution extent

Run Planner already permits only a configured contiguous prefix beginning at
the real route start. The compiler trusts that validated invariant; it does not
add another route-start rule.

The module reads and freezes `active.runplanner.json` only at `StartNewRun`.
Publishing or replacing the file later does not alter the active run. If the
bus was missed, the player must start another run; there is no mid-run attach,
resume, cursor search, or reconciliation mode.

The first protocol supports these configured extents:

```text
F
F -> G
```

Reaching the last configured room boundary moves the session to `completed`.
The module then applies no further instructions and treats later vanilla rooms
as outside the declared execution extent rather than as mismatches.

## Execution room product

The compiler organizes every reached room around the same three semantic
products exposed by the current planner model:

```text
execution room
  contents   what the reached room contains
  trace      what happens inside it and in what lifecycle order
  outgoing   what it generates when leaving and which continuation is expected
```

These names describe protocol semantics, not React tabs. The compiler consumes
canonical rooms, lifecycle timelines, histories, batches, and fixed links; it
does not serialize workspace Overview, Timeline, or Doors projections.

### Contents

Contents includes the concrete room/occurrence identity and applicable
entry-time facts: incoming reward, encounter envelope and selected phases,
required objects, Shop/Well/Pool inventory, acquisition surfaces, and other
modeled F/G room features. The module realizes these at the verified room
creation or preparation seam once the player has compliantly reached their
owner.

### Trace

Trace is the ordered cooperative run contract. It contains closed player
events, automatic events, controlled resolutions, and lifecycle checkpoints.
It is compiled from selected executable action rows, automatic timeline
effects, exact acquisition products, and only the canonical history contacts
needed for observation. Repair rows, proposals, UI ranks, finding labels, and
unselected optional actions are excluded.

An action that was optional to author becomes an expected trace event once the
author selected it. `optional` authoring participation must not become an
advisory runtime step.

Run State is attached to trace as a diagnostic at its existing engine-owned
lifecycle checkpoint. It observes the state produced by the trace; it never
selects the next instruction, repairs state, or substitutes for a missed event.

### Outgoing

Outgoing includes the physical batch in exact order, every generated room and
incoming reward, entry-time additional continuations, the selected
continuation, and declaration-fixed Boss/Postboss links. The module realizes
the available topology and rewards; it does not take the selected door for the
player.

## Realize, observe, and verify contract

Enforcement is allowed only before or during the game's legitimate resolution
seam. The module never repairs state after an action merely to make the trace
look correct.

| Planner event or fact                                                                   | Authority                                           | Module behavior                                                                                                                            | Concrete F/G acceptance witness                                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Reached room identity and room-contained encounter/objects                              | Module opportunity; player traversal                | Realize the declared contents, then observe entry into the marked plan-local occurrence                                                    | F opening and ordinary room; repeated concrete room names remain distinct occurrences        |
| Physical outgoing rooms, reward stores, reward types, and Boon/Devotion sources         | Module generation                                   | Realize the complete ordered batch before display                                                                                          | F two-door batch and G three-door batch preserve physical order and peer rewards             |
| Authored selected exit                                                                  | Player                                              | Observe only; entering the marked target confirms the choice                                                                               | Taking another generated F/G door produces player divergence                                 |
| Ordinary trait offer, rarity, levels, and fallback                                      | Module offer; player selection                      | Realize the authored screen before presentation, observe the selected trait, verify acquisition                                            | F Boon with three alternatives and one selected trait                                        |
| Chaos three-pair offer                                                                  | Module offer; player selection                      | Realize all three authored curse/blessing pairs and values, observe the selected pair, verify the result                                   | Natural or Ixion Chaos reached from F/G                                                      |
| Pom target screen                                                                       | Module offer; player selection                      | Realize the authored eligible targets/levels, observe the selected target, verify its level change                                         | F/G Pom acquisition including no-level traits remaining non-targets                          |
| Purchase, sale, keepsake change, fountain use, and Nemesis interaction                  | Player                                              | Observe the interaction and its position; never synthesize input                                                                           | Selected F/G Shop/Well/Pool/rack/fountain/Nemesis actions remain in authored order           |
| Inventory or interaction result selected before the player acts                         | Module resolution; player trigger                   | Realize the selected inventory/result at its natural seam, then observe participation                                                      | World Shop, Stygian Well, Purging Pool, and modeled Nemesis outcomes                         |
| Successful resource presence, automatic collection, and element outcome                 | Module contents; game room-exit trigger             | Realize the declared resource point, observe automatic gathering at room exit, control and verify the authored once-per-run element result | One successful F/G resource placement reaches its declared element outcome                   |
| Steady Growth, Transcendent Embryo, Phial, and other authored random automatic outcomes | Game trigger; module-selected resolution            | Observe the trigger, control the exact authored random result at its resolution seam, then verify state                                    | An F/G encounter-end proc and an eligible fountain result                                    |
| Deterministic encounter, cleanup, commit, and exit boundaries                           | Game                                                | Observe and verify; do not force the lifecycle forward                                                                                     | F/G encounter start/end, outgoing generation, room commit, and exit advance the trace cursor |
| Run State at an engine-owned lifecycle checkpoint                                       | Planner diagnostic; game live state                 | Observe a bounded live-state projection and compare it with the compiled expected snapshot; never use it to drive or repair execution      | F room-entry and pre-exit counters, bags, god pool, traits, and retained effect state agree  |
| Fixed Preboss to Boss to Postboss continuation                                          | Module topology; game transition                    | Realize the declared fixed successor and observe entry                                                                                     | F and G fixed links use ordinary occurrence identity, not completion-room special cases      |
| G picked-exit open baseline                                                             | Module traversal condition; player choice           | Realize the planner's documented open-picked-exit baseline, then observe immediate traversal                                               | No unmodeled `GeneratedG_ExtraDoor` encounter enters the trace                               |
| Anomaly replacement and hidden return                                                   | Module special G topology; player traversal/outcome | Realize the closed Anomaly command, observe its authored outcome, then realize and verify the hidden fresh G return                        | One eligible G target retains its reward provenance while replacing its room identity        |

The table is a protocol acceptance contract. A new instruction family must name
its authority, natural seam, runtime disposition, and concrete fixture/probe.
Do not add a generic `forceable` Boolean, callback registry, adapter name, or
property bag. Shared instructions remain closed semantic unions; each biome
adds closed special commands only when its own implementation plan reaches
them.

## Run State conformance diagnostics

The planner already publishes Run State at exact lifecycle owners. Ordinary
F/G occurrences expose `roomEntered` and `beforeRoomExit`; later biome profiles
may add their own phase-specific checkpoints under their own plans. The
execution compiler consumes those existing snapshots rather than reconstructing
state from history events.

The wire product carries a bounded runtime-observable expectation, not the
workspace presentation and not a full duplicate `HistoryStateView`. For F/G it
may include, as the corresponding runtime adapters become supported:

- encounter, biome, route, and room-history counters;
- remaining reward-bag counts or ranges and concrete reward priorities;
- acquired/effective god pool;
- equipped traits, slots, rarity, levels, bans, elements, and upgrade state;
- active and matured Chaos state;
- configured/effective Arcana and Fear plus Forfeit state;
- current keepsake chronology and retained effect counters;
- Hex capacity, banked/invested points, and closure state; and
- other planner-modeled branch state that has a direct bounded game
  observation in the current F/G gate.

The module does not evaluate requirement expressions to reproduce Run State.
The compiler supplies already-resolved expected identities, exact values, or
bounds. The module reads corresponding live values through fixed observers and
compares them field by field. A value with no proven live observer remains an
execution-coverage failure for the gate that claims it; it is not silently
omitted from a supposedly complete diagnostic surface.

A Run State difference is an ordinary first mismatch. If an earlier observed
player action directly caused it, that earlier action owns
`playerDivergence`. Otherwise the state difference is a
`conformanceDiscrepancy` and enters planner/game-data adjudication. Reports name
the checkpoint, semantic field/key, expected exact value or range, observed
value, and last confirmed player action.

Run State cannot search for a matching future instruction, advance past a
missing trace event, attach midway, or resume after desynchronization. It is a
high-fidelity witness of the same blocking horizon, not a fallback cursor.

## Mismatch and blocking horizon

The active session has four states:

```text
inactive -> synchronized -> completed
                        \-> desynchronized
```

Waiting for an expected action is not a mismatch. A mismatch occurs when:

- the player performs a conflicting or unplanned simulation-changing action;
- a selected action's legal lifecycle window closes without that action;
- an expected automatic event or controlled result differs;
- the live room, reward, encounter, object, offer, or acquisition loses contact
  with its instruction; or
- a supported live Run State field differs from its compiled checkpoint
  expectation; or
- a runtime adapter cannot safely apply its current realization.

The first mismatch freezes the execution horizon. The module records it once,
applies no realization instruction in the suffix, and permits vanilla play to
continue without claiming conformance. This is the runtime counterpart of the
planner's first-blocking assessment horizon.

The module assigns only the top-level disposition:

| Disposition              | Mechanical evidence                                                                                             | Meaning                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `playerDivergence`       | The mismatch is directly caused by an observed player choice, skipped selected action, or unplanned interaction | The cooperative trace was not followed; no planner correction is implied |
| `conformanceDiscrepancy` | No observed player action caused the mismatch                                                                   | Refer for planner/game-data adjudication; do not repair in Lua           |

Adjudication may ultimately identify source-data error, planner under-modeling,
compiler loss, or a runtime-adapter defect. The module reports evidence and
does not choose among those causes.

A mismatch report contains:

- plan, protocol, catalog, and game versions/fingerprints;
- route extent and plan-local room/trace-step identity;
- the stable planner semantic owner;
- expected and observed facts;
- the last confirmed player action;
- triggering agency (`player`, `game`, or `module`);
- lifecycle checkpoint and whether realization had been applied;
- Run State field-level differences, including expected ranges where
  applicable;
- the applicable realization instruction identity; and
- bounded surrounding event context.

Automatic import into the planner is excluded. This plan requires a structured
module-owned report plus a concise human-readable status/log representation.

## Execution-only protocol and publication

The published artifact is an execution-only, versioned, deterministic JSON
document. It is not the editable schema-73 project and is not embedded in the
user's Save/Load file. It includes:

- protocol version, catalog version, project identity, and deterministic plan
  fingerprint;
- one Underworld execution extent beginning at F;
- plan-local room, trace-step, and continuation identities;
- closed contents, trace, outgoing, fixed-link, Chaos, Zagreus, and Anomaly
  records needed by the implemented F/G surface; and
- bounded expected Run State diagnostics at their engine-owned checkpoint
  addresses; and
- stable semantic owners for mismatch reporting.

It excludes authored commands, incomplete state, findings, candidate products,
UI labels/layout, catalog declarations, executable code, Lua adapter names,
callables, and a full duplicate planner history.

Run Planner owns the TypeScript protocol model, deterministic codec, compiler,
and canonical positive/negative JSON fixtures. The Plan Executor owns the
independent strict Lua decoder and pins exact readable copies of the relevant
wire fixtures with producer commit and protocol version recorded. No compressed
vectors, fixture SHA manifest, binary transport, migration chain, or arbitrary
compatibility layer is added without measured need.

The desktop publisher remains separate from project Save/Load and autosave. A
narrow native capability:

1. discovers compatible local r2modman Hades II profiles;
2. verifies the ReturnOfModding and Plan Executor layout;
3. lets the user choose a compatible profile when necessary;
4. derives the fixed module destination itself;
5. writes within the locked byte bound using atomic sibling replacement; and
6. leaves the previous published plan untouched on any failure.

The fixed destination remains:

```text
ReturnOfModding/config/adamantRunPlanner-Plan_Executor/active.runplanner.json
```

React receives profile identities and publication results, never arbitrary
filesystem paths. Browser publication remains unavailable.

## F/G closure surface

“Full F/G” means full coverage of the current planner's modeled canonical F/G
surface, not every raw game behavior. The final compiler-coverage test must
exercise or independently enumerate these families:

- F opening selection and reward;
- F/G ordinary one-, two-, and three-exit batches;
- picked and unpicked occurrence identity with repeated room declarations;
- ordinary, fixed, free, Shop, miniboss, Story, Fountain, and Preboss rewards;
- Boon, Devotion, Hammer, Spell/Talent, Pom, minor, and other supported reward
  payloads plus their selected acquisition outcomes;
- ordinary and NPC encounter selections, including supported Artemis and
  Nemesis combat/event outcomes;
- Room Action ordering and automatic encounter-end effects;
- room-entry and pre-exit Run State agreement across counters, bags, god pool,
  traits, elements, Arcana/Fear, keepsakes, Chaos, priorities, and Hex progress;
- Midshop inventory, purchases, Travel Deal consequences, Stygian Wells,
  Purging Pools, keepsake racks, fountains, and resource outcomes where they
  occur in F/G;
- natural and Ixion Chaos, Chaos traits, return topology, and Ixion cleanup;
- Zagreus contract topology where authorable;
- F/G takeover Preboss batches and fixed Boss/Postboss occurrences;
- G's reward-free intro and open-picked-exit baseline;
- G Anomaly replacement/outcome/hidden return; and
- Narcissus choice and consequential pickup chronology.

The following existing planner simplifications remain authoritative and do not
become runtime features:

- enemy-wave composition and enemy perk authoring;
- G locked-exit encounters outside the open-picked-exit baseline;
- progression/save-profile variants excluded by the F/G authorities;
- sim-neutral health, damage, gold, and meta-progression quantities;
- unmodeled NPC appearances and interactions; and
- any feature the current F/G authorities explicitly classify as excluded or
  deferred.

The executor must realize or suppress the supported baseline sufficiently to
keep excluded spontaneous systems from changing the traced canonical history.
It must not independently broaden the planner model.

## Repository ownership

### Run Planner: planner engine

`packages/planner-engine` owns:

- the execution protocol's semantic TypeScript model and deterministic codec;
- compilation from the exact eligible `ProjectEvaluationAssembly`;
- coverage failure with stable semantic owners when a canonical F/G fact lacks
  an execution disposition; and
- compiler and wire-fixture tests.

The compiler consumes complete-valid `CanonicalBiome`,
`CanonicalBiomeHistory`, resolved rewards/traits, room lifecycle timelines,
batches, and fixed links. It must not import the Hades II catalog
implementation, React, Tauri, browser APIs, or game-module adapter concepts.

### Run Planner application and desktop host

`apps/planner` owns:

- composition of the exact current evaluation into the compiler;
- Publish-to-Game eligibility and application operation;
- profile discovery/publication capabilities behind a narrow adapter;
- Tauri commands and constrained filesystem behavior; and
- publication UI/status without altering Save/Load dirty state or authored
  history.

### Plan Executor

The module owns:

- bounded fixed-slot reading;
- strict JSON/protocol decoding and reference closure;
- immutable `StartNewRun` session initialization;
- plan-local indexes and occurrence markers;
- fixed runtime adapters for the current closed instructions;
- trace observation and first-mismatch blocking; and
- structured diagnostics.

The shell modpack owns only the validated submodule pin and release composition.

## Prototype preservation

Before active Plan Executor replacement, checkpoint its current branch and
dirty work exactly. The current dirty inventory is:

```text
M README.md
M src/mods/session.lua
M tests/test_managed_lifecycle.lua
M tests/test_session.lua
```

After that checkpoint, preserve the former active implementation under:

```text
archive/phase9-prototype/
```

The archive retains its source, tests, fixtures, and a README recording the
source commit, successful live probes, unit-tested-only behavior, and obsolete
assumptions. It is excluded from active imports, module packaging, lint, and
tests. New production code may not import it. Reviving an idea means proving
the current seam and implementing it cleanly in active code, not copying an
archived file back into production.

## Delivery gates and commit boundaries

Every gate is a complete cross-repository vertical slice. Start from the exact
recorded commits/worktrees, use a fresh executor and independent reviewer under
the repository gate routine, and keep one production/test process active at a
time. The main session owns protocol decisions, cross-repository fixture sync,
accepted finding disposition, final diff review, commits, and shell pins.

### Gate A — Preserve the prototype and re-prove the start contact

**Outcome:** a current complete-valid F fixture compiles, publishes, is frozen
at `StartNewRun`, realizes the F opening room/reward, and observes its entry.

Run Planner work:

- replace the deferred integration boundary with the locked trust, artifact,
  start-only, three-product, and mismatch contracts from this plan;
- add the smallest execution-only protocol and compiler slice required for F
  opening contents and its terminal/next contact;
- add deterministic positive and malformed/unsupported wire fixtures;
- add the separate Publish-to-Game application capability and constrained
  desktop profile publisher; and
- keep project Save/Load/autosave unchanged.

Plan Executor work:

- checkpoint the current prototype work, then preserve it under the archive;
- install a fresh active bounded reader, JSON/protocol decoder, immutable
  session, diagnostics, and opening-room/reward adapter;
- freeze the plan only at `StartNewRun`; and
- prove inactive, synchronized, completed, malformed, unsupported, and missing
  live-identifier states.

Primary tests and probes:

- engine compiler/codec tests own admission and wire shape;
- application/native tests own fixed target derivation, bounds, atomic failure,
  and Save/Load isolation;
- Lua decoder/session tests consume the producer fixture;
- a live probe re-proves publication, receipt, F starting room, incoming reward,
  and room-entry observation.

Intentional commits:

1. Plan Executor prototype checkpoint before movement;
2. one Run Planner Gate-A commit;
3. one active Plan Executor Gate-A replacement commit; and
4. one shell submodule-pin commit after both repositories pass their gate.

### Gate B — Shared F/G room contents and outgoing topology

**Outcome:** ordinary F/G traversal, peer generation, chosen branches, and
fixed completion links execute through current canonical occurrence identity.

Included:

- plan-local occurrence identities and marked room copies;
- room contents for ordinary/fixed encounter identities and required objects;
- one-, two-, and three-exit normal batches with exact physical order;
- resolved shared/forced stores, concrete rewards, and Boon/Devotion sources;
- selected versus unpicked targets;
- F/G takeover Preboss batches;
- ordinary Preboss to Boss to Postboss fixed links;
- configured F-only and F/G terminal completion; and
- player-door divergence versus non-player room/reward discrepancy;
- the first F/G Run State diagnostic projection at `roomEntered` and
  `beforeRoomExit`, initially covering counters and reward bags with exact/range
  comparison.

The module never identifies the next instruction by raw room name or depth.
Repeated declarations remain distinct marked plan-local occurrences.

Primary witnesses:

- F two-exit peer batch with different rewards and an unpicked dead leaf;
- G three-exit batch preserving physical order;
- F and G Preboss free-reward capacity;
- fixed Boss/Postboss entry; and
- wrong-door selection freezes the suffix while a forced wrong reward produces
  a conformance discrepancy.

### Gate C — Room trace, encounters, rewards, and trait acquisition

**Outcome:** the first full room-local `contents -> trace -> outgoing` program
executes and audits the player's ordered cooperation.

Included:

- lifecycle boundary observation and room-local trace cursor;
- concrete F/G encounter phase realization and start/end observation;
- incoming, free, local, and encounter-owned acquisition points;
- selected versus skipped acquisition dispositions;
- Boon, Devotion, Hammer, Pom, Spell/Talent, minor, and supported reward
  surfaces present in F/G;
- ordinary trait offers, fallback, rarity, effective levels, Pom targeting,
  Chaos-independent replacements, and acquisition verification;
- Run State comparison for god pool, traits, slots, rarity/levels, bans,
  elements, Arcana/Fear, and Forfeit state;
- selected Room Actions and automatic Steady Growth/Embryo outcomes; and
- action-window-close, unplanned-interaction, wrong-trait, and automatic-outcome
  mismatch witnesses.

The protocol carries resolved outcomes, not trait prerequisites or another
equipped-state simulator. The game remains responsible for applying a selected
trait through its normal acquisition path.

### Gate D — F/G objects and interaction chronology

**Outcome:** current F/G room features are present with exact inventories and
their selected interactions occur in canonical order.

Included where reachable in F/G:

- World Shop contents and purchase observation;
- Travel Deal replacement/settlement;
- Stygian Well contents, stacking items, purchases, and consequential effects;
- Purging Pool inventory and ordered sales;
- keepsake-rack changes and their targets;
- fountain use and Aromatic Phial outcome;
- successful resource placement/outcome;
- modeled pickup producers, Artificer, Time Piece, Sea Star, Echo, and related
  nested acquisition chronology when their canonical sites occur; and
- deterministic automatic effects triggered by those actions.

Sim-neutral quantities remain unmodeled, but an interaction that changes later
canonical eligibility or chronology must be observed and verified.

This gate extends Run State observation for keepsake chronology and retained
effects, reward priorities, Hex progress, Artificer state, and the modeled
consequences of its object interactions.

### Gate E — Chaos and additional exits

**Outcome:** natural and Ixion-forced Chaos use one Chaos topology contract,
while provenance remains only where cleanup needs it.

Included:

- declaration-owned can-spawn versus can-host behavior from compiled facts;
- natural and Ixion-generated Chaos gates;
- one pending Ixion consumed by the first seen Chaos gate regardless of gate
  source;
- plan-recorded Ixion origin only for topology introduced by Ixion;
- purchase removal/recompile cleanup represented solely by the newly published
  immutable plan;
- Chaos room identity and return topology;
- all three Chaos curse/blessing alternatives, shared rarity, durations and
  authored values;
- active/matured Chaos Run State comparison at the next published checkpoint;
- selected pair observation and trait acquisition; and
- Zagreus contract as its own closed additional-exit command where authorable.

Primary witnesses include F natural Chaos, F/G Ixion forcing, authored natural
gate satisfying pending Ixion, consecutive Ixions producing gates in separate
eligible rooms, and wrong Chaos-pair selection blocking later realization.

### Gate F — G special commands and supported NPC outcomes

**Outcome:** the remaining special F/G canonical commands execute without
turning the runtime into a topology or event planner.

Included:

- G reward-free intro;
- G open-picked-exit baseline and suppression of unmodeled lock encounters;
- Anomaly replacement, retained reward provenance, authored success/failure,
  and hidden fresh G return;
- Narcissus selected benefit plus independently ordered consequential pickups;
- supported Artemis combat reward;
- supported Nemesis combat and `NemesisRandomEvent` family/outcome, including
  incoming-reward suppression and interaction results; and
- suppression/contact reporting for other excluded spontaneous F/G NPC event
  systems.

Each special behavior is a closed semantic command compiled from the existing
canonical product. No generic biome callback or command-expression language is
introduced.

### Gate G — Full F/G closure and conformance handoff

**Outcome:** every canonical fact in the agreed F/G surface has a disposition,
the representative start-to-G trace passes, and durable authority replaces the
temporary delivery plan.

Required closure work:

- run an independent compiler-coverage audit over representative maximal F/G
  fixtures and fail on every unhandled semantic owner;
- compare every supported maximal-fixture Run State checkpoint with matching
  and deliberately mutated live-observer values, including one exact counter,
  one ranged bag count, one trait, and one retained-effect witness;
- retain focused primary matrices with their owning package/module tests and
  remove duplicated facade assertions;
- run live probes for ordinary traversal, traits/actions, objects, Chaos, and
  Anomaly after their narrow gates are stable;
- exercise player divergence and a deliberately injected non-player
  conformance discrepancy end to end;
- record truthful protocol/catalog/module compatibility and known source/model
  discrepancies;
- absorb stable decisions into `GAME_INTEGRATION_BOUNDARY.md`, the relevant
  architecture/biome authorities, the module README, and durable progress;
- remove temporary gate language and delete this plan; and
- pin the final validated Plan Executor commit in the shell repository.

Run Planner runs one complete `npm run check` only after narrow tests and review
fixes are stable. Plan Executor runs `lua tests/all.lua` and `luacheck src` for
each affected gate, plus its packaging/smoke validation when active module
composition changes. Do not rerun a complete gate solely to reproduce already
passing sequential evidence when no relevant file changed.

## Gate review questions

Every executor and reviewer must answer these questions for its gate:

1. Did the compiler consume only the exact complete-valid canonical assembly,
   without recomputing planner policy?
2. Is each new wire field required by a concrete current F/G adapter or
   mismatch witness?
3. Is each player action observed rather than synthesized?
4. Is each controlled fact applied at a legitimate pre-resolution seam rather
   than repaired afterward?
5. Does the first mismatch block every later realization?
6. Can the module mechanically distinguish player divergence from a non-player
   conformance discrepancy?
7. Does Run State only diagnose at an existing checkpoint, without driving the
   cursor, recomputing requirements, or repairing state?
8. Did active code avoid importing or forwarding through the archive?
9. Did the gate delete superseded active prototype paths rather than leave a
   parallel runtime?
10. Are later-biome abstractions absent unless the current F/G slice needs them?
11. Do producer and consumer tests use the same readable wire fixture?

## Explicit non-goals and anti-overengineering constraints

- No H, I, N, O, P, Q, Dream Dive, Hub, Fields, or Ship-wheel execution.
- No mid-run attach, resume, reload, or plan search.
- No runtime eligibility, topology, reward, trait, or lifecycle simulator.
- No Run State recomputation, requirement evaluation, cursor search, or state
  repair in the game module.
- No automatic player input, route bot, or post-hoc state repair.
- No generic `forceable` flag, adapter registry, callback name, expression,
  command language, or property bag.
- No combined editable-project/execution bundle.
- No execution-plan migration chain during the beta protocol phase.
- No arbitrary frontend filesystem access or module-side plan directory.
- No binary, compressed, checksummed, or clipboard transport without measured
  evidence.
- No automatic mismatch import or planner-side live session control.
- No enemy-wave composition, exact RNG seed replay, damage/health/gold
  simulation, or save-profile progression modeling.
- No cleanup of unrelated app or module code while delivering a gate.

The acceptance target is not the largest reusable protocol. It is the smallest
closed protocol that faithfully executes the current planner's complete-valid
F/G products and produces actionable evidence at the first point where the game
disagrees.
