# Authored Project Model

## Purpose

This document defines the durable user-authored planner state: project and route
scope, biome topology, occurrence-local state, semantic addresses, commands,
persistence, and history. Simulation algorithms, candidates, Redux state, and
React rendering are separate concerns.

## Schema 9 Boundary

Schema 9 is the sole persisted authored-project contract. The codec rejects
schema 8 and earlier documents rather than inventing unified decisions, N Hub
state, or a Preboss selection for a stale document. Catalog versions must match
exactly.

There is one biome plan and one topology language. The old `LinearBiome`,
`HubBiome`, terminal-transition, fixed-entry-slot, continuation, and picked
contracts are absent from production state and semantic addresses.

```ts
interface AuthoredBiomePlan {
  biomeKey: string;
  state: AuthoredBiomeState;
  topology: BiomeTopology | null;
}

interface BiomeTopology {
  startOccurrenceId: OccurrenceId;
  occurrences: readonly RoomOccurrence[];
  decisions: readonly NextRoomDecision[];
}

type NextRoomDecision = ExitDecision | HubDecision;
```

`topology: null` is the only representation of a configured biome whose start
has not been authored. A non-null topology always has a real authored start;
it never uses a null start ID or a positional synthetic parent.

## Separation of Models

```text
ProjectDocument    durable, possibly incomplete authored intent
ProjectEvaluation  replaceable pure simulation output for one document
EditorSession      transient navigation, focus, search, and expansion state
```

Only `ProjectDocument` is persisted. Simulation output, findings, candidate
lists, canvas positions, selected tabs, and history controls do not enter it.

## Core Terms and Ownership

`Room Declaration` is an immutable catalog fact keyed by game room name. It
owns kind, authored or derived mode, exits, requirements, force, caps,
encounter profile, incoming reward binding, local-child descriptors, and
complete declaration defaults.

`Room Occurrence` is one repeatable persisted appearance of a declaration in
one biome. It owns an opaque `occurrenceId`, selected `gameName`, and complete
occurrence-local room state. Several occurrences may use the same declaration.

`Exit Decision` owns one ordinary next-room source, its linked normal exit or
normal-door batch, and the selection among its normal exits.

`Normal-door batch` owns batch reward-store state, batch-specific state such
as H cage outcome, and target references. Its target keys are declaration-owned
physical or semantic exit keys, never rendered indexes.

`Hub Decision` owns N's persistent board: fixed-slot open references, ordered
visits, and completion predicate. It does not own N Preboss room-local state.

`Preboss` is a Room Declaration role inside a normal-door batch. It is not a
terminal decision variant. Offering it does not complete a biome; selecting it
does. Boss and optional Postboss rooms are catalog-derived completion tail
rooms, not authored decisions or occurrences.

Topology owns occurrence relationships and decisions. Room state owns rewards,
Shop inventory and purchases when materialized, encounter choices, wheels,
cages, and side-room state. UI state owns no domain topology.

## Route Scope

Routes persist a contiguous configured prefix in catalog order. Expansion
creates biome plans with `topology: null`; shrinking explicitly removes the
discarded plans and their state. `ConfigureRoutePrefix` is the only normal
scope-edit command and undo restores the prior snapshot.

```text
Underworld: [] -> [F] -> [F, G] -> [F, G, H] -> [F, G, H, I]
Surface:    [] -> [N] -> [N, O] -> [N, O, P] -> [N, O, P, Q]
```

Configured scope is not a claim that a biome is complete or simulation-valid.

## Common Decision Model

```ts
type ExitDecisionSource =
  { kind: 'occurrence'; occurrenceId: OccurrenceId } | { kind: 'hubDecision'; decisionKey: string };

type ExitSelection =
  { kind: 'derived' } | { kind: 'unresolved' } | { kind: 'normal'; exitKey: string };

interface ExitDecision {
  kind: 'exit';
  source: ExitDecisionSource;
  normal: LinkedNormalExit | NormalDoorBatch;
  selection: ExitSelection;
}

interface LinkedNormalExit {
  kind: 'linked';
  exitKey: string;
  occurrenceId: OccurrenceId;
}

interface NormalDoorBatch {
  kind: 'batch';
  rewardStore: BatchRewardStoreState;
  batchState: AuthoredBatchState;
  targets: readonly ExitTargetReference[];
}

interface HubDecision {
  kind: 'hub';
  hubKey: string;
  openTargets: readonly HubTargetReference[];
  visitOrder: readonly string[];
}
```

An `ExitDecision` has at most one semantic source. A linked normal exit is N's
declaration-fixed Opening-to-PreHub handoff. Occurrence-sourced batches belong
only to generated progression; N's one batch is sourced by the completed Hub.

Selection belongs to the enclosing decision: a linked exit and a width-one
batch use `derived`; a multi-target batch begins `unresolved`; and `normal`
selects one declared target key in a multi-target batch. The codec rejects a
derived selection with other than one target, unresolved or normal selection
for one target, and a normal key outside the batch.

Decision-array order is not reachability authority. Decoding follows semantic
sources and selected targets to determine the selected spine. An unpicked
target is a real dead leaf but cannot own a downstream exit decision. Cycles,
detached decisions, duplicate sources, multiply-owned occurrences, and orphan
occurrences are contract errors.

## Starts, Batches, Preboss, and Completion

The catalog declares either an `authoredChoice` start or a declaration-fixed
`fixedAuthored` start. `CreateStart` requires a selected game name for an
authored choice; it derives the fixed declaration and rejects substitution. F
has an authored Opening choice. G/H/I/O/P/Q have fixed Intros. N has fixed
`N_Opening01`.

