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
explicit assembly output, A2.4 did the same for room pickers, and A2.5 made
completed biome focus destinations an explicit assembly output. A3 closed
the shared occurrence assembly for Hub, Ephyra, Fields, Ship, and Shop room
details, including an explicit withheld Ephyra side-room surface. A4.1 now
returns and binds the first occurrence-owned non-reward interaction packages
explicitly. A4.2 does the same for authored batch controls. A4.3 does the same
for authored Hub board slots and visits. A4.4 does the same for generic authored-topology
removals. A4.5 does the same for topology-free authored starts. A4.6 does the
same for takeover batches. A4.7 does the same for the coupled frontier
capability and structural-action family. A4.8 extracts those now-closed
requirement contracts and their exact binding transformation without moving
semantic assembly or its independent audits. A5.1 now publishes one explicit
default inspector destination from the final workspace products. A6 now binds
every biome-local exact focus owner to a final inspector subject and optional
rail selection, so React resolves only projected keys and no longer recreates
containment or fallback policy.

A1 through A11 delivered the workspace contract correction, interaction-binding
boundary, projection-owned inspector destinations, exact React consumption, and
the first internal workspace reorganization. A7 separated marker/occurrence
assembly, A8 separated decision and topology-interaction assembly, A9 separated
Hub and biome semantic assembly, A10 separated independent expectations and
closures, and A11 separated biome presentation from the cached service facade.

A fresh post-A11 read reopens Campaign A for two bounded contraction commits.
The family and dependency seams are worth keeping, but A2.2 and A4 expanded
their verification into parallel semantic models: occurrence leaves are fully
classified once for assembly and again for independent leaf closure; interaction
policy is fully reconstructed on an expected side and then checked again at the
requirement-to-binding and rendered-product boundaries. A12 removes the
production shadow-authored models and relocates any valuable independent
expectations to tests. A13 removes the remaining post-build production
self-audits, trims the public workspace entry to deliberate consumers, and
closes the final import matrix.
Commit 5b.3 in
[`WORKSPACE_PRESENTATION_POLISH.md`](WORKSPACE_PRESENTATION_POLISH.md) is paused
until that contraction gate passes. Campaign B remains separate.

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

| Area                                                 | Current mixed responsibilities                                                                                                                                                                                                     | Required correction                                                                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/planner/src/projections/structured-workspace/` | Source lookup, authored/evaluated overlay, room and Hub assembly, candidate interaction construction, rail presentation, focus registration, and several closure audits share one projector and broad mutable context.             | Turn workspace projection into an explicit sequence of immutable products with a thin public service facade.                                                                                       |
| `MutableProjectionContext` and `projectOccurrence`   | Catalog/evaluation facts, findings, route/biome identity, focus destinations, room controls, and reward controls are accumulated together. A projection function returns a node while also registering products for later phases.  | Pass stage-specific inputs. Each stage returns every product later stages consume. Local builders may mutate privately, but cross-stage products cannot be discovered through prior side effects.  |
| Workspace interaction binding                        | The former catalog builder combined binding mechanics with the projector, obscuring its input boundary and encouraging more semantic traversal there.                                                                              | Bind every public interaction map from explicit requirements plus catalog/project/evaluation and injected services; verify the transformation in focused tests rather than production self-audits. |
| `BiomeWorkspace.tsx`                                 | `roomOwnsAddress`, `nodeOwnsAddress`, `nodeForAddress`, and `fallbackSubject` reconstruct semantic containment and default inspection despite the projection already publishing focus information.                                 | Project exact explicit and default inspector destinations. React resolves keys and renders; it does not rediscover semantic ownership.                                                             |
| `simulation/candidates/index.ts`                     | Public query/result contract, evaluation recovery, progressive repair, every candidate family, and session dispatch share one module.                                                                                              | Separate the public contract, exact session-bound sources, family-specific preparation products, candidate-family evaluators, and a thin dispatcher.                                               |
| `simulation/rewards/biome.ts`                        | Snapshot indexing, mutable evaluation state, event-family handling, candidate context capture, support recording, and final projection are interleaved in one chronological loop.                                                  | Keep the chronological coordinator visible, but give it an explicit state product, source indexes, and event-family handlers.                                                                      |
| `simulation/history/fold.ts`                         | Ledger initialization, active lifecycle bookkeeping, event validation, per-event mutation, view capture, and final freezing are interleaved around many loose maps and variables.                                                  | Define one fold-state product and explicit handlers for the closed history-event families. Preserve total event order and strict dispatch.                                                         |
| `authored-project/roomState.ts`                      | Declaration defaults, room-replacement reconciliation, and persisted decoding occupy one module despite having different callers and failure contracts.                                                                            | Separate default construction, replacement reconciliation, and codec validation behind one authored room-state public boundary.                                                                    |
| `authored-project/topology.ts`                       | Physical-exit resolution, topology queries, takeover facts, structural validation, and persisted decoding are coupled.                                                                                                             | Separate the authored topology read model from validation and decoding while retaining one public topology contract.                                                                               |
| `commands/occurrence-state.ts`                       | Room replacement, incoming/local rewards, Fields, Ship wheels, Ephyra side rooms, and Shop changes share lookup and mutation machinery despite having distinct leaf contracts.                                                     | Extract only command families with narrow transition dependencies while retaining one exhaustive occurrence-command dispatcher.                                                                    |
| `commands/unified-topology.ts`                       | The public exhaustive dispatch is valuable, and its start, batch, takeover, Hub, selection, repair, and removal operations share several atomic topology invariants.                                                               | Extract topology read/transaction primitives first, then split command families only if the dependency audit proves the aggregate is no longer the more cohesive owner.                            |
| `catalog-schema` and `reward-kernel` types           | `CatalogCollection` is declared by catalog schema, while catalog schema imports reward-kernel types and reward-kernel imports the collection type back. The cycle is type-only today but expresses the wrong conceptual ownership. | Move normalized collection primitives to a neutral engine module below both consumers and add a focused import-direction guard.                                                                    |

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
       ├-> WorkspaceOccurrenceProjectionFacts
       │    - details activation by occurrence
       └-> shared Fields active-cage facts
            - active-cage count by decision
source index + both sibling fact products
  -> WorkspaceSemanticAssembly
       - structural nodes
       - authored/evaluated markers
       - interaction requirements
       - semantic destination requirements
       ├-> WorkspaceInteractionBinding
       │    consumes exact catalog/project/evaluation + requirements + injected services
       └-> WorkspacePresentation
            - decision-highlight rail
            - exact focus destinations
            - default inspector destinations
  -> StructuredWorkspaceProjection
```

