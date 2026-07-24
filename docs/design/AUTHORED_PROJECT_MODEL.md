# Authored Project Model

## Purpose

This document defines the app's durable semantic state: project identity,
route and biome composition, authored topology, room-local state, stable
addresses, edit commands, defaults, and persistence rules.

It does not define simulation algorithms or React rendering.

## Cross-Biome Freeze Status

The schema version 5 examples in this document describe the reconciled
F/G/P/Q/H/O/I/N model. Occurrence identity, downstream retention, possibility
support, generated-store ownership, conditional-terminal batches, fixed
authored layout slots, and persistent hub topology are settled. Production now
reads schema version 5 for the implemented F/G/H/I and N/O/P/Q product surfaces
and rejects earlier versions without compatibility scaffolding.

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

The encoded `ProjectDocument` is the portable profile payload; there is no
second persisted profile wrapper. Profile filename normalization, explicit
save baselines, dirty state, autosave timing, recovery failures, and adapter
status are application/session concerns rather than authored domain state.

## Core Terms

`Project`
: One saved planning workspace containing route plans and project metadata.

`Route Declaration`
: A stable route key and ordered references to global Biome Declarations. The known routes are
Underworld (`F -> G -> H -> I`) and Surface (`N -> O -> P -> Q`).

`Biome Declaration`
: One global biome identity and player-facing label. Its key is the game biome
code (`F`, `G`, and so on), never a route-qualified name.

`Route Plan`
: Authored state for one route. It owns configured prefix scope, route-global
authored inputs, and ordered biome plans.

`Route Biome Placement`
: One route-local reference to a global Biome Declaration. The current model
identifies it by the separate `routeKey + biomeKey` axes. A biome may be reused
by another route without another declaration. Duplicate use inside one route is
rejected until a distinct placement identifier is required by real product
scope.

`Biome Layout Declaration`
: Immutable structural metadata selecting a registered layout kind and its
start, continuation, terminal, ordered derived completion, and bounded topology
rules.

`Biome Plan`
: Authored topology and biome-global state for one biome. It owns
structural relationships and never owns room-local rewards or payloads.

`Room Declaration`
: Immutable verified facts for one game room name: kind, label, authored or
derived mode, eligibility, force, caps, exits, encounter profile, reward
binding, and entered-room store-history policy.

`Room Occurrence`
: One stable authored occurrence of a declared game room inside a biome plan.
It owns an opaque persisted `occurrenceId`, one current `gameName`, and the
complete offer-time room-local state for that selection. It may also retain
complete entry-time state that becomes required only when the occurrence is
picked. Several occurrences may reference the same Room Declaration.

`Room State`
: Authored leaf values owned by one Room Occurrence. State follows occurrence
identity, not the globally unique game declaration.

`Generated Batch`
: The complete set of room occurrences offered together from a selected
parent occurrence. It owns physical exit association, peer membership, and
picked state. Its explicit reward-store policy either owns one concrete base
store outcome, resolves one from a semantic source offer point, or records that
no generated base store is observable.

`Terminal Transition`
: The selected continuation that resolves the predecessor's physical exits
through the biome's terminal policy. It owns ordered terminal target
occurrences, their picked state, and any policy-admitted ordinary companions.
Several terminal targets may reference the same preboss Room Declaration.

`Derived Layout Room`
: A non-authored occurrence materialized from a layout-owned fixed entry or
completion sequence, such as I Story, a boss, or a postboss. It references a
concrete Room Declaration but owns no persisted leaf or topology state.

