# Batch Authoring Defaults Audit

## Purpose

This audit decides which biome- and batch-owned values may be initialized by
the application and which values must begin unspecified until the user authors
them.

The audit is intentionally narrower than room-state defaults. A selected room
occurrence may still create a complete declaration-owned leaf state and later
replace its values. This document covers the structural decision that offers
rooms together and the biome-global inputs that govern those decisions.

The game-rule documents and normalized declarations remain the authorities for
what each value means. This audit owns the cross-biome authoring policy.

## Locked Authoring Principle

A declaration default is valid only when the declaration describes a canonical
fact, not merely the first convenient value in a valid domain.

The authored lifecycle is therefore:

```text
structural or generated outcome
  unspecified -> explicitly specified -> replaced or structurally removed

fixed or derived fact
  declared/derived -> never separately authored

room-local leaf value
  declaration default -> replaced
```

The application must not silently turn a random or user-observed game outcome
into authored intent. Candidate support may prove that only one value is
currently possible, but that still does not authorize an edit. The UI may mark
the value as required or forced; the user must select it explicitly.

This principle is about semantic ownership rather than nulls everywhere. A
fixed `none` store, a source-derived store, a fixed batch count, or a staged
candidate pool is already fully known and should remain concrete policy.

## Classification

Every batch-adjacent value belongs to one of four classes.

### Required Authored Outcome

The value represents a game outcome or simulation input selected from multiple
possibilities. It starts unspecified, owns a semantic address, blocks dependent
evaluation until selected, and is replaceable without deleting the decision.

### Sparse Authored Structure

Absence is the truthful initial topology. The user adds members or order
references explicitly. Empty does not masquerade as a concrete game outcome.

### Fixed Policy

The declaration completely determines the value. There is no authored control
and no persisted choice.

### Derived Policy

The value is computed from already-authored source state and history. There is
no competing authored copy.

## Current Cross-Biome Inventory

| Owner/value                      | Biomes                             | Current initialization                        | Correct class             | Disposition              |
| -------------------------------- | ---------------------------------- | --------------------------------------------- | ------------------------- | ------------------------ |
| Ordinary target slots            | Linear biomes                      | empty targets                                 | Sparse authored structure | Keep                     |
| Picked exit                      | Linear biomes                      | `null`                                        | Sparse authored structure | Keep                     |
| Generated base reward pool       | F/G/P and non-ShipCombat O sources | `RunProgress`                                 | Required authored outcome | Remove the default       |
| ShipCombat outgoing reward pool  | O                                  | final active wheel                            | Derived policy            | Keep source derivation   |
| No generated base reward pool    | H/I/Q and N Hub                    | `none`                                        | Fixed policy              | Keep                     |
| Fields door-roll outcome         | H ordinary batches                 | `min`                                         | Required authored outcome | Remove the default       |
| Clockwork Goal/NonGoal role      | I targets                          | derived from offer order and history          | Derived policy            | Keep                     |
| Clockwork non-goal cap           | I biome state                      | `3`                                           | Required authored outcome | Remove the default       |
| Standard batch policy            | F/G/O/P/Q                          | no batch state                                | Fixed policy              | Keep                     |
| Fixed batch count                | H/O                                | declaration count                             | Fixed policy              | Keep                     |
| Staged progression               | Q                                  | declaration stages                            | Fixed policy              | Keep                     |
| Hub open-board membership        | N                                  | empty open set                                | Sparse authored structure | Keep                     |
| Hub visit order                  | N                                  | empty sequence                                | Sparse authored structure | Keep                     |
| Hub open count and visit count   | N                                  | declaration bounds                            | Fixed policy              | Keep                     |
| Forked-preboss free-reward store | F/G/H/P                            | forced RunProgress on the preboss declaration | Fixed room policy         | Keep outside batch state |
| Direct-terminal generated pool   | O after a non-ShipCombat source    | silently `RunProgress`                        | Required authored outcome | Expose and require it    |
| Direct-terminal generated pool   | O after ShipCombat                 | final active wheel                            | Derived policy            | Keep source derivation   |
| Direct-terminal pool             | Q                                  | `none`                                        | Fixed policy              | Keep                     |

No audited random batch outcome has a semantically safe declaration default.
The current three default families—RunProgress, Fields Min, and Clockwork cap
3—are convenience defaults rather than game facts.

## Implementation Authority

The corrected authority is centralized rather than incidental UI behavior:

- generated authored-base-store declarations own only the allowed store
  domain and ratio rules, not an initial store;