The corresponding verification flow is test-only and lives outside production
`src/` code:

```text
catalog + persisted authored state
  -> independent expected owners, leaves, and controls (identity and visibility)
production workspace products
  -> test-time semantic reachability, destination, and interaction assertions
```

The source index is authored-first and lookup-only. It indexes semantic
addresses to raw authored owners, stable authored order, evaluation overlays,
and findings. It does not decide physical exits, eligibility, takeover policy,
topology repair, lifecycle behavior, or other facts owned by the pure core.
Evaluation adds assessment and lifecycle facts but cannot create, remove, or
replace persisted authored owners or their editable offer-time leaves.

Occurrence projection facts contain only authored `detailsActive` state.
One narrow Fields active-cage derivation feeds both occurrence and decision
assembly; neither owner recomputes it or depends on the other's facts product.
Occurrence assembly validates declaration/state coherence before any
publication branch, so unknown or missing Ephyra side-room slots still reject
malformed authored input when details are dormant. The assembler then applies
declaration-specific publication policy while building the actual room product.
Independent tests derive expected owners, published leaves, and structural
controls from persisted authored state and declarations. They catch a missing
Ephyra, Shop, Fields, Ship, reward, or topology control without shipping or
executing a second exhaustive model in the application.

One structurally owned Room Occurrence receives one reachable occurrence
projection. Ordinary offers may be nested in a decision workbench rather than
rendered as standalone nodes. The invariant is one reachable semantic
owner/control package, not one UI-node shape.

Declared physical exits are the exits resolved from the current authored
batch/layout state. The projection does not invent blank controls for
potential-but-inactive exits.

Test closure validates semantic-owner reachability. Every expected authored
topology owner and leaf must resolve to its containing inspector, and every
expected control identity must resolve to its exact interaction even when its
room or reward is nested in a decision workbench. The expected side is derived
independently from persisted authored state, not from the rendered node
collection being checked.

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
The original sixteen-to-twenty-commit estimate is superseded by the completed
review history and the current code audit. Foundation plus twenty-three Campaign
A review commits are delivered through A11; A12 and A13 are the final bounded
contraction units. With the later campaign ranges below, the truthful program
estimate is thirty-six to thirty-nine implementation commits, not an exact
quota. A boundary may merge
when it would otherwise rewrite the same transition twice, or split when a
vertical semantic family is too large for truthful review.

Every intermediate revision remains type-correct, tested, and free of
temporary compatibility machinery. The sequence below is the default:

