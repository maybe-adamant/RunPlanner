# Game Execution Timeline Reconciliation Audit

## Status and purpose

Audit completed on 2026-09-01 against the current closed Room Action model,
the protocol-v9 execution boundary, the installed Hades II source evidence
already preserved by the focused audits below, and the live F/G integration
findings recorded during executor probing.

The implementation disposition was refined after the first protocol-v10
engine slice exposed two different kinds of chronology that must not share one
representation. Hard ordering between actions in one occurrence belongs to one
planner-owned prerequisite DAG. State that survives a room boundary belongs to
the planner's existing pending and persistent ledgers and is checked at room
closure; it is not a cross-occurrence action dependency.

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
second runtime primitive. Both owners belong to the same room occurrence.

**Carry-state conformance**
: A bounded room-closure assertion for modeled pending or clocked state that
the current occurrence created, advanced, consumed, reset, or materialized. It
states the resulting value the room leaves behind, not which earlier action
owner a future action must remember.

## Feasibility criteria

Timeline reconciliation is viable only when all of the following hold:

1. Every participating action can be associated with one semantic owner before
   or at its first player-significant native contact.
2. A semantic transaction has one completion proof even when native execution
   uses several callbacks or an asynchronous presentation thread.
3. Every hard ordering relation inside one occurrence is expressible as a
   lifecycle window, a source dependency, or a fixed checkpoint obligation;
   every modeled effect that survives the occurrence has an engine-owned
   carry-state transition.
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

| Planner fact                         | Current status                                          | Reconciliation consequence                                                                         |
| ------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Occurrence identity                  | complete                                                | scopes every action to one entered physical room                                                   |
| Semantic action owner                | complete                                                | prevents same-name rewards from becoming one anonymous action                                      |
| Authored participation               | complete                                                | active required or optional actions publish intent; untouched optional actions remain planner-only |
| Lifecycle window                     | complete                                                | prevents actions from crossing combat, wheel, outgoing, or delivery boundaries                     |
| Explicit source dependency           | complete for generated children and structural barriers | proves source-before-child without scanning prior callbacks                                        |
| Authored total order                 | complete                                                | remains the planner's simulation chronology and user guidance                                      |
| Fixed outgoing checkpoint            | complete in simulation                                  | distinguishes optional effects that did or did not influence the generated batch                   |
| Cross-room pending and clocked state | complete in simulation for supported effects            | permits bounded room-exit conformance without retaining prior action completion                    |
| Runtime blocking disposition         | not complete in the engine execution product            | must not be guessed from callback names or reward categories                                       |
| Semantic transaction boundary        | not represented by the linear trace                     | protocol v9 may split one action into several cursor obligations                                   |

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

| Authored family            | Stable identity and native proof                                                                                   | Ordering disposition                                                                                                                                                               | Runtime consequence                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `interactIncomingReward`   | source occurrence, producer point, and acquisition role; the realized reward object can retain that owner          | normal pickup or Artificer is one published source transaction; Time Piece consumes the acquisition at planner publication; trait/Pom subcontacts complete a published transaction | exact for the published disposition and payload; every published source has one checkpoint obligation |
| `interactLocalReward`      | occurrence, local group, slot, and where applicable phase                                                          | follows its cage barrier when attached; authored Fields pickups may occur in any legal gap but are not anonymous                                                                   | same contract as an incoming source; untouched optional pickups are omitted before execution          |
| `interactWheelReward`      | occurrence, wheel, selected offer, and spawned reward object                                                       | hard after matching combat and before the next phase's required-object barrier                                                                                                     | exact for modeled disposition and payload                                                             |
| `interactAcquisitionEntry` | acquisition site plus entry key; the materialized object is distinct even when its game name equals another pickup | follows its producer when generated; Shrine delivery also follows its exact maturity checkpoint; required entries block their owning checkpoint                                    | exact for modeled pickups; untouched optional entries need no fabricated acquisition                  |

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

