# Maintainability Decomposition Plan 2

## Status

Locked for execution at clean base `714874b5` on 2026-08-25 and amended before
closure from the clean `1ac93fe1` frontier. This is the temporary execution
contract for the second bounded maintainability phase. It must not be linked
from `README.md` or stable design, biome, or audit authorities. After its
closure gate, durable outcomes belong in the smallest owning design or
progress document and this file is deleted.

This plan follows the post-Plan-1 responsibility and chronology audit required
by the durable maintenance frontier. The audit covered all three ownership
lanes, but it did not find equal implementation work in all three. The included
changes are catalog compiler and planner-engine decompositions. The planner
application remains an unchanged downstream consumer and supplies only
representative contract and product witnesses.

Gates A1 through D are complete at `1ac93fe1`. The pre-closure reinventory then
rejected the earlier assumption that singular chronology requires one singular
reward-evaluation function. Gate C correctly kept Ship lifecycle preparation in
chronology, but the remaining `rewards/biome.ts` still combines the chronology
spine with several independently nameable event-family computations. Pass E
decomposes those computations without distributing event order or mutable
branch authority; durable absorption moves to Pass F.

## Objective

Reduce the remaining change neighborhoods whose live code mixes complete
compiler, materialization, evaluation, or publication products, without
distributing chronological state or mechanically splitting coherent
vocabulary, dispatch, or declaration files.

At closure:

- room and layout declaration-language compilation have named local and
  relational closure owners;
- complete batch materialization is separate from progressive biome traversal;
- reward evaluation has one visible chronological spine whose private event
  families receive explicit current facts and return complete transition
  products;
- project evaluation vocabulary, exact assembly, biome evaluation, and route
  orchestration have explicit owners;
- the ordered reward chronology, history fold, lifecycle executor, topology
  dispatcher, and per-template room materializer retain their atomic
  invariants;
- public catalog, engine, planner, authored-schema, candidate, finding, and
  persistence contracts are unchanged;
- the old inline implementations are deleted in the same gates as their
  replacements; and
- tests follow their primary production owners while broad suites retain only
  representative contact and workflow witnesses.

Line count and file count remain diagnostic evidence, not acceptance targets.
An accepted gate must produce a smaller explicit change neighborhood without a
parallel path, ambient mutable context, compatibility facade, or unexplained
production growth.

## Governing Authorities

The implementation is behavior-preserving against:

- [`ARCHITECTURE.md`](../design/ARCHITECTURE.md) for package direction,
  explicit construction, complete returned products, supported surfaces, and
  reorganization discipline;
- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md) for raw-to-normalized catalog
  compilation, declaration ownership, and compiler closure;
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md) for schema
  59, semantic addresses and commands, retained invalid state, and occurrence
  identity;
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md) for
  materialization, ordered state-flow ownership, progressive evaluation,
  candidate artifacts, findings, and test ownership;
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)
  for the planner's authored-first semantic-assembly, presentation, and
  interaction-binding production line; and
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md) for React's presentation and
  command boundary.

The maintenance frontier in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md#maintenance-frontier-after-plan-1)
records why these source families required a fresh audit. This temporary plan
owns the resulting delivery gates and mechanics only.

## Post-Plan-1 Audit

Initial counts are from `714874b5`; the reward-evaluator row is refreshed from
the post-Gate-C `3f91c095` tree because that live remainder caused the
pre-closure amendment. Counts are diagnostics, not quotas.

### Hades II catalog

| Owner                       | Production lines | Current responsibility                                                                                                              | Disposition                                                           |
| --------------------------- | ---------------: | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `compiler/rooms.ts`         |            1,326 | Raw room normalization, template contracts, encounter/exit validation, internal room references, and contextual requirement closure | Split local construction, template validation, and collection closure |
| `compiler/layouts.ts`       |            1,276 | Layout normalization plus Preboss, compatibility, derived-room, and reward-lookup closure                                           | Split local layout compilation from joint room-layout closure         |
| room and trait declarations | large data files | Readable source-backed game facts                                                                                                   | Keep intact                                                           |
| `compiler/encounters.ts`    |              630 | Closed envelope, definition, and set normalization                                                                                  | Keep intact; size alone does not justify another compiler surface     |

