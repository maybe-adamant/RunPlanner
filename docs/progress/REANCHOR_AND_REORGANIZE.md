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

A fresh post-A11 read reopened Campaign A for two bounded contraction commits.
The family and dependency seams were worth keeping, but A2.2 and A4 had
expanded verification into parallel semantic models: occurrence leaves were
fully classified once for assembly and again for independent leaf closure, and
interaction policy was fully reconstructed on an expected side before being
checked again at the requirement-to-binding and rendered-product boundaries.
A12 removed the production shadow-authored models and relocated valuable
independent expectations to tests. A13 removed the remaining post-build
production self-audits, trimmed the public workspace entry to deliberate
consumers, and closed the final import matrix. The production contraction gate
is complete.

A holistic post-A13 test read found that test ownership did not contract with
production ownership. Focused structured-workspace fixtures were added beside
the new modules, but the former facade and React integration suites grew and
continued to assert many of the same semantic families. A14, A15.1, A15.2, and
A16 completed the bounded test-ownership correction: canonical shared route
fixtures, independent workspace expectation/observation infrastructure,
focused projection and closure assertions, and React coverage aligned with the
existing workbench boundaries. Commit 5b.3 in
[`WORKSPACE_PRESENTATION_POLISH.md`](WORKSPACE_PRESENTATION_POLISH.md) is
behavior-ready but remains paused while the remaining cleanup campaigns close.
A final Campaign A retrospective amended Campaigns B through D around
vertical producer-to-consumer movement, explicit semantic products, primary
test ownership, and conditional decomposition. Campaign B remains separate.

Campaign B's entry audit found eighteen query kinds grouped into four coherent
semantic families and five review units, three semantic `WeakMap` sidecars, one
permitted project/evaluation identity attestation, and several ordinary
memoization caches. Campaign B is complete: each semantic sidecar now crosses
its producer-to-consumer boundary as an exact opaque artifact, and its query
family has one explicit evaluator behind the prepared session.

Campaign C's entry audit is complete. It found a justified room-state split,
one narrow topology-query product, misplaced codec and command tests, and an
occurrence-command aggregate with demonstrated leaf-family boundaries. It did
not find evidence for separate raw-topology decode and semantic-validation
products or for splitting the atomic topology-command aggregate.

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

| Area                                                     | Current mixed responsibilities                                                                                                                                                                                                                                                         | Required correction                                                                                                                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/planner/src/projections/structured-workspace/`     | Source lookup, authored/evaluated overlay, room and Hub assembly, candidate interaction construction, rail presentation, focus registration, and several closure audits share one projector and broad mutable context.                                                                 | Turn workspace projection into an explicit sequence of immutable products with a thin public service facade.                                                                                                            |
| `MutableProjectionContext` and `projectOccurrence`       | Catalog/evaluation facts, findings, route/biome identity, focus destinations, room controls, and reward controls are accumulated together. A projection function returns a node while also registering products for later phases.                                                      | Pass stage-specific inputs. Each stage returns every product later stages consume. Local builders may mutate privately, but cross-stage products cannot be discovered through prior side effects.                       |
| Workspace interaction binding                            | The former catalog builder combined binding mechanics with the projector, obscuring its input boundary and encouraging more semantic traversal there.                                                                                                                                  | Bind every public interaction map from explicit requirements plus catalog/project/evaluation and injected services; verify the transformation in focused tests rather than production self-audits.                      |
| `BiomeWorkspace.tsx`                                     | `roomOwnsAddress`, `nodeOwnsAddress`, `nodeForAddress`, and `fallbackSubject` reconstruct semantic containment and default inspection despite the projection already publishing focus information.                                                                                     | Project exact explicit and default inspector destinations. React resolves keys and renders; it does not rediscover semantic ownership.                                                                                  |
| `simulation/candidates/index.ts`                         | Public query/result contract, evaluation recovery, progressive repair, every candidate family, and session dispatch share one module. Reward and lifecycle evaluators also discover callable support through reward-simulation sidecars.                                               | Move complete candidate families behind one exact session and thin dispatcher. Make every required producer artifact explicit before extracting its consumer; do not preserve or wrap semantic sidecars.                |
| `simulation/rewards/biome.ts` and `rewards/frontiers.ts` | Snapshot indexing, mutable evaluation state, event-family handling, candidate capability capture, support recording, and final projection are interleaved in one chronological loop. Required candidate capabilities are registered in `WeakMap`s keyed by the apparent reward result. | Return reward simulation and its in-memory candidate artifacts explicitly at their producer boundary. Then reorganize chronological internals only through complete event-family slices while keeping one visible loop. |
| `simulation/history/fold.ts`                             | Ledger initialization, active lifecycle bookkeeping, event validation, per-event mutation, view capture, and final freezing are interleaved around one chronological exhaustive fold.                                                                                                  | Audit change neighborhoods before splitting. Retain the cohesive fold if handlers would merely distribute one ordered invariant; otherwise move complete event families with their state and tests.                     |
| `authored-project/roomState.ts`                          | Declaration defaults, room-replacement reconciliation, and persisted decoding occupy one module despite having different callers and failure contracts.                                                                                                                                | Separate default construction, replacement reconciliation, and codec validation behind one authored room-state public boundary.                                                                                         |
| `authored-project/topology.ts`                           | Physical-exit resolution, topology queries, takeover facts, structural validation, and persisted decoding are coupled.                                                                                                                                                                 | Separate narrow pure query ownership from validation and decoding while retaining one public topology contract. Do not introduce a comprehensive cached topology mirror without demonstrated consumers.                 |
| `commands/occurrence-state.ts`                           | Room replacement, incoming/local rewards, Fields, Ship wheels, Ephyra side rooms, and Shop changes share lookup and mutation machinery despite having distinct leaf contracts.                                                                                                         | Extract only command families with narrow transition dependencies while retaining one exhaustive occurrence-command dispatcher.                                                                                         |
| `commands/unified-topology.ts`                           | The public exhaustive dispatch is valuable, and its start, batch, takeover, Hub, selection, repair, and removal operations share several atomic topology invariants.                                                                                                                   | Reuse narrow topology queries first, then split command families only if the dependency audit proves the aggregate is no longer the more cohesive owner.                                                                |
| `catalog-schema` and `reward-kernel` types               | `CatalogCollection` is declared by catalog schema, while catalog schema imports reward-kernel types and reward-kernel imports the collection type back. The cycle is type-only today but expresses the wrong conceptual ownership.                                                     | Move normalized collection primitives to a neutral engine module below both consumers and add a focused import-direction guard.                                                                                         |

### Areas Not Selected for Mechanical Splitting

- `simulation/generation/biome.ts` is large but presently follows one
  generation responsibility with reasonably bounded helpers. It changes only
  if a later slice exposes a concrete dependency violation.
- catalog declaration modules remain explicit game-data authority.
- React CSS and test files split only when the production ownership boundary
  gives them a clearer home. Campaign A's completed workbench and workspace
  products now provide those homes; A14, A15.1, A15.2, and A16 move assertions
  to them and delete superseded umbrella coverage rather than splitting
  mechanically.
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
  -> narrow declared-exit, selection, takeover, or ownership query
  -> topology validation
  -> semantic command-family transition
  -> replacement authored topology
```

Default construction, reconciliation, decoding, and commands may share narrow
pure helpers. They may not invoke one another merely to reuse traversal when
their failure or ownership contracts differ.

### Simulation

```text
history seed + ordered HistoryEvent stream
  -> one visible exhaustive fold
       -> cohesive in-loop transitions, or
       -> event-family handler when the family owns a narrow state transition
  -> frozen history product

reward snapshot + history
  -> immutable reward source indexes
  -> one visible chronological reward fold
  -> explicit reward evaluation product
       - immutable reward simulation
       - in-memory candidate artifacts

catalog + exact authored project/evaluation assembly product
  - public evaluation
  - explicit in-memory candidate artifacts
  -> exact session-bound candidate sources
  -> matching candidate-family evaluator
  -> candidate result
```

The history and reward coordinators retain their chronological loops. Event
handlers do not subscribe themselves to a registry. The reward simulation may
remain a data-only public result while an owning evaluation product returns its
candidate artifacts as a sibling; downstream correctness cannot depend on a
`WeakMap` or registration side effect. Candidate dispatch retains an exhaustive
query-kind decision. A prepared candidate session remains bound to the exact
authored project identity and its exact evaluation, but it does not package
every possible route, biome, progressive, history, reward, and Hub fact into
one universal context.

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
Foundation plus twenty-nine Campaign A review commits are delivered through
A16, including the bounded production contraction and test-ownership units.
Campaign A demonstrated that a pre-audit commit estimate can conceal product
growth, duplicate verification, and later contraction work. Campaigns B through
D therefore receive no fixed implementation-commit range in advance. Each
opening audit records the current flow and proposes complete review units before
production movement begins.