| Authored family            | Stable identity and native proof                                                                     | Ordering disposition                                                                                                                    | Runtime consequence                                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interactShopOffer`        | exact generated offer/slot and its native store object                                               | accepted purchase plus immediate item application is one transaction; a separately spawned Echo/Contract child remains another action   | exact when the purchase changes modeled state or produces a modeled child; otherwise guidance-only; unpurchased inventory is Overview content, not a missing action |
| `purchaseStygianWellOffer` | exact generation key and generated native option                                                     | purchase and immediate Well effect are atomic; first-purchase, next-use, and Extended-consumption rules add sparse edges                | exact for consequential items and authored random Twist result; simulation-neutral economic/combat detail is diagnostic                                             |
| `sellPurgingPoolTrait`     | exact Pool slot and trait identity; trait removal proves completion                                  | separate sales of distinct traits commute when no other sensitive action is interleaved; each sale must still remove its authored trait | exact trait-removal transaction; Gold amount is neutral                                                                                                             |
| `interactKeepsakeRack`     | the room has one rack and one selected replacement; its successful native `EquipKeepsake` commits it | only Phial-sensitive swaps are ordered with the fountain; later actions may observe other immediate equip results                       | exact replacement transaction; opening/closing without a change is not an authored action                                                                           |
| `useFountain`              | the room has one declared fountain; disabling/removing the required object proves use                | order is sensitive to Phial-changing rack actions and trait mutations; its rarity callback is part of this transaction                  | exact required transaction; healing amount remains neutral                                                                                                          |

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

| Edge family                        | Source-backed examples                                                                                       | Why reversal is unsafe                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Lifecycle window                   | wheel choice before combat; Well purchase after outgoing; delivery after exact encounter end                 | the object or action does not yet exist outside the window               |
| Barrier to produced interaction    | Fields cage before its reward; combat before NPC interaction                                                 | the interaction is unusable or absent before the barrier                 |
| Source to child                    | Artificer replacement, Sea Star second pickup, Echo duplicate, Quick Buck/Buried Treasure drop               | the child has no native identity before the source creates or retains it |
| Required action to checkpoint      | required reward before outgoing/next O phase/exit                                                            | the game itself blocks the checkpoint while the object remains required  |
| Optional action to outgoing        | an optional acquisition authored before outgoing whose state affects door generation                         | moving it after outgoing changes the batch's input history               |
| Modeled mutation to local consumer | trait acquisition before a later same-room offer; a removal or level change before a same-room target domain | the later authored payload was evaluated from the post-mutation prefix   |
| Modal transaction                  | trait screen open to selection to applied acquisition                                                        | another player room action cannot legally interleave inside the screen   |
| Rack and Phial-sensitive fountain  | rack and fountain in either order when the rack changes pending Phial state                                  | the later action observes a different Phial state                        |
| First accepted purchase            | Travel Deal refill; Gold Gold Gold's first eligible World-Shop purchase                                      | a different first purchase consumes or redirects the one-use effect      |
| Exact phase blocker                | Gorgon Athena before another Fields cage                                                                     | the game prevents the later cage from starting                           |

Every edge in this matrix is occurrence-local. If the producer and consumer
are in different occurrences, the producer's room closes over the resulting
state and the later room observes or consumes that state through its own local
transaction. The room session therefore never needs an earlier room's
completed-owner set.

## Cross-room state inventory

The engine already distinguishes state that may survive a room boundary from
room-local work. `RewardBranchState` carries the closed simulation frontier;
its Shrine and Well subledgers own feature state, while `TraitHistoryState`,
`KeepsakeState`, `ArcanaFearState`, `HexProgressState`, and reward priorities
own their respective retained facts. `pendingShops` and Sea Star's exact-source
eligibility are instead room-local evaluation state. This is the durable
execution classification; expanding to a new biome must reuse it rather than
creating cross-occurrence action edges.

The publication gap is narrower than the state inventory:

| Retained family                                                                                                    | Current first-class engine publication           | Disposition                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| keepsake effects, including Embryo, Hammer, Fig Leaf, Phial, Figurine, Stone, Gorgon, Calling Card, and Time Piece | `RunStateSnapshot.keepsakes`                     | reuse directly as canonical state; do not create effect-specific execution ledgers |
| Echo Gold Gold Gold, Steady Growth, and active/matured Chaos                                                       | `RunStateSnapshot.traits`                        | reuse the existing normalized status, progress, and clock values                   |
| Path of Stars and installed Hex state                                                                              | `RunStateSnapshot.hexProgress` and `hexObserver` | reuse the existing point, capacity, and closure state                              |
| Vow of Forfeit, Artificer, Arcana/Fear, and reward priorities                                                      | existing explicit Run State fields               | reuse the existing normalized state                                                |
| Hermes Shrine deliveries                                                                                           | public simulation branches only                  | promote the agreed retained-delivery state into canonical Run State                |
| consequential Stygian Well effects                                                                                 | public simulation branches only                  | promote the agreed use counts and duration counters into canonical Run State       |

This promotion does not make full Run State blocking. It makes Run State the
single canonical state product from which the engine derives the smaller
room-exit conformance set. The conformance set owns execution disposition; Run
State continues to own state meaning and its full diagnostic projection.

### Pending and clocked state

| State family                         | Engine-owned value                                                                     | Creation or mutation contact                                        | Consumption or advancement contact                                                                                      | Room-session disposition                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Spark of Ixion                       | stacked pending uses                                                                   | consequential Well purchase                                         | the first later entered room whose realized Chaos gate consumes one use                                                 | publish the remaining use count at room exit; the gate is checked as later Room Overview content                                |
| Yarn of Ariadne                      | stacked pending uses                                                                   | consequential Well purchase                                         | the next eligible God offer consumes one use when its choice screen closes                                              | publish the remaining use count; the later offer is a local transaction with no source-owner edge                               |
| Sacrificial Hymn                     | stacked pending uses                                                                   | consequential Well purchase                                         | the next eligible replacement-capable trait screen consumes one use when it closes                                      | publish the remaining use count; the later offer proves its own local result                                                    |
| Extended Well effect                 | stacked pending uses                                                                   | consequential Well purchase                                         | the next qualifying direct Well purchase consumes one use and changes that item's duration                              | publish the remaining use count; a future Well purchase is locally checked                                                      |
| Discount and Empty Slot Well effects | independent encounter- or boss-use counters                                            | consequential direct or Twist Well result                           | qualifying encounter-end or boss completion advances each counter                                                       | publish the active counters because they change later Well inventory eligibility                                                |
| Hermes Shrine deliveries             | exact independent delivery entries with payload, remaining uses, and optional due host | Shrine purchase or rushed refill purchase                           | qualifying encounter-end effects decrement uses; rush or final-Preboss completion makes an entry due; pickup removes it | publish the retained delivery entries at room exit; only the materialized pickup is a later Timeline owner                      |
| Active Chaos curses                  | exact selected pair, clock kind, and remaining count                                   | selected Chaos pair acquisition                                     | the declaration-owned encounter, location, or God-screen clock matures the blessing                                     | publish active curse state after a room that advances or acquires it; maturation is a local automatic transaction               |
| Steady Growth                        | progress stored on the exact equipped trait                                            | trait acquisition and qualifying encounter-end effects              | the rarity-dependent threshold resets progress and upgrades one local authored target                                   | publish changed progress; the threshold mutation belongs to the room whose end effects reached it                               |
| Experimental Hammer                  | independent temporary traits with remaining encounter uses                             | keepsake equip or replay                                            | qualifying encounter-end effects decrement and eventually remove the exact temporary trait                              | publish changed uses and active identity, without linking the expiry room to the equip owner                                    |
| Transcendent Embryo                  | current direct Chaos blessing identity plus eight-use progress                         | keepsake equip or replay                                            | qualifying encounter-end effects advance the counter and replace the exact blessing at threshold                        | publish blessing identity and progress; replacement is a local automatic transaction                                            |
| Fig Leaf                             | remaining uses plus one-success-per-biome latch                                        | keepsake equip or replay                                            | one eligible encounter skip consumes a use and sets the biome latch; biome transition resets the latch                  | publish the resulting retained state after the local encounter or biome transition                                              |
| Calling Card and Time Piece          | independent remaining-charge ledgers                                                   | keepsake equip, rank mutation, or replay                            | exact eligible offer/acquisition contacts consume charges                                                               | publish changed charges; Calling Card retains its local offer transaction, while Time Piece is omitted at execution publication |
| Gorgon Amulet                        | pending, consumed, or expired status with rarity while pending                         | keepsake equip or rank mutation                                     | one eligible non-skipped encounter consumes it; Athena history or replacement can expire it                             | publish status changes; the eventual Gorgon encounter is locally realized                                                       |
| Aromatic Phial                       | pending or consumed status                                                             | keepsake equip                                                      | the next declared fountain consumes the use and, when possible, applies its exact rarity target                         | publish changed state; same-room rack/fountain edges exist only for Phial-sensitive swaps                                       |
| Crystal Figurine                     | pending or consumed status, source, and rarity                                         | keepsake equip or replay                                            | the next boss completion consumes it and applies the authored Arcana result                                             | publish status changes; the boss-side automatic result is local                                                                 |
| Concave Stone                        | pending or consumed status, source, and rank                                           | keepsake equip or replay                                            | the next qualifying accepted God trait screen consumes or retains the use according to its authored proc                | publish status changes; its second frozen screen remains inside the local acquisition transaction                               |
| Olympian keepsake pressure           | ordered generic reward priorities plus provider-force and rarification uses            | keepsake equip, rank mutation, Moon Beam, or replay                 | counted reward generation, matching loot materialization, and matching offer generation consume the independent parts   | publish the remaining queues/uses after the room; Doors and later trait offers prove their own outputs                          |
| Echo Gold Gold Gold                  | the equipped one-use Echo trait is itself pending state                                | Echo acquisition                                                    | the first later eligible non-Spell World-Shop purchase consumes it and creates a separate same-room free object         | publish pending/consumed status; source purchase to generated duplicate remains a local edge in the consuming Shop              |
| Vow of Forfeit                       | current-biome available/consumed latch                                                 | biome entry/reset and the first qualifying boon-to-Onion conversion | qualifying boon acquisition or Artificer conversion consumes the biome use                                              | publish the latch only when the room changes it; reset remains a biome lifecycle transition                                     |
| Banked Path of Stars points          | nonnegative bank plus installed-tree state                                             | Spell/Talent acquisition and keepsake effects                       | the next writable Path screen invests up to capacity and may close future Talent Drops                                  | publish changed bank/closure state; the later screen is a local acquisition transaction                                         |

These values already exist in `RewardBranchState`, `TraitHistoryState`,
`KeepsakeState`, `ArcanaFearState`, or `HexProgressState`. The execution product
does not need action-owner provenance inside these ledgers. An exact identity is
retained only when it is part of the game state itself—for example independent
Shrine deliveries, an active Chaos pair, or a temporary Hammer trait.

### Room-local state that must not escape as a dependency

| Room-local state                                                                              | Closure rule                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pending Shop generation and settlement, including Travel Deal refill and Gold materialization | settle every authored purchase/refill transaction in that Shop or report the room-local obligation; never carry its action owners into another occurrence                   |
| generated acquisition sites and entries                                                       | required entries settle before their checkpoint; untouched optional entries may be abandoned at room exit; either way no unresolved owner becomes a later-room prerequisite |
| Sea Star duplicate eligibility retained for an exact source                                   | consume it through the separately authored local duplicate or discard it when the optional local opportunity closes                                                         |
| local object inventory for Wells, Pools, Shrines, Shops, resources, and racks                 | Overview proves presence/inventory; an unopened or unselected optional object creates no Timeline completion debt                                                           |
| modal trait, Pom, Hex, Chaos, NPC, or replacement screen state                                | complete as one semantic transaction before another player room action can interleave                                                                                       |

Room-local data may be necessary while evaluating one occurrence, but it is not
carry state. Required local work blocks the relevant lifecycle checkpoint;
optional unchosen work simply closes with the room.

### Durable run ledgers are not pending-action conformance

The complete trait inventory and history, god pool, reward bags and use
history, equipped Arcana and spent Artificer capacity, Fated status, selected
keepsake history, invested Hex tree, and route counters also survive rooms.
They are broad persistent ledgers, not unresolved action obligations. Their
local mutations are proved by the transaction that caused them, while Room
Overview and Doors prove the later outputs that depend on them. Complete Run
State remains diagnostic evidence and must not be promoted back into a
universal blocking room-exit comparison.

### Room-exit conformance boundary

A room may publish one first-class carry-state conformance set after its local
checkpoint obligations settle. The engine derives it from the previous closed
canonical Run State and the current `beforeRoomExit` state. It contains only
the pending and clocked families the occurrence created, advanced, consumed,
reset, or materialized, with the resulting post-room values. An unchanged
family is not reasserted at every room. A conformance fact is valid only when
every surviving complete-valid simulation branch agrees on that resulting
value.

The execution document need not duplicate those values. Each conformance fact
names one changed family and selects its expected value from the same
occurrence's canonical `beforeRoomExit` Run State frame. The unselected Run
State sections remain diagnostic; only the explicitly named families become
blocking for that room.

The game adapter compares that bounded set to native retained state at room
exit. A mismatch freezes later realization because the room did not leave the
state assumed by the plan. A match closes the room session and discards its
completed-owner set. The next occurrence starts independently; native game
state and its own local plan determine whether a pending effect advances or is
consumed.

This boundary deliberately carries values rather than provenance:

```text
source-room local transaction
  -> source-room carry-state conformance
  -> room session closes

