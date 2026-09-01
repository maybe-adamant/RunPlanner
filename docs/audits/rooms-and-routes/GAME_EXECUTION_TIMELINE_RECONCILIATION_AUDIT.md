# Game Execution Timeline Reconciliation Audit

## Status and purpose

Audit completed on 2026-09-01 against the current closed Room Action model,
the protocol-v9 execution boundary, the installed Hades II source evidence
already preserved by the focused audits below, and the live F/G integration
findings recorded during executor probing.

The implementation disposition was refined after the first protocol-v10
engine slice exposed unnecessary dual authority between semantic streams and
explicit dependencies. The source findings and hard-edge matrix are unchanged;
the preferred representation below normalizes every hard ordering relation to
one planner-owned prerequisite DAG.

This audit answers one feasibility question:

> Can the game module reconcile the planner's room Timeline without requiring
> an exhaustive list of legal action permutations or rebuilding the planner's
> simulator?

The answer is **yes, with a bounded condition**: runtime reconciliation must be
based on occurrence-local semantic action identity, lifecycle windows, and a
sparse partial order owned by complete-valid planner evaluation. That partial
order is most directly represented as prerequisite edges between exact semantic
owners. It is not viable as a single callback cursor, an anonymous set of
expected action signatures, a second runtime rule engine, or an unowned sequence
that silently reallocates authored outcomes.

This audit covers every action family in the current authored
`RoomActionReference` union, the automatic Timeline effects currently inserted
by simulation, and the feature-local Shrine purchase/delivery distinction. It
does not define a wire schema, Lua hook list, implementation module, React
surface, migration, delivery gate, or compatibility strategy. Those decisions
belong in a later implementation plan if this disposition is accepted.

## Owning evidence

This audit composes existing source-backed conclusions rather than copying
their complete source matrices:

- [Room Action Order](ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md) owns barriers,
  interleaving, Fields, ShipCombat, fountain/rack, and outgoing-generation
  chronology.
- [Acquisition, Delivery, and Room Settlement](../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md)
  owns source interaction, acquisition roles, generated children, Shop
  settlement, and delayed Shrine delivery.
- [Room Features](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md) owns
  resources, Pools, Shrines, Wells, Travel Deal, and consequential Well-item
  effects.
- [Run-Impacting Trait Effects](../traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md)
  owns Steady Growth, Sea Star, Buried Treasure, Quick Buck, and generated
  pickup consequences.
- [Keepsakes](../loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md) owns the
  rack swap, immediate equip effects, retained effects, and fountain ordering.
- [Room Lifecycle](../../design/ROOM_LIFECYCLE_MODEL.md) owns the stable
  semantic lifecycle boundaries used by the planner.
- [Game Integration Boundary](../../design/GAME_INTEGRATION_BOUNDARY.md)
  records the current protocol-v9 behavior whose strict linear conformance is
  assessed here.

The current TypeScript model is evidence of what the planner already
distinguishes. It is not evidence that protocol v9 chose the correct runtime
reconciliation policy.

## Terms

**Semantic action owner**
: The stable occurrence-local address of the concrete room action. Two Boons,
two Poms, or two purchases with the same game identity remain different when
they have different owners.

**Native contact**
: One game function or state change observed while a semantic action happens.
A single action may have several native contacts, such as opening a trait
screen, selecting an option, applying the trait, and closing the screen.

**Semantic transaction**
: One player-significant planner action and all native contacts needed to
realize and prove its result. Native contacts inside the transaction are not
independently reorderable Timeline actions.

**Lifecycle window**
: The declaration-owned interval in which an action may occur: before combat,
after an exact encounter, a Fields interval, a ShipCombat wheel interval, or
after outgoing generation.

**Hard edge**
: An ordering relation whose reversal changes legality, object existence,
offer generation, a consumed one-use effect, or a later planner-visible
result.

**Commutative actions**
: Two participating actions that can execute in either order without changing
their legality or any planner-modeled later result. Merely sharing a
lifecycle window does not prove commutativity.

**Checkpoint obligation**
: A participating action that must be complete before a lifecycle boundary,
such as the next ShipCombat phase, outgoing generation, or room exit.

**Guidance-only action**
: An authored action whose exact runtime order has no supported semantic proof
or no planner-visible consequence. Its absence or different placement may be
logged, but it does not justify freezing realization.

