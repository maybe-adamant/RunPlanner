# React/Application Boundary Audit

## Status

This is an isolated working audit for the post-re-anchor React/application
boundary correction. No README, implementation tracker, or stable design
document links to it while the work is provisional. When the correction is
closed, durable rules are absorbed into their owning design documents and this
file is deleted.

Audit baseline: clean `12177d0` after Campaigns C and D. The complete repository
gate at that baseline passes 95 test files and 771 tests, together with every
workspace typecheck, lint, formatting, and the production build.

## Question

The editor was intended to be a React presentation over application-projected
engine products. This audit asks:

1. where React still reconstructs engine or application policy;
2. whether semantic-address resolution is explicit or coupled to incidental
   object shape;
3. whether the UI-facing command boundary is already sufficient;
4. whether UI-facing interactions expose engine detail that no UI consumer
   uses;
5. where application projections reconstruct engine-owned authored or
   materialized facts before React receives them;
6. what the smallest correction is without creating a command framework,
   dependency container, or another reorganization campaign.

The acceptance target is a smaller change neighborhood for a new editor
interaction. File length and the absence of engine imports from React are not
targets by themselves.

## Current Flow

The live production path is:

```text
ProjectDocument + ProjectEvaluationAssembly
  -> WorkspaceProjectSourceIndex
  -> per-biome semantic assembly
  -> presentation + interaction requirements
normalized Catalog + ProjectEvaluationAssembly
  -> application candidate session
  -> engine candidate evaluation
normalized Catalog reward declarations + selected reward
  -> application complete-offer enumeration and picker grouping
interaction requirements + candidate/application services
  -> project-wide interaction binding
  -> StructuredWorkspaceProjection
  -> React control
  -> ProjectCommand Redux action
  -> authored command/history transition
  -> replacement ProjectEvaluationAssembly
```

The boundary is already substantially healthier than it was before Campaign
A. `WorkspaceProjectSourceIndex` owns authored/evaluated lookup, semantic
assembly owns projected controls, presentation owns inspector destinations,
and `WorkspaceInteractionCatalog` owns lazy contextual candidate access.
`focusByOwner` is an explicit semantic-address-to-inspector map. React does not
walk authored topology, calculate removal impact, evaluate candidates during
render, or invoke the simulator.

Current diagnostic sizes are:

| Area                                 | Production lines | Role                                                                  |
| ------------------------------------ | ---------------: | --------------------------------------------------------------------- |
| React `src/ui`                       |            4,126 | rendering, transient interaction, Redux dispatch                      |
| candidate/reward picker projections  |            1,448 | candidate adaptation, reward domains, picker presentation             |
| structured-workspace production      |            7,425 | source indexing, semantic assembly, presentation, interaction binding |
| structured-workspace colocated tests |            4,362 | producer and contract ownership                                       |
| React colocated tests                |            3,555 | visible interaction and component witnesses                           |
| planner cross-layer tests            |            3,939 | architecture and product-loop boundaries                              |

These counts are evidence about change neighborhoods, not split quotas.

## Finding 1: Evaluated-owner coverage is coupled to object shape

`source-index.ts` currently computes assessed semantic owners by:

1. accepting a materialized evaluation product as `unknown`;
2. recursively traversing every array and `Object.values` member;
3. recognizing address-shaped objects with a local `isSemanticAddress` switch;
4. treating every recognized nested address as assessed.

This is a real boundary defect. The local recognizer repeats the complete
semantic-address vocabulary and only shallowly validates nested source shapes.
Coverage therefore depends on where an address happens to be nested in a
canonical object, rather than on a named evaluation-to-workspace mapping. A new
address kind or a canonical-product reorganization can silently change UI
assessment without changing any workspace contract.

The error is concrete, not only prospective. A clamped Hub
`targetLifecycle` frontier deliberately retains its canonical target so the
engine can describe the stopped visit, while its published coverage ends
`beforeTargetGeneration`. The reflective walk nevertheless discovers the
nested target, room, and incoming-reward origins and marks them assessed. The
workspace must instead respect the engine's explicit prefix checkpoint and
frontier phase.

This is not principally a React problem. It is hidden coupling in the
application adapter immediately before React.

### Required correction

Replace reflective discovery with one typed evaluated-owner coverage product.
It belongs beside `WorkspaceProjectSourceIndex` because its purpose is to map
engine evaluation entities to application semantic owners. It may index only:

- exact semantic owners explicitly present in a canonical biome or materialized
  prefix;
- the declared evaluation checkpoint and explicit prefix phase needed to
  distinguish assessed from unassessed authored owners.

Finding ownership remains a separate feedback index. Assembly may combine a
finding with coverage when choosing visible marker assessment, but findings do
not become evidence that the evaluator reached an owner and must not be folded
into the typed coverage product.

It must not become:

- a second authored topology model;
- a generic object walker;
- a production closure manifest;
- a recreation of history, reward, lifecycle, or candidate policy.

If the typed application mapping cannot determine coverage without
reconstructing one of those engine policies, implementation stops and adds a
genuine explicit coverage fact to the engine evaluation product instead. It
does not restore reflection under a different helper name.

### Deletion and evidence

The correction deletes `isSemanticAddress` and `assessedAddresses`. Focused
source-index fixtures own complete and progressive evaluated-owner mapping,
including ordinary targets, Hub visits/local children, dormant authored state,
the clamped Hub `targetLifecycle` false-positive, and a retained owner beyond
the prefix. They separately prove the finding-to-visible-assessment override.
Assembly tests retain representative assessment witnesses rather than copying
the mapping matrix. The evaluated-owner correction deliberately fixes the
clamped-prefix false positive; it does not mechanically preserve every result
of the current reflection.

## Finding 2: Interaction binding stops before command binding

The structured workspace exposes nineteen address-keyed interaction maps.
Candidate loading, selected values, choices, removal commands, takeover command
factories, and repair commands are application-bound. Most ordinary commands
are not: production React currently constructs 27 of the 34 `ProjectCommand`
variants across six component files.

Not every command literal is a defect. `RenameProject`,
`ConfigureRoutePrefix`, and a declaration-projected `ReplaceBiomeField` are
direct UI value-to-command mappings and contain no hidden policy. The engine's
`ProjectCommand` union is deliberately a UI-facing semantic API; React does not
need to be purged of domain value types merely for layering aesthetics.

The defect appears where a projected interaction is only partially bound and
React must finish it. Current examples include:

