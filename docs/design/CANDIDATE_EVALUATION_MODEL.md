# Candidate Evaluation Model

## Purpose

This document defines how the standalone planner evaluates contextual
alternatives without turning canonical history into an exhaustive candidate
simulator.

`SIMULATION_AND_VALIDATION.md` owns project evaluation, progressive coverage,
history, selected-plan validation, and semantic findings.
`CONTEXTUAL_EDITOR_UX.md` owns the player-facing grouping, explanation, and
interaction policy over candidate results. This document owns the boundary
between them:

- how one immutable project evaluation prepares candidate contact;
- which selected-simulation facts candidate evaluation may consume;
- how an interactable evaluates its complete domain on demand;
- how much simulation a proposed value may replay;
- how candidate sessions are cached and invalidated.

Candidate results are replaceable derived data. They never enter the authored
project, profile document, autosave, undo history, or canonical game history.

## Current System and Refactor Motivation

The current production path already avoids an eager candidate-only project
simulation. One semantic edit, undo, or redo creates a new immutable
`ProjectDocument` and one matching `ProjectEvaluation`. Candidate preparation
shares that base evaluation.

The remaining cost occurs after candidate contact:

1. the application expands one control domain into scalar candidate queries;
2. the prepared evaluator dispatches every scalar query independently;
3. direct candidates read existing generation or reward-support ledgers;
4. complex candidates apply one temporary semantic command;
5. reward, shop, room-lifecycle, and Hub alternatives may reevaluate the whole
   addressed biome once per scalar value.

The replay is scoped to the addressed biome and reuses the already-evaluated
upstream seed; it is not normally a second full-project simulation. It is still
too broad. A dense reward domain, including 72 complete Devotion pairs, repeats
the same materialization, history walk, and selected-biome evaluation for every
alternative even though all alternatives share one semantic producer and one
pre-decision state.

Project-identity option caching avoids repeated work for the same immutable
snapshot. It cannot help the first contact, and every semantic edit correctly
creates a new identity and invalidates the old candidate session.

## Core Decision

Canonical and progressive simulation remain selected-plan evaluators.

They publish:

- the maximum truthful route and biome coverage;
- canonical or progressive materialization;
- lifecycle history and counter ledgers;
- selected room-generation and reward results;
- typed semantic pre-decision views needed to explain a covered decision.

They do not enumerate or evaluate every alternative.

An interactable with a covered semantic owner asks one project-bound candidate
session to evaluate its domain. The session prepares that owner's decision
context once and assesses every requested alternative through the same
generation, reward, requirement, and finding authorities used by selected-plan
simulation.

```text
ProjectDocument + matching ProjectEvaluation
  -> PreparedCandidateSession
      -> locate semantic owner
      -> require route and biome coverage
      -> prepare one decision context
      -> evaluate one candidate domain
  -> typed candidate results
```

History remains immutable game-language data. It does not contain callbacks,
UI option arrays, candidate colors, or executable per-control functions. The
candidate subsystem consumes typed history and decision views.

## Semantic Coverage

A candidate is assessable only when normal project evaluation has reached its
owner and the checkpoint required by that candidate family.

The existing route distinctions remain exact:

- `upstreamIncomplete`: an earlier route biome is incomplete;
- `upstreamInvalid`: an earlier complete biome is invalid;
- `coverageNotReached`: the active biome has not reached this local owner and
  checkpoint.

The application may avoid requesting an unassessed control, but the engine
remains the contact boundary and must independently enforce coverage.

The decision point immediately before a selected invalid value is covered. Its
pre-decision state must remain available so the user can evaluate replacements.
Owners after the first blocking invalid state remain unassessed unless the
layout defines an atomic decision region that must be evaluated as one unit.

N's open Hub board and any jointly unordered reward producer are such atomic
regions. They do not acquire a false slot- or sibling-order coverage prefix.

## Candidate Session

A prepared session belongs to exactly one identity pair:

```ts
interface PreparedCandidateSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  evaluateDomain(request: CandidateDomainRequest): CandidateDomainEvaluation;
}
```

Construction verifies that the evaluation was produced from the exact project
identity. A session may cache:

- route, biome, occurrence, target, and semantic-owner indexes;
- prepared generation views;
- prepared reward-producer frontiers;
- scoped lifecycle-region inputs;
- evaluated domains keyed by semantic owner and exact domain identity.

No cache crosses a `ProjectDocument` identity. A semantic edit, undo, redo,
profile load, or new project receives a new evaluation and candidate session.
Navigation, focus, search, and disclosure do not invalidate it.

The primary API is domain-shaped rather than scalar-shaped. A compatibility
adapter may continue to accept scalar `ProjectCandidateQuery` values during
migration, but it must group them by candidate family and semantic owner and
reuse the same prepared context.

## Evaluation Strategies

Not every candidate requires the same replay scope.

### Direct Support Lookup

These candidates already have selected-simulation support ledgers or immutable
declaration domains:

- authored start rooms;
- batch reward stores;
- Fields Min/Max outcomes;
- fixed declaration constraints.

They should remain direct lookups. Session indexes remove repeated array scans
without changing their semantics.

### Prepared Decision Evaluation

Ordinary room targets and concrete reward alternatives share one exact
pre-decision context.

For a room-target domain, the session prepares:

- source room and physical exit;
- addressed target-generation history view;
- room creation and appearance ledgers;
- force and requirement facts;
- the applicable staged or ordinary declaration pool;
- reward history needed by room eligibility.