- the H Fields field and I Clockwork field use declaration initialization
  `{ kind: 'required' }`;
- `packages/planner-engine/src/authored-project/commands/topology-linear.ts`
  creates authored store and Fields state as explicitly unresolved;
- `packages/planner-engine/src/authored-project/biomeState.ts` creates required
  biome fields as explicitly unresolved while preserving genuine declaration
  defaults;
- `packages/planner-engine/src/authored-project/commands/topology-hub.ts`
  creates N with empty `openTargets` and `visitOrder`;
- the project codec owns schema 8 and rejects schema 7 rather than guessing at
  migration intent.

The correction must therefore be an authored-model authority switch. Adding
placeholder `<option>` elements only in React would leave commands, codecs,
simulation, and profiles authoring the old values.

## Biome Findings

### F, G, and P

Every ordinary batch owns a RunProgress-or-MetaProgress generated-store
outcome. The ratio and force simulation determine the supported set; the user
authors the concrete observed possibility.

`RunProgress` is not a neutral value. F provides the clearest counterexample:
the first ordinary batch after the opening has forced MetaProgress support.
Creating that batch as RunProgress authors a known-invalid outcome before the
user has acted.

The correct creation state is an authored-base-store policy with no selected
store. Room candidates and incoming reward editing depend on resolving that
selection first.

The forked preboss is different. Its free-reward binding and preboss
declaration force RunProgress, so F/G/P do not need another authored terminal
store. H uses the same fixed terminal rule. These are concrete room-entry
policies rather than generated batch outcomes.

### H

Every ordinary Fields batch owns one Min-or-Max door-roll outcome, including
batches whose targets make the active cage count look identical. Max can still
advance `fieldsMaxDoorsRolled` and affect later support.

`min` is therefore not a default. It is one possible game result. A new H batch
must expose an unresolved Fields outcome before target authoring. The
declaration continues to own the ordered domain, cage-count rules, support
formula, and ceiling.

The omitted terminal-only cage roll remains omitted. This audit does not create
an authored terminal Fields value that has no supported downstream observer.

### I

`maxNonGoalRewards` is the single `RandomInt(3, 6)` result established by the
intro lifecycle. It is a biome-global simulation input rather than a per-batch
field, but it governs every later Clockwork candidate context and belongs in
this audit.

The value `3` is not canonical. The user must select one of 3, 4, 5, or 6 after
choosing the intro and before the first Clockwork continuation can be assessed.
Goal versus NonGoal remains derived and must not become another authored
choice.

### O

O has two outgoing-store paths:

- ShipCombat derives the next generated store from its final active wheel;
- every other supported source uses an authored RunProgress-or-MetaProgress
  batch outcome.

These are mutually exclusive policies selected by the source encounter
profile. A source-derived batch must not persist an authored fallback.

The same rule applies to O's direct preboss transition. The preboss's resolved
incoming store remains entered-store ratio provenance even though the room is
a WorldShop. When the predecessor is not ShipCombat, the transition therefore
needs an explicit RunProgress/MetaProgress outcome. When the predecessor is
ShipCombat, the value is derived.

Under the current O declaration set, every valid sixth target is ShipCombat:
non-ShipCombat candidates end by biome depth 5. The valid direct-terminal path
is therefore source-derived today. The generic transition resolver still
retains the authored-store variant for structurally representable,
context-invalid room replacements; candidate evaluation must report the
earlier invalid frontier rather than pretending that such a replacement makes
the authored store reachable.

Before schema 8, production created the former as RunProgress while the
workspace and terminal editor indexed only ordinary `batch` continuations.
That made the preboss store a hidden authored default. The corrected model
gives applicable terminal transitions the same required store interaction as
ordinary batches rather than inventing a terminal-only default.

### Q

Q stages, physical candidate pools, and direct terminal order are
declaration-fixed. Its generated-store policy is `none`; target reward behavior
comes from concrete room declarations. There is no batch outcome to initialize.

### N

N does not need scalar batch defaults. Creating its topology materializes the
fixed Opening, PreHub, and PreBoss occurrences, then leaves `openTargets` and
`visitOrder` empty. Opening a Hub slot and appending a visit are explicit
structural edits.

Closed slots are not silently authored game outcomes. They are absence from a
sparse open-board set whose declared completeness rule requires 9 or 10 open
slots and six visits. This is already the correct topology lifecycle.

Room-local Ephyra reward and side-room defaults remain outside this audit.

