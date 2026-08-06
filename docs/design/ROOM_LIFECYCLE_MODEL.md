# Room Lifecycle Model

## Purpose and Authority

This document defines the ordered single-room lifecycle that turns one entered
Room Occurrence into a canonical history fragment. It owns the semantic timing
of room preparation, entry, encounters, counter effects, room-owned offer
generation, reward acquisition, outgoing-door generation, purchases,
room-history commit, and exit.

`GAME_GENERATION_RULES.md` owns how an outgoing batch selects and creates its
targets. `REWARD_MODEL.md` owns what offers and acquisitions mean.
`SIMULATION_AND_VALIDATION.md` owns how the simulator composes room fragments,
folds their events into ledgers, and reports findings. Concrete biome documents
own exceptional local phases and select the lifecycle profiles used by their
rooms.

The lifecycle is catalog-derived simulation behavior. It is not persisted UI
state and is not an execution script authored by the user.

The design concept previously described as a "single-room history profile" is
split deliberately into the reusable `RoomLifecycleProfile` declaration and
the concrete `RoomHistoryFragment` it produces. This keeps the recipe distinct
from recorded history.

## Evidence Status

The general separation between target generation, entry, acquisition, and
later outgoing generation is verified against the Hades II extraction. The
midshop ordering was specifically re-audited on 2026-07-19 against:

```text
../../1GameData/Scripts/RoomLogic.lua
../../1GameData/Scripts/EncounterData.lua
../../1GameData/Scripts/EncounterData_Unique.lua
../../1GameData/Scripts/EncounterData_Devotion.lua
../../1GameData/Scripts/EncounterSets.lua
../../1GameData/Scripts/EncounterLogic.lua
../../1GameData/Scripts/InteractLogic.lua
../../1GameData/Scripts/UpgradeChoiceLogic.lua
../../1GameData/Scripts/RewardLogic.lua
../../1GameData/Scripts/RunLogic.lua
../../1GameData/Scripts/StoreLogic.lua
```

Relevant call sites are:

- `EncounterSets.lua:446-453`, `UpgradeChoiceLogic.lua:1035-1066`, and
  `InteractLogic.lua:1124-1149`: an ordinary encounter spawns its reward after
  combat, and completing a loot or consumable pickup removes the required
  object before outgoing exits unlock;
- `EncounterData_Devotion.lua:34-54`, `EncounterLogic.lua:1682-1730`, and
  `RewardLogic.lua:395-398`: Devotion selects and acquires the chosen source
  before starting combat, then spawns the spurned source after combat;
- `RoomLogic.lua:4372-4394`: the prior room is committed, the next room becomes
  current, and `RunShopGeneration` resolves shop inventory;
- `StoreLogic.lua:150-196`: ordinary shop Boon sources resolve while inventory
  is generated;
- `EncounterData_Unique.lua:15-30`: Shop is a noncombat encounter;
- `RoomLogic.lua:1848-1940`: the encounter completes and initiates exit unlock;
- `RoomLogic.lua:3871-3961`: outgoing rooms and their rewards are generated;
- `StoreLogic.lua:1134-1295`: later player purchases remove options and apply
  their effects;
- `RewardLogic.lua:187-207` and `RunLogic.lua:1819-1845`: ordinary source
  support reads acquired `LootTypeHistory`, plus explicit peer exclusions, not
  unpurchased shop offers.
- `RoomLogic.lua:1900-1903`: every counting encounter increments room, biome,
  and route encounter depth when that encounter starts;
- `RoomLogic.lua:4372-4394` and `RunLogic.lua:1857-1869`: the source room is
  appended to history and depth caches are recomputed after its outgoing batch
  exists but before the selected target's encounter preparation and shop
  generation;
- `RunLogic.lua:1912-1928`: biome-local encounter depth and related ledgers
  reset at the layout-owned biome transition rather than at an arbitrary room
  event.

Focused biome authorities remain responsible for verifying that each special
room selects an accurate profile. A new lifecycle profile is not considered
closed until its ordering has a game-data audit and a canonical fixture.

