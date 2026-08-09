# Authoring and First-Blocking Validation Alignment

## Status

**Implementation-ready and locked; implementation has not started.**

This temporary delivery document updates the contributor-authored
`Authoring and First-Blocking Validation Separation Plan` against the current
schema-15, post-trait, post-Run-State codebase. It owns the delivery order and
acceptance evidence only. Stable contracts remain in `docs/design/` and will
absorb the result when this work closes.

## Objective

Align the four authored decision axes—rooms, encounters, rewards, and
traits—on one boundary:

1. authored commands publish a complete immutable document whenever the
   requested transition is structurally representable;
2. selected-path validation publishes derived truth only through the first
   blocking semantic region; and
3. candidate repair consumes the exact pre-decision capability captured by
   that same evaluation.

The full authored suffix remains persisted, visible, and editable. This work
does not add a committed authoring cursor, truncate downstream state after an
ordinary edit, or make contextual eligibility a command precondition.

## Locked contract

### Authoring

`applyProjectCommand(document, catalog, command)` may enforce:

- exact semantic ownership and address contact;
- catalog membership and declaration-owned static domains;
- topology closure, stable occurrence identity, and bounded structure;
- fixed versus selectable slots and declared set membership;
- complete declaration-owned defaults; and
- successful decoding of the complete proposal.

It must not require a `ProjectEvaluationAssembly`, candidate capability,
history, reward branch, encounter activation result, or contextual trait
assessment. A context-invalid value remains persisted until the user repairs
it explicitly.

### First blocking region

One chronological validation authority stops its published truth at the
earliest of:

- the reached incomplete authoring frontier;
- an error-severity invalid selected semantic owner or explicitly atomic
  region; or
- successful completion of the configured path.

The blocked region may publish multiple co-owned findings when splitting them
would invent an order. Examples include one complete trait offer, an N open
board, and a jointly generated reward group. No finding, history effect,
candidate capability, assessed marker, or Run State snapshot from a later
region may escape.

The internal blocking-region locator must derive chronology from existing
products rather than subsystem array order:

- materialized physical-target and Hub-visit order locate failures that occur
  before a history event exists;
- `TargetGenerationView`, `OfferPointView`, room lifecycle event sequence, and
  encounter history sequence locate reached room phases; and
- an explicit atomic-region key groups findings that share one unordered or
  indivisible decision.

The evaluator family that owns an aggregate decision supplies that internal
atomic-region key alongside its findings. The shared locator only composes
those keys with existing materialization and lifecycle positions; it must not
infer aggregate ownership from finding codes, maintain a parallel chronology
table, or walk the lifecycle independently. Two findings at the same rendered
decision are not co-owned unless their producing authority declares the same
atomic region.

`SimulationPhase` is presentation classification, not sufficient chronology.
An unlocatable error finding is an evaluator contract failure; it must not be
silently appended after located findings. The public `blockedAt` may remain the
deterministic representative owner for the first region. Do not add a persisted
blocking-region model merely to expose the internal ordering key.

Warnings at reached owners remain ordinary diagnostics and do not establish a
blocking horizon. This does not introduce any new warning policy; it prevents
the first-blocking mechanism from silently treating future warnings as errors.

Authoring and validation remain separate axes. An incomplete document whose
selected path becomes invalid earlier keeps its authored frontier, while its
route and biome status are invalid and its contextual coverage stops at the
earlier owner.

### Evaluation products

- A valid incomplete path publishes a materialized authored prefix plus its
  reached assessment products.
- An invalid complete or incomplete path publishes the full authored prefix,
  a clamped assessment prefix, the first blocked region, and exact repair
  capabilities.
- Only a complete-valid path publishes `CanonicalBiome`, final biome history,
  completion transition, and a downstream route seed.

The authored `ProjectDocument` remains the source for the retained suffix. A
complete-invalid evaluation does not need a canonical snapshot.

