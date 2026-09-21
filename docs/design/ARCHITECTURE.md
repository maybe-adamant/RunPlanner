# Architecture

## Purpose and Reading Map

Run Planner is an authoring and simulation application. Its three ownership
lanes are the Hades II catalog, the pure planner engine, and the planner
application. This document explains their relationship and how to extend them
without creating parallel policy.

Start with the lane that owns the question:

| Question                                                   | Entry document                                    |
| ---------------------------------------------------------- | ------------------------------------------------- |
| What does the game declare, and how is it normalized?      | [Catalog Model](CATALOG_MODEL.md)                 |
| What does authored state mean, and what follows from it?   | [Planner Engine](SIMULATION_AND_VALIDATION.md)    |
| How is that result edited, displayed, navigated and saved? | [Planner Application and Editor](EDITOR_MODEL.md) |

The engine guide routes deeper authored-state, generation, lifecycle, reward
and candidate contracts. The application guide routes workspace layout and
contextual-picker behavior. [Biome documents](../biomes/) own concrete route
rules; [audits](../audits/README.md) own source evidence and bounded unknowns.
[Game Integration Boundary](GAME_INTEGRATION_BOUNDARY.md) owns the downstream
execution contract.

## Product Contract

The application models possible supported outcomes, not their likelihood.
An authored choice selects one concrete outcome. Validation checks whether
the exact history and declarations support it. Positive weight is not a reason
to reject an unlikely choice. Zero and forced boundaries matter; route
likelihoods, seeded RNG replay and Monte Carlo search do not belong here.

Persisted choices and derived truth are separate. Structurally representable
incomplete and context-invalid plans remain editable documents. Evaluation
does not silently repair them, choose replacement values or delete suffixes.
Semantic commands own explicit changes; Undo/Redo restores authored snapshots.

A project contains one route. Catalog Room Declarations have unique game
names, while authored Room Occurrences have stable IDs and may repeat a game
name. Rendered rows, tabs and component identities are not domain identities.

The external game module consumes a declarative execution plan. It realizes
supported outcomes and checks conformance under the integration contract. It
is not another planner or simulator, and its Lua/UI constraints must not shape
the application's authored model or React editor.

## Dependency Direction

```text
catalog construction → pure core ← application composition → React UI
```

This is a code-dependency map, not the runtime processing order. At runtime:

```text
source-backed declarations → immutable catalog
profile / semantic commands → immutable authored project
catalog + project → exact engine evaluation assembly
project + matching assembly → application projections and bound interactions
bound interaction → command → replacement project
validated engine product → execution document → external game module
```

### Catalog — packages/hades2-catalog

Owns explicit game declarations and their compilation into the engine's
supported catalog contract. It may import the engine's declared catalog-schema
and normalized interfaces, but not authored state, simulation implementation,
application composition or React.

### Engine — packages/planner-engine

Owns authored state, semantic addresses, codecs, commands, history,
requirements, reward transitions, materialization, simulation, candidates,
validation, findings, authoring queries and execution assembly/codecs.

It defines the normalized interfaces it consumes. It must not import the
catalog implementation, React, Redux, Tauri, browser/filesystem APIs or game
runtime objects. Operations receive explicit inputs and return pure products
or immutable transitions. Presentation labels invented by the editor, focus
destinations and picker sections are not engine products.

### Application — apps/planner

Owns composition, persistence adapters, state coordination, projections,
interaction binding and React presentation. It constructs the catalog and
engine collaborators; it does not reconstruct their rules.

Redux coordinates authored history, session state and atomic publication.
React renders supported products and invokes bound intents or deliberately
retained fixed semantic mappings. Neither layer repairs topology, determines
eligibility or counts lifecycle events.

## Construction and Publication

Each producer returns every fact and capability its consumers need. Do not
return an apparent result while hiding essential semantic data in module
registration, initialization order or a result-keyed sidecar map.

A stage may use a mutable builder internally. Its boundary returns a complete
immutable product. A cache may reuse that product, and identity attestation
may verify its provenance; neither substitutes for carrying the product.

Application-wide collaborators are created at the composition root and
passed as narrow capabilities. A parameter object or factory is justified by
a real product boundary, not merely a long signature. Do not introduce an
ambient context, service locator, mutable service table or dependency-injection
container.

The authored snapshot and its exact evaluation are published together.
Undo/Redo may reuse an assembly for the identical immutable snapshot. It must
never combine current authorship with another snapshot's history, findings or
candidate context.