## Core Model

A generated target and an entered room are different semantic objects in time.
The predecessor creates the target occurrence and resolves its incoming reward
offer. Only the picked target is later entered and executes a room lifecycle.

```text
source room reaches outgoing generation
  -> create every target occurrence in physical exit order
  -> resolve every incoming target offer
  -> complete any remaining source-room operations
  -> leave through the selected target
      -> execute that target occurrence's room lifecycle
```

The lifecycle is an ordered transition over immutable simulation state. Every
operation reads the state produced by earlier operations and returns the next
state plus zero or more canonical events. No later operation rewrites an event
or generated target that already exists.

The critical rule is:

> An outgoing batch is validated and materialized from the exact history visible
> at its generation operation. Later acquisitions never retroactively change
> that batch's room identities, rewards, offer projections, or legality.

Preparing the next entered room also starts its empty current-room use record.
Current-run and biome-use records persist. This reset occurs at preparation,
before an entered WorldShop materializes its inventory, because that room is
already the game's current room at that point.

## Vocabulary

`RoomLifecycleProfile`
: A normalized reusable declaration that derives the ordered semantic
operations for one entered room shape from its Room Declaration and complete
room-local materialization. Rooms select a profile through their declaration
or normalized template/encounter composition. Bounded authored phase choices
may select operations within the profile; they do not author the operations
themselves.

`RoomLifecycleOperation`
: One member of the closed semantic operation vocabulary. Operations express
observable game ordering, not presentation callbacks or elapsed frames.

`RoomLifecycleEffect`
: One typed state transition activated while an operation executes. The owning
declaration determines whether and how the effect applies; the lifecycle
profile determines when it can run.

`RoomLifecycleEvent`
: One immutable room-addressed fact emitted after an effect is applied.
Authored rooms use their occurrence address; layout-derived completion rooms
use their stable completion-role address. Events are folded into ledgers and
retained as ordering evidence. An operation may emit zero, one, or several
events.

`RoomHistoryFragment`
: The concrete room-addressed event sequence produced by executing one
lifecycle profile against one entered room and its resolved local state.

`Outgoing-generation checkpoint`
: The operation at which the layout-owned next batch is evaluated and
permanently materialized from the current state.

`Entry history`
: The canonical state visible after preparation and entry but before
room-local encounter or acquisition effects occur.

`Preparation history`
: The post-predecessor-commit state used to select entry-time encounter phases,
shop inventory, and other room-owned prepared facts. It is later than the
predecessor's outgoing-generation state.

`Exit history`
: The state after every supported local acquisition and exit effect has run. It
is threaded into the already-generated picked target's preparation.

## Ownership

| Concern                                                 | Owner                             |
| ------------------------------------------------------- | --------------------------------- |
| Ordered room operations and their state visibility      | Room lifecycle profile            |
| Concrete room, envelope-slot, encounter, and exit facts | Room Declaration                  |
| Encounter counting and phase-local effects              | Encounter/phase declaration       |
| Target structure and outgoing batch attachment          | Biome layout                      |
| Biome transition resets                                 | Route/biome layout                |
| Incoming and room-owned authored reward values          | Room Occurrence leaf state        |
| Acquisition roles emitted at lifecycle points           | Reward producer/type declarations |
| Counter and ledger effect implementations               | Pure simulator registries         |
| Event folding and possibility branching                 | Simulator                         |
| Legality at an operation's pre-state                    | Validator                         |
| Rendered controls and sequencing explanation            | Editor projection                 |

The simulator must not switch on a concrete room name to reconstruct ordering.
The editor must not persist lifecycle operations or history snapshots.

## Closed Operation Vocabulary

The initial semantic vocabulary is deliberately small:

