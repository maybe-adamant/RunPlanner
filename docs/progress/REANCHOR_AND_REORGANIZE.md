# Codebase Re-anchor and Reorganization

## Status

This is the active behavior-preserving architecture plan. It changes code
placement, product boundaries, dependency direction, and internal composition,
but it does not change the authored schema, game rules, simulation semantics,
candidate results, workspace behavior, or player-facing design.

Foundation and Campaign A's required pre-movement default-inspector and
work-count characterization are complete. A1 established the structured
workspace public entry and private contract/projector seam. A2.1 established
the authored-first source index, A2.2 established occurrence activation,
lifecycle, and publication facts, A2.3 made occurrence reward controls
explicit assembly output, and A2.4 did the same for room pickers; common
semantic assembly remains in progress. A2.5 made completed biome focus
destinations an explicit assembly output as well. A4.1 now returns and binds
the first occurrence-owned non-reward interaction packages explicitly. A4.2
does the same for authored batch controls. A4.3 does the same for authored Hub
board slots and visits. A4.4 does the same for generic authored-topology
removals. A4.5 does the same for topology-free authored starts. A4.6 does the
same for takeover batches.

The feature frontier remains Commit 5b.3 in
[`WORKSPACE_PRESENTATION_POLISH.md`](WORKSPACE_PRESENTATION_POLISH.md), followed
by Commit 5b.4 and the separate schema-changing Commit 5c in
[`SHOP_PURCHASE_ORDER.md`](SHOP_PURCHASE_ORDER.md). The workspace/React
campaign in this plan is the bounded prerequisite before Commit 5b.3 resumes.
The remaining authored-core and engine campaigns must close before Commit 5c,
which would otherwise add behavior through those same gravity wells.

This document is temporary delivery authority. Stable ownership remains with
the documents under `docs/design/`. When the program closes, any durable
boundary clarifications will be absorbed into those authorities, the evidence
will be recorded in `IMPLEMENTATION_PROGRESS.md`, and this document will be
retired. Git history will retain the implementation contract.

## Purpose

The problem is not file length by itself. The problem is whether a maintainer
can follow one semantic product from its authority to its consumer without
crossing hidden mutation, reconstructed ownership, ambiguous imports, or a
broad context that quietly supplies unrelated dependencies.

This plan uses four primary lenses:

1. **Flow:** inputs, transformations, returned products, and consumers are
   visible in order.
2. **Responsibility:** a module owns one coherent decision or product lifecycle,
   even when that responsibility requires several related functions.
3. **Maintenance:** a change to one authority has a narrow, predictable
   implementation and test neighborhood.
4. **Imports and dependency injection:** dependencies point toward stable
   contracts and enter through explicit construction or function parameters,
   not through cycles, ambient access, or service-locator contexts.

Line count and file count are diagnostic evidence only. They are not acceptance
targets. A long declaration table or an explicit exhaustive dispatcher may be
healthier than several short files that obscure one decision.

## Governing Architecture

The repository keeps its existing package direction:

```text
catalog construction -> pure planner engine <- application composition -> React UI
```

The durable semantic flow remains:

```text
declarations
  -> normalized catalog
  -> authored project
  -> materialization and ordered simulation
  -> findings and candidate support
  -> application workspace projection
  -> React presentation
```

The reorganization must preserve these facts:

- catalog and authored state are semantic inputs;
- simulation, candidates, findings, and workspace projections are replaceable
  derived products;
- `createApplication` is the application composition root;
- reducers coordinate authored and UI-session state but do not become the
  domain engine;
- React renders projected facts and invokes semantic interactions;
- no lower layer imports application or React concerns;
- explicit chronological and exhaustive dispatch remains visible where order
  or a closed semantic vocabulary is the authority.

## What the Final Code Read Found

### Healthy Anchors to Preserve

`apps/planner/src/composition/createApplication.ts` is already a useful
composition root. It constructs catalog-backed services, supplies candidate and
picker collaborators to the workspace projection, owns project-evaluation
caching, and returns the application capabilities. This plan may tighten named
contracts around those collaborators, but it must not distribute that
construction into React or lower-level modules.

`packages/planner-engine/src/simulation/project.ts` is also a healthy visible
orchestrator. It composes completeness, materialization, history, rewards,
generation, and route-prefix processing in semantic order. Its orchestration
may consume cleaner products from reorganized subsystems, but it should not be
replaced by a dynamic registry or a generic pipeline framework.

The top-level exhaustive switches in command, history, reward, and candidate
dispatch express closed semantic vocabularies. The target is a thin visible
dispatcher calling explicit family handlers, not hidden callback registration.

Explicit biome declarations and auditable game-fact tables are not gravity
wells merely because they are long. They remain declaration-owned and direct.

