# Agent Instructions

This repository is the standalone Run Planner application. It is app-first:
the catalog, authored plan, simulator, validator, and sophisticated editor live
here. The Hades II game module is a later consumer of a declarative plan and
must not shape the current UI or simulation around ImGui or ModpackLib.

## Read Before Editing

Read `README.md` and the relevant authority documents under `docs/` before
changing architecture or domain behavior. Stable cross-cutting design lives in
`docs/design/`, biome rules live in `docs/biomes/`, source evidence lives in
`docs/audits/`, and delivery history lives in `docs/progress/`. The
task-oriented documentation map is maintained in `README.md`.

The prior implementation at
`../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/` is evidence,
not an API contract. Harvest verified rules and fixtures; do not port control,
storage, draw, or lifecycle machinery mechanically.

## Dependency Direction

The intended package direction is:

```text
catalog construction -> pure core <- application composition -> React UI
```

The pure core may define the normalized interfaces it consumes, but it must
not import React, Redux, Tauri, browser APIs, filesystem APIs, or UI component
libraries.

The UI may dispatch semantic commands and render derived projections. It must
not implement room eligibility, reward bags, lifecycle counters, or topology
repair.

## Ownership Lanes

Treat the repository as three ownership lanes—two packages and one application.
Route a change by the question it answers, not by the layer that first needs
the result.

### Hades II Catalog — `packages/hades2-catalog`

- Owns Hades II declarations, source-backed game facts, catalog construction,
  and normalization of those declarations into the engine's supported catalog
  contract.
- Answers “what does the game declare?” and “how is that declaration represented
  in the normalized catalog?”
- May depend on planner-engine's declared catalog-schema and normalized
  contracts. It must not import the planner application or own authored-project,
  simulation, validation, candidate, Redux, or UI behavior.
- Primary tests are declaration, compiler, normalization, and catalog regression
  tests. Use `npm run test:catalog` while developing this lane.

### Planner Engine — `packages/planner-engine`

- Owns the pure authored model, addresses, codecs, defaults, semantic commands,
  history, requirements, reward kernel, materialization, simulation, candidates,
  validation, findings, and engine-owned authoring queries.
- Answers “what does this authored state mean?”, “is this transition valid?”,
  and “what pure derived result follows from the catalog and authored snapshot?”
- Defines the normalized interfaces it consumes but must not import the
  `hades2-catalog` implementation or any planner application, React, Redux,
  browser, filesystem, or presentation code.
- Must not return picker sections, component state, focus destinations, labels
  invented by the editor, or other React-facing products.
- Primary tests live beside the owning engine authority. Use
  `npm run test:engine` while developing this lane.

### Planner Application and React — `apps/planner`

- Owns application composition, persistence adapters, Redux coordination,
  UI-session state, application projections, interaction binding, and React
  presentation.
- Answers “how is an engine product composed, presented, navigated, and invoked
  in this application?”
- The composition root may construct the catalog and engine collaborators.
  Application projections may adapt supported engine products into editor
  products; React renders those products and dispatches complete bound intents
  or deliberately retained fixed semantic mappings.
- Must not reproduce catalog normalization, authored-command validation,
  topology closure, reward legality or store precedence, lifecycle,
  simulation, candidate policy, or finding policy.
- Put browser/filesystem effects behind application-owned adapters. Keep Redux
  responsible for coordination and history publication, not domain semantics.
- Primary tests are focused projection, interaction, Redux, UI, contract, and
  product-loop witnesses. Use `npm run test:planner`, `npm run test:ui`,
  `npm run test:contract`, or `npm run test:product` according to the boundary
  changed.

When a feature crosses lanes, establish the authoritative fact or transition in
its owning lane first, expose the narrow supported product, and adapt it
in the consuming lane. Keep the complete policy matrix with its authority;
consumer and product-loop tests retain representative contact and workflow
witnesses rather than copying that matrix.

## Code Placement and Module Boundaries

- Place code with the semantic authority that owns its policy or product, not
  with whichever caller first needs it. Prefer the nearest existing feature
  neighborhood over a new generic `common`, `shared`, `helpers`, or `services`
  area.
- Before creating a module boundary, identify its owner, explicit inputs,
  returned product, consumers, primary tests, and the old code it displaces.
- Use `index.ts` only for a deliberate supported surface. Do not add barrels
  merely to shorten imports or hide dependency direction.
- Use assembly or composition modules for wiring one level of owned products.
  They must not become semantic policy owners or ambient dependency registries.
- Cross-package imports use declared package exports. Planner imports follow
  the aliases and immediate-neighborhood relative-import rules in
  `docs/design/ARCHITECTURE.md`; aliases identify ownership roots, not public
  APIs or dependency injection.
- Put test-only fixtures, harnesses, builders, and observers under test support,
  never production `src/`. Production code must not import test support.

When a placement or import rule is mechanically observable, enforce it with
TypeScript, ESLint, or an architecture test in addition to documenting it.

