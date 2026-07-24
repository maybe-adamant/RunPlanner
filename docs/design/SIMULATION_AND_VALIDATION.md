# Simulation and Validation

## Purpose

This document defines the pure derived pipeline from a normalized catalog and
authored project to canonical simulated facts, lifecycle history, validation,
candidate results, and semantic findings.

The simulator is the app's theory of how supported Hades II route generation
behaves. The later game module will test that theory through runtime auditing;
it will not duplicate it.

## Cross-Biome Freeze Status

The possibility-support, materialization, reward-store, fixed-slot, and
persistent-hub contracts in this document are globally locked by the completed
F/G/P/Q/H/O/I/N audit set. All eight biomes participate in one public
completeness, materialization, lifecycle, event-folded history,
room-generation, reward-kernel, project-simulation, selected-plan validation,
and candidate-result boundary across layout-specific canonical snapshots. The
same application composition publishes those results to the editor, profiles,
and recovery workflow for both complete routes.

## Core Contract

```ts
simulateProject(catalog, authoredProject): ProjectEvaluation
```

The operation is:

- pure with respect to authored state;
- deterministic for the same normalized inputs;
- independent of React, Redux, Tauri, filesystem, and game runtime APIs;
- complete enough to return useful incomplete and invalid results;
- strict about malformed catalogs and violated construction invariants.

The implementation performs a full synchronous rebuild after every semantic
edit. Optimization follows profiling rather than speculation.

## Possibility Support Contract

The simulator proves possibility, not probability. At each random game
decision it derives a support set from the catalog and the exact pre-decision
history. The authored project supplies one concrete outcome, and validation
checks whether that outcome belongs to the support set.

The generic decision rule is:

1. derive all eligible outcomes;
2. if any eligible forced outcomes exist, discard the ordinary eligible pool;
3. retain every member of the selected pool as possible regardless of weight;
4. validate the authored outcome by membership.

For chance or ratio boundaries, a value at or below zero removes an outcome, a
value strictly between zero and one keeps both sides possible, and a value at
or above one forces the corresponding side. The simulator may preserve weights
or multiplicity when they change later state, such as counted-bag depletion,
but it never produces likelihood scores, "unlikely" findings, seeded RNG
replays, or probability-based candidate ordering.

## Derived Pipeline

```text
normalized catalog + authored project
  -> normalize every configured topology
  -> walk routes and configured biomes in order
      -> completeness gate
      -> canonical biome snapshot
      -> lifecycle event stream
      -> history and counter ledgers
      -> selected-plan validation
      -> candidate evaluation
      -> semantic findings
  -> route and project summaries
```

The established short form remains:

```text
declaration -> catalog -> history -> validator -> feedback
```

Canonical materialization is the bridge between catalog/authored state and
history. Declarations alone cannot produce history because concrete topology,
rewards, purchases, encounters, and selected exits are authored choices.
`ROOM_LIFECYCLE_MODEL.md` defines the single-room fragments that this pipeline
composes.

## Catalog Boundary

The normalized catalog contains immutable possible facts:

- global biome declarations and route-owned ordered biome references;
- layout variants and structural policies;
- room identity, label, kind, template, exits, eligibility, force, and caps;
- encounter profiles and phase timing;
- local child slots;
- reward types, payload domains, source-support policies, concrete acquisition
  declarations, stores, bags, bindings, and shops;
- normalized current-run requirements whose kinds have registered evaluators;
- batch and terminal policies.

Catalog construction fails for:

- unknown dispatch keys;
- malformed declarations;
- missing current-run requirement evaluators;
- incompatible defaults;
- reward filters outside their store domains;
- ambiguous declaration ordering where order changes simulation.

Save-file progression, unlocks, world upgrades, active bounty overrides,
traits supplied outside the configured run, and prior-run state remain absent
unless the app later introduces explicit project inputs for them. Missing
research is tracked in audits and fixtures, not generic production
`unsupported` records.

## Topology Normalization

Every configured biome topology crosses a structural contact boundary before
semantic processing. Normalization checks bounded representation and produces
a trusted layout-specific topology.

Malformed topology is a contract error, not an incomplete plan. Examples:

- duplicate occurrence IDs;
- unknown game room names;
- dangling topology references to missing occurrences;
- unreferenced persisted occurrences;
- impossible structural indexes;
- contradictory continuation forms;
- downstream continuation owned by an unpicked target;
- unknown layout or policy dispatch keys.

Structurally representable but context-invalid choices remain normalized and
continue to semantic validation.

Repeated `gameName` values are not malformed topology. Each occurrence is
processed independently while creation, appearance, eligibility, and force
ledgers aggregate by the referenced game declaration where the game rule
requires it.

## Biome Processing Horizon

Configured biomes process in route order.

Route evaluation has three ordered regions:

```text
complete-valid biome prefix
  -> one progressively evaluated active biome
  -> blocked downstream biome suffix
```

Only a complete and valid biome may seed the next biome. The active biome uses
that exact route-history seed and evaluates the maximum truthful prefix allowed
by its current authorship. Later authored biomes remain visible and editable,
but they receive no contextual claim until every predecessor is complete and
valid.

For the active biome:

1. check structural contacts and derive the first incomplete semantic owner;
2. materialize every fully authored entry, decision, target-generation point,
   picked-room lifecycle, reward offer, and local child before that owner;
3. fold those operations through the normal history, room-generation, reward,
   and counter authorities;
4. publish addressed findings, pre-decision views, and candidate support for
   every covered owner;
5. retain the incomplete frontier without inventing terminal or completion
   facts;
6. when authorship reaches the declared terminal and completion sequence,
   strengthen the same result into a complete biome evaluation;
7. admit a complete valid result to the route prefix, or stop before the next
   biome when the complete result is invalid.

This is one evaluator and one ordered lifecycle authority. Progressive
evaluation is not a candidate-only simulator and does not publish a second
history interpretation.

### Completion and Coverage Axes

Biome authoring completion and evaluation coverage are separate facts:

