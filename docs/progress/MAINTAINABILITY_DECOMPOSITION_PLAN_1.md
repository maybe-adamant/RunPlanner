# Maintainability Decomposition Plan 1

## Status

Locked for execution at clean base `7fe8601b` on 2026-08-25. This is the
temporary execution contract for the first bounded maintainability phase. It
must not be linked from `README.md` or stable design and audit authorities.
After its final gate closes, durable outcomes belong in the smallest owning
design or progress document and this file is deleted.

This plan covers only gravity wells whose live code already exposes a credible
ownership seam. It deliberately defers the chronological coordinators and
declaration-language compilers that need a separate responsibility and data-flow
audit before extraction.

## Objective

Reduce the size of the code neighborhoods a maintainer must understand to change
one catalog compiler family, planner interaction or presentation family, engine
trait/reward policy, codec subtree, or generation/progressive product without
changing Run Planner behavior.

At closure:

- each extracted module has one named semantic or presentation owner, explicit
  inputs, a complete returned product, known consumers, and primary tests;
- the old inline implementation is deleted in the same gate as its replacement;
- public catalog, engine, structured-workspace, application, authored-schema,
  command, finding, and persistence contracts are unchanged;
- invalid, incomplete, dormant, and context-invalid authored states retain the
  same representation and repair path;
- policy matrices remain with their owning authority instead of being copied
  into facades or product-loop tests;
- tests are divided by the production owners they verify and the explicit
  Vitest heavy-lane manifest remains exact; and
- the repository is reinventoried before any harder cleanup plan is written.

No target line count or file count is an acceptance criterion. The acceptance
target is a smaller and more explicit change neighborhood with no parallel path,
ambient mutable context, or unexplained production growth.

## Governing Authorities

The implementation is behavior-preserving against:

- [`ARCHITECTURE.md`](../design/ARCHITECTURE.md) for package direction,
  construction, imports, and supported surfaces;
- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md) for raw-to-normalized catalog
  ownership and compiler closure;
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md) for schema 59,
  semantic commands, retained invalid state, acquisition ownership, and codecs;
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md) for
  chronological simulation, candidate reuse, findings, and test ownership;
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md) for
  the private semantic-assembly, presentation, and interaction-binding production
  line; and
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md) for React's rendering and command
  boundary.

The maintenance frontier in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md#maintenance-cleanup-frontiers)
is the durable record of why these families are candidates. This temporary plan
owns only delivery mechanics.

## Baseline Inventory

Counts are from `7fe8601b`. They are diagnostics, not quotas.

### Catalog compiler wells

| Owner                           | Production | Primary test | Mixed responsibilities                                                                                                                                         |
| ------------------------------- | ---------: | -----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `compiler/traits.ts`            |      1,880 |        2,686 | Chaos operands/outcomes, selected dispositions, requirements, weapon/aspect normalization, trait normalization, giver normalization, and cross-family closure. |
| `compiler/rewards/normalize.ts` |      1,211 |        1,719 | Acquisition/reward-type normalization, requirements/stores, Shop normalization, acquisition lifecycles, and producer lifecycles.                               |

### Planner wells