“One authority” means one published policy and one exact assembly, not a new
incremental execution engine. The evaluator may use its current complete
attempt and a bounded clamped replay to produce an invalid result. This work
does not have to make complete and prefix lifecycle folds resumable or reuse
mutable coordinators across those passes. The complete-valid path must retain
its current single canonical evaluation, and a later candidate query must not
start another selected-path evaluation.

### Candidate contact

Candidate consumers use the exact identity-attested assembly. Earlier reached
owners retain their capabilities, the blocked owner retains its repair
capability, and later owners report coverage unavailable.

Scoped alternative replay remains valid when it is the declared semantics of
the candidate itself, such as a proposed Hub visit order or joint producer
group. Re-running selected-path progressive evaluation merely to recover
omitted artifacts is not valid.

Trait offers are part of this rule. Their current repair path reads reached
traces from public reward branches. The blocked offer must instead retain an
opaque pre-offer candidate capability in the exact assembly. That capability
contains the branch-local trait histories and resolved offer contexts needed
to assess a proposed complete offer; it does not expose UI option models or
persist trait state.

Selected and alternative trait products remain distinct:

- the data-only evaluation publishes each reached selected offer assessment
  through the blocking region for the route Traits projection, selected
  findings, and replacement annotation; and
- the opaque candidate artifact evaluates a proposed replacement offer from
  the matching branch-local pre-offer facts.

`RewardBranch.traitEvaluations` currently mixes the first product into latent
reward state and carries prior-biome traces through every later biome. Gate B
normalizes reached selected-offer assessments as one biome-level data-only
product. Public reward branches retain only reachable reward/trait state and
events. Internal reward processing may retain local construction state, but it
must not make diagnostic traces part of branch identity or the downstream
route seed.

The public selected product is deliberately smaller than the current
`ReachedTraitOfferEvaluation`: it uses the exact `TraitOfferAddress`, retains
the authored offer, chronology, and branch-grouped assessments/composition,
and omits `TraitHistoryState` plus `TraitOfferContext`. Those pre-offer inputs
exist only behind the candidate artifact. Application projection may present
the selected assessment but cannot use it to assess a different offer.

### Run State

Decision Run State is an observer of the same selected-path coverage. Its
snapshots remain available through the decision containing the blocked value
and unavailable afterward. Once complete-invalid evaluation uses the generic
clamped result, the canonical-only
`runStateSnapshotsThroughCanonicalCoverage` repair path is removed rather than
retained as a second ordering policy.

### Workspace

The structured workspace starts from the full authored document and overlays
only reached evaluation products. Context-free biome completeness is computed
once in `WorkspaceBiomeSource` and passed to semantic and interaction
assembly. React receives authored structure, explicit coverage, findings, and
bound candidate interactions; it does not recompute validation.

Encounter control existence follows authored structure, not candidate reach.
The engine publishes a narrow context-free
`EncounterPhaseAuthoringDomain` (name illustrative) for each structurally
active set-backed phase: exact address, selected definition, declared set
members, and static default. It derives template-controlled activation from
persisted room/local-child state and owning authored decision facts such as a
Fields outcome. Candidate support decorates that domain when reached. A
structurally active unassessed phase remains visible with unavailable
contextual support; a genuinely dormant potential slot remains absent.

## Current implementation audit

### Finding A — encounter command authorization remains

The original finding is unchanged:

- `authored-project/commands/encounter-authorization.ts` defines the injected
  capability;
- `simulation/encounters/authorization.ts` binds it to the previous exact
  assembly;
- `authored-project/commands/dispatch.ts` requires it for encounter edits; and
- `projectWorkspaceSlice.ts` creates it before command application.

The occurrence command already owns all required structural checks. Delete the
authorization boundary.

### Finding B — complete-invalid publication remains split

`simulation/project.ts` still publishes encounter-blocked complete authorship
as prefix coverage, while generation-, reward-, and trait-invalid complete
authorship keeps a canonical snapshot, final history, complete coverage, and
all findings. Run State then applies a separate finding-order filter to that
full result.