```ts
type RoomLifecycleOperation =
  | { kind: 'prepareRoom' }
  | { kind: 'materializeOfferPoint'; offerPoint: string }
  | { kind: 'enterRoom' }
  | { kind: 'startEncounter'; encounterRole: string }
  | { kind: 'completeEncounter'; encounterRole: string }
  | { kind: 'runEncounterSequence' }
  | { kind: 'runRewardEncounterSequence' }
  | { kind: 'advanceProducer'; point: ProducerLifecyclePointKey }
  | { kind: 'generateOutgoingBatch' }
  | { kind: 'applyShopPurchases'; offerPoint: string }
  | { kind: 'commitRoom' }
  | { kind: 'exitRoom' };
```

This is the stable semantic vocabulary. Production TypeScript may use narrower
field names and grouped operation inputs, but it must preserve this ownership
and ordering contract.

`prepareRoom` resolves bounded room-entry structure from the state after the
predecessor commits. It selects encounter phases and other entry facts; it does
not reconsider the room or incoming reward already generated by the
predecessor. `materializeOfferPoint` covers room-owned offers rather than
incoming door offers. Initial examples are entry-generated shop inventory and
O's internal reward wheels. `advanceProducer` does not regenerate an offer; it
advances an already-resolved producer and emits the acquisition roles bound to
that point. `commitRoom` appends declared history and updates commit-time
caches before the selected target prepares.

`runEncounterSequence` executes every already-prepared active phase of one
Encounter Envelope in declaration order. It emits start, definition-owned
depth advancement, and completion for each phase. H uses it for the passive
Fields phase followed by the active two- or three-cage prefix. Cage reward
offer and acquisition events remain separate local producers rather than being
hidden inside this encounter operation.

`runRewardEncounterSequence` adds declaration-owned phase offer points around
that same encounter sequence. For every selected O ShipCombat phase it emits
the phase offer before encounter start and the picked acquisition after
encounter completion when the phase declares an offer point. Intro has no
offer: the ordinary Intro definition is non-counting, while a selected
Heracles Intro increments encounter depth once. Combat1 and the conditionally
selected Combat2 each increment encounter depth once, materialize one complete
active wheel jointly, and acquire only its selected offer. The canonical room
passes the selected encounter-phase prefix to the executor; the executor
rejects a non-prefix selection or omission of a required phase.

History exposes both materialization and acquisition checkpoints for each
phase offer point. Reward simulation evaluates all active offers at the former
state, consumes only the picked offer at the latter state, and resolves the
room's outgoing store from the final active wheel. The acquisition event also
records that active wheel's selected store in entered-store history before a
later phase or room can evaluate reward-ratio support. A two-wheel room
therefore contributes two ordered store entries; dormant wheel capacity emits
no lifecycle or store-ledger event.

Encounter record history retains the concrete definition, envelope, stable slot,
and exact room origin. Consumers must not recover those facts from a maximum
capacity Room Declaration: an H Min outcome activates only its two-cage prefix
even though the declaration's complete envelope retains the third cage.

Do not introduce an unrestricted callback or event DSL. Add or split an
operation, effect, or event kind only when audited game behavior has an
observable distinction that the closed vocabulary cannot represent correctly.

### Concrete Encounter Preparation

`prepareRoom` resolves an active room's Envelope slots from the
post-predecessor-commit checkpoint. A fixed binding supplies its exact
definition; a pool-backed binding supplies the room instance's exact authored
definition. For each valid active slot, preparation appends an
`encounterRecorded` event before entry. The event carries the definition key,
envelope key, stable slot key, and exact room-instance origin.

A later slot in the same room evaluates against the preceding recorded prefix.
It can therefore observe exact earlier encounter identities, while encounter
counters remain at the post-predecessor snapshot until the matching
`encounterStarted` event. Previous-room spacing is a different view: it
examines committed predecessor room origins and excludes every slot owned by
the room currently being prepared. These are checkpointed projections of one
canonical event fold, not a profile baseline, provisional counter slate, or
NPC-specific ledger.

