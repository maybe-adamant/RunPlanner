# Post-Biome UX Feedback and Frontier

## Purpose and Timing

This document defines the major editor UX pass that begins only after Phase 6
has brought every supported biome into the application with authored topology,
simulation, validation, candidate evaluation, and a minimally usable editor
projection.

It consolidates the useful feedback and navigation policy proven by the old
ImGui planner without carrying forward its row-engine coupling, control
aliases, or index-based finding translation. It also defines the future
candidate-presentation and frontier-advance boundaries needed to make the
standalone editor substantially easier to use.

This is a forward-looking authority. It does not describe current Phase 4 UI
behavior as already implemented.

- Phase 4 remains the thin usable F editor defined in
  `IMPLEMENTATION_PLAN.md`.
- Phase 5 remains the F/G product loop and supplies the first contextual
  candidate evaluation.
- Phase 6 activates the remaining biomes with complete, biome-faithful product
  loops.
- Phase 7 consumes the complete cross-biome evidence and performs the shared
  feedback, candidate, frontier, accessibility, and presentation push defined
  here.

Deferring the shared UX pass avoids prematurely designing an F-shaped editor
abstraction. The final system must account for forked terminal transitions,
direct terminals, conditional-terminal batches, staged candidate pools, and
the N hub before it claims one common interaction language.

## Current Foundation and Deferred Work

The application already has or will gain before Phase 7:

- stable semantic addresses for routes, biomes, continuations, targets,
  occurrences, rewards, shops, and completion rooms;
- semantic findings with player-facing copy;
- exact finding navigation without rendered-row lookup;
- immutable authored projects and semantic command history;
- complete canonical snapshots and lifecycle history for validly materialized
  biomes;
- room and reward possibility evaluation from game-language history;
- explicit layout policies for linear, conditional-terminal, staged, and hub
  structures;
- terminal continuation kinds that remain distinct from ordinary batches.

The current F room-generation result already records useful eligibility and
force-pressure facts for authored targets. It does not yet constitute the
complete Phase 7 presentation input: selected-room evidence and aggregate
support-name lists are not a typed assessment of every option, and incomplete
frontier evaluation does not automatically create a canonical snapshot.

Phase 5 and Phase 6 must preserve enough semantic assessment data for Phase 7
to consume. Phase 7 owns the shared presentation policy and does not move game
rules into React.

## UX Principles

The post-biome editor follows these principles:

1. Simulation reports game facts; presentation policy decides how they look.
2. Authored invalid state remains visible and editable.
3. Unselected unsupported candidates may be filtered by an explicit typed
   policy.
4. A finding marks something that was evaluated and found incomplete,
   impossible, or noteworthy.
5. Blocked means evaluation did not reach the owner; it is not a fabricated
   local error.
6. Presentation state propagates upward to navigation, never sideways into
   unrelated owners.
7. Color is supplementary. Text, markers, counts, icons, focus, and accessible
   labels carry the same meaning.
8. The UI does not infer history, eligibility, force pressure, or terminal
   structure from rendered position.
9. Positive or enrichment coloring appears only when the complete relevant
   route validates.
10. One visible user intent remains one semantic undo entry.

## Feedback Presentation Model

### Presentation States

The common owner-presentation vocabulary is:

| State     | Meaning                                                        |
| --------- | -------------------------------------------------------------- |
| `normal`  | The owner was evaluated and has no projected finding           |
| `warning` | The owner was evaluated and has non-blocking advisory feedback |
| `invalid` | The owner was evaluated and has an error finding               |
| `blocked` | Required earlier history was unavailable, so it was not tested |

Transient navigation selection is a separate overlay. It must not replace or
erase the owner's warning, invalid, or blocked state.

`hidden` is not a finding state. Structural absence and candidate filtering
have separate authorities.

### Exact Ownership and Aggregation

Every finding retains one exact `SemanticAddress` origin. The application
builds a presentation projection that provides:

- findings indexed by exact owner;
- the exact owner's presentation state;
- primary and related findings for that owner;
- aggregate biome, route, and project state;
- stable finding navigation keys;
- destination copy using catalog labels and structural roles.

Aggregation moves upward through semantic ownership:

```text
shop purchase
  -> room occurrence
  -> biome
  -> route
  -> project

target reward
  -> target
  -> parent decision
  -> biome
  -> route
  -> project
```

