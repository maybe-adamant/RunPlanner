# Test Fixture and Suite Optimization

## Status

Locked focused delivery plan on base `4c4f063`, independently reviewed READY on
2026-08-20. This plan is not linked from `README.md`. The work is test
infrastructure and test ownership only; production behavior, authored schema,
catalog declarations, simulation policy, application products, and user-facing
behavior are outside scope.

## Objective

Restore a fast, stable development loop without weakening semantic coverage.
The delivery must:

1. replace repeatedly command-built canonical route prefixes with strict,
   checked-in schema-48 `ProjectDocument` checkpoints;
2. retain command execution in tests whose subject is a command, history,
   malformed transition, progressive construction, or undo/redo behavior;
3. remove only cross-layer tests whose complete setup, mutation, failure
   condition, and assertions are already owned by named primary and contact
   witnesses; and
4. tune Vitest lane membership and worker counts only after fixture and test
   ownership costs are measured independently.

The goal is not a deletion quota or a larger timeout. It is less repeated setup,
clearer test ownership, and a default `npm run check` that can complete reliably
on the current 32-logical-CPU WSL host.

## Measured Baseline

The current suite has 157 test files and about 88,659 test lines. The most
recent expanded inventory contains 1,965 tests:

| Lane    | Files | Expanded tests | Workers | Default timeout |
| ------- | ----: | -------------: | ------: | --------------: |
| Regular |   129 |          1,560 |       4 |             5 s |
| Heavy   |    28 |            405 |       2 |             5 s |

The shared canonical authored-project builders are imported by 86 test files,
including every heavy file. Forty consumers use both route families. The most
common full builders are used in 39 Underworld files and 41 Surface files.
Vitest isolates test files, so the builders' module caches do not cross a file
boundary.

The canonical fixture characterization on 2026-08-20 took 16.60 seconds with
15.25 seconds inside test bodies. That owner contains 12 characterized document
identities plus the fixed-N alias assertion. The table summarizes the seven
prefix checkpoints; its timing target does not narrow the full identity matrix:

| Scenario            | Observed body time |
| ------------------- | -----------------: |
| default F/G         |            1.415 s |
| F/G/H               |            3.098 s |
| incremental F/G/H/I |            0.650 s |
| N                   |            0.148 s |
| N/O                 |            0.374 s |
| incremental N/O/P   |            1.696 s |
| incremental N/O/P/Q |            4.251 s |

The builders are not simple object constructors. `authorLegalTraitOffers` may
run dozens of project simulations, while `authorRequiredTestRoomActions`
materializes every configured biome and repeatedly assembles Room Action
rosters. The command chains contain more than 80 textual
`applyProjectCommand` call sites plus declaration-sized loops.

One cold default-config baseline was recorded with JSON reporting before any
optimization:

| Lane    | Wall time | User CPU | Peak RSS | Result                                          |
| ------- | --------: | -------: | -------: | ----------------------------------------------- |
| Regular |  154.18 s | 747.97 s |  3.89 GB | 1 hook and 5 test timeouts; no assertion defect |
| Heavy   |  258.91 s | 609.88 s |  3.27 GB | 8 test timeouts; no assertion defect            |

The sequential wall baseline is 413.09 seconds. These measurements are
diagnostic evidence, not test assertions. Later gates must use the same commands
and host conditions where practical and must report medians rather than choose
one favorable run.

## Existing Ownership That Must Be Preserved

The A14-A16 correction already removed an earlier umbrella-test duplication and
assigned deliberate owners. This optimization must not undo that work.

Protected coverage includes:

- catalog declaration and normalization matrices;
- planner-engine codec, command, lifecycle, simulation, candidate, reward, and
  finding matrices;
- focused structured-workspace assembly and interaction-binding tests;
- the independent structured-workspace topology, leaf, structural-control,
  malformed-overlay, and mutation closure contracts;
- architecture import, purity, and dependency-direction tests;
- test-support self-tests that prove expected-side independence; and
- direct React component behavior matrices, including accessibility, focus,
  keyboard, repair, and retained-invalid state.