Publish one generic complete-authored blocked-prefix result instead. Preserve
canonical products only for complete-valid paths.

Progressive `mergedFindings` also deduplicates by only finding code and origin.
Distinct trait or reward findings at the same semantic owner can carry
different evidence and currently collapse. Deduplicate by complete semantic
finding identity—code, severity, phase, origin, and structurally equal
evidence—before retaining every finding in the first atomic region. Evidence
comparison must use one deterministic recursive encoding; object identity or
insertion-order-dependent stringification is not a semantic equality rule.

### Finding C — candidate recovery reruns remain

Generic selected-invalid recovery still exists in:

- `candidates/evaluated-biome.ts`;
- `candidates/room-target.ts`;
- `candidates/reward-producer.ts`;
- `candidates/room-lifecycle.ts`; and
- `candidates/hub.ts` for exact blocked side-room recovery.

The candidate session also routes trait repair through `candidateBiome` and
public reward-branch traces. Route trait presentation and workspace replacement
annotation read those same traces directly, while the traces from validated
prior biomes are copied into later biome branches. The exact assembly must
publish all blocked-owner repair artifacts once, and selected reached-offer
assessment must become an explicit biome-level data product. Afterward these
recovery reruns and `completeInvalidSoleOwnerSource` are deleted.

Delete `hubRegionRepairForSideRoom` with the generic recovery paths. Retain
Hub-owned regional proposal evaluation only for evaluating an authored
alternative—Hub visit order, side-room generation, or side-room entry order—
where the replay is the bounded candidate contract itself.

The progressive encounter boundary also currently supplies the final valid
history checkpoint as a fallback for structurally retained later rooms.
`evaluateEncounterCandidates` can therefore publish candidate support and
findings for encounter phases the selected path never reached. Remove that
suffix fallback. Earlier reached rooms keep their exact preparation views and
an encounter-blocked room keeps its exact predecessor checkpoint; later rooms
remain authored but contextually unavailable.

### Finding D — invalidity does not outrank later incompleteness

An incomplete authored biome may carry prefix `blockedAt`, but route active
kind, route status, biome presentation, and workspace status still choose
incomplete from `authoring` alone. A reached contextual block must take status
precedence without deleting or hiding the later authored frontier.

Summary counts remain orthogonal: `incompleteBiomeCount` continues to count
authored incompleteness, while `invalidBiomeCount` also counts any reached
blocked evaluation. The same biome may contribute to both diagnostic counts.
User-facing project/route/biome status uses `invalid > incomplete > valid`
precedence; the counts are not a partition.

### Finding E — workspace completeness is recomputed

The planner currently calls `evaluateBiomeCompleteness` separately in biome
semantic assembly and in two topology-interaction paths. Compute it once while
constructing `WorkspaceBiomeSource` and pass the immutable product explicitly.

The source index already derives assessed-owner coverage from
`assessmentPrefix`, but `evaluatedBiomeOverlay` still reads the larger
`materializedPrefix`. Downstream retained rooms can therefore receive
canonical `entered`, batch, or room-local overlays while simultaneously being
classified as unassessed. Build evaluated overlays from the complete-valid
snapshot or the clamped assessment prefix only. Full downstream structure
continues to come from authored topology.

## Diagnostic boundary

The present production neighborhood is approximately 8,175 lines across the
project evaluator, progressive evaluator, completeness/materialization,
generic candidate recovery modules including traits, encounter authorization,
Redux publication, and workspace source/assembly. This is diagnostic evidence,
not a rewrite or line-count target.

Expected production movement is deletion-oriented:

- remove encounter authorization and command options;
- remove complete-canonical-invalid publication;
- remove generic candidate-side progressive recovery;
- add only the missing trait-offer repair capability and normalize the already
  public selected-offer assessment;
