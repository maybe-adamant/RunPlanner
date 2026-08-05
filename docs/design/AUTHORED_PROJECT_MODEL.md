# Authored Project Model

## Purpose

This document defines the durable user-authored planner state: project and route
scope, biome topology, occurrence-local state, semantic addresses, commands,
persistence, and history. Simulation algorithms, candidates, Redux state, and
React rendering are separate concerns.

## Schema 12 Boundary

Schema 12 is the sole persisted authored-project contract. The codec rejects
schema 11 and earlier documents rather than manufacturing N's normalized PreHub
decision, terminal Hub envelope, source-bearing Hub, or concrete room-local
encounter selections for a stale document. There is no migration path; catalog
versions must match exactly.

There is one biome plan and one topology language. Production state and
semantic addresses have no layout-specific plan family, completion-transition
decision, fixed-entry slot, continuation, or picked contract.

### Superseded vocabulary

Historical delivery records may refer to `LinearBiome`, `HubBiome`, terminal
transitions, fixed-entry slots, continuations, or picked contracts. Those names
identify the pre-unified migration state only; they are not current persisted
or semantic contracts. [`MIGRATION_PROVENANCE.md`](../progress/MIGRATION_PROVENANCE.md)
retains that evidence.

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
owns kind, authored or derived mode, exits, requirements, force, caps, an
Encounter Envelope with exact slot bindings, incoming reward binding,
local-child descriptors, and complete declaration defaults.

`Room Occurrence` is one repeatable persisted appearance of a declaration in
one biome. It owns an opaque `occurrenceId`, selected `gameName`, and complete
occurrence-local room state. Several occurrences may use the same declaration.

`Exit Decision` owns one ordinary next-room source, its normal-door batch, and
the selection among its normal exits.

`Normal-door batch` owns batch reward-store state, batch-specific state such
as H cage outcome, and target references. Its target keys are declaration-owned
physical or semantic exit keys, never rendered indexes.

`Hub Decision` owns N's persistent board: fixed-slot open references, ordered
visits, and completion predicate. It does not own N Preboss room-local state.

`Preboss` is a Room Declaration role inside a normal-door batch, not a
separate decision variant. Offering it does not complete a biome; selecting it
does. Boss and optional Postboss rooms are catalog-derived completion tail
rooms, not authored decisions or occurrences.

Topology owns occurrence relationships and decisions. Room state owns rewards,
Shop inventory and exact purchase order when materialized, exact concrete
encounter selections, wheels, cages, and side-room state. UI state owns no
domain topology.

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
  | { kind: 'derived' }
  | { kind: 'unresolved' }
  | { kind: 'normal'; exitKey: string }
  | { kind: 'additional'; additionalExitKey: string };

type AdditionalExit = {
  kind: 'zagreusContract';
  key: 'zagreusContract';
  occurrenceId: OccurrenceId;
};