Every intermediate revision remains type-correct, tested, and free of
temporary compatibility machinery. The sequence below is the default:

```text
neutral dependency anchor
  -> Campaign A: workspace and React
  -> completed production contraction checkpoint: A12 and A13
  -> completed test-ownership correction: A14, A15.1, A15.2, and A16
  -> Campaign B: candidate capability flow
  -> Campaign C: authored core
  -> Campaign D: ordered engine state flows
  -> checkpoint: Commit 5b.3 and 5b.4 may resume
  -> checkpoint: Commit 5c may begin after Commit 5b closes
```

Campaigns B and C may exchange order if their opening audits show a narrower
dependency path. Neither depends on unfinished UI work. Campaign B includes the
minimal reward-producer correction required to make candidate capabilities
explicit; Campaign D later reorganizes the chronological reward implementation
behind that established product. Campaign D stays before Commit 5c because
exact Shop purchase order changes the chronological reward path it owns.

### Relative Work and Risk

| Work                            | Review units                  | Relative size                     | Primary risk                                                                                               |
| ------------------------------- | ----------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Neutral dependency anchor       | 1 delivered                   | Small                             | Unnecessarily changing external import surfaces                                                            |
| Campaign A: workspace and React | 29 delivered                  | Extra-large                       | Losing authored reachability, focus, lazy interaction behavior, or independent test evidence               |
| Campaign B: candidate flow      | 5 audited                     | Extra-large                       | Wrapping hidden reward sidecars, creating a universal context, or altering progressive recovery            |
| Campaign C: authored core       | 6 planned                     | Large                             | Creating a second topology model or scattering atomic authored invariants                                  |
| Campaign D: ordered engine flow | Set separately per state flow | Extra-large/highest semantic risk | Moving an event to the wrong chronological state or decomposing a cohesive fold without maintenance payoff |

Campaign gates exist so the project can reassess value, coupling, and remaining
risk before authorizing broad movement. A campaign may close with a documented
decision to retain a cohesive aggregate; a no-op judgment does not require an
empty implementation commit.

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

Campaign A was the prerequisite for Commit 5b.3 to resume. A1 through A6
established the necessary returned products and consumer boundary; A7 through
A11 completed the corresponding private ownership boundaries. A12 and A13
contracted redundant production representations around those boundaries. A14,
A15.1, A15.2, and A16 completed the same ownership correction in fixtures, test
support, and React coverage. Exact filenames follow returned products, not a
file-count target.

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

#### A12: Remove production shadow-authored models (delivered)

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

A12 deleted the superseded production models and comparisons in the same
change. Its independently derived expected enumeration lives under
`apps/planner/test/`; production neither imports nor executes that support, and
the helpers reject imports from assembly, marker ownership, presentation,
binding, and facade products. It left no forwarding wrapper, compatibility type,
generic audit-description language, or development-only runtime mode. The
named deletions and smaller change neighborhood, rather than a target line
count, are the acceptance criteria.

#### A13: Remove post-build runtime audits and close the public boundary (delivered)

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

A13 did not remove local invariant checks, simplify interaction payloads,
candidate commands, or semantic addresses. Direct binder and workspace fixtures
cover exact owner/key handoff, duplicate rejection, command facts, candidate
domains, semantic reachability, lazy load, cache reuse, dormant malformed-state
rejection, and exact fine-finding destinations. Like A12, it is
production-net-negative and does not replace the deleted audit with another
abstraction.

#### Campaign A production contraction gate (delivered)

A12 and A13 close the production contraction. They demonstrate all of the
following:

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
11. `npm run check` and `git diff --check` pass at the A13 production gate.

The gate proves that production no longer executes the removed shadow models.
It does not prove that the retained tests have one clear assertion owner. The
post-A13 audit below supersedes the earlier decision to resume Commit 5b.3.

#### Campaign A test-ownership correction

At the post-A13 checkpoint, the suite passed 76 test files and 703 tests, but
its organization did not yet reflect the production boundaries it protected.
Compared with
`f69dc709a8e36b72ae624855ab043c2a02264b8a`, test files grew from 24,028 to
28,607 lines. Fourteen focused structured-workspace module tests add 2,551
lines, while the three pre-existing umbrella suites grew by another 1,566 lines:

- `structuredWorkspace.test.ts`: 2,574 to 3,097 lines;
- `structuredWorkspace.contract.test.ts`: 435 to 877 lines;
- `BiomeWorkspace.test.tsx`: 2,033 to 2,634 lines.

A15.1 later added ten non-test workspace expectation/closure support modules
(1,673 lines) and three support self-tests (210 lines). Those later support
figures are not part of the post-A13 baseline. All counts are diagnostic
evidence, not deletion quotas. The maintenance finding is that focused owners
were added without retiring overlapping facade and React assertions,
independent expected enumeration and actual-product observation are coupled in
one large closure helper, and canonical Underworld and Surface project builders
exist in near-copy engine and application fixture files.

The current execution profile supports the same conclusion. In one full Vitest
run, `BiomeWorkspace.test.tsx` took approximately 19.1 seconds,
`structuredWorkspace.test.ts` 10.5 seconds, and
`structuredWorkspace.contract.test.ts` 4.2 seconds. Elapsed time varies by host
and is not an acceptance threshold. The actionable issue is repeated full
application/projection construction in broad suites and the limited scheduling
granularity those suites impose, not test count by itself. This is not evidence
for a worker-configuration change; performance tuning remains separately
measured work.

The correction preserves independent behavioral evidence while enforcing one
primary assertion owner. It may reduce file, line, and test counts when an
assertion is genuinely duplicated. Count preservation is not a goal.

One primary assertion owner means one neighborhood owns a behavior's complete
policy and edge-case matrix. It does not prohibit a representative boundary
witness elsewhere. Focused workspace tests own family policy and edge matrices;
the facade owns composition, caching, and sibling handoff; contract tests own
malformed overlays and independent omission mutations; workbench tests own DOM,
accessibility, and command dispatch; the parent workspace owns rail, focus, and
inspector resolution; and product loops own store, persistence, Undo/Redo, and
cross-layer round trips. An assertion is removed only when another owner covers
its complete authority, not merely because similar wording appears elsewhere.

#### A14: Canonical authored-project fixtures

- establish `test/fixtures/authored-project/` as the repository-level fixture
  home for the shared Underworld and Surface route builders currently
  duplicated under planner and engine tests. The fixture module is test-only,
  application-neutral, and may import only public engine and catalog APIs;
- make engine, projection, architecture, UI, and product-loop tests consume
  those canonical builders, retaining layer-local helpers only when they add a
  genuinely layer-local operation;
- define the canonical fixture API before moving consumers: retain every
  semantically necessary variant (including partial N and G Preboss-source
  scenarios), settle on truthful option names, remove ignored compatibility
  parameters such as planner-only catalog arguments, and characterize a matrix
  of shared scenarios/options before deleting both superseded copies in the
  same commit;
- keep fixture-equivalence coverage in an existing discovered application or
  engine test location unless A14 deliberately extends both Vitest discovery
  and TypeScript project coverage for the root `test/` tree. A root fixture
  directory alone is not an executable test or typecheck boundary;
- preserve deeply equal authored documents for every characterized shared
  scenario and retain all existing assertions before beginning assertion
  migration.

A14 is mechanical test infrastructure movement. It must not change production
exports, authored defaults, simulation behavior, projection products, or React
behavior. Because shared fixtures affect multiple workspaces, run the complete
repository gate.

#### A15.1: Separate expectation, observation, and closure infrastructure

- organize structured-workspace test support beneath
  `apps/planner/test/support/structured-workspace/` by expected products,
  observed products, closure assertions, and shared test keys while performing
  the semantic split below. Do not move the current aggregate first and rewrite
  it in a later commit, and do not reproduce production module names as a
  parallel tree;
- separate independent expected enumeration from actual workspace observation:
  expected topology owners (occurrences, decisions, targets, Hub slots, and
  Hub visits), leaves, and structural controls consume catalog plus persisted
  authored state and may call direct pure-core queries over those inputs, such
  as completeness, physical-exit, and takeover helpers. They may not import a
  workspace producer, evaluator overlay, candidate session, source index,
  family assembly, presentation builder, interaction binder, or facade
  constructor. Of workspace production, a distinct observer may import only
  public workspace contract types;
