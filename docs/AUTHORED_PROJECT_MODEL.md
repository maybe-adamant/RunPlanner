# Authored Project Model

## Purpose

This document defines the app's durable semantic state: project identity,
route and biome composition, authored topology, room-local state, stable
addresses, edit commands, defaults, and persistence rules.

It does not define simulation algorithms or React rendering.

## Core Distinction

The app keeps three models separate:

```text
AuthoredProject   durable user intent, possibly incomplete or invalid
SimulationResult derived interpretation of one authored snapshot
EditorSession    transient navigation and interaction state
```

Only `AuthoredProject` is saved as the project document. A future execution
plan is compiled from a complete valid simulation result and is a separate
export artifact.

## Core Terms

`Project`
: One saved planning workspace containing route plans and project metadata.

`Route Declaration`
: A stable route key and ordered biome-step declarations. The known routes are
Underworld (`F -> G -> H -> I`) and Surface (`N -> O -> P -> Q`).

`Route Plan`
: Authored state for one route. It owns configured prefix scope, route-global
authored inputs, and ordered biome plans.

`Biome Step`
: One occurrence of a biome declaration in one route. Its key includes route
identity, such as `Underworld_F`.

`Biome Layout Declaration`
: Immutable structural metadata selecting a registered layout kind and its
start, continuation, terminal, and bounded topology rules.

`Biome Plan`
: Authored topology and biome-global state for one biome step. It owns
structural relationships and never owns room-local rewards or payloads.

`Room Declaration`
: Immutable verified facts for one game room name: kind, label, template,
eligibility, force, caps, exits, encounter profile, and reward binding.

`Room Occurrence`
: One stable authored occurrence of a declared game room inside a biome plan.
It owns an opaque persisted `occurrenceId`, one current `gameName`, and the
complete room-local state for that selection. Several occurrences may
reference the same Room Declaration.

`Room State`
: Authored leaf values owned by one Room Occurrence. State follows occurrence
identity, not the globally unique game declaration.

`Generated Batch`
: The complete set of room occurrences offered together from a selected
parent occurrence. It owns physical exit association, peer membership, and
picked state.

`Terminal Transition`
: The selected continuation that resolves the predecessor's physical exits
through the biome's terminal policy. It owns ordered terminal target
occurrences, their picked state, and any policy-admitted ordinary companions.
Several terminal targets may reference the same preboss Room Declaration.

`Local Child Slot`
: A bounded room-owned child such as an H cage, O reward wheel, or N side room.
Its identity is the parent occurrence plus a declared slot key.

## Identity

Game room identity and authored occurrence identity are deliberately separate:

```text
gameName    = F_Combat04
occurrenceId = room-01J...
label       = Combat 04
```

The normalized catalog contains one unique Room Declaration for each
`gameName`. The authored project may contain several Room Occurrences with
that same `gameName` when vanilla can generate repeated offers.

An `occurrenceId` is an opaque domain identifier allocated when a structural
command creates an occurrence. It is unique within its biome plan, persisted,
and stable across replacement of the selected `gameName`. It is not derived
from a UI row, game name, exit index, or rendered position. Fixtures may use
readable deterministic IDs; production may use UUID-compatible values.

Repeated game names are structurally representable. Creation caps, appearance
caps, eligibility, force, and structural singleton roles determine their
legality during simulation. The authoring boundary does not rename an
unpicked repeated combat offer to another map.

Stable semantic structural addresses are composed from domain owners:

```text
biome                 routeKey + biomeStepKey
start                 biomeStepKey + start aspect
room occurrence       biomeStepKey + occurrenceId
batch                 biomeStepKey + parent occurrenceId
batch target          biomeStepKey + parent occurrenceId + exitIndex
picked continuation   biomeStepKey + parent occurrenceId + picked aspect
terminal transition   biomeStepKey + predecessor occurrenceId
terminal target       biomeStepKey + predecessor occurrenceId + exitIndex
terminal companion    biomeStepKey + predecessor occurrenceId + exitIndex
room leaf             biomeStepKey + occurrenceId + aspect
local child           biomeStepKey + occurrenceId + localSlotKey + aspect
```

React components may use the persisted occurrence ID as their key. Rendered
rows, array offsets, selector indexes, and graph coordinates are not semantic
identity.

## Route Composition

A route plan authors a contiguous configured prefix:

```text
Underworld: []
Underworld: [F]
Underworld: [F, G]
Underworld: [F, G, H]
Underworld: [F, G, H, I]
```

An empty prefix leaves the route outside the project simulation. A later biome
cannot be configured while an earlier biome is absent.

Configured scope means authored scope. It does not itself claim that the
biome is complete, valid, or ready for future game execution.

## Layout Variants

The initial domain contains two structural languages.

### LinearBiome

A linear biome consists of:

```text
declared start
  -> selected generated batch target
  -> selected generated batch target
  -> ...
  -> terminal transition
```

Every selected parent owns exactly one continuation form:

- a generated batch with one picked target that continues the spine; or
- a terminal transition that closes the biome.

The forms are mutually exclusive. Unpicked batch targets, unpicked terminal
targets, and terminal companions are dead leaves and cannot own downstream
topology.

F/G forked preboss transitions create one terminal target occurrence per
active predecessor exit. Those targets share the same terminal `gameName` but
have distinct occurrence IDs and realization state. The terminal policy
derives the first as Shop and remaining targets as free rewards; picked target
identity replaces the old authored preboss `entryMode`.

F, G, H, I, O, P, and Q use linear structure with registered biome-specific
extensions. O room-internal encounters and I's preboss behavior do not turn
their top-level layout into a generic graph.

I's repeatedly offered `I_PreBoss02` no longer requires a singleton room-
control exception. Distinct authored offers may reference that same Room
Declaration through distinct occurrence IDs. The I implementation slice will
decide the narrow representation of a declined offer versus an entered
terminal occurrence; only the entered occurrence exposes local preboss shop
state.

### HubBiome

N uses a hub layout:

```text
fixed entry sequence
  -> persistent hub batch
      -> ordered pylon visits
      -> derived returns to hub
  -> terminal transition
```

The hub batch and post-visit terminal transition occupy separate structural
roles and may coexist. Repeated returns do not create repeated hub rooms or
cyclic authored links.

## Ownership

### Biome Plan Owns

- layout variant and biome-global authored state;
- start selection where alternatives exist;
- generated batches;
- room-occurrence registry and physical exit target links;
- picked target or visit order;
- terminal-transition presence and predecessor relationship;
- ordered terminal target links, realization roles, and picked target;
- policy-admitted terminal companion links;
- destructive structural commands;
- structural semantic addresses.

Outgoing topology never belongs to the target room state.

### Room State Owns

- concrete incoming reward choice;
- template-specific authored fields;
- room-local encounter choices;
- bounded local child state;
- phase-owned reward offer-point choices;
- shop offers and purchase state;
- realization-specific terminal shop or free-reward state where applicable.

A room occurrence does not know its parent, peers, picked state, or successor.

### Batch Owns

- peer-wide selection or visit order;
- physical generation order;
- batch-wide authored state;
- peer rules that require simultaneous visibility.

Batch behavior is selected by normalized layout context rather than a user-
authored implementation key.

## Sparse Topology and Total Leaves

Topology and active leaves have different lifecycles.

```text
topology slot
  absent -> specified -> replaced
                       -> removed by an explicit owning structural command

active leaf
  declaration default -> replaced -> replaced ...
```

An absent topology slot represents structure that does not exist. Creating a
decision must not silently choose the first eligible room.

Creating a room occurrence installs the selected declaration's complete
deterministic defaults. Replacing its `gameName` preserves `occurrenceId`,
atomically replaces its room state with the new declaration defaults, and
never passes through an empty value.

Leaf edits within the selected declaration then remain concrete replacement
operations.

Defaults compose recursively from their semantic owners:

- a reward primitive owns its payload default;
- a reward bag owns its default primitive;
- a multi-store binding owns its default store and required primitive choice;
- a shop slot owns a default concrete offer;
- a structural wrapper owns a mode default;
- a room template composes these defaults into complete initial room state.

Option order is never default authority.

## Occurrence Lifecycle

Every persisted Room Occurrence is referenced by the biome topology. The app
does not keep a global dormant state record for every Room Declaration.

- Creating a start, ordinary target, terminal target, or companion creates one
  occurrence and its complete default state.
- Replacing the selected game room preserves the occurrence ID and installs
  the replacement declaration's complete defaults.
- Leaf edits replace values inside that occurrence.
- Removing the owning decision or transition removes its no-longer-referenced
  occurrences and their state.