### Gravity Wells and Leaked Responsibilities

| Area                                                 | Current mixed responsibilities                                                                                                                                                                                                     | Required correction                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/planner/src/projections/structured-workspace/` | Source lookup, authored/evaluated overlay, room and Hub assembly, candidate interaction construction, rail presentation, focus registration, and several closure audits share one projector and broad mutable context.             | Turn workspace projection into an explicit sequence of immutable products with a thin public service facade.                                                                                      |
| `MutableProjectionContext` and `projectOccurrence`   | Catalog/evaluation facts, findings, route/biome identity, focus destinations, room controls, and reward controls are accumulated together. A projection function returns a node while also registering products for later phases.  | Pass stage-specific inputs. Each stage returns every product later stages consume. Local builders may mutate privately, but cross-stage products cannot be discovered through prior side effects. |
| `createInteractionCatalog`                           | Re-traverses authored state while consuming maps populated during semantic projection, so interaction ownership is split between traversal and hidden registration.                                                                | Bind interactions from an explicit requirement product emitted by semantic assembly and independently checked against authored owners.                                                            |
| `BiomeWorkspace.tsx`                                 | `roomOwnsAddress`, `nodeOwnsAddress`, `nodeForAddress`, and `fallbackSubject` reconstruct semantic containment and default inspection despite the projection already publishing focus information.                                 | Project exact explicit and default inspector destinations. React resolves keys and renders; it does not rediscover semantic ownership.                                                            |
| `simulation/candidates/index.ts`                     | Public query/result contract, evaluation recovery, progressive repair, every candidate family, and session dispatch share one module.                                                                                              | Separate the public contract, exact session-bound sources, family-specific preparation products, candidate-family evaluators, and a thin dispatcher.                                              |
| `simulation/rewards/biome.ts`                        | Snapshot indexing, mutable evaluation state, event-family handling, candidate context capture, support recording, and final projection are interleaved in one chronological loop.                                                  | Keep the chronological coordinator visible, but give it an explicit state product, source indexes, and event-family handlers.                                                                     |
| `simulation/history/fold.ts`                         | Ledger initialization, active lifecycle bookkeeping, event validation, per-event mutation, view capture, and final freezing are interleaved around many loose maps and variables.                                                  | Define one fold-state product and explicit handlers for the closed history-event families. Preserve total event order and strict dispatch.                                                        |
| `authored-project/roomState.ts`                      | Declaration defaults, room-replacement reconciliation, and persisted decoding occupy one module despite having different callers and failure contracts.                                                                            | Separate default construction, replacement reconciliation, and codec validation behind one authored room-state public boundary.                                                                   |
| `authored-project/topology.ts`                       | Physical-exit resolution, topology queries, takeover facts, structural validation, and persisted decoding are coupled.                                                                                                             | Separate the authored topology read model from validation and decoding while retaining one public topology contract.                                                                              |
| `commands/occurrence-state.ts`                       | Room replacement, incoming/local rewards, Fields, Ship wheels, Ephyra side rooms, and Shop changes share lookup and mutation machinery despite having distinct leaf contracts.                                                     | Extract only command families with narrow transition dependencies while retaining one exhaustive occurrence-command dispatcher.                                                                   |
| `commands/unified-topology.ts`                       | The public exhaustive dispatch is valuable, and its start, batch, takeover, Hub, selection, repair, and removal operations share several atomic topology invariants.                                                               | Extract topology read/transaction primitives first, then split command families only if the dependency audit proves the aggregate is no longer the more cohesive owner.                           |
| `catalog-schema` and `reward-kernel` types           | `CatalogCollection` is declared by catalog schema, while catalog schema imports reward-kernel types and reward-kernel imports the collection type back. The cycle is type-only today but expresses the wrong conceptual ownership. | Move normalized collection primitives to a neutral engine module below both consumers and add a focused import-direction guard.                                                                   |

### Areas Not Selected for Mechanical Splitting

- `simulation/generation/biome.ts` is large but presently follows one
  generation responsibility with reasonably bounded helpers. It changes only
  if a later slice exposes a concrete dependency violation.
- catalog declaration modules remain explicit game-data authority.
- React CSS and test files split only when the production ownership boundary
  gives them a clearer home.
- public barrels are reorganized only to preserve a deliberate import surface;
  export-count reduction is not an objective.

## Target Product Flows

### Authored Core

```text
normalized catalog + authored values
  -> room default or reconciliation policy
  -> structurally valid authored room state
  -> codec validates persisted representation independently

normalized catalog + authored topology
  -> declared physical-exit and ownership index
  -> topology validation
  -> semantic command-family transition
  -> replacement authored topology