interface ExitDecision {
  kind: 'exit';
  source: ExitDecisionSource;
  normal: NormalDoorBatch;
  additional: readonly AdditionalExit[];
  selection: ExitSelection;
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
  source: { kind: 'occurrence'; occurrenceId: OccurrenceId };
  openTargets: readonly HubTargetReference[];
  visitOrder: readonly string[];
}
```

An `ExitDecision` has at most one semantic source. Occurrence-sourced batches
belong to a layout's normal-decision policy, including N's bounded entry;
Hub-sourced batches belong only to N's completed-Hub Preboss handoff.

Selection belongs to the enclosing decision: a width-one normal-only batch uses
`derived`; a multi-target or sibling-additional decision may be `unresolved`;
`normal` selects one declared normal target; and `additional` selects one
closed sibling continuation. The only supported additional exit is a declared
Zagreus contract beside a Midshop's normal lane. It is never a synthetic normal
target or a generic cross-room-set escape hatch.

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

### Empty decision envelopes

An occurrence-sourced normal batch with zero targets is an authored,
uncommitted decision envelope. It has a stable decision address, remains on
the selected spine, may retain declaration-owned ordinary setup (such as a
reward-pool choice or H's Fields result), and is removable and undoable. It
does not add a persisted mode, discriminator, or schema variant.

The envelope is not a realized ordinary generated batch. It consumes neither
ordinary batch/target progression nor a staged ordinal until its first
ordinary target is created. `CreateBatch` can create the next envelope while
an ordinary slot remains. At the ordinary bound it can create one further
empty envelope only when the selected source and layout admit a declared
terminal resolution. F/G/H/O/P/Q admit a takeover Preboss; N admits its
required Hub takeover after the bounded PreHub stage; I admits neither because
its Preboss is an ordinary retained peer. These exceptions belong to
declaration-derived topology rules rather than the empty shape itself.

The supported Zagreus command may atomically create a selected Midshop's empty
normal envelope with its closed additional contract sibling. That incomplete
normal lane remains authored and finding-backed until ordinary targets are
added; the additional exit neither consumes nor repairs normal progression.

The first Door 1 choice resolves the envelope. An ordinary or
`retainNormalPeers` choice realizes an ordinary batch and must satisfy the
ordinary bounds at that point. A `takeOverNormalDoors` Preboss replaces the
empty envelope with its atomic batch, discarding ordinary-only setup and
initializing declaration-owned Preboss defaults. Undo restores the exact
empty envelope and any provisional setup; a takeover batch never consumes an
ordinary progression slot.

Takeover Preboss declarations F/G/H/O/P/Q own an atomic batch policy. A
takeover command receives one occurrence ID for every declared normal exit and
creates or repairs the whole batch in declaration order. The first target is a
Shop leaf; later targets are counted-free leaves only when the policy declares
them. A width-one policy has no later offer. Individual takeover targets are
not room-replaceable or capacity-repairable.

Selecting a Preboss derives completion. There is no persisted completion flag,
entry mode, or `closesBiomeWhenPicked` duplicate. The selected Preboss's
ordinary peers remain real unpicked occurrences.

## N Hub Progression

N is authored progressively:

```text
N_Opening01
  -> width-one normal exit prehub -> N_PreHub01
  -> exact empty terminal envelope
  -> source-bearing Hub decision hub
  -> completed-Hub exit preboss -> width-one N_PreBoss01 batch
  -> derived Boss and Postboss completion