An active retained selection that fails its requirements is not replaced.
Preparation keeps its exact phase address available for correction, emits no
substitute definition, and stops canonical execution before that phase's
start, counter, reward, completion, or room commit. Later structurally active
slots remain authorable from the valid record prefix. A valid
definition-owned `terminateSuffix` effect may end the remaining active
sequence; an invalid selection never performs that trim. Dormant slots retain
their authored choice but emit no lifecycle product.

`encounterStarted` applies only the resolved definition's encounter-depth
effect. `encounterCompleted` stays at its declared later lifecycle point. N
entered side rooms execute their local-child preparation and lifecycle in
authored `enteredOrdinal` order before the corresponding parent restore. The
same ordered history therefore supports ordinary rooms, O/P/H multi-phase
rooms, and N local children without a second encounter engine.

## Operations, Effects, and Events

Operations, effects, and events are deliberately different concepts:

```text
RoomLifecycleProfile selects an operation
  -> operation reads its exact pre-state
  -> declarations select applicable typed effects
  -> simulator applies each effect
  -> immutable RoomLifecycleEvents record what occurred
  -> next operation receives the resulting state
```

For example, `startEncounter(main)` does not hard-code counter arithmetic into
a one-phase room profile. It resolves the already-prepared concrete encounter
definition. When that definition counts for encounter depth, the operation
applies the room, biome, and route encounter-depth effects and emits addressed
counter-change events before combat continues.

Likewise, `commitRoom` does not blindly increment every depth axis. It applies
the Room Declaration and layout's commit policy, appends the appropriate room-
history fact, recomputes `runDepthCache` and `biomeDepthCache`, advances the
route-wide room-history ordinal when declared, and emits the corresponding
events. A biome reset is a later layout transition effect, not a hidden part of
an arbitrary room profile.

The first expected effect families are:

- room preparation and resolved encounter-sequence facts;
- room appearance and current-room facts;
- required-object spawn and completion facts;
- encounter occurrence, start, completion, and counting-depth changes;
- room creation, offer, counted-bag, and offer-projection changes;
- concrete acquisition and acquisition-driven counter changes;
- shop purchase and active-option changes;
- room-history commit, depth-cache, and route-ordinal changes;
- biome transition resets outside the completed room fragment.

Effect kinds and event kinds use closed registries with strict normalization.
They are additive when new audited behavior becomes observable, but an unknown
kind is a catalog or construction error rather than a silent no-op.

## Operation Timing Matrix

| Operation                 | State it observes                                      | Typical effects and emitted facts                                                                                          |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `prepareRoom`             | Post-predecessor-commit history                        | Resolve encounter sequence, optional phase support, and other entry materialization                                        |
| `materializeOfferPoint`   | The operation's current state                          | Resolve room-owned shop or wheel offers, consume bags, and apply offer projections                                         |
| `enterRoom`               | Prepared room state                                    | Emit semantic appearance/current-room facts and activate the entered occurrence                                            |
| `spawnRequiredObjects`    | Entered-room state                                     | Emit declaration-owned required-object spawns and activate their exit blockers                                             |
| `startEncounter`          | State before the declared encounter phase              | Emit encounter occurrence/start and increment declared room, biome, and route encounter-depth axes                         |
| `completeEncounter`       | State after the phase's combat or noncombat work       | Emit completion facts and release phase-local blockers                                                                     |
| `completeRequiredObjects` | State after the declared required-object work          | Emit paired completion facts and release the corresponding required-object blockers                                        |
| `advanceProducer`         | State at the producer's named point                    | Resolve acquisition roles, project loot/use history, and update acquisition-driven counters                                |
| `generateOutgoingBatch`   | Current state before this room commits                 | Create targets sequentially, resolve incoming offers, consume counted bags, and apply offer projections                    |
| `applyShopPurchases`      | Already-generated outgoing batch plus active inventory | Execute the authored purchase order, remove purchased options, and apply purchase acquisitions without rewriting the batch |
| `commitRoom`              | State after supported room-local work                  | Append declared room history, recompute depth caches, advance route ordinal, and record entered-store policy               |
| `exitRoom`                | Committed source state plus selected generated target  | Close the fragment and transfer control to the selected target's preparation                                               |