A broad deletion based only on similar wording or raw count is forbidden.

## Locked Modeling and Infrastructure Decisions

### 1. Checkpoints persist authored input only

A checkpoint is the exact encoded schema-48 `ProjectDocument` accepted by the
production decoder. It may not contain or cache:

- simulation or materialization output;
- candidate sessions or artifacts;
- findings or validation output;
- structured-workspace projections;
- Redux state or history wrappers; or
- rendered React state.

Every consumer still runs the production authority it is testing. Checkpoints
remove only irrelevant setup commands.

### 2. The initial checkpoint set is prefix-sized

Gate A creates these seven canonical checkpoints:

```text
underworld-fg
underworld-fgh
underworld-fghi
surface-n
surface-no
surface-nop
surface-nopq
```

Prefix-sized documents are intentional. A focused F/G or N test must not pay to
simulate later configured biomes merely to avoid another fixture file.

Uncommon alternate G miniboss/Preboss and N open-set/visit variants remain
small semantic edits from their nearest checkpoint, or retain a focused builder
when the variant construction itself is under test. Gate A does not add an
N/O/P/Q Shop-trait, F Midshop, digest-only combined, or per-test checkpoint. If
a named consumer remains fixture-bound after the seven core checkpoints, the
executor reports it for an explicit plan amendment or later focused slice
instead of expanding this gate.

The fast replacement for the A14 characterization must retain all 12 current
document identities:

- the seven prefix checkpoints;
- alternate F/G miniboss, alternate F/G Preboss source, and their combined
  variant derived from `underworld-fg`;
- partial N Hub handoff and alternate N open-set/visit order derived from
  `surface-n`; and
- the existing fixed-N occurrence alias equality assertion.

Gate A compares every checkpoint and every replacement variant helper against
the exact canonical encoding produced by its legacy command builder. The 75%
speed target measures this same 12-scenario matrix and alias assertion, not only
the seven stored files.

### 3. Checkpoints are named, strict, immutable, and manifest-backed

Test-only files live under:

```text
test/fixtures/authored-project/checkpoints/
```

Each checkpoint has a readable `.runplanner.json` filename. One typed test-only
manifest records:

- stable checkpoint ID and file;
- route and configured prefix;
- scenario description;
- authored schema and catalog version;
- SHA-256 of the exact canonical `encodeProjectDocument` byte string; and
- command-builder provenance used by the refresh tool.

Route-scoped loader modules statically import the JSON, call the production
`decodeProjectDocument(raw, catalog)`, and lazily cache the resulting frozen
document once per isolated test module. They never expose mutable raw JSON. A
semantic command may safely derive a new document from the immutable checkpoint
without cloning the base.

Static imports are required so Vitest's changed-file graph sees checkpoint
changes. Gate A may enable TypeScript `resolveJsonModule` deliberately; a
dynamic filesystem path or ambient runtime lookup is not an acceptable hidden
dependency.

Gate A adds explicit root and subpath mappings for the fixture authority in the
base and planner TypeScript configurations and in Vitest resolution. The root
mapping may not rewrite a subpath through `index.ts`. ESLint's production-source
restriction must match `@run-planner/test-fixtures` and every subpath, using the
equivalent of `^@run-planner/test-fixtures(?:/|$)`.

A dedicated test-fixture TypeScript configuration includes the route loaders,
manifest, imported JSON, focused mutations, and generation-only source. The
repository typecheck invokes it even though the generation source leaves the
normal test import graph. Production sources remain unable to import any part
of the fixture authority.

### 4. Fixture imports become route-scoped

The current root `@run-planner/test-fixtures` star barrel loads Underworld,
Surface, trait-offer, and Room Action support into consumers that need only one
family. Gate A introduces deliberate route-scoped test-only imports and updates
all consumers in the same slice. It removes the superseded root star barrel or
reduces it to no executable route dependency; it does not leave forwarding
aliases merely for compatibility.

Checkpoint loader names must state that they load a canonical checkpoint.
Command-based variant helpers remain separately named semantic mutations rather
than pretending to be checkpoint data.