```

The catalog bounds N's normal entry to one `prehub` physical exit and one
staged `N_PreHub01` target at biome depth 1. After PreHub reaches depth 2,
`CreateBatch` may create the exact zero-target terminal envelope.
`ReplaceWithHubDecision` atomically replaces that envelope with a Hub carrying
the PreHub occurrence as its source; `RemoveHubDecision` removes Hub-owned
state and restores the exact envelope. The Hub declaration owns the fixed
physical slot-to-room mapping, opening bounds and constraints, six distinct
ordered visits, side-room policy, restores, and the dedicated completed-Hub
handoff. An open slot creates one occurrence; its room identity is not
replaceable. Open unvisited slots remain real offered leaves.

The completed-Hub batch is permitted only after the declared open-set and
six-visit predicate holds. Its source is `{ kind: 'hubDecision', decisionKey: 'hub' }`, not
a rendered visit index or synthetic N completion owner.

Closing an unvisited slot below the declared open-set minimum retains the
already-authored visit sequence as an incomplete Hub board, but atomically
removes the completed-Hub batch and every descendant it owns. The handoff may
be authored again only after the board is restored to its completion predicate.

## Occurrence State and Replacement

Every occurrence begins with complete declaration-owned offer-time defaults and
complete static selections for each of its declaration's pool-backed potential
encounter slots. Fixed slots and slots in an empty Encounter Envelope carry no
redundant authored selection.
Shop inventory is entry-time state: selecting a Shop occurrence materializes
it; changing selection removes unselected inventory. Its materialized state
owns declaration-keyed offers and one exact `purchaseOrder`; membership and
ordinal derive only from that list. A counted-free Preboss
keeps its complete resolved offer regardless of selection.

`ReplaceOccurrenceRoom` preserves occurrence identity and reconciles only
declaration-compatible leaves. It never moves state to another occurrence or
guesses a reward. It resets incompatible state to complete defaults and cannot
bypass a staged candidate pool, fixed start/Hub identity, or atomic takeover
rule.

Route detours use narrower commands than general room replacement. An Anomaly
retains one normal G target occurrence identity, remembers its displaced G
declaration, and owns its retained incoming offer plus success state. A
Zagreus contract owns one `C_Boss01` occurrence as a declared additional exit.
Anomaly replacements and the Zagreus contract are the only declared detour
ownership forms admitted by decoded topology; each has one declaration-owned
automatic hidden host return that remains a normal host target and batch for
accounting.

Room-local commands address an occurrence and declaration-owned leaf key.
They cover incoming rewards, Fields cages, Ship encounter counts and wheels,
Ephyra side-room generation/order/rewards, and Shop offers/purchase order. Leaf
edits do not rewrite topology.

### Concrete Encounter Selections

`RoomOccurrence.encounters.encounterKeyByPhase` persists the exact normalized
Encounter Definition key for every pool-backed potential slot of that room's
envelope. A parent-local N side room keeps the corresponding map on its own
`EphyraSideRoomState.encounters`; it remains a local child, never an
independent Room Occurrence or global topology entry. The map does not store
an Encounter Set key, category sentinel, NPC family, or rendered phase ordinal.

Potential selections remain with their owning room through unpick/repick,
side-room generation and entry-order changes, optional-slot trimming, Undo,
and Redo. A structurally dormant slot emits no active control, candidate,
finding, history, counter, phase-owned reward effect, or NPC index row, but its
selection remains ready for reactivation. Replacing a declaration reconciles
only compatible stable phase keys and gives newly introduced or incompatible
slots their declaration defaults. Deleting an occurrence deletes its owned
selections and nested local-child state together.

An active retained selection may become context-invalid after a different
semantic edit. It remains persisted and repairable; the authored model never
falls back to another definition. `SelectEncounter` accepts an exact eligible
candidate at one active `EncounterPhaseAddress`. `ResetEncounter` restores the
set's static declared default even when that default is currently invalid; it
is a reset, not an automatic repair.

## Semantic Addresses

Addresses are immutable discriminated values. `semanticAddressKey` is a
canonical projection for maps and markers, not another identity source.

| Owner                             | Address                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------- |
| start and occurrence-local leaves | `OccurrenceAddress`                                                               |
| room-sourced decision             | `ExitDecisionAddress` with occurrence source                                      |
| N handoff decision                | `ExitDecisionAddress` with Hub source                                             |
| normal target                     | `TargetAddress` with source and exit key                                          |
| additional continuation           | `AdditionalExitAddress` with source and declared additional-exit key              |
| decision selection                | `ExitSelectionAddress` with source                                                |
| batch reward store                | `BatchRewardStoreAddress` with source                                             |
| Hub board                         | `HubDecisionAddress`                                                              |
| Hub slot and visit                | `HubSlotAddress` and `HubVisitAddress`                                            |
| local child/reward and wheel      | occurrence plus declaration-owned child key                                       |
| pool-backed encounter phase       | `EncounterPhaseAddress` with occurrence or local-child owner and stable phase key |
| derived completion                | `CompletionRoomAddress`                                                           |

`ContinuationAddress`, `PickedAddress`, fixed-entry addresses, parent-only
batch-store identity, and rendered target indexes are not schema-13 addresses.

## Commands

Commands are semantic immutable transitions. Every successful proposal passes
through the project decoder before publication. A structural failure reports
its semantic owner and never leaves partial topology.

The command language includes project and route commands; start, batch, target,
takeover, selection, removal, and clear-topology commands; terminal Hub
replacement, Hub board and visit commands; and occurrence-local state
commands including `SelectEncounter` and `ResetEncounter`, plus the closed
Anomaly and Zagreus detour commands. The current union is defined by
`packages/planner-engine/src/authored-project/commands/types.ts`.

`RemoveExitDecision` explicitly removes its targets and downstream selected
subtree. Removing N's Opening decision therefore removes PreHub, its
source-bearing Hub, and any completed-Hub batch through persisted ownership.
Navigation and focus are not commands and do not enter authored history.

## Persistence and Validation

The portable document has exact keys, canonical catalog route order, and
stable indented JSON with a trailing newline:

```ts
interface ProjectDocument {
  schemaVersion: 13;
  projectId: string;
  name: string;
  catalogVersion: string;
  routes: readonly AuthoredRoutePlan[];
}
```

Unknown fields, malformed discriminants, wrong schema or catalog versions,
unauthorized cross-biome rooms, invalid leaf state, and malformed structural
ownership fail at decode contact. The codec preserves structurally representable incomplete
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
create a separate completion or layout-specific biome-plan family.