It never derives parents from React nesting or DOM ancestry. A finding under
one exit may mark its decision, biome, route, and project invalid, but it does
not mark sibling exits invalid unless they own findings of their own.

### Evaluation Coverage and Blocking

Finding order is not a processing horizon. The first red finding does not
automatically make everything after it grey.

Blocked presentation requires explicit simulation coverage:

- route evaluation already identifies later biomes blocked by an incomplete,
  invalid, or unavailable simulator boundary;
- contextual candidate evaluation should identify which authored generation
  points and active frontiers it evaluated;
- owners outside that coverage may be presented as blocked;
- an evaluated invalid owner remains red even when an earlier owner is also
  invalid.

Blocked content remains visible and editable. Grey communicates that the
simulator cannot currently make a contextual claim, not that the control is
disabled or that the authored value has disappeared.

### Local and Global Presentation

The final experience should preserve the useful hierarchy of the old planner:

- exact invalid or warning owners receive a local marker and restrained
  label, border, or field accent;
- biome and route navigation receive aggregate status without coloring all of
  their content;
- selecting a finding opens the owning route and biome and focuses the exact
  semantic owner;
- the global findings surface presents a compact primary item and related
  findings instead of an unbounded flat error wall;
- every finding remains inspectable even when related items are collapsed;
- no raw finding code, evidence object, game name, or occurrence ID becomes
  ordinary player-facing copy.

The presentation projection, not individual React components, interprets
finding severity and grouping.

## Candidate Assessment Model

### Simulation Facts

Candidate simulation returns typed game-language assessments. It does not
return `hidden`, CSS colors, dropdown groups, or component props.

The target shape is equivalent to:

```ts
interface RoomCandidateAssessment {
  readonly gameName: string;
  readonly support: 'supported' | 'unsupported';
  readonly forceSupport: 'none' | 'optional' | 'required';
  readonly exclusions: readonly CandidateExclusion[];
}
```

Candidate exclusions remain structured:

```ts
type CandidateExclusion =
  | { kind: 'requirementFailed'; failure: RequirementFailure }
  | { kind: 'currentRoomRepeat' }
  | { kind: 'exitIncompatible' }
  | { kind: 'physicalExitUnavailable' }
  | { kind: 'capReached'; cap: RoomCapKind }
  | { kind: 'forceMinimumNotReached' }
  | { kind: 'excludedByForcedPool' };
```

A failed counter condition identifies its exact axis, actual value, and
declared range rather than collapsing every predicate into an opaque
`eligibilityRequirement` label:

```ts
interface CounterRangeFailure {
  readonly kind: 'counterRange';
  readonly axis: CounterAxis;
  readonly actual: number;
  readonly expected: CounterRange;
}
```

The same assessment supports validation, explanation, filtered selectors, and
diagnostic selectors without reevaluating the declaration in the UI.

### Generation-Point Ownership

Candidate support is meaningful only at a concrete game generation point.
Every assessment therefore belongs to a semantic target or active frontier
and carries the history context produced immediately before generation.

For an existing target, the canonical or authoring evaluation supplies its
pre-generation state. For an incomplete active frontier, contextual candidate
evaluation may execute the fully specified entered prefix through the source
room's outgoing-generation point.

That authoring projection is not a partial canonical snapshot. Phase 3's rule
remains intact: an incomplete biome does not produce canonical history or an
execution-ready snapshot. Complete-plan and authoring-prefix projections must
agree at every generation point they share.

### Why Contextual Filtering Has High Value

F demonstrates the value without making either F or a particular counter axis
a UI exception. Its ordinary candidate pool contains 22 combat rooms, three
minibosses, Story, Fountain, Midshop, and Preboss.

Early in F:

- nine combat maps wait for `biomeEncounterDepth >= 5`;
- three minibosses, Story, Fountain, and Midshop wait for their later
  `biomeDepthCache` windows;
- Preboss waits for its terminal force point.

A contextual policy can therefore remove a large amount of irrelevant room
interaction. Later in the biome, early-only combat maps leave support while
late maps and terminal pressure enter it. The value comes from consuming typed
candidate support, not from hardcoding `biomeDepthCache` as a special UI rule.

## Candidate Presentation Policies

### Separation from Game Declarations

Room and reward declarations describe game behavior. They do not own whether
the editor hides, disables, colors, or explains an unsupported option.

An editor-owned policy consumes candidate assessments:

