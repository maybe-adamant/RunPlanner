# Engine Maintainability Plan

## Status and objective

Status: **Locked; Gate A is next.**

Planning base: `3639dca0034a7143adcd6ac7866b52c0648d788a`.
The worktree was clean before this plan was written.

Narrow the engine's change neighborhoods and make internal product handoffs
complete without changing authored behavior, simulation results, candidate
policy, or execution output. This is the bounded cleanup identified in the
engine assessment, not a redesign of the engine. Evaluate further cleanup
only after this plan closes.

## Authorities and constraints

- `docs/design/ARCHITECTURE.md`: Product Construction, Reorganization Contract,
  and Planner Engine dependency rules.
- `docs/design/SIMULATION_AND_VALIDATION.md`: Ordered State-Flow Ownership.
- `docs/design/ROOM_LIFECYCLE_MODEL.md`: Lifecycle structure and derived
  authoring timeline.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: structural command closure.
- `docs/design/CANDIDATE_EVALUATION_MODEL.md`: exact evaluation assemblies,
  candidate artifacts, and scoped candidate evaluation.

No game-rule changes or new planner simplifications are proposed. Existing
declarations and behavior remain authoritative. A defect exposed by movement
is characterized and raised for a separate fix, not silently folded into the
refactor.

All semantic changes in code placement belong to `packages/planner-engine`.
Application and catalog consumers may receive mechanical supported-import or
signature updates only. No UI redesign, catalog policy, executor changes,
schema/protocol bumps, or fixture migrations belong here. Preserve package
export entrypoints; internal import paths need not be preserved by forwarding
modules.

## Baseline and bounded findings

The assessment counted 283 production TypeScript files / 91,335 lines and
160 test TypeScript files / 81,138 lines. These are diagnostics, not reduction
targets. Simulation accounts for 55,049 production lines; authored-project
for 25,184. Production has no external package imports, and authored-project
does not import simulation.

| Finding                        | Starting authority and consumer path                                                               | Intended improvement                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Runtime cycles                 | Materialization/encounter structure; trait offers/authoring policies; room actions/Hermes delivery | One-way dependencies, retaining explicit exhaustive policy     |
| Incomplete settlement handoff  | `rewards/acquisition-settlement.ts:applyProducerRoleHistory` to Shop and acquisition coordinators  | Return branches and every emitted side product together        |
| Mixed artifact construction    | `candidate-artifacts.ts` to chronology and exact evaluation assembly                               | Family-owned construction, thin complete aggregate             |
| Mixed reward processing        | `rewards/processing.ts` to room preparation, keepsake transitions, and offer generation            | Separate independently consumed operations                     |
| Repeated topology construction | `topology/structure-codec.ts:decodeAdditionalExits` through closure and owner assignment           | Decode attachments once into the existing structural stage     |
| Command-family coupling        | `commands/route-detours.ts` imports capacity reconciliation from `commands/topology.ts`            | Shared atomic command-owned reconciliation                     |
| Broad effect neighborhood      | `simulation/keepsakes.ts` and lifecycle structure in `room-action-domain.ts`                       | Focused responsibility groups without multiplying state owners |

The three runtime cycles are static import-graph findings, not demonstrated
runtime defects. No hidden global semantic registry was found in the reviewed
chronology. Its private mutable builders are appropriate. Exact-assembly
identity attestations do not replace explicit artifact storage and remain.

## Keep decisions and non-goals

- Keep biome reward chronology, history folding, Shop ordered purchase
  settlement, and atomic topology closure as coherent authorities. Their
  length is not a reason to split them into effect handlers.
- Keep the semantic address vocabulary and exhaustive canonical projection
  together. No registry-based dispatch or replacement address model.
- Preserve branch/cohort ordering, finding order and semantic ownership,
  incomplete/invalid authoring, horizon behavior, occurrence identity,
  candidate snapshot timing, and lifecycle phase ordering.
- No shared mutable evaluation context, dependency container, event bus,
  result-keyed semantic sidecar, production shadow model, or generic helper
  framework.
- No mass relocation of unrelated engine files or one-file-per-effect rule.
  Group moved files into meaningful neighborhoods as each slice lands; do
  not create a flat collection requiring another regrouping pass.
- Execution assembly and codecs are consumers, not a new cleanup campaign.
  A narrow level-settlement extraction or duplicate bag helper consolidation
  is allowed only inside its owning gate below.

## Delivery gates

