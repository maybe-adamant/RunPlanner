# Fixed-Route Execution Expansion Plan

## Status and bases

Status: **locked for implementation** after the end-to-end review of
[`BIOME_EXECUTION_NAVIGATION.md`](../design/BIOME_EXECUTION_NAVIGATION.md).

Planning bases:

- Run Planner: `e99a3f63b62438ffa641b8212a45f2c91e9941b8`
- Plan Executor: `54003a6bf074f70518249f58c0dd958c19f08a2e`
- Modpack parent: `170c6d69724749e2b2732db755ab49ab762588bb`

The navigation-authority revision accompanying this plan is part of the locked
documentation boundary. Implementation begins only after that authority and
this plan are committed.

## Objective

Extend the live-proven F/G Plan Executor boundary through the complete
Underworld and Surface fixed routes:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

The user-visible result is that any complete-valid fixed-route plan can be
published at a supported prefix, loaded by the game module, and realized using
the planner's exact rooms, rewards, room structures, encounters, and already
implemented timeline effects. The executor remains a thin native adapter. It
does not become a second simulator or reimplement the legality rules that made
the plan valid.

## Authorities

The implementation is governed by:

- [`BIOME_EXECUTION_NAVIGATION.md`](../design/BIOME_EXECUTION_NAVIGATION.md) for
  the baseline and each earned biome delta;
- [`GAME_INTEGRATION_BOUNDARY.md`](../design/GAME_INTEGRATION_BOUNDARY.md) for
  compiler, route-session, room-session, mismatch, and native-contact ownership;
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md) for room and
  phase chronology;
- [`H_GAME_RULES.md`](../biomes/H_GAME_RULES.md),
  [`I_GAME_RULES.md`](../biomes/I_GAME_RULES.md),
  [`N_GAME_RULES.md`](../biomes/N_GAME_RULES.md),
  [`O_GAME_RULES.md`](../biomes/O_GAME_RULES.md),
  [`P_GAME_RULES.md`](../biomes/P_GAME_RULES.md), and
  [`Q_GAME_RULES.md`](../biomes/Q_GAME_RULES.md) for planner legality and source
  facts; and
- the focused Fields spatial, encounter composition, and room-action-order
  audits under [`docs/audits/`](../audits/) for native contact evidence.

If live behavior contradicts one of those authorities, the gate stops for
adjudication. The executor must not hide the contradiction behind a room-name
special case.

## Current implementation inventory

Run Planner protocol 28 currently publishes only exact `F` and `F/G`
Underworld prefixes. Its execution model, assembler, strict codec, fixtures,
and application publication path reject every other extent. The Plan Executor
mirrors that restriction in its strict decoder and occurrence validation.

The reusable runtime layers are already implemented:

- one route cursor and one room-session coordinator;
- ordinary room, incoming-reward, normal-door, additional-exit, fixed-link,
  and Anomaly realization;
- room features, resources, inventories, encounters, acquisitions,
  transformations, NPCs, keepsakes, spells, and room-exit conformance; and
- a semantic-agnostic room timeline dependency product consumed through exact
  native bindings.

The planner already has the required semantic source products:

- `CanonicalAuthoredRoom.localRewards`, `fieldsOptionalRewards`, and
  `fieldsSpatial` for H;
- `CanonicalAuthoredRoom.clockworkReward` for I;
- `CanonicalHubDecision`, its complete board, visits, local slots, restores,
  and handoff for N;
- `CanonicalAuthoredRoom.encounterPhases` and `rewardWheels` for O and P; and
- ordinary canonical occurrences and fixed links for Q.

The execution work therefore adapts these existing products. It does not add
new authored state merely to make the executor convenient.

## Locked cross-cutting decisions

### Planner and compiler authority

- Only a complete-valid planner evaluation may publish.
- The compiler translates canonical products; it does not rerun batch, cap,
  chance, counter, stage, encounter-eligibility, or reward-bag policy.
- A missing exact execution fact is an `executionCoverageMissing` failure. It
  is not reconstructed from a game room name in the compiler or executor.