```text
neutral dependency anchor
  -> Campaign A: workspace and React
  -> contraction checkpoint: A12 and A13
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

| Work                            |          Review commits | Relative size                     | Primary risk                                                                   |
| ------------------------------- | ----------------------: | --------------------------------- | ------------------------------------------------------------------------------ |
| Neutral dependency anchor       |             1 delivered | Small                             | Unnecessarily changing external import surfaces                                |
| Campaign A: workspace and React | 23 delivered, 2 pending | Extra-large                       | Losing authored reachability, focus, or lazy interaction behavior              |
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

Campaign A is the prerequisite for Commit 5b.3 to resume. A1 through A6
established the necessary returned products and consumer boundary; A7 through
A11 completed the corresponding private ownership boundaries. A12 and A13 now
contract redundant representations around those boundaries before the campaign
closes. Exact filenames follow returned products, not a file-count target.

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

**A2.2 completion note.** The facts distinguish an authored leaf's lifecycle
from whether the current semantic product publishes it. Dormant Fields and
Ship leaves remain published and editable by design. Dormant Shop inventory and
Ephyra side-group, side-child, and side-reward leaves are withheld. Ephyra's
main incoming reward remains offer-time data and therefore remains published.
`detailsActive` is authored activation rather than evaluated entry, so an
authored-active Ephyra room continues to publish its side surface even when
evaluation is invalid or incomplete.

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

**A3 completion note.** Hub visits and standalone workbenches both call the
same occurrence assembly. Fields cages, Ship wheels, Shop inventory, and
Ephyra details remain declaration-specific products returned from that stage.
Ephyra side details are a discriminated `published`/`withheld` semantic
surface: dormant values remain authored but create no markers, controls,
candidate interactions, or focus destinations. React renders the returned
surface rather than hiding otherwise-published controls.

#### A4: Interaction requirements and binding

- bind interactions through a named `WorkspaceInteractionBindingInput` of
  catalog/project/evaluation, interaction requirements, and injected services;
- let requirements express semantic intent while the already-bound candidate
  session supplies contextual facts needed to construct commands;
- stop hidden registration and independent raw-project traversal;
- preserve lazy candidate loading and semantic command construction;
- prove requirement completeness against independently derived authored owners.

**A4.1 transition note.** Occurrence assembly now returns Ephyra side-room,
Ship, and materialized-Shop interaction packages alongside its room and reward
controls. Binding consumes those returned packages and one exact candidate
session; it no longer re-traverses raw authored occurrences for that family.
The independently derived authored-leaf audit remains separate: dormant
Ephyra side leaves and dormant Shop inventory emit no package, while authored-
active invalid or unassessed details remain published. Fields, batch, Hub,
topology, and frontier interaction families remain in the source-index binding
until their own complete requirements exist.

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
are returned by their own package in A4.6; the coupled frontier capability and
structural-action family follows in A4.7.

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
frontier pass is replaced by the A4.7 frontier package, which keeps capability
and structural-action products together.

**A4.7 transition note.** Biome assembly now returns one `frontier`
interaction package for every active structural frontier. An exit package owns
the exact capability map entry and its optional `createBatch` or
`createLinkedExit` action; a Hub-decision package owns `createHubDecision`.
Binding mechanically produces both public maps and no longer traverses source
routes to rediscover frontier policy. An exit advertises takeover only when its
active owner is unauthored and has a returned create requirement; existing
candidate, replacement, and repair controls remain node-owned rather than
becoming frontier permissions. An independent persisted topology/completeness
and layout-policy expected enumeration does not read rendered frontiers,
source-index lookup, other requirements, or bound maps; direct closure then
checks the exact capability, structural, and takeover-map handoff.

**A4.8 transition note.** The completed interaction contract families now live
in `interaction-requirements.ts`, and `interaction-binding.ts` owns the one
exact transformation from `WorkspaceInteractionBindingInput` to every public
interaction map. The binding module imports neither the projector nor the
source index and performs no topology/frontier traversal. Semantic producers,
independent expected-owner audits, closures, and assembly stay in the
projector, where they still share genuine authored topology and presentation
context. The small declaration lookup sits beneath both modules, so this
boundary does not create a reverse dependency. That placement was an A4
transition state, not the final Campaign A module boundary; A8 through A11 move
those remaining responsibilities without reopening interaction binding.

**A5.1 transition note.** Each projected biome now carries a nullable,
discriminated `WorkspaceDefaultInspectorDestination`: a direct frontier focus
and rail key, or a direct node and optional rail key. It is derived only after
the final entry, frontier, nodes, and rail exist; it does not read the source
index, raw topology, evaluation, candidates, or UI-session state. A structural
closure verifies exact node/frontier and rail resolution, while a
projection-level fixture matrix preserves the established priority: active
frontier (with its ordinary and Hub handoffs), last incomplete decision, last
active detail and its containing workbench, entry, first node, then empty.
`focusByOwner` remains the separate exact semantic-owner navigation product.
React intentionally continues to use its existing fallback in this slice; A6
will replace it only after equivalence is retained.

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

#### A6: Exact React consumption and boundary checkpoint

- replace `roomOwnsAddress`, `nodeOwnsAddress`, `nodeForAddress`, and
  domain-derived `fallbackSubject` logic with projected destinations;
- delete the React fallback only after projection/React equivalence passes for
  every characterized default-inspector state;
- split React workbenches only where the projection now exposes a stable
  ownership boundary;
- keep candidate loading inside `useWorkspaceInteraction`;
- preserve keyboard, focus, findings, Undo/Redo, autosave, and recovery
  behavior;
- run the complete A6 checkpoint gate and record its behavior and work-count
  evidence.

**A6 transition note.** Final workspace presentation now decorates each
biome-local `focusByOwner` destination after its marker, nodes, rail, frontier,
and A5 default exist. `inspectorSubject` is the renderable node or frontier;
`selectedRailKey` is separately optional because coarse owners and hidden
fixed-stage sources intentionally show an inspector without selecting a rail
stop. The pre-existing assembly `nodeKey` remains an internal containment route
and is not a React resolution contract. React resolves only those direct keys,
uses the A5 default only when there is no explicit owner, and leaves an
explicit-but-coarse or stale owner unselected. This preserves normal nested
offers, Hub board/visit/local-detail routing, fixed PreHub/Preboss stages,
completed-Hub handoff behavior, and keyboard focus without scanning room or
topology shape in React.

**A6 checkpoint evidence (2026-07-30).** The checkpoint found no unresolved
public-import, interaction-binding, hidden-registration, or React
reconstruction issue in the boundaries moved through A6. The workspace source
index remains address/source lookup only; pure-core topology policy remains
outside it. Occurrence assembly returns the authored room/reward/lifecycle,
interaction-requirement, and focus products used by Hub and ordinary
presentation. Final inspector destinations expose direct renderable subjects
and optional rail selection, so React does not reconstruct containment or
fallback policy. The lifecycle matrix proves dormant Ephyra side owners are
withheld while authored-active invalid Ephyra details remain editable, and a
fine-grained finding on a withheld leaf is rejected rather than misrouted.

`npm run check` passed with 65 test files and 668 tests, together with
typecheck, lint, formatting, and the production build. The named work-count
fixtures remained part of that gate: renders perform zero evaluation/candidate
queries, representative workspace construction performs two explicit project
evaluations, cold interaction loading performs its declared batch count and
then caches, and the product loop preserves one candidate batch per cold
activation, one project evaluation per edit, and zero work for cached Undo.
`git diff --check` also passed. The Vite chunk-size advisory is unchanged and
non-blocking.

That gate validates the delivered behavior and remains the baseline for A7
through A11. It does not close Campaign A's internal ownership work.

#### Campaign A completion correction

The post-A6 comparison against `f69dc709a8e36b72ae624855ab043c2a02264b8a`
found that the contract work created real seams but did not realize their
maintenance payoff:

- structured-workspace production code, excluding tests, grew from 5,781 lines
  in the former aggregate to 9,848 lines in the current directory;
- `BiomeWorkspace.tsx` shrank from 747 to 479 lines and no longer reconstructs
  semantic containment or fallback policy;
- the main projector nevertheless grew from 5,781 to 6,213 lines after its
  public contract and roughly 900-line interaction binder moved elsewhere;
- the remaining projector still mixes semantic family construction,
  presentation, independent expected-owner enumeration, closure validation,
  and service composition.

Those counts are diagnostic evidence, not acceptance quotas. The blocking
finding is responsibility and change neighborhood: a room-local, decision,
Hub, rail, or audit change still enters the same source module and broad
`MutableProjectionContext`. A1 through A6 remain valuable and are not reverted.
A7 through A11 finish the decomposition by moving existing complete products;
they do not add another layer of parallel contracts.

The remaining target flow is:

```text
WorkspaceBiomeSource
  -> biome semantic orchestrator
       owns private marker/preliminary-destination builder
       -> occurrence assembly
       -> ordinary/linked/topology and Hub assembly
       -> freeze markers and preliminary destinations after all families return
  -> WorkspaceBiomeSemanticAssembly
       -> biome rail/default/exact-destination presentation
       -> project-wide interaction binding
  -> independent authored-owner and final-product closure
  -> thin cached StructuredWorkspaceProjection service