```

Default construction, reconciliation, decoding, and commands may share narrow
pure helpers. They may not invoke one another merely to reuse traversal when
their failure or ownership contracts differ.

### Simulation

```text
HistoryFoldState + HistoryEvent
  -> explicit event-family handler
  -> next HistoryFoldState
  -> frozen history product

RewardEvaluationSources + RewardEvaluationState + HistoryEvent
  -> explicit event-family handler
  -> next RewardEvaluationState
  -> frozen reward simulation product

catalog + exact authored project/evaluation pair
  -> exact session-bound candidate sources
  -> family-specific preparation
       - structural candidate context
       - reward candidate context
       - lifecycle candidate context
       - Hub candidate context
  -> matching candidate-family evaluator
  -> candidate result
```

The history and reward coordinators retain their chronological loops. Event
handlers do not subscribe themselves to a registry. Candidate dispatch retains
an exhaustive query-kind decision. A prepared candidate session remains bound
to the exact authored project identity and its exact evaluation, but it does
not package every possible route, biome, progressive, history, reward, and Hub
fact into one universal context.

### Structured Workspace

```text
authored project + exact evaluation
  -> WorkspaceSourceIndex (addressed source lookup only)
  -> WorkspaceOccurrenceAssemblyFacts
       - details activation
       - authored leaf lifecycle
  -> WorkspaceSemanticAssembly
       - structural nodes
       - authored/evaluated markers
       - interaction requirements
       - semantic destination requirements
  -> WorkspaceInteractionBinding
       consumes source index + requirements + injected services
  -> WorkspacePresentation
       - decision-highlight rail
       - exact focus destinations
       - default inspector destinations
  -> independent closure audit
  -> StructuredWorkspaceProjection
```

The source index is authored-first and lookup-only. It indexes semantic
addresses to raw authored owners, stable authored order, evaluation overlays,
and findings. It does not decide physical exits, eligibility, takeover policy,
topology repair, lifecycle behavior, or other facts owned by the pure core.
Evaluation adds assessment and lifecycle facts but cannot create, remove, or
replace persisted authored owners or their editable offer-time leaves.

Occurrence assembly facts classify authored `detailsActive` state and each
room-local leaf as conceptually active, dormant, or absent. Semantic assembly
and interaction binding consume that one production classification so Ephyra
side leaves, Shop inventory, and later room-local products cannot drift between
stages. The independent expected-owner audit still derives its expected side
from persisted authored state and declarations, then validates both the
occurrence facts and final reachability. It must not trust the derived assembly
collection as its own expected input.

One structurally owned Room Occurrence receives one reachable occurrence
projection. Ordinary offers may be nested in a decision workbench rather than
rendered as standalone nodes. The invariant is one reachable semantic
owner/control package, not one UI-node shape.

Declared physical exits are the exits resolved from the current authored
batch/layout state. The projection does not invent blank controls for
potential-but-inactive exits.

Closure validates semantic-owner reachability. For every expected authored
owner and leaf, its exact address must resolve to the containing inspector and
interaction even when its room or reward is nested in a decision workbench.
The expected side of this audit is derived independently from persisted
authored state, not from the rendered node collection being checked.

### React

```text
focused semantic owner
  -> projected exact inspector destination
  -> projected node/frontier key
  -> workbench render

projected interaction
  -> single React loading adapter when needed
  -> semantic command
```

The projection owns containment, workbench destination, fallback/default
selection, rail grouping, and interaction ownership. React may own transient
component state and accessible interaction mechanics. It may not scan nodes to
recover domain containment or infer which workbench owns a semantic address.

## Dependency-Injection Rules

1. Application-wide collaborators enter through `createApplication`.
2. Projection factories receive narrow typed collaborators at construction.
3. Per-project work receives the exact project and evaluation together.
4. Stage functions receive only the source products and services they use.
5. No stage receives a catch-all mutable application or projection context.
6. No module reads a collaborator from Redux, React context, a global singleton,
   or a barrel with initialization side effects.
7. No producer communicates with a later phase solely by mutating a registry
   the later phase knows to inspect.
8. A local mutable builder is acceptable when mutation is contained inside one
   stage and the complete immutable product is returned from that stage.
9. Circular imports are prohibited even when every edge is currently
   `import type`.
10. Factories, interfaces, and parameter objects are introduced only where
    they represent a real construction or product boundary. This plan does not
    authorize an abstraction framework.

## Responsibility Rules

A source module is cohesive when it owns one of:

- a public product contract;
- one transformation into that product;
- one closed semantic family of transitions;
- one codec or boundary validation policy;
- one explicit composition/dispatch boundary.

A source module is not cohesive merely because every function participates in
the same feature. In particular, declaring a product, constructing it through
hidden registration, validating it, and adapting it for React are separate
responsibilities.

Moving code is complete only when the new module:

- has an explicit input contract;
- returns its owned output;
- imports only lower or peer contracts allowed by the target graph;
- has tests at its authority boundary; and
- leaves no old parallel path or compatibility wrapper.

## Delivery Strategy

This plan authorizes one small dependency correction and four gated campaigns.
The expected range is sixteen to twenty implementation commits, not an exact
quota. Each campaign begins with a fresh authority/import audit that fixes its
actual commit boundaries. A boundary may merge when it would otherwise rewrite
the same transition twice, or split when a vertical semantic family is too
large for truthful review.

Every intermediate revision remains type-correct, tested, and free of
temporary compatibility machinery. The sequence below is the default:

```text
neutral dependency anchor
  -> Campaign A: workspace and React
  -> checkpoint: Commit 5b.3 and 5b.4 may resume
  -> Campaign B: candidate evaluation
  -> Campaign C: authored core
  -> Campaign D: history and reward evaluation
  -> checkpoint: Commit 5c may begin