- remove the canonical Run State clamp helper; and
- consolidate workspace completeness acquisition.

Net growth requires an invariant that cannot be expressed through an existing
explicit product. Do not add a validation service, dependency container,
persisted assessment model, result-keyed sidecar, or shadow authored document.

The allowed new production surface is bounded to the encounter authoring
domain, trait assessment/artifact product, and internal blocking-region
locator. Reusing partial mutable history or reward coordinators, introducing
incremental simulation, or optimizing invalid-path traversal is outside this
correction.

## Delivery gates

Expected delivery is five reviewable commits, with a possible sixth only if
Gate B's publication and recovery deletion remain green as two local commits:

```text
Gate A                 1 commit
Gate B trait contact   1 commit
Gate B first blocking  1-2 commits, one delivery gate
Gate C                 1 commit
Gate D                 1 commit
```

### Gate A — context-blind encounter authoring

Suggested commit: `refactor(engine): decouple encounter authoring from evaluation`

Deliverables:

- delete `EncounterCommandAuthorization`, `ProjectCommandApplyOptions`, and
  `createEncounterCommandAuthorization`;
- simplify command history, Redux dispatch, and fixtures to the ordinary
  document/catalog/command boundary;
- retain static occurrence, local-child, slot, set, and encounter-definition
  checks;
- permit structurally valid inactive or context-invalid set selections;
- introduce one engine-owned context-free encounter authoring-domain query for
  structurally active set-backed phases, including template-controlled Ship
  and Fields activation without contextual eligibility;
- make workspace phase/control existence consume that authored domain rather
  than `EncounterPhaseCandidateSupport`;
- remove eager `encounterCandidateAt` plumbing and
  `encounterPhaseCandidateSupportForProjectEvaluationAssembly` contact from
  structured-workspace projection; lazy interaction evaluation remains the
  only consumer of contextual encounter support;
- keep declared choices and the selected/default value visible when candidate
  support is unavailable, while keeping truly dormant potential slots absent;
- retain evaluated candidate filtering in the visible editor; and
- keep stable authority documents unchanged until Gate D absorbs the completed
  contract.

Required evidence:

- structural set membership, fixed-slot rejection, dormant selection, reset,
  immutability, selected-invalid findings, Redux independence, and one UI
  filtering witness;
- active-but-unassessed encounter controls remain rendered with unavailable
  support and may persist any declared set member, while inactive Ship/Fields
  potential slots remain withheld;
- a reached phase still marks or withholds context-impossible alternatives
  through candidate presentation and retains its selected invalid value; and
- no production occurrence of `EncounterCommandAuthorization`,
  `encounterAuthorization`, or `ProjectCommandApplyOptions`; and
- `npm run test:engine` plus `npm run test:planner`.

### Gate B — exact trait contact and generic first-blocking publication

Suggested commits:

1. `refactor(engine): publish exact trait offer assessment artifacts`
2. `refactor(engine): stop validation at the first blocking region`

The first commit is a complete behavior-preserving trait vertical slice. The
second commit establishes the generic clamp and removes superseded recovery in
the same delivery. Do not land a clamped publication whose candidate repair
still depends on a second selected-path evaluation.

Deliverables:

- add `TraitOfferCandidateArtifacts` to `BiomeCandidateArtifacts`, with an
  exact-address lookup returning only an opaque `evaluateOffer(value)`
  capability;
- construct that capability from the branch-local `TraitHistoryState` and
  resolved `TraitOfferContext` already present when
  `evaluateReachedTraitOffer` runs;
- capture branch-local selected assessments and alternative capability inputs
  before equivalent post-state branches can merge, so existential support and
  divergent invalid evidence are not flattened;
- have the candidate session pass the exact trait artifact to
  `evaluateTraitOfferCandidate`; do not let the candidate evaluator recover
  context from public branches;