```

Presentation and interaction binding are sibling consumers of semantic
assembly. Neither consumes the other's output or relies on the other to
complete semantic state.

Expected-owner enumeration remains a side path from catalog plus persisted
authored state. It must not consume the source index, semantic assembly,
rendered nodes, presentation, or bound interaction maps to discover what should
exist.

#### A7: Marker, focus-requirement, and occurrence assembly

- replace the broad marker/focus portion of `MutableProjectionContext` with one
  narrow biome-local marker and preliminary-destination builder plus an
  emit-only capability that cannot inspect accumulated state;
- keep ownership of that builder at the existing biome composition boundary
  during A7; A7 does not freeze or claim a completed biome marker/destination
  map because decision and Hub families have not moved yet;
- move room declaration resolution, reward summaries and controls,
  declaration-specific room-local projection, local-detail markers, occurrence
  interaction requirements, and `projectOccurrence` into one occurrence
  assembly module;
- define an exact occurrence input containing only catalog, biome identity,
  occurrence facts, optional evaluated-room overlay, optional room picker, and
  the narrow marker/destination collaborator;
- return the occurrence workbench, room and reward controls, and occurrence
  interaction requirements as one immutable product;
- preserve published/withheld Ephyra and Shop behavior, dormant Fields and Ship
  editability, authored-active invalid details, exact focus owners, and lazy
  interaction work;
- move or add occurrence-assembly fixtures beside that authority for ordinary,
  Ephyra, Fields, Ship, fixed, incoming-reward, and Shop states.

This commit removes the moved implementations from the projector. It does not
leave forwarding wrappers, export the builder, freeze a partial registration
map, or export a generic projection context. No occurrence consumer may read
registration state populated by an earlier occurrence.

**A7 transition note.** `marker-builder.ts` now owns the private biome-local
marker and preliminary-destination map, exposing occurrence and later-family
assemblers only an emit-and-redirect capability. `occurrence-assembly.ts`
returns immutable room-local node, control, and interaction-requirement
products. Its focused fixtures cover ordinary and fixed rooms, Ephyra,
Fields, Ship, Shop, incoming rewards, and evaluation-absent authored details.
The builder remains owned by biome composition until A9 freezes the completed
semantic product.

#### A8: Ordinary, linked, and topology-interaction assembly

- move ordinary and takeover batch targets, linked exits, physical missing and
  retained targets, repair scopes, room pickers, and decision focus redirects
  into a decision assembly product that consumes occurrence assembly;
- move start, topology-removal, takeover, and frontier requirement production
  into a topology-interaction assembly product over catalog, biome, layout, and
  persisted plan facts;
- keep declared physical-exit resolution and removal impact in the pure core;
  application assembly only adapts those returned facts into presentation and
  semantic-command products;
- define a closed `DecisionAssemblyInput` consisting of the current
  `WorkspaceBiomeSource`, its matching evaluated overlay, explicit catalog,
  an `assembleOccurrence` dependency that returns only
  `WorkspaceOccurrenceAssembly`, and the emit-only
  marker/preliminary-destination capability;
- limit topology-interaction assembly inputs to catalog plus that same
  immutable source; it invokes the declared pure-core layout, frontier, and
  removal queries itself and returns only requirement packages;
- return nodes, workbenches, controls, and requirement packages explicitly;
- do not pass `ProjectDocument`, contextual services, candidate sessions, or a
  catch-all workspace context into either assembly, and do not allow either
  assembly to inspect the marker builder's accumulated state;
- preserve incomplete, retained, disconnected, mixed, fixed-width-one,
  completed-Hub-handoff, and current frontier capability behavior under the
  existing fixtures.

Shared helpers introduced here must be narrow facts below both consumers, such
as removal-scope presentation or address equality. They must not combine
producer enumeration with audit enumeration.

**A8 transition note.** `decision-assembly.ts` now owns ordinary, mixed, and
takeover batch targets, linked exits, retained and missing physical targets,
room pickers, repair scopes, and their exact focus redirects. It consumes a
closed evaluated-overlay variant and an occurrence-product collaborator, never
the marker builder's accumulated state. `topology-interaction-assembly.ts`
returns only start, removal, takeover, and frontier requirement packages from
catalog plus `WorkspaceBiomeSource`; it has no marker, rendered-node,
candidate-session, or binding input. `topology-presentation.ts` and
`room-policy.ts` are deliberately narrow shared leaf facts, while the expected
takeover audit remains independently derived. The original entry, non-Hub,
Hub, then Hub-handoff ordering stays in biome composition.

#### A9: Hub and biome semantic assembly

- move Hub board, slots, visits, room-local workbenches, close impacts, main
  reward redirects, outline state, and Hub interaction requirements into one
  Hub assembly product that consumes the common occurrence assembler;
- introduce one named `WorkspaceBiomeSemanticAssembly` containing fields,
  entry, structural nodes, completion nodes, active frontier, preliminary
  destinations, completed markers, controls, and every producer-side
  interaction-requirement map;
- make the biome semantic orchestrator compose entry, non-Hub decisions, Hub,
  Hub-owned handoffs, and completion in authored order and return that complete
  product before presentation begins;
- make that orchestrator the sole private owner of the biome-local
  marker/preliminary-destination builder, pass only its emit-only capability to
  family assemblers, and freeze the completed maps only after every family has
  returned;
- delete `MutableProjectionContext` and every family-specific assembly function
  from `projector.ts` at this boundary;
- preserve the one reachable occurrence projection invariant and the exact N
  `Opening -> PreHub -> Hub -> Preboss` ownership and visit behavior.

The semantic assembly does not contain authored expected leaves, construct
rails, choose inspector defaults, bind contextual interactions, or run an
expected-owner audit.

**A9 transition note.** Hub assembly now owns declaration-owned Hub outlines
and authored boards, slot and visit overlay reconciliation, Hub room
workbenches, close impacts, Hub controls, and main-reward redirects. It
consumes the common occurrence-product request and derives visited and
canClose from that returned room product rather than re-reading lifecycle
facts. Biome semantic assembly privately owns the biome marker builder and
composes fields/frontier, entry, non-Hub decisions, Hub, Hub handoffs, and
completion in authored order. Its immutable WorkspaceBiomeSemanticAssembly
returns node, marker, control, occurrence-fact, and producer-requirement
products before audit or presentation begins. The facade now invokes that
product, retaining independent expected-owner audit and rail/default-inspector
work for A10 and A11. Direct Hub and semantic fixtures lock
outline/authored fallback, Hub-local focus, one occurrence workbench per
authored occurrence, finalized marker coverage, and N's
Opening -> PreHub -> Hub -> Preboss order.

#### A10: Independent expected-owner and closure modules

- move authored-leaf expectation, occurrence-fact agreement, marker and
  semantic reachability, expected interaction-requirement enumeration,
  requirement-to-bound-interaction closure, and final workspace interaction
  closure out of the projector;
- derive authored expected leaves solely from normalized catalog declarations
  plus persisted authored state; do not obtain them from source indexes,
  evaluated overlays, occurrence products, or semantic assembly;
- separate the independently derived expected side from closures that inspect
  final products, even if both live under an `audit/` projection area;
- allow the expected side to import authored/catalog contracts, pure-core
  topology functions, workspace contracts, and requirement types only;
- prohibit the expected side from importing source-index, occurrence,
  decision, Hub, biome semantic assembly, rail presentation, inspector binding,
  or interaction-binding modules;
- share only address/equality helpers and direct pure-core facts; do not share
  owner enumeration or package construction between producer and expected
  paths;
- keep the deliberate public closure-audit seam available through the workspace
  entry while removing its implementation from the projector;
- retain omission, duplicate-owner, malformed overlay, withheld-leaf finding,
  and exact-interaction mutation fixtures beside the corresponding audit.

**A10 transition note.** The `audit/` area now separates expected-side
enumeration from product-facing verification. `authored-leaf-expectations.ts`
and `authored-interaction-expectations.ts` consume only authored/catalog
contracts, direct pure-core facts, workspace contracts, and requirement types;
they do not import source, assembly, presentation, destination, or binding
products. Requirement agreement, semantic marker reachability, and bound/final
interaction closure consume completed products in separate modules. The public
workspace barrel re-exports the established closure seams directly from those
owners. Architecture coverage prevents expected modules from gaining a
product-authority import, and focused audit fixtures cover authored activation,
fact disagreement, omitted markers, withheld finding owners, and exact bound
interactions while the existing public workspace fixtures retain malformed,
duplicate-owner, and complete interaction-family coverage.

This is a movement and dependency-enforcement commit. It does not reduce audit
strictness merely to make extraction easier.

#### A11: Biome presentation and thin service facade

- move rail filtering/grouping, decision summaries, Hub visit rail entries,
  frontier placement, default-inspector selection, and exact inspector/rail
  destination binding into one biome presentation transformation over
  `WorkspaceBiomeSemanticAssembly`;
- keep biome presentation and project-wide interaction binding as sibling
  consumers of semantic assembly: presentation does not consume bound
  interactions, and interaction binding does not consume rails or inspector
  destinations;
- make the remaining projector own only source-index creation, ordered
  route/biome stage composition, project/route markers and coarse finding
  destinations, project-wide interaction binding, audit invocation,
  identity-based caching, and final immutable result assembly;
- add an import-direction rule or architecture fixture for the final internal
  graph without asserting incidental filenames or line counts;
- remove every superseded helper, compatibility export, and parallel path in
  the same commit;
- record the final responsibility inventory and production-line comparison as
  diagnostic evidence; any net production growth during A7 through A11 must be
  explained by a new enforceable boundary or fixture rather than duplicated
  assembly;
- run the complete Campaign A gate and repeat the named work-count baselines.

There is no numeric projector-size acceptance quota. The passing condition is
that the facade contains no occurrence, room-local, decision, Hub, rail,
expected-owner, or interaction-family construction/validation logic. A
maintainer must be able to change one such family in its owning module and
tests without entering the facade or an unrelated family.

**A11 transition note.** `biome-presentation.ts` now transforms one completed
`WorkspaceBiomeSemanticAssembly` into the final biome rail, Hub visit groups,
default inspector, and exact inspector/rail destinations. `marker-ownership.ts`
is a contract-only marker package shared by assembly, presentation, and
product-facing closure without letting any of those consumers acquire another
family's construction authority. The cached projector facade now composes
source indexes, semantic assembly, presentation, independent audits, route and
project markers, project-wide interaction binding, caching, and final freezing;
it contains none of the moved occurrence, decision, Hub, rail, or closure
construction paths. Focused presentation fixtures cover generated and Hub rail
policy, hidden Hub scaffolds, visit workbench identity, default selection, exact
destinations, and decision marker aggregation. The architecture fixture enforces
the final sibling directions and protects neutral marker ownership.

#### A11 responsibility inventory

| Product or concern                      | Named owner                                                | Direct inputs and consumers                                                          |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Authored/evaluated lookup               | `source-index.ts`                                          | Catalog, atomic project/evaluation -> biome semantic assembly and facade composition |
| Room-local occurrence package           | `occurrence-assembly.ts`                                   | One occurrence plus projection facts -> decision and Hub assembly                    |
| Ordinary, linked, and topology packages | `decision-assembly.ts`, `topology-interaction-assembly.ts` | Authored decision/layout facts -> biome semantic assembly                            |
| Hub board and visit package             | `hub-assembly.ts`                                          | Authored Hub topology and declarations -> biome semantic assembly                    |
| Complete biome semantic product         | `biome-semantic-assembly.ts`                               | Source-index product -> presentation, interaction binding, and product-facing audits |
| Rail/default/destination presentation   | `biome-presentation.ts`                                    | Semantic assembly -> facade composition                                              |
| Exact executable interactions           | `interaction-binding.ts`                                   | Project-wide semantic requirements and services -> facade composition                |
| Independent expectations and closure    | `audit/`                                                   | Catalog plus persisted state, then completed products -> facade assertion points     |
| Final cached workspace                  | `projector.ts`                                             | Returned stage products -> public projection service                                 |

The final production line is deliberately branched rather than serializing
presentation through interaction binding:

```text
WorkspaceBiomeSource
  -> WorkspaceBiomeSemanticAssembly
       ├-> biome presentation
       └-> project-wide interaction binding