- make closure assertions compare the independently expected manifest with the
  typed observed manifest. Type-only knowledge of the public result contract is
  not semantic derivation from the producer and must not force actual-product
  traversal through `unknown`. Contract mutations may use a narrow, documented
  test helper to omit or misroute a field after a valid public product is
  constructed; it must not construct a parallel workspace product or hide
  ordinary observation behind `unknown`;
- split topology, editable-leaf, structural-control, destination, and bound
  interaction closure only where they have distinct expected inputs. Keep one
  shared observation primitive when splitting it would duplicate node traversal;
- define and implement exact lane membership around the resulting final paths:
  `test:contract` runs application architecture plus workspace
  overlay/closure/support contracts; `test:ui` runs direct component suites;
  `test:product` runs cross-layer workflows; and `test:planner` is the
  intentional broad planner superset, including contract and component
  coverage. Semantic distinction names each lane's primary contract; it does
  not require disjoint test sets;
- record the exact commands and member paths after movement, so script names
  and actual capabilities cannot drift. A15.1 cannot close until the final
  script definitions and their included paths are recorded as acceptance
  evidence, not merely inferred from directory globs;
- move stable import prohibitions into ESLint `no-restricted-imports` rules
  where the AST can express them. Retain architecture tests for semantic or
  runtime properties that lint cannot prove, and remove source-token/file-path
  assertions that merely encode incidental layout;
- do not expose a new production manifest, audit hook, compatibility export, or
  test-only runtime path to make the tests easier.

A15.1 closes when expected products remain independent of workspace-producer
implementation while retaining direct pure-core authority, actual workspace
observation is typed against the public result contract, the final support
layout matches those responsibilities, every named lane executes its promised
contract, and the planner plus contract lanes and complete repository gate pass.

#### A15.2: Re-anchor workspace projection and contract assertions

- create an explicit ownership inventory for every case in
  `structuredWorkspace.test.ts` and `structuredWorkspace.contract.test.ts`:
  source lookup, occurrence facts, occurrence assembly, decision assembly,
  topology-interaction assembly, shared Fields facts, Hub assembly, biome
  semantic assembly, marker/destination navigation, presentation, interaction
  binding, facade composition, overlay integrity, or cross-product closure;
- move a unique assertion to its focused owner when that owner now exists, then
  delete the umbrella assertion in the same change. Do not copy assertions into
  smaller files or preserve a broad compatibility suite for confidence; retain
  a representative boundary witness when it proves composition rather than a
  second policy matrix;
- retain in the facade suite only behavior that genuinely crosses several
  returned products, such as representative route composition, sibling
  presentation/binding handoff, identity caching, and exact public product
  assembly;
- retain contract tests for malformed authored/evaluated overlay rejection,
  independent semantic reachability, independently required leaves and
  structural controls, and mutation cases proving that omissions remain
  observable;
- do not expose a new production manifest, audit hook, compatibility export, or
  test-only runtime path to make the tests easier.

A15.2 closes when a workspace-family change has one focused test neighborhood,
the facade and contract suites contain only boundary behavior, no migrated
assertion leaves a second complete policy matrix behind, and the planner plus
contract lanes and complete repository gate pass.

#### A16: Align React coverage with existing workbench ownership

- create an explicit ownership inventory for every current
  `BiomeWorkspace.test.tsx` case before moving it: parent workspace, decision
  workbench, Hub workbench, occurrence workbench, projection default, or
  product loop. Move a child-owned case and delete its parent duplicate in the
  same change; do not retain an unclassified parent path for confidence;
- move decision editing, takeover, repair, removal, and authoring-frontier
  rendering/dispatch assertions beside `DecisionWorkbench.tsx`;
- move Hub board, slot, visit, side-room, closure, and Hub-local dispatch
  assertions beside `HubDecisionWorkbench.tsx`;
- move room/reward, Fields, Ship, Shop, fixed-room, and dormant-detail
  rendering/dispatch assertions beside `OccurrenceWorkbench.tsx` or an already
  narrower child when that child owns the complete behavior;
- keep `BiomeWorkspace.test.tsx` responsible for rail and Hub-visit navigation,
  explicit and default inspector consumption, semantic focus, keyboard
  movement, finding navigation, and the parent-to-workbench interaction handoff;
- test the characterized default-inspector priority matrix at projection
  ownership. React needs representative consumption fixtures, not a second copy
  of every priority and retained-state rule;
- use typed projected-biome and interaction fixtures for component tests. A
  direct workbench may use a minimal Provider/test store where its hooks or
  dispatch contract require one; reserve the real application/store for Redux
  publication, Undo/Redo, autosave, or a cross-component command round trip;
- retain product-loop tests only for cross-layer workflows and remove any
  product assertion whose complete authority is already covered in engine,
  projection, or component tests;
- extract shared render/application harnesses only when at least two remaining
  suites consume them. A test helper may simplify construction but may not
  decide room eligibility, topology, lifecycle, reward, focus, or candidate
  policy;
- preserve accessible roles, labels, pointer and keyboard behavior, semantic
  command identity, Undo/Redo, persistence, finding navigation, lazy candidate
  work, and zero render-time evaluation.

A16 closes when each existing React workbench has direct coverage for its own
contract, the parent suite no longer acts as the sole test owner for all child
behavior, and the UI, planner, product, and complete repository gates pass.

#### A14–A16 delivery record (2026-07-31)

- A14 established the test-only, repository-level
  `test/fixtures/authored-project/` barrel for the canonical Underworld and
  Surface builders. It removed both planner and engine copies, removed ignored
  catalog arguments, retained partial/custom N and G Preboss-source variants,
  and added SHA-256 full-document characterization for the shared
  scenario/option matrix.
- A15.1 replaced the aggregate closure helper with independent expected
  topology, editable-leaf, and structural-control manifests; one typed public
  workspace observer; focused topology, leaf, and structural-control closure
  assertions; shared semantic test keys; and one documented malformed-product
  omission helper. Expected manifests enumerate occurrences, decisions,
  targets, Hub slots, and Hub visits from authored state without importing a
  workspace producer. The observer imports public result-contract types only.
  ESLint now enforces the statically expressible producer/import boundaries.
- The exact final lane membership is recorded in `package.json` and is:
  `test:contract` = `vitest run apps/planner/test/architecture
apps/planner/test/support/structured-workspace
apps/planner/src/projections/structuredWorkspace.contract.test.ts`;
  `test:planner` = `vitest run apps/planner/src
apps/planner/test/architecture apps/planner/test/support/structured-workspace`;
  `test:ui` = `vitest run apps/planner/src/ui`; and `test:product` =
  `vitest run apps/planner/test/product-loops`. Planner is intentionally a
  broad superset rather than a disjoint capability lane.
- A15.2 reduced the former 3,097-line facade umbrella to four composition
  witnesses: public multi-biome envelope, sibling handoff, exact identity
  caching, and coarse finding routing. Its 46-case ownership inventory moved
  policy matrices to source-index, occurrence, decision, Hub, topology,
  Fields, presentation, navigation, and interaction-binding owners. Contract
  retains malformed overlays and independently derived omission/reachability
  evidence, including target and Hub sub-owner destinations and all editable
  leaf and structural-interaction families.
- A16 classified all 50 former parent React cases. The parent now has 17
  rail/focus/default/finding/handoff cases; direct Decision, Hub, and
  Occurrence workbench suites own their 11, 6, and 6 behavior matrices, while
  the default-priority matrix remains at projection ownership. Static workbench
  rendering uses a projected public fixture and minimal presentation store;
  live application composition is limited to command
  publication/reprojection, Undo/Redo, or cross-component behavior. Review
  restored the split picked-room/reward atomic-command test plus its parent
  rail-summary/focus handoff witness, and Hub visit mutation preserves authored
  side-room order.
- The final single-flight `npm run check` passed all package typechecks, 82
  Vitest files / 713 tests, ESLint, Prettier, and the production build; `git diff --check`
  also passed. The test-count change from the post-A13 703 baseline reflects
  moved and newly independent fixtures, not a measure of primary policy
  coverage.

#### Campaign A final gate (delivered)

Campaign A closed after A14, A15.1, A15.2, and A16 demonstrated all of the
following:

1. shared Underworld and Surface authored-project scenarios have one canonical
   fixture definition;
2. every named test lane executes the contract its name promises;
3. expected authored leaves and structural controls remain independent of
   workspace producer semantics while retaining direct pure-core authority,
   and actual-product observation is typed against only the public result
   contract;
4. each occurrence, decision, Hub, presentation, navigation, binding, facade,
   contract, React workbench, parent workspace, and product-loop behavior has
   one primary complete-matrix assertion owner, with only representative
   boundary witnesses retained elsewhere;