The table describes semantic visibility, not elapsed time or presentation
callbacks. An effect belongs at the earliest operation after which a supported
game rule can observe it.

## Canonical Lifecycle Profiles

### Standard Reward Room

```text
prepareRoom
enterRoom
startEncounter(main)
completeEncounter(main)
advanceProducer(roomRewardPickup)
generateOutgoingBatch
commitRoom
exitRoom
```

The incoming offer was resolved by the predecessor. Its concrete acquisition
updates history before the outgoing batch is evaluated, so the next rooms and
rewards observe it.

### Ephyra Opening

```text
prepareRoom
enterRoom
advanceProducer(roomRewardPickup)
startEncounter(OpeningGeneratedN)
completeEncounter(OpeningGeneratedN)
generateOutgoingBatch
commitRoom
exitRoom
```

`N_Opening01` is not a standard reward-room ordering. Its encounter starts
late and the room waits for its reward pickup first. `N_PreHub01` uses the
standard combat-then-reward profile, while its encounter declaration keeps
that combat non-counting.

### Ephyra Main Target

```text
prepareRoom
enterRoom
spawnRequiredObjects(SoulPylon)
advanceProducer(beforeCombat)
startEncounter(main)
completeEncounter(main)
completeRequiredObjects(SoulPylon)
advanceProducer(afterCombat)
advanceProducer(roomRewardPickup)
generateOutgoingBatch
commitRoom
exitRoom
```

Devotion, when supported by a producer, still emits its chosen and spurned
roles at their declared before/after-combat points. The required Soul Pylon
spawns at entry and completes after combat but before reward pickup, local
side-room generation, or exit. Ephyra side rooms use the standard
combat-then-reward order without outgoing generation; the persistent Hub uses
entry, one stable-board generation, commit, and exit without a producer.

### Devotion Room

```text
prepareRoom
enterRoom
advanceProducer(beforeCombat)
startEncounter(main)
completeEncounter(main)
advanceProducer(afterCombat)
generateOutgoingBatch
commitRoom
exitRoom
```

The chosen and spurned sources acquire at different points, but both precede
outgoing generation. Devotion's spacing projection remains an offer-time event
that occurred when the predecessor generated this room.

### World Shop

```text
prepareRoom
materializeOfferPoint(shopInventory)
enterRoom
generateOutgoingBatch
applyShopPurchases(shopInventory)
commitRoom
exitRoom
```

Shop inventory and the outgoing batch both observe pre-purchase acquisition
history. The full generated inventory is the current-room shop option set while
the outgoing batch is evaluated. Purchases update history only after that batch
already exists.

The selected next room is therefore also already created and rewarded before
the purchase. Shop acquisitions first affect generation when that selected
room later reaches its own outgoing-generation checkpoint. This is the precise
meaning of shop purchases having a one-room-delayed effect on room generation;
the acquisition itself is not delayed.

Canonical support fixture:

```text
commit predecessor with 3 acquired ordinary sources
  -> prepare WorldShop and materialize its inventory
  -> enter WorldShop
  -> shop inventory offers a 4th source
  -> outgoing batch offers a 5th source
  -> player purchases the 4th source
  -> player enters and may acquire the already-offered 5th source
```

This trace is valid. Validating the outgoing fifth source against post-purchase
history would be an ordering bug.

### Ordered Multi-Encounter Room

O and later multi-phase rooms compose the same operations rather than owning a
separate history engine:

```text
prepareRoom
enterRoom
startEncounter(intro)
completeEncounter(intro)
materializeOfferPoint(wheel1)
startEncounter(combat1)
completeEncounter(combat1)
advanceProducer(wheel1Acquisition)
... optional declared phases ...
generateOutgoingBatch
commitRoom
exitRoom
```

The concrete O authority owns its exact active phases and offer points.
`prepareRoom` derives whether its conditional phase exists from pre-room state;
a counter increment from an earlier phase cannot retroactively add another
phase. The shared lifecycle model owns their ordered execution and state
visibility.