## Construction and Data Flow

- Each stage receives explicit inputs and returns every product later stages
  consume. Do not communicate semantic facts through hidden registration,
  module initialization order, or a sidecar map keyed by an apparent result.
- A cache or identity attestation may memoize or verify an already-complete
  explicit product. It must not be the sole carrier of semantic facts or
  callable capabilities required by a consumer.
- Construct application-wide collaborators at the composition root and inject
  narrow capabilities. Do not introduce a dependency-injection container,
  service locator, mutable service table, or catch-all context object.
- Use parameter objects, interfaces, and factories only for real construction
  or product boundaries. Do not create them solely to make a long call shorter
  or to prepare for a later refactor.
- A mutable builder is acceptable inside one stage. Freeze and return its
  complete product before crossing the stage boundary.
- Keep closed semantic dispatch explicit and exhaustive. An orchestrator may
  remain long when chronological order or one atomic invariant is its coherent
  responsibility.

## Refactoring Discipline

- Before broad reorganization, inventory current responsibilities,
  producer/consumer paths, hidden state, test ownership, expected deletions,
  and relevant work-count baselines.
- Refactor in complete vertical slices: move one authority with its consumers
  and primary tests, then remove the superseded path in the same commit. Do not
  land context-only, interface-only, state-wrapper-only, compatibility, or
  forwarding commits for later work to repair.
- Keep behavior-preserving movement separate from product behavior changes. If
  movement exposes a defect, characterize it and fix it in a focused follow-up.
- Do not add production shadow models, exhaustive self-audits, or manifests to
  make a refactor testable. Production validation protects real contact and
  invariant boundaries; independent closure and mutation auditing belongs in
  tests.
- Give each policy and edge-case matrix one primary test owner. Facade,
  integration, and product-loop suites retain representative boundary witnesses
  rather than duplicate the complete matrix.
- Treat line count, file count, test count, and directory size as diagnostic
  evidence only. The acceptance target is a smaller, explicit change
  neighborhood with no parallel path or unexplained production growth.

## Delivery Workflow and Agent Roles

Use the multi-agent gate routine for substantial cross-lane features,
foundational model corrections, schema changes, and explicitly gated plans.
Do not add this ceremony to a small focused fix that one agent can safely
implement and review directly.

The main session is the delivery orchestrator. It owns scope, authority
selection, the locked plan, task decomposition, finding dispositions, final
bird's-eye review, Git operations, and user communication. It must retain
enough live-code context to challenge both the implementation and the review;
delegation is not a substitute for understanding the resulting diff.

For each implementation gate:

1. Start from a clean or explicitly inventoried base commit and record the
   exact gate, authorities, deliverables, exclusions, and acceptance tests.
2. Spawn a fresh executor for that gate. Give it ownership of the complete
   vertical slice, tell it that other agents may share the worktree, and
   prohibit unrelated cleanup or contract reinterpretation.
3. Let the executor use narrow owning-lane tests while implementing. Do not run
   the complete repository suite after every adjustment.
4. After the implementation is stable, spawn a fresh independent adversarial
   reviewer as a sibling of the executor under the main session. The executor
   must not review itself or own the review agent.
5. Give the reviewer the base commit, exact diff, locked plan or gate, named
   source audits and stable authorities, explicit exclusions, and validation
   results. The reviewer remains read-only and reports only actionable,
   evidence-backed findings.
6. Route accepted findings back to the executor or a narrowly owned remediation
   worker. Use one bounded verification pass after material review fixes; do
   not create an open-ended reviewer loop.
7. The main session performs the final holistic diff review: contract fidelity,
   cross-lane ownership, deletion of superseded paths, test ownership,
   production growth, and documentation disposition.
8. Commit only after that final review and only when authorized. Use one
   coherent Conventional Commit per delivery gate unless the locked plan names
   a different intentional boundary.

Use fresh executor and reviewer instances for each gate; stale agent context is
not an authority. Prefer the repository's configured specialized agent roles
or the model/effort setup explicitly requested for the task. Keep the workflow
role-based in repository guidance so later model changes do not alter the
ownership contract.

An executor or reviewer must stop and return a concrete blocker when the live
code contradicts the locked contract or a material product decision remains.
The main session decides whether to amend the plan, narrow the gate, or ask the
user. Agents must not quietly broaden the slice to satisfy an acceptance row.

## Modeling Rules

- Use game-domain language in catalog, authored state, history, and findings.
- Keep UI rows, tabs, expansion state, canvas positions, and selector text out
  of persisted domain state.
- Keep topology ownership separate from room-local leaf ownership.
- Keep unique game Room Declarations separate from repeatable authored Room
  Occurrences. Topology and feedback use persisted occurrence IDs; simulation
  resolves each occurrence through its game name.
- Preserve incomplete and context-invalid authored states when they are
  structurally representable.