### 5. Command builders become explicit refresh tooling

The legacy full-route command chains leave the normal test import graph. They
move to test-only generation support consumed only by an explicit deterministic
checkpoint command.

The command has two modes:

- default check mode rebuilds each canonical checkpoint once and exact-compares
  canonical encoding and manifest digest;
- an explicit `--write` mode refreshes the JSON and manifest intentionally.

`encodeProjectDocument` is the only writer. Normal `npm run test`, regular, and
heavy lanes do not rebuild checkpoints. The explicit check runs when the
authored schema, catalog version, canonical fixture meaning, or generation
support changes, and once during Gate A acceptance.

The root package exposes this default mode as `npm run test:fixtures:check`.
Gate A adds that command to the final root `npm run check` sequence, outside the
regular and heavy Vitest lanes. This makes command-builder-to-checkpoint drift a
mechanical repository-gate failure: editing JSON and its manifest together is
insufficient unless the in-memory regenerated canonical bytes and digest also
match. Only the explicit write mode may mutate checkpoint files.

The ordinary fast checkpoint integrity test decodes every file, verifies
manifest metadata and canonical digest, re-encodes canonically, attests frozen
identity/cache reuse, and rejects schema/catalog mismatch. It replaces the
current command-heavy digest characterization.

### 6. Command coverage remains command-driven

Checkpoint adoption must not bypass the behavior under test. These remain
command-built or apply focused commands to a decoded checkpoint:

- command validation and exact semantic addressing;
- project-history undo, redo, and no-op identity;
- codec malformed-input and strict-schema rejection;
- progressive construction and retained-invalid repair;
- command atomicity and destructive topology cleanup; and
- any test whose assertion is specifically about the sequence that creates the
  state.

No evaluated workspace or simulator result is checked in to make these tests
faster.

### 7. Coverage consolidation requires a retained-owner ledger

Gate B classifies tests at file level and subdivides only files containing
several independent scenario families. Each row records:

```text
file and test name
lane
semantic authority
scenario family
checkpoint used
unique setup and mutation
unique failure condition
unique assertions
disposition: primary | contact | workflow | infrastructure | overlap
retained primary owner
retained boundary/workflow witness
measured runtime
```

A test may be deleted only when all of the following are true:

1. its complete rule matrix remains at the semantic owner;
2. the affected projection/binding/UI boundary retains a representative contact;
3. its setup, mutation, failure condition, and assertions contain no unique
   semantic, persistence, focus, accessibility, or repair behavior;
4. any unique assertion is transferred to its correct owner before deletion;
5. focused owner and contact lanes pass before and after the removal; and
6. the deletion ledger names both retained witnesses.

There is no target percentage or test-count quota.

### 8. Seven product repetitions are pre-authorized for exact review

Gate B begins with these high-confidence overlap candidates. Each must still be
checked against its live assertions before removal; a mismatch stops that row,
not the whole gate.

| Product-loop candidate                                                                                       | Required retained ownership                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface `authors a reached World Shop through Purchased, Actions ordering, and undoable removal`             | Engine Room Action commands and Shop settlement; occurrence assembly; interaction binding; OccurrenceWorkbench Purchased/reorder/undo workflow |
| Surface `withholds and restores a P Combat suffix through its terminating Heracles Intro picker`             | Engine field-NPC suffix matrix and OccurrenceWorkbench valid/invalid controls                                                                  |
| Surface `records an N Hub order move as one undoable semantic command and autosaves both states`             | Engine Hub topology plus HubDecisionWorkbench reorder; retain the ninth-member cascading product workflow                                      |
| Surface `closes an unvisited Hub member as one undoable autosaved command`                                   | Engine Hub closure plus the retained ninth-member cascading close/handoff/autosave workflow                                                    |
| Underworld `replaces an existing room on its door card while the entered workbench stays identity-read-only` | Engine topology re-anchor; DecisionWorkbench focus/undo; OccurrenceWorkbench read-only ownership                                               |
| Underworld `authors a terminal Preboss atomically and undoes to provisional doors`                           | Interaction binding terminal intent; DecisionWorkbench terminal flow; BiomeWorkspace outgoing/undo handoff                                     |
| Underworld `uses one projected semantic repair command for retained ordinary and takeover exits`             | Decision assembly repair; interaction binding repair; DecisionWorkbench repair UI                                                              |