- No authored schema or catalog-version change is expected. A normalized
  materialization product may be completed when the exact fact already exists
  in catalog plus authored state but has not yet crossed that boundary.

### Route and room ownership

- The route session owns only the selected fresh-occurrence cursor.
- Navigation owns entered room identity, incoming reward, physical exits, exit
  targets and their visible rewards.
- H cage payloads extend their physical target; they are not fake exits.
- N Hub and parent restores are native reference transitions. They never become
  selected occurrences or execution transactions and never replay a room
  session.
- Room structures and spatial placement stay under room features. Encounters
  and wheel choice/acquisition stay under the room timeline.

### Native lifecycle and player action

- The game retains object creation, encounter starts/completions, pickups,
  purchases, delivery clocks, counters, persistent-room restoration, and
  between-phase barriers unless this plan names a bounded steering contact.
- The executor may force available choices and bind an observed callback to its
  published transaction. It never clicks for the player, rejects player input,
  or returns early merely because the player diverged.
- First mismatch disables further steering and leaves normal game behavior
  active. Diagnostics record the mismatch; they are not another simulation.

### Strict protocol evolution

- Gate B reserves strict protocol 33 once in both repositories for the full
  internal fixed-route delivery series. Intermediate commits are
  non-releaseable; later gates extend wire products without another version
  bump or rewriting existing fixtures. Existing fixtures refresh once in Gate
  B; later gates add only their new fixture.
- The TypeScript codec and Lua decoder remain closed mirrors. There is no
  compatibility decoder or fallback interpretation for older protocol plans.
- Checked-in execution fixtures are generated by the planner compiler and
  copied byte-for-byte to the Plan Executor fixture directory.
- Each gate closes as coordinated planner, Plan Executor, and—when needed for
  deployment—modpack-parent commits. Separate repositories do not justify a
  half-supported release boundary.

## Gate A — Mourning Fields (`F/G/H`)

### Outcome

Protocol 29 accepts the exact `F/G/H` Underworld prefix. H ordinary rooms use
the F/G navigation path, while `H_Combat` realizes its complete grouped cage
door payload and exact room layout.

### Run Planner responsibilities

1. Extend the closed Underworld extent to `['F', 'G', 'H']` without weakening
   route-order validation.
2. Publish every generated `H_Combat` door target's ordered cage rewards as a
   grouped payload on that target. Include unpicked targets because their cage
   previews already exist on the physical doors.
3. Publish the selected Fields room's:
   - exact player entry start/end pair;
   - active cage-slot point assignments, with cage identities remaining
     authoritative on the grouped door payload;
   - complete optional-reward identities and assigned point IDs;
   - Nemesis point when active; and
   - existing ordered Passive/Cage encounter phases.
4. Consume the existing canonical Fields products. If the canonical
   materialized room exposes only the selected entry start point, complete that
   product with its declaration-paired end point at materialization time. Do
   not make the execution compiler consult room names or raw catalog tables.
5. Preserve the selected-occurrence cursor and existing timeline/conformance
   products unchanged.

### Plan Executor responsibilities

1. Extend strict protocol decoding for H and the two exact Fields products.
2. Add a navigation-owned Fields door adapter that installs the grouped
   `CageRewards` payload during ordinary outgoing-door generation.
3. Add a room-feature-owned Fields adapter around native Fields setup and
   `SpawnRewardCages` that steers reward identities and point selection while
   letting the game create every cage and optional object.
4. Reuse the existing indexed `ChooseEncounter` binding for Passive, Cage01,
   Cage02, and active Cage03. Do not introduce an H encounter cursor.
5. Reuse existing acquisitions, Nemesis, resources, Wells, Echo, Artificer,
   and conformance readers without H wrappers.

### Primary acceptance

- Engine assembler/codec tests own the grouped door payload, selected spatial
  product, strict H extent, and protocol round trip.
- The existing `underworld-fgh` checkpoint produces one checked-in execution
  fixture containing unpicked cage previews and a selected exact Fields layout.
- Lua protocol tests decode that fixture and reject malformed/missing Fields
  facts.
- Native-harness tests prove cage preview realization, two- and three-cage
  placement, optional placement, Nemesis placement, and repeated encounter
  binding without manual object construction.