5. facade, parent React, and product-loop suites contain only behavior that
   crosses their owned boundary;
6. moved assertions leave no duplicate umbrella path, compatibility suite, or
   copied fixture builder behind;
7. import direction is enforced through lint when statically expressible and
   through architecture/runtime fixtures only when it is not;
8. test helpers construct inputs and observe outputs without becoming a second
   semantic engine;
9. the named work-count baselines remain recorded as diagnostics; the complete
   suite does not regress materially from the recorded diagnostic run without
   explanation, and `npm run check` plus `git diff --check` pass.

This gate behaviorally unblocks Commit 5b.3 and Commit 5b.4. The chosen cleanup
sequence nevertheless begins Campaign B now and resumes those feature slices
after Campaign D closes.

### Campaign B: Candidate Capability Flow

Campaign B follows the candidate product across its producer and consumer
boundary. It is not limited to making `simulation/candidates/index.ts` shorter.
In particular, reward and lifecycle candidate capabilities currently exist only
in `WeakMap` sidecars registered by reward simulation. Extracting candidate
consumers around those accessors would preserve the wrong boundary.

#### Campaign B entry audit (no implementation commit)

Before moving production code:

- inventory every query/result union member, evaluator, progressive-repair
  branch, unavailable-context owner, and session-dispatch branch;
- trace the exact authored, project-evaluation, generation, reward, history,
  Hub, and lifecycle source consumed by each family;
- inventory all candidate-related sidecars and registration calls, distinguishing
  semantic artifacts from caches or identity attestations;
- assign one primary test owner to each family matrix and identify the
  representative session, application-boundary, and product-loop witnesses to
  retain;
- record current candidate source/test movement and the existing lazy query,
  batching, deterministic-order, render-purity, and evaluation work counts;
- propose complete vertical review units and their expected deletions. Do not
  begin with a contract-only, source-interface-only, or context-only commit.

##### Entry-audit result (2026-07-31)

The audit is complete; no production code changed. The present 2,655-line
candidate module has four distinct change neighborhoods: the public
query/result vocabulary, selected and progressive source recovery, family
evaluation, and exact-session dispatch. Its length is evidence of mixed
responsibility, not the acceptance target. The application-side 821-line
candidate projection remains a cohesive exact-session adapter and cache at
entry; Campaign B does not split it unless a vertical family move demonstrates
an independent application responsibility.

The mixed producer baseline is 1,443 lines in generation's biome evaluator,
1,545 in reward's biome evaluator, 103 in the reward-frontier module, 491 in
project evaluation, and 570 in progressive biome evaluation. Most of those
lines own non-candidate simulation and are not movement targets. Per-unit diff
accounting compares what actually moves or is deleted from these files; their
combined size is not a Campaign-B success measure.

The public contract contains eighteen query kinds:

| Family                   | Query kinds                                                                                            | Current semantic sources                                                                                                                                                                            | Recovery and unavailable ownership                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Linear structural        | `startRoom`, `roomTarget`, `takeoverPrebossBatch`, `batchRewardStore`, `fieldsCageOutcome`             | Catalog layout and authored topology; selected generation pressure/store-support data; callable room-target contexts captured during generation; exact source history for takeover and prefix store | Linear progressive prefix or pre-clamp repair at the queried owner; authored prerequisite, coverage, or target gap |
| Hub and local structural | `hubSlot`, `hubVisit`, `sideRoomGeneration`, `sideRoomEntryOrder`                                      | Authored Hub board, visits, occurrence-local side state, layout constraints, selected Hub generation support, and scoped command proposals                                                          | Hub coverage gates and the existing progressive Hub-region evaluator                                               |
| Reward producer          | `incomingReward`, `localReward`, `rewardWheelOffer`, `shopOffer`                                       | Callable reward-producer frontiers captured before the exact sequential, joint, wheel, or Shop producer                                                                                             | Exact producer pre-clamp repair; producer-frontier or coverage gap                                                 |
| Room lifecycle           | `shipEncounterCount`, `rewardWheelOfferCount`, `rewardWheelStore`, `rewardWheelPicked`, `shopPurchase` | Authored Ship/Shop state and declarations, selected encounter support, and callable lifecycle contexts captured before Ship wheels or Shop purchases                                                | Exact lifecycle-owner pre-clamp repair, with the complete-invalid sole-owner fallback                              |

The successful-result union has one matching discriminant for every query kind
plus the shared `unavailable` result. Room target and takeover evaluation are
currently inline in session dispatch; fourteen named evaluators own the other
branches, with `evaluateWheelLifecycle` deliberately covering the three
state-level wheel queries. No query is dynamically registered.

`roomTarget` is the important correction to the former sequence: its selected
and repaired contexts are stored in a generation-result sidecar, so structural
movement cannot finish before an explicit candidate-artifact product exists.
`batchRewardStore` and `fieldsCageOutcome` consume data already present in the
public evaluated products or derive exact prefix support; they do not require a
callable sidecar. Hub slot evaluation is direct authored constraint evaluation,
while the three ordered/local Hub queries intentionally apply a semantic
command to an immutable proposal and evaluate only their scoped Hub region.

The progressive and unavailable responsibilities are also explicit:

- `candidateBiome` selects a complete or prefix result and rematerializes a
  complete-invalid biome through the first-blocking clamp;
- room targets, takeover batches, and unresolved batch stores each own a
  dedicated prefix evaluator;
- reward producers and lifecycle owners use exact pre-clamp repair, while
  lifecycle owners alone may use the documented complete-invalid sole-owner
  fallback;
- Hub visit and local families own Hub-region coverage and replay rather than
  using the Linear repair path;
- `coverageNotReached`, `producerFrontierUnavailable`,
  `targetNotReachable`, `authoredPrerequisiteMissing`,
  `upstreamIncomplete`, and `upstreamInvalid` all have production producers;
  `biomeIncomplete` has none. It is obsolete presentation-contract residue and
  should be removed with the contract move rather than preserved as a dormant
  compatibility variant.

##### Sidecar classification

| Storage                                                    | Classification                  | Campaign-B disposition                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| generation validation -> room-target contexts              | Semantic callable artifact      | Return it explicitly from generation and progressive/project assembly; delete the map, registration write, accessor, and public exports in B1                                   |
| reward simulation -> producer frontiers                    | Semantic callable artifact      | Return it explicitly beside the data-only reward simulation; delete the map, registration/accessor path, and public exports in B4                                               |
| reward simulation -> Ship/Shop lifecycle contexts          | Semantic callable artifact      | Return it explicitly beside the data-only reward simulation; delete the map, registration/accessor path, and public exports in B5                                               |
| project evaluation -> authored project                     | Identity attestation            | May remain for callers that receive the data-only public evaluation; the explicit candidate assembly must carry and verify its own exact project identity                       |
| catalog/history view -> static reward facts                | Derived-value cache             | Retain; it memoizes a reproducible calculation and is not the sole carrier of a semantic fact                                                                                   |
| application project/evaluation and candidate-domain caches | Evaluation and projection cache | Retain while their keys remain explicit inputs and cache misses can reproduce the same result; they must not become a lookup path from public evaluation to candidate artifacts |

The target internal product is one exact project-evaluation assembly: the
existing data-only `ProjectEvaluation`, the authored project identity, and
biome-addressed in-memory candidate artifacts produced by that same execution.
It is one atomic handoff, never independently threaded `project`,
`evaluation`, and optional artifacts whose identities could be mixed. Public
`simulateProject` remains a data-only facade over one assembly execution; it
must not execute simulation once for public data and again for artifacts. The
application publishes one transient assembly product alongside the existing
public evaluation selector, while structured-workspace composition passes the
opaque artifact side unopened to candidate-session binding. React and reducers
may transport that replaceable derived product but do not inspect or interpret
its callable contents; it never enters persistence, profiles, autosave, or
authored undo history. A `WeakMap` or resolver from public evaluation back to
the assembly is specifically not an acceptable handoff.

Progressive evaluation needs the same shape at biome scope. Normal, prefix,
clamped, and pre-clamp repair paths must each return their data result and the
artifacts produced by that exact execution. A candidate evaluator may receive
only the family-specific artifact or authored/evaluated facts it needs; it may
not receive the whole assembly as a universal source service. The direct
`roomTargetCandidateContextAtFrontier` constructor remains legitimate for an
ungenerated physical exit; it is an explicit exact-frontier product, not a
result-keyed sidecar to remove.