`createCatalog` already exposes the correct stage order: normalize rooms,
normalize layouts, and then close relationships across their complete
collections. The problem is not that the assembly order is missing; it is that
the local and relational policies are still embedded in two broad compiler
files and their primary tests are distributed across encounter, unified-biome,
route-detour, and regression suites.

### Planner engine

| Owner                                   | Production lines | Audit result                                                                                                          | Disposition                                                                        |
| --------------------------------------- | ---------------: | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `simulation/materialization/biome.ts`   |            1,218 | Complete target/batch construction and progressive traversal are distinct products                                    | Split batch materialization from biome traversal                                   |
| `simulation/project.ts`                 |            1,506 | Evaluation vocabulary, exact assembly identity, biome evaluation, and route orchestration are distinct products       | Split in one complete vertical gate                                                |
| `simulation/rewards/biome.ts`           |            6,914 | One 5,647-line evaluation function owns the event loop, event-family computation, mutable collectors, and publication | Preserve one visible loop; extract complete private event products and publication |
| `simulation/materialization/rooms.ts`   |              970 | Closed per-template room materialization and exhaustive dispatch                                                      | Keep intact                                                                        |
| `simulation/lifecycle/execute.ts`       |              903 | Input attestation, action scheduling, and effect dispatch jointly execute one ordered room lifecycle                  | Keep intact                                                                        |
| `simulation/history/fold.ts`            |              907 | One chronological fold owns ledgers, paired-event closure, and frozen views                                           | Keep intact                                                                        |
| `authored-project/commands/topology.ts` |            1,541 | Atomic topology transitions and their shared invariants                                                               | Keep intact                                                                        |

Gate C removed reward-store support and selected trait/level publication, but
the resulting file is still not merely a chronology. Its single evaluator
contains thirteen history-event cases; `roomCreated`,
`offerPointMaterialized`, the combined encounter-settlement case, and
`acquisitionPointReached` each contain roughly six hundred to eight hundred
lines of policy integration. The function also closes over branch state,
pending Hub state, producer and lifecycle frontiers, finding regions, room-
feature assessments, Run State checkpoints, and candidate-context maps.

The corrected boundary preserves one owner of `history.events` order while
making each event family a pure private consumer of the exact current facts it
needs. An event family returns its whole transition and emitted artifacts; it
does not mutate chronology-owned maps, register callbacks, inspect later
events, or publish a partial simulation. The chronology coordinator applies
those products in order and final publication freezes the one complete
assembly. Ship lifecycle preparation moves only with the offer chronology that
supplies its exact first-wheel branch frontier; it does not become a detached
candidate service.

### Planner application and React

| Owner                                            | Production lines | Audit result                                                     | Disposition |
| ------------------------------------------------ | ---------------: | ---------------------------------------------------------------- | ----------- |
| `structured-workspace/contract.ts`               |            2,544 | Explicit application vocabulary                                  | Keep intact |
| `assembly/decision-assembly.ts`                  |            1,108 | One complete batch-decision assembly                             | Keep intact |
| `assembly/occurrence-reward-assembly.ts`         |            1,097 | One occurrence reward/control product                            | Keep intact |
| `source-index.ts`                                |              888 | One exact authored/evaluated source index                        | Keep intact |
| `interactions/occurrence-interaction-binding.ts` |              886 | Exhaustive occurrence-local interaction binder created by Plan 1 | Keep intact |

Plan 1 already separated the application's candidate, interaction,
presentation, occurrence, Hub, and shell families. A second split of the files
above would primarily introduce forwarding modules, distribute exhaustive
dispatch, or divide one supported vocabulary by arbitrary size. Plan 2 makes
no planner production change. Planner contract, projection, and product tests
remain downstream witnesses for unchanged engine products.

## Locked Refactoring Rules

### Behavior and public contracts stay fixed

Every implementation gate is internal movement. There is no authored schema
bump, catalog version bump, semantic-command change, simulation behavior
change, candidate result change, finding change, persistence change, editor
redesign, or new runtime policy.