```

Campaigns B and C may exchange order if their opening audits show a narrower
dependency path. Neither depends on unfinished UI work. Campaign D stays before
Commit 5c because exact Shop purchase order changes the chronological reward
path it owns.

### Relative Work and Risk

| Work                            | Expected review commits | Relative size                     | Primary risk                                                                   |
| ------------------------------- | ----------------------: | --------------------------------- | ------------------------------------------------------------------------------ |
| Neutral dependency anchor       |                       1 | Small                             | Unnecessarily changing external import surfaces                                |
| Campaign A: workspace and React |                     5–6 | Extra-large                       | Losing authored reachability, focus, or lazy interaction behavior              |
| Campaign B: candidates          |                     3–4 | Extra-large                       | Replacing one large file with a universal context or altered coverage recovery |
| Campaign C: authored core       |                     4–5 | Extra-large                       | Scattering atomic topology and room-state invariants                           |
| Campaign D: history and rewards |                     3–4 | Extra-large/highest semantic risk | Moving an event to the wrong chronological state                               |

The range describes review units, not elapsed time. Campaign gates exist so the
project can reassess value, coupling, and remaining risk before authorizing the
next broad movement.

### Foundation: Neutral Dependency Anchor

- move `CatalogCollection` and construction-only neutral helpers below catalog
  schema and reward kernel;
- keep the existing catalog-schema export available to external catalog
  construction so consumers do not learn an engine-internal path;
- remove the conceptual type cycle;
- add a focused import-direction assertion for this boundary rather than
  introducing a general dependency-analysis framework;
- preserve all public catalog and reward behavior.

### Campaign A: Workspace Flow and React Consumption

Campaign A is the only prerequisite before Commit 5b.3 resumes. The target
location is a cohesive `structured-workspace/` projection area with one
intentional public entry point. Exact filenames follow the returned products,
not a file-count target.

#### Campaign A entry characterization

Before A1 changes production structure, add or tighten characterization
fixtures for:

- the current default-inspector priority matrix: active start/exit frontier,
  Hub frontier, latest incomplete decision, latest details-active occurrence
  redirected to its containing decision or Hub, entry, then first node or no
  subject;
- complete, incomplete, blocked, retained-invalid, Hub, and ordinary examples
  for those priorities;
- the named work-count baselines in the Verification section.

These fixtures preserve behavior; they do not make the React fallback an
authority.

Current authored projections do not naturally reach every defensive tail of
that fallback: an empty topology publishes a start frontier, every authored
entry is details-active, and a completed Hub has a later fixed Preboss detail.
Characterize those selector cases with minimal synthetic workspace envelopes,
not fabricated authored documents. A5 moves the same matrix to the projected
default-destination contract and retains React equivalence coverage.

#### A1: Public workspace contract

- separate public workspace, marker, interaction, rail, and destination
  contracts from their construction;
- preserve the intentional application and React import surface through the
  public entry point;
- add import rules with this boundary rather than waiting for final closure.

#### A2: Authored-first source index and common assembly

- build one authored-first source index for routes, biomes, occurrences,
  decisions, evaluated overlays, and findings;
- bound the index to addressed lookup and stable source order; call existing
  pure-core topology resolvers rather than rebuilding their policy;
- derive one explicit occurrence assembly-facts product containing
  `detailsActive` and authored leaf-lifecycle classification;
- consume that index immediately while projecting fields, entry,
  ordinary/takeover/linked decisions, occurrence workbenches, rewards,
  frontiers, and completion;
- return nodes, markers, interaction requirements, and destination
  requirements explicitly;
- remove cross-stage control/focus registration from common occurrence
  projection.

**A2.2 transition note.** The facts distinguish an authored leaf's lifecycle
from whether the current semantic product publishes it. Dormant Fields and
Ship leaves remain published and editable by design. Dormant Shop inventory is
withheld. Dormant Ephyra side leaves are truthfully marked **published** for
now because the existing projector and interaction binding still emit them and
React hides their controls behind `detailsActive`. A3 must move the Ephyra
room-local projection and its interaction binding to one withheld policy in
the same change; A2 must not pretend that this transitional shape is already
the final lifecycle contract.

**A2.3 transition note.** An occurrence now returns its reward-control
package with its workbench node. Biome and project composition collect those
packages explicitly and reject duplicate semantic owners rather than silently
replacing a control in a later map.

**A2.4 transition note.** An authored-choice start passes its occurrence-owned
picker into, then back out of, occurrence assembly. Ordinary and mixed batches
return their target-pickers from the same physical-target and missing-target
products they render; this replaces the earlier raw-plan prepass. The local and
project composition boundaries reject duplicate picker owners. This does not
make room pickers authored leaves or change their existing availability policy.

**A2.5 transition note.** Each biome now returns its completed
focus-destination map. Marker registration and redirects remain a local mutable
builder within that single semantic stage; project composition validates and
merges the returned maps before adding route and generic-finding destinations.
This does not redesign focus semantics or move the React default-inspector
fallback.

#### A3: Specialized Hub and room-local assembly

- project Hub board/visits, Ephyra side rooms, Fields, Ship wheels, and Shop
  leaves through the same semantic assembly contract;
- keep specialized facts with their semantic owners without creating a second
  workspace engine;
- preserve one reachable occurrence projection for nested and standalone
  workbench shapes.

#### A4: Interaction requirements and binding

- bind interactions through
  `WorkspaceSourceIndex + interaction requirements + injected services`;
- let requirements express semantic intent while the bounded source index
  supplies authored facts needed to construct commands;
- stop hidden registration and independent raw-project traversal;
- preserve lazy candidate loading and semantic command construction;
- prove requirement completeness against independently derived authored owners.

**A4.1 transition note.** Occurrence assembly now returns Ephyra side-room,
Ship, and materialized-Shop interaction packages alongside its room and reward
controls. Binding consumes those returned packages and one exact candidate
session; it no longer re-traverses raw authored occurrences for that family.
The independently derived authored-leaf audit remains separate: dormant
Ephyra side leaves stay intentionally published in this transition, while a
dormant Shop emits no package. Fields, batch, Hub, topology, and frontier
interaction families remain in the source-index binding until their own
complete requirements exist.

**A4.2 transition note.** Authored batch assembly now returns one
`batchControls` package for its published exit selection, authored base reward
store, and Fields cage outcome controls. Binding consumes that package and the
same bound candidate session; it no longer re-traverses raw decisions for
those maps. An independent authored topology and layout-policy audit verifies
the expected package identities before binding, including empty setup batches,
blocked or retained batches, and the null-versus-selected takeover reward-store
policy. Hub, topology/removal, takeover action, start, and frontier families
remain in the source-index binding until their own complete requirements
exist.

**A4.3 transition note.** Authored Hub assembly now returns one `hubControls`
package for every declared board slot and each authored or structural-next
visit. Binding consumes that package and the same bound candidate session; it
no longer re-traverses raw Hub decisions for those maps. The independent audit
checks exact slot ownership, selected occurrences, closure commands and their
full downstream-removal scope, plus exact visit choice sets. A board outline
emits no package. A newly authored, empty board intentionally retains its
otherwise locked structural-next Visit 1 interaction, preserving the existing
internal projection contract while the UI keeps that row non-actionable.

**A4.4 transition note.** Authored biome assembly now returns one
`topologyRemovals` package containing its clear-topology control and every
non-Hub exit-decision removal whose core removal impact is defined. Binding is
an exact mechanical handoff because these controls have no candidate or
service-derived data. An independent persisted-topology audit verifies exact
owners, commands, and all downstream-removal scope arrays, including retained
or disconnected suffixes and Hub-source Preboss exits. Hub boards themselves
still have no generic removal control; Hub-slot closure remains owned by the
`hubControls` package. Subsequent A4 slices move starts and takeover actions
before the coupled frontier capability and structural-action family.

**A4.5 transition note.** Topology-free biome assembly now returns one `start`
package, preserving declaration-fixed versus authored-choice start policy.
Binding resolves catalog labels and candidate room declarations through the
already-bound candidate session without loading candidates during workspace
projection. An independent plan/layout audit requires a package only while
topology is null and rejects one once authored topology exists; direct closure
preserves exact fixed-start facts without defeating laziness. Takeover actions
are now returned by their own package; frontier capabilities and structural
actions remain in the source-index binding until their own cohesive requirement
exists.

**A4.6 transition note.** Biome assembly now returns one `takeoverBatch`
requirement for every currently published takeover interaction: candidate
create/replace, retained all-takeover repair, declaration-fixed width-one
Preboss creation, and the completed-Hub handoff. Requirements carry exact
authored target identities, physical-exit keys, replacement impact, and
declaration candidate domains; binding supplies catalog labels and the already
bound candidate session without loading candidate values during projection.
The independent persisted-topology, layout-policy, and structural-frontier
audit verifies all four presentations, including retained/disconnected suffixes
and a frontier replacement without an impact preview. The remaining raw
frontier pass can only advertise and verify a bound takeover action; its
capability and structural-action products move together in the next cohesive
slice.

#### A5: Presentation, focus, and closure

- derive decision-highlight rails and exact inspector destinations from the
  semantic assembly;
- project a default inspector destination for every supported workspace state;
- prove that projected defaults satisfy the entry characterization matrix
  before React consumes them;
- validate authored leaf expectations, interaction coverage, marker
  uniqueness, occurrence lifecycle classification, and semantic reachability
  against independently derived expected owners;
- reduce the workspace service to staged composition, caching, and final
  product assembly.

#### A6: Exact React consumption and campaign closure

- replace `roomOwnsAddress`, `nodeOwnsAddress`, `nodeForAddress`, and
  domain-derived `fallbackSubject` logic with projected destinations;
- delete the React fallback only after projection/React equivalence passes for
  every characterized default-inspector state;
- split React workbenches only where the projection now exposes a stable
  ownership boundary;
- keep candidate loading inside `useWorkspaceInteraction`;
- preserve keyboard, focus, findings, Undo/Redo, autosave, and recovery
  behavior;
- run the complete Campaign A gate and record its architecture evidence.

Campaign A closes when planner projection, workspace contract, candidate
interaction, authored-first, decision-highlight rail, Hub, malformed-state,
focus, React, product-loop, performance, and deterministic-output fixtures
pass. Commit 5b.3 and Commit 5b.4 may then resume without waiting for the
remaining campaigns.

### Campaign B: Candidate Evaluation

#### B1: Public contract and exact session-bound sources

- split query/result types from implementation;
- keep identity assertions, batching, observation, and lazy evaluation at the
  exact project/evaluation session boundary;
- expose narrow source accessors for family preparation without assembling a
  universal candidate context.

#### B2: Structural candidate families

- introduce family-specific contexts for start-room, ordinary/takeover target,
  Hub slot/visit, side-generation, and side-entry-order evaluation;
- extract those evaluators without reacquiring project evaluation;
- retain progressive repair and typed unavailable-context evidence at their
  actual semantic owners.

#### B3: Room-local candidate families and dispatcher

- introduce separate reward, lifecycle, and Shop preparation products;
- extract reward-store, incoming/local reward, Fields, Ship wheel, and Shop
  evaluators;
- leave a thin exhaustive session dispatcher over the public query union;
- preserve query batching, lazy work observation, and exact result ordering.

If B2 or B3 is too broad, split it by complete semantic family. Do not create a
standalone "prepared context" commit or pass unrelated Hub, history, reward, and
lifecycle facts to every evaluator.

Campaign B closes when engine candidate fixtures, application candidate
architecture tests, deterministic results, performance work counts, typecheck,
and the complete engine gate pass.

### Campaign C: Authored Core

#### C1: Authored room-state responsibilities

- separate declaration-owned defaults, room-replacement reconciliation, and
  persisted decoding;
- keep one deliberate authored room-state public surface;
- preserve complete declaration defaults, dormant values, invalid-state
  retention, and current decode failures.

#### C2: Authored topology read model

- extract declared physical exits, selection queries, fixed-width takeover
  facts, and other non-mutating topology resolution;
- define immutable facts consumed by commands, validation, simulation, and
  workspace projection;
- prevent consumers from repeating physical-exit or ownership traversal.

#### C3: Authored topology codec and validation

- separate raw decoding from semantic topology validation;
- make the dependency on the topology read model explicit;
- preserve current schema rejection and incomplete-state behavior.

#### C4: Occurrence-state command families

- retain one exhaustive occurrence-command dispatcher;
- extract only room replacement, incoming/local reward, Fields, Ship wheel,
  Ephyra side-room, and Shop transitions whose dependencies are genuinely
  narrow;
- share explicit occurrence lookup and reconciliation products rather than a
  broad command context.

#### Conditional C5: Topology command families

After C2 and C3, audit the remaining topology-command aggregate:

- if start, batch, takeover, Hub, selection, repair, and removal transitions
  now have narrow dependencies, move those cohesive families behind the
  exhaustive dispatcher;
- if they still share atomic downstream-removal, replacement, handoff, or
  validation invariants, retain the aggregate and record why it remains the
  healthier responsibility boundary;
- do not create an empty commit when the correct decision is to retain it.

Campaign C closes when authored-project, codec, command, topology-impact,
catalog where affected, import-direction, and deterministic project fixtures
pass.

### Campaign D: Ordered Engine State Flows

History and reward movement is vertical. No commit merely wraps the current
loose variables in a state object for a later commit to rewrite again. A state
product contains mutable state-machine facts only; catalog services and source
lookups remain separate inputs rather than becoming another dependency bag.

#### D1: History fold state and event transitions

- introduce typed fold state for ledgers, room views, active lifecycle facts,
  target generation, biome completion, and transition state;
- move each closed event family with the state transition that handles it;
- keep one chronological loop and exhaustive event dispatch visible;
- isolate initialization and final freezing;
- preserve deeply identical ordered history products under current fixtures.

#### D2: Reward sources, state, and event transitions

- build immutable snapshot/history lookup products before chronological reward
  processing;
- move target creation/offer processing and lifecycle
  acquisition/wheel/Shop/completion processing as vertical semantic families;
- introduce only the reward state required by the event families moved in the
  same commit;
- keep one visible chronological loop and exhaustive event dispatch;
- preserve possibility branching, physical offer order, candidate context
  capture, and exact lifecycle checkpoints.

The opening Campaign D audit decides whether reward work is one vertical commit
or two complete event-family commits. A state-only extraction is not an
allowed boundary.

#### D3: Program closure

- consolidate, rather than first introduce, import-DAG, composition-root,
  React-authority, exact project/evaluation, and semantic-reachability
  evidence;
- run the complete repository gate and compare performance work counts;
- absorb stable boundary clarifications into owning design documents;
- record campaign evidence in `IMPLEMENTATION_PROGRESS.md`;
- retire this temporary plan and release Commit 5c.

## Per-Commit Review Contract

Every commit must answer these questions in its diff or commit message:

1. What semantic authority is being isolated?
2. What are the stage's explicit inputs and returned product?
3. Which collaborators are injected, and where are they constructed?
4. Which imports became legal, illegal, or unnecessary?
5. Which old hidden or duplicate path was removed?
6. Which fixtures prove identical behavior?
7. Does the next commit build on a complete usable boundary rather than a
   compatibility bridge?

Movement commits must not contain opportunistic behavior fixes. If the move
reveals a real defect, preserve it with a focused fixture, complete the
reorganization commit, and fix it in a separately authorized change.

## Audit Matrix

The following audits are required at the start of each affected campaign and
again at closure:

| Audit                       | Evidence                                     | Passing condition                                                                                                   |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Authority-to-consumer trace | Product signatures plus review               | Every important product has one named producer, explicit inputs, and identifiable consumers.                        |
| Import graph                | Automated import rule or architecture test   | No cycle exists; imports follow the declared package and subsystem direction.                                       |
| Dependency injection        | Composition fixture plus review              | Application services are constructed at the composition root; stage dependencies are narrow and explicit.           |
| Hidden registration         | Returned-product closure fixture plus review | A later stage does not depend on maps or registries populated only as a side effect of producing an earlier result. |
| Semantic ownership          | Runtime closure fixtures                     | Authored owners, findings, controls, and inspector destinations resolve by stable semantic address.                 |
| Duplicate reconstruction    | Boundary rule plus review                    | React and downstream projections do not repeat physical-exit, containment, eligibility, lifecycle, or reward rules. |
| Mutation boundary           | Review                                       | Mutable builders are local to one stage and freeze a complete returned product before crossing the boundary.        |
| Exhaustive dispatch         | Typecheck plus family fixtures               | Closed command, event, and candidate vocabularies retain explicit exhaustive handling.                              |
| Public surface              | Typecheck plus import fixture                | Existing supported imports remain deliberate; temporary compatibility barrels do not survive closure.               |
| Test authority              | Review                                       | Tests live beside the product or boundary they verify and do not assert incidental file layout.                     |

Automate a property only when it is observable through imports, types, or
runtime products. Do not add brittle source-token assertions for architectural
judgments such as cohesion or hidden registration; those remain explicit
review obligations supported by product-completeness fixtures.

The final human-readable acceptance statement is:

> A maintainer can follow each semantic product from authority to consumer
> without hidden registration, duplicated reconstruction, circular imports, or
> dependencies acquired outside the composition root and explicit stage inputs.

## Preserved Behavioral Invariants

- Workspace projection consumes the exact atomic authored project/evaluation
  pair and preserves identity-based caching.
- Rendering a workspace performs no candidate evaluation.
- Candidate evaluation remains lazy and bound to the prepared pair.
- Authored topology is projected before optional evaluated overlays.
- The workspace source index remains an addressed lookup product and does not
  become topology, eligibility, or lifecycle authority.
- Assembly consumes one authored occurrence/leaf-lifecycle classification,
  while closure retains an independently derived expected side.
- Evaluation may add genuine derived lifecycle facts but cannot create, remove,
  or replace persisted authored owners or editable offer-time leaves.
- Incomplete and context-invalid authored state remains representable,
  reachable, and editable.
- Findings never hide authored controls.
- Each expected authored leaf has one exact interaction and reachable
  containing inspector.
- Decision-highlight rails remain selective presentation over an exhaustive
  workspace.
- Default inspector selection preserves the characterized frontier, incomplete
  decision, active-detail, entry, and empty-state priority.
- N remains `Opening -> PreHub -> Hub -> Preboss` with visits nested under Hub.
- Topology mutations remain explicit semantic commands with one Undo/Redo
  transition.
- History and reward evaluation retain total chronological order.
- Simulation models possibility, not probability.
- Deterministic inputs retain deeply equal immutable outputs.
- No production UI, schema, catalog, game rule, or simulator result changes as
  part of the reorganization.

## Verification

Use the narrowest truthful lane during each commit:

- core authored and engine movement: `npm run test:engine`;
- normalized catalog boundary movement: `npm run test:catalog`;
- workspace and React movement: `npm run test:planner`;
- application capability/import changes: `npm run test:contract`;
- cross-layer interaction changes: `npm run test:product`;
- all commits: affected workspace typechecks, lint/format checks, and
  `git diff --check`.

Run `npm run check` at the end of each campaign and before closure. Preserve the
current representative performance fixtures and compare their work counts, not
only elapsed wall time.

### Executable Campaign A Work Baseline

Before A1 changes production structure, make these named fixtures assert the
baseline directly:

- `apps/planner/test/architecture/candidateRenderPurity.interaction.test.tsx`:
  every representative render performs exactly zero `projectEvaluation` events
  and zero candidate `queryBatch` events after setup;
- `apps/planner/test/architecture/candidateInteractions.test.ts`: constructing
  the representative Underworld and Surface workspaces performs exactly two
  explicit project evaluations in total; every cold representative interaction
  emits its recorded positive `queryBatch` count (one for every family except
  the cooperative `rewards` family, which emits fourteen declaration-owned
  batches); and a repeated load emits no additional query batch or project
  evaluation;
- `apps/planner/test/product-loops/UnifiedBiomePerformance.test.ts`: for both
  representative routes, cold candidate activation emits exactly one
  `queryBatch`, representative edit publication emits exactly one
  `projectEvaluation`, cached Undo emits zero project evaluations, and the
  existing 750 ms interactive and 50 ms cached-Undo budgets remain unchanged.

If the pre-movement measurement disproves one of these expected counts, record
the truthful count in the fixture and this section before production movement;
do not silently relax it during the reorganization. Any later increase requires
an explicit reviewed reason.

The recorded pre-program complete gate of 60 test files and 630 tests remains
release evidence. It is not a substitute for these executable performance and
work-count baselines.

## Non-Goals

- no authored schema or codec-version change;
- no new biome, room, lifecycle, reward, or candidate rule;
- no Shop purchase-order implementation;
- no Commit 5b.3 or 5b.4 presentation work;
- no UI redesign, graph library, state-management replacement, or component
  framework;
- no generic event bus, plugin registry, dependency-injection container, or
  pipeline abstraction;
- no declaration compression or metaprogramming;
- no file-size, export-count, or directory-count quota;
- no performance optimization without measured evidence;
- no broad public API cleanup unrelated to the dependency direction;
- no compatibility layer left behind after a moved responsibility.

## Closure and Retirement

This plan is complete only after the foundation and all four campaigns pass
their gates, the complete repository gate passes, and the final audit matrix
has no unresolved ownership or import finding. Campaign A completion may
temporarily return active delivery to Commit 5b.3/5b.4 while this document
continues to own the remaining pre-5c campaigns.

Durable results belong in:

- `ARCHITECTURE.md` for dependency direction, composition, and stage-product
  boundaries;
- `AUTHORED_PROJECT_MODEL.md` for authored-state and command ownership;
- `SIMULATION_AND_VALIDATION.md` for history, reward, and candidate composition;
- `EDITOR_MODEL.md`, `CONTEXTUAL_EDITOR_UX.md`, and
  `STRUCTURED_EDITOR_WORKSPACE.md` for workspace products, interactions,
  semantic destinations, and React consumption;
- `IMPLEMENTATION_PROGRESS.md` for delivery evidence.

After absorption, delete this temporary file in the closure commit and point
the active delivery wording at the next truthful feature frontier.