```ts
type ProgressiveBiomeEvaluation =
  | {
      readonly authoring: 'incomplete';
      readonly frontier: SemanticAddress;
      readonly coverage:
        | { readonly kind: 'none'; readonly reason: 'notEvaluated' }
        | {
            readonly kind: 'prefix';
            readonly through: BiomeEvaluationPoint;
            readonly blockedAt?: SemanticAddress;
          };
    }
  | {
      readonly authoring: 'complete';
      readonly coverage: { readonly kind: 'complete' };
    };

interface BiomeEvaluationPoint {
  readonly owner: SemanticAddress;
  readonly checkpoint: 'beforeTargetGeneration' | 'afterTargetGeneration' | 'afterRoomLifecycle';
}
```

`BiomeEvaluationPoint` uses a semantic owner and game lifecycle checkpoint,
not a rendered row or decision index. The editor may translate it to
`evaluated through Decision 4`, but UI position never becomes simulation
identity.

An incomplete biome produces no canonical biome snapshot, final biome history,
completion event, or downstream route seed. It may carry a materialized prefix,
prefix lifecycle operations, folded history state, generation views, reward
witnesses, counters, and findings for the owners it actually covered.

A complete biome is the maximal form of that same evaluation. It adds the
terminal and completion sequence, canonical snapshot, final biome history,
selected-plan validity, and the ability to seed the next biome when valid.

If a covered selected value has no supporting pre-state, alternatives at that
owner may still use its last valid pre-decision view for repair. Contextual
claims after an unsupported upstream state remain unavailable; materialized
authored structure alone is not evidence of a reachable game state.

### Route Gate

At most one non-validated biome receives progressive contextual evaluation per
route:

```ts
interface RouteProcessingRegions {
  readonly completeValidPrefix: readonly string[];
  readonly active: {
    readonly kind: 'incomplete' | 'invalid';
    readonly biomeKey: string;
  } | null;
  readonly blockedSuffix: readonly string[];
}
```

| Route state                        | Contextual evaluation                                           |
| ---------------------------------- | --------------------------------------------------------------- |
| F incomplete                       | F prefix only; G/H/I blocked                                    |
| F complete invalid                 | F local evaluation and repairs; G/H/I blocked                   |
| F complete valid, G incomplete     | F seeds G; G prefix evaluated; H/I blocked                      |
| F/G complete valid, H incomplete   | F/G seed H; H prefix evaluated; I blocked                       |
| F/G/H/I complete and valid         | Complete route is eligible for later execution-plan compilation |
| N incomplete                       | N semantic prefix only; O/P/Q blocked                           |
| N complete valid, O incomplete     | N seeds O; O prefix evaluated; P/Q blocked                      |
| N/O/P complete valid, Q incomplete | N/O/P seed Q; Q prefix evaluated                                |
| N/O/P/Q complete and valid         | Complete route is eligible for later execution-plan compilation |

Blocked biome pages may still expose declaration-derived authoring domains.
They must label contextual state unassessed and must not simulate from defaults
or hypothetical predecessor completions.

The authoring/coverage axes and route processing regions are the production
result shape. Complete biomes publish `coverage: complete`. Incomplete Linear
biomes now publish a materialized prefix, partial lifecycle history, generation
proof, reward witnesses, counters, and addressed findings whenever their entry
can be reached. An unsupported generated choice clamps that prefix at its
generation, while an unsupported entered-room lifecycle clamps it before the
next generation point. Persisted downstream authorship remains untouched but
receives no contextual claim. A Linear biome whose authored start cannot yet be
materialized publishes `coverage: none`.

Incomplete Hub biomes publish the same partial products through fixed entry,
the jointly generated board, and complete visits in authored order. Board
coverage is atomic under the `hubOpenSet` semantic owner: fewer than the
required open slots stops before board generation, while a complete 9/10-slot
set generates and evaluates every open offer together. Later visits extend
coverage by `hubVisit` owner, including side generation, entered local rooms,
parent restores, and the Hub restore. An unsupported board or visit state
clamps derived coverage at that semantic region while retaining later authored
visits. Neither layout publishes a canonical snapshot, completion event, or
downstream seed while incomplete.

## Completeness

Completeness asks whether authored state can produce concrete facts. It does
not ask whether those facts are legal.

A complete biome requires:

- structurally closed topology from declared entry to an independent terminal
  transition or a policy-admitted picked terminal batch target;
- all required target links and picked or visit-order choices;
- all active terminal target links and their picked choice;
- complete terminal companion links required by policy;
- one occurrence record with complete offer-time state for every referenced
  top-level room;
- complete entry-time room-local state for every picked occurrence that owns
  it;
- complete active local child and encounter offer-point state;
- resolved reward offers, payloads, active shop offers, purchases, and
  modes;
- complete biome-global and batch-global authored values.

For an `authoredBaseStore` batch, its concrete `baseRewardStoreKey` is one of
those required batch-global values. A `sourceOfferPoint` batch is complete only
when its parent occurrence has complete state for the semantic offer point
selected by normalized policy. A batch with no observable base outcome instead
has the explicit `none` policy and no invented store choice. Such a batch may
be reward-free, as in Q, or resolve target provenance entirely through
declaration overrides, as in I. Target incoming-reward leaves beneath every
form own complete resolved offers, not duplicate store selections.

Any additional state required by the normalized batch policy is equally part
of completeness. An ordinary H batch requires one concrete semantic
`cageOutcome`, even when it has no combat target or when Min and Max derive the
same visible cage count. H terminal transitions deliberately own no cage
outcome under the observational simplification defined by `../biomes/H_GAME_RULES.md`.

An I combat occurrence is complete when its potential concrete Tartarus reward
is complete even when Clockwork simulation currently derives Goal. The dormant
value emits no canonical reward fact in that realization. Physical offer order,
prior Goal offers, and the non-goal cap derive Goal versus NonGoal; authored
state never supplies a competing discriminant.

A complete N plan has every required fixed authored room, exactly nine or ten
open fixed hub targets with complete incoming leaves, and a six-entry visit
sequence containing distinct open slot keys. Side-room state is active only
under visited combat targets: every declared local slot then has concrete
generation state and reward state, and every generated slot has either one
distinct entered ordinal or an explicit unentered result. The fixed preboss
shop leaf must also be complete. Hub returns, parent restores, boss, and
postboss require no authored occurrence records.

Only referenced occurrences participate. Removed occurrences do not remain as
dormant project state; undo may restore their prior authored snapshot.