**Semantic prerequisite**
: A directed hard edge between two exact semantic owners. The dependent owner
cannot complete until the prerequisite owner has completed. An ordered family
of such actions is only shorthand for the corresponding edge chain; it is not a
second runtime primitive.

## Feasibility criteria

Timeline reconciliation is viable only when all of the following hold:

1. Every participating action can be associated with one semantic owner before
   or at its first player-significant native contact.
2. A semantic transaction has one completion proof even when native execution
   uses several callbacks or an asynchronous presentation thread.
3. Every hard ordering relation is expressible as a lifecycle window, a source
   dependency, a fixed checkpoint obligation, or a small source-backed
   effect-consumption rule.
4. If one native contact could match several actions, the candidates are
   either semantically equivalent or distinguishable by their bound owner.
5. The game module can realize or observe each consequential result without
   rerunning reward eligibility, trait eligibility, or planner simulation.

The approach is not viable if two non-equivalent actions require different
future behavior but produce an indistinguishable native contact and cannot be
bound to distinct native objects, phases, slots, or screens. It is also not
viable if legal ordering can be known only by replaying every permutation
through the reward and trait kernels.

## What the planner already provides

The existing planner model is closer to a reconcilable contract than the
current execution trace suggests:

| Planner fact                           | Current status                                          | Reconciliation consequence                                                       |
| -------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Occurrence identity                    | complete                                                | scopes every action to one entered physical room                                 |
| Semantic action owner                  | complete                                                | prevents same-name rewards from becoming one anonymous action                    |
| Required versus optional participation | complete                                                | defines checkpoint obligations without inferring them from native object type    |
| Lifecycle window                       | complete                                                | prevents actions from crossing combat, wheel, outgoing, or delivery boundaries   |
| Explicit source dependency             | complete for generated children and structural barriers | proves source-before-child without scanning prior callbacks                      |
| Authored total order                   | complete                                                | remains the planner's simulation chronology and user guidance                    |
| Fixed outgoing checkpoint              | complete in simulation                                  | distinguishes optional effects that did or did not influence the generated batch |
| Runtime blocking disposition           | not complete in the engine execution product            | must not be guessed from callback names or reward categories                     |
| Semantic transaction boundary          | not represented by the linear trace                     | protocol v9 may split one action into several cursor obligations                 |

The missing facts are narrow execution dispositions, not another reward or
trait model.

## Why permutations do not need to be enumerated

The game does not execute an arbitrary bag of actions. It supplies a rigid
lifecycle skeleton containing small player-controlled regions. Within each
region, most ordering pressure comes from a sparse set of edges:

```text
lifecycle window
  -> source action
       -> produced child, when any
  -> required-object / phase checkpoint
  -> next lifecycle window
```

The planner's total order is still necessary because simulation must evaluate
one exact authored run. Runtime conformance does not need to turn every adjacent
pair in that order into a blocking edge. It needs only the edges that protect a
planner-visible result.

This distinction avoids both bad extremes:

- a cursor makes every callback and every adjacent authored row a hard edge;
- an unordered set loses source dependencies, first-use effects, and the
  before/after-outgoing distinction.

## Closed action-family assessment

### Structural and encounter actions

| Authored family      | Stable identity and native proof                                              | Ordering disposition                                                                                                                                                        | Runtime consequence                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `completeFieldsCage` | occurrence plus exact cage/phase; encounter completion proves the barrier     | hard phase barrier; precedes that cage's reward and any phase-produced blocker; authored cage order matters because it changes which objects become available between waves | exact, blocking transaction when H is supported                                                                                                   |
| `chooseRewardWheel`  | occurrence plus wheel key; the selected wheel state is native and phase-local | hard before its matching combat and `interactWheelReward`; a later wheel cannot cross the prior required-object wait                                                        | exact, blocking transaction when O is supported                                                                                                   |
| `interactEncounter`  | occurrence plus encounter phase; the NPC or event object is phase-owned       | the interaction follows its phase barrier; its screen and applied result are one transaction; generated pickups remain separate children                                    | required completion remains a checkpoint obligation; the chosen outcome is blocking only when it changes modeled state or creates a modeled child |
| `interactGorgon`     | occurrence plus hosted phase and forced Gorgon owner                          | follows the hosted phase and, in Fields, blocks a later cage until resolved                                                                                                 | exact, blocking transaction when the forced contact exists                                                                                        |