`Fixed Authored Room Slot`
: A layout-owned structural role whose concrete Room Declaration cannot be
replaced but whose Room Occurrence owns persisted leaf state. N Opening,
PreHub, and PreBoss use this form. Fixed identity does not imply statelessness.

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
route                 routeKey
biome                 routeKey + biomeKey
start                 routeKey + biomeKey + start aspect
room occurrence       routeKey + biomeKey + occurrenceId
batch                 routeKey + biomeKey + parent occurrenceId
batch reward store    routeKey + biomeKey + parent occurrenceId + rewardStore aspect
batch target          routeKey + biomeKey + parent occurrenceId + exitIndex
picked continuation   routeKey + biomeKey + parent occurrenceId + picked aspect
terminal transition   routeKey + biomeKey + predecessor occurrenceId
terminal target       routeKey + biomeKey + predecessor occurrenceId + exitIndex
terminal companion    routeKey + biomeKey + predecessor occurrenceId + exitIndex
derived entry         routeKey + biomeKey + entry role
derived completion    routeKey + biomeKey + completion role
fixed authored room   routeKey + biomeKey + fixedSlotKey
room leaf             routeKey + biomeKey + occurrenceId + aspect
local child           routeKey + biomeKey + occurrenceId + groupKey + localSlotKey + aspect
```

React components may use the persisted occurrence ID as their key. Rendered
rows, array offsets, selector indexes, and graph coordinates are not semantic
identity.

Production addresses are frozen discriminated value objects containing the
listed owners. `semanticAddressKey` encodes that value as a canonical tuple for
map, marker, and React-key use; the encoded string is a projection, not a
second identity authority. Address constructors validate local scalar shape,
while command application resolves route, biome, occurrence, continuation,
target, reward, and shop owners against the authored project.

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

`ConfigureRoutePrefix` is the only ordinary edit authority for configured
scope. Expansion appends declaration-ordered biome plans initialized with
`topology: null`. Shrink removes the discarded biome plans and all state they
own; no second dormant route tree or persisted configured count survives.
Undo restores the exact removed plans as the prior authored snapshot.

## Layout Variants

The initial domain contains one shared biome envelope with two traversal-body
languages. Every biome still has an ordered entry chain, one traversal body, a
terminal entry, and a completion tail. `LinearBiome` and `HubBiome` distinguish
how the body is authored; they do not define disconnected persistence,
lifecycle, history, validation, or feedback stacks.

### LinearBiome

A linear biome consists of:

```text
declared start
  -> zero or more layout-derived fixed entry rooms
  -> selected generated batch target
  -> selected generated batch target
  -> ...
  -> terminal transition or terminal target in a generated batch
```

Every selected parent owns exactly one continuation form:

- a generated batch with one picked target that continues the spine; or
- a terminal transition that closes the biome.

The forms are mutually exclusive at a parent. A normalized biome policy may
also admit a terminal Room Declaration inside a generated batch. In that
narrow form, the picked declaration role derives whether the batch continues
or closes the biome. Unpicked batch targets, unpicked terminal targets, and
terminal companions are dead leaves and cannot own downstream topology.

The authored start occurrence selects only among declared start alternatives.
A fixed room after that start and before the editable decision frontier uses a
derived layout occurrence when it owns no leaf, or a fixed authored room slot
when its room state is editable. I has only fixed `I_Intro`; `I_Story01` is an
authored target inside a later generated batch. N uses fixed authored entry
slots for its reward-bearing Opening and PreHub. Canonical materialization
emits each fixed room's real creation, offer, entry, counter, and history facts
before the first editable batch.

F/G forked preboss transitions create one terminal target occurrence per
active predecessor exit. Those targets share the same terminal `gameName` but
have distinct occurrence IDs and realization state. The terminal policy
derives the first as Shop and remaining targets as free rewards; picked target
identity replaces the old authored preboss `entryMode`.

After the entered terminal target, simulation walks the layout's fixed
completion sequence. Its declared boss and any declared postboss rooms therefore
appear in canonical history without becoming editable occurrences in
`AuthoredProject`. The sequence may omit a postboss, as Q does in the canonical
repeat-run projection. The layout owns completion order and the Room
Declarations own room-local facts.

F, G, H, I, O, P, and Q use linear structure with registered biome-specific
extensions. O room-internal encounters and I's preboss behavior do not turn
their top-level layout into a generic graph.

I's repeatedly offered `I_PreBoss02` uses the policy-admitted batch form.
After Goal completion, one `ClockworkDoorBatch` may contain the preboss on its
first exit and an ordinary I target on its second. Picking the preboss closes
the biome; picking the peer continues. Every later preboss offer is a new Room
Occurrence of the same declaration. No declined-offer record or singleton
preboss state exists, and only the entered occurrence exposes local shop
acquisitions. Both the pre-Goal and post-Goal forms are created through the
ordinary batch command behind `Add Next Decision`; I never creates an
independent terminal transition or requires a separate `Go to Preboss` action.

### HubBiome

N uses the common envelope with a persistent-Hub body:

```text
fixed authored entry chain
  -> persistent Hub traversal body
      -> ordered pylon visits
      -> optional local side-room visits and parent restores
      -> derived returns to hub
  -> fixed authored terminal room
  -> derived completion rooms