The Surface route-finding, session-only rail focus, Underworld downstream
authorability, and pointer/keyboard omnibus workflows require a fresh assertion
read. They are not pre-authorized for deletion. Infrastructure/closure suites
listed above remain protected.

One stale test name may be corrected without deleting coverage: the App
interaction titled `edits ordinary, Hermes, room Hammer, and acquired Shop
Hammer offers through shared controls` no longer exercises Hermes; the adjacent
test owns that path.

### 9. Lane tuning is measurement-driven and last

Gate C reruns unchanged lane membership after Gate A and Gate B. Only then may
it move files or change worker caps.

The worker sweep compares regular 4/8/12/16 and heavy 2/4 workers, with lanes
still run sequentially. Each viable setting receives at least three cold runs
at unchanged default test and hook timeouts. The selected setting is the
highest-throughput configuration that completes all repetitions without
contention timeouts, assertion failures, runaway memory, or teardown hangs.

The plan does not disable test isolation, merge the regular and heavy processes,
raise timeouts, add retries, or count post-timeout diagnostic headroom as a
pass. A file leaves the heavy lane only when its post-checkpoint cold runtime
and stability justify the move.

## Gate Execution and Review

Each gate uses the repository's complete delivery routine independently:

1. the orchestrator records the clean base, exact gate scope, exclusions, and
   acceptance boundary;
2. a fresh executor owns the bounded implementation and freezes its diff;
3. a fresh sibling reviewer remains read-only and performs an adversarial review
   against this plan, the owning authorities, and the executor evidence;
4. accepted findings return for one bounded remediation and verification pass;
5. the orchestrator performs the final holistic scope, ownership, deletion,
   growth, and validation review; and
6. only then is that gate committed with its named commit boundary.

An executor or reviewer must stop on a production-behavior change, coverage
loss, fixture-meaning discrepancy, or new test-infrastructure decision rather
than broadening the gate silently.

## Ownership by Lane

### Test support

`test/fixtures/authored-project/` owns checkpoint JSON, manifest, route-scoped
loaders, focused variant mutations, and explicit generation tooling. It does
not own production semantics or expected simulation output.

### Planner engine

The production decoder and encoder remain the only schema/canonicalization
authorities. Engine tests retain command, codec, lifecycle, simulation,
candidate, validation, and finding matrices.

### Planner application and React

Application tests consume immutable authored checkpoints and continue running
real application assembly, Redux, binding, and React behavior. They do not load
serialized projections or replace production collaborators with checkpoint
answers.

### Test configuration

Root Vitest configuration owns only file classification, thread-pool choice,
and worker caps. It may consume measured file-runtime evidence but no domain
policy.

## Delivery Gates and Commit Boundaries

### Gate A — Canonical authored checkpoints

Deliver one behavior-preserving fixture vertical slice:

- add the seven strict JSON checkpoints and typed manifest;
- add route-scoped lazy loaders and focused variant helpers;
- add deterministic check/write generation tooling;
- migrate normal consumers away from full command builders and the root star
  barrel;
- replace the command-heavy fixture digest suite with fast checkpoint integrity;
- remove normal-path full-route caches/builders and superseded imports; and
- keep all existing tests and Vitest lane configuration otherwise unchanged.

Primary acceptance:

- `npm run test:fixtures:check` proves every checkpoint and all five derived
  variant identities are byte/canonically equivalent to their pre-Gate-A
  builder output and preserves the fixed-N alias assertion;
- decoder, manifest, frozen identity, and command-derived-copy tests pass;
- the dedicated fixture TypeScript project and widened ESLint boundary cover
  all root/subpath loaders plus generation-only source;