- switching reward-owner kinds into four different replacement commands;
- allocating occurrence identities for starts, missing targets, linked exits,
  and Hub slots;
- reconstructing a new occurrence address solely to establish post-creation
  focus;
- choosing append versus replace for a Hub visit from projected authoring
  state;
- translating structural-frontier capabilities back into command variants;
- interpreting takeover `selectedPossible` in React even though the bound
  command factory repeats that applicability check;
- resolving some removal and repair controls as bound commands while adjacent
  controls receive only owners and values.

This makes the interaction contract asymmetric. Adding a new contextual
control can require editing candidate projection, workspace binding, a React
component, and component-level command tests even when the visible control is
generic.

### Required correction

Complete command binding first where React currently finishes semantic policy
for a control that already crosses the structured-workspace interaction
boundary. Each migrated executable/editable interaction returns either:

- a command intent for a direct action; or
- an `intentFor(value)` capability for a candidate or picker choice.

A command intent contains the one engine `ProjectCommand` and, only where the
interaction owns navigation behavior, a declared focus owner and timing.
Redux dispatch currently exposes no transition-success result, so the contract
must not promise "focus after a successful command." For ordinary creation,
the adapter may dispatch first and then apply declared focus. An after-timed
focus action is dispatched unconditionally after the command. If a command
produces no authored transition, the current projection's `focusByOwner` is
still resolved by `BiomeWorkspace`, and its existing unresolved-owner fallback
applies when necessary. The adapter neither reads that map nor infers command
success. Hub opening and closing preserve their existing explicitly
pre-command focus timing. Existing removal and repair focus behavior stays
unchanged. Authored removals remain immediate and unconfirmed;
undo/redo is their recovery mechanism. Confirmation is reserved for genuinely
irreversible external actions such as deleting a file or profile, not ordinary
authored commands. React remains responsible for invoking the intent through
Redux and for transient widget state. The projector never receives Redux
dispatch and bound interactions never mutate the project.

The required migration covers controls where React currently:

- selects among reward-owner command variants;
- allocates occurrence identities or reconstructs creation-focus owners;
- distinguishes target creation from room replacement;
- translates structural-frontier or takeover capabilities into commands; or
- chooses Hub append, replace, remove, open, close, or creation behavior from
  projected state.

Mechanical owner-plus-value mappings such as encounter counts, reward-wheel
settings, Shop purchase booleans, Fields outcomes, exit selection, and ordinary
room replacement are a conditional continuation, not part of the minimum
correction. They move only if the first command pilot demonstrates a smaller
change neighborhood rather than another wrapper and command-shape copy.

Semantic assembly supplies the facts needed to bind a migrated policy-bearing
interaction: its exact owner, existing action/capability discriminant,
candidate or availability evidence, and any catalog-owned value already needed
by the product. Do not introduce a second action union or fields whose only
purpose is to mirror `ProjectCommand` before reconstructing it one layer later.
In particular:

- a Hub visit requirement explicitly distinguishes `append` from `replace`
  and separately declares whether the existing visit owns removal;
- target requirements distinguish an existing occurrence from a missing target
  without asking binding to traverse topology;
- structural and Hub creation requirements expose the capability and exact
  owner needed for lazy identity allocation.

Semantic assembly remains the owner of whether a control exists. Interaction
binding owns command completion when application policy remains to be bound.
An interaction that already carries one complete engine command, such as the
current removal or repair products, need not be decomposed and rebuilt merely
for uniformity. It may be wrapped in a command intent at the interaction
boundary while unused impact shadows are deleted independently.

Project rename and route-prefix configuration remain simple shell bindings.
`ReplaceBiomeField` also remains a direct declaration-projected UI mapping: it
is not in the structured interaction catalog and contains no hidden policy.
None of those direct bindings justify a project-wide interaction registry.

### Semantic identity injection

Occurrence identity allocation is a real application collaborator. The
composition root injects one narrow `OccurrenceId` factory into structured
command binding, rather than adding it to the contextual-picker service bundle.
Production uses the existing UUID allocator; tests may inject deterministic
identities. The same factory reaches takeover command construction, which also
creates missing target identities today. React no longer imports or calls
`allocateOccurrenceId`.

Allocation is lazy: projection construction, React render, and ordinary
candidate loading must not consume identities. A Hub-slot capability creates
one provisional identity when its opening interaction first activates, then
uses that same identity for both candidate evaluation and the eventual
`OpenHubSlot` intent. It caches one stable candidate-plus-intent interaction
object for that opening attempt, so the existing lazy-interaction cache does
not see a fresh identity on a retry. A fresh ID at either point would make the
candidate and the authored command describe different proposed states.

An opening attempt begins through explicit widget activation and ends when
React cancels it or receives a replacement projected interaction. React keeps
that capability only as transient widget state; it neither allocates nor
rebinds an attempt during render. A no-op command leaves the current attempt
intact because Redux publishes no transition-success result.

This is explicit dependency injection through construction. It does not
justify tsyringe, decorators, a service locator, a mutable dependency table, or
a universal command bus.

### Dispatch shape

A single small React adapter may dispatch a bound command intent and then apply
only the intent's explicitly declared focus behavior. It is analogous to the
existing lazy interaction hook: it centralizes Redux plumbing, not semantic
policy. Command handlers and history remain in the authored core and Redux
reducer.

Interaction binding remains a sibling of presentation. Bound functions are not
inserted into the semantic assembly or used to decide whether a node/control
exists.

### Focus-timing equivalence

Command intent carries focus only when the current interaction deliberately
changes navigation. Binding and the common adapter preserve this complete
behavior matrix:

| Interaction family                                                                     | Timing   | Focus owner                     |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------- |
| start creation                                                                         | `after`  | newly allocated occurrence      |
| missing-target creation                                                                | `after`  | existing target                 |
| linked-exit creation                                                                   | `after`  | newly allocated occurrence      |
| normal-batch creation                                                                  | `before` | existing exit-decision frontier |
| Hub-board creation                                                                     | `before` | existing Hub-decision frontier  |
| Hub-slot open or close                                                                 | `before` | existing Hub-slot owner         |
| takeover create/replace/repair and completed Hub handoff                               | `before` | existing exit-decision owner    |
| topology removal and batch-capacity repair                                             | `before` | existing removal/repair owner   |
| value replacement, exit selection, Hub visit append/replace, and `RemoveHubVisitsFrom` | none     | unchanged                       |