```

Opening and PreHub are structural members of the fixed entry chain. PreHub's
position is layout-owned; it is not represented as a generated room candidate
whose eligibility happens to become true at depth 2. The fixed Preboss and
derived Boss/Postboss likewise use the shared terminal and completion
contracts. Only the middle Hub body requires Hub-specific authored structure.

N's hub declaration fixes the room assigned to each physical slot. The
authored plan selects which supported slots opened and which six are visited;
it never replaces a slot's `gameName`. Open unvisited slots remain real offered
dead leaves.

The hub batch and post-visit terminal role occupy separate structural roles
and may coexist. Repeated hub returns and main-room restores after side visits
reuse an existing room entity. They create additional canonical history
records, not repeated authored occurrences or cyclic authored links.

## Ownership

### Biome Plan Owns

- layout variant and biome-global authored state;
- start selection where alternatives exist;
- generated batches;
- room-occurrence registry and physical exit target links;
- fixed authored room-slot references required by the layout;
- picked target or visit order;
- terminal-transition presence and predecessor relationship;
- ordered terminal target links, realization roles, and picked target;
- policy-admitted terminal companion links;
- destructive structural commands;
- structural semantic addresses.

Outgoing topology never belongs to the target room state.

### Room State Owns

- complete resolved incoming offer;
- template-specific authored fields;
- room-local encounter choices;
- bounded local child state;
- phase-owned reward offer-point choices;
- shop offers and purchase state;
- realization-specific terminal shop or free-reward state where applicable.

A room occurrence does not know its parent, peers, picked state, or successor.
Topology supplies that activation context when completeness and
materialization join the occurrence with its owning batch. Shop state
optionality therefore does not add a persisted `picked` or `entered` flag to
the room leaf.

An H Fields combat occurrence persists `cage1`, `cage2`, and `cage3` as
complete resolved reward offers even when its declaration or owning batch
activates only two. The semantic batch outcome and declaration capacity derive
the active prefix; inactive cage values remain ordinary dormant leaf state.

### Batch Owns

- peer-wide selection or visit order;
- physical generation order;
- the generated decision's explicit reward-store policy and authored base
  outcome when applicable;
- batch-wide authored state;
- peer rules that require simultaneous visibility.

Batch behavior is selected by normalized layout context rather than a user-
authored implementation key.

N's persistent hub batch additionally owns its open fixed-slot set and ordered
six-slot visit sequence. Its target Room Occurrences own incoming rewards and
local side-room state; the batch does not copy those leaves.

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
deterministic offer-time defaults. If the occurrence is picked in the same
command, the command also installs any required entry-time defaults. Replacing
its `gameName` preserves `occurrenceId`, atomically replaces its room state
with the defaults required by its current lifecycle role, and never passes
through an empty active value.

Leaf edits within the selected declaration then remain concrete replacement
operations.

Defaults compose recursively from their semantic owners:

- a reward type owns its complete resolved-offer payload default;
- a reward bag owns its default reward type;
- a biome layout's store policy owns whether a new batch authors a base store,
  derives one from its source, or has none; an authored form also owns its
  store default;
- a biome layout's batch policy owns the complete explicit default for any
  required typed batch state;
- a counted binding owns a complete reward default for each store context it
  can receive;
- a shop slot owns a default resolved offer, installed when its room becomes
  picked for entry;
- a structural wrapper owns a mode default;
- a room template composes offer-time defaults into complete initial room
  state and entry-time defaults into complete picked-room state.

Option order is never default authority.

Blind Box follows the same total-leaf rule. Its resolved offer persists a
complete intended `BoonSource` even though the game does not reveal that source
when the shop inventory is generated. The source remains dormant while the box
is unpurchased and is validated only against acquisition-time history. Purchase
order and the supporting shop-option entry remain derived witnesses, not
persisted authored fields.

## Occurrence Lifecycle

Every persisted Room Occurrence is referenced by the biome topology. The app
does not keep a global dormant state record for every Room Declaration.

- Creating a start, ordinary target, terminal target, or companion creates one
  occurrence and its complete offer-time default state.
- Initializing a layout with fixed authored room slots creates those required
  occurrences with the defaults required by their fixed lifecycle role; their
  `gameName` cannot be replaced independently of the layout.
- Replacing the selected game room preserves the occurrence ID and installs
  the replacement declaration's complete offer-time defaults plus any
  entry-time defaults required when that occurrence is currently picked.
- Picking an occurrence atomically installs complete entry-time defaults when
  they are absent. Picking another target may retain the old occurrence's
  entry-time state dormantly, but materialization ignores that state.
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

The implemented linear command set is:

```ts
type ProjectCommand =
  | { kind: 'RenameProject'; name: string }
  | {
      kind: 'ConfigureRoutePrefix';
      route: RouteAddress;
      configuredBiomeCount: number;
    }
  | {
      kind: 'CreateStart';
      biome: BiomeAddress;
      occurrenceId: OccurrenceId;
      gameName: GameRoomName;
    }
  | { kind: 'CreateBatch'; continuation: ContinuationAddress }
  | {
      kind: 'ReplaceBatchRewardStore';
      continuation: ContinuationAddress;
      storeKey: RewardStoreKey;
    }
  | {
      kind: 'CreateTerminalTransition';
      continuation: ContinuationAddress;
      targetOccurrenceIds: readonly OccurrenceId[];
    }
  | {
      kind: 'CreateTarget';
      target: TargetAddress;
      occurrenceId: OccurrenceId;
      gameName: GameRoomName;
    }
  | {
      kind: 'SetPicked';
      picked: PickedAddress;
      exitIndex: number;
    }
  | {
      kind: 'SetTerminalPicked';
      picked: PickedAddress;
      exitIndex: number;
    }
  | { kind: 'ReconcileExitCapacity'; continuation: ContinuationAddress }
  | { kind: 'ReconcileTerminalExitCapacity'; continuation: ContinuationAddress }
  | { kind: 'RemoveBatch'; continuation: ContinuationAddress }
  | { kind: 'RemoveTerminalTransition'; continuation: ContinuationAddress }
  | {
      kind: 'ReplaceWithTerminalTransition';
      continuation: ContinuationAddress;
      targetOccurrenceIds: readonly OccurrenceId[];
    }
  | { kind: 'ReplaceWithBatch'; continuation: ContinuationAddress }
  | { kind: 'ClearTopology'; biome: BiomeAddress }
  | {
      kind: 'ReplaceOccurrenceRoom';
      occurrence: OccurrenceAddress;
      gameName: GameRoomName;
    }
  | {
      kind: 'ReplaceIncomingReward';
      reward: IncomingRewardAddress;
      value: ResolvedRewardOffer;
    }
  | {
      kind: 'ReplaceLocalReward';
      reward: LocalRewardAddress;
      value: ResolvedRewardOffer;
    }
  | {
      kind: 'ReplaceFieldsCageOutcome';
      continuation: ContinuationAddress;
      cageOutcome: 'min' | 'max';
    }
  | {
      kind: 'ReplaceShipEncounterCount';
      occurrence: OccurrenceAddress;
      encounterCount: 2 | 3;
    }
  | {
      kind: 'ReplaceRewardWheelOfferCount';
      wheel: RewardWheelAddress;
      offerCount: 1 | 2;
    }
  | {
      kind: 'ReplaceRewardWheelStore';
      wheel: RewardWheelAddress;
      storeKey: RewardStoreKey;
    }
  | {
      kind: 'ReplaceRewardWheelOffer';
      offer: RewardWheelOfferAddress;
      value: ResolvedRewardOffer;
    }
  | {
      kind: 'ReplaceRewardWheelPicked';
      wheel: RewardWheelAddress;
      pickedOfferIndex: 1 | 2;
    }
  | {
      kind: 'ReplaceShopOffer';
      offer: ShopOfferAddress;
      value: ResolvedRewardOffer;
    }
  | {
      kind: 'SetShopPurchase';
      purchase: ShopPurchaseAddress;
      purchased: boolean;
    };