catalog + persisted authored state
  -> independent authored-owner expectations
semantic products + presentation + bound interactions + expectations
  -> final closure
  -> cached workspace facade
```

The A6 diagnostic baseline was 9,848 non-test structured-workspace lines and a
6,213-line projector. A7 through A11 measured 9,984, 10,226, 10,438, 10,716,
and 10,758 non-test lines respectively; the final facade is 349 lines. The
42-line A10-to-A11 increase names the immutable presentation product, its
narrow rail-policy fact, and contract-only marker ownership rather than copying
assembly into a parallel path. The accompanying direction fixture is test code,
not hidden production machinery. The count is diagnostic evidence: the actual
enforcement is the returned-product boundaries, focused fixtures, and import
directions above.

The A11 complete gate proves the structural decomposition and remains its
behavioral baseline. It is not the final Campaign A closure: the post-A11
contraction read below supersedes the earlier decision to resume Commit 5b.3.

#### Campaign A contraction correction

The post-A11 read agrees with the direction of A1 through A11 but not with all
of the machinery accumulated to prove it. The subsystem now has a clear
349-line facade and family-owned assembly modules, yet its non-test production
area is 10,758 lines compared with the 5,781-line pre-refactor aggregate. That
growth is not itself the defect. The defect is that several changes still have
to be made twice and then compared at runtime:

- `occurrence-facts.ts` builds exhaustive leaf address, lifecycle, and
  publication tables, but occurrence assembly consumes only `detailsActive`
  and the optional Fields active-cage count. The exhaustive table exists mainly
  to compare with the separately enumerated authored-leaf requirements.
- `audit/authored-interaction-expectations.ts` reconstructs batch, Hub,
  topology-removal, start, takeover, and frontier policy from raw authored and
  catalog state. The producer modules construct essentially the same payloads,
  and `audit/authored-requirement-closure.ts` compares the two field by field.
- `interaction-binding.ts` already exhaustively transforms requirements and
  rejects duplicate bound keys. `audit/interaction-closure.ts` then compares
  every requirement family with its bound product before the final workspace
  closure again verifies that each rendered or declaration-required control has
  an exact interaction.
- the public workspace entry names 74 contract types, 36 of which have no
  named consumer outside the private structured-workspace directory. This is a
  boundary-clarity issue, not a reason to split the contract by line count.

The healthy boundaries remain unchanged:

- authored-first source lookup remains one address/source index;
- occurrence, decision, topology, Hub, and biome assembly remain separate
  returned products;
- producer-side interaction requirements remain the explicit semantic handoff
  to one project/evaluation-bound binder;
- biome presentation and interaction binding remain sibling consumers;
- React continues to consume projected inspector subjects and exact semantic
  interactions without topology reconstruction;
- persisted topology, declaration-required editable leaves, and structural
  controls retain independently derived test coverage.

The contraction therefore removes shadow representations, not the explicit
flow. It does not fold families back into the facade, move policy into React,
or replace the typed requirement maps with a generic registry, service locator,
event bus, or dependency-injection container.

#### A12: Remove production shadow-authored models

- narrow occurrence projection facts to `detailsActive` by occurrence, and
  make Fields active-cage count one shared, narrowly named derivation keyed by
  decision and consumed by both occurrence and decision assembly; neither
  owner may recompute it or depend on the other's facts product;
- remove leaf arrays plus lifecycle/surface lookup APIs from production
  occurrence facts, and stop returning those transient facts as part of the
  completed biome semantic product after occurrence assembly has consumed
  them;
- relocate declaration/state coherence checks now hidden in leaf enumeration
  into occurrence assembly's always-run local input invariant before
  publication policy. In particular, unknown or missing Ephyra side-room slots
  must reject malformed authored input even while its details are withheld;
- remove authored-leaf and authored-interaction expectation construction from
  the production projection path;
- move independently derived owner, leaf, and structural-control identity and
  visibility expectations into `apps/planner/test/` support only where they
  catch a distinct omission better than direct family fixtures. Do not
  transplant the field-by-field interaction-payload mirror into test support;
  direct family and binder mutation fixtures own payload behavior;
- delete the production authored-requirement agreement pass rather than
  replacing its field-by-field payload comparison with another runtime model;
- keep producer-side typed interaction requirements, duplicate-owner rejection,
  pure-core topology/layout queries, and exact project/evaluation binding;
- cover payload behavior in focused producer fixtures beside occurrence,
  decision, Hub, topology-interaction, and binding ownership;
- preserve exact start policy, batch subcontrol presence, Hub slot/visit
  ownership, removal impacts, takeover presentations, frontier capabilities,
  and declaration candidate domains in those direct fixtures;
- preserve the active/dormant matrix: all authored occurrences retain their
  offer-time room/reward surface; Fields and Ship leaves remain published;
  unpicked Ephyra side details and Shop inventory remain withheld; picked or
  visited details remain available even when invalid, blocked, or unassessed.

A12 must delete the superseded production models and comparisons in the same
commit. Test-only expected enumeration may remain explicit and independently
derived, but it must live under `apps/planner/test/`. Production must not import
or execute that support, and the test helpers must not import production
assembly, marker ownership, presentation, binding, or facade products. The
commit must not leave forwarding wrappers, compatibility types, a generic audit
description language, or a development-only runtime mode. Its production diff
is expected to be net-negative; the named deletions and the smaller change
neighborhood are the acceptance criteria, not a target line count.

#### A13: Remove post-build runtime audits and close the public boundary

- keep `bindWorkspaceInteractions` as the one exhaustive typed transformation
  from returned requirements, controls, injected contextual services, and the
  exact project/evaluation pair;
- keep its duplicate-key rejection and lazy candidate-session behavior, but
  remove the family-by-family requirement-to-bound payload self-audit;
- remove broad post-build rendered-product, authored-leaf interaction,
  semantic-reachability, default-inspector, and inspector-destination closure
  passes from production after preserving their necessary construction-point
  invariants;
- preserve those guarantees through independent test fixtures and mutation
  cases over persisted decisions, targets, occurrences, Hub slots/visits,
  exact markers, findings, controls, destinations, and interactions;
- retain production checks only when they guard an external contact or enforce
  a local invariant at the point of construction: project/evaluation
  provenance, missing declarations, duplicate semantic keys, impossible
  evaluated overlays, required exact lookups, and exact fine-grained finding
  destinations;
- extract the fine-grained finding-owner predicate from `semantic-closure.ts`
  into the small production finding-routing owner that uses it; it is policy,
  not an audit helper;
- at finding-destination construction, require every fine-grained finding to
  resolve to an existing exact inspector subject. It may not merely have a map
  entry and then silently fall back to the default inspector or biome shell;
- delete equality helpers and audit-only contract types that become unused;
- trim the public workspace entry to the projection service, the contract
  vocabulary actually consumed by application/React, and deliberate
  interaction helpers. Move direct audit mutation tests beside their private
  owners rather than preserving public exports solely for tests;
- complete the architecture matrix omitted at A11: both independent expected
  leaf and structural-control test helpers must reject producer assembly,
  marker-ownership, presentation, binding, and facade imports; semantic
  assembly must not import audit/presentation/binding/inspector consumers; and
  the facade must remain the only composition point for those sibling products;
- align `STRUCTURED_EDITOR_WORKSPACE.md` with this decision: its public entry
  exposes no runtime closure-audit seam, and its closure wording names
  independent test-time verification plus retained local production invariants.

A13 is not permission to remove local invariant checks, simplify interaction
payloads, candidate commands, or semantic addresses. Direct binder and
workspace fixtures must still cover exact owner/key handoff, duplicate
rejection, command facts, candidate domains, semantic reachability, lazy load,
cache reuse, dormant malformed-state rejection, and exact fine-finding
destinations. Like A12, it must be production-net-negative and must not replace
the deleted audit with another abstraction.

#### Campaign A contraction gate

Campaign A closes only when A12 and A13 demonstrate all of the following:

1. tests independently close persisted decisions, targets, occurrences, and Hub
   ownership over reachable semantic products;
2. tests derive every required editable leaf from catalog plus persisted
   authored state and prove that its exact address resolves to its containing
   inspector, marker, and interaction;
3. tests independently require every structural control kind/key/owner and prove
   that every rendered control and advertised frontier capability resolves to
   one exact bound interaction, while production duplicate-key guards still
   fail locally;
4. findings cannot create controls, suppress controls, or fall back from a
   fine-grained owner to a biome shell, and production rejects a fine-grained
   finding whose exact destination does not resolve to an inspector subject;
5. dormant and active occurrence states retain the same declaration/state
   validation, including unknown and missing Ephyra side-room slots;
6. React performs no topology, containment, default-inspector, lifecycle, or
   candidate reconstruction;
7. the named work-count fixtures retain zero render work, lazy candidate
   activation, one evaluation per edit, and cached reuse;
8. production projection performs no second expected-model traversal or broad
   post-build closure pass, while retained local construction invariants still
   fail at their owning boundary;
9. test-only expectation helpers live outside production `src/` and reject
   imports from producer assembly, marker ownership, presentation, binding, and
   the facade;
10. both contraction commits are net-negative in non-test
    `structured-workspace/` production code and the final inventory records the
    actual deletions and any retained duplication explicitly;
11. `npm run check` and `git diff --check` pass at the final A13 gate.

Commit 5b.3 and Commit 5b.4 remain paused until this gate passes. Campaign B
remains separate and does not begin as part of the contraction.

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
8. What is the production-line movement, and does any net growth represent a
   new enforceable boundary rather than duplicated assembly or validation?

Movement commits must not contain opportunistic behavior fixes. If the move
reveals a real defect, preserve it with a focused fixture, complete the
reorganization commit, and fix it in a separately authorized change.

## Audit Matrix

The following audits are required at the start of each affected campaign and
again at closure:

| Audit                       | Evidence                                     | Passing condition                                                                                                                                 |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority-to-consumer trace | Product signatures plus review               | Every important product has one named producer, explicit inputs, and identifiable consumers.                                                      |
| Import graph                | Automated import rule or architecture test   | No cycle exists; imports follow the declared package and subsystem direction.                                                                     |
| Dependency injection        | Composition fixture plus review              | Application services are constructed at the composition root; stage dependencies are narrow and explicit.                                         |
| Hidden registration         | Returned-product closure fixture plus review | A later stage does not depend on maps or registries populated only as a side effect of producing an earlier result.                               |
| Semantic ownership          | Independent test closure fixtures            | Authored owners, findings, controls, and inspector destinations resolve by stable semantic address without executing a second production model.   |
| Duplicate reconstruction    | Boundary rule plus review                    | React and downstream projections do not repeat physical-exit, containment, eligibility, lifecycle, or reward rules.                               |
| Mutation boundary           | Review                                       | Mutable builders are local to one stage and freeze a complete returned product before crossing the boundary.                                      |
| Exhaustive dispatch         | Typecheck plus family fixtures               | Closed command, event, and candidate vocabularies retain explicit exhaustive handling.                                                            |
| Public surface              | Typecheck plus import fixture                | Existing supported imports remain deliberate; temporary compatibility barrels do not survive closure.                                             |
| Test authority              | Review                                       | Tests live beside the product or boundary they verify and do not assert incidental file layout.                                                   |
| Facade responsibility       | Import graph plus function-inventory review  | The workspace facade composes stages and caching; it owns no occurrence, decision, Hub, rail, or audit family logic.                              |
| Change neighborhood         | Product trace plus representative review     | A family change enters its producer, binder where applicable, and focused tests—not a production audit mirror, unrelated families, or the facade. |
| Movement accounting         | Per-commit diff statistics and review        | Moved code leaves no parallel path; unexplained production growth does not accumulate during decomposition.                                       |

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
- Assembly consumes narrow authored occurrence projection facts, while one
  shared Fields active-cage derivation feeds occurrence and decision assembly
  without either recomputing the other owner's policy.
- Declaration/state coherence is validated before room-local publication policy,
  including when optional Ephyra details are dormant.
- Tests independently derive required editable leaves from catalog plus
  persisted state without importing workspace producer products.
- Evaluation may add genuine derived lifecycle facts but cannot create, remove,
  or replace persisted authored owners or editable offer-time leaves.
- Incomplete and context-invalid authored state remains representable,
  reachable, and editable.
- Findings never hide authored controls.
- Every fine-grained finding resolves to an exact existing inspector subject at
  destination construction; it cannot acquire a default or biome-shell fallback.
- Independent tests prove that each expected authored leaf has one exact
  interaction and reachable containing inspector.
- Independent tests prove that each topology/layout-required control has the
  expected semantic kind, key, and owner.
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

The A6 checkpoint passed 65 files and 668 tests and remains the behavioral
baseline for A7 through A13. Its diagnostic source baseline is 9,848 lines in
`structured-workspace/`, including a 6,213-line projector, plus 479 lines in
`BiomeWorkspace.tsx`. These are not quotas. They make movement and unexplained
growth visible while the responsibility and import audits remain authoritative.

The A11 structural checkpoint passed 76 files and 695 tests. Its contraction
baseline is 10,758 non-test lines in `structured-workspace/`, a 349-line
projector, a 2,969-line production `audit/` directory, and 479 lines in
`BiomeWorkspace.tsx`. A12 and A13 must repeat the executable work-count fixtures
and record their own production inventory; their net-negative requirement is a
guard against replacing deleted shadow models with differently named copies.

## Non-Goals

- no authored schema or codec-version change;
- no new biome, room, lifecycle, reward, or candidate rule;
- no Shop purchase-order implementation;
- no Commit 5b.3 or 5b.4 presentation work before the A13 contraction gate;
- no UI redesign, graph library, state-management replacement, or component
  framework;
- no generic event bus, plugin registry, dependency-injection container, or
  pipeline abstraction;
- no declaration compression or metaprogramming;
- no file-size, export-count, or directory-count quota;
- no performance optimization without measured evidence;
- no broad public API cleanup outside the structured-workspace entry; A13 may
  remove only unconsumed or audit-only exports from that boundary;
- no compatibility layer left behind after a moved responsibility.

## Closure and Retirement

This plan is complete only after the foundation and all four campaigns pass
their gates, the complete repository gate passes, and the final audit matrix
has no unresolved ownership or import finding. Campaign A completion now means
the A13 contraction gate, not the earlier A11 structural checkpoint. It may
then return active delivery to Commit 5b.3/5b.4 while this document continues
to own the remaining pre-5c campaigns.

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