Encounter start and encounter end are lifecycle scheduling contacts, not
player actions. They may arm a transaction or prove that its window opened;
duplicate or representation-only callbacks are not conformance events.

### Reward-source and pickup actions

| Authored family            | Stable identity and native proof                                                                                   | Ordering disposition                                                                                                                            | Runtime consequence                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `interactIncomingReward`   | source occurrence, producer point, and acquisition role; the realized reward object can retain that owner          | normal pickup, Time Piece, or Artificer is one mutually exclusive source transaction; trait/Pom subcontacts complete that transaction           | exact for modeled disposition and payload; required sources are checkpoint obligations       |
| `interactLocalReward`      | occurrence, local group, slot, and where applicable phase                                                          | follows its cage barrier when attached; optional Fields rewards may occur in any legal gap but are not anonymous                                | same contract as an incoming source; optionality changes checkpoint obligation, not identity |
| `interactWheelReward`      | occurrence, wheel, selected offer, and spawned reward object                                                       | hard after matching combat and before the next phase's required-object barrier                                                                  | exact for modeled disposition and payload                                                    |
| `interactAcquisitionEntry` | acquisition site plus entry key; the materialized object is distinct even when its game name equals another pickup | follows its producer when generated; Shrine delivery also follows its exact maturity checkpoint; required entries block their owning checkpoint | exact for modeled pickups; untouched optional entries need no fabricated acquisition         |

An acquisition may contain several native subcontacts. A Boon can open a
screen, construct options, accept one selection, apply a trait, and close the
screen. A Pom can similarly select and apply a target. Concave Stone can add a
second frozen selection before the acquisition transaction finishes. These are
not independent Timeline rows unless the source creates another freely
interactable world object.

The following source-backed cases deliberately remain separate transactions:

- Artificer destroys a source and creates a later replacement object.
- Sea Star may retain the same consumable for a second later use or create a
  fresh required loot object.
- Echo last-reward recreation produces a later pickup.
- Buried Treasure and Quick Buck produce optional later pickups.
- A Shrine purchase creates pending state; the later delivery is a required
  pickup at another semantic owner.

### Shop-like and room-object actions