## Required Editing Order

New decisions should remain structurally real while their required batch value
is unresolved. The common order is:

```text
create decision
  -> select required batch/biome outcome, when one exists
  -> evaluate target candidates from that resolved context
  -> author targets
  -> select the picked target
```

Concretely:

- F/G/P and non-ShipCombat O ask for Reward pool before room candidates;
- ShipCombat O skips that control because its source wheel supplies the pool;
- H asks for Fields door roll before room candidates;
- I asks for the intro roll before the first Clockwork decision;
- Q and N have no equivalent scalar choice.

A missing required value is an incomplete authoring frontier, not an invalid
simulation result. Dependent candidate interactions should explain the missing
prerequisite instead of evaluating against a fabricated default.

The UI may streamline a forced choice, but it must still preserve one explicit
user command and one undo entry. Auto-selecting the sole currently supported
value would reintroduce authored defaults through candidate evaluation.

## Model Consequences

The implementation should preserve policy identity while allowing an authored
value to be absent:

- an `authoredBaseStore` state remains that policy kind but permits no selected
  `baseRewardStoreKey`;
- Fields policy remains declaration-owned while the continuation's authored
  Fields state may be unresolved;
- authored biome fields distinguish required unresolved values from concrete
  values without using an arbitrary member as initialization;
- fixed `none` and derived `sourceOfferPoint` stores remain concrete closed
  variants.

Exact-key codecs are preferable to optional persistence keys. A stable
`null`-like unresolved value makes the schema explicit and produces predictable
profile diffs. The catalog should state whether an authored field is required
or genuinely defaulted; option ordering must never supply that authority.

Completeness, progressive coverage, candidate evaluation, command validation,
workspace interaction indexing, and React controls must all consume the same
unresolved state. No layer may recover the old default independently.

Existing schema-7 profiles already contain concrete values, but schema 8 is an
intentional clean authority reset. The codec strictly rejects schema 7. There
is no migration or reinterpretation path and no legacy compatibility branch in
production.

## Scope Boundary

This audit does not change room-local leaf initialization. Counted rewards,
shop inventories, ShipCombat wheels, Fields cage rewards, Devotion roles,
Ephyra side rooms, and other occurrence-owned surfaces have separate
declaration defaults and replacement lifecycles.

It also does not decide which room state survives a room replacement. That
requires the separate role/category compatibility matrix already identified
for the next audit.

Confirmation dialogs remain deferred. Unresolved required values should be
ordinary visible editor state, not warnings about user intent.

## Implementation Slices

### Slice 1 — Schema and declaration authority

- represent unresolved authored batch and biome values explicitly;
- remove `defaultStoreKey` from generated authored-base-store policies;
- mark required authored fields without assigning a domain member as default;
- bump the project schema to 8 and strictly reject schema 7;
- retain room-local offer-point defaults unchanged.

### Slice 2 — Commands and completeness

- create new decisions with unresolved required values;
- add or adapt semantic replace commands so the first explicit selection and
  later replacements use one authority;
- classify missing batch values as incomplete at their semantic owner;
- prevent materialization from consuming unresolved state.

### Slice 3 — Progressive and candidate evaluation

- stop prefix evaluation at the first unresolved prerequisite;
- publish typed prerequisite evidence for dependent room/reward candidates;
- keep fixed and derived policies immediately evaluable;
- cover O ordinary and direct-terminal source overrides from the same policy
  resolver.

### Slice 4 — Workspace and editor

- index required interactions even before they have a selected value;
- render explicit placeholder states for Reward pool, Fields door roll, and
  the Clockwork cap;
- expose O's applicable direct-terminal reward-pool interaction;
- keep one explicit selection equal to one semantic command and undo step.

### Slice 5 — Reconciliation and regression coverage

- update the authored-project, editor, contextual-UX, biome, and progress docs
  to remove the old explicit-default contract;
- test new-project creation, the chosen profile schema transition, replacement,
  undo/redo, progressive blocking, candidate prerequisites, and terminal store
  handling;
- verify that N, Q, source-derived O, and room-local defaults remain unchanged.

## Closure Criteria

This audit is implemented only when:

1. no batch or biome-wide random outcome is authored before user action;
2. fixed and derived facts still require no redundant control;
3. dependent candidates never evaluate against a placeholder;
4. O's direct terminal has no hidden authored store;
5. the schema transition is explicit and schema 7 is rejected without
   migration;
6. leaf controls retain their established default-and-replace lifecycle.