- publish reached selected-offer assessments once at biome-reward level,
  addressed by exact `TraitOfferAddress` with one branch-grouped product that
  preserves distinct branch evidence;
- use an explicit data-only field such as
  `BiomeRewardSimulation.selectedTraitOffers`; do not hide the product in an
  identity-keyed sidecar or candidate capability;
- replace the public `ReachedTraitOfferEvaluation` shape with a selected
  assessment that omits pre-offer histories and resolved contexts; keep those
  inputs private to `TraitOfferCandidateArtifacts`;
- update route Traits projection and workspace replacement annotation to
  consume the biome-level selected assessment;
- remove public `RewardBranch.traitEvaluations` and stop copying prior-biome
  assessment traces into downstream reward branches; preserve downstream
  `traitHistory` and ordinary reward state unchanged;
- replace encounter-specific and canonical-invalid result variants with one
  generic complete-authored blocked-prefix result;
- use declared chronology and lifecycle phase to identify the earliest region,
  independent of subsystem finding-array order;
- implement that ordering as one evaluator-internal location product over the
  existing materialized/history products, not as a second lifecycle walker or
  a new field on `SemanticFinding`;
- have each aggregate evaluator attach only its owned atomic-region key while
  producing findings; do not recover aggregate ownership later from finding
  codes or UI grouping;
- retain every finding co-owned by that first atomic region and no later
  finding;
- preserve distinct same-owner findings by code, severity, phase, origin, and
  deterministic structural evidence rather than code-plus-origin
  deduplication;
- publish full authored prefix separately from the clamped assessment prefix;
- capture room, reward, lifecycle, encounter, and trait repair capabilities
  during that exact selected-path evaluation;
- remove the final-prefix fallback that evaluates encounter phases in later
  structurally retained rooms; retain only exact reached preparation views and
  the first encounter-blocked room's predecessor checkpoint;
- delete generic selected-invalid calls to progressive evaluators from
  candidate consumers and delete sole-owner fallbacks;
- delete `hubRegionRepairForSideRoom`, while retaining `hubRegionEvaluation`
  and `hubVisitOrderEvaluation` only for proposed Hub/side-room alternatives;
- simplify `candidateBiome` to select an already-published complete-valid or
  prefix evaluation without catalog, project, or selected-path re-evaluation;
- retain only declared scoped alternative replay;
- make invalidity outrank a later incomplete frontier in active route, route,
  project, biome, and workspace status;
- preserve orthogonal summary counts so an incomplete-authored blocked biome
  contributes to both incomplete and invalid diagnostics;
- remove the canonical-only Run State clamp helper; and
- preserve complete-valid results and execution inputs unchanged.

Required evidence:

- early room, reward-store, incoming reward, encounter, Shop, wheel, Hub,
  side-room, and trait failures all stop at their lifecycle-earliest region;
- a multi-finding invalid trait offer retains the complete offer-owned finding
  group, one reached selected assessment, and repair from the exact pre-offer
  trait histories;
- same-code trait findings for different option/evidence values remain
  distinct while exact duplicates collapse deterministically;
- valid trait rows, replacement annotations, cross-biome chronology, and
  Proper Upbringing behavior remain unchanged after removing branch-carried
  assessment traces;
- no later trait, reward, encounter, Run State snapshot, or candidate capability
  is published;
- a later authored encounter selection remains visible but reports coverage
  unavailable and emits no selected finding until the earlier block is fixed;
- an earlier invalid value in an incomplete plan reports invalid while keeping
  its authored frontier, and the later completeness finding is not published
  as reached validation truth;
- valid F seeds invalid G, while invalid F blocks G without G findings;
- complete-valid route golden fixtures and execution-eligibility summaries are
  unchanged;
- an architecture test rejects progressive-evaluator imports from generic
  candidate consumers; no production observer or runtime audit is added; and
- engine, planner, contract, and product lanes pass.

### Gate C — explicit workspace authoring/evaluation composition

