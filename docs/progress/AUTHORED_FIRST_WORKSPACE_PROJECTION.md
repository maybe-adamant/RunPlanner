# Authored-First Workspace Projection Correction

## Status

This is the implementation and audit record for a focused application
projection correction after `0a47a36`. It is implemented in the current
worktree and awaiting its independent commit.

Stable authority remains with:

- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md) for
  persisted topology, occurrences, semantic addresses, and commands;
- [`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md) for batch,
  target, reward, and selection semantics;
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md) for offer-time
  versus entry-time products;
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md) and
  [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md)
  for editor ownership, finding focus, and presentation.

This document records the bounded implementation sequence, final file scope,
audit matrix, acceptance criteria, and verification evidence for the
correction. It does not replace those design authorities or advance the active
workspace-presentation phase.

## Goal

Make the structured workspace a total authored-structure projection enriched
by optional evaluation, rather than a projection of the successfully
materialized simulation prefix repaired with authored fallbacks.

The player-facing and semantic hierarchy is:

```text
Biome
  -> Decision
      -> batch-level configuration and picked target
      -> physical target offers
          -> Room Occurrence
              -> declaration-required offer-time data
                  -> incoming, fixed, free, cage, or wheel rewards
              -> declaration-admitted picked-room details
                  -> Shop inventory, side rooms, encounters, features, items,
                     or other future room-local customization
```

Persistence remains normalized. An `ExitDecision` references target occurrence
IDs, and each `RoomOccurrence` remains stored once in the topology occurrence
collection. The hierarchy above defines semantic ownership and projection
closure; it does not require nested serialized objects.

## Problem Statement

The engine already owns the intended authored hierarchy:

- a decision owns its source, batch state, reward-store state, target
  references, and selection;
- a target owns one physical exit key and references one Room Occurrence;
- the Room Occurrence owns its selected declaration and complete room-local
  state;
- commands create and remove topology explicitly;
- progressive evaluation truthfully stops at the first unsupported semantic
  owner.

The structured workspace weakens that contract in four places:

1. `projectBiome` visits materialized decisions first and projects authored
   decisions only when their entire owner is absent;
2. `projectBatch` and `projectAuthoredBatch` construct parallel forms of the
   same semantic aggregate;
3. a retained authored target is projected as `entered: false` even when its
   decision selects it, conflating evaluation reach with picked-room authoring
   activation;
4. `registerFindingDestinations` can route a fine-grained finding to its biome
   shell, concealing a missing projected owner.

The peer merge added with the decision-highlight rail prevents an invalid
reward from turning an authored peer into a blank physical exit. It is a
correct local repair, but the surrounding evaluation-first assembly can
recreate the same class of omission for future room-local products.

## Required Contract

### Structural baseline

For every configured biome, authored state is the only authority for whether
the following semantic products exist:

- authored start;
- linked exit;
- Exit Decision;
- normal-door batch;
- batch reward-store and batch-specific state;
- physical target reference;
- target Room Occurrence;
- Hub decision, open slot, and visit;
- declaration-admitted room-local authored leaf.

Evaluation must not create, remove, replace, or suppress persisted authored
owners or their editable offer-time leaves. It may attach genuine derived
lifecycle and presentation products to a matching authored owner, including
entered or materialized status, physical availability, Clockwork outcome,
active cage count, continuation, and completion evidence.

For an entry-time product such as Shop inventory, evaluation may describe
whether the product is materialized and active. It does not synthesize
editable Shop offers that are absent from declaration-backed authored state.

### Decision aggregate

Every persisted batch decision projects exactly once as one workspace decision.
That aggregate contains:

- its batch-owned configuration;
- its authored selection;
- every authored physical target;
- every currently resolved but unfilled physical exit;
- every target's Room Occurrence;
- every declaration-required reward control;
- markers and focus destinations for all those semantic owners.

An evaluated batch may supply assessment, physical availability, Clockwork
outcome, Fields support, continuation, history, or other derived evidence. It
does not supply target membership.

### Current physical-exit set

In this specification, a `declared physical exit` means an exit resolved from
the normalized layout, the current authored source room, the current authored
topology, and any batch-owned authored state that participates in exit
resolution. It does not mean the union of exits that any possible room or
policy state could expose.

Blank authoring rows correspond only to this current resolved set. A retained
target whose exit is no longer in the current set remains a real unavailable
authored offer; it does not cause that exit to be treated as a current blank
row.

### Room-owned data

Each target resolves its occurrence through `occurrenceId`. The occurrence owns
its `gameName`, reward state, and all room-local state. The workspace may nest
that occurrence under its decision for presentation, but it must not transfer
leaf ownership to the decision or target.

Required offer-time values remain projected for picked and unpicked offers.
Current examples include:

- replaceable incoming counted rewards;
- authored payloads on fixed reward types;
- counted free rewards;
- Fields cages;
- Ship reward-wheel offers;
- N main-room and side-room rewards where their declarations make them real
  offers.

The absence of a selector remains valid for a declaration-fixed reward type or
a declaration with no authored reward leaf.

### Picked-room detail activation

The workspace must carry two separate facts:

```text
detailsActive  authored relationship: this occurrence is the selected or
               visited room whose picked-room detail surface is active

entered        evaluated fact: materialization reached and entered this room
```

The implementation may choose a more precise final name than
`detailsActive`, but it must preserve that distinction.

Authored detail activation is derived as follows:

| Structural role             | `detailsActive` source                |
| --------------------------- | ------------------------------------- |
| authored start              | active                                |
| declaration-linked room     | active                                |
| ordinary or takeover target | enclosing authored decision selection |
| Hub main target             | authored Hub visit membership         |
| completion room             | not an authored detail surface        |

Evaluation may mark an active room assessed, invalid, blocked, or unassessed.
It may not deactivate its authored detail surface.

Room-local products still declare their own lifecycle policy:

- offer-time rewards ignore `detailsActive` and remain editable;
- picked-room authored customization uses `detailsActive`;
- a genuine entry-time product that has never materialized remains absent;
- retained state on an inactive room may remain persisted but dormant;
- removing retained authored state requires an explicit owning command unless
  an existing lifecycle contract deliberately defines selection as its
  materialization transition.

This correction establishes the activation fact but does not reclassify
existing Fields, Ship, Shop, or Ephyra lifecycle rules beyond what their
current authorities declare.

### Evaluation overlay

The application must index evaluated decisions by semantic owner. For one
authored decision, its optional overlay is the canonical or progressive
decision with the same owner address.

For a batch:

```text
authored decision
  -> authored targets ordered by the current resolved physical-exit set
  -> optional evaluated target lookup by exitKey
  -> one projected target per authored target
```

An evaluated target may provide:

- assessed state;
- physical availability;
- Clockwork Goal or NonGoal outcome;
- evaluated continuation;
- evaluated active Fields cage count;
- evaluated room lifecycle facts.

When no evaluated target exists, the workspace uses authored and normalized
facts and marks the target unassessed. It does not publish a missing-target row.

Missing physical targets are always:

```text
current resolved physical exit keys - authored target exit keys
```

They are never derived from the union of potentially available exits or by
subtracting evaluated target keys.

Because evaluation is produced from the same immutable document, an evaluated
decision or target without a matching authored owner is a projection contract
error. The implementation must not silently synthesize authored topology from
that evaluated product.

### Progressive frontier

A progressive prefix remains valuable and truthful. It may enrich:

- completed decisions;
- the current partially evaluated decision;
- the exact evaluation frontier;
- assessment and finding markers.

It must not truncate authored decisions, targets, occurrences, rewards, or
active picked-room details that remain after that frontier. Those products
project as retained or unassessed.

### Findings and focus

Findings decorate semantic owners; they do not determine owner or control
existence.

Before coarse fallback registration, the projection must prove:

- every persisted decision, target, occurrence, and active leaf has its exact
  semantic marker;
- every such marker has an exact focus destination;
- an exact target, occurrence, or leaf destination opens its containing
  decision or Hub workbench without changing the finding's owner address.

Biome-shell fallback may remain for genuinely biome-scoped findings. It must
not satisfy the contract for these fine-grained persisted owners:

- batch reward store;
- exit selection;
- target;
- occurrence;
- incoming or local reward;
- local child or child group;
- reward wheel or wheel offer;
- Hub slot or visit;
- Shop offer or purchase.

Tests must fail if one of those owners reaches only the biome shell.

## Proposed Projection Shape

### Evaluated overlay index

Build one immutable per-biome lookup before structural projection:

```text
evaluated exit decision by semantic owner
evaluated Hub decision by semantic owner
partial frontier batch by semantic owner
evaluated room/target products by their existing semantic addresses
```

The index is replaceable evaluation data. It owns no workspace ordering or
membership.

### Authored-first traversal

Project in this order:

1. authored start;
2. authored Exit Decisions in selected-topology order;
3. authored Hub decision and its declaration-owned outline where applicable;
4. active authoring frontier;
5. derived completion outline.

For each authored Exit Decision:

1. resolve its exact optional evaluated overlay;
2. project one linked or batch aggregate;
3. resolve every authored target occurrence;
4. overlay target and room evaluation by semantic key;
5. project declared missing-exit creation controls;
6. register all exact focus destinations.

Evaluation-array order must not become topology order.

For a normal batch, target order is its current physical exit order, with a
code-unit exit-key and occurrence-ID tie-breaker. The selected target's reachable
authored subtree is emitted before retained peer subtrees; linked targets
recurse immediately. If malformed in-memory topology leaves disconnected
decision components, they follow in deterministic semantic-key order. This
defensive ordering does not admit malformed documents: codec validation remains
persistence authority.

### One batch projector

Replace the parallel evaluated and authored batch constructors with one
authored-first batch projector:

```ts
projectAuthoredBatchWithOverlay(
  context,
  plan,
  authoredDecision,
  evaluatedBatch?,
  progressiveState?,
)
```

The final function name is not contractual. Its input direction is.

Shared helpers should own:

- target ordering;
- target occurrence resolution;
- authored selection;
- optional evaluated target enrichment;
- missing physical exits;
- batch kind and repair scope;
- decision-owned focus redirection.

Do not retain a second complete evaluated-only batch construction path.

### Room projection input

`projectOccurrence` must receive explicit authored activation separately from
optional canonical room evidence. It must not infer activation from whether a
canonical room exists.

A suitable input is:

```ts
{
  detailsActive: boolean;
  evaluatedRoom?: CanonicalAuthoredRoom;
}
```

The exact TypeScript shape may vary. React receives presentation-ready facts
and continues to avoid inspecting authored topology.

### Projection closure check

Add a focused projection-contract validator after structural nodes are built
and before generic finding fallback.

At minimum it verifies:

- every authored decision address resolves to exactly one reachable decision
  aggregate and inspector destination;
- every authored target address resolves to its containing decision aggregate;
- every structurally owned occurrence address resolves to exactly one
  reachable occurrence projection and owner/control package;
- an occurrence package may be nested in a decision card, Hub board, or
  fixed-stage inspector and need not be a standalone workspace node;
- every editable leaf address resolves to its containing inspector and exact
  interaction;
- no semantic owner resolves through conflicting or duplicate packages;
- no fine-grained finding depends on biome-shell fallback.

The authored codec remains the authority for persisted topology validity. The
workspace closure check proves semantic-owner reachability and adapter
completeness; it must not prescribe a particular rendered node shape or
duplicate room eligibility, reward, lifecycle, or topology-repair rules.

## Concrete Deliverables

### Deliverable 1: Regression fixtures

Add failing projection and UI fixtures before changing assembly:

1. an invalid early physical peer does not hide a later authored peer;
2. a selected target omitted from the materialized prefix retains its
   occurrence, required rewards, and picked-room activation;
3. a selected Shop with authored inventory remains editable when evaluation
   stops before its room;
4. an unpicked Shop remains dormant, including retained decoded inventory;
5. a downstream selected room behind an upstream invalid decision remains
   present and unassessed;
6. a retained unavailable target retains room, reward, selection, repair, and
   exact focus products;
7. a fine-grained leaf finding resolves to its containing decision at the
   exact semantic owner, never only to the biome shell.

### Deliverable 2: Authored/evaluated decision reconciliation

- Introduce the per-biome evaluated overlay index.
- Change ordinary Exit Decision traversal to authored-first.
- Treat unmatched evaluated decisions and targets as projection contract
  failures.
- Derive missing exits from authored targets.
- Preserve partial-frontier markers and evaluated evidence.

### Deliverable 3: Unified batch projection

- Consolidate `projectBatch` and `projectAuthoredBatch`.
- Consolidate canonical and authored target construction behind one target
  projector.
- Preserve takeover, mixed I Preboss, Fields, retained-capacity repair, and
  completed-Hub handoff behavior.
- Delete obsolete represented-owner and fallback batch assembly.

### Deliverable 4: Room detail activation

- Add the explicit authored detail-activation fact.
- Retain evaluated entry and assessment as separate facts.
- Gate only declaration-defined picked-room detail surfaces on authored
  activation.
- Keep offer-time reward controls independent of findings and coverage.
- Add focused UI tests demonstrating active, dormant, assessed, invalid, and
  unassessed combinations.

### Deliverable 5: Projection closure and finding routing

- Add the semantic-owner reachability validator.
- Run it before generic finding destination registration.
- Restrict fine-grained leaf findings to exact destinations.
- Retain only deliberate coarse-owner fallback behavior.
- Add failure-focused unit coverage for missing and duplicate projection
  products.

### Deliverable 6: Documentation and evidence

- Update the owning design documents only if implementation reveals a stable
  contract not already captured there.
- Record the final files changed, fixture counts, commands, and results in this
  document.
- Update `IMPLEMENTATION_PROGRESS.md` without changing the unrelated active
  phase frontier.
- Commit independently from presentation work using a Conventional Commit.

## Expected File Scope

Primary:

- `apps/planner/src/projections/structuredWorkspace.ts`
- `apps/planner/src/projections/structuredWorkspace.test.ts`
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`
- `apps/planner/src/ui/editor/biome/BiomeWorkspace.test.tsx`

Possible focused product-loop coverage:

- `apps/planner/test/product-loops/GoldenUnderworldProductLoop.interaction.test.tsx`
- `apps/planner/test/product-loops/GoldenSurfaceProductLoop.interaction.test.tsx`

Documentation:

- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`
- `docs/design/EDITOR_MODEL.md`, only if its stable contract needs precision;
- `docs/progress/IMPLEMENTATION_PROGRESS.md`
- this specification.

The following are not expected to change:

- `packages/planner-engine/src/authored-project/model.ts`
- schema version or codec;
- semantic command types or handlers;
- simulator materialization, progressive evaluation, rewards, or findings;
- catalog declarations;
- Redux authored history;
- persisted profiles.

Any discovered need to change those authorities pauses this correction for a
scope review rather than silently expanding it.

## Cross-Biome Audit Matrix

Each production biome must be checked even when focused regressions use only F
or N.

| Biome | Structural audit                                            | Required room-data audit                                 | Activation/evaluation audit                                                 |
| ----- | ----------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| F     | multi-exit ordinary and takeover batches; retained capacity | counted, Shop, and free rewards                          | invalid peer, selected retained Shop, downstream unassessed decision        |
| G     | ordinary batches and open-picked-exit takeover behavior     | counted, Miniboss, Shop, and free rewards                | unavailable retained exits and exact repair focus                           |
| H     | fixed-count Fields batches and takeover                     | authored cage outcome and all cage rewards               | active/dormant cages remain declaration-driven, not prefix-driven           |
| I     | ordinary/mixed batch with retained Preboss peer             | dormant Tartarus reward and Preboss Shop                 | Goal/NonGoal overlay may alter presentation but not occurrence ownership    |
| N     | Opening, linked PreHub, Hub slots, visits, and handoff      | main offers, side rewards, and Preboss Shop              | authored visits activate side details; partial Hub evaluation retains board |
| O     | ordinary Ship batches and width-one takeover                | encounter count, wheels, offers, and Shop                | wheel activity remains declaration/lifecycle-driven under blocked suffixes  |
| P     | two-door physical batches and takeover                      | counted, fixed, Devotion payload, Shop, and free rewards | target compatibility findings retain both offer controls                    |
| Q     | staged width-one ordinary batches and takeover              | rewardless, fixed Miniboss, and Shop shapes              | staged invalidity retains authored stage target and exact finding focus     |

## Contract Audit Scenarios

### Semantic reachability audit

For representative complete, incomplete, invalid, and decoded-retained
projects:

- enumerate persisted decision, target, occurrence, and editable-leaf semantic
  addresses;
- prove each exact address resolves to one containing inspector destination;
- prove every editable address resolves to its semantic interaction;
- prove no exact address resolves through conflicting presentation packages;
- use node and product counts only as supporting duplicate-detection evidence,
  not as the representation contract;
- prove missing-target rows correspond only to current resolved physical exits
  without an authored target.

### Mandatory leaf audit

For every current `AuthoredRoomState` family:

| State family   | Required projection                                                    |
| -------------- | ---------------------------------------------------------------------- |
| `none`         | explicit no-reward presentation where relevant                         |
| `fixed`        | fixed summary and payload control when declared                        |
| `counted`      | incoming reward control                                                |
| `freeReward`   | incoming free-reward control                                           |
| `ephyraCombat` | main offer and declaration-owned side rewards                          |
| `fieldsCombat` | every persisted cage reward with active state                          |
| `shipCombat`   | encounter choice, wheels, offers, and picked offer                     |
| `shop`         | dormant state when inactive; complete offers and purchases when active |

The audit must exercise valid, invalid, and unassessed values. Findings may
change markers and candidate support, not control existence.

### Activation audit

Exercise the Cartesian cases that are structurally meaningful:

| Authored detail state | Evaluation state | Expected result                         |
| --------------------- | ---------------- | --------------------------------------- |
| active                | assessed valid   | controls visible and assessed           |
| active                | assessed invalid | controls visible with findings          |
| active                | unassessed       | controls visible and unassessed         |
| dormant               | assessed         | lifecycle-specific dormant presentation |
| dormant               | unassessed       | same dormant presentation               |

No test may use a finding code as the switch that renders or suppresses a
control.

### Finding destination audit

For every fine-grained address family currently emitted by simulation:

- publish or locate a finding;
- assert `focusByOwner` contains the exact semantic key before fallback;
- assert `ownerAddress` remains the finding origin;
- assert `nodeKey` identifies the containing decision, Hub, or fixed-stage
  inspector regardless of whether the owner has a standalone node;
- focus it through Redux and prove the expected control is rendered.

### Candidate interaction audit

For each projected editable room or reward control:

- the interaction catalog contains its semantic owner;
- an unavailable current value remains pinned and inspectable;
- unassessed controls remain present without fabricated support;
- lazy candidate loading remains lazy;
- no candidate query runs merely because the workspace rendered.

### Persistence and history audit

The correction must prove:

- projecting or focusing creates no authored history;
- no project codec output changes;
- no schema migration occurs;
- semantic edit commands retain their current Undo/Redo grouping;
- evaluation publication remains replaceable and outside authored history.

## Acceptance Criteria

The correction is complete only when all are true:

- authored topology is the first input to ordinary decision projection;
- no evaluated-only complete batch construction path remains;
- every persisted decision, target, occurrence, and editable leaf satisfies
  exact semantic-owner reachability;
- required reward controls survive invalid and unassessed evaluation states;
- picked-room detail activation is independent from evaluated entry;
- missing-target rows are based only on absent authored targets within the
  current resolved physical-exit set;
- fine-grained persisted findings never rely on biome fallback;
- N Hub behavior and all biome-specific room state remain unchanged except for
  the corrected visibility/focus contract;
- React continues to consume only the structured workspace and semantic
  interactions;
- no persisted or simulator contract changes;
- all audit evidence is recorded below.

## Verification Plan

During implementation, use the narrowest truthful lanes:

1. focused Vitest runs for new projection and UI fixtures;
2. `npm run test:planner`;
3. `npm run test:contract`;
4. `npm run test:product`;
5. `npm run check`;
6. `git diff --check`.

Because this changes a shared application projection used by every biome, the
complete gate is mandatory before completion or commit.

## Implementation Evidence

Fill this section during delivery; do not mark the specification complete
before every row has concrete evidence.

| Evidence                        | Result                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| implementation commit           | Included with this completed delivery specification.                                                                     |
| focused regression fixtures     | Passed: 3 files, 91 tests.                                                                                               |
| F/G/H/I audit                   | Underworld projection fixtures cover ordinary, Fields, mixed, and takeover paths; the complete repository suite passed.  |
| N/O/P/Q audit                   | Surface projection fixtures cover linked, Hub, Ship, and width-one takeover paths; the complete repository suite passed. |
| semantic reachability audit     | Independent authored-leaf requirements plus projection/interaction closure and malformed-owner contract fixtures.        |
| mandatory leaf audit            | Structured workspace and UI fixtures cover declaration-owned reward and room-local leaves.                               |
| activation audit                | `detailsActive` remains distinct from evaluated `entered` for invalid and unassessed authored rooms.                     |
| exact finding destination audit | Contract fixture rejects a fine-grained finding with no exact workspace destination.                                     |
| candidate interaction audit     | Closure fault-injection fixtures require every advertised frontier and leaf interaction.                                 |
| persistence/history audit       | No schema, command, catalog, or simulator changes; full suite includes existing history and codec coverage.              |
| `npm run test:planner`          | Passed: 23 files, 203 tests.                                                                                             |
| `npm run test:contract`         | Passed: 4 files, 17 tests.                                                                                               |
| `npm run test:product`          | Passed: 3 files, 13 tests.                                                                                               |
| `npm run check`                 | Passed: typecheck, 60 files / 630 tests, lint, format check, and production build.                                       |
| `git diff --check`              | Passed after the documentation update.                                                                                   |

## Non-Goals

- schema 10 or another persisted document migration;
- replacing the Room Occurrence or Exit Decision model;
- making the simulator emit fake complete canonical structure;
- changing reward, bag, force, eligibility, or lifecycle rules;
- adding encounters, features, items, or a generic customization bag before
  concrete declarations and commands exist;
- changing rail contents or redesigning decision cards;
- adding a customize-room dialog;
- flattening N into ordinary batch presentation;
- making unpicked Shop inventory active;
- removing explicit topology-repair commands;
- moving topology or leaf eligibility logic into React.

## Commit Boundary

Land this as one independent contract-correction commit after the
decision-highlight rail commit. The expected commit class is:

```text
refactor(planner): enforce authored-first workspace projection
```

If implementation requires persisted schema, command, catalog, or simulator
changes, stop and split the work behind a revised specification.