- no normal test imports full-route generation support;
- no serialized derived product exists;
- the median of three cold checkpoint-characterization runs reduces the
  same 12-scenario/alias 15.25-second body baseline by at least 75 percent;
- a temporary whitespace-only checkpoint edit followed by `test:changed`
  collects the named checkpoint integrity/contact test through the static loader
  graph, after which the exact edit is reverted and the worktree rechecked;
- regular and heavy lanes run with their existing membership/workers/default
  timeouts, produce no assertion regression, introduce no new failing test
  identity, and do not increase the baseline timeout or hook-timeout count; every
  remaining baseline timeout passes in focused isolation; and
- typecheck, lint, formatting, diff check, and build pass.

Commit: `perf(test): load canonical authored checkpoints`.

### Gate B — Evidence-backed test consolidation

Build and freeze the retained-owner ledger, then remove only accepted overlap.
Start with the seven named product candidates. Keep the route smoke workflows
and at least one complex Hub handoff/autosave product contact.

Primary acceptance:

- every deletion names its retained primary and boundary witnesses;
- no protected matrix or infrastructure closure suite is removed;
- no production, fixture meaning, timeout, retry, or worker configuration
  changes enter this gate;
- focused before/after owner and contact lanes remain green;
- product loops still cover both routes, persistence, semantic navigation, and
  one nontrivial repair/undo workflow; and
- test/file/line reduction is reported as diagnostic evidence, not a quota.

Commit: `test: consolidate superseded workflow coverage`.

### Gate C — Lane tuning and durable closure

Measure the post-A/B suite, perform the worker sweep, update heavy membership
only with measured justification, and select the stable configuration. Absorb
the lasting checkpoint and test-ownership rules into the smallest existing
testing/architecture authority and implementation progress, then delete this
temporary plan.

Primary acceptance:

- unchanged default test/hook timeouts and isolation;
- median cold timings and peak RSS reported for baseline and selected config;
- one final `npm run check` passes at the selected declared configuration;
- that root gate includes `test:fixtures:check` outside the regular/heavy lanes;
- `test:changed` and named package/application lanes remain truthful;
- no stale heavy-file paths or duplicate lane membership;
- no normal consumer imports the generation tool or root fixture barrel;
- no temporary benchmark output is committed; and
- independent adversarial review plus final holistic diff review are READY.

Commit: `chore(test): tune fixture-aware test lanes`.

## Validation Policy

Use narrow owner/contact tests while implementing. Do not repeatedly run the
complete repository gate.

- Gate A: fixture integrity/generation check, affected engine/planner/UI/product
  consumers, unchanged regular/heavy baseline comparison, and static/build
  checks.
- Gate B: exact retained owners and affected product loops, then proportional
  engine/planner/product lanes.
- Gate C: worker sweep, one final complete `npm run check`, static/build checks,
  and durable documentation/deletion scans.

Runtime diagnostics may use JSON reporters and temporary files outside the
repository. They may not weaken acceptance or become committed snapshots.

## Explicit Non-Goals

- changing production behavior or authored schema;
- serializing evaluated engine/application/UI output;
- deleting tests merely because they are slow, large, or similarly named;
- changing semantic assertions to make checkpoints easier to maintain;
- increasing test or hook timeouts, adding retries, or disabling isolation;
- making a mutable global fixture shared across worker threads;
- one opaque full-route checkpoint for every test;
- splitting files solely to evade the heavy lane;
- a production fixture manifest, service registry, or cache;
- solving unrelated performance hot paths inside simulation or React; or
- treating one favorable timing run as stable evidence.

## Plan Lock Checklist

The adversarial plan review must confirm:

1. JSON checkpoints cannot bypass any product under test.
2. Strict decoding and canonical generation prevent stale schema/catalog data.
3. Route-scoped imports remove the current cross-family barrel cost without a
   compatibility layer.
4. Variant scenarios remain expressive without proliferating snapshots.
5. The seven deletion candidates have named retained owners and no unique
   workflow assertion.