| Owner                                 | Production |               Primary test | Mixed responsibilities                                                                                                                    |
| ------------------------------------- | ---------: | -------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `candidateProjection.ts`              |      1,281 |                        296 | Public projection vocabulary, project-bound caches, cooperative evaluation, and adapters for every candidate query family.                |
| `reward-child-interaction-binding.ts` |      1,229 |                      1,238 | Reward, ordinary trait, selected-effect, level-resolution, generated-pickup, and conversion command binding.                              |
| `TraitOfferEditor.tsx`                |      1,760 |                      2,356 | Dialog/loading shell, ordinary offers, Echo last-run boon, Natural Selection, Ransom, All Together, Circe, and selected-outcome controls. |
| `occurrence-room-assembly.ts`         |      1,173 |                distributed | Reward-local assembly, room workbench presentation, encounter-phase requirements, Ship presentation, and supplemental Shop acquisitions.  |
| `occurrence-actions-assembly.ts`      |        802 |                        689 | Action-row projection, lifecycle timeline, tab placement, Run State launchers, and child markers.                                         |
| `OccurrenceRoomActions.tsx`           |        985 |                      1,304 | Timeline shell plus acquisition, trait, level, conversion, Steady Growth, and action-order rows.                                          |
| `HubDecisionWorkbench.tsx`            |      1,493 |                      1,321 | Hub membership, room cards, visit ranking/drag controls, and completion presentation.                                                     |
| `BiomeWorkspace.tsx`                  |      1,187 |                      1,614 | Workspace shell and inspector dispatch plus route-specific Jeweled Pom, Judgment, encounter, reward, and room controls.                   |
| `App.tsx`                             |      1,015 | 372 plus 1,837 interaction | Application shell, route overview, route workspace, dialog composition, and top-level session coordination.                               |

### Planner-engine wells

| Owner                                                                        | Production |                                    Primary test | Mixed responsibilities                                                                                                                          |
| ---------------------------------------------------------------------------- | ---------: | ----------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `authored-project/traits.ts`                                                 |      1,091 |                                     distributed | Authored trait vocabulary/defaults plus selected pickup-producer discovery and reconciliation.                                                  |
| `simulation/traits.ts`                                                       |      3,373 |                                           2,848 | Trait history folding, derived facts, offer composition/evaluation, acquisition effects, level effects, target effects, and authoring drafts.   |
| `simulation/candidate-artifacts.ts` + `simulation/candidates/trait-offer.ts` |      2,516 |                                     distributed | Candidate capability containers plus trait/Echo/Natural Selection/Ransom/All Together query evaluation.                                         |
| `simulation/rewards/processing.ts`                                           |      5,141 |     2,182 Shop suite plus focused reward suites | Branch primitives, trait settlement, reward generation, Shop settlement, pickup/producer settlement, conversions, and public branch projection. |
| `authored-project/topology/codec.ts`                                         |      2,497 |                            topology codec suite | Leaf/subtree decoding plus topology ownership, cycle, staged-selection, progression, takeover, Hub, local-visit, and detour closure.            |
| `authored-project/room-state/codec.ts` + `room-state/encounters.ts`          |      2,214 | 852 encounter suite plus room-state codec suite | Reward/Shop/Ship/Ephyra room children, encounter selections, encounter trait offers, Nemesis outcomes, and reconciliation.                      |
| `simulation/generation/biome.ts`                                             |      2,310 |          F/G generation and route-detour suites | Normal generation, force pressure, Fields outcomes, target frontiers, takeovers, and final assembly.                                            |
| `simulation/progressive/biome.ts`                                            |      2,255 |                                           1,644 | Selected products, retained blocked products, semantic finding location, chronology comparison, prefix construction, and clamp orchestration.   |

## Locked Refactoring Rules

### Behavior and contracts stay fixed

Every gate is internal movement. It may tighten a local construction assertion
only when the assertion already follows from the supported contract and is
covered by a focused regression. A discovered behavioral defect stops that gate
for disposition; it is not quietly repaired inside the movement commit.

There is no authored schema bump, catalog version bump, semantic-command change,
candidate result change, finding change, editor redesign, or new runtime policy.
The public `projections/structured-workspace` entry and the current package
exports remain deliberate supported surfaces.

### A split must create an owner

An extraction is accepted only when the new module can be described without
words such as `common`, `shared`, `helpers`, `misc`, or `utils`. It receives the
narrow inputs it needs and returns the whole product consumed by the next stage.
No hidden registration, module-initialization channel, sidecar map, mutable
service table, catch-all context, or dependency-injection container is allowed.

Facade modules may remain as supported entries or small orchestrators. They may
not retain a second implementation, forward every internal symbol merely to
preserve private imports, or become ambient registries.

### Test ownership moves with production ownership

