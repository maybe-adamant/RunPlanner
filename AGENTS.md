# Agent Instructions

This repository is the Run Planner application and its Hades II game module.
It is app-first: the catalog, authored plan, simulator, validator, and
sophisticated editor own planner meaning. The game module in `game-module/` is
a downstream consumer of a declarative plan and must not shape the UI or
simulation around ImGui or ModpackLib.

The main delivery session follows
[`docs/agents/ORCHESTRATION.md`](docs/agents/ORCHESTRATION.md); every other
agent follows its role in [`docs/agents/roles/`](docs/agents/roles/) and its
task packet.

## Read Before Editing

Use `CONTRIBUTING.md` as the documentation map when a task does not already
provide a focused navigation packet. Before changing architecture or domain
behavior, read the exact relevant authority sections under `docs/`; do not read
the whole README or broad document sets by default. Stable cross-cutting design
lives in `docs/design/`, biome rules in `docs/biomes/`, source evidence in
`docs/audits/`, temporary implementation plans in `docs/progress/`, and pending
in-game acceptance checklists in `docs/testing/`.

## Dependency Direction

```text
catalog construction -> pure core <- application composition -> React UI
```

The pure core may define the normalized interfaces it consumes, but it must
not import React, Redux, Tauri, browser APIs, filesystem APIs, or UI component
libraries. The UI may dispatch semantic commands and render derived
projections. It must not implement room eligibility, reward bags, lifecycle
counters, or topology repair.

## Ownership Lanes

The repository has four ownership lanes—two packages, one application, and one
game module. Route a change by the question it answers, not by the layer that
first needs the result.

### Hades II Catalog — `packages/hades2-catalog`

- Owns Hades II declarations, source-backed game facts, catalog construction,
  and normalization of those declarations into the engine's supported catalog
  contract.
- Answers “what does the game declare?” and “how is that declaration represented
  in the normalized catalog?”
- May depend on planner-engine's declared catalog-schema and normalized
  contracts. It must not import the planner application or own authored-project,
  simulation, validation, candidate, Redux, or UI behavior.
- Primary tests: declaration, compiler, normalization, and catalog regression
  (`npm run test:catalog`).

### Planner Engine — `packages/planner-engine`

- Before any engine work, read `docs/design/SIMULATION_AND_VALIDATION.md` in
  full: the engine ownership and extension guide, including settlement
  handoffs, exact candidate context, chronology, findings, and authoring
  readiness. Then read the specialist sections it links for the boundary being
  changed; the entry guide does not replace those authorities.
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
- Primary tests live beside the owning engine authority (`npm run test:engine`).

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
- Primary tests: focused projection, interaction, Redux, UI, contract, and
  product-loop witnesses (`npm run test:planner`, `test:ui`, `test:contract`,
  `test:product` by the boundary changed).

### Game Module — `game-module/`

- Owns runtime execution of published plans in Hades II: strict decoding of
  the execution protocol, native adapters, steering, and conformance checks.
- Answers “how does the game realize and check this published plan?”
- Consumes the execution protocol and the planner-engine execution fixtures
  under `packages/planner-engine/test/execution-plan/fixtures/`. It must not
  own planner semantics, reproduce eligibility or candidate policy, or import
  planner code.
- Primary tests: Lua syntax pass, Lua suite, and Luacheck
  (`npm run test:game-module`).