Generated unpicked targets participate because their rooms and incoming or
free rewards were offered by the game. Their entry-materialized shop state is
not required and emits no facts. On a picked shop occurrence, a concrete
negative such as `purchased: false` is complete state.

## Canonical Snapshots

Canonical snapshots contain concrete simulated game facts and semantic return
addresses. They are independent of persisted JSON layout and UI presentation.

Representative linear shape:

```ts
interface CanonicalLinearBiome {
  kind: 'LinearBiome';
  biomeKey: BiomeKey;
  entryRooms: CanonicalRoom[];
  batches: CanonicalBatch[];
  terminalEntry: CanonicalTerminalEntry;
  completionRooms: CanonicalCompletionRoom[];
  biomeState: CanonicalBiomeState;
}

interface CanonicalHubBiome {
  kind: 'HubBiome';
  biomeKey: BiomeKey;
  entryRooms: CanonicalAuthoredRoom[];
  hubBoard: CanonicalHubBoard;
  visits: CanonicalHubVisit[];
  terminalEntry: CanonicalAuthoredRoom;
  completionRooms: CanonicalCompletionRoom[];
  biomeState: CanonicalBiomeState;
}

interface CanonicalHubBoard {
  origin: HubOpenSetAddress;
  room: CanonicalHubRoom;
  targets: CanonicalHubTarget[];
}

interface CanonicalHubTarget {
  origin: HubSlotAddress;
  hubSlotKey: string;
  physicalDoorId: number;
  room: CanonicalAuthoredRoom;
}

interface CanonicalHubVisit {
  origin: HubVisitAddress;
  visitIndex: number;
  target: CanonicalHubTarget;
  localSlots: CanonicalLocalChildRoom[];
  enteredLocalRooms: CanonicalLocalChildRoom[];
  parentRestores: CanonicalRoomRestore[];
  hubRestore: CanonicalRoomRestore;
}
```

Both canonical variants project the same biome envelope:

```text
entryRooms -> traversal body -> terminalEntry -> completionRooms
```

For a linear biome, `batches` is the traversal body. For N, `hubBoard` plus
`visits` is the traversal body. Each canonical materializer preserves that
conceptual order within its own variant. History dispatches the middle segment
by layout kind while entry walking, room lifecycle execution, terminal
orchestration, completion walking, event folding, counters, and semantic
feedback remain shared authorities.

### Shared Biome Envelope Composition

The shared envelope is an internal orchestration contract, not a third
authored or canonical data model. `LinearBiomePlan` and `HubBiomePlan` remain
separate persistence languages, and `CanonicalLinearBiome` and
`CanonicalHubBiome` remain separate materialized products. The common layer
owns history orchestration across their equivalent semantic segments.

Materialization remains variant-owned because its entry and terminal contracts
are materially different. Linear materialization may begin from an authored
start or derived fixed entry and may end through a forked or generated target.
Hub materialization resolves fixed authored entry leaves and a fixed authored
terminal around its board and visits. Each variant assembles its existing
canonical snapshot directly; neither projects through a generic public body or
snapshot shape.

The one shared materialization primitive is completion-room construction. It
accepts the declared completion roles plus optional terminal-derived
reward-store provenance and retains the existing declaration, lifecycle, and
entered-store validation. Further entry or terminal extraction requires
another concrete consumer; the shared history envelope does not by itself
justify a generic materialization adapter registry.

History composition consumes that canonical snapshot through this contract:

| Segment              | Input                                                         | Required output                                           |
| -------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| fixed-entry composer | canonical entry rooms and the shared lifecycle/event writer   | last entered entry room                                   |
| body adapter         | that entry room, the canonical body, and the same writer      | exact terminal predecessor after every ordered body event |
| terminal adapter     | that predecessor, the canonical terminal, and the same writer | entered terminal room                                     |
| completion composer  | terminal room, completion rooms, and the same writer          | completed ordered tail                                    |

The history envelope alone initializes biome counters and optional route-prefix
state, emits biome start/completion and declared transition resets, and invokes
the topology-neutral history fold. A body adapter cannot initialize or finish
a biome, apply transition resets, or select a different fold.

The linear body adapter owns generated decision batches, picked-target
continuation, Fields/Clockwork body state, and realization of a generated
terminal target. The Hub body adapter owns the persistent Hub room and board,
open target membership, six visit references, parent-local side excursions,
and parent/Hub restores. N Opening and PreHub belong to the fixed entry
segment. N Preboss belongs to the fixed terminal strategy. Boss and Postboss
belong to the shared completion segment.

History dispatch may use the normalized layout discriminant or direct typed
composition. It must never branch on a biome key, concrete room game name,
semantic address, or rendered UI shape. This keeps N's structural
specialization in the middle segment without creating a second history stack.
The contract applies to function ownership; it does not require source files to
mirror every conceptual segment.

The shared history segmentation preserves declared canonical facts, exact event
order, counter state, transition resets, occurrence identity, and restore
identity. In particular, PreHub remains N's second fixed entry, one room
occurrence is still created only once, and later restore appearances never
replay creation or lifecycle work.

`entryRooms` begins with the selected declared start and then contains any
layout-derived fixed entry rooms in game order. I contains only `I_Intro`;
`I_Story01` materializes later as an ordinary authored target in a generated
Clockwork batch.

A layout-derived entry owns a stable `(routeKey, biomeKey, role)` semantic
address rather than a fake Room Occurrence ID. Its incoming fixed producer and
the layout-owned target that creates it use sibling role addresses. History
records such rooms without leaking a rendered row or nullable pseudo-room into
game history. I Story instead owns an ordinary occurrence address and follows
the same generated-target lifecycle as other authored I offers.

`terminalEntry` is a canonical role, not proof that authored persistence used
the independent `terminal` continuation form. For I, materialization derives
it from the picked terminal target of the final `ClockworkDoorBatch`;
preceding unpicked preboss occurrences remain in their own batches as ordinary
offer facts.

N `hubBoard` records the fixed physical generation order and every open target
offer exactly once. `visits` records the six player-selected target entries in
visit order, each target's active side-room offers and side-entry order, the
restored parent records, and the restored hub record. Open unvisited targets
remain in `hubBoard` but never appear in `visits`.