A discovered behavior defect stops the gate for disposition. It is not quietly
repaired inside a movement commit. A local assertion may be relocated with its
owner, but a new assertion is accepted only when it already follows from the
supported contract and has a focused regression.

The existing package entries remain the supported contacts. Compiler-private
and simulation-private modules do not become new package exports merely because
they acquire their own files.

### Every extraction returns a complete product

An extracted owner receives the narrow explicit inputs it needs and returns the
whole immutable product its consumer uses. No gate may introduce a catch-all
context, mutable service table, dependency bag, hidden registration channel,
result-keyed semantic sidecar, or module-initialization dependency.

A supported entry or chronological orchestrator may remain as a small composer.
It must not retain copied implementation, forward every private symbol for
compatibility, or become an ambient registry.

### Chronological state remains singular

The reward chronology coordinator remains the only owner that iterates
`history.events`, selects the next event family, advances the current branch
cohort, carries pending Hub state, and decides when emitted products enter the
assembly. No handler may inspect the full event sequence, invoke another event
out of order, or publish a simulation independently.

Chronology-owned input preparation may traverse `history.events` once to build
an immutable reference index for later lifecycle points keyed by their exact
room, producer, wheel, or acquisition owner. That index exposes only the
referenced events and views required by a reached transition; it is not a
second fold and cannot answer semantic questions about event order. Event
families receive those narrow references instead of the full history sequence.

Private event owners may receive the exact current branch/frontier facts needed
for one event and return the complete next state and emitted findings,
frontiers, assessments, or candidate contexts for that event. The coordinator
applies those products explicitly. Handlers do not mutate coordinator-owned
maps, communicate through registration, or share a catch-all evaluator
context. Parameter objects are accepted only when they are genuine immutable
input or event-result products, not dependency bags introduced to shorten a
call.

The history fold, lifecycle executor, and topology command dispatcher remain
the sole owners of their own ordered transitions. Plan 2 does not create a
second history interpretation, a lifecycle effect service, topology handlers
with shared mutable state, or a generic simulation context.

### Test ownership follows production ownership

Tests move or divide only when a production extraction creates a real primary
owner. Shared fixtures may construct inputs and observe outputs but must not
reproduce compiler, materialization, chronology, candidate, or finding policy.

Broad catalog, engine, planner-contract, and product-loop suites retain
representative boundary witnesses rather than copies of extracted matrices.
Any moved heavy test is reflected atomically in `vitest.test-lanes.ts`, keeping
regular, heavy, and performance lanes disjoint and exact.

Only one Vitest process may run at a time. Executors use focused owning suites
during a gate. Complete package lanes run at pass boundaries, and the complete
repository gate runs once at closure.

### Commits are independently coherent

Each implementation gate is one Conventional Commit and removes its superseded
inline path. There are no interface-only, state-wrapper-only, compatibility,
forwarding, or later-gate repair commits.

If live implementation reveals that a proposed extraction cannot return its
complete product without a broad context or duplicated policy, the executor
stops. The main session either narrows the gate or records the skipped seam at
closure; it does not force the split to satisfy a file-count expectation.

## Included Scope and Gate Order

### Pass A — Catalog declaration-language compilers

#### Gate A1 — Room declaration compiler ownership

**Owner and product.** Keep `compiler/rooms.ts` as the compiler-private contact
that returns one immutable `CatalogCollection<RoomDeclaration>`. Extract the
three responsibilities already visible in its current data flow:

- normalized construction of common room fields, exits, structural tags,
  reward/store facts, local children, required objects, and additional exits;
- validation of declaration-template contracts for Chaos, Contract, Anomaly,
  Fields, Ship, Ephyra, and other closed authored/derived/automatic modes; and
- collection closure for contextual requirements, force requirements, fixed
  child-room references, and other relationships that require the completed
  room collection.

Template validation consumes one normalized room and only the catalog
collections required by that template. Collection closure consumes the frozen
room collection. Neither stage discovers declarations through registration or
owns layout policy.

**Consumers.** `compiler/createCatalog.ts` continues to call the same room
compiler stage before layout normalization. Lifecycle binding validation and
layout compilation continue to consume the returned room collection.