The matrix is behavioral preservation, not a proposed navigation redesign.
For migrated intents, the interaction-adapter test is the primary owner of
ordering. Focused React tests retain representative before, after, and no-focus
witnesses, including any intentionally retained direct value mapping.

## Finding 3: A few controls and the biome shell recover typed owners from generic markers

The address maps themselves are appropriate. `focusByOwner` and the interaction
catalog are the explicit mapping layer previously sought; replacing them with
direct topology access or embedding bound functions throughout the node tree
would be a regression.

React currently narrows generic marker addresses back into:

- `TargetAddress`;
- `ExitSelectionAddress`;
- `BatchRewardStoreAddress`;
- `HubVisitAddress`.

Target and Hub-visit narrowing are product-typing gaps because their required
policy-bearing interactions already have exact semantic owners that binding
must preserve. Exit-selection and batch-reward-store narrowing are bounded
owner-plus-value mappings; they are cleanup opportunities only if D2 proves
worthwhile. The biome workbench also recovers its containing biome from the
generic biome marker while scoping a global focus owner. That is a separate
presentation typing gap, not an editable-control migration. The correction
gives `WorkspaceBiome` an explicit typed biome owner for that scope check.

Creation focus is also narrower than the initial inventory implied: starts and
linked exits need a newly created occurrence owner, while missing-target
creation intentionally focuses its existing `TargetAddress`. Bound intents
should model those cases precisely rather than reconstructing an occurrence
address generically.

This does not warrant making every `WorkspaceMarker` generic or replacing the
global interaction maps. Exact editable owners belong on semantic requirements
and bound interactions where command construction consumes them. Binding must
not discard an exact target or Hub-visit owner and replace it with a coarser
marker-derived owner during the required policy migration. Do not duplicate
those owners onto render nodes after bound command intents remove React's need
for them. `WorkspaceBiome` is the deliberate exception: React still compares
its containing biome with global semantic focus, so the render product receives
one explicit `BiomeAddress`.

Delete target and Hub-visit narrowing with C2 and C4. Exit-selection and
batch-reward-store narrowing disappear only if D2 is approved; their bounded
owner-plus-value mappings do not independently justify that optional migration.
Use the explicit biome owner for focus scoping, and take creation focus from
the bound command intent.

## Finding 4: UI-facing removal interactions retain unused impact shadows

React does not calculate deletion closure, which is the correct boundary. The
current UI-facing contracts nevertheless expose application-level impact
projections of that closure:

- `WorkspaceTopologyRemovalScope` on clear-topology and decision-removal
  interactions;
- the same scope on Hub-slot closure;
- `WorkspaceTakeoverReplacementImpact` on takeover replacement;
- removed decision and occurrence arrays on batch repair scopes.

Production React reads none of those impact values. It uses the control's
interaction kind, label, enabled state, semantic owner, and command. The engine
recomputes the authoritative impact from the current authored topology when it
applies a removal, closure, replacement, or repair. The projected copies
therefore provide neither execution safety nor visible behavior; they make a
production product carry exhaustive evidence primarily for application tests.

### Required correction

Contract the UI-facing products to the facts their consumers use:

- a bound command intent or value-to-intent capability;
- the semantic owner and declared focus behavior;
- candidate or availability evidence required to render the control;
- only the removal/repair presentation classification needed for visible
  styling and wording.

React may render a removal control with a distinct danger treatment such as its
existing red styling. It does not need the removed descendant identities to do
so and must not infer presentation by switching over raw command variants. A
dedicated removal interaction already supplies sufficient classification; a
small explicit presentation field is warranted only where one shared control
cannot otherwise distinguish removal from repair or replacement.

An authored replacement or repair is not styled as removal merely because its
atomic engine transition incidentally drops invalid or superseded descendants.
The interaction's primary user intent determines its presentation. All of
these authored actions remain immediate and undoable; this correction does not
add confirmation dialogs.

Engine impact descriptions, application of those impacts, and their complete
closure matrices remain with planner-engine tests. Current assembly already has
the facts needed to decide decision/slot existence and unavailable-target repair
availability, so this correction deletes the application impact calculations,
adapters, and witnesses outright. It does not retain a conditional private
impact path merely in case a future control might need one. A genuinely new
availability need would be a separately justified engine-facing change, not a
reason to preserve a shadow product now.

## Finding 5: Application projections reconstruct a bounded set of engine-owned facts

Strict React does not otherwise reproduce topology, lifecycle, reward
simulation, or candidate eligibility. One substantial reconstruction and three
smaller remnants do exist in the application projections immediately below
React. These are bounded cases, not evidence that every projection over a core
union belongs in the engine.

### Reward producer store and complete-offer domains

`candidateProjection.ts` resolves a counted reward producer's active store by
walking canonical or progressive decisions, then falling back through authored
topology, occurrence state, room declarations, fixed side-room declarations,
reward-wheel state, and batch reward-store state. It repeats core precedence
such as declaration-forced store, individual store, and batch-store fallback,
but it does so incompletely. Its authored fallback omits the `sourceOfferPoint`
policy used by Ship sources and does not carry a later forced target store back
across the physical batch. It also owns an independent canonical-tree lookup
solely to find the evaluated producer by semantic address. This is an attempted
application reimplementation of engine store resolution, not a harmless
presentation adaptation.

`rewardDomainProjection.ts` then constructs every locally complete reward offer
from reward-type and payload-domain declarations: payload-free offers, every
single source, and every ordered distinct Devotion pair. This is the inverse of
the reward kernel's local payload validator. Its `sourceValues` and
`payloadDomain` helpers also independently interpret the same source and pair
structure to construct picker choices. The application must group and present
complete offers, but it should not independently define which complete domain
values are legal.

The required core boundary is narrow:

- simulation/rewards resolves the counted producer's current store and
  declaration-ordered selectable reward-type domain for an exact semantic
  owner, using evaluated facts when available and its complete authored
  fallback when they are not;
- reward-kernel enumerates locally valid complete offers for one reward type
  from the normalized payload-domain declaration;
- the application retains a known locally valid selected type that is outside
  its current store domain for repair, evaluates complete offers through the
  existing candidate session, and derives Type, Source, Chosen, and Spurned
  picker groups only from those returned offers;
- React retains transient multi-step picker state and rendering.