```

`RenameProject` is owned by the stable project-root semantic address. It is one
ordinary authored history step; text-entry draft state remains transient until
the user commits the name. Route and biome commands retain their narrower
semantic owners.

Each command constructs an unpublished immutable proposal and sends it through
the same project decoder used at JSON contact. Command failures retain their
semantic address as the primary path; a nested document path may be carried as
detail when a leaf value fails its declaration codec.

Planned N hub commands operate on fixed semantic slots:

```ts
type HubBiomeCommand =
  | {
      kind: 'CreateHubTopology';
      fixedOccurrenceIds: Readonly<Record<string, OccurrenceId>>;
    }
  | {
      kind: 'OpenHubSlot';
      hubSlotKey: string;
      occurrenceId: OccurrenceId;
    }
  | { kind: 'CloseHubSlot'; hubSlotKey: string }
  | { kind: 'AppendHubVisit'; hubSlotKey: string }
  | { kind: 'ReplaceHubVisit'; visitIndex: number; hubSlotKey: string }
  | { kind: 'RemoveHubVisitsFrom'; visitIndex: number }
  | { kind: 'ClearTopology' };
```

The open-slot collection is the only hub-door-count authority and contains
nine or ten slots when complete. The ordered visit sequence references six
distinct open slots when complete. Partial sets remain structurally decodable
editor state but do not materialize a biome snapshot. Closing a slot or
removing visits is explicitly destructive; ordinary replacement does not
silently rewrite downstream visits.
`CloseHubSlot` fails while `visitOrder` still references that slot; the visit
must first be replaced or explicitly removed from that point.

Each visited combat target owns one bounded record per declaration-fixed side
slot. The record authors generation state, a complete reward leaf, and an
optional distinct `enteredOrdinal`; a missing ordinal means generated but
unentered when generation state is active. Generated and entered counts are
derived rather than persisted authorities. Every permutation of the entered
slots is structurally valid. Current simulation treats permutations with the
same generated/entered sets and rewards as equivalent at final parent exit,
while retaining ordinals for exact history and eventual execution intent.

The H local-cage command replaces one declaration-owned bounded reward slot.
It rejects unknown group/slot addresses, retains sibling cages and topology,
and sends the proposal through the ordinary project decoder. Planned leaf
extensions for other room-local structures remain concrete replacements:

```ts
type RoomCommand =
  | {
      kind: 'ReplacePayload';
      occurrenceId: OccurrenceId;
      slotKey: string;
      payload: RewardPayload;
    }
  | { kind: 'ReplaceRoomMode'; occurrenceId: OccurrenceId; mode: string }
  | {
      kind: 'ReplaceLocalChild';
      occurrenceId: OccurrenceId;
      slotKey: string;
      value: LocalChildState;
    };