**Tests.** Establish primary compiler suites for common room normalization,
template contracts, and room-collection closure by moving the corresponding
matrices from the current distributed catalog suites. Keep the complete
encounter-slot matrix in `test/catalog/encounters.test.ts`, route-specific
declaration truth in `route-detours.test.ts`, and representative unified-catalog
contact in `unified-biome-decisions.test.ts`. Do not copy those matrices into
new suites.

Run the focused room compiler suites. The complete catalog lane waits until
Gate A2.

**Deletion.** Remove extracted template and collection validators from the body
of `normalizeRooms`. `rooms.ts` may retain orchestration and genuinely common
leaf construction, but not a second implementation or private forwarding
surface.

**Commit.** `refactor(catalog): decompose room compiler ownership`

#### Gate A2 — Layout compiler and room-layout closure

**Owner and product.** Keep `normalizeBiomeLayouts` as the compiler-private
producer of the immutable layout collection. Separate:

- local start, progression, batch, Hub, completion, store, and compatibility
  declaration normalization; and
- joint room-layout closure for Preboss policies, derived-room ownership,
  reward-lookup ownership, and relationships that require both complete
  collections.

The existing `validatePrebossBatchPolicies`, `validateDerivedRoomOwnership`,
and `validateRewardLookupOwnership` policies move together under the joint
closure owner. Local layout normalization must not import raw room declaration
modules or reconstruct room-template policy.

**Consumers.** `compiler/createCatalog.ts` still assembles rooms before layouts
and performs joint closure only after both collections exist. No normalized
catalog shape or package export changes.

**Tests.** Give local layout declaration normalization and joint room-layout
closure separate primary suites. Move the relevant Preboss, Hub, start,
progression, compatibility, derived-room, and reward-lookup cases from
`unified-biome-decisions.test.ts`, `route-detours.test.ts`, and
`regression-coverage.test.ts` only when their production authority moves.
Retain one complete catalog-assembly witness and keep source-backed declaration
matrices with their existing owners.

Run the focused suites and `npm run test:catalog`. Only one test process runs at
a time.

**Deletion.** Remove the joint closure implementations from `layouts.ts` and
remove superseded cases from broad suites rather than duplicating them. Do not
introduce a second catalog construction entry or a generic validation toolkit.

**Commit.** `refactor(catalog): isolate room layout closure`

### Pass B — Engine materialization

#### Gate B — Complete batch materialization

**Owner and product.** Extract one complete batch materialization owner from
`simulation/materialization/biome.ts`. It owns:

- physical target ordering and retained-unavailable exit handling;
- shared and individual reward-store resolution;
- standard, Fields, and Clockwork batch state;
- authored target and additional-continuation materialization;
- the immutable `CanonicalBatch` plus the next Clockwork state; and
- selected normal-versus-additional continuation resolution.

The product receives catalog, biome/layout/topology, occurrence, decision,
parent, prior Clockwork state, and loadout inputs explicitly. Its private
builder state does not escape the call.

`materialization/biome.ts` retains start materialization, progressive traversal,
Hub progression, prefix and frontier construction, selected-path advancement,
automatic Boss/Postboss completion, and final biome assembly.
`materialization/rooms.ts` remains the per-room-template materializer and is not
split in this gate.

**Consumers.** Progressive materialization, history composition, resource
authoring, reward authoring domains, and project evaluation continue to consume
the same canonical materialization products through the existing simulation
surface. Private imports may move directly to the new owner where that is the
true authority; no compatibility barrel is added.

**Tests.** Establish a focused batch-materialization suite for ordering, store
resolution, Fields/Clockwork state, additional continuations, and selected
continuation. Move the owning cases from biome F/H/I/N materialization,
first-target takeover, and route-detour suites. Those biome suites retain
representative complete-prefix and complete-biome witnesses.

Run the focused materialization suites. The complete engine lane waits until
the end of Pass D.

**Deletion.** Remove target, batch-state, additional-continuation, and selected-
continuation implementations from `materialization/biome.ts`. Do not leave a
forwarding copy or route progressive traversal through a mutable materializer
service.

