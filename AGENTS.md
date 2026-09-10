# Agent Instructions

This repository is the standalone Run Planner application. It is app-first:
the catalog, authored plan, simulator, validator, and sophisticated editor live
here. The Hades II game module is an external downstream consumer of a
declarative plan and must not shape the current UI or simulation around ImGui
or ModpackLib.

## Read Before Editing

Use `README.md` as the documentation map when a task does not already provide a
focused navigation packet. Before changing architecture or domain behavior,
read the exact relevant authority sections under `docs/`; do not read the whole
README or broad document sets by default. Stable cross-cutting design lives in
`docs/design/`, biome rules live in `docs/biomes/`, source evidence lives in
`docs/audits/`, and temporary implementation plans live in `docs/progress/`.

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
  validation, findings, engine-owned authoring queries, and execution-plan
  assembly and codecs.
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

## Main-Session Orchestration Only

This section applies to the main delivery orchestrator. Subagents follow the
shared repository rules, their custom-agent instructions, and their focused
task packet; they must not adopt the orchestration role themselves.

Use the multi-agent gate routine for substantial cross-lane features,
foundational model corrections, schema changes, and explicitly gated plans—not
for a small focused fix that one agent can safely implement and review.

The main session owns scope, authority selection, locked plans, task packets,
finding dispositions, final review, Git operations, and user communication. For
each delegated gate it must:

- inventory the base and worktree, then provide a self-contained packet naming
  the exact gate, ownership, deliverables, exclusions, acceptance tests,
  expected deletions, starting files or symbols, and governing document sections;
- omit full parent history by default and permit only one write-capable agent in
  the shared worktree, while allowing distinct bounded read-only investigations;
- reuse an executor for remediation or adjacent coherent work, but replace it
  when ownership, design, or context changes materially;
- use a fresh independent reviewer after implementation stabilizes and perform
  one bounded remediation pass rather than an open-ended review loop; and
- own broad phase-closure checks and the final bird's-eye review of contract
  fidelity, ownership, superseded paths, tests, growth, and documentation.

The main session decides whether a reported contract conflict requires a plan
amendment, narrower scope, or user input. Delegation does not replace its own
understanding of the live diff.

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

Use the narrowest truthful test lane during implementation. Executors own the
affected lane and explicitly assigned acceptance tests; the main session owns
broad phase-closure verification:

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

### Shared test execution policy

All package and application Vitest files run through the single
`npm run test:correctness` lane; the performance witness is its only excluded
file. The repository uses the calibrated eight-worker setting, 120-second
test and hook watchdogs, a 30-second teardown watchdog, and zero retries.
These values detect probable hangs; they are not correctness performance
budgets. Fixture integrity intentionally remains a one-worker command, and
all correctness tests use the shared watchdogs. Do not add local timeout or
retry overrides. Testing Library asynchronous queries use the shared
ten-second functional wait. The progress reporter's heartbeat and slowest-file
output are diagnostic and never determine pass/fail.

Performance is measured separately with
`npm run test:performance:snapshot` and judged by
`npm run test:performance:compare`; `npm run test:performance:absolute` is
reserved for an explicitly canonical environment. The snapshot covers the
eight Underworld/Surface rebuild, cold-candidate, edit, and cached-Undo
operations. Full rebuild uses one warmed application and project for one
warmup plus three measured calls; each cold-candidate, edit, and cached-Undo
sample uses a fresh prepared application and state, with medians reported. The
generic comparison runs base and candidate sequentially on the same host,
resolves dirty worktrees to `HEAD` and clean worktrees to `HEAD^` unless the
`RUN_PLANNER_PERFORMANCE_BASE_REF` environment variable or `--base-ref`
overrides the base, and rejects an identical clean base. It
requires both a strict percentage increase and an inclusive absolute increase:
20%/100 ms for non-Undo metrics and 50%/10 ms for cached Undo. The canonical
1,000 ms interaction and 50 ms cached-Undo targets are report-only in generic
comparisons.

Keep tests near their authority:

- declaration normalization tests in the catalog package;
- command and codec tests in the core project model;
- lifecycle and game-rule fixtures in the simulator;
- interaction tests at the UI adapter boundary;
- end-to-end tests only for cross-layer behavior.

Test helpers may construct inputs and observe outputs, but must not reproduce
production eligibility, topology, lifecycle, reward, focus, or candidate
policy. Do not test React, Redux Toolkit, or third-party component internals.

### Generated fixture discipline

Treat checked-in JSON execution fixtures as generated protocol products, not as
scratch serialization output.

- Generate their semantic content through the owning planner fixture/product
  builder. Do not hand-author wire fields that production cannot emit.
- Preserve each existing fixture's checked-in serialization exactly. Do not run
  a broad JSON or Prettier rewrite over execution fixtures. New fixtures use the
  direct compact `encodeExecutionPlan` output plus one trailing newline; legacy
  pretty-printed fixtures remain in their established form until retired.
- Regenerate only fixtures whose semantic product changed. For a protocol-wide
  scalar such as the version number, use a bounded mechanical edit rather than
  rebuilding otherwise unchanged products.
- The planner copy is authoritative. Mirror changed execution fixtures to the
  Plan Executor byte-for-byte, then verify every mirrored pair with `cmp` (or an
  equivalent byte comparison).
- Before handoff, inspect fixture `git diff --numstat` and a representative diff.
  Unexpected whole-file churn or formatting-only changes are a failed fixture
  update and must be corrected before review.

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
`docs/audits/`; remove gate language from production comments; and delete the
temporary plan in the same closure change. Update an audit's planner
disposition without erasing source facts or documented source/model
discrepancies. `README.md` should link only durable authorities and long-lived
project trackers that remain useful after the delivery branch is gone.

Run one complete repository gate at phase closure, after narrow implementation
tests and review fixes are stable. Record the truthful result in the durable
progress history. Do not repeatedly run the full suite merely to generate
review evidence.

## Git

Use Conventional Commits. Inspect the live worktree before editing and preserve
unrelated user work.