The counted-producer query belongs under simulation/rewards, not reward-kernel:
it accepts only the normalized `Catalog`, exact `ProjectEvaluationAssembly`, a
core incoming/local/wheel reward address, and its `CountedRewardBinding`. It
resolves the store internally and returns the selectable type domain needed by
candidate preparation; its store key is exposed only if a real consumer needs
it. It does not accept workspace sources, presentation products, picker state,
or the application-owned `CountedRewardCandidateOwner` wrapper. The query must
cover evaluated-store preference, `authoredBaseStore`, `sourceOfferPoint`,
individual and forced stores, and final shared-store precedence across a
physical batch. A later forced target updates the shared store used by earlier
ordinary peers, while an individual target override remains local. Selected-
invalid retention remains an application composition step over the returned
declaration-ordered domain.

The complete-offer query belongs in reward-kernel and accepts a
`RewardKernelCatalog` plus one normalized reward type. It does not know the
selected owner, project evaluation, or candidate session. In particular,
reward-kernel must not import simulation or `ProjectEvaluationAssembly`; the
existing engine direction is simulation consuming reward-kernel, not the
reverse.

Do not move contextual grouping, candidate explanations, presentation witness
selection, or picker copy into the engine. Do not expose candidate artifact
internals or add a generic editor-domain service. Add the smallest pure core
queries/products that correct and displace the duplicated store and complete
offer rules.

### Fields batch facts and target continuation

`fields-cage-counts.ts` repeats part of the materializer's Fields algorithm:
start from the biome maximum, clamp through target cage capacity, apply the
authored Min/Max outcome, and publish an active cage count. Decision assembly
separately derives the Fields target count. Those copies are not equivalent:
materialization counts only authored `FieldsCombat` targets and makes takeover
batches standard before Fields calculation, while workspace currently reasons
from any bounded-slot declaration without that takeover rule.

The workspace genuinely needs these facts for retained authored batches that
have no canonical materialization, but it must consume one pure engine-owned
`FieldsBatchFacts | undefined` derivation shared with materialization rather
than reimplement any portion. The complete fact contains the selected outcome,
batch capacity, Fields target count, and active door-cage reward count. The
workspace maps its decision and occurrence views from that one fact.

`decision-assembly.ts` also reconstructs the canonical continuation rule when
no evaluated target overlay exists: a picked Preboss starts completion, another
picked room continues the selected spine, and an unpicked room is a dead leaf.
A canonical target with an unavailable physical exit remains authoritative for
this purpose. The ordinary-target fallback repeats the whole rule, while the
linked-target fallback currently hard-codes `continuesSpine`. Move both behind
one pure engine query used by materialization and every authored workspace
fallback.

The Fields derivation receives the normalized catalog/layout facts, one exact
authored batch, and its occurrence lookup; it owns the target-template and
takeover classification rather than receiving a workspace classification. It
does not receive `WorkspaceBiomeSource`. The continuation derivation receives
only the target's picked state and room kind. These deliberately small inputs
keep both helpers below workspace assembly and prevent a new editor-shaped
engine read model.

These helpers return domain facts, not workspace nodes, labels, or interaction
packages. Their introduction must delete the matching application algorithms
in the same vertical slice.

Canonical simulation behavior is unchanged, but retained/fallback workspace
presentation is intentionally corrected. Characterization must cover a mixed
batch containing a takeover target, a bounded-slot declaration that is not the
`FieldsCombat` template, an unpicked Preboss target, and a linked Preboss
target. The shared engine derivations then define the corrected workspace
result for those cases rather than preserving the current divergent output.

### Redundant occurrence-state validation

`occurrence-assembly.ts` revalidates declaration-owned persisted schema
coherence before projecting active or dormant room details: exact Ephyra side
slots, Fields cage declarations, Ship encounter profiles, and declared reward
wheels. The authored codec, defaults, commands, and simulator already own those
invariants, and the structured projector accepts an exact engine-produced
`ProjectEvaluationAssembly`.

Delete the projection's exhaustive `assertOccurrenceStateCoherence` path and
move any unique malformed-state witnesses to the owning codec, default, or
command tests. Keep genuine product-contact assertions—for example, an
evaluated target paired with a different authored occurrence, duplicate
semantic owners, or a required projected control missing from its containing
product. Those protect application-stage contact rather than revalidating the
engine's complete input schema. This deletes only the preflight exhaustive
assertion: it does not indiscriminately delete later declaration lookups that
are needed to construct a concrete Ephyra, Ship, or Shop control. A4 must
classify each remaining check as required product contact or redundant schema
validation before removing it.

### Cases that remain application or React authority

The correction does not move the following into the engine:

- candidate support wording, explanations, and possible/impossible/forced
  presentation;
- grouping options into contextual picker sections;
- reward picker steps and aggregate presentation witnesses;
- room-category labels and declaration-domain grouping;
- finding copy and destination labels;
- authored `detailsActive` classification for optional picked-room editing
  surfaces;
- exhaustive rendering and semantic-address identity lookup.

## What React legitimately continues to own

The following are not audit findings:

- exhaustive rendering of the projected `WorkspaceNode` and room-local unions;
- labels, status phrases, CSS state, responsive composition, and accessibility;
- transient picker steps, drafts, open state, pending state, and cancellation;
- generic possible/impossible/forced candidate presentation;
- semantic focus dispatch and lookup through `focusByOwner`;
- the bounded comparison of an explicit biome owner with a globally focused
  owner before rendering one biome;
- direct declaration-projected biome-field value mapping;
- `semanticAddressKey` for stable component and mapping identity;
- direct imports of immutable domain value types used by public projection
  contracts;
- removal, repair, and ordinary-control visual treatment based on explicit
  projected presentation or interaction families;
- immediate invocation of undoable authored removal commands without a
  confirmation dialog;
- the two simple shell commands for project rename and route-prefix length;
- Redux as the coordinator for authored history and fresh evaluation.

Large React components may deserve later presentation extraction when a
feature change demonstrates an independent component responsibility. This
audit does not split them merely because it touches them.

## Gated Delivery Plan

The audit is one diagnosis, not one indivisible refactor. Delivery is divided
into independently closable gates. Passing one gate does not authorize the
next: each checkpoint reviews actual deletions, production growth, test
ownership, and the resulting change neighborhood before more migration begins.

### Gate A: Engine and application authority corrections

#### A1: Explicit evaluated-owner coverage

- add the typed evaluation-to-owner mapping beside the source index;
- migrate `isAssessed` to that product;
- delete reflective address recognition and object walking;
- move the full coverage matrix to the mapping's focused tests;
- preserve intended complete, prefix, Hub, finding, blocked, and retained-owner
  behavior while correcting the clamped `targetLifecycle` false positive.