**Commit.** `refactor(engine): separate biome batch materialization`

### Pass C — Engine reward products

#### Gate C — Nonchronological reward evaluation products

**Owner and product.** Preserve `evaluateBiomeRewardsAssemblyInternal` as the
single ordered reward evaluator. Extract only the complete products around it:

- reward-store candidate support, including exact store history and layout
  policy projection;
- selected trait offers, selected level resolutions, runtime fallbacks, and
  their candidate contexts.

Each extracted module owns its private input indexes and result vocabulary when
those exist solely for that product. The evaluator imports the frozen result;
it does not pass branches, findings, pending Hub state, checkpoint builders, or
mutable candidate maps through an extraction.

**Explicit retained authority.** Event-order dispatch, branch advancement,
incoming and local acquisition settlement, producer frontiers, generated
pickups, room-feature assessments, Run State capture, finding accumulation,
pending Hub-board resolution, Ship lifecycle candidate evaluation, and final
assembly remain together in `rewards/biome.ts`.

**Consumers.** Reward-store candidate queries and downstream project candidate
artifacts continue to expose the same supported results. Selected trait products
remain evaluator-private except where an existing supported simulation export
already exists.

**Tests.** Give store support and selected trait/level publication their own
primary suites by moving the exact cases from batch reward-store,
progressive-selected-product, trait-offer, and level-resolution suites. Keep
Ship lifecycle candidate coverage and chronological settlement matrices with
their existing reward and trait authorities, and retain representative
full-evaluator witnesses.

Run those focused suites. Do not run another Vitest process concurrently.

**Deletion.** Remove the extracted implementations and private types from
`rewards/biome.ts`. The gate is rejected if it introduces an evaluator context,
per-event handler registry, duplicated publication path, or additional reward
simulation entry.

**Commit.** `refactor(engine): isolate reward evaluation products`

### Pass D — Engine project evaluation composition

#### Gate D — Evaluation products, exact assembly, and orchestration

**Owner and product.** Decompose `simulation/project.ts` in one vertical gate:

- an evaluation-product owner defines biome coverage, route summaries,
  project summaries, `ProjectBiomeEvaluation`, `ProjectEvaluation`, and related
  immutable result vocabulary;
- an exact-assembly owner keeps the private construction token, source-project
  identity attestation, candidate artifacts, and narrow artifact/accessor
  queries together;
- a biome-evaluation owner performs materialization, history, reward,
  progressive, replay, and coverage composition for one biome; and
- the project orchestrator validates catalog/project identity, evaluates each
  route in order, carries valid predecessor history, retains invalid authored
  frontiers, and publishes the final route and project summaries.

This is one implementation commit so no context-only or interface-only boundary
lands. The exact assembly remains an explicit complete product. Its WeakMap and
construction token stay private to that owner and are not replaced with public
fields or a result-keyed semantic sidecar.

**Consumers.** Candidate modules import evaluation vocabulary from its owner
rather than the route orchestrator. Exact assembly consumers use the assembly
owner. `simulation/index.ts` preserves the existing supported package surface,
and the planner continues to receive the same evaluation and candidate
capabilities.

**Tests.** Keep `test/simulation/project.test.ts` as the primary route/project
orchestration suite. Move exact identity and assembly contract cases from
candidate-session and progressive suites to the exact-assembly owner where
appropriate, while those feature suites retain representative query witnesses.
Biome replay, incomplete-prefix, retained-invalid, and coverage cases follow
the biome-evaluation owner. Do not duplicate the full F-through-Q route matrix.

Run the focused project, assembly, progressive, and candidate-session suites,
then run `npm run test:engine` to close the engine pass.

**Deletion.** Remove evaluation vocabulary, exact assembly storage/accessors,
and biome-evaluation implementation from `project.ts`. The remaining project
module must own route/project orchestration rather than forward every private
symbol.

**Commit.** `refactor(engine): decompose project evaluation composition`

### Pass E — Engine reward chronology

#### Gate E1 — Prepared evaluation inputs and lifecycle transitions

