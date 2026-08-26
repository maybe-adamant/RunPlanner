# Maintainability Decomposition Plan 2

## Status

Locked for execution at clean base `714874b5` on 2026-08-25. This is the
temporary execution contract for the second bounded maintainability phase. It
must not be linked from `README.md` or stable design, biome, or audit
authorities. After its closure gate, durable outcomes belong in the smallest
owning design or progress document and this file is deleted.

This plan follows the post-Plan-1 responsibility and chronology audit required
by the durable maintenance frontier. The audit covered all three ownership
lanes, but it did not find equal implementation work in all three. The included
changes are catalog compiler and planner-engine decompositions. The planner
application remains an unchanged downstream consumer and supplies only
representative contract and product witnesses.

Gate C was narrowed after the live `db98aac4` call-path audit proved that Ship
lifecycle candidate evaluation captures the ordered first-wheel branch frontier.
It therefore remains with the chronological reward evaluator instead of crossing
the extraction boundary described below.

## Objective

Reduce the remaining change neighborhoods whose live code mixes complete
compiler, materialization, evaluation, or publication products, without
distributing chronological state or mechanically splitting coherent
vocabulary, dispatch, or declaration files.

At closure:

- room and layout declaration-language compilation have named local and
  relational closure owners;
- complete batch materialization is separate from progressive biome traversal;
- nonchronological reward projections no longer live inside the ordered reward
  evaluator;
- project evaluation vocabulary, exact assembly, biome evaluation, and route
  orchestration have explicit owners;
- the ordered reward evaluator, history fold, lifecycle executor, topology
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

Counts are from `714874b5`. They are diagnostics, not quotas.

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

| Owner                                   | Production lines | Audit result                                                                                                    | Disposition                                                     |
| --------------------------------------- | ---------------: | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `simulation/materialization/biome.ts`   |            1,218 | Complete target/batch construction and progressive traversal are distinct products                              | Split batch materialization from biome traversal                |
| `simulation/project.ts`                 |            1,506 | Evaluation vocabulary, exact assembly identity, biome evaluation, and route orchestration are distinct products | Split in one complete vertical gate                             |
| `simulation/rewards/biome.ts`           |            7,276 | One ordered evaluator surrounds several complete pure projections                                               | Extract only nonchronological products; preserve the event loop |
| `simulation/materialization/rooms.ts`   |              970 | Closed per-template room materialization and exhaustive dispatch                                                | Keep intact                                                     |
| `simulation/lifecycle/execute.ts`       |              903 | Input attestation, action scheduling, and effect dispatch jointly execute one ordered room lifecycle            | Keep intact                                                     |
| `simulation/history/fold.ts`            |              907 | One chronological fold owns ledgers, paired-event closure, and frozen views                                     | Keep intact                                                     |
| `authored-project/commands/topology.ts` |            1,541 | Atomic topology transitions and their shared invariants                                                         | Keep intact                                                     |

The reward evaluator's main event loop mutates one ordered branch and artifact
assembly. Its local event families do not return independently complete
products. Splitting them would require passing a broad mutable evaluator
context or remerging partial branches, findings, checkpoints, and artifacts.
That is explicitly excluded. The safe seams are reward-store support prepared
from immutable history and layout facts, and selected trait/level publication
frozen after ordered evaluation. Ship lifecycle candidate evaluation is not a
safe seam: its deferred evaluator captures the exact first-wheel branch frontier
and reuses reward generation, settlement, and finding accumulation.

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

The ordered reward evaluator, history fold, lifecycle executor, and topology
command dispatcher remain the sole owners of their state transitions. Plan 2
does not create per-event reward evaluators, partial history folds, lifecycle
effect services, topology handlers with shared mutable state, or a generic
simulation context.

Pure preparation, lookup, and publication products may move below a
chronological coordinator only when they do not receive or return that
coordinator's mutable ordered state.

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

### Pass E — Closure

#### Gate E — Durable absorption and repository validation

**Review.** Reinventory the three packages from the final implementation tree
and compare them with the `714874b5` baseline. Confirm:

- each new module has one named owner, explicit inputs, a complete product,
  direct consumers, and primary tests;
- superseded inline code and duplicate tests are deleted;
- the catalog construction and engine simulation surfaces are unchanged;
- no planner production policy moved or was reproduced;
- the reward evaluator, history fold, lifecycle executor, topology dispatcher,
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

The catalog chain is ordered `A1 -> A2`. The engine chain is ordered
`B -> C -> D` so project composition consumes the final materialization and
reward-owner surfaces. The two chains have no intended contract dependency and
may execute in parallel worktrees when that reduces elapsed time. Gate D starts
only after both engine predecessor gates are integrated.

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
- per-event reward evaluators or a second history interpretation;
- decomposition of `materialization/rooms.ts`, `lifecycle/execute.ts`,
  `history/fold.ts`, or the topology command dispatcher;
- planner application or React production refactoring;
- broad test rewrites unrelated to moved primary ownership;
- performance optimization, worker offload, protocol/game-module work, or
  release hardening; or
- concurrent Vitest execution.

Any of those requires a separately grounded audit and plan after this phase is
closed.