| Authored family            | Stable identity and native proof                                                                 | Ordering disposition                                                                                                                    | Runtime consequence                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interactShopOffer`        | exact generated offer/slot and its native store object                                           | accepted purchase plus immediate item application is one transaction; a separately spawned Echo/Contract child remains another action   | exact when the purchase changes modeled state or produces a modeled child; otherwise guidance-only; unpurchased inventory is Overview content, not a missing action |
| `purchaseStygianWellOffer` | exact generation key and generated native option                                                 | purchase and immediate Well effect are atomic; first-purchase, next-use, and Extended-consumption rules add sparse edges                | exact for consequential items and authored random Twist result; simulation-neutral economic/combat detail is diagnostic                                             |
| `sellPurgingPoolTrait`     | exact Pool slot and trait identity; trait removal proves completion                              | separate sales of distinct traits commute when no other sensitive action is interleaved; each sale must still remove its authored trait | exact trait-removal transaction; Gold amount is neutral                                                                                                             |
| `interactKeepsakeRack`     | the room has one rack and one selected replacement; closing after a changed selection commits it | order is sensitive relative to fountain use and any later action observing the new keepsake or its immediate equip result               | exact replacement transaction; opening/closing without a change is not an authored action                                                                           |
| `useFountain`              | the room has one declared fountain; disabling/removing the required object proves use            | order is sensitive relative to rack changes and trait mutations; the asynchronous Phial rarity callback belongs to the same transaction | exact required transaction; healing amount remains neutral                                                                                                          |

Opening a Well or Pool and leaving it without a selected purchase or sale is
not an authored Timeline action. Presence and `interacted` inventory policy are
Overview facts. The executor may need the native interaction to realize an
authored inventory, but an empty open/close cycle does not advance room
chronology.

### Automatic and feature-local contacts

| Contact                        | Why it is not a freely ordered action                                                           | Reconciliation disposition                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Steady Growth                  | a qualifying encounter-end effect increments the clock and may force one authored rarity target | bind the random target at the exact end-effects seam and verify the mutation; no player-action matching    |
| Transcendent Embryo maturity   | its encounter counter transforms one exact blessing automatically                               | bind the authored replacement at the exact end-effects seam and verify; no player-action matching          |
| Successful resource collection | the planner assumes automatic room-exit collection at one authored point                        | realize the Overview object and verify/log the fixed room-exit element contribution; it is not reorderable |
| Shrine purchase                | purchase schedules pending delivery; it does not acquire the delivered item                     | feature-local compliance contact, not a room-action row                                                    |
| Rushed Shrine delivery         | closing the Shrine after the deliberate rushed purchase creates a required pickup               | the delivery pickup is the Timeline transaction; purchase/rush setup is its producer contact               |
| Delayed Shrine delivery        | a qualifying encounter-end effect matures retained pending state                                | the later required pickup is owned by its reached delivery site and exact phase                            |

Multiple delayed Shrine items can mature together. Their materialized pickup
objects retain separate delivery-entry owners; their acquisition order is the
ordinary order of those required pickup actions, not the order in which native
countdown callbacks happened.

Rushed Shrine purchases are resolved deliberately one at a time. The first
rushed delivery is also the first accepted purchase for Travel Deal purposes;
normal delayed scheduling does not consume that refill. This is a sparse
feature-local producer rule, not a reason to put every purchase callback in the
room Timeline.

## Sparse hard-edge matrix

The current action catalog requires the following edge families. No source
evidence requires a general pairwise action matrix.

| Edge family                        | Source-backed examples                                                                               | Why reversal is unsafe                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Lifecycle window                   | wheel choice before combat; Well purchase after outgoing; delivery after exact encounter end         | the object or action does not yet exist outside the window                   |
| Barrier to produced interaction    | Fields cage before its reward; combat before NPC interaction                                         | the interaction is unusable or absent before the barrier                     |
| Source to child                    | Artificer replacement, Sea Star second pickup, Echo duplicate, Quick Buck/Buried Treasure drop       | the child has no native identity before the source creates or retains it     |
| Required action to checkpoint      | required reward before outgoing/next O phase/exit                                                    | the game itself blocks the checkpoint while the object remains required      |
| Optional action to outgoing        | an optional acquisition authored before outgoing whose state affects door generation                 | moving it after outgoing changes the batch's input history                   |
| Modeled mutation to later consumer | trait acquisition before a later trait offer; a removal or level change before a later target domain | the later authored payload was evaluated from the post-mutation prefix       |
| Modal transaction                  | trait screen open to selection to applied acquisition                                                | another player room action cannot legally interleave inside the screen       |
| Rack to later consumer             | rack before fountain with Phial; rack before an immediate-result-sensitive action                    | the later action observes a different equipped keepsake and retained effects |
| First accepted purchase            | Travel Deal refill; Gold Gold Gold's first eligible World-Shop purchase                              | a different first purchase consumes or redirects the one-use effect          |
| Next eligible Well effect          | Extended before a qualifying temporary item; Yarn/Hymn before the next eligible trait offer          | reversal changes which later contact consumes the status                     |
| Exact phase blocker                | Gorgon Athena before another Fields cage                                                             | the game prevents the later cage from starting                               |

An edge can end at a later room. Yarn, Hymn, Ixion, pending Shrine delivery,
keepsake reward pressure, and similar retained effects do not require the
executor to watch every intervening callback. Their next modeled consumer is
already a later semantic action, room-content realization, or door-generation
checkpoint.

## Proven commutative regions

Commutativity is intentionally conservative. The current evidence supports
these bounded cases:

- Opening and closing an optional rack, Well, Pool, or other screen without a
  committed selection is chronology-neutral.
- Distinct Pool sales commute with one another when no other modeled action is
  placed between them. Their Gold amounts are neutral and each sale removes a
  different exact trait.
- Two Well purchases whose effects are simulation-neutral commute after the
  first-purchase and Extended rules have been excluded.
- Optional generated pickups with no planner-visible acquisition effect and no
  later modeled consumer may be left unobserved or performed in another legal
  position as guidance-only contacts.

The following are not proven commutative merely because the final inventory
looks similar:

- two trait acquisitions, because the first can change the second offer,
  rarity, replacement, level target, god pool, or banned-trait state;
- a source transformation and any reward-bag-consuming transformation;
- a purchase participating in Travel Deal, Gold Gold Gold, Extended, Yarn,
  Hymn, or another first/next-use rule;
- an optional pickup moved across outgoing generation when it affects reward
  history, Echo last reward, elements, traits, or another outgoing input; and
- rack, fountain, or automatic rarity/keepsake effects whose prefix changes
  the next target domain.

This means commutativity is a positive, source-backed disposition. The runtime
must not infer it from equal reward names, equal prices, or a coincidentally
equal final trait count.

## Identity and ambiguity assessment

The current action families do not expose an inherent identity blocker:

| Potential ambiguity                                 | Available discriminator                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| two same-name room pickups                          | distinct native object plus semantic source/site owner                         |
| incoming and NPC Boons in one room                  | reward object versus exact encounter-phase owner                               |
| several Fields cage rewards                         | cage phase plus local reward slot                                              |
| several generated pickups                           | acquisition site plus entry owner, bound when materialized                     |
| repeated Well identities                            | exact occurrence and generation key                                            |
| multiple Shop offers with the same reward type      | exact generated offer/slot object                                              |
| several delayed Shrine deliveries maturing together | distinct retained delivery entry and resulting pickup object                   |
| repeated encounter callbacks                        | active occurrence and exact phase; duplicates have no new semantic transaction |

Matching only `gameName`, reward type, trait key, callback name, or “next trace
kind” discards these discriminators and manufactures ambiguity that the planner
does not have.

If a future game contact cannot carry or recover its semantic owner, the safe
fallback is not fuzzy matching. That action family remains guidance-only until
a source-backed discriminator exists, unless every possible match is proven
equivalent.

## Preferred representation: planner-owned prerequisite edges

The partial order is materially different from both a global cursor and an
unordered action set. Each consequential transaction retains its exact owner,
and the planner publishes only the prerequisite edges whose reversal changes a
modeled result. Runtime completion asks whether that owner's declared
prerequisites are complete; it does not advance a family cursor or rediscover
why the dependency exists.

For example, if `X` must precede `Y` while `Z` is independent, the complete
ordering product is the single edge `X -> Y`. The legal executions are
`X, Y, Z`, `X, Z, Y`, and `Z, X, Y`. Adding `X -> Z` or `Z -> Y` merely because
those actions were adjacent in the authored Timeline would make guidance order
blocking without a game or simulation reason.

An ordered owner-bearing stream is only a compressed way to spell a chain of
prerequisite edges. Publishing both stream membership and explicit
dependencies creates two representations of the same authority and invites
them to disagree. The runtime contract therefore needs one ordering primitive:
the sparse prerequisite edge.

### Planner-owned edge families

| Modeled relation                  | Required prerequisite product                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trait-history mutation            | exact prior mutation owner to each later offer or target owner whose authored result used that prefix                                                |
| Provider resolution               | exact acquisition owner contains its provider and resulting offer; no anonymous provider ordinal                                                     |
| Reward transformation             | exact source owner to each separately owned generated child                                                                                          |
| First accepted purchase           | planner-selected source purchase to its one-use realization and to every competing qualifying purchase that could otherwise consume the effect first |
| Next eligible retained effect     | exact producer owner to the exact next consumer already resolved by planner simulation                                                               |
| Generated-pickup production       | exact producer owner to child acquisition owner; unrelated actions remain unconstrained                                                              |
| Rack or removal to later consumer | exact state-mutation owner to the later fountain, offer, or target whose result used that state                                                      |
| Automatic outcome                 | exact lifecycle-owned mutation node with prerequisites only when another modeled owner produced its condition or input                               |
| Guidance-only contact             | no node unless it is needed as the prerequisite, competitor barrier, or consumer of a consequential relation                                         |

Lifecycle windows and checkpoint obligations remain separate products. A
window states when an owner may occur; an obligation states the deadline by
which it must complete; a prerequisite states which exact owner must already
be complete. None can be reconstructed safely from either of the other two.

### Travel Deal as the pressure-point witness

Travel Deal demonstrates why edge choice belongs to the planner rather than an
execution assembler or game adapter. Complete-valid simulation already knows
which accepted qualifying purchase is first and which refill it creates.
Therefore:

- the chosen source purchase remains an execution node even when its purchased
  item's direct effect is otherwise simulation-neutral;
- that source precedes the refill realization;
- that source precedes every competing qualifying purchase that could have
  consumed Travel Deal first;
- purchasing the refill, when authored, follows the refill realization; and
- an unrelated action has no edge to any of those nodes.

The refill realization is an owner-bearing automatic/deferred fact, not a
player purchase and not anonymous Overview inventory. The native adapter may
know how to materialize the declared refill payload. It must not choose the
source purchase, derive the exclusion pool, or decide which later purchase is
the consumer.

The same boundary applies to Extended, Yarn, Hymn, generated acquisitions,
trait-history prefixes, and keepsake-sensitive consumers: simulation or another
planner-owned product identifies the exact relation, and the execution
projection may copy, prune, and reference-check it. Execution assembly must not
search forward for a "next" consumer, choose a first purchase, or infer that
actions commute from their categories.

### Coverage of the current hard edges

The existing hard-edge matrix does not require a permutation table or runtime
graph algorithm. Every current relation fits one of three durable primitives:

| Existing hard edge                 | Runtime representation                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Lifecycle window                   | fixed lifecycle window                                                                  |
| Barrier to produced interaction    | prerequisite edge from barrier owner to interaction owner                               |
| Source to child                    | prerequisite edge from producer owner to child owner                                    |
| Required action to checkpoint      | owner-bearing checkpoint obligation                                                     |
| Optional action to outgoing        | outgoing checkpoint obligation only when that action contributed to the authored prefix |
| Modeled mutation to later consumer | prerequisite edge from mutation owner to exact consumer owner                           |
| Modal transaction                  | one atomic semantic transaction; native subcontacts are not separate nodes              |
| First accepted purchase            | source-to-realization and source-to-competing-purchase prerequisite edges               |
| Next eligible Well effect          | retained-effect producer to its exact planner-resolved consumer                         |
| Exact phase blocker                | lifecycle obligation plus prerequisite edge where another semantic owner is involved    |

Runtime bookkeeping is only a completed-owner set and the declared prerequisite
sets. No topological sort, scheduler, search, family rule, or stream cursor is
required.

### Concrete safety assessment

| Proposed sparse relation                            | Disposition                               | Reason                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| “Zeus trait pickup before later Demeter offer”      | exact prerequisite edge                   | the first acquisition formed the later offer's prefix; unrelated purchases may interleave                                     |
| “Mystery provider Demeter, then its selected trait” | one exact owner or exact owned child      | current authoring stores provider, offer, and acquisition beneath an exact source; ordinal reassignment would change the plan |
| “Artificer source before generated Onion”           | exact producer-to-child edge              | requiredness, duplication eligibility, acquisition role, and child address all derive from the exact source                   |
| “first accepted purchase consumes Travel Deal”      | source, realization, and competitor edges | only the planner knows the already-simulated first accepted purchase; unrelated object interactions remain free               |
| “Yarn or Hymn before next eligible offer”           | exact producer-to-consumer edge           | the retained status waits across unrelated contacts and binds to the exact consumer already reached by simulation             |
| simulation-neutral Well purchases in any order      | no edge                                   | after first/next-use and Extended participation are excluded, their order has no current planner-visible consequence          |

Mystery Boon and Artificer also expose the ownership boundary. Their outcomes
may look fungible as short lists, but the current planner authors provider,
disposition, trait screen, and generated child beneath exact semantic owners.
Reallocating those outcomes at runtime would make the compiler or game adapter
a second planner. If less deterministic authoring is desirable later, the
authored model itself must expose an exchangeable group and the engine must
validate it before publication.

### Dependency-direction disposition

**Go** for a planner-owned sparse dependency DAG as the sole expression of
Timeline ordering. It preserves the planner's exact run while allowing every
action without a path between it and another action to interleave freely.

**Conditional go** for unowned outcome allocation only when complete-valid
planner evaluation explicitly proves a bounded group exchangeable. The proof
must cover source capabilities, requiredness, generated children, offer
prefixes, retained effects, and every later modeled consumer.

**No-go** for the execution assembler, compiler, or game module deriving
ordering, next-consumer identity, first-purchase identity, or exchangeability
from action kind, reward identity, authored adjacency, matching payloads, or
equal final Run State. That would move semantic authority out of the planner
engine and recreate the ambiguity this audit is intended to remove.

## Completion and mismatch policy

A semantic action should freeze further realization only for a bounded reason:

- the player committed a different non-equivalent selection;
- a required action was still outstanding at its checkpoint;
- the game could not realize an exact planner-owned offer, item, encounter, or
  mutation;
- a hard dependency was violated; or
- the completed transaction produced a different planner-visible result.

The following do not independently justify a freeze:

- a duplicate or incidental native callback;
- a different callback spelling or representation-only order;
- a commutative action occurring in a different position;
- an untouched optional action;
- a simulation-neutral amount, price, damage, health, Magick, or meta-resource
  result; or
- a complete Run State snapshot differing outside the action's bounded proof.

Run State remains valuable diagnostic evidence. It can be sampled at room and
door checkpoints to adjudicate planner under-modeling, but it is too broad to
serve as an independent Timeline cursor or universal blocking predicate.

## Authority consequence

The planner's complete-valid evaluation must own whether a semantic action is
required, consequential, commutative under a declared rule, or guidance-only.
The execution compiler may copy those resolved facts but must not infer them
from reward names, action-key syntax, or feature categories.

The game adapter owns the other half of the boundary: which native object,
phase, slot, or screen binds to that semantic owner, and which native state
change proves the transaction complete. It does not decide whether a different
order is planner-equivalent.

This preserves the existing rule that the compiler is a lossless translator
and the game module is a thin realizer/observer, while avoiding a second
simulator in either layer.

## Assessment of protocol v9

Protocol v9 preserves most necessary semantic payload, but its linear trace
combines four different things:

1. lifecycle scheduling markers;
2. player actions;
3. multi-contact realization detail; and
4. broad Run State verification.

That shape makes a valid semantic action fail when an incidental callback does
not advance the cursor, when one native transaction is represented by more
than one row, or when two commutative actions occur in another legal order.
Conversely, removing the cursor without retaining owners and hard edges would
make source/child and first-use behavior unsafe.

The current live integration difficulty is therefore evidence against the
linear trace contract, not evidence that the planner's Timeline is inherently
irreconcilable.

## Go/no-go disposition

### Go: owner-bound partial-order reconciliation

The current action catalog is suitable for a runtime execution contract when:

- Room Overview and Doors remain deterministic realization/checkpoint
  products;
- every Timeline transaction retains its semantic owner;
- native objects, slots, phases, or screens are bound to that owner rather than
  matched by display identity;
- lifecycle windows, explicit dependencies, checkpoint obligations, and the
  sparse hard-edge families above are authoritative; and
- unproven or simulation-neutral contacts remain diagnostic or guidance-only.

This contract scales by adding one audited action family and its bounded
contacts. It does not scale by adding another global permutation or callback
sequence.

The planner-owned sparse dependency DAG is the preferred form of this
contract. It retains only meaningful owner-to-owner order while lifecycle
windows and checkpoint obligations preserve their distinct timing roles.

### Conditional go: engine-certified exchangeable outcome groups

An unowned outcome group is permissible only when complete-valid planner
evaluation has declared that bounded group exchangeable. No current Artificer
or Mystery Boon authoring should be presumed exchangeable merely because the
resulting list looks interchangeable.

### No-go: anonymous action-set reconciliation

Treating the room Timeline as an unordered set of `{kind, item}` observations
is not valid. Same-name objects, generated children, staged trait screens,
Travel Deal, Extended, Yarn/Hymn, Artificer, required-object checkpoints, and
Shrine delivery all need ownership or ordering context.

### No-go: exact callback replay

Treating the authored total order as a cursor over native callbacks is also not
valid. The game may use duplicate callbacks, nested callbacks, asynchronous
effect presentation, or several callbacks for one semantic transaction. Those
are adapter details, not planner actions.

## Bounded uncertainties

- Live F/G probes establish that owner-poor cursor matching is fragile, but H,
  N, O, P, Q, I, and Dream Dives still need their own native contact probes
  before their action adapters can be considered release-proven.
- The source model establishes stable phase, slot, site, and object identity
  for the current action union. A future action family without such identity
  must be audited before it enters blocking conformance.
- Store rerolls, unmodeled economy/health/combat effects, and unsupported NPC
  results remain outside the current planner contract and cannot be promoted
  to blocking Timeline checks merely because a native callback is observable.

These uncertainties limit runtime coverage; they do not require permutation
enumeration for the supported action catalog.