**Owner and product.** Establish the private reward-evaluation neighborhood by
extracting one immutable prepared-input product from catalog, materialized
snapshot, history, route loadout, and resource placements. It owns the current
layout, reward and room lookups, history views, target and continuation indexes,
Hub indexes, batch-parent indexes, and one chronology-owned lifecycle-reference
index for producer points and acquisition/wheel events keyed by exact semantic
owner. The reference index is constructed once from `history.events`; no later
event family receives or searches the full sequence.

Move the non-acquisition lifecycle transitions that consume those facts:

- the non-Gorgon portion of `encounterStarted`;
- `roomEntered`;
- `roomPrepared` and `keepsakeRackUsed`;
- `encounterEndEffectsApplied`; and
- `roomExited`.

Each transition receives its exact event, current branches and peers, and the
prepared facts it needs. It returns the next branches plus its complete emitted
frontiers, checkpoints, findings, or candidate contexts. It does not mutate
chronology-owned maps. The history loop remains in `rewards/biome.ts` during
this gate and applies each returned product at the original sequence point.
The combined `bossDefeated` / `encounterInteractionReached` /
`encounterCompleted` settlement remains for Gate E4. Gorgon start eligibility,
candidate publication, pending/expired state, and later interaction settlement
also remain together for Gate E4 rather than crossing this lifecycle boundary.

**Tests.** Keep lifecycle policy with its current Chaos, Fig Leaf, Experimental
Hammer, keepsake, and Run State authorities. Move only direct transition-
product assertions that acquire a new primary owner; retain representative
full-biome chronology witnesses. Run the focused lifecycle, Chaos, Fig Leaf,
Experimental Hammer, keepsake-selection, and Run State suites serially.

**Deletion.** Remove the prepared lookup implementation and moved lifecycle
case bodies from `rewards/biome.ts`. The gate is rejected if it adds a generic
event result, handler registry, evaluator service bag, or mutable shared draft.

**Commit.** `refactor(engine): separate reward lifecycle transitions`

#### Gate E2 — Room and outgoing generation transitions

**Owner and product.** Extract the complete generation transitions for:

- `roomCreated`, including incoming and local reward generation, unresolved-
  reward generation, the exact branch cohorts and producer-frontier
  capabilities emitted from that creation point, room-feature inventory and
  assessment preparation, reward-wheel preparation, Shops, Shrines, Wells,
  Pools, generated acquisition sites, postboss Keepsake-selection candidate
  publication, and Hub-target Run State handoff checkpoints;
- `targetGenerationCompleted`;
- `outgoingGenerationCheckpoint`; and
- pending Hub-board generation and flush.

`roomCreated` is the chronological generation point for incoming and local
rewards. Its calls to offer processing and its focused candidate evaluators
therefore remain with this transition; they are not split out merely because
they evaluate an offer. A returned producer-frontier evaluator is an explicit
immutable capability in the generation product and may close over that exact
creation cohort. This does not authorize injected callbacks that mutate the
coordinator's branches, peers, findings, maps, pending Hub state, or checkpoint
builders.

The outgoing-generation owner may extract the authored-acquisition-site
settlement adapter that `outgoingGenerationCheckpoint` first consumes. That
lower-level adapter must return one complete site-settlement product: next
branches and peers together with its exact producer, conversion, derived-entry,
trait-child, fallback, finding, and checkpoint emissions. It must not receive
the chronology's maps or callbacks. Later acquisition transitions reuse that
product rather than wrapping or reimplementing it.

The chronology coordinator remains the sole owner of when a generated result
is applied, when a Hub board is pending or flushed, and when target history is
published. Extracted generation code cannot walk history or generate a later
event eagerly. Room creation receives producer/acquisition lifecycle references
from the prepared exact-owner index established in E1.

**Tests.** Use the existing F/H/N/O generation and rewards suites as primary
policy owners, with focused Shop inventory, Hermes Shrine, Stygian Well,
Purging Pool, Fields optional, postboss Keepsake selection, Hub generation, and
Hub Run State witnesses. Move direct product cases only where the new
generation owner is the authority. Run those suites serially; do not run the
complete engine lane yet.