Large primary suites are divided by policy owner in the same gate that extracts
that owner. Shared fixtures may remain shared when they only construct inputs or
observe outputs. They must not reproduce production policy.

Every moved heavy test is added to or removed from `vitest.test-lanes.ts` in the
same commit so regular, heavy, and performance lanes remain a disjoint exact
partition. Broad contract and product-loop tests keep representative witnesses;
they do not receive copies of the extracted policy matrices.

### Commits are independently coherent

Each gate is one Conventional Commit and leaves no transitional import path or
later-gate TODO. A gate may be skipped after live inspection if the proposed
seam does not yield a clearer complete product. Skipping is preferable to a
mechanical split and is recorded in the closure review.

## Included Scope and Gate Order

The order moves from lower-risk normalization and application seams into engine
policy and then pure decoding/evaluation. Within each pass, later gates may use
the clearer boundaries established by earlier gates, but no gate may require an
unfinished compatibility layer.

### Pass A: Catalog compiler families

#### Gate A1 — Trait compiler families

**Owner and product.** Decompose `packages/hades2-catalog/src/compiler/traits.ts`
around already closed normalized products:

- Chaos operand, requirement, derived-outcome, and catalog normalization;
- selected-disposition and trait-requirement normalization;
- weapon, aspect, and trait declaration normalization;
- giver normalization and provider-owned closure; and
- final trait-catalog assembly and cross-family validation.

The assembly entry continues to return the same immutable `TraitCatalog` and
remains the only supported compiler contact. Extracted modules are compiler-
private; do not add package exports or a generic normalization toolkit.

**Tests.** Split `test/catalog/traits.test.ts` into owner-aligned suites only
where the production split creates a real test owner. Preserve the complete
membership/dependency matrix at the catalog boundary and retain one assembly
closure suite. Run the focused catalog trait suites; the complete catalog lane
runs after Gate A2.

**Deletion.** Remove each extracted implementation from `traits.ts`; the entry
must not retain copied validators or forwarding exports.

**Commit.** `refactor(catalog): decompose trait compiler families`

#### Gate A2 — Reward-kernel compiler families

**Owner and product.** Decompose
`packages/hades2-catalog/src/compiler/rewards/normalize.ts` into:

- concrete acquisition and reward-type normalization;
- reward requirements, stores, and referenced-reward validation;
- Shop option/profile normalization; and
- acquisition and producer lifecycle normalization.

The existing reward-kernel assembly remains the sole producer of the complete
immutable `RewardKernelCatalog`. Shop and lifecycle modules receive normalized
inputs explicitly and do not discover sibling products through registration.

**Tests.** Divide `test/catalog/rewards.test.ts` by acquisition/reward, Shop,
and lifecycle authority while retaining one compiler-closure suite. Run the
focused suites and `npm run test:catalog`.

**Deletion.** Remove superseded inline normalizers from `normalize.ts`; do not
create a second reward compiler entry.

**Commit.** `refactor(catalog): decompose reward compiler families`

### Pass B: Planner trait authoring

#### Gate B1 — Candidate session core and query adapters

**Owner and product.** Keep `candidateProjection.ts` as the supported application
projection entry while extracting:

- the identity-bound candidate session cache and cooperative projection loop;
- reward and room query adapters;
- trait-offer and level-resolution query adapters; and
- the small pure support/presentation functions.

The session factory must still bind one immutable project/evaluation identity
pair and expose the same `CandidateProjectionSession`. Adapters consume that
session and engine candidate products; they do not rebuild project evaluation or
own domain legality.

**Consumers.** Preserve imports used by application composition, structured-
workspace interaction binding, contextual picker projections, trait/reward
projections, and React candidate presentation. `candidateBoundary.test.ts`
continues to attest the deliberate public vocabulary.

**Tests.** Split `candidateProjection.test.ts` only if cache/session and adapter
behavior acquire distinct primary owners. Run the focused projection suite,
`candidateBoundary.test.ts`, and the changed-test lane.

**Deletion.** Remove the inline adapter families from the entry; no alternate
candidate facade or public barrel is introduced.