- `H_Combat13` uses the same product and adapter. Any live exception is a
  source-adjudication result, not a preemptive special branch.

### Exclusions

The gate does not publish or execute the Fields min/max roll, cage ceiling,
four-room Preboss counter, or native chance tables.

### Commit boundary

One coordinated `feat(execution): realize mourning fields navigation` gate.

## Gate B — Tartarus and complete Underworld (`F/G/H/I`)

### Outcome

Protocol 33 accepts the full Underworld route. Tartarus uses ordinary
navigation and forces the planner-resolved Clockwork Goal through the existing
reward contact.

### Run Planner responsibilities

1. Reserve protocol 33 and declare both route families, their exact prefixes,
   and the closed occurrence identities `F/G/H/I/N/O/P/Q`; this gate realizes
   only the full Underworld extent `['F', 'G', 'H', 'I']`.
2. Map canonical `clockworkReward: 'goal'` to the ordinary exact execution
   reward identity `ClockworkGoal` on that occurrence.
3. Preserve ordinary non-goal rewards, retained Preboss peers, exact encounter
   choices, Boss fixed links, and terminal no-Postboss topology as already
   materialized.
4. Publish no Goal counter, non-goal cap, Tartarus stage, or Preboss policy.

### Plan Executor responsibilities

1. Reserve protocol 33 and declare both closed route families, their exact
   prefixes, and all `F/G/H/I/N/O/P/Q` occurrence biome identities; this gate
   realizes only I.
2. Reuse ordinary room/reward/door/fixed-link adapters for all I rooms.
3. Let native `SpawnClockworkGoalReward` perform its counter side effect after
   exact reward forcing. Do not replace it with an executor mutation.

### Primary acceptance

- The existing `underworld-fghi` checkpoint produces the full Underworld
  execution fixture.
- Planner tests distinguish forced Goal, ordinary non-goal, retained Preboss
  peer, Boss, and terminal I without adding an I runtime state product.
- Lua decoder/navigation tests prove that `ClockworkGoal` uses the ordinary
  reward seam and that the native goal lifecycle still runs.
- Focused live proof completes an authored F/G/H/I route with exact H Fields
  realization and at least one planned Goal. A mismatch remains non-blocking.

### Commit boundary

One coordinated `feat(execution): complete underworld route` gate.

## Gate C — Ephyra (`N`)

### Outcome

Protocol 33 accepts a Surface `N` prefix and realizes its persistent Hub board,
main-local side slots, and fresh-occurrence cursor without taking ownership of
native restoration.

### Run Planner responsibilities

1. Realize the already-declared Surface `['N']` extent by publishing one Hub
   navigation product from the existing canonical Hub decision. It is owned by
   the PreHub occurrence whose outgoing decision becomes the Hub. It contains:
   - native Hub room identity;
   - every open physical slot, room, and reward, including unvisited slots;
   - the canonical final handoff target; and
   - no restore transactions.
2. Publish each visited main occurrence's complete declared side-slot set in
   its room overview: exact `generated`/`notGenerated` disposition and, for a
   generated slot, its room and reward. Do not duplicate main-visit or entered
   side order in this product.
3. Include every referenced open main and generated side occurrence in the
   execution occurrence table, including generated but unvisited rooms.
4. Keep `selectedOccurrenceIds` as the sole fresh traversal order: the six
   entered main rooms and entered side rooms appear there in chronology. Hub
   and parent restore records remain simulation history only.
5. Keep ordinary overview, timeline, resources, and conformance data owned by
   published occurrence records. Hub and restore records never receive those
   products, and only `selectedOccurrenceIds` determines which occurrences
   become live room sessions.

### Plan Executor responsibilities

1. Decode the closed Hub product and exact N occurrence references.
2. At `ChooseAvailableN_HubDoors`, install the complete authored open board and
   force all room/reward assignments through native persistent doors.
3. At each main-local side-door contact, consume that main occurrence's room
   overview and force every slot's generated state and every generated
   room/reward, including unvisited slots.