6. A14-A16 independent closure and component ownership remain protected.
7. Worker tuning cannot hide a timeout or precede the structural speedup.
8. The final gate measures wall time, CPU, memory, stability, and correctness.
9. The three commits isolate fixture optimization, coverage consolidation, and
   configuration tuning.
10. The full 12-scenario A14 identity matrix and fixed-N alias survive the
    checkpoint conversion.
11. Generator drift, fixture subpath typing/import restrictions, and
    `test:changed` contact are mechanically enforced.
12. Gate A introduces neither a new failing test identity nor additional
    timeout failures at unchanged lane settings.

## Gate B Execution Record Appendix — 2026-08-20

This appendix records the live assertion review and disposition on Gate B base
`e5faf3e`. It is an execution record for Gate C absorption; it does not amend
the locked rules above. The focused owner/contact baseline was 9 files and 221
tests. Six product-loop rows were removed; the N Hub order row was retained
because its redo and autosave-at-every-state assertions had no retained owner.

1. `apps/planner/test/product-loops/GoldenSurfaceProductLoop.interaction.test.tsx` — `authors a reached World Shop through Purchased, Actions ordering, and undoable removal`; planner application/product lane; Shop occurrence actions and semantic history; `createRepresentativeNOPQProject`; setup marked two P offers, reordered them, removed one, then undo/redo; failure condition was missing Purchased/order/undo projection; assertions were offer membership, order, history, and state persistence within Redux. Disposition: overlap, removed. Retained primary: `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx`, `marks Shop purchases in Overview, reorders them in Actions, and restores membership through undo`, plus the adjacent ranked-pointer and retained-Shop-repair tests. Retained contact: `packages/planner-engine/test/simulation/shop-trait-purchase.test.ts` Shop participation/order matrix. The complete setup, mutation, failure, and assertions were duplicated by those owners. Runtime: 2.067 s in the clean-base JSON product run.

2. `apps/planner/test/product-loops/GoldenSurfaceProductLoop.interaction.test.tsx` — `withholds and restores a P Combat suffix through its terminating Heracles Intro picker`; planner application/product lane; P field-NPC encounter suffix; `createRepresentativeNOPQProject`; selected Heracles in Intro, observed Combat withdrawal, then restored Pre-combat; failure condition was an invalid terminating Intro leaving Combat available or a valid Intro failing to withhold it; assertions covered interaction removal/restoration, selected encounter values, and focus. Disposition: overlap, removed. Retained primary: `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx`, `withholds and restores the P Combat suffix after a terminating Heracles Intro selection`, including the same valid transition, retained Combat, interaction/focus removal, and restoration assertions. Retained contact: `packages/planner-engine/test/simulation/field-npc-encounters.test.ts`, `trims P Combat only for valid Heracles, retains its selection dormant, and restores it exactly`. Runtime: 1.985 s in the clean-base JSON product run.

3. `apps/planner/test/product-loops/GoldenSurfaceProductLoop.interaction.test.tsx` — `records an N Hub order move as one undoable semantic command and autosaves both states`; planner application/product lane; Hub visit-order persistence; `appendCompleteN(createProjectDocument(...))`; moved Combat 09 earlier, then undo and redo; failure condition was a non-atomic order edit, stale handoff, or missing recovery write; assertions covered visit order, one history entry, handoff presence, and autosave after original/edited/undone/redone states. Disposition: workflow, retained for unique persistence and redo assertions. Retained primary: `packages/planner-engine/test/authored-project/commands/topology.test.ts`, `reorders a complete Hub visit prefix without rewriting its completed handoff`. Retained boundary witness: `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.test.tsx`, `moves a room across the cutoff with one full order and preserves focus`; the complex ninth-member close/handoff/autosave product remains as an additional persistence contact. Runtime: 0.594 s in the clean-base JSON product run.