- Perform destructive changes only through explicit semantic commands.
- Use complete declaration-owned defaults for active leaf values.
- Keep persisted authored state separate from replaceable simulation output.
- Address findings by stable semantic owner, never by rendered position.
- Keep external save/profile progression predicates out of production catalog
  data unless the project deliberately adds a modeled input for them.
- Prefer explicit declarations and command handlers over compact metaprogramming
  that hides game facts.

## Application State

Redux Toolkit is the application state coordinator, not the domain engine.
Reducers own authored project and UI-session state. Simulation remains a pure
operation over an authored snapshot and normalized catalog.

Undo/redo records semantic authored edits. Navigation, hover, expanded panels,
search text, and derived findings do not enter authored history.

## UI

Start with normal React composition and CSS layout. Do not introduce a graph
library until a concrete view requires it. If React Flow is later added, its
nodes and positions are projections of domain topology, never topology
authority.

Use accessible component primitives for dialogs, menus, tabs, comboboxes, and
keyboard interaction. Customize copied shadcn/ui components deliberately; do
not accumulate wrapper layers that conceal ownership.

## Testing

Once the project is scaffolded, every domain change should run the repository's
declared scripts for:

- TypeScript type checking;
- Vitest unit and fixture tests;
- linting;
- formatting or diff checks;
- production build when application wiring changes.

Use the narrowest truthful test lane during implementation:

- `npm run test:changed` for tests related to uncommitted source or fixture
  changes;
- `npm run test:ui` for leaf React/editor changes;
- `npm run test:planner` for planner projection, Redux, workspace, UI, and
  architecture-boundary changes;
- `npm run test:contract` for application/workspace capability changes;
- `npm run test:product` for cross-layer browser workflows;
- `npm run test:engine` or `npm run test:catalog` for their owning packages.

`npm run test` and `npm run check` remain the complete phase, push, and release
gates. Run the complete gate for test/configuration changes, shared package
changes with broad downstream impact, and before declaring a phase closed.

Keep tests near their authority:

- declaration normalization tests in the catalog package;
- command and codec tests in the core project model;
- lifecycle and game-rule fixtures in the simulator;
- interaction tests at the UI adapter boundary;
- end-to-end tests only for cross-layer behavior.

Test helpers may construct inputs and observe outputs, but must not reproduce
production eligibility, topology, lifecycle, reward, focus, or candidate
policy. Do not test React, Redux Toolkit, or third-party component internals.

## Documentation

Update the owning document whenever a modeling or ownership decision changes.
Keep implementation progress separate from design authority once a progress
tracker is introduced.

Unknown game behavior belongs in focused audit notes or failing/skipped
research fixtures. Do not add generic `unsupported` values to production
models merely to remember unfinished research.

### Audit and Plan Lifecycle

Use `docs/audits/` for durable evidence. A source audit records game facts,
source locations, uncertainties, discrepancies, and the final planner
disposition. It must not become an implementation checklist or prescribe React
layout, module names, commit sequencing, or temporary delivery mechanics.
When the facts are not yet settled, finish or explicitly bound the audit before
locking an implementation plan.

Use a focused document under `docs/progress/` when a change is cross-lane,
schema-affecting, lifecycle-sensitive, foundational, or large enough to need
multiple reviewable gates. Ground it in the current code before locking it. A
locked plan should state:

- objective and user-visible outcome;
- included and excluded scope;
- source facts versus chosen planner simplifications;
- exact authored, catalog, simulation, application, and UI ownership;
- delivery gates and intended commit boundaries;
- primary test owners, representative product witnesses, and audit-againsts;
- deletion/retirement expectations and explicit non-goals.

Challenge the plan adversarially before execution. Measure each gate against
the problem it solves and remove speculative scaffolding, duplicated policy,
and acceptance demands that require impossible or fabricated states. If the
underlying model changes materially during discussion, rewrite the affected
section cleanly rather than accumulating revision-scarring caveats.

Temporary implementation plans are intentionally isolated:

- do not add them to `README.md` or link them from stable design, biome, or
  audit authorities;
- do not make unrelated progress documents depend on them;
- keep their status, base commit, locked decisions, gates, and verification
  requirements self-contained;
- commit a locked audit/plan before implementation when it is the execution
  contract.

At completion of the final slice, absorb institutional knowledge into the
smallest stable owning documents under `docs/design/`, `docs/biomes/`, and
`docs/audits/`; update the durable delivery record in `docs/progress/`; remove
gate language from production comments; and delete the temporary plan in the
same closure change. Update an audit's planner disposition without erasing
source facts or documented source/model discrepancies. `README.md` should link
only durable authorities and long-lived project trackers that remain useful
after the delivery branch is gone.

Run one complete repository gate at phase closure, after narrow implementation
tests and review fixes are stable. Record the truthful result in the durable
progress history. Do not repeatedly run the full suite merely to generate
review evidence.

## Git

Use Conventional Commits. Inspect the live worktree before editing, preserve
unrelated user work, and never delete the previous game-module prototype as
part of app work unless explicitly requested.