- Undo restores the complete prior authored snapshot.

If later user testing proves that switching away from a room and back should
restore its older leaf values outside undo, that behavior may be introduced as
an explicit project feature. It is not carried forward implicitly from static
Lib control persistence.

## Semantic Commands

UI code dispatches commands rather than mutating project records directly.

Representative linear commands:

```ts
type LinearBiomeCommand =
  | { kind: 'CreateStart'; occurrenceId: OccurrenceId; gameName: GameRoomName }
  | { kind: 'ReplaceOccurrenceRoom'; occurrenceId: OccurrenceId; gameName: GameRoomName }
  | { kind: 'CreateBatch'; parentOccurrenceId: OccurrenceId }
  | {
      kind: 'CreateTarget';
      parentOccurrenceId: OccurrenceId;
      exitIndex: number;
      occurrenceId: OccurrenceId;
      gameName: GameRoomName;
    }
  | { kind: 'SetPicked'; parentOccurrenceId: OccurrenceId; exitIndex: number }
  | { kind: 'ReconcileExitCapacity'; parentOccurrenceId: OccurrenceId }
  | { kind: 'RemoveBatch'; parentOccurrenceId: OccurrenceId }
  | {
      kind: 'CreateTerminalTransition';
      parentOccurrenceId: OccurrenceId;
      targetOccurrenceIds: readonly OccurrenceId[];
    }
  | {
      kind: 'SetTerminalPicked';
      parentOccurrenceId: OccurrenceId;
      exitIndex: number;
    }
  | {
      kind: 'ReconcileTerminalExitCapacity';
      parentOccurrenceId: OccurrenceId;
    }
  | {
      kind: 'CreateTerminalCompanion';
      exitIndex: number;
      occurrenceId: OccurrenceId;
      gameName: GameRoomName;
    }
  | { kind: 'ReplaceWithBatch'; parentOccurrenceId: OccurrenceId }
  | { kind: 'ReplaceWithTerminalTransition'; parentOccurrenceId: OccurrenceId }
  | { kind: 'RemoveTerminalTransition' }
  | { kind: 'ClearTopology' };
```

Representative hub commands:

```ts
type HubBiomeCommand =
  | { kind: 'SetHubDoorCount'; count: number }
  | {
      kind: 'CreateHubTarget';
      doorIndex: number;
      occurrenceId: OccurrenceId;
      gameName: GameRoomName;
    }
  | { kind: 'ReplaceOccurrenceRoom'; occurrenceId: OccurrenceId; gameName: GameRoomName }
  | { kind: 'SetVisitOrder'; doorIndex: number; visitOrder: number }
  | { kind: 'ClearHubTarget'; doorIndex: number }
  | { kind: 'CreateTerminalTransition'; terminalOccurrenceId: OccurrenceId }
  | { kind: 'RemoveTerminalTransition' }
  | { kind: 'ClearTopology' };
```

Representative leaf commands are concrete replacements:

```ts
type RoomCommand =
  | { kind: 'ReplaceIncomingReward'; occurrenceId: OccurrenceId; reward: RewardChoice }
  | {
      kind: 'ReplacePayload';
      occurrenceId: OccurrenceId;
      slotKey: string;
      payload: RewardPayload;
    }
  | {
      kind: 'SetShopPurchase';
      occurrenceId: OccurrenceId;
      offerKey: string;
      purchased: boolean;
    }
  | { kind: 'ReplaceRoomMode'; occurrenceId: OccurrenceId; mode: string }
  | {
      kind: 'ReplaceLocalChild';
      occurrenceId: OccurrenceId;
      slotKey: string;
      value: LocalChildState;
    };
```

Exact unions grow with implemented templates. Their shared rule is that one
command expresses one semantic user intent and validates the complete proposed
replacement before it becomes authored state.

## Downstream Retention Policy

Replacing the game room selected by a start or target preserves that
occurrence's ID, so downstream topology remains attached without changing its
semantic parent. The replacement occurrence receives the new declaration's
complete room-local defaults. Unpicked peer occurrences remain untouched.

Choosing a different picked exit changes the selected parent occurrence. That
command retains downstream topology by re-anchoring its batch or terminal
ownership from the old picked occurrence ID to the new one.

Changing a parent to fewer physical exits does not silently delete overflow
ordinary or terminal targets:

- overflow targets remain visible and structurally unavailable;
- an unavailable picked target retains its continuation;
- the user must explicitly pick an available ordinary or terminal target;
- ordinary picking re-anchors downstream continuation to the available
  occurrence;
- `ReconcileExitCapacity` or `ReconcileTerminalExitCapacity` then removes only
  unavailable target references;
- restoring capacity before reconciliation reactivates retained targets.

Commands must not automatically choose a surviving exit.

These remain intentionally destructive:

- `RemoveBatch` removes that decision and dependent downstream topology;
- `ClearTopology` removes all topology in its scope;
- terminal removal removes its target and companion references;
- incompatible continuation-form replacement clears only topology dependent on
  the previous picked continuation;
- explicit exit-capacity reconciliation removes unavailable occurrences and
  references.

Undo remains the recovery boundary for explicitly deleted occurrences.

## Structural Contact Validation

Every command constructs an unpublished proposal and checks structural
invariants before replacing the authored state:

- every occurrence ID is unique within its biome plan;
- every occurrence references an existing Room Declaration;
- every topology reference resolves to exactly one occurrence;
- no unreferenced occurrence remains in the persisted biome plan;
- exit indexes remain within the layout's bounded storage domain;
- continuation forms remain mutually exclusive where required;
- unpicked dead leaves own no downstream continuation;
- structural roles use compatible room declarations;
- semantic addresses remain unique.

This boundary rejects malformed construction. It does not reject a
structurally representable choice merely because simulation later finds it
ineligible or impossible under game history.

## Project Document

The persisted project is a versioned, human-inspectable JSON document. Its
representative top-level shape is:

```ts
interface ProjectDocument {
  schemaVersion: 1;
  projectId: string;
  name: string;
  catalogVersion: string;
  routes: readonly AuthoredRoutePlan[];
}

interface AuthoredRoutePlan {
  routeKey: string;
  biomes: readonly AuthoredBiomePlan[];
}

interface LinearBiomePlan {
  kind: 'LinearBiome';
  biomeStepKey: string;
  topology: LinearBiomeTopology | null;
}
```

Routes are encoded in normalized catalog order. A route plan's ordered
`biomes` array is its configured-prefix authority, so the document does not
also persist a count or duplicate biome-key list. The decoder accepts route
records in any order and canonicalizes them, while biome plans must already be
the exact contiguous route prefix.

`topology: null` is the complete representation of a configured biome whose
topology has not been started. It does not choose a default opening or create
placeholder Room Occurrences. A non-null topology contains the occurrence
registry and relationships that reference occurrence IDs. Every occurrence
contains its selected `gameName` and complete room-local state. Several
occurrences may reference the same game name; every occurrence ID remains
unique.

The initial persistence slice accepts the null topology form. The non-null
`LinearBiomeTopology` enters the same schema version only alongside the typed
room-state codecs and recursive declaration defaults; generic JSON leaf state
is never an intermediate format.

The precise nested JSON shape should be locked alongside codecs during the
first authored-model implementation phase. It must contain semantic values,
not Redux implementation state.

Project decoding validates untrusted JSON, applies explicit schema migrations
when supported, and then performs structural normalization. Unknown versions
or malformed values fail with a project-load error; they are never silently
clamped or filled with guesses.

Schema version 1 requires an exact compatible catalog version. Until an
explicit migration exists, catalog mismatches are load failures rather than
best-effort reinterpretation. Encoding uses normalized route order and stable
indented JSON with a trailing newline.

## Undo and Redo

Undo/redo records authored semantic changes. The initial implementation may
store complete authored snapshots because project size is bounded and
correctness is more important than compression.

The history excludes:

- simulation output;
- findings and candidate decoration;
- active route, biome, or inspector tabs;
- search and filter text;
- hover, focus, and expansion state;
- autosave bookkeeping.

A grouped interaction such as replacing a reward primitive and installing its
complete default payload is one undo step, not multiple intermediate edits.

## Explicit Non-Goals

Authored state does not contain:

- ImGui rows or Lib control fields;
- React component state;
- UI-only occurrence IDs distinct from the persisted domain occurrence;
- canonical history or validation results;
- unresolved values such as `Auto`, `Vanilla`, `Major`, or `Minor`;
- automatic downstream repair;
- canonical substitution of repeated game-room names;
- future game-runtime instructions.