### Preboss and Persistent Structures

A selected Preboss completes its declaration-owned normal-door batch, enters
through its normal room lifecycle, and then begins the layout-owned completion
sequence. A persistent Hub may generate a stable board once and later emit
restore fragments. Those are structural compositions of room-addressed
fragments, not reasons to weaken the ordering contract or introduce UI-shaped
rows into history.

## Counter and Cache Timing

Counter names that sound similar are not interchangeable, and they do not
advance at one generic "room completed" point.

### Encounter Depth

When a declared encounter phase counts, `startEncounter` increments:

- the current room's encounter depth;
- `biomeEncounterDepth`;
- route-wide encounter depth.

The increment occurs before the encounter's combat work, completion, reward
pickup, and outgoing generation. A room with several counting phases can
therefore increment encounter depth several times while contributing only one
later room commit. A non-counting phase emits its occurrence/start facts but no
depth effect.

Phase structure that the game prepares before room entry reads preparation
history. It cannot become active because another phase increments
`biomeEncounterDepth` later in the same room. O's conditional Combat2 is the
first concrete fixture for this rule.

### Depth Caches and Room-History Ordinal

`runDepthCache`, `biomeDepthCache`, and route-wide room-history ordinal advance
at `commitRoom`, after the source's outgoing batch has already been generated.
Consequently:

- the source room's outgoing room and reward choices read its pre-commit depth
  caches;
- the source room's counting encounters may already have changed encounter
  depth when those outgoing choices are generated;
- committing the source updates depth caches before the picked target executes
  `prepareRoom`;
- the picked target's prepared encounters and shop inventory see the committed
  predecessor depth;
- the picked target does not contribute its own depth-cache increment until it
  later commits.

Layout initial counters describe the state before the fixed start commits;
they are not a replacement for that room's declaration-owned contribution.
F and N begin new routes at `biomeDepthCache = 0`. Later biomes begin at
`biomeDepthCache = 1` after the prior biome transition. In both cases, a
supported Opening or Intro with a one-step room-history contribution generates
its outgoing target from the initial source depth and advances the cache once
at commit. Candidate evaluation consumes the recorded source view directly and
must not add that contribution speculatively.

The semantic `enterRoom` event may record that an occurrence was entered, while
game-shaped room-history caches remain commit-time effects. Consumers must name
the exact ledger they require rather than treating "appearance" and "committed
room count" as the same timestamp.

### Generation and Acquisition Counters

Each physical target creation inside `generateOutgoingBatch` immediately
updates creation history before the next peer is evaluated. Incoming offers
likewise consume counted bags and apply offer projections in physical order.
None of those target offers enter acquisition history unless that occurrence
is later picked and its producer advances.

Acquisition-driven counters update at their producer point. Examples include
loot/use histories, ordinary-source history, Clockwork Goal progress, and I's
non-goal acquisition count. A final room aggregate cannot safely reconstruct
these intermediate views.

I initializes `clockworkGoalsRemaining` from the declaration-owned Clockwork
`initialGoalCount` (currently `5`),
`clockworkNonGoalRewardsAcquired = 0`, and the authored
`clockworkMaxNonGoalRewards` at `biomeStarted`. Every generated batch records
that exact pre-generation view before its targets are created. An entered Goal
emits `clockworkGoalAcquired` immediately after room entry and clamps the
remaining count at zero; an entered concrete NonGoal emits
`clockworkNonGoalRewardSpawned` at its actual reward-spawn boundary and advances
only the non-goal count. Ordinary rewards spawn after encounter completion;
Devotion spawns before its declared before-combat acquisition. Unpicked offers
emit neither event. The preboss carries Goal structurally and therefore only
confirms the already-zero state.

### Biome Transition Resets

Biome-local resets occur after the declared completion sequence at the layout
transition boundary. They are not `exitRoom` defaults and are not repeated by
every room profile. The next biome starts from the reset state plus any
route-wide history retained by its declared transition policy.