Candidate artifacts remain opaque, immutable capability products at this
boundary. Do not expose a raw `Map` merely typed as `ReadonlyMap`: JavaScript
can still mutate it after `Object.freeze`. An artifact exposes only the narrow
family lookup or evaluation capability its consumer needs, while its mutable
construction data stays private to the producing stage.

##### Primary test ownership and retained witnesses

| Authority                                     | Primary complete-matrix owner                                                                               | Retained boundary or biome-specific witnesses                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Exact assembly/session contract               | `simulation/candidate-session.test.ts`                                                                      | Exact identity, batching, deterministic result order, observation, and representative unavailable evidence only |
| Start, ordinary target, takeover, batch store | `simulation/biomes/f/candidates.test.ts`                                                                    | G seeded-invalid repair and O/P/Q declaration-specific generation policies remain in their biome suites         |
| Incoming producer reward                      | `simulation/biomes/f/candidates.test.ts`                                                                    | G invalid repair, N joint board/Shop, and O wheel cases retain only their distinct producer policies            |
| Fields and ordinary local reward              | `simulation/biomes/h/materialization.test.ts`                                                               | N retains Ephyra-local ownership and peer-policy cases                                                          |
| Hub membership, visit, and side-room families | `simulation/biomes/n/rewards-validation-candidates.test.ts`                                                 | `progressive-hub.test.ts` owns prefix/clamp semantics rather than repeating the family matrix                   |
| Ship and wheel lifecycle                      | `simulation/biomes/o/validation.test.ts`                                                                    | Product/browser suites retain one interaction witness, not lifecycle policy                                     |
| Shop offer and purchase                       | N's candidate suite for joint inventory/offer; `simulation/biomes/p/simulation.test.ts` for purchase repair | F retains its invalid-boundary witness; candidate-session retains only one artifact-handoff result              |
| Shared Linear coverage and repair             | `progressive-biome.test.ts`                                                                                 | `unified-biome.test.ts` remains an orchestration witness                                                        |
| Application projection and cache              | `projections/candidateProjection.test.ts`                                                                   | Engine unions remain intact; tests do not restate engine eligibility                                            |
| Lazy application interaction boundary         | `architecture/candidateInteractions.test.ts`                                                                | One addressed load per interaction family, exact assembly reuse, and repeat-load caching                        |
| Import/API boundary and render purity         | `architecture/candidateBoundary.test.ts` and `candidateRenderPurity.interaction.test.tsx`                   | React retains zero evaluation/query work across F/G/H/I/N/O/P/Q                                                 |
| Product-loop work                             | `product-loops/UnifiedBiomePerformance.test.ts`                                                             | Underworld and Surface each retain cold candidate, edit publication, and cached Undo witnesses                  |

Several biome files mix candidate assertions with their owning simulation
policy, which is healthy; they should not be split merely to create
candidate-named files. The current diagnostic footprint is 3,003 lines across
the eight engine session/biome files in the table and 907 lines across the four
application boundary, purity, and product-loop files. Movement commits must
delete displaced session or umbrella assertions instead of copying those
matrices into new files.

The executable work baseline is:

- session evaluation of four ordered queries emits one `queryBatch` with
  `queryCount: 4` and returns results in input order;
- constructing representative Underworld and Surface workspaces performs two
  project evaluations and zero candidate batches;
- each of the thirteen table-driven workspace interaction families performs
  one cold batch except the cooperative reward domain, which performs fourteen
  declaration-owned batches; every repeat load performs zero work and no load
  reacquires project evaluation;
- authored-choice start and candidate takeover each remain lazy and emit one
  batch only when loaded;
- all nine F/G/H/I/N/O/P/Q render cases perform zero candidate batches and zero
  project evaluations;
- each representative Underworld and Surface product-loop candidate activation
  emits exactly one batch and zero project evaluations, each edit publishes
  exactly one project evaluation and zero candidate batches, and cached Undo
  emits neither; the diagnostic limits remain 750 ms for rebuild/candidate/edit
  and 50 ms for cached Undo;
- the entry gate is 82 test files and 713 tests with the complete typecheck,
  lint, formatting, production build, and diff checks passing.

##### Audited vertical review units

The audit replaces the former four-unit sequence with five producer-to-consumer
units. These are review boundaries, not line-count quotas.

#### B1: Exact evaluation assembly and ordinary room targets

- establish the deliberate query/result contract and explicit project/biome
  evaluation assembly while moving the complete `roomTarget` family with them;
- change the existing exact session to require that one assembly, with no
  `simulateProject` default or parallel project/evaluation/artifact arguments;
  retain one visible dispatcher in the current aggregate until the remaining
  evaluators move; do not create a temporary fallback dispatcher or legacy
  evaluator;
- make generation return its room-target candidate contexts explicitly and
  make normal, prefix, clamped, and pre-clamp project/progressive assembly carry
  the context produced by that exact execution;
- publish the exact assembly once through application state and structured
  workspace into candidate-session binding while preserving the existing
  data-only `ProjectEvaluation` selector and deeply equal public simulation;
- delete `candidateContextsByValidation`, its registration and accessor, their
  generation/simulation exports, and both selected/repaired accessor paths from
  the old candidate module in the same unit;
- remove the unproduced `biomeIncomplete` variant and its synthetic presentation
  fixtures while retaining all produced unavailable evidence;
- keep identity, lazy evaluation, batching, observation, and exact result order
  at the session boundary;
- prove that a missing or mismatched artifact cannot bind at the explicit
  assembly boundary, while direct physical-exit frontier behavior,
  selected-invalid target repair, deeply equal public simulation, and existing
  lazy batch/work counts remain unchanged;
- pass exact inputs to evaluators rather than a universal candidate context or
  source service that can answer unrelated queries;
- retain the room-target policy matrix at its audited owner and delete
  duplicate session/facade assertions in the same slice.

##### B1 delivery record (2026-07-31)

B1 now delivers one identity-attested `ProjectEvaluationAssembly` from project
simulation through Redux, structured-workspace composition, and exact
candidate-session binding. Its public surface remains the data-only project and
evaluation pair; the room-target capability is opaque, non-persisted, and
available only to the internal family evaluator that consumes it. The assembly
cannot be mixed, prototype-forged, reflection-constructed, or rebound with a
substituted artifact.

Generation's former room-target `WeakMap` sidecar and its registration,
accessor, and public export are gone. Normal complete, incomplete-prefix,
clamped-repair, and pre-clamp-repair paths return the exact artifacts that they
produced; direct ungenerated physical-exit evaluation retains its explicit
frontier constructor. The complete `roomTarget` policy has moved out of the
aggregate dispatcher, and the unproduced `biomeIncomplete` result residue has
been removed without changing the produced unavailable evidence.

The public `simulateProject` facade is deeply equal to the assembly evaluation,
ordinary evaluation selectors stay data-only, and cached undo/redo may reuse a
prior immutable project identity's matching assembly without crossing identity
boundaries. The completed gate is 82 test files / 718 tests plus typecheck,
lint, formatting, production build, and `git diff --check`.

#### B2: Remaining Linear structural families

- move `startRoom`, `takeoverPrebossBatch`, `batchRewardStore`, and
  `fieldsCageOutcome` as complete family evaluators behind the same session;
- give takeover/prefix-store/Fields evaluators only their exact catalog,
  authored source, selected public data, and progressive facts;
- keep source-domain validation, unresolved-store prerequisite evidence,
  selected-invalid repair, and takeover ownership with their family;
- remove their evaluator branches and displaced policy assertions from the old
  aggregate as each family moves.

##### B2 delivery record (2026-08-01)

B2 moves `startRoom`, `batchRewardStore`, `fieldsCageOutcome`, and
`takeoverPrebossBatch` into family-owned evaluator modules with their query,
support, result, domain-validation, progressive-prefix, and unavailable policy.
For those four families, the candidate aggregate deliberately re-exports their
contracts and only performs exhaustive discrimination and dispatch; it retains
the B3 through B5 evaluators pending their own vertical moves. Each B2 family
receives exact catalog, authored project, data-only evaluation, and query
inputs; no family receives an assembly, candidate artifact, universal context,
or session capability.

The shared selected/progressive recovery helpers now live in the internal
`evaluated-biome` neighborhood. Batch-store owns unresolved-store prerequisite
evidence, and room-target consumes only its narrow evidence helper rather than
retaining that policy. F owns the Linear policy matrix, N retains the
Hub-completed takeover exception, and the session suite retains only
identity/batching/order behavior with query-identifying order witnesses.

#### B3: Hub and local structural families

- move `hubSlot`, `hubVisit`, `sideRoomGeneration`, and `sideRoomEntryOrder`
  behind the exact session as one Hub-owned family;