Generated batches retain their layout's progression, reward-store, and
batch-state contracts. Q's candidate pools are checked on the selected spine,
not decision-array position. H's Fields result remains batch-owned. O can
derive a reward store from the active Ship wheel. I remains a normal Clockwork
batch: `I_PreBoss02` may coexist with normal peers but its one-creation-per-
source policy is declaration-owned.

Takeover Preboss declarations F/G/H/O/P/Q own an atomic batch policy. A
takeover command receives one occurrence ID for every declared normal exit and
creates or repairs the whole batch in declaration order. The first target is a
Shop leaf; later targets are counted-free leaves only when the policy declares
them. A width-one policy has no later offer. Individual takeover targets are
not room-replaceable or capacity-repairable.

Selecting a Preboss derives completion. There is no persisted terminal flag,
entry mode, or `closesBiomeWhenPicked` duplicate. The selected Preboss's
ordinary peers remain real unpicked occurrences.

## N Hub Progression

N is authored progressively:

```text
N_Opening01
  -> linked exit prehub -> N_PreHub01
  -> Hub decision hub
  -> completed-Hub exit preboss -> width-one N_PreBoss01 batch
  -> derived Boss and Postboss completion
```

`CreateHubDecision` requires the linked PreHub exit. The Hub declaration owns
the fixed physical slot-to-room mapping, opening bounds and constraints, six
distinct ordered visits, side-room policy, restores, and the dedicated
completed-Hub handoff. An open slot creates one occurrence; its room identity
is not replaceable. Open unvisited slots remain real offered leaves.

The completed-Hub batch is permitted only after the declared open-set and
six-visit predicate holds. Its source is `{ kind: 'hubDecision', decisionKey: 'hub' }`, not
a rendered visit index or synthetic N terminal owner.

## Occurrence State and Replacement

Every occurrence begins with complete declaration-owned offer-time defaults.
Shop inventory is entry-time state: selecting a Shop occurrence materializes
it; changing selection removes unselected inventory. A counted-free Preboss
keeps its complete resolved offer regardless of selection.

`ReplaceOccurrenceRoom` preserves occurrence identity and reconciles only
declaration-compatible leaves. It never moves state to another occurrence or
guesses a reward. It resets incompatible state to complete defaults and cannot
bypass a staged candidate pool, fixed start/linked/Hub identity, or atomic
takeover rule.

Room-local commands address an occurrence and declaration-owned leaf key.
They cover incoming rewards, Fields cages, Ship encounter counts and wheels,
Ephyra side-room generation/order/rewards, and Shop offers/purchases. Leaf
edits do not rewrite topology.

## Semantic Addresses

Addresses are immutable discriminated values. `semanticAddressKey` is a
canonical projection for maps and markers, not another identity source.

| Owner                             | Address                                      |
| --------------------------------- | -------------------------------------------- |
| start and occurrence-local leaves | `OccurrenceAddress`                          |
| room-sourced decision             | `ExitDecisionAddress` with occurrence source |
| N handoff decision                | `ExitDecisionAddress` with Hub source        |
| normal target                     | `TargetAddress` with source and exit key     |
| decision selection                | `ExitSelectionAddress` with source           |
| batch reward store                | `BatchRewardStoreAddress` with source        |
| Hub board                         | `HubDecisionAddress`                         |
| Hub slot and visit                | `HubSlotAddress` and `HubVisitAddress`       |
| local child/reward and wheel      | occurrence plus declaration-owned child key  |
| derived completion                | `CompletionRoomAddress`                      |

`ContinuationAddress`, `PickedAddress`, fixed-entry addresses, parent-only
batch-store identity, and rendered target indexes are not schema-9 addresses.

## Commands

Commands are semantic immutable transitions. Every successful proposal passes
through the project decoder before publication. A structural failure reports
its semantic owner and never leaves partial topology.

The command language includes project and route commands; start, linked-exit,
batch, target, takeover, selection, removal, and clear-topology commands; Hub
board and visit commands; and occurrence-local state commands. The current
union is defined by `packages/planner-engine/src/authored-project/commands/types.ts`.

`RemoveExitDecision` explicitly removes its targets and downstream selected
subtree. Removing N's linked Opening exit also removes the Hub board and any
completed-Hub batch. Navigation and focus are not commands and do not enter
authored history.

## Persistence and Validation

The portable document has exact keys, canonical catalog route order, and
stable indented JSON with a trailing newline:

```ts
interface ProjectDocument {
  schemaVersion: 9;
  projectId: string;
  name: string;
  catalogVersion: string;
  routes: readonly AuthoredRoutePlan[];
}
```

Unknown fields, malformed discriminants, wrong schema or catalog versions,
cross-biome rooms, invalid leaf state, and malformed structural ownership fail
at decode contact. The codec preserves structurally representable incomplete
and context-invalid authored choices; simulation findings, not fallback,
describe context invalidity.

Persistence excludes Redux state, editor tabs, graph positions, candidate sets,
findings, simulation output, save baselines, autosave status, and an alternate
profile wrapper.

## Undo and Redo

`ProjectHistory` holds frozen `past`, `present`, and `future` document
snapshots. One effective semantic command creates one history step and clears
redo. A no-op command retains history identity. Undo and redo restore exact
prior snapshots. Derived simulation and transient UI state remain outside this
history.

## Explicit Non-Goals

The authored model contains no Chaos gate, special-exit placeholder,
probability score, RNG seed, game-profile predicate, generic graph edge,
rendered coordinate, React state, ImGui storage, silent repair, or guessed
fallback. Future Chaos support extends the exit-decision envelope; it does not
reintroduce a terminal or biome-plan family.