```

H also requires one policy-specific batch replacement rather than a generic
untyped state mutation:

```ts
type FieldsBatchCommand = {
  kind: 'ReplaceFieldsCageOutcome';
  continuation: ContinuationAddress;
  cageOutcome: 'min' | 'max';
};
```

The command is available only when the normalized continuation policy is the
Fields cage policy. It retains every target occurrence, local cage value, and
downstream continuation; simulation alone re-derives active slots and
`fieldsMaxDoorsRolled` support.

Exact unions grow with implemented templates. Their shared rule is that one
command expresses one semantic user intent and validates the complete proposed
replacement before it becomes authored state.

## Downstream Retention Policy

Replacing the game room selected by a start or target preserves that
occurrence's ID, so downstream topology remains attached without changing its
semantic parent. The replacement occurrence receives the new declaration's
complete offer-time defaults plus entry-time defaults when it is currently
picked. Unpicked peer occurrences remain untouched.

Choosing a different picked exit changes the selected parent occurrence. That
command installs any missing entry-time defaults on the new picked occurrence
and retains downstream topology by re-anchoring its batch or terminal
ownership from the old picked occurrence ID to the new one. Entry-time state
on the old target remains dormant rather than being destructively cleared.

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

Replacing a batch's base reward store is valid only for an
`authoredBaseStore` batch and retains every target occurrence and every
concrete target reward. Simulation reports any retained reward that its newly
resolved store cannot produce. A `none` batch has no replacement command.
A `sourceOfferPoint` batch likewise has no batch replacement command because
the concrete store is edited at its owning room-local offer point. A `none`
batch may be reward-free or may resolve every target through declaration-owned
overrides, as I does. Store replacement never resets downstream topology or
leaf state.

`CreateTarget` accepts only an exit physically present on the current parent,
and terminal creation derives its complete target set from those current
generated exits. `SetPicked` and `SetTerminalPicked` accept only currently
available targets. Retained overflow is therefore created only by an upstream
room replacement; commands cannot manufacture unavailable targets directly or
reaffirm one as a valid pick.

These remain intentionally destructive:

- shrinking a configured route prefix removes every discarded biome plan;
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
- every batch reward-store form matches its layout policy and every authored
  base store belongs to that policy's static store domain;
- every batch-state form matches its layout-selected typed codec and contains
  one complete value for each required semantic field;
- configured biome plans remain the exact declaration-ordered contiguous route
  prefix;
- semantic addresses remain unique.

This boundary rejects malformed construction. It does not reject a
structurally representable choice merely because simulation later finds it
ineligible or impossible under game history.

## Project Document

The persisted project is a versioned, human-inspectable JSON document. Its
representative top-level shape is:

```ts
interface ProjectDocument {
  schemaVersion: 5;
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
  biomeKey: string;
  state: Readonly<Record<string, boolean | number | string>>;
  topology: LinearBiomeTopology | null;
}