The initial closed transition vocabulary is one ordered `resetCounter` effect
over `biomeDepthCache` or `biomeEncounterDepth`. Every current layout declares
both effects in that order. Route encounter depth and room-history ordinal are
not biome-local and therefore receive no reset event.

## History Views and Composition

Composition begins with one addressed `biomeStarted` event whose payload owns
the biome's exact layout-declared initial counter state. For F that state is
`biomeDepthCache = 0`, `biomeEncounterDepth = 1`, route encounter depth `1`,
and room-history ordinal `0`. The opening's later commit applies its declared
`biomeDepthCache = 1` delta. These are separate events so generation contacts
never depend on an implicit fold initializer or a hidden opening exception.
G begins at `biomeDepthCache = 1` and `biomeEncounterDepth = 1`, matching the
game's between-biome depth baseline. Its route encounter depth and room-history
ordinal are carried from F after F's declared biome-local resets.
N is the first Surface biome and starts at `biomeDepthCache = 0`,
`biomeEncounterDepth = 1`, route encounter depth `1`, and room-history ordinal
`0`. Its Hub history additionally initializes generated-side-room and Soul
Pylon spawn/completion counters at zero.

Every fragment exposes conceptually distinct states:

```text
predecessorOutgoingGenerationHistory
  -> predecessor remaining local operations
  -> predecessorCommittedHistory
  -> prepare selected room
  -> preparationHistory
  -> enter selected room
  -> entryHistory
  -> ordered local operations before outgoing generation
  -> outgoingGenerationHistory
  -> generate and freeze outgoing batch
  -> ordered remaining local operations
  -> commit current room
  -> committedHistory
  -> exitHistory transferred to the selected target
```

The simulator need not persist a full state snapshot at every operation. It
must preserve the event order and be able to evaluate each rule from its exact
pre-operation view.

Fragment composition threads state while following the picked target:

```text
current RoomHistoryFragment
  -> generated target occurrences and incoming offers
  -> remaining current-room operations and commit
  -> picked target preparation and RoomHistoryFragment
  -> generated target occurrences and incoming offers
  -> ...
```

Unpicked targets contribute creation, offer, bag-consumption, and offer-
projection events at the source room's outgoing checkpoint. They never execute
an entered-room fragment and never emit concrete acquisitions.

Each physical target has a `roomCreated` event followed by a
`targetGenerationCompleted` marker. Room/reward legality, incoming-offer, bag,
and offer-projection events occupy that interval in physical order. Commit 4
initially contains only creation in the interval; later reward integration may
insert its events without moving either boundary or changing the target's
pre/post generation views.

## Possibility and Validation

An operation may branch when several outcomes have positive support, including
counted-bag explanations, generated-store outcomes, or reward-source outcomes
within one authored shop purchase order. Each branch still has one total event order. Equivalent
post-operation states may be merged while retaining at least one witness.

Validation occurs at contact points in that order:

1. catalog normalization validates profile operation kinds and references;
2. room/template normalization validates profile compatibility;
3. lifecycle execution validates authored offers and acquisitions against the
   state visible at their operation;
4. outgoing generation validates the authored batch against its exact
   generation history;
5. fragment composition validates the picked continuation and folds the result;
6. findings address the owning occurrence, offer point, acquisition, or batch,
   never a rendered row.

A final flattened history is insufficient evidence that every intermediate
decision was possible. The simulator must retain ordered events or equivalent
operation witnesses so validation cannot accidentally use a later state for an
earlier decision.

## Additive Extension Contract

The lifecycle model is intentionally extensible, but it is not a mirror of all
game callbacks. A new operation, effect, or event kind is justified only when
its ordering changes a supported declaration, authored choice, history ledger,
validation result, execution instruction, or runtime conformance finding.

Extension procedure:

1. identify the observable consumer and the exact missing distinction;
2. locate the game-data call sites and determine the relevant pre/post state;
3. decide whether the behavior is room-local, encounter-local, reward-local,
   layout-structural, or route-structural;
4. reuse an existing operation with a new declaration-owned effect when only
   state mutation differs;