This is independently useful and does not change command or React code.

#### A2: Engine-owned reward authoring domain

- add the narrow reward-kernel query that enumerates locally valid complete
  offers for one normalized reward type from `RewardKernelCatalog`;
- add the narrow simulation/rewards query that resolves one counted producer's
  selectable reward-type domain at its exact semantic owner, using evaluated
  facts or the complete engine-owned authored fallback;
- cover evaluated-store preference, `authoredBaseStore`, `sourceOfferPoint`,
  individual and forced stores, and final shared-store precedence across a
  physical batch; explicitly correct the current incomplete app fallback;
- make candidate projection consume the simulation/rewards product and make
  reward-domain projection derive its picker groups from reward-kernel's
  returned complete offers;
- delete `authoredRooms`, `materializedBiome`, `resolvedCountedStoreKey`,
  `countedRewardTypeDomain`, `completeOffers`, `sourceValues`, and the
  declaration-domain enumeration branches they displace; refactor
  `payloadDomain` into presentation grouping over returned complete offers
  rather than a second legality derivation;
- preserve known locally valid out-of-store type retention, lazy complete-offer
  candidate evaluation, Type/Source/Chosen/Spurned grouping, and existing work
  counts.

The core queries return domain values, not picker sections or React copy. Their
tests own complete store precedence and locally valid payload-domain
enumeration; application tests retain grouping and out-of-store retention
witnesses. The store matrix includes incoming, local, and wheel owners;
evaluated preference; `authoredBaseStore` and `sourceOfferPoint`; local
individual and forced stores; and a target before a later forced target.
It also proves that obtaining the synchronous type domain does not evaluate
candidates. The counted-producer query uses only catalog, exact evaluation
assembly, core reward address, and counted binding inputs; no workspace or
application owner type crosses into planner-engine. It returns no candidate
artifact and exposes its resolved store key only if a real consumer needs it.
Reward-kernel never receives project evaluation or imports simulation.
The simulation query must reuse or factor the engine's existing producer/store
resolution path; it must not introduce a second full canonical/authored tree
walk beside candidate evaluation. If the narrow product cannot be obtained
without that duplication, A2 stops for an engine-boundary redesign rather than
expanding this audit.

#### A3: Shared decision-derived engine facts

- introduce one pure engine-owned `FieldsBatchFacts | undefined` derivation,
  including selected outcome, capacity, Fields target count, and active
  door-cage reward count, used by both materialization and retained-authored
  workspace projection;
- make that helper own Fields-target and takeover classification, so it resolves
  the existing materializer/workspace predicate divergence;
- introduce one pure engine-owned target-continuation query used by both
  materialization and workspace fallback from only picked state and room kind;
- delete both matching Fields calculations and the continuation algorithms from
  application assembly in the same slice;
- characterize and intentionally correct retained workspace behavior for mixed
  takeover batches, non-Fields bounded slots, unpicked Preboss targets, and
  linked Preboss targets;
- retain representative workspace witnesses for inactive/retained Fields
  cages and target path presentation without copying the engine matrices.

This unit does not change authored state or canonical simulation. It does
intentionally align retained workspace facts with the canonical authority, so
its visible corrections are reviewed as characterized behavior changes rather
than mechanical preservation. It must not return workspace nodes or create an
editor-specific engine read model. The shared helpers consume the narrow
catalog/layout/batch/occurrence or picked-room facts named in Finding 5, not
`WorkspaceBiomeSource` or mutable materialization context. A canonical target
overlay remains authoritative even when its physical exit is unavailable; the
continuation helper is used only when that overlay is absent.

#### A4: Occurrence schema-validation contraction

- delete `assertOccurrenceStateCoherence` and projection tests whose only
  purpose is to feed forged malformed room state into occurrence assembly;
- verify that the exact Ephyra-slot, Fields-cage, and Ship-wheel invariants
  preflighted by the removed assertion each have a primary codec, default,
  command, or simulation test owner;
- classify every remaining occurrence-assembly check as either required product
  contact (including control-construction declaration lookups) or redundant
  schema validation; retain only the former plus semantic-owner identity and
  required projected-control assertions;
- run the focused engine and occurrence-assembly lanes before command movement.

This behavioral contraction lands separately from the following movement: a
forged invalid `ProjectDocument` is no longer independently revalidated by the
workspace projector, while supported application inputs and visible behavior
remain unchanged.

#### Gate A checkpoint — passed 2026-08-01

The four units landed as independent commits. They keep command-boundary work
out of this gate and meet the intended authority split:

| Unit         | Production addition and deletion                                                                                                                                                                                                                                           | Behavioral status                                                                                                                                                                      | Primary validation                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A1 `f3b22bc` | `source-index.ts` now maps canonical and prefix owners explicitly; it deletes reflective address recognition and object walking.                                                                                                                                           | Corrects the clamped Hub `targetLifecycle` false positive without creating a second workspace read model.                                                                              | `source-index.test.ts`: 7 tests.                                                                                        |
| A2 `e879dc9` | Reward kernel now enumerates locally valid complete offers; the exact-assembly simulation facade and rewards resolver own counted store/type domains. It deletes the application snapshot walk, store precedence, payload enumeration, and the redundant app store matrix. | Preserves selected locally valid out-of-store types in the application; corrects retained, Hub, wheel, source-offer, and physical-batch fallback domains without candidate evaluation. | Focused kernel, engine, and app suite: 4 files / 39 tests; engine: 45 files / 394 tests; planner: 42 files / 279 tests. |
| A3 `12e9b89` | `decision-facts.ts` now supplies shared `FieldsBatchFacts` and target continuation; it deletes the workspace Fields-cage table and duplicated continuation policy.                                                                                                         | Intentionally aligns retained workspace facts with canonical Fields and continuation semantics.                                                                                        | Focused materialization and workspace suite: 5 files / 51 tests.                                                        |
| A4 `81132b8` | It deletes occurrence assembly's exhaustive `assertOccurrenceStateCoherence` preflight and moves its primary malformed-state witnesses to engine codec tests.                                                                                                              | A forged invalid document is no longer separately revalidated by the projector; supported input behavior is unchanged.                                                                 | Engine lane: 44 files / 384 tests.                                                                                      |