4. `apps/planner/test/product-loops/GoldenSurfaceProductLoop.interaction.test.tsx` — `closes an unvisited Hub member as one undoable autosaved command`; planner application/product lane; Hub slot closure and downstream handoff removal; `appendCompleteN(createProjectDocument(...))`; opened Combat 04, then closed it with keyboard Space; failure condition was closure not removing the occurrence/handoff or not being one semantic command; assertions covered retained occurrence, replacement handoff, dispatched `CloseHubSlot`, history, and autosave. Disposition: overlap, removed. Retained primary: `packages/planner-engine/test/authored-project/commands/topology.test.ts`, `removes the completed-Hub Preboss handoff when an unvisited ninth slot closes`. Retained boundary/workflow witness: the retained Surface `closes a ninth unvisited Hub member and its completed handoff as one undoable autosaved command` product test, which covers the same close command, keyboard interaction, downstream occurrence/handoff removal, undo, and autosave with the more demanding completed-handoff state; `HubDecisionWorkbench.test.tsx` also retains compact open/close interaction coverage. Runtime: 0.420 s in the clean-base JSON product run.

5. `apps/planner/test/product-loops/GoldenUnderworldProductLoop.interaction.test.tsx` — `replaces an existing room on its door card while the entered workbench stays identity-read-only`; planner application/product lane; ordinary target room ownership; `createGoldenFGHIProject`; replaced F Door 1 target, opened the replacement workbench, then undid; failure condition was target replacement changing the wrong occurrence or the entered workbench exposing an identity editor; assertions covered replacement identity, target focus, read-only workbench, and undo. Disposition: overlap, removed. Retained primary: `apps/planner/src/ui/editor/biome/DecisionWorkbench.test.tsx`, `replaces an existing ordinary target from its door card with exact focus and undo`. Retained boundary witness: `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx`, `presents an incoming ordinary room identity read-only under its target-owned door control`; the direct component test owns the read-only assertion. Runtime: 0.935 s in the clean-base JSON product run.

6. `apps/planner/test/product-loops/GoldenUnderworldProductLoop.interaction.test.tsx` — `authors a terminal Preboss atomically and undoes to provisional doors`; planner application/product lane; terminal F takeover creation; `createGoldenFGHIProject` with the terminal decision removed/recreated; failure condition was a non-atomic terminal choice, wrong forced Preboss targets, or undo not restoring provisional doors; assertions covered `CreateTakeoverBatch`, target identities, one history entry, door visibility, and undo. Disposition: overlap, removed. Retained primary: `apps/planner/src/ui/editor/biome/DecisionWorkbench.test.tsx`, `authors terminal Preboss through the empty decision Door 1 picker`, and `apps/planner/src/projections/structured-workspace/interactions/interaction-binding.test.ts`, terminal Door 1 binding to one atomic create command. Retained boundary/workflow witness: `apps/planner/src/ui/editor/biome/BiomeWorkspace.test.tsx`, `authors the first outgoing edit atomically and undo restores provisional doors`. Runtime: 0.466 s in the clean-base JSON product run.

7. `apps/planner/test/product-loops/GoldenUnderworldProductLoop.interaction.test.tsx` — `uses one projected semantic repair command for retained ordinary and takeover exits`; planner application/product lane; ordinary and takeover exit-capacity repairs; `createGoldenFGHIProject` with focused ordinary and G mutations; failure condition was a repair surface dispatching the wrong command, wrong target count, or more than one history edit; assertions covered ordinary/takeover repair controls, command payloads, history, and repaired topology. Disposition: overlap, removed. Retained primary: `apps/planner/src/ui/editor/biome/DecisionWorkbench.test.tsx`, `reconciles retained, expanded, ordinary, and blocked-suffix repair controls`. Retained boundary witness: `apps/planner/src/projections/structured-workspace/interactions/interaction-binding.test.ts`, takeover repair command construction and focus policy; engine topology and candidate tests retain command semantics. Runtime: 0.786 s in the clean-base JSON product run.

The stale App interaction title was corrected in place: `edits ordinary, Hermes,
room Hammer, and acquired Shop Hammer offers through shared controls` now names
only the ordinary, room Hammer, and acquired Shop Hammer paths it actually
exercises; the adjacent test remains the Hermes contact.