**Deletion.** Remove the moved generation cases, room-feature recorders,
pending-Hub implementation, and superseded site-settlement adapter from
`rewards/biome.ts`. There is one generated-result path and one site-settlement
path after the gate.

**Commit.** `refactor(engine): separate reward generation transitions`

#### Gate E3 — Reached offer-lifecycle transitions

**Owner and product.** Extract `offerPointMaterialized`,
`offerPointAcquired`, and `producerRoleAdvanced` as the reached offer-lifecycle
owner. It owns the exact branch cohort at those later lifecycle events, trait
and level settlement integration, producer-role advancement, and the
candidate/frontier products emitted at those event points. Incoming and local
reward generation remains wholly owned by Gate E2's `roomCreated` transition;
this gate neither wraps nor reprocesses it.

Ship lifecycle candidate preparation moves with this owner because its
deferred evaluation captures the exact first-wheel branches. The offer owner
receives that cohort explicitly and returns its complete Ship candidate
product; it does not become a detached service and cannot evaluate before the
chronology reaches the wheel. Wheel preparation receives the exact selected or
dormant generation/acquisition reference from the E1 lifecycle index rather
than `BiomeRewardHistory` or `history.events`. Existing trait, shop, and
acquisition-settlement authorities remain lower-level pure dependencies rather
than being copied.

**Tests.** Keep complete trait, Pom, Circe, Echo, Shop-purchase, Ship-wheel, and
progressive candidate matrices with their current authorities. Give direct
offer-transition publication its own focused primary cases only where broad
tests currently assert the extracted product itself. Run those focused suites
serially.

**Deletion.** Remove the three offer case bodies, Ship preparation body, and
superseded incoming-offer adapter from `rewards/biome.ts`. The gate is rejected
if offer processing gains a second event loop, branch cache, or publication
entry.

**Commit.** `refactor(engine): separate reward offer transitions`

#### Gate E4 — Encounter and acquisition transitions

**Owner and product.** Extract the remaining settlement-heavy transitions:

- the combined `bossDefeated`, `encounterInteractionReached`, and
  `encounterCompleted` case;
- Gorgon start eligibility and candidate publication from `encounterStarted`,
  together with its later interaction settlement;
- `acquisitionPointReached`; and
- `wellPurchase`.

This owner coordinates the already-supported lower-level acquisition, trait,
Shop, generated-pickup, Nemesis, Narcissus, Echo, Sea Star, Time Piece,
Artificer, room-feature, and keepsake effects at their reached event. Each
transition returns its complete next branch cohort and exact emissions. It
does not absorb the lower-level feature policies, mutate chronology collectors,
or infer whether another event will occur.

**Tests.** Use the existing encounter-trait, NPC pickup, Nemesis event,
Artificer, Time Piece, Sea Star, Echo, Pool, Shrine, Well, and Shop settlement
suites as the primary matrices. Retain representative complete-route witnesses
and avoid a second generic acquisition matrix. Run the affected suites
serially.

**Deletion.** Remove the moved encounter/acquisition case bodies and any
superseded local adapters from `rewards/biome.ts`. There is no compatibility
dispatcher and no duplicated feature settlement path.

**Commit.** `refactor(engine): separate reward acquisition transitions`

#### Gate E5 — Chronology spine and final publication

**Owner and product.** Move the one exhaustive `history.events` loop into the
private reward-evaluation chronology owner. It alone:

- selects the event-family transition in source order;
- carries current branches, peers, and pending Hub state;
- applies returned findings, frontiers, assessments, checkpoints, and
  candidate contexts to its private collectors; and
- invokes one final publication owner that freezes the complete
  `BiomeRewardEvaluationAssembly`.

The switch remains explicit and exhaustive; it is not replaced with a handler
registry. Event-family modules cannot import the chronology owner or call one
another through it. Final publication may receive one named immutable
publication-input product because it represents the complete accumulated
result, but it cannot own transition policy or recover missing facts through a
side channel.

`rewards/biome.ts` becomes the thin supported adapter for
`evaluateBiomeRewards`, `evaluateBiomeRewardsAssembly`, the internal project-
evaluation contact, and existing supported error/result vocabulary. It does
not re-export private event modules or forward their symbols.