- retain direct board constraints for membership and the existing scoped Hub
  proposal/region evaluation for visits and local changes; do not force them
  through the Linear progressive-repair abstraction;
- preserve authored side-room order, Hub visit chronology, first-blocking
  coverage, and exact owner addresses without reacquiring project evaluation
  or reconstructing Hub state in the dispatcher;
- leave N's suite as the family matrix and remove duplicate session,
  progressive-Hub, or application policy assertions.

##### B3 delivery record (2026-08-01)

B3 moves the complete Hub/local structural family into one Hub-owned candidate
module: `hubSlot`, `hubVisit`, `sideRoomGeneration`, and
`sideRoomEntryOrder`. The candidate aggregate now re-exports those contracts
and dispatches them exhaustively, but retains only B4 and B5 policy while
those vertical moves remain pending. The Hub evaluator receives only catalog,
authored project, data-only evaluation, and its addressed query; it does not
receive an assembly, artifact, or universal candidate context.

Direct physical-board constraints remain with membership. Visit and local
proposals replay only their relevant persistent Hub region: through the
addressed visit for a visit or side-generation edit, and through the parent
visit for local entry order. A blocked side-room repair likewise derives the
owning visit, bounds the pre-clamp replay to that visit, and verifies the exact
blocked local-child address before exposing repair support. It cannot expose a
later Hub visit. N retains the full family matrix, including the exact blocked
side and later-visit coverage witness; progressive-Hub retains its distinct
prefix/clamp policy coverage.

#### B4: Explicit reward-producer artifacts

- make reward evaluation return producer frontiers explicitly beside its
  unchanged data-only simulation and thread them through the B1 assembly;
- move `incomingReward`, `localReward`, `rewardWheelOffer`, and `shopOffer` as
  one complete producer-frontier consumer family;
- delete `frontiersBySimulation`, producer registration/accessor functions,
  their public exports, and all old consumer calls in the same unit;
- preserve sequential, joint-unordered, wheel, and joint-Shop frontier
  semantics, producer-owner evidence, exact pre-clamp repair, lazy capability
  lifetime, and deeply equal public reward/project results.

##### B4 delivery record (2026-08-01)

B4 makes reward-producer frontiers an explicit, opaque sibling of the
data-only reward simulation. Complete project evaluation, incomplete-prefix
evaluation, clamped replay, and exact pre-clamp replay each carry the producer
capability produced by that same reward execution into their biome artifact and
then the exact project assembly. Public reward and project outputs remain
data-only and deeply equal to their prior facade results.

The `frontiersBySimulation` sidecar, its producer registration and lookup
accessors, and their public simulation exports are gone. B4 deliberately left
the lifecycle-context sidecar isolated for B5, which subsequently removes it.
The reward producer evaluator now owns `incomingReward`, `localReward`,
`rewardWheelOffer`, and `shopOffer`;
the session extracts and passes only the addressed producer capability, never a
biome artifact or assembly. Exact first-blocking producer repair obtains only
the exact pre-clamp producer artifact, while later owners remain unavailable.
Sequential, joint-unordered, wheel, and Shop policy matrices stay with their
existing F/H/N/O owners; progressive tests now prove exact artifact threading,
runtime opacity, foreign-owner exclusion, and blocked-owner repair.

#### B5: Explicit room-lifecycle artifacts and thin dispatcher

- make reward evaluation return Ship and Shop lifecycle contexts explicitly
  through the same assembly without exposing closures in public reward or
  project data;
- move `shipEncounterCount`, all three wheel-lifecycle queries, and
  `shopPurchase` as complete family evaluators;
- delete `lifecycleContextsBySimulation`, lifecycle registration/accessor
  functions, their public exports, and every old consumer call in the same
  unit;
- preserve selected encounter support, ordered wheel continuation, dormant
  wheel activation, Shop purchase timing, exact owner repair, and the
  documented complete-invalid sole-owner fallback;
- extract the now-thin exact session and its one visible exhaustive dispatcher
  over all eighteen query kinds, convert the candidate entry to a deliberate
  public barrel, and delete the old aggregate implementation;
- retain in session tests only exact assembly identity, batching, ordering,
  lazy observation, unavailable taxonomy, and representative family handoff.

##### B5 delivery record (2026-08-01)

B5 returns opaque Ship and Shop lifecycle capabilities beside the data-only
reward simulation. The exact normal project evaluation, incomplete prefix,
clamped replay, and pre-clamp replay carry the lifecycle capability produced by
that execution through the biome artifact and exact project assembly. The
private construction maps and closures remain unreachable from public reward
or project data.

The lifecycle family now owns `shipEncounterCount`, the three wheel controls,
and `shopPurchase`. It projects only its addressed lifecycle capability from a
selected, exact pre-clamp, or complete-invalid sole-owner source; it never
receives a whole biome artifact or evaluation assembly. The former
result-keyed lifecycle registration/accessor path and public exports are gone.
The candidate entry is now a deliberate public barrel, while one session
module owns the exact-session contract, batching, observation, and an explicit
exhaustive dispatcher over all eighteen query kinds.

O fixtures prove selected encounter support, dormant wheel activation, exact
wheel repair, and later-owner denial. P proves the complete-invalid
sole-owner Shop fallback and its pre-purchase timing. Session and progressive
fixtures prove binding laziness, public-data opacity, and exact normal/prefix/
clamped/pre-clamp artifact threading.

Campaign B closes when no candidate semantic fact or capability is discoverable
only through registration or a result-keyed sidecar; every query kind has one
explicit evaluator and one primary test owner; no universal candidate context,
parallel dispatcher, or compatibility barrel remains; engine candidate,
application boundary, deterministic result, render-purity, and work-count
fixtures pass; and the complete engine and repository gates pass.

##### Campaign B closure record (2026-08-01)

Campaign B is closed. Its three semantic capability sidecars have been
replaced by explicit exact artifacts, while the project/evaluation identity
attestation and ordinary reproducible caches remain as permitted. Every
candidate query has one family evaluator and the prepared session has one
exhaustive dispatcher; no compatibility aggregate, universal candidate context,
or public capability leak remains. `npm run check` passed with 82 test files
and 716 tests, together with typecheck, lint, formatting, and the production
build.

### Campaign C: Authored Core

#### Campaign C entry audit (completed 2026-08-01)

The authored-core baseline is committed B4 at `7ffb525` plus the B5 worktree as
observed during the audit. B5's production and test delta was confined to
simulation/candidate code; `git diff` reported no authored-project source or
test delta. The audit deliberately did not modify or test through the live B5
production path.

The current authored core contains 18 production files and 6,043 lines. Its
focused test neighborhood contains five files and 2,889 lines. These counts are
diagnostic only; the review-unit decisions below follow caller, failure, and
test change neighborhoods.

| Responsibility                            | Current producer and consumers                                                            | Failure or incompleteness contract                                                                                                                      | Audit decision                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| declaration-owned room defaults           | `roomState.ts`; topology creation and occurrence replacement                              | returns one complete state; catalog/declaration contradictions fail through `ProjectDocumentContractError`                                              | move to a dedicated default-construction owner                         |
| replacement reconciliation                | `roomState.ts`; `ReplaceOccurrenceRoom` only                                              | preserves only declaration-compatible leaves; otherwise uses the supplied complete default; internal missing-default checks are impossible-state errors | move beside defaults but keep a separate transition product            |
| persisted room-state decoding             | `roomState.ts`; topology codec only                                                       | path-aware `ProjectDocumentContractError`; preserves dormant Shop state and rejects malformed persisted leaves                                          | move to a codec owner, not a public room-state facade                  |
| topology queries                          | `topology.ts`; authored commands, simulation, workspace projection, and test expectations | pure facts return a value, `undefined`, or an intentional empty exit set; they do not repair or throw command failures                                  | extract only demonstrated query facts                                  |
| topology decoding and semantic validation | `topology.ts`; project codec only                                                         | one path-aware decode product over raw occurrences, structural owners, selected reachability, and normalized room states                                | retain as one codec pipeline after query extraction                    |
| occurrence and leaf commands              | `commands/occurrence-state.ts`; delegated through the topology command default branch     | command failures use `ProjectCommandContractError`; changed proposals are re-decoded and document failures are wrapped at the public command boundary   | extract demonstrated families and make dispatch typed and exhaustive   |
| topology commands                         | `commands/unified-topology.ts`; public command dispatcher                                 | atomic creation, replacement, selection, downstream removal, repair, and Hub handoff invariants                                                         | retain one topology transition owner; remove unrelated routing from it |
| topology removal impact                   | `topologyImpact.ts`; commands and workspace structural controls                           | pure, explicit removal description and application                                                                                                      | retain unchanged as an already coherent authority                      |