**Commit.** `refactor(planner): separate candidate session adapters`

#### Gate B2 — Reward-child interaction families

**Owner and product.** Decompose
`reward-child-interaction-binding.ts` into complete interaction maps for:

- reward payload and ordinary trait-offer edits;
- selected trait outcomes, including Echo, Natural Selection, Ransom, All
  Together, and Circe;
- level-resolution and acquisition-target edits; and
- generated-pickup and acquisition-conversion edits.

One composer still returns the complete
`WorkspaceRewardChildInteractionCatalog`. Command construction remains in the
application binding layer and domain legality remains in semantic commands and
candidate evaluation.

**Tests.** Divide the current binding suite by returned interaction family and
retain one completeness/duplicate-key composition suite. Run those suites and
the changed-test lane.

**Deletion.** Remove the extracted branches from the composer and delete any
test helpers that encode the same command-selection matrix as production.

**Commit.** `refactor(planner): decompose reward child interaction binding`

#### Gate B3 — Trait-offer presentation families

**Owner and product.** Keep `TraitOfferEditor` and `TraitOfferDialog` as the
React entry components while extracting substantial presentation owners for:

- the loading/dialog and ordinary offer shell;
- Echo last-run boon authoring;
- selected trait outcomes such as Natural Selection, Ransom, and All Together;
  and
- Circe and acquisition-target resolution controls.

Components consume projected interactions and candidates only. They must not
derive target legality, reconstruct semantic commands, or repair retained
invalid state.

**Tests.** Split `TraitOfferEditor.test.tsx` by those presentation owners and
retain a concise entry/dialog integration suite. Update the heavy-test manifest
atomically. Run the focused UI suites, then close Pass B with
`npm run test:planner`, `npm run test:ui`, and `npm run test:contract`.

**Deletion.** Remove all extracted component implementations from the entry;
do not keep wrapper layers that only rename props.

**Commit.** `refactor(planner): decompose trait offer presentation`

### Pass C: Planner occurrence timeline

#### Gate C1 — Occurrence room-local assembly

**Owner and product.** Decompose `occurrence-room-assembly.ts` into the existing
semantic families it already composes:

- occurrence reward/local facts;
- room workbench and encounter-phase presentation;
- interaction requirements; and
- supplemental Shop acquisition presentation.

`occurrence-assembly.ts` continues to consume explicit complete returned
products. The split must preserve the authored-first workspace production line
and must not make presentation inspect semantic command binding.

**Tests.** Establish focused primary suites for the extracted owners while
retaining representative contact in `occurrence-assembly.test.ts` and
`biome-semantic-assembly.test.ts`. Run the focused assembly suites and the
changed-test lane.

**Deletion.** Remove each extracted branch from `occurrence-room-assembly.ts`;
if that filename no longer names a coherent product, replace it with the
smallest deliberate composer rather than retaining a compatibility file.

**Commit.** `refactor(planner): decompose occurrence room assembly`

#### Gate C2 — Occurrence action projection and presentation

**Owner and product.** Treat `occurrence-actions-assembly.ts` and
`OccurrenceRoomActions.tsx` as one vertical timeline surface. Separate:

- engine-product-to-action-row projection;
- lifecycle timeline and legal tab placement;
- Run State launchers and reward-child markers; and
- React rows for acquisition, trait, level, conversion, Steady Growth, and
  ordering controls.

Projection owns presentation products; React only renders those products and
dispatches bound intents. The occurrence workbench remains the shell over the
complete action product.

**Tests.** Split both primary suites along the new projection and row owners,
retain one assembly-to-React workflow witness, and update the heavy-test
manifest. Run the focused suites, then close Pass C with
`npm run test:planner`, `npm run test:ui`, and `npm run test:contract`.

**Deletion.** Remove superseded row dispatch and timeline branches from the old
files. Do not introduce a React-facing copy of lifecycle timing.

**Commit.** `refactor(planner): decompose occurrence action timeline`