Evaluation coverage is not authoring readiness. A missing required choice
locks later repair regions; invalidity alone does not. Retained authored
structure stays visible even without assessed facts. The engine owns the
[horizon](SIMULATION_AND_VALIDATION.md#authoring-readiness); the application
[binds it to controls](EDITOR_MODEL.md#authored-first-assembly).

## Code Placement and Imports

Place a module with the authority that owns its policy, not the first caller
that needs it. Before adding a boundary, name its owner, inputs, returned
product, consumers, primary tests and superseded path. Prefer the nearest
existing semantic neighborhood over generic common/shared/helpers directories.

An assembly module composes owned products; it does not become their policy
owner. An `index.ts` is a deliberate supported surface, not a convenience
barrel. Large chronological or atomic coordinators can be correct boundaries:
splitting their mutable state across wrappers can make ownership worse.

Cross-package consumers use declared package exports. Within the planner,
cross-root imports use `@planner/*` for composition, persistence, projections,
state, ui and workspace. Test support uses `@planner-test/*`, and repository
authored fixtures use `@run-planner/test-fixtures`. Immediate-neighborhood
`./` and `../` imports remain appropriate; planner imports do not climb two
or more parent directories.

Aliases identify ownership roots, not public APIs or injection boundaries.
The engine uses direct internal relative imports instead of routing internal
dependencies through public barrels. Pure package imports remain static, and
planner aliases do not enter pure package source. Enforce mechanically
observable boundaries through TypeScript, ESLint or architecture tests.

Production source must not import test fixtures, harnesses, expected manifests
or observers. Those belong under test support.

## Adding a Feature

### Reuse existing meaning first

A new room using existing templates should primarily be declaration work:
supply its exact exits, encounter binding, reward surface, eligibility and
defaults. Normalization proves the contract; existing engine and application
consumers use it. A biome-name branch is not justified merely because the
declaration is new.

A genuinely new mechanic starts at the authority that cannot yet express it.
For a targeted acquisition:

1. Catalog describes the supported effect and its declaration facts.
2. Authored state persists only the user's choices; commands maintain their
   structural ownership atomically.
3. Lifecycle determines when settlement runs.
4. Settlement returns branch effects, findings and exact repair frontiers
   together.
5. Candidates consume those frontiers; the application binds the child and
   its finding to one repair interaction.
6. React renders the supported control and submits a complete intent.

Not every feature touches every lane. Layout polish may need no engine
change; a supported declaration may need no application change. Execution
publication consumes engine meaning rather than inventing an additional
semantic interpretation.

### Verify the handoff, not only the happy path

Keep the complete policy matrix with its owning authority. Consumer suites
retain representative contact witnesses rather than repeat that matrix.
A targeted effect needs an incomplete-target repair witness, not just proof
that a complete acquisition succeeds. A generated pickup needs a source edit
and removal witness, not just proof that it appears once.

Use real authored checkpoints for interactions that span the route. Shared
checkpoints are current-schema documents decoded and frozen through the
production codec, not serialized evaluations or rendered workspaces. Their
manifest attests identity, intent, provenance and canonical bytes. Static
imports preserve changed-test reachability. Command/codec/history tests remain
command-driven; downstream tests need not replay the entire route to obtain
a starting state.

Fixture migrations must preserve each scenario's intent, pass current strict
decoding and regenerate canonical bytes and hashes. A one-to-many migration
must emit all documents rather than silently select a sibling. Temporary
transformers are removed after conversion; no permanent alternate fixture
decoder is introduced. Generated execution fixtures follow the separate
byte-preservation and mirroring discipline in contributor instructions.

## Hosts, Performance and Maintenance

Vite builds the same React application for browser and desktop. Tauri owns
native windows, packaging, scoped file transport and the remembered active-file
reference. Rust does not parse planner semantics. Browser/filesystem effects
stay behind application adapters; desktop integration does not move simulator
rules into the host. Native file-drop interception remains disabled to retain
ordinary HTML interaction behavior.

Build identity is application metadata, separate from schema and catalog
identity. Official CI builds supply one validated release version to Tauri and
the frontend, together with the source commit. Local builds identify themselves
as Development. About is available without an open project.

Release discovery is an optional host capability, not a startup dependency.
Official desktop builds check once asynchronously; application policy compares
stable versions and requires the matching portable archive and checksum before
offering a download. Native transport restricts requests and opened URLs to the
official release source. React presents notifications and manual checks;
neither checks nor downloads replace the executable or modify the project.
The publishing workflow uploads assets to a draft before publication and does
not replace assets on a published release.

TypeScript checks static contracts; runtime codecs protect external contacts.
Vitest transformation alone is not a type proof. Correctness and performance
are separate verification products: shared watchdogs detect likely hangs,
while measured rebuild, candidate, edit and cached-Undo comparisons assess
latency. Commands and calibrated thresholds belong to repository configuration
and contributor instructions, not duplicated design tables.

Optimize measured bottlenecks while preserving pure input/output contracts.
Keep normalized data immutable, avoid duplicate derived Redux state and keep
subscriptions narrow. Do not introduce workers, incremental invalidation or
new infrastructure solely in anticipation of growth.

Refactor in complete vertical slices: move an authority, its consumers and
primary tests, then remove the superseded path. Separate behavior-preserving
movement from behavior corrections. File count and line count are evidence,
not quotas. Production checks protect real contacts; exhaustive structural
closure and mutation auditing belong in tests, not a second production model.

Stable documents describe current ownership, invariants, examples and safe
extension. They do not accumulate version milestones or gate histories.
Temporary investigations and delivery plans are retired after their durable
conclusions have an owning home.