`applyProjectCommand` re-decodes every changed proposal and translates document
contract failures into command contract failures. That is the established
authored invariant boundary, not a refactor audit or shadow model; Campaign C
preserves it unless a separate design and performance decision changes the
authored command contract.

##### Repeated-traversal findings

- declaration-owned physical exits and fixed-width takeover transitions are
  already shared semantic facts, but they are buried in the codec module;
- selected-exit resolution is independently reconstructed in authored
  commands, completeness, materialization, and workspace projection. It is one
  exact authored fact and belongs in the narrow query product;
- selected-spine indexing, staged-selection validation, cycle validation, and
  codec reachability look superficially similar but have different inputs,
  stopping rules, and failure behavior. They remain separate; Campaign C does
  not create a generic traversal engine;
- owner construction in the codec intentionally retains raw room state until
  structural role and entry activity are known. Moving it across a validation
  boundary would require a second raw topology product with no consumer;
- repeated `find` calls for an occurrence are not enough evidence for an index
  or topology read model. A narrow decision-by-source query is allowed only
  where current consumers need the same optional answer.

##### Public surface and dependency findings

The declared `@run-planner/engine/authored-project` export is used by 123 source
and test files, and cross-package consumers use that declared package surface
rather than internal authored paths. The dependency direction is healthy and
there is no module-level semantic registry, `WeakMap`, or sidecar in the
authored core.

The barrel nevertheless exports implementation details with no production
consumer outside the authored core: room default/reconciliation/decoder
functions and their context types, `decodeBiomeTopology`,
`declaredPhysicalExitKeys`, `fixedWidthOneTakeoverForSource`, and the batch/biome
helper codecs and constructors. Campaign C removes these from the package
surface as their owning slices move. The application-consumed physical-exit and
fixed-transition queries, topology impacts, addresses, commands, document
codec, history, and persisted models remain deliberate.

##### Test-ownership and executable baseline

The focused lane passes:

```text
npx vitest run packages/planner-engine/test/authored-project --reporter=dot
Test Files  5 passed (5)
Tests       98 passed (98)
```

The per-file baseline is 30 address, 16 codec, 30 command, 16 default, and six
topology-impact tests. `commands.test.ts` is 2,161 lines, including roughly 458
lines of setup and several codec/query matrices. Eight of the thirteen commands
currently delegated to `occurrence-state.ts` have no primary authored-command
test: incoming reward, local reward, wheel offer count, wheel store, wheel picked
index, Ephyra generation, Ephyra entry order, and Shop offer replacement. Their
existing simulation and React witnesses remain boundary tests, not substitutes
for transition ownership.

Codec rejection and round-trip cases move to `codec.test.ts`; pure topology
facts move to a topology-query suite; project-state, topology-transition,
room-replacement, and occurrence-leaf cases move with their production owners.
Shared test builders may construct command sequences under authored test
support, but they must not reproduce eligibility, reconciliation, topology, or
default policy. The broad command suite is deleted by the final command unit,
not copied into several new umbrella suites.

The full engine and repository gates were intentionally not run during the
entry audit because B5 had live uncommitted simulation changes. They run after
B5 is committed and at Campaign C closure; the focused 5-file/98-test lane is
the executable authored baseline for these review units.

#### C1: Authored room-state owners (one review unit)

- replace `roomState.ts` with direct internal
  `room-state/declaration.ts`, `room-state/defaults.ts`,
  `room-state/replacement.ts`, and `room-state/codec.ts` modules;
- keep role/context and declaration-descriptor checks with the smallest shared
  room-state contract. Do not add an `index.ts` barrel or a room-state service;
- move focused default and reconciliation tests with the products and move
  persisted rejection cases to the codec owner;
- remove room-state implementation exports from the public authored barrel and
  delete `roomState.ts` in the same commit;
- preserve complete defaults, declaration-compatible leaf retention, dormant
  Shop inventory, Ephyra side-room ownership, and exact decode paths/errors.

##### C1 completion record (2026-08-01)

`roomState.ts` has been replaced by four direct internal owners: the shared
declaration contract, complete default construction, replacement
reconciliation, and the path-aware persisted codec. The only three authored
consumers import those owners directly, and the authored public barrel no
longer exposes their implementation symbols or context types. Focused owner
suites now hold the complete defaults, compatible-replacement, dormant-Shop,
Ephyra, and exact malformed-leaf matrices; command tests retain only their
topology-command boundary witnesses. No room-state barrel, facade,
compatibility path, or second topology model was introduced.

#### C2: Narrow topology queries (one review unit)

- replace the mixed `topology.ts` location with a codec module and a query
  module; the authored public barrel remains the only deliberate package
  surface, so no topology convenience barrel is added;
- move declared physical exits, selected exit/target resolution, selected
  ordinary-batch index, decision-by-source lookup where demonstrated, and
  fixed-width takeover facts as narrow pure functions;
- migrate the exact selected-exit fact across authored commands, completeness,
  materialization, and workspace projection in this unit, deleting each local
  reconstruction rather than forwarding it;
- keep raw-codec traversal and differently failing staged/cycle/reachability
  loops private to the codec;
- establish a focused topology-query suite from the query cases currently
  embedded in `commands.test.ts` and delete the displaced assertions there.

#### C3: Codec boundary and test ownership (one review unit)

- retain raw topology decoding, semantic topology validation, structural-owner
  construction, and room-state decode orchestration as one path-aware codec
  product; there is no raw-topology or validation product to expose;
- move malformed topology, owner, cycle, staged, dormant-leaf, and command-
  produced round-trip matrices from the broad command suite to codec tests,
  retaining only representative command-boundary wrapping evidence elsewhere;
- remove codec-only topology, batch-state, and biome-state helpers from the
  public authored barrel while keeping the project document codec public;
- preserve schema rejection, incomplete/context-invalid authored state,
  occurrence identity, declaration ordering, and exact error paths.

#### C4: Explicit command families (three review units)

The command work proceeds as complete vertical families, with tests moved in
the same commit:

1. Replace `commands/history.ts` with `commands/project-state.ts`, keep project
   metadata there, move biome-field state there from the topology owner, define
   explicit command-family unions, rename the remaining unified module to its
   topology responsibility, and replace default-fallthrough delegation with
   visible exhaustive routing. `ReplaceFieldsCageOutcome` remains with
   topology/batch state because it edits a decision, not a room occurrence.
2. Move room replacement with its occurrence-role lookup, source reward-store
   reconciliation, default construction, compatible-leaf reconciliation, and
   focused replacement matrix.
3. Move incoming/local reward, Ship encounter/wheel, Ephyra generation/order,
   and Shop offer/purchase transitions into cohesive leaf handlers behind one
   exhaustive occurrence dispatcher. Add primary command tests for all thirteen
   kinds currently handled by `occurrence-state.ts`: the Fields case in the
   topology-command suite and the remaining twelve in room-replacement or
   occurrence-leaf suites. Retain only representative downstream UI and
   simulation witnesses, and delete `commands/occurrence-state.ts` plus the
   superseded broad `commands.test.ts` path.

Handlers receive `document`, `catalog`, `located biome`, and their exact command
type as needed. They do not receive a command context, service table, topology
index, or prebuilt lookup bag. A mutation helper moves only after a second real
family consumes the same operation; no helper-only preparation commit is
allowed.

#### C5: Topology-command retention decision (no separate commit)

The entry audit rejects the tentative topology-family split. Start, ordinary
batch, takeover, selection, capacity repair, downstream removal, linked/Hub
construction, Hub closure, and completed-Hub handoff all mutate one persisted
graph and share atomic invariants. Splitting them now would either duplicate
those invariants or introduce a broad topology transition context.

C4's first unit removes biome-field and occurrence routing and gives the
aggregate an accurate topology name, but keeps its transition implementation
together. Reopen this decision only if a later representative topology change
demonstrates a smaller independent dependency and test neighborhood; file
length alone is not that evidence.

Campaign C closes after six review units when room defaults, reconciliation,
room decoding, topology queries, codec validation, project-state commands,
topology transitions, room replacement, and occurrence leaves each have one
authority and primary test owner. `roomState.ts`, mixed `topology.ts`,
`commands/history.ts`, `commands/occurrence-state.ts`,
`commands/unified-topology.ts`, and the broad `commands.test.ts` no longer
exist; no second topology model, broad command context, parallel path,
unnecessary public implementation export, production self-audit, or duplicated
test matrix remains. The focused authored lane, affected simulation/planner
lanes, import-direction checks, deterministic project fixtures, and complete
repository gate pass.