Each gate (or explicitly numbered subgate) is one complete reviewed vertical
slice and intended commit boundary. C1/C2 and E1/E2/E3 are independent slices,
not one bundled commit merely because they share a heading.
Commit this plan after approval and before implementation. Before each gate,
inventory the live diff and give the executor a focused packet with the listed
starting symbols, immediate consumers, tests, exclusions, and deletions.
Use one write-capable executor, reuse it for bounded remediation, and obtain
a fresh independent review after each gate stabilizes. The main session owns
finding dispositions, broad closure checks, and Git operations.

### A — One-way module dependencies

Start at `simulation/materialization/{index,batch,rooms,hub,biome}.ts`,
`simulation/encounters/{index,structural}.ts`, `simulation/trait-offers.ts`,
`simulation/trait-authoring-policies.ts`, and authored
`{room-actions,room-action-key,hermes-shrine-delivery}.ts`.

Remove barrel-induced back edges where a leaf import is sufficient. Where
trait-domain computation and assessment genuinely depend on each other,
identify a lower-level complete domain operation and move it with its callers.
Do not move a cycle into a new barrel, hide it behind dynamic imports, or
merge all trait behavior into one file. Keep draft construction downstream of
the domain facts it assesses. Imports belong at the normal module header.

Acceptance: the three identified runtime cycles are removed without adding
new engine runtime cycles; public exports and behavior remain unchanged.
Extend existing architecture tooling where practical to enforce the resulting
acyclic runtime-import boundary, distinguishing type-only edges. No exhaustive
production dependency manifest. Primary witnesses: trait offers and focused
candidates, Hermes delivery/room actions, and F/N/O/H materialization tests.

Delete superseded back imports and relocated definitions in the same slice.

### B — Complete acquisition settlement product

Start at `rewards/acquisition-settlement.ts:applyProducerRoleHistory`,
`AcquisitionSettlementProduct`, and its `shop-settlement.ts` and acquisition
callers. Preserve the atomic producer-role fold, including recursive
replacement paths and agreement cohorts.

Return a complete immutable product containing branches, finding emissions,
role frontiers, and reached trait-child checkpoints. Callers accumulate those
explicit products in their existing chronological order. Preserve finding
deduplication/precedence rather than concatenating emissions indiscriminately.
Do not merely wrap the existing mutable output parameters in a context object.

Primary witnesses: `shop-purchase-chronology.test.ts`,
`shop-trait-reward-settlement.test.ts`, and
`olympian-reward-pressure.test.ts`. Retain representative All Together cohorts,
Artificer replacement/duplicate, missing child candidate recovery, and frozen
Pom-generation/current application history contacts. Add tests only for a
real uncovered handoff invariant.

Delete mutable out-parameters and their caller plumbing. No parallel settlement
path or intermediate compatibility wrapper survives this gate.

### C — Family-owned artifact construction and reward processing

#### C1 — Candidate artifact construction

Start at `simulation/candidate-artifacts.ts`,
`project-evaluation-assembly.ts`, `rewards/processing.ts`, and immediate
chronology, room-preparation, keepsake-rack, and generation consumers.

Move family capability construction/assessment into its nearest semantic
neighborhood. Keep aggregate interfaces and one complete assembly boundary;
exact artifacts stay attached to the matching evaluation. Do not turn the
aggregate into an ambient registry or distribute its publication across
hidden registrations. Aggregate construction may use a named complete input
product instead of the current long positional signature; preserve the
meaning of empty versus reached capabilities.

#### C2 — Reward processing operations

Separate branch initialization/handoff/projection, keepsake-equip branch
transitions, and offer-generation processing. Cohort ordering and canonical
recording remain together. Consolidate the duplicated lazy counted-bag
initialization in processing/acquisition settlement under one branch operation.
Do not change bag semantics or branch collapse behavior.

Place keepsake-equip branch transitions in `simulation/keepsakes/` now, with
explicit branch inputs/outputs. E1 extends that same neighborhood; it must not
move these transitions a second time. No unrelated keepsake movement is needed
to establish this destination.

Primary witnesses: `candidate-session.test.ts`,
`trait-offer-focused-candidates.test.ts`, `reward-frontier-handoff.test.ts`,
`keepsake-selection-candidates.test.ts`, `fountain-rarity-candidate.test.ts`,
and existing commerce candidate tests selected by changed constructors.
Retain exact evaluation identity, no reached-candidate replay, empty/reached
capabilities, and cross-biome reset distinctions. Use existing work-count
witnesses; no new production counters for the refactor. In particular, Gates
A-C retain these existing assertions (source-inspected baselines, not fresh
benchmark measurements):

- `apps/planner/src/projections/candidateProjectionSession.test.ts`,
  "keeps one bound session and one cached query domain per assembly identity":
  two identical room-target requests return the same result and invoke the
  evaluation observer exactly once.