5. add a new operation only when existing operations cannot express the
   required ordering;
6. add normalized references, strict dispatch, events, ledgers, and fixtures
   together;
7. update the concrete biome authority and this shared lifecycle authority.

Likely room-local additions include wells, gathering, challenges, and other
optional interactions when they enter product scope. Persistent NPC entities
may transform or insert encounter phases during `prepareRoom`. A Chaos or
Anomaly detour changes route structure and therefore composes at outgoing
generation through a layout/route feature; it must not be disguised as a local
room event.

Presentation-only callbacks remain excluded. Unknown or deferred behavior is
documented in audits and suppressed according to the owning feature contract;
it does not become a generic production `unsupported` operation.

### Anomaly and Zagreus inserted-room ordering

Anomaly and `C_Boss01` use the ordinary entered-occurrence lifecycle. Their
automatic host target is generated at their outgoing-generation checkpoint:
after entry-time and room-local effects (including reward acquisition), but
before their own commit-time room history, route ordinal, `runDepthCache`, and
host `biomeDepthCache` effects. The room then commits and the generated target
enters automatically. The target is a distinct, normal host target with a
normally selected and consumed reward; automatic and hidden are presentation
and traversal facts, not an accounting-free callback.

Anomaly's fixed `GeneratedAnomalyB` uses the normal counting encounter path;
its retained incoming offer is acquired only when authored success is true.
`C_Boss01` runs fixed `BossZagreus01`, acquires `InfernalContractBoon`, and
does not advance encounter depth. Both once-per-route limits are consumed only
when the inserted occurrence enters, not when an authored replacement or
additional exit is created.

## Audit and Fixture Requirements

Every lifecycle profile must record:

- the game-data functions or declarations establishing its order;
- which operations read pre-event versus post-event state;
- every declaration-owned effect and emitted event kind;
- encounter-start and completion counter effects;
- commit-time depth/cache/ordinal effects;
- every offer point and acquisition point;
- the outgoing-generation checkpoint, or the reason it has none;
- any intentional simplification, deferral, or exclusion;
- at least one canonical event-order fixture.

Timing fixtures should assert both events and observable state boundaries. The
initial conformance set must include:

- a standard room whose acquired reward affects its outgoing batch;
- a Devotion whose first and second acquisitions straddle combat;
- a WorldShop whose purchase does not affect its already-generated outgoing
  batch, including the fourth-shop-source/fifth-door-source trace;
- an unpicked target whose offer affects offer history but never acquisition
  history;
- an O `ShipCombatRoom` with selected `HeraclesCombatO` at Intro, proving that
  its counting record precedes the later active main phases without trimming
  the suffix, and with the active Combat2 wheel retaining its independent
  offer/acquisition timing.

Each profile audit should use this compact record:

```text
Profile:
Concrete rooms/templates:
Game-data evidence:
Prepared structure:
Ordered operations:
Declaration-owned effects:
Pre/post state read by each rule:
Outgoing-generation checkpoint:
Commit behavior:
Exact / Simplified / Deferred / Excluded notes:
Required fixtures:
```

Future runtime mismatch reports should identify the room occurrence, lifecycle
operation, expected pre-state, observed event, and subsequent divergence. A
mismatch updates the relevant lifecycle profile or audit; the game module must
not grow an independent timing workaround.

## Implementation Boundary

Pure reward and shop transitions operate against explicit fact snapshots.
Lifecycle-profile execution decides when a room invokes those transitions and
fragment composition threads the resulting state between rooms.

For shops, the required orchestration is:

```text
commit predecessor
  -> prepare shop from committed predecessor history
  -> validate/materialize shop inventory from preparation history
  -> enter shop
  -> generate outgoing batch from the same pre-purchase history
  -> execute the authored purchase order and derive exit history
  -> commit and exit the shop
  -> prepare and enter the already-generated picked target
```

Calling shop purchase simulation before outgoing generation would violate this
document even if the final acquisition ledger looked plausible.