interface LinearBiomeTopology {
  startOccurrenceId: OccurrenceId | null;
  occurrences: readonly RoomOccurrence[];
  continuations: readonly LinearContinuation[];
}

interface HubBiomePlan {
  kind: 'HubBiome';
  biomeKey: string;
  topology: HubBiomeTopology | null;
}

interface HubBiomeTopology {
  occurrences: readonly RoomOccurrence[];
  fixedRooms: readonly FixedAuthoredRoomReference[];
  openTargets: readonly HubTargetReference[];
  visitOrder: readonly string[];
}

interface FixedAuthoredRoomReference {
  fixedSlotKey: string;
  occurrenceId: OccurrenceId;
}

interface HubTargetReference {
  hubSlotKey: string;
  occurrenceId: OccurrenceId;
}

interface RoomOccurrence {
  occurrenceId: OccurrenceId;
  gameName: string;
  state: AuthoredRoomState;
}

interface ShipCombatState {
  kind: 'shipCombat';
  encounterCount: 2 | 3;
  wheels: Readonly<Record<'wheel1' | 'wheel2', RewardWheelState>>;
}

interface RewardWheelState {
  storeKey: RewardStoreKey;
  offerCount: 1 | 2;
  offers: Readonly<Record<'offer1' | 'offer2', ResolvedRewardOffer>>;
  pickedOfferIndex: 1 | 2;
}

type LinearContinuation =
  | {
      kind: 'batch';
      parentOccurrenceId: OccurrenceId | null;
      rewardStore:
        | {
            kind: 'authoredBaseStore';
            baseRewardStoreKey: RewardStoreKey;
          }
        | {
            kind: 'sourceOfferPoint';
          }
        | {
            kind: 'none';
          };
      batchState: AuthoredBatchState;
      targets: readonly LinearTargetReference[];
      pickedExitIndex: number | null;
    }
  | {
      kind: 'terminal';
      parentOccurrenceId: OccurrenceId | null;
      rewardStore?:
        | {
            kind: 'authoredBaseStore';
            baseRewardStoreKey: RewardStoreKey;
          }
        | {
            kind: 'sourceOfferPoint';
          }
        | {
            kind: 'none';
          };
      targets: readonly LinearTargetReference[];
      pickedExitIndex: number | null;
    };
