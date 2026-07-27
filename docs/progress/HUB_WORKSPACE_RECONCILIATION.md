# Unified Biome Decisions, Preboss Batches, and Hub Workspace Reconciliation

## Status

Commit 4 is complete. Commit 3c closed the application composition over the
unified biome-decision contract: every configured biome now renders through
`BiomeWorkspace`, while `HubDecisionWorkbench` remains the sole N-specific
workbench inside that shared surface. Both consume `WorkspaceBiome` products
and semantic interactions rather than authored topology, catalog layout
branches, or simulation details.

Delivered Slice 3c behavior:

- ordinary decisions, linked exits, takeover and mixed Preboss batches, Hub,
  occurrence workbenches, and completion render through one exhaustive
  workspace-node dispatcher;
- N exposes 26 declaration-fixed slots, nine or ten open members, six authored
  visits, occurrence-owned side rooms, and its fixed completed-Hub handoff
  without a second editor surface;
- N keeps its declaration-only Hub outline after the active Opening or PreHub
  frontier, preserving the reachable `Opening -> PreHub -> Hub` rail order;
- route-prefix-blocked suffixes retain structural frontiers from authored
  completeness even when route simulation cannot yet assess contextual support;
- N is the first Surface biome, so its coverage boundary is local progressive
  owner coverage within the Hub; only O/P/Q can be route-prefix-blocked by an
  earlier Surface biome;
- the planner-engine core owns removal-impact calculation and topology repair;
  application projection presents that owned scope without traversing authored
  descendants;
- React remains a projection and semantic-command consumer: it owns no
  eligibility, reward, lifecycle, candidate, or topology-repair rules.

Commit 3c validation after the N rail-order repair:

- workspace typechecks passed for planner-engine, catalog, and planner;
- full Vitest passed: 57 files, 592 tests;
- planner lane passed: 21 files, 175 tests; architecture contract lane passed:
  3 files, 15 tests; product lane passed: 2 files, 7 tests;
- planner-engine passed: 30 files, 308 tests; catalog passed: 4 files,
  102 tests;
- ESLint, Prettier, and `git diff --check` passed;
- production Vite build passed. Its existing non-failing chunk-size warning
  remains.

Commit 4 then closed the unified refactor with its representative workflow,
recovery, repair, performance, architecture, terminology, and complete-gate
evidence. Its final closure repair makes a ninth-to-eighth unvisited Hub-slot
edit remove the completed-Hub handoff and its descendant subtree in the same
engine-owned impact, while retaining the six authored visits on an incomplete
board. Commit 5 is now the sole follow-up: presentation polish and accessible
confirmation without changing the unified domain contracts.

Final Commit 4 validation after the completed-Hub closure repair on 2026-07-26:

- catalog, planner-engine, and planner TypeScript checks passed;
- full Vitest passed: 59 files, 605 tests;
- ESLint, Prettier, and `git diff --check` passed;
- production Vite build passed. Its existing non-failing chunk-size warning
  remains.

### Current terminology

The active contract uses one biome layout, normal-door batches, exit and Hub
decisions, declaration-fixed width-one Preboss batches where applicable, and
declaration-derived completion. References below to legacy layout families,
terminal, direct, forked, or whole-biome editor terminology are retained only
where they describe the prior migration plan or chronological evidence; they
are not current production vocabulary.