```ts
interface CandidatePresentationRule {
  readonly when: CandidatePresentationPredicate;
  readonly presentation: {
    readonly visibility: 'visible' | 'hidden';
    readonly interaction: 'selectable' | 'disabled';
    readonly tone: 'normal' | 'warning' | 'invalid';
  };
}
```

Rules are typed, ordered, validated at construction, and injected into the
application projection. Their precedence and fallback must be deterministic
when one candidate has multiple exclusions.

### Selected-Value Invariant

A currently authored value is never hidden.

If an upstream edit makes the selected room or reward unsupported, the editor
retains it and marks it invalid until the user replaces it or invokes an
explicit owning structural deletion. Presentation policy may change how
unselected candidates appear, but it cannot erase authored truth.

This distinguishes two concepts that earlier editor wording treated too
broadly:

- an authored context-invalid value remains visible;
- an unselected unsupported candidate may be hidden by policy.

### Policy Variants

At least two policies should exist during the Phase 7 usability pass:

```text
Support-first
  supported                         -> visible and normal
  unsupported + currently selected  -> visible and invalid
  unsupported + unselected          -> hidden

Diagnostic
  supported                         -> visible and normal
  unsupported                       -> visible and invalid
```

A later guided policy may distinguish requirement, cap, and forced-pool
failures, but no policy variant may require new simulation logic.

Policy selection is initially application configuration for usability testing,
not persisted project state. A player-facing preference should be added only
if testing demonstrates lasting value.

### Category Projection

The room type selector derives category presentation from its child candidates:

- a category with supported visible children appears normally;
- a category with no visible child and no authored selection may be hidden;
- a category containing the retained invalid selection remains visible and
  invalid;
- category state never becomes persisted topology.

The same aggregation principle may later apply to reward families and shop
groups when their candidate authorities expose equivalent typed assessments.

## Frontier Outcome Model

### Current and Target UX

The Phase 4 through Phase 6 linear editor may expose separate structural
actions such as `Add Next Decision` and `Go to Preboss`. Those actions map
cleanly to the current authored command surface and remain acceptable during
biome implementation.

The Phase 7 target removes the ordinary user's need to select a continuation
representation that the game itself derives from eligibility, force, and
layout policy.

The simulator/application projection returns a typed frontier outcome:

```ts
type FrontierOutcome =
  | {
      kind: 'ordinaryBatch';
      candidatesByExit: readonly RoomCandidateProjection[];
    }
  | {
      kind: 'terminalTransition';
      roomGameName: string;
      realizationCount: number;
    }
  | {
      kind: 'conditionalTerminalBatch';
      candidatesByExit: readonly RoomCandidateProjection[];
    }
  | {
      kind: 'blocked';
      reason: FrontierBlockReason;
    };
```

The editor exposes one semantic frontier intent, provisionally labeled
`Add Next Decision`. The application maps that intent to the existing concrete
batch or terminal command. Terminal topology remains explicit in the authored
model; only the representation choice disappears from ordinary UX.

### Layout Families

The shared frontier projection must cover these different structures:

| Layout family               | Biomes     | Frontier interpretation                                                                                                                 |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Forked independent terminal | F, G, H, P | Required Preboss support creates one terminal occurrence per active predecessor exit; realization policy assigns Shop then free rewards |
| Direct independent terminal | O, Q       | Required Preboss support creates one necessarily entered terminal occurrence                                                            |
| Conditional-terminal batch  | I          | Preboss and an ordinary peer may share one generated decision; the picked declaration role determines completion                        |
| Fixed hub terminal          | N          | Hub completion exposes its fixed authored terminal through hub policy rather than ordinary room replacement                             |

The Phase 7 abstraction must follow these declared policies. It must not force
N or I through the F terminal shape.

### Forced Terminal and Picked Realization

For F/G/H/P, terminal force determines that predecessor exits create Preboss
occurrences. It does not necessarily determine which realization the player
enters.

- a single terminal exit may be picked in the same semantic command group;
- multiple terminal exits still require one authored Shop/free-reward choice;
- every terminal target retains its own occurrence and offer state;
- unpicked terminal rewards remain real generated dead leaves.

### Creation Versus Retained Invalid Structure

Frontier derivation applies when a continuation is absent and the user advances
it. It never silently rewrites an existing continuation after an upstream edit.

If upstream edits make an ordinary batch occupy a required-terminal point, the
editor retains the batch, reports the invalid state, and offers an explicit
repair such as `Replace with required Preboss`.