```

The `batch` record does not persist a continuation-effect discriminant. Its
normalized batch policy and each target's resolved Room Declaration establish
which roles are admitted. For I, a picked `I_PreBoss02` derives
`completeBiome`; every picked ordinary target derives `continueBiome`.

`LinearBiomePlan.state` contains exactly the declaration-owned biome fields,
with complete defaults and no undeclared keys. I currently uses it for
`maxNonGoalRewards`; biomes with no authored fields persist `{}`. A null
`startOccurrenceId` and null first-continuation parent are reserved for a
layout-derived fixed-entry sequence. They mean "continue after the final fixed
entry," not an absent room or a positional UI row. Authored-start layouts still
require a concrete occurrence ID.

`sourceOfferPoint` carries no second address or store value. The continuation's
parent occurrence is already its source, and the normalized layout policy owns
how to select that source's semantic offer point. O resolves the last active
ShipCombat wheel from the occurrence's authored encounter-count state.
Replacing the source room also reconciles the owned continuation's authority:
ShipCombat selects `sourceOfferPoint`, while another admitted O room restores
the layout's authored Run/Meta store policy. The command preserves an authored
store value when it remains valid and never copies a wheel store into the
continuation.

The optional terminal `rewardStore` exists only for a direct terminal whose
target is physically generated from the predecessor's doors. O therefore
applies the same source-profile policy to its direct preboss continuation that
it applies to an ordinary batch. Forked and generated-target terminals do not
persist this field. The codec derives that distinction from the layout and
rejects either a missing direct-terminal store or a store on another terminal
form.

Both wheel records remain complete at maximum capacity. An inactive second
combat or second offer emits no events but is never erased from authored state;
the active counts select the meaningful prefix. `pickedOfferIndex` must address
that active prefix.

For a declaration-fixed incoming reward, authorship may replace only its
payload. The declaration remains the authority for the reward type. This is
how O Devotion owns its chosen/spurned source pair without allowing the fixed
`Devotion` producer to become a different reward.

`AuthoredBatchState` is decoded against the normalized batch policy selected by
the biome layout; the persisted document does not carry a user-authored rule
or template key. Ordinary policies with no additional state use `null`. The H
Fields policy uses:

```ts
interface FieldsCageBatchState {
  cageOutcome: 'min' | 'max';
}
```

That semantic outcome is persisted rather than its derived visible cage count.
I adds no batch-owned value: Clockwork counters are derived from entered
producer resolution, and terminal versus continuing outcome comes from the
picked declaration. N's open fixed-slot set and visit sequence are topology,
not an `AuthoredBatchState` extension.

I combat occurrences persist one complete potential Tartarus reward, not an
authored Goal/NonGoal discriminant. The Clockwork policy derives whether that
leaf is active from physical offer order and current history. A Goal
realization retains the dormant concrete value so an upstream edit that makes
the occurrence NonGoal exposes the prior intent rather than installing a new
default.

Routes are encoded in normalized catalog order. A route plan's ordered
`biomes` array is its configured-prefix authority, so the document does not
also persist a count or duplicate biome-key list. The decoder accepts route
records in any order and canonicalizes them, while biome plans must already be
the exact contiguous route prefix.

`topology: null` is the complete representation of a configured biome whose
topology has not been started. It does not choose a default opening or create
placeholder Room Occurrences. A non-null topology contains the occurrence
registry and relationships that reference occurrence IDs. Every occurrence
contains its selected `gameName` and complete offer-time room-local state.
Entry-time state may be absent on an unpicked occurrence or retained there as
a complete dormant value; it is required on every picked occurrence whose
declaration owns that state. Several occurrences may reference the same game
name; every occurrence ID remains unique.

For N, `fixedRooms` must match the layout's required authored slot keys and
their fixed Room Declarations. `openTargets` contains one occurrence for every
open hub slot; its length derives the nine-or-ten door outcome. `visitOrder`
references distinct open `hubSlotKey` values and reaches exactly six entries
when complete. Hub slot order is normalized from the layout declaration, while
visit-array order is semantic player entry order.

The non-null topology decoder resolves each occurrence through its Room
Declaration, derives ordinary versus terminal Shop/Free realization from
structural role, dispatches the layout-selected typed batch-state codec, and
then dispatches the declaration's typed room-state codec.
Generic JSON leaf state is never an intermediate format.

Incidental input array order is not semantic authority. Normalization orders continuations
along the picked spine, targets by physical exit index, and occurrences as the
start followed by each normalized continuation's targets. Repeated `gameName`
values remain separate because occurrence IDs are preserved. Continuations
owned by unpicked targets, multiply owned occurrences, dormant unreferenced
occurrences, cycles, and role-incompatible rooms or leaves are contract errors.
Explicit semantic sequences such as N `visitOrder` remain authoritative by
definition.

`pickedExitIndex: null` represents an incomplete decision that has never been
picked. Command handlers will enforce the stronger edit invariant that an
existing picked value can only be replaced or structurally deleted; the codec
does not invent a pick while loading an incomplete project.

The precise nested JSON shape should be locked alongside codecs during the
first authored-model implementation phase. It must contain semantic values,
not Redux implementation state.

Project decoding validates untrusted JSON, applies explicit schema migrations
when supported, and then performs structural normalization. Unknown versions
or malformed values fail with a project-load error; they are never silently
clamped or filled with guesses.

Schema version 2 moves generated-door store authority from counted room leaves
to the explicit `rewardStore` policy on the owning batch. A batch whose layout
exposes generated RunProgress/MetaProgress support uses
`authoredBaseStore`; an O ShipCombat batch uses `sourceOfferPoint`; a
batch with no observable base outcome uses `none`. Counted leaves persist
only their complete resolved reward offer. The implementation must perform this as one schema
authority switch; it must not accept both leaf and batch stores as competing
sources.

The project requires an exact compatible catalog version. Until an explicit
migration exists, catalog mismatches are load failures rather than best-effort
reinterpretation. Encoding uses normalized route order and stable indented
JSON with a trailing newline.

The canonical encoding, or a stable fingerprint of it, may be compared with
the last successfully saved or explicitly loaded profile to derive dirty
state. That baseline is not written into the document. The same encoded
document may be copied into a separate autosave recovery channel, but doing so
does not make the project clean. A document restored from recovery receives a
fresh history and simulation and remains recovered/unsaved until the user
explicitly saves it as a profile.

## Undo and Redo

Undo/redo records authored semantic changes as complete frozen snapshots
because project size is bounded and correctness is more important than
compression. `ProjectHistory` owns unbounded in-memory `past`, `present`, and
`future` sequences. It is application-session state and is not encoded in the
project document.

Applying a semantic command records one new snapshot, clears redo, and leaves
history unchanged when the command returns the identical authored project.
Undo and redo restore the exact prior snapshot and are identity no-ops at their
respective boundaries.

The history excludes:

- simulation output;
- findings and candidate decoration;
- active route, biome, or inspector tabs;
- search and filter text;
- hover, focus, and expansion state;
- autosave bookkeeping.

A grouped interaction such as replacing a reward type and installing its
complete resolved-offer payload is one undo step, not multiple intermediate
edits.

## Explicit Non-Goals

Authored state does not contain:

- ImGui rows or Lib control fields;
- React component state;
- UI-only occurrence IDs distinct from the persisted domain occurrence;
- canonical history or validation results;
- unresolved values such as `Auto`, `Vanilla`, `Major`, or `Minor`;
- probability scores, RNG seeds, or route-likelihood annotations;
- automatic downstream repair;
- canonical substitution of repeated game-room names;
- future game-runtime instructions.