### Pass D: Planner workspace presentation

#### Gate D1 — Hub workbench presentation

**Owner and product.** Decompose `HubDecisionWorkbench.tsx` into substantial
owners for membership/open-slot presentation, Hub room cards, visit ranking and
drag controls, and completion/handoff presentation. The top-level component
retains composition and shared focus behavior.

**Tests.** Divide `HubDecisionWorkbench.test.tsx` by presentation owner while
retaining one full-workbench interaction witness. Update the heavy-test manifest
and run the focused suite plus the changed-test lane.

**Deletion.** Remove extracted implementations from the workbench. Do not move
Hub membership, ranking legality, or generation policy into React.

**Commit.** `refactor(planner): decompose hub workbench presentation`

#### Gate D2 — Biome inspector composition

**Owner and product.** Keep `BiomeWorkspace.tsx` as the shared workspace shell
and extract route-specific inspector controls and exhaustive inspector-node
rendering into named presentation modules. Jeweled Pom, Judgment, encounter,
reward, room, and Hub surfaces remain consumers of projected products rather
than new policy owners.

**Tests.** Divide `BiomeWorkspace.test.tsx` by shell/inspector owner, preserve
candidate render-purity and unsupported-union witnesses, update the heavy-test
manifest, and run the focused suite plus the changed-test lane.

**Deletion.** Remove extracted inspector branches from the shell; retain one
exhaustive dispatch point and no parallel workspace renderer.

**Commit.** `refactor(planner): separate biome inspector composition`

#### Gate D3 — Application route shell

**Owner and product.** Extract `RouteOverview` and `RouteWorkspace` from
`App.tsx` as application-owned composition components. `App` retains project
session, route selection, top-level dialogs, and application collaborator
composition. This gate does not redesign navigation or introduce context-based
dependency injection.

**Tests.** Move component-specific cases from `App.test.tsx` only where the
extracted component has a direct owner. Keep `App.interaction.test.tsx` broad as
a representative application workflow suite rather than dividing its product
stories. Run the focused shell tests, then close Pass D with
`npm run test:planner`, `npm run test:ui`, and `npm run test:contract`.

**Deletion.** Remove extracted components from `App.tsx`; do not add forwarding
components or prop-bag context providers.

**Commit.** `refactor(planner): separate application route shell`

### Pass E: Engine trait pipeline

#### Gate E1 — Authored trait offers and pickup producers

**Owner and product.** Separate the authored trait/offer vocabulary and default
construction in `authored-project/traits.ts` from selected pickup-producer
discovery, site-key parsing, active-producer selection, and state reconciliation.
Both remain pure authored-project products and return all state consumed by
commands, codecs, and simulation.

**Tests.** Assign producer discovery/reconciliation a focused primary suite and
retain authored offer/default witnesses with their existing command/codec
owners. Run the focused suites and the changed-test lane.

**Deletion.** Remove producer algorithms from the authored vocabulary module;
do not add a producer registry or change serialized keys.

**Commit.** `refactor(engine): separate authored pickup producers`

#### Gate E2 — Trait history, offer, and effect semantics

**Owner and product.** Decompose `simulation/traits.ts` into:

- trait history state, event folding, and derived facts;
- offer context, rarity, composition, evaluation, and recording;
- level resolution and direct/targeted acquisition effects; and
- Natural Selection, Ransom, Steady Growth, Bridal Glow/Hammer, and authoring
  draft policies.

One deliberate trait-simulation entry may re-export the existing supported
engine vocabulary, but internal consumers should import the nearest owner where
the engine architecture permits it. The split must preserve event order and use
the same declaration-owned Hephaestus upgrade predicate and fallback policy.

**Tests.** Split `simulation/traits.test.ts` by history, offer, level, and effect
owner. Keep specialized Echo, replacement, Chaos, Pom, and run-impacting trait
suites as their current primary matrices; do not duplicate them. Run the
focused suites and the changed-test lane.