The complete repository gate passed after the four commits: `npm run check`
completed typecheck, 94 test files / 788 tests, lint, formatting, and the
production build. Gate A therefore closes here; later command-boundary work is
not implied by this checkpoint.

### Gate B: Command-intent pilot

#### B1: Start creation from binding through React

- introduce the small application-owned command-intent value and common React
  adapter; the adapter knows only command dispatch plus declared
  `before`/`after`/none focus ordering;
- inject one narrow occurrence-ID factory from composition directly into
  interaction binding;
- make fixed and choice start interactions allocate lazily and return complete
  `CreateStart` intents with the newly created occurrence as after-focus;
- remove start identity allocation and occurrence-address reconstruction from
  React;
- delete the unused `WorkspaceStartInteraction.fixedGameName` field in the same
  slice;
- make interaction-binding tests own exact fixed/choice start command and focus
  shapes, the adapter test own dispatch ordering, and React retain one visible
  creation/Undo witness.

This is the only authorized command pilot. It exercises identity injection,
command construction, focus, Redux dispatch, and history through one complete
family without depending on reward-domain work. It must not add a command bus,
generic dispatcher service, or parallel action vocabulary.

#### Gate B checkpoint

Do not continue automatically. Compare the pilot with the deleted start path.
It passes only if React loses semantic construction, binding becomes the one
command-shape test owner, no extra production stage is introduced, and an
analogous creation interaction has a smaller semantic change neighborhood. An
equal file count is acceptable only when the pilot removes one policy owner or
duplicate command-shape matrix. If the result is only more wrappers around the
same literal, stop the command migration and retain the direct mappings outside
the pilot.

**Result — passed (2026-08-01).** B1 adds one binding-produced
`WorkspaceCommandIntent`, one direct `OccurrenceIdFactory` collaborator, and a
small React dispatch adapter. It deletes both start-specific `CreateStart`
literals, start-ID allocation, and occurrence-address reconstruction from
`StartFrontier`; React now invokes the complete bound intent only. The factory
does not join `StructuredWorkspaceContextualServices`, and the adapter only
orders the existing command and focus Redux actions; it neither reads
`focusByOwner` nor claims to know whether a command transitioned state.

The ownership reduction is real despite the pilot's wiring footprint: the exact
fixed/choice command-and-focus matrix has one owner in interaction binding,
rather than separate React branches. Binding tests cover lazy allocation and
the exact intent shapes; the adapter test covers before/after/none ordering and
the deliberately unconditional after-focus case; a product-loop witness proves
one visible start is one undoable authored edit. No assembly stage, command
bus, generic dispatcher, or alternate action vocabulary was introduced.

The full repository gate passed after the pilot: typecheck, 95 test files /
794 tests, lint, formatting, and the production build.

Gate B therefore closes with a positive pilot result. Gate C remains an
explicit follow-on decision rather than an automatic continuation.

### Gate C: Policy-bearing interaction migration

Gate C is authorized only after the pilot passes. It moves the cases where
React currently chooses semantic behavior; it does not pursue zero command
literals as an aesthetic target.

#### C1: Reward-owner command selection

- after A2 settles reward authority, add
  `intentFor(ResolvedRewardOffer)` to the required reward interaction while
  preserving its multi-step transient picker flow and lazy candidate domain;
- make interaction binding own the four exact reward replacement commands;
- make the reward React control dispatch only the returned intent and delete
  its reward-owner command switch;
- make binding tests own the four command shapes and retain representative
  visible/Undo witnesses in React tests.

C1 requires both A2 and the passed B1 pilot: it consumes the shared
command-intent adapter rather than introducing a second dispatch shape just
for rewards.

#### C2: Existing versus missing target commands

- make target-room requirements discriminate an existing target from a missing
  target;
- carry both the exact target owner and occurrence owner for
  `ReplaceOccurrenceRoom`, while a missing target carries its target owner and
  receives a lazy identity for `CreateTarget`;
- return no focus for replacement and the existing target owner as after-focus
  for creation;
- delete the target marker narrowing, command selection, identity allocation,
  and focus reconstruction from React without duplicating owners onto render
  nodes.

#### C3: Structural frontier and takeover commands

- bind ordinary-batch creation, linked-exit creation, and existing takeover
  create/replace/reconcile operations from their existing capabilities;
- route takeover identity construction through the injected factory rather
  than the current ambient allocator;
- preserve candidate evidence, explanations, disabled state, and exact
  before/after focus behavior;
- delete structural command selection, linked-exit identity allocation, and
  creation-focus reconstruction from React;
- delete the unused linked-exit `targetGameName` interaction field once binding
  owns command construction.

#### C4: Hub semantic commands

- bind Hub visit append/replace/remove, board creation, slot opening, and the
  completed handoff from explicit Hub requirements;
- make Hub visits explicitly discriminate append from replace and separately
  declare removal capability;
- make Hub opening activation-scoped: one lazily allocated provisional identity
  is reused by candidate loading and its returned open intent through one stable
  interaction object per opening attempt. The attempt begins on explicit widget
  activation and ends on cancellation or projected-interaction replacement;
  React retains the capability as transient state and never rebinds it during
  render;
- wrap the already-complete close command without relocating its construction;
- retain exact Hub-visit ownership on the requirement and bound interaction,
  delete React marker narrowing, and delete the unused bound Hub-slot
  `roomGameName` field;
- preserve Hub candidate presentation, transient board state, focus behavior,
  and one-effective-command/one-Undo behavior.

#### Gate C checkpoint

Review C1-C4 as completed families, not as progress toward universal command
binding. Confirm that React no longer selects the policy-bearing variants named
in Finding 2, that identity allocation has left React, and that no action union
was added solely to mirror `ProjectCommand`. This checkpoint decides whether
any mechanical family is worth moving.

### Gate D: Conditional mechanical mappings

Gate D is optional. It is not required to close the policy-bearing correction.
Approve each unit only when the Gate B/C evidence shows that the exact family
will become easier to extend or test.

#### D1: Occurrence-local candidate commands

- if approved, add one required candidate-plus-intent product for the complete
  Ship, Ephyra, and Shop editable families;
- bind encounter count, wheel store/count/pick, side-room generation/order, and
  Shop purchase commands;
- delete the corresponding React command literals and move their exact shape
  matrix to binding tests.

The existing `WorkspaceCandidateInteraction` remains the non-committing lazy
primitive. Do not add an optional command member or a compatibility path. If
the richer product merely repeats owner-plus-value mapping without reducing a
consumer or test neighborhood, skip D1.