Natural Chaos remains an explicit future special-exit backlog. This refactor
adds no Chaos declaration, authored state, command, simulation, candidate, or
UI behavior; a later extension must use the exit-decision envelope described
in [Deferred Chaos Extension Contract](#deferred-chaos-extension-contract).

Earlier delivery records remain chronological evidence; they are not a reason
to retain obsolete dedicated editor paths or revision-labelled behavior in
current authority.

This tracker supersedes the presentation-only Phase 7 Commit 12 and
Commit 13 plan. Phase 7 Commit 12 will be delivered through the seven
independently reviewable commits defined below. Commits 1, 2, 3a, 3b, 3c, and 4
establish and close the unified biome refactor. Commit 5 is a follow-up
presentation and accessibility pass that preserves those domain contracts
while delivering the same final product acceptance.

The implementation must update its owning authorities as it lands:

- [`ARCHITECTURE.md`](../design/ARCHITECTURE.md);
- [`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md);
- [`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md);
- [`CATALOG_MODEL.md`](../design/CATALOG_MODEL.md);
- [`CONTEXTUAL_EDITOR_UX.md`](../design/CONTEXTUAL_EDITOR_UX.md);
- [`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md);
- [`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md);
- [`GAME_INTEGRATION_BOUNDARY.md`](../design/GAME_INTEGRATION_BOUNDARY.md);
- [`REWARD_MODEL.md`](../design/REWARD_MODEL.md);
- [`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md);
- [`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md);
- [`STRUCTURED_EDITOR_WORKSPACE.md`](../design/STRUCTURED_EDITOR_WORKSPACE.md);
- the affected biome authorities under `docs/biomes/`;
- [`REWARD_GAME_DATA_AUDIT.md`](../audits/REWARD_GAME_DATA_AUDIT.md);
- [`CROSS_BIOME_EDITOR_UX_AUDIT.md`](../audits/CROSS_BIOME_EDITOR_UX_AUDIT.md).

This tracker freezes the intended boundary, source-backed corrections, delivery
order, and acceptance gates. It does not replace those stable design and biome
authorities.

## Resolved Game-Source Evidence

The plan was reconciled against the installed Hades II scripts on 2026-07-24.
The implementation must preserve these distinctions rather than copying the
game's control flow mechanically.

Repository-root-relative evidence anchors:

- `../../1GameData/Scripts/RoomLogic.lua`: `DoUnlockRoomExits`,
  `HandleSecretSpawns`, `LockEphyraExits`, and Soul Pylon completion
  handling;
- `../../1GameData/Scripts/RunLogic.lua`: `ChooseNextRoomData`,
  `IsRoomForced`, and `IsRoomEligible`;
- `../../1GameData/Scripts/RoomDataF.lua`, `RoomDataG.lua`,
  `RoomDataH.lua`, `RoomDataO.lua`, `RoomDataP.lua`, and `RoomDataQ.lua`:
  takeover Preboss declarations, force facts, `ForcedFirstReward`, and room
  exits;
- `../../1GameData/Scripts/RoomDataI.lua`: `AlwaysForceOncePerRoom`,
  `MaxCreationsPerRoom`, and inherited `I_PreBoss02` behavior;
- `../../1GameData/Scripts/RoomDataN.lua` and
  `../../1GameData/Scripts/ObstacleDataN.lua`: N Preboss Shop plus
  `EphyraExitBossDoor`, six-pylon availability, and fixed target identity.

### Normal-Door Generation

`RoomLogic.DoUnlockRoomExits` walks the offered exits in deterministic order.
For an exit that does not already own a room:

1. a fixed `ForceRoomName` wins when declared;
2. otherwise `RunLogic.ChooseNextRoomData` evaluates linked-room or room-set
   candidates;
3. `IsRoomEligible` applies requirements and creation or appearance caps;
4. `IsRoomForced` determines the forced candidate set;
5. one Room Occurrence is created for that exit.

Eligibility, force pressure, and caps determine whether a room is a valid
candidate. They are not the authored batch-shape effect described below.

### Preboss Batch Shape

F, G, H, O, P, and Q preboss declarations are forced at their supported
preboss frontier and remain eligible for every applicable unresolved normal
door. The game therefore creates the same preboss Room Declaration once per
normal door. F, G, H, and P can expose multiple such doors; O and Q currently
expose one.

The game does not call a literal `takeOverNormalDoors` callback. The normalized
planner contract expresses the observable batch invariant:

> If a takeover preboss appears in a valid normal-door batch, every normal door
> in that batch resolves to a distinct occurrence of that preboss declaration.

This is an appearance-triggered batch-shape rule. Candidate eligibility and
force pressure still determine whether the appearance itself is valid or
required.

Every takeover preboss uses `ForcedFirstReward = "Shop"`. Reward assignment
records that first offer before processing later doors, so:

```text
first preboss occurrence       -> Shop
remaining preboss occurrences  -> free generated rewards
```

Every offered occurrence and incoming offer identity exists before the player
selects an exit. Counted free-reward leaves are complete and have already
consumed their reward-store entries. A Shop occurrence already owns its Shop
binding, but WorldShop inventory and purchases remain entry-time lifecycle
state and materialize only for the selected occurrence. Unpicked occurrences
remain real dead leaves.

### I Is the Explicit Generated Exception

I's supported preboss declares both:

- `AlwaysForceOncePerRoom = true`;
- `MaxCreationsPerRoom = 1`.

The first property forces one preboss occurrence when eligible. The second
makes the same declaration ineligible for later normal doors from that source.
An I batch may therefore contain one preboss target and an ordinary peer. I
does not use the takeover invariant.

### Chaos Is a Separate Exit Producer

`RoomLogic.HandleSecretSpawns` creates a Chaos room and assigns it to its Secret
Door before unresolved normal doors receive rooms. Normal-door generation does
not replace a door that already owns its Chaos room.

A source may therefore expose:

```text
normal doors  -> takeover preboss occurrences
Secret Door   -> Chaos occurrence
```

If Chaos is entered, the preboss occurrences remain unentered offers. Chaos
pauses biome state and uses the previous room set for its outgoing generation,
so a supported preboss may be offered again after the detour. This behavior is
only an extension constraint in this task; Chaos production behavior remains
deferred.

### N Has a Specialized Handoff, Not Specialized Preboss State

N Hub owns ordinary `EphyraExitDoor` objects and a separate
`EphyraExitBossDoor`. After six completed pylons:

- `LockEphyraExits` removes the ordinary Hub exits;
- the dedicated boss exit satisfies its six-pylon availability requirement;
- that exit fixes `ForceRoomName = "N_PreBoss01"`;
- exactly one `N_PreBoss01` occurrence with Shop is offered.

The six-pylon rule belongs to the Hub and its dedicated exit. It is not ordinary
preboss candidate pressure. The planner therefore places the uniqueness in the
Hub progression contract:

```text
completed Hub
  -> closes ordinary Hub exits
  -> exposes one declaration-fixed normal exit
  -> produces a width-one N_PreBoss01 batch
```

Once produced, N Preboss uses the same occurrence, incoming-reward, selection,
entry, completion, history, and workspace contracts as every other preboss.
The batch has no free-reward peer because it has no remaining normal exit.

## Decision

The normalized catalog, authored project, simulator, structured projection, and
React workspace use one biome language. A biome begins at an authored start
Room Occurrence and advances through explicit next-room decisions until a
selected room closes editable traversal and starts the declaration-derived
completion tail.

There is one topology product and no separate completion-decision family:

```ts
type NextRoomDecision = ExitDecision | HubDecision;

interface ExitDecision {
  kind: 'exit';
  source: ExitDecisionSource;
  normal: LinkedNormalExit | NormalDoorBatch;
  selection: ExitSelection;
}

type ExitDecisionSource =
  { kind: 'occurrence'; occurrenceId: OccurrenceId } | { kind: 'hubDecision'; decisionKey: string };

type ExitSelection =
  { kind: 'derived' } | { kind: 'unresolved' } | { kind: 'normal'; exitKey: string };
```

The type names, discriminants, and ownership shown here are normative.
Implementation may factor helper types, but it must not introduce an alternate
decision family or move any of these owners:

- an `ExitDecision` owns the exits offered from one semantic source and the
  eventual selection among them;
- its `normal` member is either one declaration-linked normal exit or one
  normal-door batch;
- a `NormalDoorBatch` owns its declaration-required batch state, target
  occurrences, incoming offers, and physical or semantic exit identities;
- a `HubDecision` owns N's atomic board, open-set rewards, visit order, side
  traversal, restore semantics, and completed-Hub handoff;
- selecting a target whose Room Declaration role closes the biome ends editable
  traversal;
- Boss and Postboss remain declaration-derived completion rooms rather than
  authored decisions.

This is not a generic graph or a capability bag. Each decision retains complete
game-domain invariants, commands, materialization, validation, and simulation.
Shared orchestration dispatches explicitly by decision and normal-exit kind.

### Normal Is Domain Vocabulary

`normal` means the declaration-linked or room-set-generated door family whose
room assignment participates in the ordinary next-room decision. It is not a
fallback meaning "anything not currently modeled."

A future Chaos gate is a separately produced special exit. Normal-door
takeover never includes it. Schema 9 does not persist an empty special-exit
array merely to reserve that future space.

### Exit Selection Ownership

Selection belongs to the `ExitDecision`, not to one producer inside it. Today:

- a one-target linked exit with no competing exit uses `derived`;
- a width-one batch with no competing exit uses `derived`;
- a multi-target batch begins `unresolved` and persists `normal` with the
  declaration-owned exit key after selection.

The codec rejects `derived` unless the enclosing decision has exactly one
selectable exit, rejects `unresolved` when selection is structurally derived,
and rejects a `normal` key outside the decision's normal member.
`SetExitSelection` changes only an unresolved or authored selection; it cannot
override a derived selection.

When special exits enter scope, the selection union can gain a special-exit
member without moving ownership or changing normal-batch identity. Derivation
depends on the total selectable exits in the enclosing decision, not the width
of its normal member alone. A width-one preboss batch beside Chaos is therefore
offered but remains unselected until the authored exit choice is made.

### Preboss Is Not a Decision Variant

Preboss is a Room Declaration role interpreted inside a normal-door batch.
There is no:

- a completion-decision variant;
- authored transition variants that encode takeover shape;
- singleton preboss state detached from physical target occurrences;
- authored `entryMode`;
- persisted `isTakeover` duplicate of declaration and target facts.

The batch validator derives the applicable preboss policy from its target Room
Declarations and progression context.

For the supported catalog, Room kind `Preboss` is the declaration-owned
completion trigger. Offering a Preboss does not start completion; selecting its
occurrence does. Do not add a second persisted completion policy such as
`closesBiomeWhenPicked`, `completeBiome`, or an entry-mode flag.

## Scope

### In Scope

- establish one normalized biome envelope with explicit progression-policy
  variants;
- establish `ExitDecision | HubDecision` as the complete top-level decision
  vocabulary;
- define linked normal exits and normal-door batches as explicit normal-exit
  contracts;
- move exit selection to the combined exit-decision owner;
- correct preboss modeling across F through Q;
- use one Preboss template plus batch-order-derived Shop/free offer roles;
- separate candidate validity from preboss appearance-triggered batch shape;
- represent O and Q prebosses as width-one instances of the common batch;
- retain I's mixed generated preboss behavior;
- represent N Opening as the authored start occurrence;
- represent Opening-to-PreHub as a linked normal exit;
- use declaration-fixed starts and Hub slots without dormant compatibility
  forms;
- represent N's persistent Hub as the one specialized Hub decision;
- make completed N Hub produce a declaration-fixed width-one preboss batch;
- preserve N's board, visits, side rooms, reward lookup, lifecycle, and
  canonical history;
- unify project evaluation and workspace projection around the common biome
  envelope;
- render every biome through one `BiomeWorkspace`;
- remove obsolete layout-specific editor exports after moving reusable leaf
  controls into the shared workbench surface.

### Explicitly Deferred

Natural Chaos is not implemented in this task. Do not add:

- Chaos Room or reward declarations to the production catalog;
- a persisted empty special-exit or detour collection;
- `AddChaosGate`, remove-gate, or pick-detour commands;
- Chaos candidate evaluation, reward simulation, history, validation, or UI;
- generic `unsupported`, `unknown`, or placeholder detour values;
- save/profile predicates controlling Chaos eligibility.

The future contract is documented only to prevent today's ownership from
blocking the later feature.

### Out of Scope

- arbitrary graphs or user-authored cycles;
- probability simulation;
- changing supported room eligibility, force pressure, or reward bags beyond
  correcting their preboss interpretation;
- changing Hub slot identity, board availability, reward lookup, visits, side
  rooms, or restores;
- representing repeated Hub appearances as new Room Occurrences;
- implementing optional actions, NPC substitution, Anomaly, or other detours;
- changing Boss or Postboss completion behavior.

## User-Facing N Flow

The supported no-detour route remains:

```text
Opening
PreHub
Hub
Room 1
Room 2
Room 3
Room 4
Room 5
Room 6
Preboss
Boss       derived landmark
Postboss   derived landmark
```

Opening, PreHub, resolved main-room occurrences, and Preboss use the same room
workbenches as equivalent rooms elsewhere. The Hub board is the only
Hub-specific workbench.

A declaration-linked decision with only one possible exit does not require a
room-selection control. The rail proceeds from Opening to PreHub without asking
the user to select its fixed game identity.

After six valid visits, the Hub workbench exposes the semantic action that
creates its width-one preboss batch. The action is available because the Hub is
complete, not because React recalculates pylon or room-candidate rules.

The future addition of a Chaos gate at N Opening would make that existing exit
decision selectable:

```text
Next room from Opening
  PreHub  linked normal exit
  Chaos   separately produced special exit
```

The Opening workbench would expose `Add Chaos Gate`; exit selection would
remain owned by the next-room decision. The current task adds neither action nor
state.

## Catalog Contract

### Common Biome Envelope

The normalized catalog expresses one biome envelope:

```ts
interface BiomeLayout {
  biomeKey: string;
  initialCounters: InitialCounters;
  start: StartDescriptor;
  progression: ProgressionDescriptor;
  completion: CompletionDescriptor;
  fields: readonly AuthoredFieldDescriptor[];
}
```

The start contract is:

```ts
type StartDescriptor =
  | {
      kind: 'authoredChoice';
      roomGameNames: readonly [string, ...string[]];
    }
  | {
      kind: 'fixedAuthored';
      roomGameName: string;
    };
```

F uses `authoredChoice`. G, H, I, O, P, and Q use a fixed authored `Intro`; N
uses fixed authored `N_Opening01`. A fixed start still creates and persists a
real Room Occurrence, but the command and UI cannot substitute another game
name.

There is no separate top-level completion-policy field. Progression declares which
exit or Hub decision follows each semantic role, and target Room Declarations
derive continuation or biome completion. In the supported catalog, a selected
authored `Preboss` target starts the completion tail. This is Room-kind
semantics, not a second layout flag.

`ProgressionDescriptor` remains a discriminated, declaration-owned language.
It must not contain callbacks, UI concepts, or biome-key dispatch. Variant
fields stay inside the variant that owns them:

- eligibility-driven, fixed-count, and staged generated progression;
- standard, Fields, Clockwork, and Ship batch state;
- reward-store policies and source overrides;
- Hub open-count, board, visit, side-room, and handoff policies;
- linked and declaration-fixed exit targets;
- generated topology bounds.

### Preboss Declaration Policy

Every supported preboss declaration must state a complete normalized batch
policy:

```ts
type RemainingPrebossOfferPolicy =
  | { kind: 'none' }
  | {
      kind: 'counted';
      reward: CountedIncomingRewardPolicy;
    };

type PrebossBatchPolicy =
  | {
      kind: 'takeOverNormalDoors';
      remainingOffers: RemainingPrebossOfferPolicy;
    }
  | { kind: 'retainNormalPeers' };
```

For a takeover policy, the first declared normal exit uses the Room
Declaration's ordinary Shop incoming-reward binding. `remainingOffers` states
what later normal exits own without duplicating that first binding:

- F/G/H/P use takeover with counted remaining offers;
- O/Q use takeover with `remainingOffers.kind = 'none'` because every supported
  preboss source is width one;
- N uses takeover with `remainingOffers.kind = 'none'` over the width-one batch
  emitted by completed Hub progression;
- I uses `retainNormalPeers`.

Catalog normalization and cross-layout validation reject:

- a Preboss room with no batch policy;
- non-Preboss rooms with a preboss policy;
- a takeover Preboss whose ordinary incoming reward is not Shop;
- a takeover Preboss whose static creation or appearance caps cannot cover the
  maximum normal-exit width of a supported source;
- a takeover Preboss that is statically incompatible with any normal exit type
  at a supported source;
- a `retainNormalPeers` declaration whose Room caps do not state
  `maxCreationsPerRoom = 1`;
- `remainingOffers.kind = 'none'` when a supported source can expose more than
  one normal exit;
- counted remaining offers when every supported source is width one and the
  alternate binding would be unreachable;
- a fixed progression target whose Room Declaration belongs to another biome.

Authored-project validation separately rejects a takeover batch containing a
non-preboss normal peer or targets that do not all reference the same
declaration. The catalog compiler does not inspect authored occurrences, and
the project validator does not redefine declaration policy.

The normalized batch policy, declared exit order, and selected target derive
each occurrence's Shop or counted-free offer role. No persisted occurrence-role
flag duplicates those facts.

### N Progression

N progression declares:

- fixed authored start `N_Opening01`;
- linked normal exit key `prehub` to `N_PreHub01`;
- persistent Hub decision key `hub`, reached from PreHub;
- six valid visits as Hub completion;
- one declaration-fixed outgoing exit key after Hub completion;
- a width-one normal-door batch targeting `N_PreBoss01`;
- Boss and Postboss completion roles.

N's Hub handoff does not run ordinary preboss eligibility or force-candidate
selection. Its fixed target identity comes from the Hub progression
declaration. The resulting batch and occurrence use the common contracts.

The migration removes `EntryDescriptor`, `FixedEntryDescriptor`,
`FixedAuthoredSlotDescriptor`, the derived `fixedEntry` classification, and
their declaration-linked semantic addresses. N Opening and PreHub are ordinary
authored occurrences connected by the start and linked-exit contracts; N
Preboss is owned by the completed-Hub batch.

### Fixed Opening Start

`fixedAuthored` accepts an authored Room Declaration of kind `Intro` or
`Opening`. It rejects a mismatched biome, a derived room, any other Room kind,
or more than one room identity. `N_Opening01` is the fixed `Opening` instance.

The change must remain descriptor-driven; do not add a biome-key exception for
N.

### Catalog Version

The production catalog version changes from `0.14.0-f-rewards` to:

```text
0.15.0-unified-biome-decisions
```

Profiles and persisted projects must match the new catalog version exactly.

## Authored Project Contract

### Common Plan and Topology

Schema 9 uses one biome plan:

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
```

`topology: null` is the only missing-start state. Once `CreateStart` creates a
topology, `startOccurrenceId` is required and references its authored start
occurrence. Every decision remains a complete discriminated structure. The
common occurrence registry owns linked targets, batch targets, Hub open
targets, and preboss targets.

Common topology validation preserves the existing structural guarantees:

- occurrence IDs are unique and every occurrence has exactly one structural
  owner;
- every decision has one valid semantic source and at most one decision exists
  for that source;
- target exit keys are declaration-owned, unique within their decision, and
  reference occurrences in the same biome;
- a selected target belongs to its decision, while one-target selection is
  derived and a selectable multi-target decision may remain unresolved;
- downstream decisions continue only from the selected spine or an explicitly
  declared stable region such as N Hub;
- unpicked targets remain real dead leaves and cannot own downstream
  decisions;
- decision cycles, detached decisions, duplicate Hub regions, and unreferenced
  occurrences fail decoding;
- declaration bounds for decisions, targets, Hub membership, and visits remain
  enforced by their owning progression variants.

The common envelope does not authorize arbitrary branches, multiple
continuations from one source, or array position as reachability.

### Exit Decision

An exit decision records:

- a stable semantic source;
- one linked normal exit or normal-door batch;
- the selection owner;
- no rendered row, panel, lane, or position.

`ExitDecisionSource` supports:

- an authored source Room Occurrence;
- the stable completed-Hub decision role.

The Hub source form is required because N's outgoing preboss batch follows the
Hub region rather than one restored Hub appearance.

N's no-detour progression makes the stable Hub decision authorable only after
the linked PreHub occurrence is selected and entered. The decision's
`HubDecisionAddress` does not contain that predecessor ID; progression
validation proves reachability. A future Chaos resumption can therefore reach
the same address without creating a second board.

### Linked Normal Exit

The N Opening exit records:

- the Opening occurrence as source;
- a catalog-declared linked exit key;
- the PreHub occurrence reference;
- no arbitrary room name;
- no generated batch policy or reward-store state.

When it is the only exit, selection is derived. PreHub remains a real authored
Room Occurrence because it owns incoming reward and lifecycle state.

### Normal-Door Batch

A normal-door batch preserves all variant-owned facts:

- source;
- declaration-owned physical or semantic exit keys;
- batch reward-store state when exposed;
- declaration-owned batch state;
- target occurrence references;
- decision-owned picked target when selection is not derived.

The batch does not persist whether it is a preboss takeover. Validation derives
that state from its targets and catalog policy.

For a takeover preboss, one semantic command creates or replaces the complete
batch atomically. Creation receives all required occurrence IDs and creates:

- one target per normal exit;
- the Shop realization at the first declared exit;
- counted-free realizations at remaining exits when the declaration provides
  them;
- one unresolved selection for a multi-target batch;
- a derived selection for a width-one batch only because schema 9
  provides no competing special exit.

Repair matches existing targets by stable exit key. It retains an occurrence ID
and room-local state only when the Preboss declaration and the derived
Shop-versus-free leaf contract are compatible under the existing
declaration-owned replacement policy. The application allocates occurrence IDs
only for newly required exit keys and passes them to the atomic repair command.
The command removes unavailable targets explicitly. If exit order changes a
surviving target from Shop to counted-free or vice versa, that target receives
the complete default state for its new leaf contract rather than carrying
incompatible state across the role change.

The Shop-versus-free occurrence role is derived from the declaration policy and
exit order during decoding, default construction, materialization, and reward
processing. It is not persisted as a legacy role-specific flag or an equivalent
duplicate.

Ordinary generated batches use their progression-owned reward-store and batch
state. A takeover preboss batch uses its preboss offer policy and only the
source reward-store provenance explicitly required by that progression. It
does not inherit an unrelated Fields cage outcome or Clockwork batch field. I
remains an ordinary Clockwork batch and therefore retains its ordinary batch
state while admitting one Preboss target.

I continues to create targets through the ordinary generated-target workflow.
Selecting `I_PreBoss02` for one exit does not rewrite its normal peers.

An individual target in a takeover batch is not arbitrarily replaceable. A
repair or replacement dispatches the same whole-batch semantic command; only I
retains ordinary per-target Preboss selection.

### Hub Decision

The current no-detour route reaches the N Hub decision from entered PreHub. The
Hub decision is addressed by its stable semantic role rather than that
predecessor, so a future detour can reach the same Hub region without changing
board identity.

The Hub decision owns:

- the derived persistent `N_Hub` lifecycle role, which is not an authored Room
  Occurrence;
- the catalog-fixed physical board;
- nine or ten open fixed slot references;
- one occurrence and complete incoming reward for every open slot;
- six distinct ordered visit references;
- occurrence-owned side-room generation, rewards, and entered order;
- parent and Hub restore semantics;
- the six-visit completion predicate;
- closure of ordinary Hub exits;
- availability of one declaration-fixed outgoing preboss exit.

It does not own N Preboss room-local state. Completing the Hub permits a
separate width-one normal-door batch whose occurrence owns that state.

### Structural Commands

Commands remain semantic and variant-specific. The target command language
must support:

- `CreateStart`, which receives a selected game name only for
  `authoredChoice` and derives the declaration-fixed game name for
  `fixedAuthored`;
- `CreateLinkedExit`, which atomically creates the declaration-fixed target
  occurrence and its exit decision;
- `CreateBatch` and `CreateTarget` for progressively authored ordinary
  normal-door batches;
- `CreateTakeoverBatch`, `ReplaceWithTakeoverBatch`, and
  `ReconcileTakeoverBatch`, each atomic over the complete takeover shape;
- `ReconcileBatchExitCapacity` for explicit ordinary-batch capacity repair;
- `CreateHubDecision` and the existing Hub slot, visit, and side-room edits
  migrated to `HubDecisionAddress`;
- `SetExitSelection` as the one shared authored-selection command;
- `RemoveExitDecision` and `ClearTopology` for explicit structural deletion;
- occurrence-owned room-state edits.

The migration removes the specialized production commands:

- `CreateHubTopology`;
- `CreateTerminalTransition`;
- `SetPicked`;
- `SetTerminalPicked`;
- `ReconcileExitCapacity`;
- `ReconcileTerminalExitCapacity`;
- `RemoveBatch`;
- `RemoveTerminalTransition`;
- `ReplaceWithTerminalTransition`;
- `ReplaceWithBatch`.

These command names and semantic scopes are the target contract. Selecting a
preboss on one target row and leaving ordinary peers behind is never an
intermediate authored state.

One command produces one undoable authored transition. Focus and navigation
remain outside authored history.

### Schema 9 Boundary

Schema 9 is a clean authority boundary:

- schema 8 documents are rejected;
- no automatic v8-to-v9 migration invents decision or N progression state;
- stale autosave/profile payloads remain preserved through the existing
  blocked-recovery path;
- schema 9 codecs, fixtures, profiles, recovery behavior, and test builders
  update together;
- no permanent parallel plan family or dual-schema compatibility type remains.

Do not add cross-schema adapters to keep downstream layers compiling during the
transition. A downstream layer may remain broken until its owning slice updates
it, but the catalog and authored-project authorities established by the first
slice must not expose both schema 8 and schema 9 production contracts.

## Semantic Ownership and Addresses

Introduce `ExitDecisionAddress`, `ExitSelectionAddress`, and
`HubDecisionAddress`. Every address is based on a semantic source and
declaration-owned exit key, never a rendered index.

Remove `ContinuationAddress`, `PickedAddress`, `FixedEntryRoomAddress`,
`FixedEntryRewardAddress`, and `FixedEntryTargetAddress`. Migrate
`BatchRewardStoreAddress` and `TargetAddress` so they contain
`ExitDecisionAddress` plus their declaration-owned subordinate key instead of
`parentOccurrenceId` or rendered `exitIndex`.

| Owner                              | Required semantic address                                              |
| ---------------------------------- | ---------------------------------------------------------------------- |
| biome start and room-local leaves  | `OccurrenceAddress`                                                    |
| exit decision from a room          | `ExitDecisionAddress` with source occurrence identity                  |
| exit decision from completed N Hub | `ExitDecisionAddress` with `HubDecisionAddress` source                 |
| normal target                      | `TargetAddress` with decision identity plus declaration-owned exit key |
| exit selection                     | `ExitSelectionAddress` for the enclosing exit decision                 |
| Hub decision                       | `HubDecisionAddress` with the catalog Hub decision key                 |
| Hub open set                       | `HubOpenSetAddress`                                                    |
| Hub physical slot                  | `HubSlotAddress`                                                       |
| Hub visit                          | `HubVisitAddress`                                                      |
| side room and local reward         | `LocalChildAddress`, `LocalChildGroupAddress`, or `LocalRewardAddress` |
| Boss/Postboss completion           | `CompletionRoomAddress`                                                |

N uses catalog semantic key `prehub` for the Opening-to-PreHub linked exit,
`hub` for its persistent Hub decision, and `preboss` for the dedicated outgoing
position. None is addressed by rendered chronology such as "the node after
visit six." Generated exit numbers remain valid declaration-owned physical
keys.

Changing a decision or source room clears or retains downstream state only
through explicit structural commands. Room replacement keeps compatible
occurrence-owned leaves according to the existing declaration-owned reward
profile policy.

## Simulation Contract

### Common Evaluation Envelope

The project simulator exposes one biome evaluation envelope:

```ts
interface BiomeEvaluationBase {
  biomeKey: string;
  origin: BiomeAddress;
  authoring: 'incomplete' | 'complete';
  coverage: BiomeEvaluationCoverage;
  findings: readonly SemanticFinding[];
}
```

The route evaluator evaluates the common biome envelope and dispatches
decisions through explicit typed functions rather than choosing a
layout-specific evaluator.

### Ordered Evaluation

Simulation processes:

```text
start lifecycle
  -> exit or Hub decision
  -> selected target lifecycle
  -> next decision
  -> ...
  -> selected declaration-completing Preboss target
  -> completion lifecycle
```

Decision evaluators own:

- linked normal exit: declaration-fixed target and incoming leaf;
- normal-door batch: candidate validity, batch-shape validation, ordered offers,
  and selected target;
- Hub: atomic board, visits, side rooms, restores, and completed-Hub handoff.

Shared orchestration owns initialization, counters, history folding, room
lifecycle, completion walking, findings aggregation, and route-prefix handoff.

The simulation uses no completion-only derived vocabulary whose only purpose
was an older topology split. A selected Preboss is the selected target of its
normal-door batch; the common decision walk then starts the completion tail.
Preboss Shop and counted-free occurrences retain distinct lifecycle behavior
through declaration-derived offer roles, not specialized materializer branches.

The common completion composer receives that entered Preboss occurrence as its
predecessor. When a progression such as O carries resolved source reward-store
provenance into completion, the selected normal-door batch supplies that
provenance directly; it is not hidden in a replacement completion wrapper. Boss
and Postboss keep their existing completion-role addresses and lifecycle order.

### Candidate Validity and Appearance Validation

Simulation and candidate queries must keep these checks separate:

```text
pre-decision history and source
  -> eligibility, force, caps, compatibility
  -> valid or required room appearances

authored normal targets
  -> preboss appearance policy
  -> valid or invalid complete batch shape

exit selection
  -> entered target continuation effect
```

The current candidate API evaluates room alternatives one physical target at a
time. That remains correct for ordinary batches and I, but it is not the
authoring boundary for a takeover preboss. The engine therefore adds one
source-owned takeover-batch candidate domain:

```ts
interface TakeoverPrebossBatchCandidateQuery {
  kind: 'takeoverPrebossBatch';
  source: ExitDecisionAddress;
  gameName: string;
}
```

This is one query for one declaration at one semantic source, not one query per
target. Its evaluation:

- evaluates the Preboss declaration against the exact pre-decision history;
- evaluates eligibility, force pressure, caps, and source compatibility across
  the declaration-owned normal exits in game order;
- decides appearance once for the batch, then validates the complete takeover
  shape rather than treating later targets as independent authored picks;
- returns one support result plus the complete declaration-owned normal-exit
  key order and required target count;
- does not allocate occurrence IDs, mutate authored state, or return UI
  callbacks;
- is unavailable at the same progressive frontier that blocks the source
  decision.

For generated sources in F/G/H/O/P/Q, support comes from ordinary
room-generation evidence. N uses the same result and workspace-interaction
shape, but its fixed Hub handoff is unavailable until the six-visit completion
predicate and then required by declaration; it does not run ordinary Preboss
eligibility or force selection.

Ordinary per-target room candidate domains omit takeover Preboss declarations.
I's `retainNormalPeers` Preboss remains in the per-target domain. The
application binds the source-owned result to one workspace interaction; only
the application interaction adapter allocates identities for exit keys that do
not already retain compatible occurrences. The semantic command receives the
complete retained/new mapping and applies the authored batch.

Required fixtures prove:

- an ineligible preboss target is rejected;
- force pressure rejects a batch that omits its required preboss;
- a source-owned takeover candidate reports one complete ordered batch and is
  absent from ordinary per-target candidate domains;
- one takeover-preboss appearance requires every normal target to use the same
  declaration;
- first and remaining offer roles follow declared exit order;
- O and Q width-one batches derive Shop and selection;
- I permits one preboss beside an ordinary peer;
- N's batch is unavailable before Hub completion and fixed afterward;
- selecting a preboss target, not merely offering it, starts completion.

### Progressive Coverage

Progressive evaluation stops at the exact semantic frontier:

- missing start;
- incomplete linked target leaf;
- incomplete ordinary or preboss normal-door batch;
- incomplete atomic Hub board or visit frontier;
- missing completed-Hub outgoing batch;
- invalid or blocked semantic owner.

The Hub board remains one atomic generation region. It is never evaluated as a
prefix of its rendered slots. Structurally representable later state remains
visible while contextual evaluation is blocked by the first invalid upstream
frontier.

### History and Reward Parity

The representation change must preserve observable supported behavior:

- F/G/H/P retain their existing Shop-then-free preboss creation, offer,
  selection, acquisition, and entry history;
- an offered but unpicked Shop preboss owns no materialized WorldShop inventory
  or purchase history;
- O/Q retain one Shop preboss occurrence and existing reward-store provenance;
- I retains mixed generated batches and repeatable declined preboss offers;
- N retains one Preboss creation after six visits, its WorldShop lookup,
  selected entry, and completion sequence;
- all Hub board offers, including unvisited targets, remain in history and the
  Hub reward lookup;
- Boss/Postboss order and transition resets remain unchanged.

N's authored topology becomes progressive rather than precreating Opening,
PreHub, and Preboss in one `CreateHubTopology` command. That intentional
authored-state change must not alter canonical lifecycle timing or reward
history.

## Deferred Chaos Extension Contract

The unified biome-decision contract adds no Chaos behavior, but it fixes the
ownership needed by the later feature.

When Chaos enters scope:

1. a supported room workbench exposes `Add Chaos Gate`;
2. that command creates a real special exit and Chaos Room Occurrence;
3. the existing exit decision combines its normal member and special exit for
   one selection;
4. normal-door takeover ignores the Chaos exit;
5. an unpicked Chaos or preboss occurrence remains a real unentered offer;
6. entering Chaos uses its declared resumption policy and may lead to another
   preboss batch.

N Opening is the concrete linked-normal example. A preboss-frontier source with
normal doors is the concrete takeover example.

For N, choosing the future Chaos exit leaves the offered PreHub occurrence
unentered and resumes at the stable Hub decision according to the future
detour policy. It does not retroactively select PreHub or create a second Hub
board.

Chaos does not become:

- an ordinary generated peer;
- a room-local encounter phase;
- a Hub slot;
- a boolean gate marker without its Room Occurrence and reward;
- an empty placeholder collection in persisted authored state.

## Structured Workspace Contract

### Shared Workspace

Every biome renders through one `BiomeWorkspace`. It owns:

- the ordered route rail;
- transient semantic focus;
- default-focus progression;
- findings and status markers;
- finding-to-focus resolution;
- the focused inspector shell;
- keyboard and pointer interaction;
- responsive rail and inspector layout.

React consumes the structured projection. It does not inspect authored decision
arrays to reconstruct topology or evaluate eligibility.

### Workspace Nodes

The projection uses an explicit discriminated union:

```ts
type WorkspaceNode =
  | WorkspaceLinkedExitNode
  | WorkspaceOrdinaryBatchNode
  | WorkspaceTakeoverBatchNode
  | WorkspaceMixedBatchNode
  | WorkspaceHubDecisionNode
  | WorkspaceOccurrenceWorkbenchNode
  | WorkspaceCompletionNode;
```

There is no separate Preboss workspace node. Preboss occurrences and their
normal-door batch use shared batch and occurrence-workbench projections.

A linked-only exit decision does not need a visible choice workbench. The
projection advances to its target Room node. If a future special exit makes
selection meaningful, the same `ExitDecision` can project a combined exit
choice without moving room ownership.

At a takeover-capable frontier, the workspace projects one whole-batch Preboss
action from engine candidate evidence. It never exposes the takeover Preboss
through an ordinary single-target replacement control. Existing takeover
targets remain individually inspectable for their occurrence-owned rewards and
findings, while replacement and repair stay atomic. I continues to expose its
Preboss through the ordinary target picker because its declaration retains
normal peers.

`WorkspaceInteractionCatalog` gains an explicit source-owned batch interaction
descriptor alongside its existing per-control candidate interactions. The
descriptor captures the semantic decision owner, lazily loads the one engine
candidate domain, and exposes one confirmed action to the application
interaction adapter. That adapter allocates the occurrence IDs required by the
evidence and dispatches the atomic command. React does not infer exit count,
order, Preboss identity, or support from room declarations or from the
currently rendered targets.

Use exhaustive switches, not renderer registries or optional capability bags.

### Hub Decision Workbench

The Hub workbench is the one specialized N surface. It owns:

- board initialization;
- selection of nine or ten fixed physical slots;
- every open main-room incoming reward;
- the complete six-position visit order;
- board and visit completeness summaries;
- the completed-Hub handoff action;
- board-, slot-, reward-, visit-, and handoff-owned findings.

All 26 physical slots appear in declaration-owned door order. Closed slots stay
visible and compact. Open slots show room, reward summary, assessment, visit
status, and findings. Main rooms cannot be replaced arbitrarily.

### Visit Room Workbenches

Room 1 through Room 6 are stable `HubVisitAddress` destinations. Each resolves
its selected slot to the existing main-room occurrence and uses the shared
occurrence workbench for:

- read-only main-room context;
- side-room generation;
- entered-side order;
- side-room rewards;
- local findings and candidate feedback;
- useful restore landmarks.

Membership, main-room reward, and visit order remain in the Hub workbench.
Side-room state remains occurrence-owned through visit reordering.

### Preboss and Completion

The completed-Hub action creates the common width-one batch. N Preboss uses the
shared occurrence workbench. Boss and Postboss use shared read-only completion
nodes and existing semantic completion addresses.

### Retained Repair Projection

Retained unavailable exits, detached downstream consequences, and incomplete
takeover shape remain visible at their semantic decision owner. The workspace
projects the exact repair scope and the owning structural command; React does
not rediscover which occurrences or leaves will be removed.

This projection and its semantic repair workflows are part of the unified
refactor. They do not depend on replacing the browser confirmation surface.

### Follow-Up Destructive Confirmation

The follow-up polish commit changes no catalog, authored-project, simulation,
candidate, or semantic-repair contract.

Browser-native `globalThis.confirm` is removed from production. Destructive
route shrink, topology clear, Hub membership removal, exit-capacity repair, and
takeover repair use one accessible application dialog built on
`@radix-ui/react-dialog`.
Application-owned UI-session state stores the pending semantic intent and
human-readable deletion scope. The dialog primitive owns focus trapping,
keyboard dismissal, labelling, and focus return, but it does not determine
domain deletion.

Confirming dispatches exactly one semantic command and therefore creates one
undoable authored transition. Cancelling or dismissing changes no authored
state, evaluation, autosave, or undo history.

## Pre-Reconciliation Code Anchors (Historical)

This table records the code shape that motivated the reconciliation when this
tracker opened. Its old names and revision terminology are preserved as
chronological evidence; the current authority is the active status and the
stable design documents above, not the left-hand column below.

| Boundary              | Current authority                                                                                                          | Required transition                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Raw catalog layout    | `packages/hades2-catalog/src/declarations/types.ts` defines Linear and Hub layout variants                                 | one biome envelope with explicit progression variants                             |
| Catalog normalization | `packages/hades2-catalog/src/compiler/layouts.ts` dispatches whole-layout and terminal kinds                               | shared envelope compiler, progression validation, and preboss batch policy        |
| Normalized catalog    | `packages/planner-engine/src/catalog-schema/index.ts` defines `LinearBiomeLayout`, `HubBiomeLayout`, and terminal policies | one layout with no top-level terminal family                                      |
| Preboss leaf policy   | room templates, `entryOfferPolicy`, and terminal occurrence roles split Shop from free rewards                             | one Preboss template; batch policy and exit order derive offer roles              |
| Persisted project     | `packages/planner-engine/src/authored-project/model.ts` schema 8 defines Linear and Hub plans                              | schema 9 common plan, occurrence registry, and `ExitDecision \| HubDecision`      |
| Topology commands     | `CreateBatch`, `CreateTerminalTransition`, and `CreateHubTopology` use separate paths                                      | common exit commands, atomic takeover batch command, and progressive Hub creation |
| Semantic addresses    | `ContinuationAddress` assumes `parentOccurrenceId \| null`                                                                 | exit-decision sources support occurrences and stable Hub identity                 |
| Simulation            | `simulation/project.ts` dispatches Linear or Hub evaluation                                                                | common biome evaluator with exit and Hub decision evaluators                      |
| Candidate boundary    | room topology candidates are queried per physical target                                                                   | source-owned takeover-batch candidate domain plus ordinary per-target domains     |
| Canonical history     | terminal entries, outcomes, sources, and adapters wrap the completion tail                                                 | selected Preboss target followed by common completion traversal                   |
| Progressive products  | materialization, history, rewards, generation, and candidates have Linear/Hub roots                                        | shared orchestration with variant-owned algorithms                                |
| Workspace projection  | `structuredWorkspace.ts` defines Linear/Hub products and per-control interactions                                          | one workspace envelope, explicit node union, and atomic batch interaction         |
| React composition     | `App.tsx` chooses `LinearWorkspace` or `HubBiomeEditor`                                                                    | projection-driven `BiomeWorkspace`; Hub survives only as one workbench            |
| Destructive UI        | shell and biome editors call `globalThis.confirm` directly                                                                 | application-owned pending intent and one accessible shared dialog                 |

The destructive-UI transition belongs only to follow-up Commit 5. Commits 1,
2, 3a through 3c, and 4 own every other transition in this table.

## Implementation Order

The implementation follows dependency ownership rather than preserving a
working application after every commit:

```text
catalog and authored project
  -> simulation and planner-engine products
  -> application projection and schema-9 fixtures
  -> shared biome workspace
  -> Hub integration and application cutover
  -> unified-contract closure
  -> presentation and accessibility polish
```

An intermediate commit may leave a temporarily non-working checkout when that
produces cleaner ownership boundaries. Commits 1, 2, 3a, and 3b may therefore
leave known downstream TypeScript or product-test failures. This is not
permission to leave the layer owned by the commit half-migrated, introduce dual
schema contracts, or add compatibility adapters solely to keep later layers
green.

Each temporary-breakage commit must:

- pass its narrow owning test lanes and `git diff --check`;
- remove superseded production contracts from the layers it owns;
- name the expected downstream failures in its handoff or commit body;
- distinguish expected dependency fallout from an owning-layer failure;
- leave no runtime fallback that guesses old or new domain semantics.

Commit 3a removes schema 8 from application projections and fixtures. Commit 3b
builds the shared workspace against that projection without retaining an
adapter to the old editors. Commit 3c restores the connected application:
repository-wide type checking, planner and product tests, and the production
build become required again. Commit 4 runs the complete repository gate and
closes the unified biome refactor. Commit 5 then replaces global confirmation,
completes broader visual and accessibility polish, reruns the complete gate,
and closes the tracker.

## Implementation Slices

### Commit 1: Establish the Unified Catalog and Authored Model

Suggested subject:

```text
refactor(planner): define unified biome decisions and preboss batches
```

Deliver:

- replace raw and normalized Linear/Hub whole-layout unions with one biome
  envelope and explicit progression variants;
- remove the top-level terminal policy;
- replace `ForkedPreboss`, `ShopPreboss`, `entryOfferPolicy`, and terminal
  occurrence roles with one authored Preboss template and complete
  declaration-owned batch policies;
- make takeover remaining offers explicitly counted or absent, and reject an
  absent policy for any supported multi-normal-exit source;
- derive completion from selection of a Preboss Room Declaration instead of a
  duplicated terminal or `closesBiomeWhenPicked` flag;
- normalize F/G/H/O/P/Q as takeover preboss batches;
- retain I as a mixed generated batch;
- declare N Opening, linked PreHub, Hub decision, completed-Hub handoff, and
  fixed width-one preboss batch;
- replace the old start modes with `authoredChoice | fixedAuthored`; make
  `CreateStart` accept a selected game name only for `authoredChoice` and derive
  the sole declared identity for `fixedAuthored`;
- make `topology: null` the only missing-start state and require a non-null
  `startOccurrenceId` in every `BiomeTopology`;
- remove unused fixed-entry, fixed-authored-slot, and derived-fixed-entry
  production descriptors;
- replace catalog lifecycle profile keys and authored room-state role handling
  whose only meaning is the removed terminal taxonomy with Preboss
  Shop/free-offer language;
- bump the catalog version to `0.15.0-unified-biome-decisions`;
- replace `LinearBiomePlan | HubBiomePlan` with schema 9
  `AuthoredBiomePlan`;
- introduce `ExitDecision | HubDecision`, common occurrence ownership, common
  selection ownership, and Hub-capable exit sources;
- encode exit selection explicitly as `derived`, `unresolved`, or a selected
  declaration-owned normal exit key, with structural validation of each state;
- migrate existing ordinary generated continuations without weakening their
  batch invariants;
- preserve the existing declaration-owned compatible-leaf retention policy for
  ordinary room replacement and stable-key takeover repair;
- remove direct/forked/fixed terminal authored variants;
- replace specialized terminal commands with common exit commands and an
  atomic takeover-batch command;
- remove terminal-form conversion commands rather than retaining unreachable
  repair paths;
- replace `CreateHubTopology` with progressive start, linked exit, Hub, and
  completed-Hub batch commands;
- update downstream clearing, capacity reconciliation, undo, and redo inside
  the authored-project layer;
- introduce `ExitDecisionAddress`, `ExitSelectionAddress`, and
  `HubDecisionAddress`; remove the old continuation, picked, and fixed-entry
  addresses; migrate target and batch-store addresses from parent occurrence
  plus rendered exit index to decision identity plus declaration-owned exit
  key;
- make the project codec reject schema 8 without attempting migration;
- remove all old-plan, old-layout, old-terminal, and dual-schema production
  types from the catalog and authored-project layers;
- update the catalog, authored-state, decision, and biome authority documents
  owned by these contracts;
- add no Chaos production state or behavior.

Tests:

- normalized catalog snapshots for F through Q;
- compiler rejection for malformed progression and preboss policies;
- compiler rejection for takeover caps or exit compatibility that cannot fill
  every normal exit of a supported source;
- compiler rejection for a width-one-only remaining-offer policy on any
  multi-normal-exit source;
- exact N start, linked exit, Hub handoff, width-one preboss, and completion
  declarations;
- fixed-start command coverage proving the declared identity is derived and
  cannot be substituted;
- codec rejection of a topology without a valid start occurrence, with
  `topology: null` as the only missing-start representation;
- schema 9 codec round trips for every decision and normal-exit variant;
- exact semantic-address round trips for room-sourced and Hub-sourced exit
  decisions, selections, batch stores, and targets;
- explicit schema 8 and stale-catalog codec rejection;
- malformed exit, batch, Hub, and selection rejection, including duplicate
  sources, detached decisions, cycles, dead-leaf continuations, and
  multiply-owned or unreferenced occurrences;
- derived, unresolved, selected-normal, and invalid selection-state fixtures;
- no persisted terminal shop/free role and no obsolete fixed-entry descriptor
  or semantic-address round trip;
- start, linked-exit, ordinary-batch, takeover-batch, and Hub structural command
  undo/redo;
- atomic takeover creation with no partial ordinary peers;
- atomic takeover repair retains compatible stable-key occurrences, allocates
  only new exits, and defaults targets whose derived Shop/free contract changes;
- stable occurrence identity through reward edits and visit reordering.

Gate:

- the catalog and authored-project layer expose only the new authority;
- every non-null topology has one valid authored start, and fixed starts cannot
  substitute a different Room Declaration;
- continuation, picked, fixed-entry, parent-occurrence batch-store, and
  rendered-index target addresses are absent from production;
- every decision variant fails loudly on incomplete structural contracts;
- catalog and targeted authored-project tests pass;
- `npm run typecheck --workspace @run-planner/hades2-catalog`,
  `npm run test:catalog`,
  `npx vitest run packages/planner-engine/test/authored-project`,
  `npm run format:check` and `git diff --check` pass;
- simulation, application type checking, and product tests may fail only
  because they still consume removed schema 8 contracts, and those failures are
  recorded for Commit 2 or Commit 3a.

### Commit 2: Migrate Simulation and Planner-Engine Products

Suggested subject:

```text
refactor(planner): evaluate unified biome decisions
```

Deliver:

- replace whole-biome evaluation dispatch with one common evaluator;
- implement exit-decision and Hub-decision evaluators against schema 9;
- keep candidate validity separate from preboss batch-shape validation;
- preserve variant-owned completeness, progressive frontier, generation,
  reward, history, candidate, and validation algorithms;
- add a source-owned takeover-batch candidate domain and exclude takeover
  Preboss declarations from ordinary per-target candidate domains;
- migrate materialization, progressive evaluation, history, rewards,
  generation, validation, candidates, lifecycle composition, route-prefix
  composition, and public exports;
- preserve truthful complete, incomplete, invalid, retained, and blocked
  products;
- make takeover shape declaration-derived and atomic while candidate
  eligibility, force pressure, caps, and reroll history remain validity inputs;
- derive takeover Shop/free materialization, lifecycle, and reward processing
  from policy plus declared exit order;
- ensure takeover batches do not acquire ordinary Fields or Clockwork batch
  state, while I retains its ordinary Clockwork state;
- preserve I's mixed batch, O/Q's width-one batches, and N's completed-Hub
  width-one handoff;
- remove old Linear/Hub evaluation envelopes and terminal-specific simulation
  products;
- remove `CanonicalTerminalEntry`, `entersTerminal`, `layoutTerminal`, and the
  terminal adapter from history composition and public exports;
- update simulation, lifecycle, reward, finding, and history authority
  documents owned by these contracts;
- add no application adapter and no Chaos production behavior.

Tests:

- complete, incomplete, invalid, retained, and blocked fixtures for all eight
  biomes;
- candidate validity versus appearance-shape fixtures;
- source-owned takeover candidate support, ordered exit evidence, progressive
  unavailability, and per-target exclusion;
- F/G/H/P multi-target Shop/free reward parity;
- unpicked Preboss Shop binding without WorldShop inventory or purchase history;
- H takeover parity without a terminal-only cage outcome;
- O/Q width-one batch parity;
- I mixed and repeatedly declined preboss parity;
- N Hub-completion gating and width-one Shop parity;
- canonical lifecycle, reward, finding, and route-prefix parity from N into O;
- semantic-frontier parity and exact findings at the migrated semantic owner
  addresses.

Gate:

- the planner engine has one evaluation envelope over the schema 9 decision
  model;
- no simulation product or public engine export consumes the superseded
  Linear/Hub or terminal contracts;
- `npm run typecheck --workspace @run-planner/engine`,
  `npm run test:engine`, `npm run format:check`, and `git diff --check` pass;
- application type checking and planner/product tests may fail only because the
  projection, Redux composition, or React UI still consumes removed engine
  contracts, and those failures are recorded for Commit 3a.

### Commit 3a: Project One Unified Biome Workspace

Suggested subject:

```text
refactor(editor): project unified biome workspace
```

Deliver:

- replace the current `WorkspaceHubBiome | WorkspaceLinearBiome` union behind
  `WorkspaceBiome` with one common envelope and an exhaustive workspace-node
  union over schema 9 products;
- project linked normal exits, ordinary batches, takeover Preboss batches,
  mixed batches, Hub decisions, occurrence workbenches, and completion without
  terminal variants;
- add `WorkspaceHubDecisionNode` as the sole Hub-specific structure node;
- add one source-owned batch-interaction descriptor for takeover creation and
  repair; never expose a takeover Preboss as an ordinary per-target room
  replacement, while I's Preboss remains in its ordinary target domain;
- migrate evaluation, candidate, contextual-option, reward-domain, room-picker,
  finding, focus, and repair-scope projections to the schema 9 semantic
  addresses and candidate result union;
- project truthful empty, partial, invalid, retained, unavailable, and
  upstream-blocked states without reading beyond engine coverage;
- make projected deletion and repair scope explicit so React never infers
  topology ownership;
- migrate the shared Surface and Underworld application fixtures to schema 9
  commands, decisions, selections, and occurrence ownership;
- migrate the workspace Redux boundary and focus-only action contract to the
  new projected owners without putting focus in authored history, evaluation,
  or autosave;
- preserve schema 8 and stale-catalog profile or autosave payloads through the
  existing blocked recovery path; do not migrate or discard them;
- remove schema 8, Linear/Hub whole-biome, continuation, picked, terminal, and
  old candidate-wrapper contracts from application projections and fixtures;
- do not add a React compatibility adapter or Chaos production behavior.

Tests:

- exhaustive workspace-node projection and dispatch;
- linked exits, ordinary batches, takeover batches, I mixed batches, Hub, and
  completion in exact semantic order;
- empty, partial, complete, invalid, retained, unavailable, and
  upstream-blocked projections;
- atomic F/G/H/O/P/Q/N takeover descriptors and I ordinary Preboss targeting;
- exact projected repair scope for retained ordinary and takeover structure;
- candidate unavailability evidence at the migrated semantic owner;
- finding, focus, and default-progression projections;
- focus-only Redux actions remain outside authored history, evaluation,
  autosave, and candidate work;
- schema 8 and stale-catalog profile/autosave payloads remain blocked and
  preserved;
- deterministic, frozen Surface and Underworld workspace fixtures.

Gate:

- application projections and fixtures consume only schema 9 and the current
  planner-engine products;
- `WorkspaceBiome` has one envelope and an exhaustive node union;
- projection code contains no obsolete Linear/Hub whole-biome, continuation,
  picked, or terminal contract;
- no projection guesses topology repair, candidate support, reward state, or
  lifecycle facts;
- focused projection, Redux, fixture, and recovery tests pass;
- remaining TypeScript or product-test failures are confined to the old React
  composition that Commit 3b and Commit 3c replace and are recorded in the
  handoff;
- `npx vitest run apps/planner/src/projections
apps/planner/src/state/projectWorkspaceSlice.test.ts
apps/planner/src/persistence/autosaveRecovery.test.ts
apps/planner/src/workspace/projectOperations.test.ts` passes;
- `npm run lint`, `npm run format:check`, and `git diff --check` pass.

### Commit 3b: Build the Shared Biome Workspace

Suggested subject:

```text
refactor(editor): compose shared biome workspace
```

Deliver:

- introduce `BiomeWorkspace` as the projection-driven composition surface and
  an exhaustive renderer for every non-Hub workspace-node variant under
  `apps/planner/src/ui/editor/biome/`;
- move reusable room, reward, Shop, batch settings, target, occurrence,
  Preboss, Boss, Postboss, finding, and completion controls out of
  `LinearBiomeEditor` and `LinearTopologyEditor` into shared decision and
  occurrence workbenches;
- render fixed starts and linked Opening/PreHub decisions without a false room
  selector;
- render ordinary, staged, mixed, and takeover batches from their projected
  interaction descriptors, including one-command takeover creation and repair;
- preserve I's ordinary Preboss picker beside supported peers;
- move rail order, focus, inspector selection, finding activation, default
  progression, keyboard/pointer interaction, and responsive layout into the
  shared workspace;
- render retained and unavailable decisions from projected state and exact
  repair scope without inspecting authored topology;
- preserve lazy candidate activation and zero candidate queries during
  ordinary rendering;
- keep the new workspace independent of `App.tsx` cutover in this commit so the
  old full-biome editors require no temporary adapter;
- add no Hub-specific traversal logic, application cutover, or Chaos production
  behavior.

Tests:

- unchanged F/G/H/I/O/P/Q rail order, workbench behavior, and focus with schema
  9 semantic addresses;
- linked start and PreHub presentation without a room selector;
- ordinary, staged, mixed, takeover, Preboss Shop, and completion workbenches;
- atomic takeover creation and repair with no transient mixed batch;
- retained and unavailable decision presentation through projected repair
  scope;
- exhaustive non-Hub node rendering;
- pointer, keyboard, finding-navigation, and default-focus behavior;
- lazy candidate activation and zero candidate queries during ordinary render;
- shared room-workbench composition for authored occurrences and derived
  completion rooms without collapsing their domain identities.

Gate:

- the new shared workspace consumes only projected products and semantic
  interactions;
- no new React code owns eligibility, topology repair, reward bags, lifecycle,
  or candidate rules;
- every non-Hub workspace-node variant renders or fails loudly at the
  exhaustive dispatch boundary;
- focused shared-workspace and migrated F/G/H/I/O/P/Q UI tests pass;
- remaining application failures are confined to Hub integration, composition
  cutover, and obsolete editor tests owned by Commit 3c;
- `npx vitest run apps/planner/src/ui/editor/biome
apps/planner/src/ui/editor/rewards` passes;
- `npm run lint`, `npm run format:check`, and `git diff --check` pass.

### Commit 3c: Integrate Hub and Cut Over the Application

Suggested subject:

```text
refactor(editor): render unified biome decisions
```

Deliver:

- implement `HubDecisionWorkbench` as the sole Hub-specific workbench inside
  `BiomeWorkspace`;
- keep Hub membership, compact open-slot summaries, unvisited open-room reward
  editing, visit order, and completion summary inside that workbench;
- replace the 26 complete room cards with compact slot summaries and focused
  editing;
- reuse shared room-workbench components for N Opening, PreHub, selected
  visits, visited-parent side rooms, and Preboss occurrences plus the derived
  Boss and Postboss completion rooms;
- present occurrence-owned side-room state without duplicate visited-parent
  composition and preserve it through visit reordering;
- allow visit authoring only through the Hub workbench;
- make the application shell and Redux composition consume projected
  `WorkspaceBiome` products rather than inspect authored topology;
- switch every configured biome to `BiomeWorkspace`;
- preserve exact route, focus, finding navigation, responsive composition,
  autosave, recovery, undo, and redo behavior at the composition root;
- remove obsolete full-biome ordinary and Hub editors, duplicate visited-parent
  composition, and obsolete standalone Preboss workspace components and tests;
- update editor, workspace, interaction, and audit authority documents owned by
  the completed application cutover;
- resolve every expected downstream compile and product-test failure recorded
  by Commits 1, 2, 3a, and 3b;
- add no Chaos production state or behavior.

Tests:

- exact N route order and semantic activation;
- empty, partial, complete, invalid, and retained N workspaces across its local
  progressive owner boundary; route-prefix-blocked O/P/Q workspaces;
- board opening/closing, compact slot summaries, and unvisited reward editing;
- visit creation, replacement, and removal only through the Hub workbench;
- occurrence-owned side state and entered order through visit reordering;
- N Opening/PreHub presentation without a false room selector;
- N width-one takeover handoff, Preboss Shop, and completion focus;
- all eight biomes render through the same workspace dispatcher;
- application-shell, pointer, keyboard, finding-navigation, and default-focus
  regressions;
- focus-only actions remain outside authored history, evaluation, autosave, and
  candidate work;
- profile, blocked recovery, autosave, undo, and redo integration;
- zero candidate queries during ordinary rendering;
- Surface and Underworld product-loop parity.

Gate:

- one catalog layout, authored biome plan, evaluation envelope, application
  projection, and workspace envelope are authoritative;
- no obsolete whole-biome plan/layout split, specialized Preboss decision or
  transition path, or full-biome ordinary/Hub editor remains;
- the unified project-document contract and current catalog version are the
  only accepted authority;
- every workspace-node variant fails loudly on incomplete structural
  contracts;
- Hub evaluation remains atomic and Hub is the only N-specific workbench;
- no supported canonical lifecycle or reward fact changes unintentionally;
- React contains no eligibility, topology repair, reward, or lifecycle rules;
- no expected temporary compile or product-test failures remain;
- no Chaos production state exists;
- `npm run typecheck`, `npm run test:planner`, `npm run test:contract`,
  `npm run test:product`, `npm run lint`, `npm run format:check`,
  `npm run build`, and `git diff --check` pass.

### Commit 4: Close the Unified Contract

Suggested subject:

```text
test(planner): close unified biome decisions
```

Deliver:

- representative keyboard and pointer workflows across linked exits, ordinary
  batches, takeover preboss batches, I mixed batches, Hub, and completion;
- profile, recovery, autosave, undo, and redo regression coverage;
- updated Underworld and Surface measurements for full rebuild, cold candidate
  projection, representative edit publication, and cached undo; retain the
  existing 750 ms rebuild/candidate/edit thresholds and 50 ms cached-undo
  threshold;
- architecture-boundary tests preventing React-owned topology or engine-owned
  presentation state;
- repair product workflows proving projected deletion scope and one semantic
  command for Hub membership removal, ordinary retained-exit repair, and
  takeover repair affected by the unified workspace;
- final reconciliation of every owning design, biome, audit, implementation,
  and README reference affected by the unified domain and workspace contracts;
- explicit backlog wording for the future Chaos special-exit feature;
- deletion of obsolete terminal, direct/forked, and full-biome Hub terminology
  from production code and current authority statements;
- record the unified biome refactor as closed, with Commit 5 as the sole
  remaining follow-up before the tracker and active Phase 7 frontier advance;
- confirmation that no expected downstream failure recorded by Commits 1, 2,
  3a, or 3b remains.

Chronological progress and migration-provenance entries may retain the
terminology that accurately described their delivered schema at that time.
Do not rewrite history as though schema 9 had always existed. Add a clear
supersession note and update current-summary tables or active-frontier text
instead.

Gate:

- one biome and decision language is authoritative from catalog through UI;
- decision-specific invariants remain explicit and fail loudly;
- workspace-wide fixes have no separate N editor path;
- documentation distinguishes candidate validity, appearance-triggered
  takeover, selection, and Hub handoff;
- the 750 ms rebuild/candidate/edit and 50 ms cached-undo thresholds pass
  without relaxation;
- no Chaos production behavior entered this task;
- `npm run check` and `git diff --check` pass without timeout relaxation.

Commit 4 does not require the global confirmation replacement or the broader
visual-polish acceptance owned by Commit 5. Existing confirmation calls may
remain at this boundary, but no new browser-confirmation path may be added.

Delivered closure evidence:

- Underworld and Surface performance gates measure full rebuild, cold candidate
  projection, representative edit publication, and cached undo against the
  750 ms / 50 ms limits without timeout relaxation;
- product loops cover pointer and keyboard traversal across linked, ordinary,
  takeover, mixed, Hub, and completion decisions; profile, valid recovery,
  autosave, undo, and redo remain covered through the connected application;
- Hub membership closure, ordinary retained-exit repair, and takeover repair
  expose their projected scope and dispatch exactly one semantic command;
- the architecture guard rejects React-owned topology-impact work and
  engine-owned presentation models;
- current authority uses one forward-looking decision and completion vocabulary
  and records Chaos only as a future special-exit extension.

### Commit 5: Complete Workspace Polish and Accessible Confirmation

Suggested subject:

```text
feat(editor): polish unified workspace interactions
```

This is a follow-up to the closed refactor, not another domain-model slice. It
must consume the unified projection and semantic repair commands delivered by
Commits 1, 2, 3a through 3c, and 4 without changing their ownership.

Deliver:

- add `@radix-ui/react-dialog` at the planner application boundary and update
  the package manifest and lockfile;
- replace every production `globalThis.confirm` path with one accessible shared
  destructive-action dialog;
- keep the pending semantic intent and human-readable deletion scope in
  application-owned UI-session state;
- make confirmation dispatch exactly the projected semantic command, with no
  React-owned topology or deletion inference;
- complete visual hierarchy, density, spacing, and responsive polish for the
  board, rail, batch, dialog, and inspector;
- close keyboard, pointer, labelling, focus-trap, dismissal, and focus-return
  behavior for the shared workspace and destructive dialog;
- add confirmation product workflows for route shrink, topology clear, Hub
  membership removal, ordinary exit-capacity repair, and takeover repair;
- update the owning editor, contextual-UX, structured-workspace, audit,
  progress, and README references for the delivered polish;
- mark this tracker delivered and advance the one active progress frontier only
  after the complete gate passes.

Tests:

- destructive-dialog labelling, focus trap, Escape, cancel, focus return, and
  exact visible deletion scope;
- confirmation dispatches one semantic command and creates one undoable
  authored transition;
- cancellation and dismissal change no authored state, evaluation, autosave,
  candidate work, or undo history;
- route shrink, topology clear, Hub membership removal, ordinary retained-exit
  repair, and takeover repair use the shared dialog;
- representative keyboard and pointer workflows remain correct after the
  presentation changes;
- responsive board, rail, batch, dialog, and inspector fixtures;
- architecture-boundary coverage continues to reject React-owned topology,
  repair, reward, or lifecycle rules.

Gate:

- no catalog, authored-project, simulation, candidate, or semantic-address
  contract from Commit 4 changes;
- production contains no `globalThis.confirm`;
- every destructive path renders the projected deletion scope and dispatches
  exactly one semantic command only after confirmation;
- cancelling or dismissing the dialog has no authored or derived side effect;
- the 750 ms rebuild/candidate/edit and 50 ms cached-undo thresholds continue
  to pass without relaxation;
- the final workspace satisfies the visual, responsive, keyboard, and
  accessibility acceptance above;
- no Chaos production behavior enters the follow-up;
- `npm run check` and `git diff --check` pass without timeout relaxation.

## Expected File Scope

Catalog:

- biome layout and room declarations;
- Preboss template, batch-offer, and lifecycle-profile declarations;
- raw declaration types;
- catalog schema and layout compiler;
- catalog version;
- declaration and compiler tests.

Planner engine:

- authored-project model, topology validation, addresses, commands, codec,
  initialization, and project fixtures;
- completeness and candidates;
- materialization, progressive evaluation, history, rewards, generation,
  validation, project evaluation, and public exports;
- affected engine fixtures.

Planner application, unified refactor:

- Redux composition, selectors, and semantic command dispatch;
- profile and autosave recovery integration and fixtures;
- candidate, contextual-picker, navigation, feedback, and reward projections
  affected by the semantic owner changes;
- source-owned batch candidate projection and workspace interaction
  descriptors;
- `apps/planner/src/projections/structuredWorkspace.ts`;
- `apps/planner/src/ui/shell/App.tsx`;
- shared workspace and room/batch workbench components;
- one Hub decision workbench and Hub candidate controls;
- removal of obsolete layout-specific editor exports after moving any reusable
  leaf controls into shared workbench modules;
- refactor-owned shared styles and interaction tests.

Planner application, follow-up polish:

- planner package manifest and lockfile with `@radix-ui/react-dialog`;
- application-owned pending-dialog state and one accessible shared destructive
  dialog;
- presentation-only board, rail, batch, dialog, and inspector style changes;
- destructive-action accessibility and product-interaction tests.

Documentation:

- the owning design documents listed in Status;
- `docs/biomes/F_GAME_RULES.md` through `Q_GAME_RULES.md` where preboss
  terminology or behavior changes;
- `docs/audits/REWARD_GAME_DATA_AUDIT.md`;
- `docs/audits/CROSS_BIOME_EDITOR_UX_AUDIT.md`;
- current-summary and supersession sections in
  `docs/progress/MIGRATION_PROVENANCE.md`;
- `docs/progress/IMPLEMENTATION_PLAN.md`;
- `docs/progress/IMPLEMENTATION_PROGRESS.md`;
- the README documentation map.

## Review Checklist

The completed markers below record the Commit 4 closure. Remaining unchecked
items are Commit 5 final-product revalidation, not unfinished Slice 4 work.

- [ ] One normalized biome envelope exists across catalog, authored project,
      evaluation, projection, and workspace.
- [ ] Parallel layout-specific production splits are removed.
- [ ] No layout-specific React editor remains; only shared workspace composition
      and decision-specific workbenches survive.
- [ ] `NextRoomDecision` contains only exit and Hub decisions.
- [ ] Exit selection belongs to the exit-decision envelope.
- [ ] Normal exits are explicit domain vocabulary.
- [ ] Linked exits and normal-door batches retain distinct invariants.
- [ ] Candidate eligibility/force and appearance-triggered batch shape are
      evaluated separately.
- [ ] Takeover availability is one source-owned candidate domain; takeover
      Preboss declarations do not appear in per-target pickers.
- [ ] One Preboss template and declaration batch policy own every supported
      Shop/free offer role.
- [ ] Preboss selection, not an authored completion flag, starts the completion
      tail.
- [ ] Takeover prebosses fill every normal door and never a special exit.
- [ ] The first preboss occurrence is Shop and remaining occurrences are free
      rewards.
- [ ] O/Q/N explicitly declare no remaining offer and are proven width one.
- [ ] Takeover Shop/free roles derive from exit order and are not persisted.
- [ ] Takeover authoring and repair are atomic; individual target replacement
      remains unavailable.
- [ ] Stable-key takeover repair retains compatible occurrence leaves and
      defaults a leaf when its derived Shop/free contract changes.
- [ ] The workspace interaction descriptor carries engine evidence and React
      does not derive takeover identity, count, order, or support.
- [ ] Takeover batches do not acquire unrelated Fields or Clockwork state.
- [ ] I retains one preboss occurrence beside valid ordinary peers.
- [ ] O and Q use the common width-one preboss batch.
- [ ] N Opening is an authored fixed `Opening`.
- [ ] `topology: null` is the only missing-start representation; every
      non-null topology owns one valid authored start occurrence.
- [ ] Opening-to-PreHub is a linked normal exit.
- [ ] Hub is the sole N-specific traversal decision and workbench.
- [ ] N Hub completion produces a fixed width-one common preboss batch.
- [ ] Hub membership, rewards, visits, side rooms, and handoff have one
      authority.
- [ ] The Hub board remains one atomic generation and coverage region.
- [ ] Every open unvisited Hub reward remains real and editable.
- [ ] Side-room state remains occurrence-owned through visit reordering.
- [ ] Preboss occurrences use shared batch and room workbenches.
- [ ] Boss and Postboss remain derived completion roles.
- [ ] Commands and findings address stable semantic owners.
- [ ] Continuation, picked, and fixed-entry addresses are removed; batch-store
      and target addresses use decision identity and declaration-owned keys.
- [ ] Retained invalid structure exposes projected repair scope and never
      requires React to infer deletion ownership.
- [x] Commit 4 closes the unified biome refactor with a passing complete gate
      before presentation and confirmation polish begins.
- [ ] Commit 5 changes no catalog, authored-project, simulation, candidate,
      address, or semantic-repair contract.
- [ ] Commit 5 replaces browser-native confirmation with one accessible
      application dialog that confirms exactly one undoable semantic command.
- [ ] Schema 9 rejects schema 8 and uses the new catalog version.
- [ ] Obsolete layout-specific entry, completion-form history, and
      completion-form repair APIs are absent from production.
- [ ] No arbitrary room replacement or duplicate visit-order authority exists.
- [ ] No Chaos declaration, state, command, simulator, candidate, or UI behavior
      is added.
- [ ] The exit-decision envelope remains the documented future owner of Chaos
      selection.
- [x] The complete repository gate passes.

Do not mark Phase 7 Commit 12 complete until all five commits and the complete
repository gate pass.