**Deletion.** Remove the extracted implementations from `traits.ts`; no generic
effect registry, mutable history service, or compatibility copy is allowed.

**Commit.** `refactor(engine): decompose trait simulation semantics`

#### Gate E3 — Trait candidate capabilities and evaluators

**Owner and product.** Move trait-offer and level-resolution candidate artifact
construction out of the broad `candidate-artifacts.ts` family and divide
`candidates/trait-offer.ts` by ordinary/focused offer evaluation and selected
effect domains (Echo, Natural Selection, Ransom, All Together, Circe). Preserve
the existing candidate query/result contracts and project-bound preparation.

**Tests.** Give capability construction and each evaluator family a primary
focused suite. Retain representative contacts in
`trait-offer-focused-candidates.test.ts`, `run-impacting-trait-candidates.test.ts`,
and application candidate contracts. Run the focused suites, then close Pass E
with `npm run test:engine`.

**Deletion.** Remove trait-specific artifact construction from the broad
artifact module and extracted evaluator branches from the old file; do not add
a second candidate engine.

**Commit.** `refactor(engine): decompose trait candidate products`

### Pass F: Engine reward settlement

#### Gate F1 — Reward branch and trait-settlement primitives

**Owner and product.** Extract from `simulation/rewards/processing.ts` the
immutable branch primitives, branch equivalence/merge, event/finding append,
trait-offer settlement, and encounter trait-offer settlement. These functions
receive and return complete reward branch products; they do not mutate an
ambient processing context.

**Tests.** Move the applicable trait, encounter, Artificer, Time Piece, and
branch-merging cases to focused owner suites while preserving their semantic
matrices. Run those suites and the changed-test lane.

**Deletion.** Remove the extracted implementations from `processing.ts`; do
not introduce a mutable reward service or an untyped branch context.

**Commit.** `refactor(engine): extract reward settlement primitives`

#### Gate F2 — Shop and acquisition-site settlement

**Owner and product.** Separate Shop inventory/cohort processing and paid-site
settlement from producer, owned, pickup, and Artificer-replacement acquisition
settlement. Keep purchase versus pickup lifecycle semantics explicit. Pending
Travel Deal and Shrine products remain typed values passed between stages.

`processing.ts` may remain the chronological facade that composes these
products, but it must no longer contain their implementations. Offer/cohort
generation and public branch projection may remain there when live inspection
shows that they are the facade's coherent chronological responsibility.

**Tests.** Split `shop-trait-purchase.test.ts` by inventory generation, purchase
chronology, and trait/reward settlement owners. Preserve focused Artificer,
Infernal Travel, Time Piece, All Together, Shrine, Well, and generated-pickup
witnesses in their owning suites. Run the focused suites and
close Pass F with `npm run test:engine`.

**Deletion.** Remove superseded Shop and acquisition-site branches from
`processing.ts`; no generalized interaction lifecycle or optionality inference
is introduced.

**Commit.** `refactor(engine): decompose reward acquisition processing`

### Pass G: Engine persistence decoders

#### Gate G1 — Topology subtree decoding and relational closure

**Owner and product.** Decompose `authored-project/topology/codec.ts` into:

- occurrence-local and Room Action leaf decoding;
- acquisition-site, Shrine, and Well subtree decoding;
- exit, target, Hub, and local-visit structural decoding; and
- relational closure for ownership, collisions, cycles, staged selections,
  progression bounds, takeovers, and automatic detour continuation.

One topology decoder still returns the same exact schema-59 `BiomeTopology` or
the same path-addressed decode failure. Structural subtree decoders must not
perform simulation or silently normalize retained invalid state.

**Tests.** Divide `authored-project/topology/codec.test.ts` by leaf, structure,
and relational closure owner while retaining exact error-path assertions and one
full decoder closure suite. Run the focused suites and the changed-test lane.

**Deletion.** Remove extracted decoders and validators from the entry. No loose
intermediate schema, compatibility decoder, or alternate public decode path is
allowed.

**Commit.** `refactor(engine): decompose topology codec ownership`