Each visit references the exact `CanonicalHubTarget` object already owned by
the board. A local slot keeps its physical door ID, availability rank,
generated/not-generated result, optional entered ordinal, and parent-local
semantic address. `localSlots` retains declaration-fixed physical slot order;
availability rank remains a separate axis for generation pressure. Generated
slots expose their concrete incoming offer whether entered or not;
not-generated slots expose no canonical offer. The `enteredLocalRooms` array
reuses those local-slot objects in player entry order.
Parent and Hub restore records reference the existing authored parent and one
derived Hub room; they never create another Room Occurrence or replay an offer.
The persistent Hub room and its open board have distinct `HubRoomAddress` and
`HubOpenSetAddress` owners so later history, findings, and candidate indexes
cannot collapse the room lifecycle into the board-generation surface.

For N, `entryRooms` resolves the fixed authored Opening and PreHub references;
their topology and game names come from the layout while their reward leaves
come from persisted Room Occurrences. The stateless Hub entry is materialized
as the structural owner of `hubBoard`, not as another authored occurrence. The
fixed authored Preboss is the Hub snapshot's direct `terminalEntry`; it owns
the complete WorldShop leaf, while Boss and Postboss remain derived completion
rooms.

PreHub is therefore not a Hub-only candidate rule. It is the second fixed entry
in the common envelope, and its depth follows from walking the entry chain.
After canonical expansion, N history is an ordinary ordered event stream:
Opening, PreHub, repeated Hub/main/side/restore appearances, Preboss, Boss, and
Postboss. Only the Hub body determines that middle ordering.

A canonical batch records:

- selected parent occurrence ID and concrete game room name;
- physical generation order;
- explicit batch reward-store policy and authored base store when applicable;
- every target occurrence, including unpicked dead leaves and repeated game
  room names;
- offer-time room and reward facts for every target, but entry-time shop facts
  only for the picked target;
- exit index and picked state;
- the picked target's derived continuation effect when policy admits a
  terminal declaration;
- any policy-derived incoming realization, including I Goal versus NonGoal;
- complete resolved incoming offer, including actual store provenance, when
  the target owns a producer;
- concrete room-local fragment;
- declaration-derived physical offer facts associated with the materialized
  occurrences;
- semantic addresses for each fact.

A Clockwork batch additionally records the exact pre-generation
`goalsRemaining`, `nonGoalRewardsAcquired`, and compatible latent non-goal
limit domain. Materialization deterministically selects the smallest remaining
limit as its history witness; if no limit remains, it uses the declaration
maximum only to preserve a complete invalid trace while selected generation
emits the addressed incompatibility. Each target then owns a derived Goal or
NonGoal fact. Goal suppresses the dormant concrete Tartarus leaf; NonGoal
activates it. When the picked target is the generated preboss, that final
generated batch becomes `terminalEntry` while preserving its batch-state and
no-store provenance.

For Fields batches, canonical `batchState` is a typed projection of the
authored Min/Max outcome plus the declaration- and physical-target-derived
batch capacity and selected cage count. A no-combat batch still retains that
semantic result, while each combat room exposes only its active addressed
local-reward prefix. Capacity derivation never removes or rewrites dormant
authored cage leaves.

History emits that typed Fields outcome immediately before its physical target
creation events. Folding the event increments the biome-local
`fieldsMaxDoorsRolled` counter for Max without inferring the outcome from
visible cage count. Room-creation history also retains the actual materialized
encounter profile, because a Min outcome can select a two-cage profile that
differs from the room declaration's maximum-capacity profile.

Selected Fields validation reads the source room's pre-commit history view.
It combines that view's `biomeDepthCache`, the prior derived
`fieldsMaxDoorsRolled`, and the declaration-owned ceiling to expose the exact
supported Min/Max set. Reaching the ceiling takes priority over depth pressure;
depths four and five otherwise force Max, while depth six and later supports
only Min. An unsupported authored outcome remains in the snapshot and emits an
addressed continuation finding. H room legality, sequential forced pools, and
cage reward support continue through the common declaration and reward
validators rather than a parallel biome validator.

A canonical room records authored occurrence ID, concrete game room identity,
resolved encounter phases, room-local state, local children, offers,
acquisitions, and return addresses. It does not copy labels, candidate arrays,
eligibility predicates, or other declaration facts.

The canonical snapshot is not the eventual execution-plan JSON. It is a rich
internal simulation product from which the app can later compile the smallest
runtime document justified by game probing.

## Lifecycle Event Stream

History preserves game timing rather than reconstructing it from final room
aggregates. The canonical operation order comes from
`ROOM_LIFECYCLE_MODEL.md`:

```text
room.prepare
room.enter
room.start_encounter / room.complete_encounter
room.offer_point / room.advance_producer, when declared
room.generate_outgoing
remaining room-local operations
room.commit
room.exit

editable terminal enters
layout completion sequence begins
each derived completion declaration enters and commits in order
biome.complete
next biome entry or route completion
```

Encounter profiles emit ordered phase events. A counting combat phase may
produce:

```text
encounter.start
biomeEncounterDepth increment
reward.offer
reward.offer_projection, when declared
combat.complete
concrete_acquisition.emit
encounter.complete
```

The lifecycle profile owns operation order. Encounter, room, reward, and layout
declarations own the typed effects invoked by those operations. The simulator
must not infer timing later from a generic reward list or final room aggregate.

H Fields combat is a concrete multi-phase projection rather than one generic
combat event. Materialization first derives the active cage prefix for every
combat target from the batch outcome and peer capacities. For each occurrence
in physical target order, its ordinary incoming offer resolves before its
active cage offers; this preserves cross-target counted-bag and Boon-source
history. On entry, the picked combat room emits one non-counting passive phase
followed by one counting encounter and required acquisition for every active
cage. The unpicked targets never emit those encounter or acquisition events.
The batch's semantic Max outcome updates `fieldsMaxDoorsRolled` even when
capacity or an empty combat-target set makes that update visually opaque.

N hub materialization is also explicitly phased:

```text
fixed Opening offer, entry, encounter, acquisition, commit
fixed PreHub offer, entry, encounter, acquisition, commit
derived Hub entry
generate all open hub targets and incoming offers in physical order
derive hubRewardLookup from every hub offer
for each authored main visit:
  enter the selected target
  spawn required SoulPylon
  start and complete the counting main encounter
  destroy the required pylon and acquire the incoming reward
  evaluate local generation pressure in availability order
  jointly validate and offer the generated side-slot reward batch
  for each authored entered side slot:
    enter, resolve its non-counting encounter, and acquire its reward
    restore the same main occurrence
  restore the same Hub room
enter fixed authored PreBoss and resolve its shop
walk derived Boss and PostBoss completion
```