If upstream edits make an existing terminal premature, the editor retains it,
reports the invalid state, and offers an explicit continuing-room or removal
repair.

These repair actions remain semantic commands with explicit destructive scope.
They do not weaken downstream retention.

## Phase 5 and Phase 6 Readiness Constraints

The major UX work is deferred, but temporary editors must not create avoidable
debt. Phase 5 and Phase 6 follow these constraints:

1. Candidate evaluators expose game facts rather than pre-rendered UI values.
2. Candidate and finding results use semantic addresses, not row indexes.
3. Selected invalid authored values remain representable.
4. No biome editor reevaluates requirements or force rules in React.
5. Finding copy and presentation mapping remain centralized.
6. Frontier actions remain behind shared layout projection/components where
   practical rather than being copied into every biome editor.
7. Domain terminal kinds remain explicit even while the temporary UI exposes
   separate actions.
8. Golden tests emphasize semantic commands and simulation outcomes; exact
   temporary button arrangement is not a domain contract.
9. Complete and incomplete evaluation results state their coverage honestly.
10. New biome activation does not wait for the final visual polish defined
    here.

These are architectural readiness constraints, not extra Phase 5 or Phase 6
product deliverables.

## Phase 7 Implementation Order

The implementation should remain reviewable through the following atomic
slices.

### Commit 1: Cross-Biome UX Contract Reconciliation

- audit every active biome editor against this document;
- reconcile exact semantic owners, candidate result shapes, and frontier
  layout policies;
- identify missing authoring coverage or typed exclusion evidence;
- add no speculative UI behavior before the audit closes.

### Commit 2: Shared Feedback Presentation Projection

- owner presentation states;
- semantic parent aggregation;
- primary and related finding grouping;
- route/biome/project status projection;
- explicit coverage-derived blocked state;
- focused projection tests independent of React.

### Commit 3: Feedback UI Integration

- exact local marker and field/card decoration;
- compact findings summary;
- navigation propagation through route and biome surfaces;
- warning, invalid, blocked, and selected accessibility treatment;
- no candidate filtering in this commit.

### Commit 4: Typed Candidate Policy Resolver

- validated policy declarations;
- deterministic multi-reason resolution;
- selected-value visibility invariant;
- category aggregation;
- support-first and diagnostic policy fixtures.

### Commit 5: Cross-Biome Candidate UI Integration

- room selectors consume candidate presentation projections;
- unavailable retained selections remain editable and explained;
- room type categories follow child state;
- policy changes require no simulation rebuild or authored migration;
- representative F, G, H, I, N, O, P, and Q interaction fixtures.

### Commit 6: Shared Frontier Projection

- ordinary, independent-terminal, conditional-terminal, hub-terminal, and
  blocked frontier outcomes;
- parity with each biome's existing concrete command behavior;
- no React integration until cross-biome frontier fixtures pass.

### Commit 7: Unified Frontier UX and Repairs

- one ordinary frontier-advance interaction;
- derived terminal creation;
- explicit multi-exit realization choice;
- retained-invalid contextual repairs;
- removal of ordinary always-visible `Go to Preboss` actions where the layout
  projection makes them redundant.

### Commit 8: Cross-Biome UX Closure

- full browser interaction pass;
- accessibility and keyboard audit;
- measured editor responsiveness;
- visual hierarchy and spacing polish;
- updated golden fixtures and player-facing label audit;
- documentation reconciliation.

## Acceptance

Phase 7 closes only when:

- every active biome uses the shared feedback presentation language;
- findings navigate to and decorate exact semantic owners;
- blocked content is derived from coverage and remains editable;
- candidate policies can change presentation without changing simulation;
- selected invalid authored values are never hidden;
- room categories and options reflect their typed candidate projections;
- no eligibility or force rule exists only in UI code;
- every layout family advances through its declared frontier semantics;
- terminal creation and retained-invalid repair remain distinct operations;
- F/G/H/I/N/O/P/Q interaction fixtures cover their representative frontier
  forms;
- full repository tests, production build, accessibility checks, and measured
  responsiveness pass.

## Non-Goals

This UX phase does not add:

- new game rules or biome approximations;
- probability, likelihood, route optimization, or RNG prediction;
- automatic repair of invalid authored topology;
- a second persisted UI tree;
- UI-owned candidate evaluation;
- execution-plan compilation or game-module integration;
- Tauri-specific simulation behavior.