#### Gate G2 — Room-state and encounter child decoders

**Owner and product.** Decompose `room-state/codec.ts` by reward/acquisition,
Shop, Ship/Ephyra, and final room-state assembly. Decompose
`room-state/encounters.ts` by envelope/default queries, trait-offer children,
Nemesis/Gorgon specialized outcomes, and reconciliation. Preserve the same
closed state unions and error paths.

**Tests.** Split the room-state and encounter codec suites by these owners,
retaining one full room-state assembly closure suite. Run the focused suites and
close Pass G with `npm run test:engine`.

**Deletion.** Remove superseded decoder branches from both entry modules. Do
not share raw `unknown` objects beyond the decoder that owns their exact shape.

**Commit.** `refactor(engine): decompose room state decoders`

### Pass H: Engine generation and progressive products

#### Gate H1 — Biome generation support products

**Owner and product.** Decompose `simulation/generation/biome.ts` into:

- normal candidate pools, counts, requirements, force support, and ordinary
  selected-target traversal;
- Fields cage-outcome support;
- one joint first-target/takeover support owner for the combined ordinary and
  takeover force pool, first-target frontier context, takeover shape, and
  takeover candidate evaluation; and
- final biome-generation assembly.

Each evaluator receives immutable generation history/frontier inputs and
returns its complete support product. Assembly preserves declaration order,
finding chronology, and the existing public generation result.

The joint first-target/takeover boundary is intentional. The game-rule product
computes one force pool from ordinary and takeover candidates before both the
frontier query and takeover evaluation consume it; splitting those consumers
into independent owners would create a false product cycle or duplicate force
policy.

**Tests.** Partition F/G generation and route-detour cases by normal, Fields,
and takeover owner while retaining one assembly witness per affected biome.
The joint-owner tests retain the mixed ordinary/takeover force-pool and
all-exit aggregate-cap matrices without duplicating them in assembly tests. Run
the focused suites and the changed-test lane.

**Deletion.** Remove extracted implementations from `generation/biome.ts`; do
not add a generation service, hidden cache, or second room-support evaluator.

**Commit.** `refactor(engine): decompose biome generation support`

#### Gate H2 — Progressive retention, location, and clamp products

**Owner and product.** Decompose `simulation/progressive/biome.ts` into:

- selected and retained-blocked product projection;
- semantic finding ancestry/location and chronology ordering;
- prefix decision/frontier construction; and
- progressive clamp orchestration.

The orchestrator continues to publish the same complete, blocked, or incomplete
progressive product. Finding location must remain semantic-owner based and
retention must not replace authored state with canonical state.

**Tests.** Split `progressive-biome.test.ts` by retained products, finding
location/order, and clamp result. Retain progressive Hub and work-count suites
as representative cross-owner witnesses. Run the focused suites and close Pass
H with `npm run test:engine`.

**Deletion.** Remove extracted algorithms from the orchestrator. Do not create
a second finding traversal or a production closure audit.

**Commit.** `refactor(engine): decompose progressive biome products`

## Explicitly Excluded: Plan 2 Candidates

The following remain unchanged throughout Plan 1 even if a nearby extraction
could make touching them convenient:

- `simulation/rewards/biome.ts`, whose 5,000-plus-line chronological evaluator
  needs an event-order, hidden-state, and consumer audit before any split;
- `simulation/project.ts`, `simulation/materialization/biome.ts`,
  `simulation/materialization/rooms.ts`, `simulation/lifecycle/execute.ts`, and
  `simulation/history/fold.ts`, which are chronological or registry-like
  coordinators requiring separate care;
- `authored-project/commands/topology.ts`, whose closed dispatcher owns atomic
  topology invariants;
- planner `decision-assembly.ts`, `occurrence-reward-assembly.ts`,
  `biome-semantic-assembly.ts`, `source-index.ts`,
  `occurrence-interaction-binding.ts`, and the explicit structured-workspace
  `contract.ts`, which currently have coherent returned products;