#### D2: Ordinary decision value commands

- if approved, bind Fields outcome, batch reward store, exit selection, and
  ordinary room replacement as complete value-to-intent capabilities;
- retain exact owners on requirements and bound interactions and delete only
  React narrowing helpers that lose their final consumer;
- preserve lazy candidate work, selected-invalid retention, and one-command/
  one-Undo behavior.

Skip any subfamily that would require a new action discriminant or product used
only to rebuild the same direct engine command one layer later.

### Gate E: Product contraction and enforcement

#### E1: Remove unused UI-facing shadows

- add the explicit typed biome owner used for focus scoping and delete its
  generic marker narrowing;
- remove `WorkspaceTopologyRemovalScope`,
  `WorkspaceTakeoverReplacementImpact`, Hub-close impact, repair-scope removal
  arrays, `workspaceRemovalScopeForRoots`, their application adapters, and
  their application-only witnesses from UI-facing production products;
- replace `WorkspaceBatchRepairScope`, as consumed by `ExactRepairScope`, with
  its no-shadow repair intent. It is the current repair carrier that exposes
  `ReconcileBatchExitCapacity` directly to `DecisionWorkbench`; its existing
  before-focus behavior must pass through the common adapter exactly once;
- preserve existing complete removal and repair commands unless their current
  carrier becomes unnecessary as a direct consequence of that deletion;
- invoke those commands through the common intent adapter with the existing
  focus policy, immediate execution, danger styling, and Undo recovery;
- delete only additional fields proven consumer-free by the contraction itself.

#### E2: Enforce and close the boundary actually achieved

- prohibit `allocateOccurrenceId` throughout structured-editor React after C4;
- prohibit direct `authoredProjectCommandDispatched` imports only in component
  neighborhoods whose complete interaction families migrated; if Gate D is
  skipped, do not claim or enforce a project-wide zero-literal boundary;
- use scoped ESLint `no-restricted-imports`, not source-token scans or exact
  filename inventories;
- update stable design authority to describe the boundary that actually landed,
  including any intentionally retained mechanical mappings;
- run focused interaction, UI, planner, product, and complete repository gates.

A1-A4 may land in any order and close at Gate A. B1 is a separate pilot. C1
depends on A2 and a passed B1 pilot; C2 and C3 depend on the pilot; C4 follows
C3 so it can reuse the injected identity factory and normalized creation
intent. D1 and D2 require an explicit positive checkpoint decision and may be
skipped independently. E1 deletes only products with no runtime consumer, and
E2 enforces only the scope actually migrated. No gate remains open merely
because a later optional gate was declined.

## Test Ownership After Correction

| Contract                                                   | Primary owner                              |
| ---------------------------------------------------------- | ------------------------------------------ |
| evaluated entity -> assessed semantic owner                | evaluated-owner/source-index tests         |
| counted producer -> selectable domain and store precedence | simulation/rewards authoring tests         |
| reward type -> locally valid complete offers               | reward-kernel domain tests                 |
| authored Fields decision -> complete Fields batch facts    | planner-engine batch/materializer tests    |
| selected target + room -> continuation                     | planner-engine topology/materializer tests |
| divergent retained Fields/path fallback -> corrected view  | focused workspace characterization tests   |
| persisted room-state schema coherence                      | authored codec/default/command tests       |
| existing/missing target picker -> exact intent shape       | interaction-binding tests                  |
| policy-bearing requirement -> exact command intent         | interaction-binding tests                  |
| migrated editable requirement -> bound command intent      | interaction-binding tests                  |
| Hub activation -> stable identity, candidate, and command  | interaction-binding tests                  |
| intent focus owner and before/after/none ordering          | intent-adapter tests                       |
| command -> authored transition and validation              | planner-engine authored-command tests      |
| removal root -> exact atomic topology closure              | planner-engine topology-impact tests       |
| migrated click/change -> intent and visible result         | focused React control/workbench tests      |
| effective migrated intent -> history and fresh evaluation  | application/product-loop witnesses         |
| lazy candidate work and cached repeat loads                | candidate interaction architecture tests   |
| representative rebuild/candidate/edit/undo work counts     | unified-biome performance tests            |

For a migrated family, React tests should not reproduce every exact command
object after binding owns that matrix. Interaction tests should not reproduce
authored command rejection policy or removal-closure matrices already owned by
the engine. React retains representative witnesses that removal controls have
their intended visual treatment, dispatch immediately, and remain undoable.
Workspace projection tests retain representative consumption witnesses for
reward domains, Fields facts, continuation, and room-local products rather than
repeating their complete engine matrices.

## Guardrails and Stop Rules

- Do not add a dependency-injection container or command registry.
- Do not inject Redux dispatch into projection construction.
- Do not make command intents execute domain mutations themselves.
- Do not create an application copy of the `ProjectCommand` union.
- Do not turn `StructuredWorkspaceContextualServices` into a command or
  identity dependency bag; pass the named identity factory directly to command
  binding.
- Do not add optional factories, compatibility adapters, or forwarding barrels
  for later units to repair.
- Do not merge interaction binding into presentation or semantic assembly.
- Do not decompose an already-complete semantic command and recreate it in
  binding solely to make command origin uniform. Binding must eliminate React
  policy, identity, or address reconstruction, or demonstrably shrink the
  family change neighborhood.
- Do not introduce an application action discriminant that merely shadows the
  `ProjectCommand` variant constructed one layer later.
- Do not replace explicit address maps with React topology traversal.
- Do not add production closure/audit manifests.
- Do not expand evaluated-owner coverage into a general entity or reward lookup
  index. A1 remains a coverage product; A2 obtains reward facts from the engine
  authority rather than creating a second application topology view.
- Do not preserve a second application implementation of reward-store
  precedence, legal reward payload domains, Fields batch facts, or target
  continuation after the engine query exists. Application grouping consumes
  engine-returned complete offers; it does not traverse declarations to create
  a second legal domain.
- Do not make reward-kernel depend on simulation, project evaluation, or
  candidate artifacts. Counted producer resolution belongs in simulation/rewards.
- Do not turn the engine corrections into a generic editor-domain service or
  expose private candidate artifacts. Keep picker grouping, explanations,
  witness selection, labels, and transient flow in application/React.
- Do not revalidate the complete persisted room-state schema in workspace
  production code. Retain only assertions at genuine product-contact and
  semantic-owner boundaries.