The hub lookup is produced before the first selected visit and remains based on
the full open board. A restore event appends history without creating another
occurrence, offer, acquisition, or encounter-start event.

The active N lifecycle/history and reward path implements this trace.
Exact fixed-entry, Hub-board, main, side, restore, terminal, and completion
events fold through the shared history ledgers, including required Soul Pylons
and generated-side-room counters. Reward replay consumes every open target in
physical order, resolves each generated side group jointly, acquires only
entered rooms, derives `hubRewardLookup` from the full initial board, and then
validates the fixed Preboss shop. These facts remain replaceable simulation
output; none are inferred from a final room aggregate or persisted beside the
authored Hub plan.

Selected Hub validation composes those products through normal N route
simulation. Its authored-possibility ledgers are deliberately narrow:

- each declared open-slot constraint records its constrained and selected-open
  slot keys, maximum count, and selected support;
- each visited parent-local slot records visit ordinal, availability rank,
  generated count before evaluation, required pressure count, supported
  generation outcomes, and selected support.

An unsupported open-set outcome is addressed to every participating invalid
Hub slot. An unsupported local generation outcome is addressed to the exact
parent occurrence and side-slot key. Complete-but-invalid authorship is never
repaired or discarded. Fixed slot identity and physical order, six distinct
open visits, Pylon spawn/completion, side-entry ordinals, parent and Hub
restores, fixed Preboss, completion rooms, and biome completion are constructed
canonical invariants; disagreement at those contacts is a contract failure, not
a recoverable semantic finding. Reward and shop findings remain owned by the
reward replay rather than being duplicated by Hub validation.

Every permutation of a parent's entered side slots is legal. Because all
sibling offers exist before the first entry and supported side acquisitions do
not revise those offers, permutations with the same generated set, entered set,
and resolved offers and acquisitions produce the same modeled state at final
parent exit. The
entered ordinals remain semantic only to preserve exact room/acquisition trace
and eventual execution intent; generated and entered counts are derived.

## Counter and Ledger Axes

These histories remain distinct:

- generated-room creation history includes every picked and unpicked target;
- room appearance history includes entered rooms only;
- `biomeDepthCache` advances from declared committed room-history behavior;
- `biomeEncounterDepth` advances from resolved counting encounter phases;
- route encounter depth counts route-wide counting encounters;
- room-history ordinal supports route-wide spacing rules;
- reward-offer history includes every displayed offer;
- reward-type offer projections update their exact facts at materialization;
  Devotion sets `lastDevotionDepth` even when unpicked;
- entered-room reward-store history records the resolved store even when the
  visible producer is fixed Story or Shop;
- loot/use histories include acquired rewards only;
- pending shop offers represent their bounded active interval;
- unresolved force pressure tracks eligible forced declarations not yet
  generated.

The F generation validator records one immutable pressure entry for every
physical target. The entry owns the target's exact pre-creation counter and
creation/appearance evidence plus its eligible, optional-force,
required-force, and final support sets. It is a validation ledger, not an
editor candidate projection: no alternate topology or decorated option array
is produced.

Every rule declares which pre-operation or post-operation view it reads.
`ROOM_LIFECYCLE_MODEL.md` owns that operation order. A generic row or room index
cannot substitute for these axes.

Important consequences:

- every generated occurrence emits its own creation event even when another
  occurrence references the same game name;
- only picked and entered occurrences contribute appearances;
- `MaxCreationsThisRun` sees generated peers in order;
- `MaxAppearancesThisBiome` sees entered room history, not offers;
- counted reward bags deplete on offer, including unpicked doors;
- loot and use requirements update on acquisition;
- one physical room commit advances `biomeDepthCache` once even when it has
  multiple encounters;
- a counting encounter advances `biomeEncounterDepth` at encounter start, so
  outgoing generation observes it before the same room's later commit;
- outgoing generation reads the source's pre-commit depth caches, while the
  picked target's preparation reads the post-commit caches;
- fixed completion rooms contribute their declared room-history ordinals even
  though they are derived rather than authored topology;
- each derived completion room applies its declaration-owned reward-store
  history policy instead of a simulator room-name exception;
- the next biome reads route-wide history only after those fixed transitions
  and the declared biome reset events have been applied;
- Clockwork Goal progress changes on acquisition;
- the I non-goal counter changes only when a concrete non-goal reward spawns
  for the entered occurrence, never when it is merely offered.

Reward simulation publishes an immutable reward-history checkpoint for every
generated target before that target's offer is resolved. Room-generation
validation consumes the checkpoint for acquisition-backed eligibility while
continuing to read room, encounter, counter, and cap facts from canonical
history. All reward branches must agree on the record families consumed by
room generation; a divergent eligibility fact is an explicit simulation
contract failure rather than an arbitrary branch choice. O uses this contact
for acquired-source requirements and for the optional Combat2 phase selected
when the room prepares.

## Requirements

Requirements are normalized typed expressions with registered evaluators.
Contacts supply their evaluation phase:

- room eligibility and force at room generation;
- reward bag-entry requirements at reward offer;
- optional encounter presence at its declared decision phase;
- acquisition-gated rules at the acquisition history view.

Boolean composition uses explicit `all`, `any`, and `not` nodes. Evaluators
receive only the typed history view and semantic context they require. They do
not read UI state, project storage, or global runtime objects.

The focused registry evaluates inclusive counter ranges, summed record counts,
active current-room shop option names, the current room's chosen reward,
offered-exit count, current-run flags, and `runDepthCache`-backed event spacing.
Devotion spacing preserves the game's peer-generation behavior: no prior marker
passes, and a marker stamped at the current `runDepthCache` does not block
another offer generated at that same depth. Otherwise the current depth must be
at least the declared count beyond `lastDevotionDepth`.

Selected facts and candidate projections use the same evaluator functions.
There is no permissive candidate rule beside a stricter selected rule.

## Structural and Eligibility Validation

Validation checks complete canonical facts in lifecycle order:

- start, fixed-entry, terminal, and layout roles;
- physical exits and target compatibility;
- room eligibility at the correct generation point;
- creation and appearance caps on separate ledgers;
- force pressure over complete peer batches;
- encounter profile presence and counter effects;
- selected traversal and visit order;
- fixed hub-slot availability, persistent-board, restore, and visit-count
  invariants;
- specialized biome structures;
- reward domains, payloads, bags, shops, and acquisitions;
- semantic-address uniqueness.

Targets in one generated batch process in physical generation order. Each
creation and offer updates scratch history before the next peer is validated.

The linear room-generation contact projects only predicates present on
supported normalized declarations: boolean composition, biome depth-cache and
encounter-depth ranges, entered-room and acquired-reward record counts, recent
encounter phases, and predecessor exit counts. The shared requirement
evaluator registry remains the sole predicate authority. Encounter, reward,
and feature predicates outside the supported generation surface fail the
contact contract instead of reading invented defaults.

Validation never rewrites authored topology, chooses a replacement, or repairs
an invalid selection.

For F/G, repeated ordinary combat game names remain valid construction and are
judged only by their declared current-history rules. I preboss offers likewise
use distinct occurrence identities. Each declined preboss materializes as an
unpicked target in its real `ClockworkDoorBatch`; a later batch may create a
new occurrence. Only the picked preboss contributes entry and local shop
acquisitions. The simulator never restores the old singleton-control or
synthetic-companion workaround.

For N, one authored main occurrence may contribute an initial entry record and
several restored-parent history records after side rooms. The hub likewise
contributes one initial entry plus six restores without a top-level authored
hub occurrence. Validation addresses offer and leaf findings through the open
hub target occurrence, side findings through parent occurrence plus local slot
key, and restore/history findings through their canonical semantic event
address.

## Reward Simulation

`REWARD_MODEL.md` defines reward vocabulary and producer composition. This
section owns the history-dependent simulation of those normalized facts.

The simulator keeps these distinct:

`Reward type`
: Picker and offer identity such as `Boon`, including its payload domain and
complete offer default.

`Store entry`
: One concrete counted-bag member with requirements, multiplicity position,
duplicate policy, and reward type.

`Reward store`
: Offer-point-resolved provenance and counted domain.

`Reward bag`
: Ordered counted multiset copied from a game store.

`Offer point`
: Lifecycle moment producing one or more resolved offers.

`Reward offer`
: Resolved store, reward type, complete payload, and semantic source. It can be
offered without ever being acquired.

`Offer projection`
: Reward-type-specific current-run writes caused by materializing an offer.
Devotion spacing is the only initial projection; generic offer history and bag
consumption remain offer-point mechanics.

`Concrete acquisition`
: One most-concrete loot, consumable, or resource identity emitted by producer
lifecycle at a specific point.

`History projection`
: Typed game-history writes folded only from a concrete acquisition.

`Shop profile`
: Shop option domain; it is not a counted reward bag.

For an entered shop, evaluate ordered groups against the pre-generation fact
snapshot, validate every authored offer against an eligible option entry, and
enforce each group's `offerCount` without replacement. Positive weights do not
change possibility support. After the inventory exists, generate and validate
the room's outgoing batch from the same pre-purchase acquisition history and
the complete generated current-room option set. Only then process the authored
purchased set. Exact affordability and resource state remain deferred under
the sufficient-resource policy in `REWARD_MODEL.md`. Blind Box persists its
intended source, but validates that source only if purchased. Evaluate every
semantically distinct purchase order, merge equivalent exit-history states,
and retain a witness order proving the authored source is possible for later
execution-plan compilation. Those post-purchase histories continue through the
already-generated picked target; they are not used to revalidate its room or
incoming reward.

Source-bearing shop options use their declared policy at their declared
resolution point: RandomLoot uses `ordinaryNoPeer` during offer generation,
while Blind Box uses the same policy only when its authored-source acquisition
role runs after purchase.

For each generated batch:

1. derive the possible base stores from the biome ratio policy and current
   entered-room store history when the policy is `authoredBaseStore`;
2. validate the authored `baseRewardStoreKey` by support-set membership, or
   resolve and validate the source occurrence's active semantic offer point
   when the policy is `sourceOfferPoint`;
3. scan all targets for valid forced-store overrides in physical order;
4. derive every target's actual store from individual override, target forced
   override, or the final shared store;
5. evaluate remaining entries in that actual store against current history,
   source filters, and same-batch duplicate rules;
6. identify eligible entries capable of producing the authored resolved offer,
   and validate source support through that reward type's declared policy when
   its resolution point is the offer;
7. when no entry in the whole bag is eligible, append one full base set while
   retaining leftovers, at most once;
8. fail the supported-store refill invariant if that complete projected set
   still contains no eligible entry; the proven planner baseline does not
   synthesize the raw second-refill Heal fallback;
9. reject unavailable stores or invalid authored rewards explicitly;
10. consume each eligible counted entry that can explain the authored offer and
    preserve the deduplicated set of distinct reachable bag states;
11. preserve ineligible and unmatched entries in every reachable state;
12. emit the generic offer-history event and apply the reward type's optional
    offer projection; Devotion writes `lastDevotionDepth` here even when its
    target remains unpicked;
13. when the producer lifecycle reaches an acquisition point, resolve the
    addressed role from the complete reward offer into a concrete acquisition;
14. apply that concrete acquisition declaration's `lootAndUse` or
    `consumableAndUse` projection and no store-entry-level alias; acquisition
    kind remains independent of the selected history profile.

For a generated batch with `none`, skip base-store support and shared-store
resolution. A target forced or individual store still resolves from its Room
Declaration and uses the same offer machinery. A target with no producer and
no resolved store emits no reward offer and consumes no bag entry.

Start and terminal offer points that do not own an authored batch store receive
their store from their normalized fixed or terminal policy. They reuse the same
bag, offer, offer-projection, and acquisition machinery after that resolution.

`allowDuplicates` is an entry-level store fact and defaults to false.
RunProgress Boon entries permit repeated reward types; other ordinary F/G
entries do not. Repeated Boon types still obey source rules: earlier peer Boon
sources are excluded within the batch, unpicked peer sources affect that local
exclusion without entering acquisition history, and the ordinary four-source
route cap restricts later source support to already acquired sources. When peer
exclusions exhaust all sources, the game's weaker-exclusion and unrestricted
fallbacks restore any otherwise eligible source to support.