4. Treat native entry into `N_Hub` and reload of an already-completed parent as
   transparent to the outer cursor: do not advance it and do not open, close,
   or replay a room session.
5. Match the next fresh main or side entry to the next selected occurrence.
   Continue using ordinary timeline and conformance adapters for that fresh
   room.
6. Let the game own Hub visit counts, parent/Hub restoration, pylons, side-room
   clocks, and completion exposure. When native progression exposes the final
   continuation, ordinary navigation realizes the published Preboss handoff.

### Primary acceptance

- The existing `surface-n` checkpoint produces one strict N execution fixture.
- Engine tests prove that unvisited board rooms and generated-unvisited side
  rooms are published, while restores are absent from the selected cursor and
  timeline.
- Lua native-harness tests cover initial Hub entry, repeated Hub reload, main
  entry, side entry, parent restore, a second side or main entry, and final
  handoff without duplicate room sessions.
- One regression witness covers the existing N Opening Chaos path: the Chaos
  occurrence is fresh, its return into the Hub is transparent, and PreHub is
  not fabricated.
- Focused live proof reaches the N Postboss through authored main and side
  visits with a persistent unchanged board.

### Exclusions

The executor does not generate a visit counter, side-room clock, restoration
action, pylon action, or synthetic Hub occurrence.

### Commit boundary

One coordinated `feat(execution): realize ephyra hub navigation` gate.

## Gate D — Thessaly (`N/O`)

### Outcome

Protocol 33 accepts an `N/O` Surface prefix. O ordinary navigation remains
baseline behavior; each `O_Combat` realizes its exact active encounter count
and complete wheel choices inside one room session.

### Run Planner responsibilities

1. Realize the already-declared Surface `['N', 'O']` extent.
2. Publish an exact ShipCombat room product containing:
   - active ordered Intro, Combat1, and optional Combat2 phases;
   - each active wheel's encounter-phase owner, offer count, shared store,
     and complete simultaneous offer cohort; and
   - exact reward/source payloads for every offered option, not only the pick.
3. Publish active `chooseRewardWheel` as the sole player-observed choice result,
   carrying its wheel and picked-offer identity and bound to its phase.
   Continue publishing the picked wheel reward through the existing
   acquisition transaction; its semantic owner is the selected offer rather
   than a second copied choice field.
4. Preserve the planner dependency graph between wheel choice, combat,
   encounter-owned interactions, selected reward acquisition, and the next
   phase. Do not publish the game's barrier as another transaction.
5. Do not infer or publish an O outgoing-store controller. Exact subsequent
   rooms and rewards are already resolved by the planner.

### Plan Executor responsibilities

1. Decode the closed ShipCombat product and wheel transaction.
2. At `SetupRoomMultipleEncountersData`, steer whether the optional Combat2
   declaration entry is active. Reuse the generic indexed encounter binding for
   the resulting Intro/Combat1/Combat2 identities.
3. At each non-Intro `ShipsEncounterSetup`, force the exact authored offer
   count, shared store, and complete offer cohort.
4. After the player calls `UseShipWheel`, bind the observed choice to the exact
   wheel transaction. Do not replace, disable, or reject the player's input.
5. Let native code record the chosen reward, run combat, spawn the selected
   reward, and enforce `WaitForNextEncounterReady`. The existing acquisition
   and Icarus adapters handle those later objects independently.

### Primary acceptance

- The existing `surface-no` checkpoint produces one strict N/O execution
  fixture.
- Engine tests own two- versus three-phase publication, one- versus two-offer
  cohorts, Run/Meta stores, picked-offer ownership, and wheel/acquisition DAG
  relations.
- Lua native-harness tests cover both phase counts, all offer-count/store
  combinations represented by the fixture, observed correct and divergent
  wheel selections, and Icarus plus wheel-reward ordering.
- A divergent wheel click desynchronizes steering without preventing native
  selection or combat.
- Focused live proof completes at least one two-phase and one three-phase
  ShipCombat room.

### Exclusions

The executor does not rerun the 60% Combat2 chance, depth requirements, reward
bag/store legality, pickup creation, or between-phase readiness loop.

### Commit boundary

One coordinated `feat(execution): realize thessaly ship combat` gate.