- `apps/planner/test/architecture/candidateBoundary.test.ts`,
  "keeps selected-path progressive evaluation out of candidate recovery":
  only Hub imports the scoped progressive owner for alternative-order replay;
  generic selected-path recovery is excluded from all candidate families.
- `packages/planner-engine/test/simulation/candidate-session.test.ts`,
  "keeps the public simulation facade data-only and deeply equal": artifact
  restructuring does not alter the public evaluation product.

These do not establish a measured count for every internal constructor. If a
slice changes construction frequency, capture a focused before/after count at
the existing test seam before editing it rather than inventing a baseline.

Delete moved implementations and old internal paths, not preserve catch-all
forwarding modules. The aggregate module remains only if it owns composition.

### D — Topology construction and atomic reconciliation

Start at authored `topology/{structure-codec,codec,occurrence-codec,query}.ts`,
`commands/{topology,route-detours}.ts`, and `topologyImpact.ts`.

Decode each occurrence's structural additional exits once, then carry those
attachments explicitly through selection, detour closure, owner assignment,
and the final `DecodedTopologyStructure`. Keep structural decoding and leaf
decoding separate and keep validation order/error contacts stable. Do not add
a parallel topology model just to share queries.

Move `reconcileExitDecisionToDeclaredCapacity` into command-owned topology
reconciliation, keeping pruning, descendant removal, selection retention,
and selected-entry reconciliation atomic. Remove detour-to-ordinary-dispatcher
coupling. Consolidate equivalent structural source identity helpers nearby;
do not conflate structural identity with public semantic-address serialization.
Consolidate mutation helpers only when their hub/ordinary/detour domains agree.

Primary witnesses: `topology/structure-codec.test.ts`, topology and route-detour
command suites, and addresses tests. Cover existing incomplete structures,
subtree/occurrence retention, selected additional exits, Anomaly capacity,
hub-local decisions, and malformed-input rejection contacts without duplicating
the whole matrix at every consumer.

Delete repeated attachment decoding and displaced helper implementations.

### E — Focused keepsake and lifecycle neighborhoods

#### E1 — Keepsake responsibilities

Start at `simulation/keepsakes.ts`, the keepsake branch transitions moved in C,
and their immediate effect consumers. Use the `simulation/keepsakes/`
neighborhood established by C2.

Separate independently consumed effect assessments from shared keepsake state
construction/replacement/advancement. Keep atomic shared transitions together;
family helpers receive explicit state and return results, never install
handlers. Keep Echo replay interactions in the owning keepsake neighborhood
without inventing a second keepsake state or clock.

#### E2 — Authored lifecycle structure

Start at `authored-project/room-action-domain.ts` and its structure consumers.

Move lifecycle-structure construction/scoping/window ordering as one authored
product. Action contributions, required participation, and dependency assembly
remain centralized; simulation and execution consume that same structure.
Remove the self-derived action-domain drift assertion only after confirming
it compares sets built from the same actions and adds no independent check.

#### E3 — Level-resolution settlement

Start at `rewards/trait-settlement.ts` and its existing level-effect authorities.

Extract the bounded level-resolution settlement branch from trait settlement
only as a complete transition beside its level-effect authority. Preserve
source-time generation history versus current-time application history. Keep
the ordinary trait-selection coordinator and shared Yarn/Hymn/Echo ordering.

Primary witnesses: keepsake/Phial, Cherished Heirloom, Echo gift, trait-level
and Shop chronology suites; room-action command/timeline and H/O phase-scope
tests. Move primary assertions with their authority where needed; retain
representative consumer tests instead of copying full matrices.

Delete moved definitions and superseded imports. No public forwarding facade
solely to keep the old internal file paths alive.

### F — Whole-product review and closure

Review all gates together for explicit inputs/outputs, preserved ordered
authorities, new cycles, shared mutable state, unexplained file/line growth,
duplicate tests, and forwarding/revision residue. Report remaining concerns
without extending this plan into another cleanup campaign.

Use narrow owning tests during implementation and workspace typechecking for
changed cross-module contracts. At stable closure run `npm run check` once,
with performance comparison explicitly based on the planning commit rather
than only the last gate commit. Existing fixture/product witnesses must show
unchanged authored and execution products; do not regenerate fixtures to hide
a behavior change. Preserve generated fixture bytes and serialization.

Update the smallest relevant stable design sections if the clarified ownership
needs documentation. Record the truthful closure results in the closure commit
and final handoff; do not create a new permanent progress tracker. Delete this
temporary plan at closure. Leave unrelated progress documents untouched.