Devotion does not reuse ordinary peer exclusion. Its
`devotionAcquiredPair` policy requires two distinct already acquired ordinary
god sources, preserves the authored chosen/spurned pair, acquires the chosen
source before combat, and acquires the spurned source after combat. Hermes is
outside the ordinary god-source domain. Policy dispatch is registry-based;
simulation does not switch on reward names.

Duplicate compatible entries with different downstream behavior branch latent
bag state. The simulator may merge equivalent resulting states, but it must not
select one entry by declaration order. A later authored offer is valid if at
least one reachable state supports it; the next state frontier contains every
supporting result.

For F/G forked preboss transitions, each physical terminal target is a
distinct occurrence referencing the same preboss declaration. Every target
emits creation and door-offer facts in physical order. Only the picked target
emits appearance and reaches its incoming producer's acquisition lifecycle.
Story and structural Shop resolve no concrete incoming acquisition.
Room-internal shop offers and purchases are active only when the picked
realization is the shop target.

## Candidate Evaluation

`CANDIDATE_EVALUATION_MODEL.md` is the detailed authority for project-bound
candidate sessions, typed pre-decision contexts, domain evaluation, replay
horizons, caching, and refactor constraints. This section retains the
simulation-level contract; `../progress/IMPLEMENTATION_PLAN.md` owns delivery
order.

Candidate domains are declaration-derived and stable. Declaration-impossible
values may be absent. Context-invalid values remain present and receive
semantic invalid results.

Candidate results report possible, forced, or impossible membership plus the
same semantic findings used for the selected plan. They do not report a score
or likelihood.

For one candidate domain, simulation:

1. validates the request against its authored semantic owner and declaration;
2. derives the exact current pre-decision context through normal project
   simulation;
3. prepares that context once for every requested alternative;
4. invokes the same support evaluator and finding producer used for the
   selected value at the smallest affected semantic region;
5. returns ordered typed support, findings, and evidence without publishing or
   persisting scratch state.

The shared query set covers authored starts, ordinary room targets, batch
reward stores, incoming and free rewards, room-local rewards, WorldShop offers,
purchase choices, and policy-owned Fields door-roll outcomes. Preboss uses those
same incoming-reward and WorldShop addresses rather than a second terminal-only
candidate vocabulary.

N extends that shared vocabulary with four Hub-structural queries: fixed-slot
open membership, one visit-position replacement, one parent-local generation
outcome, and one complete parent-local entered order. Fixed-entry and Hub-target
rewards continue to use `incomingReward`; side-room rewards use `localReward`;
the fixed Preboss continues to use the common shop-offer and purchase queries.
Open proposals carry an occurrence ID because opening a physical slot creates
one authored Room Occurrence; the candidate result never invents or persists a
second identity.

F/G/H/I/N/O/P/Q candidate preparation consumes the normal project evaluation;
there is no production candidate-only biome simulator. A candidate is
assessable when the complete evaluation or progressive prefix has reached its
semantic owner and required checkpoint. Otherwise it reports addressed
`coverageNotReached` evidence containing the owner, checkpoint, and current
coverage. Room candidates reuse the biome's addressed generation views. H
Min/Max candidates reuse the addressed pre-outcome support ledger
because the proposed value cannot change its own prior context. Cage and
terminal alternatives apply one immutable semantic replacement and replay H
through the common linear reward authority with the already-evaluated G seed.

N candidate preparation locates the selected Hub product in normal Surface
route evaluation. Slot membership reuses open-count and
declaration-owned constraint validation; visits replay the six-visit product;
side generation replays global ranked-prefix pressure; entered order replays
the exact acquisition trace. Reward and shop proposals use the same immutable
replacement/replay path as linear biomes. N does not claim per-slot prefix
coverage while its jointly generated board is incomplete. Once the board or a
later visit-local region is covered, its candidates use the same addressed
coverage contract as Linear biomes. Selected invalid values remain evaluated
and retain exact findings.

If a prior biome is not complete and valid, candidates in every later biome
report unavailable upstream context. If the active biome has not yet covered a
queried owner because required earlier structure or a supported pre-state is
missing, that owner reports unavailable local context. Neither case invents
history from defaults or unauthored futures.

Ordered candidate domains for one authored snapshot use one prepared candidate
session bound to the exact immutable project and its published
`ProjectEvaluation`. The application keeps option arrays in a weak cache keyed
by that identity pair, semantic owner, and domain. A semantic edit therefore
invalidates the session once, while navigation and repeated renders consume the
same structures.

Room candidates reuse addressed generation views. Reward and shop alternatives
reuse a typed producer frontier captured by selected reward simulation and
evaluate the complete producer domain without applying one temporary project
command or rebuilding the addressed biome per offer. Room-local and Hub
candidates replay only their declared semantic region unless a genuinely broad
field requires a scoped biome suffix. Unrelated later topology is never a
candidate input. React triggers and presents the application projection but
never implements these rules.

A candidate contact does not require unrelated downstream topology
to remain complete when the proposed value changes structural capacity. For
example, a room candidate reads the target's already-derived pre-generation
history and runs the selected-plan room-support calculation for the proposed
game name; it does not misreport that context as unavailable merely because
the proposed room would require later exit reconciliation. Validators beyond
the candidate's semantic effect are replayed only when that candidate domain
depends on them.

Candidate evaluation is added after selected-plan F simulation is correct. It
must reuse materializers and validators rather than creating a parallel rules
engine for UI coloring.

## Findings

A finding contains a generic code, severity, lifecycle phase, semantic origin,
and typed evidence:

```ts
interface Finding {
  code: string;
  severity: 'error' | 'warning';
  phase?: LifecyclePhase;
  origin: SemanticAddress;
  providerKey?: string;
  candidateKey?: string;
  evidence: Readonly<Record<string, unknown>>;
}
```

Instance identity belongs in `origin`, never in the code:

```text
good: target_room_ineligible + origin F/room-01J.../exit2
bad:  f_combat04_other_miniboss_entered
```

Human messages are presentation derived from code and evidence. The simulator
does not embed English UI strings into findings.

