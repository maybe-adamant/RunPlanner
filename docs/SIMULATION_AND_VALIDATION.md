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
F/G/P/Q/H/O/I/N audit set. Phase 2.8 dormant declaration closure and Phase 3's
complete linear simulation pipeline are complete. F, G, and H now share one public
completeness, materialization, lifecycle, event-folded history,
room-generation, reward-kernel, project-simulation, selected-plan validation,
and candidate result. Phase 5 closed F/G through the editor, profile, and
recovery product loop; Phase 6 extended the same boundary through H. P/Q/O/I/N
remain dormant. The Phase 2.7 authority switch and schema-version-3 identity
cleanup leave those simulation contracts unchanged.

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

The initial implementation performs a full synchronous rebuild after every
semantic edit. Optimization follows profiling rather than speculation.

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

For each biome:

1. Check structural and referenced-leaf completeness.
2. If incomplete, produce completeness findings and stop semantic processing
   for that route.
3. Materialize one canonical biome snapshot.
4. Append ordered lifecycle events to accumulated route history.
5. Validate selected facts and evaluate candidates.
6. If invalid, retain its snapshot and findings but stop before the next
   biome.
7. If valid, admit it to the validated prefix and continue.

Later authored biomes remain visible to the editor but are marked as blocked
by the earlier biome. They do not receive invented local validity against
history that was never produced.

Biome completion is the materialization gate. An incomplete biome produces no
canonical snapshot and is not sent through contextual validation.

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
outcome under the observational simplification defined by `biomes/H_GAME_RULES.md`.

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
  biomeState: CanonicalBiomeState;
}

interface CanonicalHubBiome {
  kind: 'HubBiome';
  biomeKey: BiomeKey;
  entryRooms: CanonicalRoom[];
  hubBoard: CanonicalHubBoard;
  visits: CanonicalHubVisit[];
  terminalEntry: CanonicalTerminalEntry;
  biomeState: CanonicalBiomeState;
}
```

`entryRooms` begins with the selected declared start and then contains any
layout-derived fixed entry rooms in game order. Most linear biomes currently
contain only their start; I additionally materializes progressed-save
`I_Story01` before its first authored Clockwork batch.

A layout-derived entry owns a stable `(routeKey, biomeKey, role)` semantic
address rather than a fake Room Occurrence ID. Its incoming fixed producer and
the layout-owned target that creates it use sibling role addresses. History
therefore records Intro as `biomeEntry`, creates Story as `layoutEntry` at the
Intro outgoing-generation checkpoint, and lets Story own the first ordinary
target batch without leaking a rendered row or nullable pseudo-room into game
history.

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

For N, `entryRooms` resolves the fixed authored Opening and PreHub references;
their topology and game names come from the layout while their reward leaves
come from persisted Room Occurrences. The stateless Hub entry is materialized
as the structural owner of `hubBoard`, not as another authored occurrence.

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
`goalsRemaining`, `nonGoalRewardsAcquired`, and authored
`maxNonGoalRewards` view. Each target then owns a derived Goal or NonGoal fact.
Goal suppresses the dormant concrete Tartarus leaf; NonGoal activates it. When
the picked target is the generated preboss, that final generated batch becomes
`terminalEntry` while preserving its batch-state and no-store provenance.

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

The current F room-generation contact projects only predicates supported by
the normalized F declarations: `all`, `any`, `not`, biome depth-cache and
encounter-depth ranges, entered-room record counts, and predecessor exit
counts. The shared requirement evaluator registry remains the sole predicate
authority. Encounter, reward, and feature predicates that do not belong to
the current F generation surface fail the contact contract instead of reading
invented defaults.

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

Candidate domains are declaration-derived and stable. Declaration-impossible
values may be absent. Context-invalid values remain present and receive
semantic invalid results.

Candidate results report possible, forced, or impossible membership plus the
same semantic findings used for the selected plan. They do not report a score
or likelihood.

For one candidate, simulation:

1. validates the query against its authored semantic owner and declaration;
2. derives the exact current pre-decision context through normal project
   simulation;
3. projects the proposed value into the smallest affected semantic owner;
4. invokes the same support evaluator and finding producer used for the
   selected value;
5. returns typed support, findings, and evidence without publishing or
   persisting scratch state.

The shared query set covers authored starts, ordinary room targets, batch
reward stores, incoming and free rewards, room-local rewards, WorldShop offers,
purchase choices, and policy-owned Fields cage outcomes. Preboss uses those
same incoming-reward and WorldShop addresses rather than a second terminal-only
candidate vocabulary.

Active F/G/H candidate preparation consumes the normal project evaluation;
there is no candidate-only biome simulator. When upstream history is complete,
room candidates reuse the biome's exact generation views. H Min/Max candidates
reuse the addressed pre-outcome support ledger because the proposed value
cannot change its own prior context. Cage and terminal alternatives apply one
immutable semantic replacement and replay H through the common linear reward
authority with the already-evaluated G seed. If normal project simulation
cannot reach a biome, its candidates report unavailable context rather than
inventing local history.

Ordered candidate queries for one authored snapshot may use one prepared
candidate evaluator, which owns one shared base project simulation. The
application shares its immutable-project `ProjectEvaluation` with that
evaluator and keeps option arrays in a weak cache keyed by immutable project
identity and semantic owner. A semantic edit therefore invalidates the
projection once, while repeated renders consume the same structures. Reward
and shop alternatives still replay their immutable semantic replacement
because their support depends on bag, peer, lifecycle, and history effects.
That replay evaluates the addressed biome through the common linear authority
and reuses the already-evaluated upstream biome; unrelated later biomes are not
candidate inputs. Closed reward and shop controls request their option
projection on focus or pointer intent rather than eagerly rebuilding every
hidden native-select option. React triggers and presents the application
projection but never implements the replay rules.

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

The implemented result shape is:

```ts
interface ProjectEvaluation {
  status: 'empty' | 'valid' | 'incomplete' | 'invalid' | 'blocked';
  projectId: string;
  catalogVersion: string;
  routes: readonly ProjectRouteEvaluation[];
  findings: readonly SemanticFinding[];
  summary: ProjectEvaluationSummary;
}
```

Each route simulation records:

- configured biome identity and the currently registered simulation prefix;
- complete F/G/H evaluations with canonical snapshots, lifecycle events, ledgers,
  room-generation proof, reward witnesses, and findings;
- incomplete F/G/H evaluations without canonical products;
- validated-prefix identity and an exact route-end, simulator-boundary,
  incomplete, or invalid processing horizon;
- semantic findings in stable route and phase order;
- whether the route is eligible for future execution-plan compilation.

The core registry contains complete F, G, and H simulators. Project simulation may
also receive an application-owned simulation scope; reaching a registered
biome outside that scope records a `simulatorBoundary` horizon without
dispatching the biome or inventing local findings. The current application
scope includes F, G, and H, and both application interaction fixtures and
direct core conformance fixtures exercise the full F-to-H prefix.
An entirely unconfigured project has explicit `empty` status, no findings, and
is not eligible for execution-plan compilation.
Candidate results and UI decoration are deliberately absent from this Phase 3
contract.

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