later-room local transaction or automatic contact
  -> later-room carry-state conformance
```

There is no edge across the blank line. A mismatch whose cause is not a player
deviation remains planner/game-data under-modeling and is referred for
adjudication through the existing diagnostic evidence.

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

### Authored participation is resolved before publication

The authored planner retains both available optional actions and the actions the
player chose to perform. The execution product does not. At the planner-owned
publication boundary, an untouched optional action is omitted, while an active
required or optional action becomes one intended transaction with exactly one
checkpoint obligation. The executor therefore receives no second notion of
optional participation and never decides which published nodes matter.

Dependencies are filtered to those intended published endpoints. Dependency
closure must not retain an unchosen competitor, guidance action, or destroyed
Time Piece acquisition, and an edge cannot manufacture a transaction. This is
especially important for Travel Deal: the chosen source purchase, refill
realization, and any other authored purchase retain their planner-selected
relations; an unpurchased qualifying offer is absent. Execution copies the
closed DAG without inspecting action kinds or reconstructing why an edge
exists.

### Planner-owned edge families

| Modeled relation                       | Required prerequisite product                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-room trait-history mutation       | exact transaction owner containing the prior mutation to each later local offer or target owner whose authored result used that prefix                |
| Provider resolution                    | exact acquisition owner contains its provider and resulting offer; no anonymous provider ordinal                                                      |
| Same-room reward transformation        | exact source owner to each separately owned generated child                                                                                           |
| First accepted same-room purchase      | planner-selected source purchase to its one-use realization and to each other authored qualifying purchase whose order could consume the effect first |
| Generated-pickup production            | exact producer owner to child acquisition owner; unrelated actions remain unconstrained                                                               |
| Rack or removal to same-room consumer  | exact state-mutation owner to the local fountain, offer, or target whose result used that state                                                       |
| Same-room automatic outcome            | exact lifecycle-owned mutation node with prerequisites only when another local modeled owner produced its condition or input                          |
| Untouched optional or guidance contact | omitted before execution publication; it cannot become an edge endpoint                                                                               |

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
- that source precedes every other authored qualifying purchase that could
  have consumed Travel Deal first;
- purchasing the refill, when authored, follows the refill realization; and
- an unrelated action has no edge to any of those nodes.

The refill realization is an owner-bearing automatic/deferred fact, not a
player purchase and not anonymous Overview inventory. The native adapter may
know how to materialize the declared refill payload. It must not choose the
source purchase, derive the exclusion pool, or decide which later purchase is
the consumer.

This exact-edge boundary applies to generated acquisitions, same-room
trait-history prefixes, and same-room keepsake-sensitive consumers. Extended,
Yarn, and Hymn use the carry-state boundary instead: execution assembly must
not search forward for their next consumer or manufacture a producer-to-future-
room edge. It must likewise not choose a first purchase or infer that actions
commute from their categories.

### Coverage of the current hard edges

The existing hard-edge matrix does not require a permutation table or runtime
graph algorithm. Every current relation fits one of three durable primitives:

| Existing hard edge                 | Runtime representation                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Lifecycle window                   | fixed lifecycle window                                                               |
| Barrier to produced interaction    | prerequisite edge from barrier owner to interaction owner                            |
| Source to child                    | prerequisite edge from producer owner to child owner                                 |
| Required action to checkpoint      | owner-bearing checkpoint obligation                                                  |
| Authored optional action           | published transaction with one obligation at its declared checkpoint                 |
| Untouched optional action          | omitted before execution publication                                                 |
| Modeled mutation to local consumer | prerequisite edge from mutation owner to exact same-occurrence consumer owner        |
| Modal transaction                  | one atomic semantic transaction; native subcontacts are not separate nodes           |
| First accepted purchase            | source-to-realization and source-to-competing-purchase prerequisite edges            |
| Exact phase blocker                | lifecycle obligation plus prerequisite edge where another semantic owner is involved |

Runtime bookkeeping inside one room is only a completed-owner set and the
declared prerequisite sets. No topological sort, scheduler, search, family
rule, or stream cursor is required. The set is discarded when room-exit
conformance succeeds.

Assembly and decode must reject every cross-occurrence prerequisite, including
an otherwise chronologically valid edge between selected rooms. Selected-route
reachability does not turn a retained game status into an action dependency,
and retaining completed owners for earlier rooms would reintroduce a global
cursor indirectly.

### Concrete safety assessment

| Proposed sparse relation                             | Disposition                                        | Reason                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| “Zeus pickup before a later same-room Demeter offer” | exact prerequisite edge                            | the first acquisition formed the later local offer's prefix; unrelated local purchases may interleave                                     |
| “Zeus pickup before a Demeter offer in a later room” | no edge; carry-state conformance                   | the source room closes over trait state and the later room locally proves its offer                                                       |
| “Mystery provider Demeter, then its selected trait”  | one exact owner or exact owned child               | current authoring stores provider, offer, and acquisition beneath an exact source; ordinal reassignment would change the plan             |
| “Artificer source before generated Onion”            | exact producer-to-child edge                       | requiredness, duplication eligibility, acquisition role, and child address all derive from the exact local source                         |
| “first accepted purchase consumes Travel Deal”       | source, realization, and authored-competitor edges | only the planner knows the already-simulated first accepted purchase; unpurchased offers and unrelated interactions remain absent or free |
| “Yarn or Hymn remains for the next eligible offer”   | no edge; carry-state conformance                   | the retained status is native game state; its later consumer proves a new local transaction                                               |
| simulation-neutral Well purchases in any order       | no edge                                            | after same-room first-purchase participation is excluded, their order has no current planner-visible consequence                          |

Mystery Boon and Artificer also expose the ownership boundary. Their outcomes
may look fungible as short lists, but the current planner authors provider,
disposition, trait screen, and generated child beneath exact semantic owners.
Reallocating those outcomes at runtime would make the compiler or game adapter
a second planner. If less deterministic authoring is desirable later, the
authored model itself must expose an exchangeable group and the engine must
validate it before publication.

### Dependency-direction disposition

**Go** for an occurrence-local planner-owned sparse dependency DAG as the sole
expression of Timeline action ordering, paired with bounded room-exit
carry-state conformance. The DAG preserves exact same-room relations while
allowing every local action without a path to interleave freely; carry state
preserves later-room semantics without action provenance.

**Conditional go** for unowned outcome allocation only when complete-valid
planner evaluation explicitly proves a bounded group exchangeable. The proof
must cover source capabilities, requiredness, generated children, offer
prefixes, retained effects, and every modeled consumer inside that occurrence.

**No-go** for the execution assembler, compiler, or game module deriving
ordering, next-consumer identity, first-purchase identity, carry-state values,
or exchangeability from action kind, reward identity, authored adjacency,
matching payloads, or equal final Run State. That would move semantic authority
out of the planner engine and recreate the ambiguity this audit is intended to
remove.

## Completion and mismatch policy

A semantic action should freeze further realization only for a bounded reason:

- the player committed a different non-equivalent selection;
- a required action was still outstanding at its checkpoint;
- the game could not realize an exact planner-owned offer, item, encounter, or
  mutation;
- a hard dependency was violated; or
- the completed transaction produced a different planner-visible result; or
- bounded room-exit carry state differs from the complete-valid engine result.

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
required, consequential, commutative under a declared rule, or guidance-only,
and must own the agreed carry-state value at room exit. The execution compiler
may copy those resolved facts but must not infer them from reward names,
action-key syntax, feature categories, or earlier completed owners.

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
Conversely, removing the cursor without retaining local owners, local hard
edges, and room-exit carry state would make source/child, first-purchase, and
retained-effect behavior unsafe.

The current live integration difficulty is therefore evidence against the
linear trace contract, not evidence that the planner's Timeline is inherently
irreconcilable.

## Go/no-go disposition

### Go: room-local partial-order reconciliation and carry-state closure

The current action catalog is suitable for a runtime execution contract when:

- Room Overview and Doors remain deterministic realization/checkpoint
  products;
- every Timeline transaction retains its semantic owner;
- native objects, slots, phases, or screens are bound to that owner rather than
  matched by display identity;
- lifecycle windows, occurrence-local dependencies, checkpoint obligations,
  and the sparse hard-edge families above are authoritative;
- agreed pending and clocked state is checked at room exit without carrying
  completed action owners into the next occurrence; and
- unproven or simulation-neutral contacts remain diagnostic or guidance-only.

This contract scales by adding one audited action family and its bounded
contacts. It does not scale by adding another global permutation or callback
sequence.

The planner-owned sparse dependency DAG is the preferred form of local action
ordering. It retains only meaningful same-occurrence owner-to-owner order while
lifecycle windows and checkpoint obligations preserve their distinct timing
roles. The separate carry-state snapshot is the preferred form of cross-room
continuity.

### Conditional go: engine-certified exchangeable outcome groups

An unowned outcome group is permissible only when complete-valid planner
evaluation has declared that bounded group exchangeable. No current Artificer
or Mystery Boon authoring should be presumed exchangeable merely because the
resulting list looks interchangeable.

### No-go: anonymous action-set reconciliation

Treating the room Timeline as an unordered set of `{kind, item}` observations
is not valid. Same-name objects, generated children, staged trait screens,
Travel Deal, Artificer, and required-object checkpoints need local ownership or
ordering context. Extended, Yarn/Hymn, and Shrine delivery need explicit carry
state instead of anonymous observations.

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