Every candidate room is then evaluated against that same context. The engine
does not rebuild target-generation maps or relocate the semantic owner for each
game name.

For a reward domain, the session prepares the producer frontier described
below. Every complete offer is evaluated from the same frontier.

### Scoped Region Replay

Some changes alter more than one local support calculation:

- O encounter count and reward-wheel settings alter a room-local lifecycle;
- a shop offer participates in one joint inventory;
- a shop purchase participates in ordered purchase application;
- N membership, visits, and side-room state alter joint-board, visit, or
  parent-local regions;
- some biome fields genuinely change a broad biome suffix.

These candidates replay the smallest declared semantic region that contains
their effect. A full addressed-biome replay may remain temporarily for small,
genuinely broad domains, but it is not the default implementation for every
candidate value.

## Reward Producer Frontiers

Reward candidates are the first and highest-value conversion to the new model.

Selected reward simulation already holds the necessary state while walking the
room lifecycle. At every covered reward producer it must retain a typed
pre-decision frontier containing enough state to rerun that producer:

- every reachable latent reward branch;
- counted bags and reward history;
- lifecycle and history sequence;
- semantic producer and offer owner;
- resolved store and declaration binding;
- sibling offers with their semantic origins;
- sequential or jointly unordered generation policy;
- room, lifecycle, and generation facts used at resolution;
- shop, wheel, cage, side-room, or incoming-reward policy as applicable.

These frontiers are selected-simulation facts, not candidate arrays. Capturing
frozen branch references during the normal reward walk is preferred to
replaying history later to rediscover them.

The frontier must be captured before processing the selected offer or atomic
offer group. This preserves repair support when the selected value is invalid
and would otherwise collapse the reachable branch set.

Candidate evaluation substitutes one proposed complete offer into the producer
and invokes the existing reward authorities:

- sequential producers include the effects and peer exclusions of earlier
  siblings;
- jointly unordered producers reevaluate the complete sibling group and every
  supported generation order required by policy;
- counted rewards preserve every reachable bag transition;
- support is existential over reachable latent branches, never probabilistic;
- Boon sources and complete Devotion pairs use the ordinary source rules;
- shop inventory candidates use the joint inventory authority;
- Q shared-store shop slots retain no-duplicate behavior;
- selected-invalid candidates retain exact bag, peer, source, payload,
  acquisition, or shop findings.

The application may aggregate complete offer results into reward-type,
Boon-source, and Devotion-source steps. It does not implement reward support.

## Replay Horizons

Each candidate family has an explicit semantic horizon:

| Candidate family              | Required horizon                                           |
| ----------------------------- | ---------------------------------------------------------- |
| Start room                    | Declaration-owned start domain                             |
| Room target                   | Target generation support                                  |
| Batch reward store            | Pre-generation store support                               |
| Incoming or local reward      | Offer generation and its own entered acquisition lifecycle |
| Sequential sibling reward     | Earlier sibling generation plus the addressed offer        |
| Joint unordered rewards       | Complete atomic sibling generation region                  |
| Shop offer                    | Complete joint inventory generation                        |
| Shop purchase                 | Ordered purchase application                               |
| Fields Min/Max                | Pre-outcome support ledger                                 |
| O encounter or wheel setting  | Addressed occurrence lifecycle region                      |
| Hub membership                | Joint open-board constraint region                         |
| Hub visit                     | Addressed visit region                                     |
| Side-room generation or entry | Parent-local side-room region                              |
| Broad biome field             | Smallest biome suffix whose rules consume the field        |

A candidate does not become impossible merely because retained downstream
authorship would require later repair. Room replacement, structural capacity,
and downstream eligibility remain separate semantic effects. Validators beyond
the candidate horizon run only when the candidate family depends on them.

## Application and React Boundary

The application receives the current atomic project/evaluation pair and creates
or retrieves its candidate session:

```text
Redux authored project + published evaluation
  -> project-bound candidate projection session
  -> contextual option and picker projection
  -> structured workspace lazy resolver
  -> React interaction
```

The candidate projection should not hide evaluation acquisition behind a
general `evaluateProject(project)` callback. Passing the exact published
evaluation makes identity, ownership, and invalidation explicit.

The structured workspace is the intended React contact. It already carries
semantic control descriptors and resolves room and reward interaction models
only when the focused inspector requests them. React should not directly walk
topology or request candidate domains for every rendered control.

Until structured-workspace consumption replaces the current editor, existing
React controls may remain compatibility consumers. They must not become a
second candidate authority.

## Delivery Boundary

The candidate refactor lands before Phase 7 Commit 11 resumes.
`../progress/IMPLEMENTATION_PLAN.md` owns its numbered delivery slices and
acceptance gates.

The complete refactor must establish:

- one project/evaluation-bound candidate session;
- one prepared context per contacted semantic owner;
- domain-shaped room and reward evaluation;
- scoped room-local and Hub region replay;
- structured-workspace ownership of lazy React candidate contact;
- measured removal of ordinary reward-domain biome replay.

## Non-Goals

This refactor does not:

- add incremental Redux simulation across authored project identities;
- cache candidate evidence across semantic edits;
- move simulation rules into React or application presentation code;
- place candidate arrays or UI grouping in canonical history;
- introduce probability, ranking, or likely-route guidance;
- automatically repair retained downstream authorship;
- add a Web Worker merely to conceal repeated biome simulation.

A worker remains a later delivery option if the corrected owner-domain
algorithm still exceeds the interaction budget.