- catalog room/layout declaration-language compilers until a compiler-specific
  audit proves a complete extraction; and
- large room, trait, weapon-upgrade, fixture, and explicit contract declarations
  that are readable data rather than mixed logic.

Plan 1 does not create Plan 2. After closure, the main session reinventories
these files and writes a new locked plan only for seams supported by that fresh
audit. A Plan 1 extraction must not add scaffolding for a hypothetical Plan 2.

## Gate Routine

This is a substantial, explicitly gated refactor. Each implementation gate uses
the repository's fresh executor/reviewer routine:

1. record the current base commit, exact gate, target files, expected products,
   exclusions, primary tests, and worktree inventory;
2. give one fresh executor ownership of the complete gate and prohibit unrelated
   cleanup or contract reinterpretation;
3. let the executor use focused owning-lane tests while moving code and tests;
4. give one fresh independent read-only reviewer the base commit, exact diff,
   this gate, authorities, exclusions, and validation results;
5. route accepted findings through one bounded remediation pass;
6. have the main session review the entire gate diff for authority, dependency
   direction, old-path deletion, public-surface stability, test ownership, and
   unexplained growth; and
7. commit the coherent gate only after authorization.

The executor stops if the live code contradicts the gate's proposed complete
product or if behavior must change to make the extraction work. The main session
then skips, narrows, or amends the gate; the executor does not invent a new
contract.

## Validation

### During a gate

- Run the exact moved primary suites first.
- Use `npm run test:changed` as the bounded cross-contact check after the exact
  primary suites. Do not substitute it for a named primary suite.
- Run `npm run typecheck` when module boundaries, exports, or cross-file type
  ownership change materially.
- Run `npm run lint` and `npm run format:check` before committing each stable
  gate, or a bounded changed-file equivalent when the execution environment
  provides one truthfully.
- Do not run the complete repository gate after every extraction.

### At pass and phase boundaries

- A pass ends with its named owning lane or lanes green and no superseded imports
  or test-lane entries. Catalog closes with `npm run test:catalog`; engine passes
  close with `npm run test:engine`; planner passes close with the planner, UI,
  and contract lanes named in their final gate.
- After Gate H2 and all review fixes are stable, run one `npm run check` as the
  Plan 1 closure gate.
- Record the exact closure result in the durable progress history without
  implying live in-game validation.

## Adversarial Review Checklist

Before accepting each gate, answer all of the following from the diff:

- Does every new module own a product, or was code merely divided by length?
- Are inputs explicit and returned products complete, with no semantic side
  channel or construction-order dependency?
- Is policy still in the catalog or engine owner rather than copied into the
  application or React?
- Does the old implementation path disappear in this commit?
- Did public exports grow only because a genuine supported consumer needs them?
- Did test movement follow production ownership without weakening matrices or
  duplicating them across layers?
- Are retained incomplete and context-invalid authored states still visible and
  repairable?
- Is production growth explained by clearer ownership rather than wrappers,
  registries, compatibility layers, or speculative interfaces?
- Can a future maintainer change one extracted family without reopening the
  original whole-file context?
- Would keeping the current file intact be clearer? If yes, skip the split and
  record that disposition.

## Closure

After all accepted gates:

1. remeasure the changed neighborhoods and inventory remaining files by
   responsibility, not only line count;
2. verify no private compatibility facade, stale import, duplicate matrix, or
   unexplained production growth remains;
3. update stable design text only where the implemented ownership boundary is
   durable and not already described;
4. add a concise Plan 1 outcome and truthful complete-gate result to
   `IMPLEMENTATION_PROGRESS.md`;
5. refresh the maintenance frontier in `IMPLEMENTATION_PLAN.md` from the new
   live tree, naming Plan 2 only after its audit scope is known;
6. delete this temporary plan; and
7. commit closure separately from the final implementation gate.

Closure does not require every proposed split to land. It requires every landed
split to improve ownership and every skipped gate to have a documented,
evidence-backed reason.