Suggested commit: `refactor(planner): share one biome authoring frontier product`

Deliverables:

- add the context-free completeness product to `WorkspaceBiomeSource`;
- pass it to semantic and topology-interaction assembly;
- remove consumer-side completeness recomputation;
- render complete-authored blocked results through progressive overlays;
- build progressive `evaluatedBiomeOverlay` from `assessmentPrefix` when one
  exists, never from the larger retained authored materialization;
- preserve authored downstream controls as visible and unassessed; and
- keep the invalid blocked owner finding and repair interaction navigable.

Required evidence:

- one completeness acquisition per workspace biome source, enforced by an
  import/ownership test rather than production call counting;
- no React or Redux duplication of completeness or coverage;
- blocked suffix controls stay authored and editable;
- retained downstream rooms receive no canonical `entered`, physical-state,
  clockwork, or room-local evaluation overlay;
- source-index closure rejects evaluated owners after coverage; and
- planner, UI, contract, and product lanes pass.

### Gate D — closure and authority absorption

Suggested commit: `docs(architecture): absorb first-blocking validation contract`

Deliverables:

- reconcile the stable authorities at their exact ownership points:
  `AUTHORED_PROJECT_MODEL.md` for structural command acceptance,
  `SIMULATION_AND_VALIDATION.md` for the complete-valid/blocked-prefix union
  and Run State coverage, `CANDIDATE_EVALUATION_MODEL.md` for exact trait and
  blocked-owner artifacts, `ARCHITECTURE.md` for the one published assembly,
  and the editor/workspace documents for authored-first status and overlays;
- correct stale schema wording encountered in those touched sections;
- run the complete repository gate;
- inspect the final production diff for deletion of superseded paths; and
- retire this temporary document.

## Primary test ownership

Keep each matrix with its owning authority; integration suites retain only
representative contact witnesses.

| Contract                                                             | Primary owner                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Encounter command structural acceptance                              | `authored-project/commands/occurrence-encounter.test.ts`  |
| Earliest region, grouped findings, assessment clamp                  | `progressive-biome.test.ts`                               |
| Complete-valid versus complete-blocked result union and route status | `project.test.ts`                                         |
| Trait selected assessment and exact alternative artifact             | trait/reward engine tests and `candidate-session.test.ts` |
| Reward, lifecycle, room, encounter, and Hub blocked-owner repair     | existing family candidate suites                          |
| Run State availability through the blocking decision                 | `run-state.test.ts`                                       |
| Biome/route/project status copy                                      | `evaluationProjection.test.ts`                            |
| Authored-first overlay and one completeness source                   | source-index and structured-workspace assembly tests      |
| Full retained-authoring repair workflow                              | one Underworld and one Surface product-loop witness       |

Do not copy the complete room/reward/encounter/trait policy matrices into
product-loop or React tests.

## Non-goals

This work does not:

- change Hades II eligibility, reward, encounter, trait, Hub, Shop, detour, or
  lifecycle rules;
- add progressive candidate filtering inside the trait modal beyond consuming
  the corrected exact artifact;
- lock or truncate prior authored decisions;
- change the project schema or migrate beta profiles;
- add incremental simulation, workers, eager candidates, or persisted derived
  state;
- reorganize unrelated simulator authorities; or
- change the game integration or release workflow.

## Final acceptance

```text
semantic command + document + catalog
  -> structurally valid immutable ProjectDocument

ProjectDocument + catalog
  -> one selected-path evaluation assembly
      -> valid incomplete frontier and continuation capabilities
      -> or first invalid region and exact repair capabilities
      -> or complete-valid canonical result and route seed

ProjectDocument + matching assembly
  -> authored workspace with reached evaluation overlays
```

Before closure:

```text
npm run test
npm run check
```

Review must verify that encounter authorization, complete-invalid canonical
publication, canonical-only Run State filtering, and generic selected-invalid
re-simulation are absent rather than merely bypassed.