- Do not expose engine removal-closure identities through UI-facing contracts
  when no runtime UI consumer uses them. Production products are not test
  observability surfaces, and these interactions retain no application-private
  impact-closure calculation.
- Do not add confirmations to undoable authored removal, repair, or replacement
  actions. Confirmation is reserved for irreversible external destruction such
  as deleting files or profiles.
- Do not move simple project-shell commands merely to achieve zero command
  literals in all React source; biome fields remain a direct declaration mapping.
- Do not allocate occurrence identities during projection construction, React
  render, or ordinary candidate loading. A provisional Hub opening ID is
  activation-scoped and must be reused by one stable candidate-plus-intent
  capability for its candidate query, retries, and command.
- Do not make command binding reread topology to distinguish target replacement
  from target creation. The semantic assembly publishes the explicit
  existing/missing target-picker discriminant and exact occurrence owner.
- Do not duplicate typed semantic owners onto render nodes after bound
  interactions remove the React consumer. Keep them on requirements and bound
  interactions; add a render-node owner only for a demonstrated presentation
  need such as biome focus scoping.
- Do not hide evaluated candidate support behind command-only APIs; React still
  owns generic possible/impossible/forced presentation.
- Do not claim focus occurs after a successful command without adding a genuine
  application transition-result boundary. Preserve the complete declared
  before/after/none focus matrix unless a separate UX decision changes it.
- Enforce the migrated React boundary through scoped `no-restricted-imports`,
  not a brittle source-token scan. Structured-editor React cannot import
  `allocateOccurrenceId` after Gate C. Restrict
  `authoredProjectCommandDispatched` only in neighborhoods whose complete
  interaction families migrated; intentionally retained Gate D mappings and
  documented shell/biome-field bindings remain explicit exceptions.
- Do not start Gate C until the Gate B pilot demonstrates a real reduction in
  semantic React work and test ownership. Do not start Gate D without a second
  explicit positive decision at the Gate C checkpoint.
- Do not keep a prior gate open because a later optional mechanical migration
  was declined.
- If command binding makes one interaction family require an unrelated mutable
  context, stop and keep the direct semantic command rather than introducing a
  dependency bag.
- If typed evaluated-owner mapping must reconstruct lifecycle or reward policy,
  stop and establish a genuine engine coverage fact first.

## Gate Completion Contracts

### Gate A

Gate A is complete when:

1. assessed owner reachability no longer depends on recursive object-shape
   discovery or a duplicated semantic-address recognizer, including the
   clamped Hub `targetLifecycle` witness;
2. simulation/rewards owns complete counted-store precedence and returns the
   selectable reward-type domain, reward-kernel owns locally valid complete
   offers, and application code retains only known out-of-store repair-value
   retention, candidate evaluation, grouping, witness selection, and
   presentation;
3. complete `FieldsBatchFacts` and target continuation come from shared pure
   engine derivations used by materialization and workspace projection, with no
   matching application algorithms, and the characterized mixed-takeover,
   non-Fields-bounded-slot, unpicked-Preboss, and linked-Preboss fallback cases
   use the corrected engine result;
4. occurrence assembly no longer performs exhaustive preflight validation of
   Ephyra, Fields, and Ship persisted schema coherence, while genuine
   control-construction and product-contact assertions remain;
5. each unit records its behavioral status, production additions, named
   deletions, primary tests, and representative work-count result.

### Gate B

The command pilot is complete when:

1. fixed and choice starts expose complete lazy `CreateStart` intents;
2. React allocates no start identity and reconstructs no start focus address;
3. the adapter preserves declared dispatch/focus ordering without reading
   `focusByOwner` or inferring transition success;
4. binding owns the exact start command/focus matrix and React retains only a
   representative visible/Undo witness;
5. the checkpoint records whether the pilot reduced the family change
   neighborhood. A negative result closes Gate B without authorizing Gate C.

### Gate C

The policy-bearing migration is complete when:

1. React no longer selects reward-owner, existing/missing-target,
   structural/takeover, or Hub command variants;
2. React allocates no occurrence identities or reconstructs creation-focus
   addresses; command binding uses the injected factory lazily, and one Hub
   opening reuses a stable provisional identity for candidate evaluation and
   command;
3. exact owners remain in requirements and bound interactions without being
   copied onto render nodes that no longer consume them;
4. candidate loading remains lazy and render-pure, Redux remains the sole
   command/history coordinator, and one effective intent still creates one
   history entry;
5. declared focus behavior preserves the complete matrix: starts, missing
   targets, and linked exits use after-focus; batch/Hub creation, Hub slot edits,
   and takeover/handoff use before-focus; reward and Hub-visit edits dispatch no
   focus, including `RemoveHubVisitsFrom`; and no path claims post-success
   focus without a transition-result boundary;
6. command-shape policy has one binding-test owner while React suites retain
   representative user-flow witnesses;
7. the Gate C checkpoint explicitly approves or declines D1 and D2 separately.

### Gate D

Each approved optional unit is complete only when its whole interaction family
provides required intent/value-to-intent capability, the superseded React
command construction and duplicate command-shape tests are deleted, and the
measured change neighborhood is smaller or clearer. A skipped D1 or D2 creates
no outstanding completion item and is documented as an intentionally retained
mechanical mapping.

### Gate E and audit closure

The audit may close when:

1. exact owner lookup continues through `focusByOwner` and interaction maps,
   with an explicit typed biome owner only where React still needs it;
2. UI-facing removal, Hub-close, takeover-replacement, and repair products no
   longer expose unused deletion-closure identities or retain application-
   private impact-closure products;
3. authored removals remain visually distinct, execute without confirmation,
   and remain recoverable through one effective history entry and Undo/Redo;
4. removal and repair retain their existing before-focus behavior when their
   complete commands are invoked through the common intent adapter;
5. lint rules enforce only the boundary actually achieved, including a complete
   structured-React prohibition on `allocateOccurrenceId` and scoped command-
   dispatch restrictions for fully migrated families;
6. no compatibility path, service locator, production audit model, or command-
   shadow union remains, and every helper, field, test, and adapter superseded
   by the completed gates is deleted in its owning unit;
7. `candidateInteractions.test.ts`, `UnifiedBiomePerformance.test.ts`, all
   focused lanes, and `npm run check` pass with unchanged representative
   evaluation/candidate work counts.

At closure, stable ownership and DI rules are absorbed into the relevant design
authorities, delivery evidence is recorded once, and this isolated audit is
retired without adding permanent inbound links.