### Campaign D: Ordered Engine State Flows

Campaign D is conditional decomposition behind already explicit public
products. History and reward movement is vertical. No commit merely wraps loose
variables in a state object for a later commit to rewrite. A state product
contains mutable state-machine facts only; catalog services and source lookups
remain separate inputs rather than becoming another dependency bag.

#### Campaign D entry audit (no implementation commit)

- inventory every history and reward event kind, mutable field, initialization
  rule, lookup, final projection, and primary test matrix;
- map each field to the event families that read and write it and identify
  invariants that require several families to remain together;
- trace the reward candidate-artifact product established by Campaign B and
  verify that D can reorganize internals without changing that consumer
  boundary;
- record deeply equal history/reward outputs, possibility-branch ordering,
  lifecycle checkpoints, candidate results, and current work counts;
- propose complete vertical slices and expected deletions independently for the
  reward and history flows. File length alone is not evidence to split either
  coordinator.

#### D1: Reward sources, state, and event transitions

- build immutable snapshot/history lookup products only where several event
  families consume the same answer;
- move target creation/offer processing and lifecycle
  acquisition/wheel/Shop/completion processing as complete vertical families;
- introduce only the reward state fields required by event families moved in
  the same commit, and remove their loose predecessor fields and branches;
- keep one visible chronological loop and exhaustive event dispatch;
- preserve possibility branching, physical offer order, explicit candidate
  artifact capture, exact lifecycle checkpoints, and the public reward result.

The opening audit decides whether reward work is one vertical review unit, two
or more complete event-family units, or retention of a cohesive section. A
state-only or lookup-only preparation commit is not an allowed boundary.

#### Conditional D2: History fold state and transitions

- first determine whether a representative event-family change currently
  crosses unrelated initialization, transition, and freezing policy;
- if it does, move the smallest complete event family with exactly the mutable
  fold state it owns, its validation, and its primary tests;
- keep one chronological loop and visible exhaustive dispatch, isolate
  initialization/final freezing only when that reduces a demonstrated change
  neighborhood, and preserve deeply identical ordered history products;
- if the present fold is the more cohesive owner of its ordered invariant,
  retain it and record that decision without an implementation commit.

#### D3: Program closure

- consolidate, rather than first introduce, import-DAG, composition-root,
  exact project/evaluation, explicit candidate-artifact, ordered-state, and
  primary-test-ownership evidence;
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
9. Which test owns the complete policy matrix now, and which superseded
   umbrella assertions were removed?
10. Can every required semantic fact or capability be reached from the explicit
    returned product rather than registration, initialization order, or a
    sidecar?

Movement commits must not contain opportunistic behavior fixes. If the move
reveals a real defect, preserve it with a focused fixture, complete the
reorganization commit, and fix it in a separately authorized change.

## Audit Matrix

The following audits are required at the start of each affected campaign and
again at closure:

| Audit                       | Evidence                                     | Passing condition                                                                                                                                                                                                              |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authority-to-consumer trace | Product signatures plus review               | Every important product has one named producer, explicit inputs, and identifiable consumers.                                                                                                                                   |
| Import graph                | Automated import rule or architecture test   | No cycle exists; imports follow the declared package and subsystem direction.                                                                                                                                                  |
| Dependency injection        | Composition fixture plus review              | Application services are constructed at the composition root; stage dependencies are narrow and explicit.                                                                                                                      |
| Hidden registration         | Returned-product closure fixture plus review | A later stage does not depend on maps or registries populated only as a side effect of producing an earlier result.                                                                                                            |
| Semantic sidecars           | Product signatures plus consumer trace       | A cache or identity attestation may verify an explicit product, but no result-keyed sidecar is the sole carrier of semantic facts or callable capabilities.                                                                    |
| Semantic ownership          | Independent test closure fixtures            | Authored owners, findings, controls, and inspector destinations resolve by stable semantic address without executing a second production model.                                                                                |
| Duplicate reconstruction    | Boundary rule plus review                    | React and downstream projections do not repeat physical-exit, containment, eligibility, lifecycle, or reward rules.                                                                                                            |
| Mutation boundary           | Review                                       | Mutable builders are local to one stage and freeze a complete returned product before crossing the boundary.                                                                                                                   |
| Exhaustive dispatch         | Typecheck plus family fixtures               | Closed command, event, and candidate vocabularies retain explicit exhaustive handling.                                                                                                                                         |
| Public surface              | Typecheck plus import fixture                | Existing supported imports remain deliberate; temporary compatibility barrels do not survive closure.                                                                                                                          |
| Test authority              | Ownership inventory plus review              | One behavior has one primary complete-matrix assertion owner; representative boundary witnesses remain focused, while facade, React, and product suites match their product boundary and do not assert incidental file layout. |
| Facade responsibility       | Import graph plus function-inventory review  | The workspace facade composes stages and caching; it owns no occurrence, decision, Hub, rail, or audit family logic.                                                                                                           |
| Change neighborhood         | Product trace plus representative review     | A family change enters its producer, binder where applicable, and focused tests—not a production audit mirror, unrelated families, or the facade.                                                                              |
| Movement accounting         | Per-commit diff statistics and review        | Moved code leaves no parallel path; unexplained production growth does not accumulate during decomposition.                                                                                                                    |

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
- Candidate evaluators receive explicit producer artifacts; reward and
  lifecycle capabilities are not discovered through result-keyed registration.
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
baseline for A7 through A16. Its diagnostic source baseline is 9,848 lines in
`structured-workspace/`, including a 6,213-line projector, plus 479 lines in
`BiomeWorkspace.tsx`. These are not quotas. They make movement and unexplained
growth visible while the responsibility and import audits remain authoritative.

The A11 structural checkpoint passed 76 files and 695 tests. Its contraction
baseline was 10,758 non-test lines in `structured-workspace/` across 29 files,
a 349-line projector, a 2,969-line production `audit/` directory, and 479
lines in `BiomeWorkspace.tsx`.

A12/A13 delivery removes the production `audit/` directory: the deleted modules
are `authored-interaction-expectations`, `authored-leaf-expectations`,
`authored-requirement-closure`, `interaction-closure`, `interaction-equality`,
and `semantic-closure`. It also deletes broad default-inspector and destination
closure passes. Retained production seams are narrow and local: the shared
`fields-cage-counts` derivation, the exact `finding-routing` owner, and
construction-time duplicate/provenance/declaration checks. Independent leaf,
topology, and structural-control closure now lives only in test support and
does not mirror interaction payloads. The final inventory is 7,463 non-test
lines across 25 files: a 3,295-line and four-file reduction with no renamed
shadow audit. The final single-flight `npm run check` passed 76 test files and
703 tests, all typechecks, lint, formatting, and the production build; `git diff --check`
also passed.

The post-A13 test-ownership baseline is 76 test files, 703 tests, and 28,607
lines in `*.test.*` and `*.spec.*` files, compared with 60 files and 24,028
lines at `f69dc709a8e36b72ae624855ab043c2a02264b8a`; it contains no
structured-workspace expected/closure support. A15.1 subsequently added ten
non-test support modules (1,673 lines) and three support self-tests (210 lines).
The fourteen focused structured-workspace module tests total 2,551 lines, while
the legacy workspace facade, contract, and React parent suites grew by 1,566
lines. A14, A15.1, A15.2, and A16 used these figures to make retained
duplication visible; they are not quotas and test-count reduction is allowed.

## Non-Goals

- no authored schema or codec-version change;
- no new biome, room, lifecycle, reward, or candidate rule;
- no Shop purchase-order implementation;
- no coupling of resumed Commit 5b.3 or 5b.4 presentation work to Campaigns B
  through D;
- no UI redesign, graph library, state-management replacement, or component
  framework;
- no generic event bus, plugin registry, dependency-injection container, or
  pipeline abstraction;
- no declaration compression or metaprogramming;
- no file-size, export-count, or directory-count quota;
- no performance optimization without measured evidence;
- no assertion-count, test-file-count, or test-line-count quota;
- no production API or component redesign solely to make test movement easier;
- no broad public API cleanup outside the product boundary moved by the active
  vertical slice;
- no compatibility layer left behind after a moved responsibility.

## Closure and Retirement

This plan is complete only after the foundation and all four campaigns pass
their gates, the complete repository gate passes, and the final audit matrix
has no unresolved ownership or import finding. A13 closed the production
contraction, rather than the earlier A11 structural checkpoint. Campaign A
and its bounded A14/A15.1/A15.2/A16 test-ownership correction are complete;
Campaign B is now active. Commit 5b.3/5b.4 remain behavior-ready and resume
after the remaining cleanup campaigns close.

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