## Gate E — Olympus, Summit, and complete Surface (`N/O/P/Q`)

### Outcome

Protocol 33 accepts `N/O/P` and complete `N/O/P/Q` Surface prefixes without a
new route mechanism.

### Run Planner responsibilities

1. Realize the already-declared Surface `['N', 'O', 'P']` and
   `['N', 'O', 'P', 'Q']` extents.
2. Carry P's existing ordered encounter phases and Q's ordinary occurrences,
   rewards, doors, World Shop, fixed Boss link, and terminal topology through
   the existing execution products.
3. Publish no P phase controller, Q stage cursor, candidate-exhaustion state,
   Preboss counter, or fourth-position Postboss.

### Plan Executor responsibilities

1. Accept P and Q occurrence identities in the strict decoder.
2. Reuse the generic multiple-encounter adapter for P PreCombat followed by
   Combat and for native Heracles suffix termination.
3. Reuse ordinary navigation, room features, timelines, and fixed links for Q.
4. Do not infer P phase identity or Q stage from room names.

### Primary acceptance

- Existing `surface-nop` and `surface-nopq` checkpoints produce strict
  execution fixtures.
- P native-harness witnesses cover PreCombat plus Combat and Heracles as the
  complete sequence. Existing Gorgon, Fig Leaf, Icarus, Athena, and acquisition
  adapters remain shared.
- Q protocol/navigation witnesses cover ordinary target widths, World Shop,
  fixed Boss link, and terminal no-Postboss behavior without a Q stage product.
- Full Surface live proof completes an authored N/O/P/Q route, including one N
  side visit and one O three-phase ShipCombat room. A mismatch remains
  non-blocking.

### Commit boundary

One coordinated `feat(execution): complete surface route` gate.

## Gate F — Closure

### Documentation and deletion

1. Update [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) and
   [`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md) with the two
   fixed-route execution milestones and the remaining Dream Dive frontier.
2. Amend stable design or biome authorities only for facts actually corrected
   during implementation or live testing.
3. Remove F/G-only wording, dead extent guards, deferred-route dispositions,
   superseded fixture helpers, and temporary gate comments from production and
   tests.
4. Delete this focused plan after its durable results are absorbed.

### Final validation

Run the complete gates once after all focused checks and review fixes are
stable:

```bash
# Run Planner
npm run check

# Plan Executor submodule
lua tests/all.lua
luacheck src/

# Modpack integration
lua tests/smoke.lua
```

Verify that every checked-in execution fixture is byte-identical between Run
Planner and Plan Executor and that the final parent repository records the
Plan Executor submodule commit used for live proof.

### Commit boundary

One coordinated `docs(execution): close fixed-route expansion` closure after
the full gates and final bird's-eye review pass.

## Review protocol for every implementation gate

Each gate follows the repository's multi-agent delivery routine:

1. record the clean planner, executor, and parent bases;
2. give one fresh executor the complete vertical slice and explicit exclusions;
3. run narrow owning tests while implementing;
4. give a fresh read-only reviewer the base, complete diff, locked gate,
   authorities, and test results;
5. return accepted findings for one bounded remediation pass;
6. perform the main-session cross-repository review for compiler authority,
   strict codec parity, native lifecycle preservation, superseded-path deletion,
   and test ownership; and
7. commit only the coherent gate boundary.

The complete repository gate is reserved for Gate F. A gate may run its focused
engine, application publication, Lua, native-harness, and smoke witnesses
without repeatedly rerunning unrelated suites.

## Explicit non-goals

- Dream Dive route ordering, Dream Postboss selection, or Dream-specific phase
  behavior.
- New planner legality, probability, cap, counter, stage, or reward-bag models.
- Enemy composition, wave authoring, health, gold, damage, or meta-progression
  accounting.
- A generic biome plugin registry, service locator, second route cursor, or
  executor-side simulator.
- UI changes or persisted authored-schema migrations.
- Compatibility decoding of superseded execution protocols.
- Manual recreation of native rooms, cages, wheels, pickups, encounters,
  restores, or readiness loops when a bounded native steering contact exists.