When support membership fails, typed evidence may contain the derived support
set and the forced/eligibility facts that produced it. It never contains a
likelihood score.

Shop findings retain the narrowest proven owner. An offer or purchase address
is marked unavailable only when that slot fails every reachable witness. When
each slot remains individually possible but the complete authored set has no
joint witness, one finding belongs to the shop occurrence with the participating
offer keys in evidence; supported sibling slots are not marked invalid.

Completeness and legality findings use the same address domain. Contract
errors remain a separate result class because they indicate malformed data or
implementation failure rather than correctable user intent.

## Simulation Result

The public project envelope remains:

```ts
interface ProjectEvaluation {
  status: 'empty' | 'valid' | 'incomplete' | 'invalid';
  projectId: string;
  catalogVersion: string;
  routes: readonly ProjectRouteEvaluation[];
  findings: readonly SemanticFinding[];
  summary: ProjectEvaluationSummary;
}
```

Each route simulation records:

- configured biome identity and the validated route prefix;
- complete F/G/H/I/N/O/P/Q evaluations with layout-typed canonical snapshots, lifecycle events,
  ledgers, room-generation proof, reward witnesses, and findings;
- Linear and Hub incomplete active-biome evaluation with covered-prefix
  materialization, partial lifecycle history, counters, generation proof,
  reward witnesses, and addressed findings; Hub board coverage remains one
  all-or-nothing semantic generation region rather than a physical-slot prefix;
- no canonical snapshot, final biome history, completion event, or downstream
  seed on an incomplete active biome;
- validated-prefix identity and an exact route-end, incomplete, or invalid
  processing horizon;
- semantic findings in stable route and phase order;
- whether the route is eligible for future execution-plan compilation.

The core contains complete F, G, H, I, N, O, P, and Q simulation, with
function dispatch selected by normalized layout kind. Every biome placed in a
production route is authorable, simulatable, and editable. Application
interaction fixtures and direct core conformance fixtures exercise the
complete F/G/H/I and N/O/P/Q route prefixes.
An entirely unconfigured project has explicit `empty` status, no findings, and
is not eligible for execution-plan compilation. Candidate evaluation consumes
the same prepared context and legality authorities as selected-plan
validation; UI decoration remains a downstream application projection.

The complete result is replaced atomically after an authored edit.

## Research Gaps and Conformance

The simulator aims to model supported major game rules faithfully. A missing
one to five percent is handled through disciplined evidence, not permissive
runtime fallbacks.

Use:

- focused game-data audit notes;
- executable fixtures describing the current hypothesis;
- captured future runtime mismatch reports;
- explicit bounded uncertainty only where the game itself permits several
  outcomes relevant to validation.

Do not expose `unsupported` as a generic user-facing production state merely
to remember research work. When an unmodeled rule materially affects a
supported surface, either implement it, remove that surface from the catalog,
or document a narrow known approximation with tests.

The initial F context is explicit: reward bags and route histories start empty;
F begins with `enteredBiomes = 1`, `biomeDepthCache = 0`, route encounter depth
`1`, and biome encounter depth `1`; spell-related current-run flags are false;
the opening is already created and its reward is acquired before its exits are
generated. A first `biomeStarted` event owns those counter baselines; the fold
does not infer them from empty-ledger defaults. The counting opening encounter
advances biome encounter depth to `2` at encounter start, before outgoing doors
are generated, and its room commit advances biome depth cache to `1`.
Current-room shop option history
contains the complete generated inventory while that shop's outgoing doors are
generated. Purchases occur afterward and first affect generation when the
already-generated next room reaches its outgoing checkpoint.

For a validated downstream G, the route evaluator carries F's room, encounter,
reward-bag, global acquisition, offer, and route-counter state forward. It then
applies G's layout-declared biome-local counter baselines and clears only the
reward records that the game resets per biome (`BiomeUseRecord`,
`LootBiomeRecord`, and current-room use state). G reward-ratio support counts
only G-local entered-store history even though the canonical history retains
the validated F prefix.

The canonical model increments `upgradableTraitCount` once for every acquired
ordinary Boon. Exact boon selection, replacement, and upgradeable trait
inventory are not yet project inputs, and deferred NPC gifts do not modify the
counter. This approximation is fixture-backed and must be replaced rather than
layered over when concrete trait state becomes modeled.

The trait-free witness also holds `allSpellInvested = false`; Talent remains
possible after Spell subject to its other exact requirements. The canonical
trace never uses Surface Shop delivery, so `pendingSpellDrop = false` is exact
for the current scope. Concrete Hex investment and delivery features must
replace those facts if activated.

N's local conformance probe captured the availability rank for every
multi-side-door map, so forced-prefix validation can consume exact declaration
ranks. Supported local bag validation is an unordered joint sibling constraint
and does not consume that rank. The persistent hub still requires observed
generation order before an execution plan assumes stable hub-door ordering;
that later probe fills execution evidence rather than changing model shape.

## Test Strategy

The simulator is fixture-driven.

Required categories include:

- catalog construction success and contract failure;
- authored command and normalization invariants;
- repeated game names across distinct occurrence IDs;
- one golden project, canonical snapshot, history, and finding set per focused
  biome scenario;
- picked and unpicked peer creation and reward depletion;
- absent unpicked shop state, atomic picked-shop default installation, and
  dormant retention after re-pick;
- counter timing and pre/post-event views;
- creation versus appearance caps;
- force pressure;
- low-weight possible outcomes and forced-pool exclusion;
- chance/ratio boundaries at zero, strict interior, and one;
- generated-batch base-store support and two-pass target-store overrides;
- terminal policies;
- optional encounter phases;
- reward payload and bag-entry provenance;
- downstream retention and explicit destructive commands;
- blocked downstream biome processing;
- determinism: equal normalized inputs produce deeply equal outputs.

Fixtures should be small enough that a reviewer can understand the expected
game story without reverse-engineering generated data.

## Explicit Non-Goals

The initial simulator does not provide:

- vanilla probability distributions;
- route likelihoods, unlikely-state warnings, or RNG-seed replay;
- Monte Carlo search;
- automatic route optimization;
- runtime game mutation;
- silent approximation of missing current-run rules;
- save-file progression simulation;
- UI layout or component information;
- execution-plan serialization before the app model stabilizes.