**Tests.** Keep one exact event-order and one complete reward-assembly witness
with the chronology owner. Existing feature suites remain their policy owners.
Run the focused chronology/publication tests, engine typecheck, and then
`npm run test:engine` once to close the amended engine pass. Vitest remains
serialized.

**Deletion.** Remove the remaining loop, mutable collectors, transition
application, and final-publication implementation from `rewards/biome.ts`.
The gate is rejected if the facade retains a shadow path, if any event family
walks `history.events`, or if the new folder adds a second simulation entry.

**Commit.** `refactor(engine): isolate reward chronology assembly`

### Pass F — Closure

#### Gate F — Durable absorption and repository validation

**Review.** Reinventory the three packages from the final implementation tree
and compare them with the `714874b5` baseline. Confirm:

- each new module has one named owner, explicit inputs, a complete product,
  direct consumers, and primary tests;
- superseded inline code and duplicate tests are deleted;
- the catalog construction and engine simulation surfaces are unchanged;
- no planner production policy moved or was reproduced;
- the reward chronology, history fold, lifecycle executor, topology dispatcher,
  and room-template materializer still own their ordered or exhaustive
  invariants; and
- production growth is explained by ownership boundaries rather than wrappers,
  manifests, shadow models, or compatibility paths.

**Validation.** Run planner contract/product witnesses required by changed
engine contacts, then run one complete `npm run check`. Vitest processes remain
serialized. Record the exact truthful result in the durable progress history;
do not imply live game or release validation.

**Documentation.** Absorb only durable ownership conclusions into
`ARCHITECTURE.md`, `CATALOG_MODEL.md`, `SIMULATION_AND_VALIDATION.md`, the
maintenance frontier, and `IMPLEMENTATION_PROGRESS.md` where they materially
clarify the final code. Do not absorb gate sequencing or module trivia. Delete
this temporary plan in the same closure change.

**Commit.** `chore(maintenance): close decomposition plan two`

## Execution Topology and Review

The completed catalog chain was ordered `A1 -> A2`; the completed initial
engine chain was ordered `B -> C -> D`. The amended reward chain is strictly
ordered `E1 -> E2 -> E3 -> E4 -> E5` because each later transition family
consumes the final private products of its predecessors. Gate F starts only
after E5 is integrated and the amended engine pass is green.

Tests are never parallelized across gates. A single lane owner runs Vitest at a
time so resource starvation cannot create false timeouts.

Each gate follows the repository's multi-agent delivery routine:

1. the main session records the exact base, authorities, deliverables,
   exclusions, tests, and expected deletion;
2. a fresh executor owns the complete gate and performs only in-scope movement;
3. a fresh sibling reviewer receives the base commit, exact diff, this locked
   gate, named authorities, validation results, and exclusions;
4. accepted findings return to the executor or a narrow remediation worker;
5. the main session performs the bird's-eye ownership and diff review; and
6. the gate is committed only after that review and explicit user authority.

No executor or reviewer carries authority from a previous gate. A live-code
contradiction or missing product decision is returned to the main session
rather than silently broadening the change.

## Explicit Exclusions

Plan 2 does not authorize:

- behavior fixes discovered during movement;
- authored schema, catalog version, persistence, command, candidate, finding,
  or UI contract changes;
- new public catalog or engine exports except relocation behind the unchanged
  supported package surface;
- changes to room, encounter, reward, trait, or layout game facts;
- splitting readable declaration data;
- a generic compiler framework, validation toolkit, simulator context,
  dependency container, service registry, or helper directory;
- a reward-handler registry, event owner that walks `history.events`, generic
  evaluator context, shared mutable event draft, or second history
  interpretation;
- decomposition of `materialization/rooms.ts`, `lifecycle/execute.ts`,
  `history/fold.ts`, or the topology command dispatcher;
- planner application or React production refactoring;
- broad test rewrites unrelated to moved primary ownership;
- performance optimization, worker offload, protocol/game-module work, or
  release hardening; or
- concurrent Vitest execution.

Any of those requires a separately grounded audit and plan after this phase is
closed.