- Before changing ModpackLib-facing code (status UI, overlays, victory
  summary, config), follow
  [ModpackLib](game-module/CONTRIBUTING.md#modpacklib): its pinned submodule,
  required version, `API.md` and `CHANGELOG.md`.

When a feature crosses lanes, establish the authoritative fact or transition in
its owning lane first, expose the narrow supported product, and adapt it in the
consuming lane. Keep the complete policy matrix with its authority; consumer
and product-loop tests retain representative contact and workflow witnesses.

## Code Placement and Module Boundaries

- Place code with the semantic authority that owns its policy or product, not
  with whichever caller first needs it. Prefer the nearest existing feature
  neighborhood over a new generic `common`, `shared`, `helpers`, or `services`
  area.
- Before creating a module boundary, identify its owner, explicit inputs,
  returned product, consumers, primary tests, and the old code it displaces.
- Use `index.ts` only for a deliberate supported surface, never merely to
  shorten imports or hide dependency direction.
- Assembly or composition modules wire one level of owned products; they must
  not become semantic policy owners or ambient dependency registries.
- Cross-package imports use declared package exports. Planner imports follow
  the aliases and immediate-neighborhood relative-import rules in
  `docs/design/ARCHITECTURE.md`; aliases identify ownership roots, not public
  APIs or dependency injection.
- Test-only fixtures, harnesses, builders, and observers live under test
  support, never production `src/`. Production code must not import test
  support.

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
  narrow capabilities. No dependency-injection container, service locator,
  mutable service table, or catch-all context object.
- Use parameter objects, interfaces, and factories only for real construction
  or product boundaries, not to shorten a call or prepare for a later refactor.
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
- Give each policy and edge-case matrix one primary test owner; facade,
  integration, and product-loop suites keep representative boundary witnesses.
- Line, file, test and directory counts are diagnostic only. The target is a
  smaller, explicit change neighborhood with no parallel path or unexplained
  production growth.

## Modeling Rules

- A major schema bump (`schemaVersion`, an authored shape change with a
  transition) or any change requiring users to migrate saves needs explicit
  project-owner approval before implementation; ordinary feature/fix
  authorization is not approval to break save compatibility. A change that can
  invalidate a previously valid project or alters the plan wire needs a minor
  bump (`schemaRevision`), announced in the commit and change summary without
  approval. Follow
  [Schema change approval](docs/design/AUTHORED_PROJECT_MODEL.md#schema-change-approval).
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
operation over an authored snapshot and normalized catalog. Undo/redo records
semantic authored edits; navigation, hover, expanded panels, search text, and
derived findings do not enter authored history.

## UI

Start with normal React composition and CSS layout. Do not introduce a graph
library until a concrete view requires it. If React Flow is later added, its
nodes and positions are projections of domain topology, never topology
authority. Use accessible component primitives for dialogs, menus, tabs,
comboboxes, and keyboard interaction. Customize copied shadcn/ui components
deliberately; do not accumulate wrapper layers that conceal ownership.

## Testing

Use the narrowest truthful test lane during implementation. Executors own the
affected lane and explicitly assigned acceptance tests; the main session owns
broad phase-closure verification. [Testing](docs/TESTING.md) owns the shared
execution policy and the measurement lanes' mechanics.

- `npm run test:changed`: tests related to uncommitted source or fixture changes.
- `npm run test:ui`: leaf React/editor changes.
- `npm run test:planner`: planner projection, Redux, workspace, UI, and
  architecture-boundary changes.
- `npm run test:contract`: application/workspace capability changes.
- `npm run test:product`: cross-layer browser workflows.
- `npm run test:engine` / `npm run test:catalog`: their owning packages.
- `npm run test:game-module`: the game module's Lua syntax, tests, and Luacheck.
- `npm run test:equivalence`: before and after engine refactors and any
  chronology or settlement change.
- `npm run test:draft-corpus`: before and after a Draft change.
- `npm run test:performance:snapshot` / `test:performance:compare`: changes to
  rebuild, candidate, edit or Undo latency.

`npm run check` is the core-correctness gate for phase closure, push, and
release; `npm run test` is its correctness test lane. Run the complete gate for
test/configuration changes, shared package changes with broad downstream
impact, and before declaring a phase closed—once, after narrow tests and review
fixes are stable, recording the truthful result in the durable progress
history; never repeatedly just to generate review evidence. The equivalence,
draft corpus and performance lanes are opt-in witnesses outside the gate. Do
not add local test timeout or retry overrides.

Keep tests near their authority, in each package/application's `test/` tree
rather than production `src/`, mirroring the owning source neighborhood;
architecture, product-loop, fixture and shared support neighborhoods stay
separate under `test/`. Declaration normalization tests belong in the catalog
package, command and codec tests in the core project model, lifecycle and
game-rule fixtures in the simulator, interaction tests at the UI adapter
boundary, and end-to-end tests only for cross-layer behavior.

Test helpers may construct inputs and observe outputs, but must not reproduce
production eligibility, topology, lifecycle, reward, focus, or candidate
policy. Do not test React, Redux Toolkit, or third-party component internals.

Checked-in execution fixtures are generated protocol products; follow the
[execution fixture discipline](packages/planner-engine/test/execution-plan/fixtures/README.md)
when changing one.

## Documentation

Durable documentation describes the current model, contracts, and source
evidence; it is not a bug-fix changelog. The
[documentation lifecycle](CONTRIBUTING.md#documentation-lifecycle) owns
investigations, plans, audits and testing checklists in detail.

- Update the owning document when a model, ownership, contract, or supported
  integration boundary changes, or when its existing explanation is inaccurate.
  Revise the existing explanation or table row rather than appending a
  narrative for each fix.
- Each fact has one primary owner: integrate newly established game facts into
  the existing source audit or matrix, and do not duplicate the same lesson
  across design documents, audits, and hook maps.
- A fix that restores an already-documented contract normally needs only code,
  regression coverage, and a commit message—not another documentation paragraph.
- Design documents state meaning, not code: no TypeScript or file/function
  mirrors, UI copy, or tuning values the code owns. Mechanics a design needs
  go in a short companion document or appendix linked from the owner.
- Implementation history and verification results belong in commits or the
  applicable progress tracker, not durable design authority.
- Unknown game behavior belongs in focused audit notes or failing/skipped
  research fixtures, never in generic `unsupported` values in production
  models.
- Temporary plans (`docs/progress/`) and investigations
  (`docs/investigations/`) are deleted at delivery closure by default, after
  their durable result is promoted; stable documents never link them.
- `docs/testing/` holds only pending in-game acceptance checks.

Code comments state the domain fact or invariant the code cannot show, briefly
(one or two lines), and never reference plans, gates or process.

## Git

Use Conventional Commits: subject-only by default, with a short body only when
the why isn't obvious; a schema revision bump is always announced there.
Inspect the live worktree before editing and preserve
unrelated user work.
