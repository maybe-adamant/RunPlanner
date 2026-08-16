# Acquisition Delivery and Room Settlement Audit

## Status and scope

**Complete for the game facts needed to canonicalize currently modeled reward
acquisitions, correct Shop-backed settlement, model Narcissus pickups, and
settle Echo's replayed and duplicated acquisitions.** Schema 38 now delivers
that boundary. Shrine delivery, Well behavior, other composite-room delivery
additions, and other dropped-item families remain explicitly scoped follow-up
work rather than gaps in the current contract.

This is a source-backed audit of the boundary between an action that produces
an item and the later acquisition that changes run history. It was prompted by
Narcissus's dropped benefits, but the same boundary is also visible in World
Shops, Wells of Charon, and Shrines of Hermes.

The audit records game facts, the planner's current representations, and the
smallest shared semantic pressure exposed by those facts. It does **not** own
the authored schema, TypeScript product, lifecycle-operation name, UI, or Well
pool. Current product contracts live in the stable design documents; temporary
delivery sequencing lives in isolated progress plans.

The game evidence was checked on 2026-08-11 against the installed Hades II
scripts. Primary sources are:

- `TraitData_Narcissus.lua`, especially the `NarcissusA..I` acquisition
  functions and `LootOptions`;
- `NPCData.lua` and `EventLogic.lua`, especially
  `NarcissusBenefitChoices` and `NarcissusBenefitChoice`;
- `RoomDataG.lua`, `InteractLogic.lua`, and the `G_Story01` map data,
  especially the noncombat Story lifecycle, NPC-required-object release, and
  absence of a physical `ChallengeSwitchBase`;
- `UpgradeChoiceLogic.lua`, especially `HandleUpgradeChoiceSelection`;
- `RoomLogic.lua`, especially `GiveRandomConsumables`, encounter-use
  expiration, and outgoing-exit generation;
- `StoreLogic.lua`, especially `HandleStorePurchase`;
- `SurfaceShopLogic.lua`, especially `HandleSurfaceShopAction`,
  `CloseSurfaceShopScreen`, and `CompleteSurfaceShopItems`;
- `RoomDataN.lua`, especially `BaseN_SubRooms`, its
  `IgnoreEncounterUses`, and its `SurfaceShopSpawnChance`;
- `TraitData.lua` and `TraitLogic.lua`, especially
  `StorePendingDeliveryItem` and its expiration action;
- `TraitData_Echo.lua`, `EventLogic.lua`, and `StoreLogic.lua`, especially
  Echo's exact last-reward recreation, prior-run trait offer, and one-use World
  Shop duplication paths; and
- `EncounterSets.lua`, especially forced completion of pending Surface Shop
  items.

The Shop- and Well-specific lifecycle and future pool work remains recorded in
`SHOP_AND_WELL_INTERACTION_LIFECYCLE.md`. The exact Narcissus choice matrix and
supported outcome dispositions remain recorded in
`TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`.

## Terms

**Producer action**
: A selected NPC benefit, Shop purchase, Well purchase, reward pickup, or
other source action that causes an effect or creates an item.

**Direct effect**
: A producer action whose supported result changes the player state directly.
Equipping an ordinary Boon or applying a targeted trait mutation are direct
effects; they do not imply a separately spawned pickup.

**Spawned pickup**
: A concrete in-world consumable or loot object created by a producer action.
Creating the object and acquiring it are separate game events.

**Pending delivery**
: A purchased or otherwise authorized item whose concrete acquisition is
deferred until a later lifecycle condition is met.

**Scheduled acquisition**
: The neutral planner term for a reward or pickup whose production has been
authorized by its source but whose acquisition lifecycle has not yet been
applied. While pending, it retains the concrete item payload and delivery
condition needed to materialize that item. Once materialized, the concrete
pickup owns its acquisition detail; it is not permanently nested under the
producer that scheduled it.

**Acquisition settlement checkpoint**
: A declared lifecycle boundary that applies the ordered acquisitions due at
that point. A room may have more than one: an ordinary reward or due delivery
may settle before outgoing generation while a Narcissus drop or Shop purchase
settles after it.

**Room acquisition point**
: One stable, ordered post-encounter or post-interaction point in a Room
Declaration's lifecycle envelope where additional item acquisition may
occur. It may be empty in one authored run. An ordinary room reward remains
part of its existing encounter-owned acquisition path; it does not create a
second authoring surface merely to make this abstraction universal.

**Room settlement product**
: A proposed planner product containing the state after the room's supported
local work has settled, independently of whether a continuation has been
selected. This is a modeling term, not the name of a game function and not
yet a locked engine operation.

**Settlement participation**
: The authored fact that one available concrete item is actually acquired. One
optional concrete item needs at most one acquired/not-acquired fact,
regardless of whether the UI labels that action "Purchased" or "Picked up."
A required or otherwise unavoidable due item participates automatically.
This is distinct from a producer action, such as a Shrine purchase, that
schedules an item before the concrete pickup exists.

**Settlement order**
: One checkpoint-owned, occurrence-contained chronological order containing
every participating item at one acquisition settlement checkpoint, regardless
of which producer created it. It replaces producer-private acquisition
ordering at that checkpoint.

**Settlement site**
: One reached projection of a declared room acquisition point. Its semantic
owner is the exact point inside an occurrence or Hub visit—not the room
occurrence as one flat aggregate and not the item that happens to make the
site visible.

## Verified game facts

### Acquisition is not universally the producer action

The game has several distinct forms:

1. An upgrade choice may directly add a trait to the hero.
2. A selected benefit may run an acquisition function that spawns consumable
   objects.
3. A Shop or Well purchase may immediately add a trait or create a consumable.
4. A Shrine of Hermes purchase may create only pending-delivery state; the
   item is spawned later.

Therefore “selected,” “purchased,” “spawned,” and “acquired” are not synonyms.
The planner may collapse some of them deliberately, but it must state the
collapse rather than derive it from a trait or Shop label.

### Narcissus choices produce drops rather than one nested trait result

`NarcissusBenefitChoice` opens an ordinary three-choice upgrade menu. Selecting
one option passes through `HandleUpgradeChoiceSelection`, which adds the
selected Narcissus descriptor and invokes its acquisition function.

The Narcissus declarations inherit or directly use:

```text
AcquireFunctionName = GiveRandomConsumables
```

`GiveRandomConsumables` iterates the declaration's `LootOptions`, creates one
or more concrete consumable objects, applies each option's overrides, and
places those objects into the current room. The selected benefit is therefore
the producer of the drops; it is not itself the dropped reward.

The currently modeled examples expose the boundary clearly:

| Selected choice | Produced supported pickup    | Pickup-owned consequence                                                  |
| --------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `NarcissusA`    | `StoreRewardRandomStack`     | one random eligible trait gains `+1`                                      |
| `NarcissusC`    | `Currency`                   | source-faithful Gold acquisition/history; quantity remains unmodeled      |
| `NarcissusD`    | `MaxManaDrop`                | concrete acquisition/history                                              |
| `NarcissusE`    | `MaxHealthDrop`              | concrete acquisition/history                                              |
| `NarcissusG`    | two `ElementalBoost` pickups | each creates one all-element contribution                                 |
| `NarcissusH`    | `LastStandDrop`              | concrete acquisition/history under the local Death Defiance approximation |
| `NarcissusI`    | `BlindBoxLoot`               | the box later resolves its hidden source and fresh trait offer            |

The random-Pom target and Mystery Boon source/offer consequently belong to the
produced pickup's acquisition, not intrinsically to the outer Narcissus menu
choice. The source choice still owns whether that pickup is produced.

Every audited Narcissus call sets `NotRequiredPickup = true`. In
`GiveRandomConsumables`, that prevents the spawned object from being added to
the room's required-object barrier under the ordinary run path. The game does
not therefore prove a universal “every Narcissus drop must be collected before
leaving” rule.

`G_Story01` provides no competing room-local acquisition family. Its encounter
inherits `NonCombat`, so `EndEncounterEffects` returns before advancing any
pending Shrine delivery. Although `G_Story01` inherits the biome's Well chance,
its physical map contains no `ChallengeSwitchBase`; the setup path therefore
cannot install a Well of Charon or Shrine of Hermes there.

The Narcissus descriptor is selected during the NPC conversation and creates
its optional drops. When the conversation finishes, `UseNPCPostTextLines`
removes the NPC from `RoomRequiredObjects` and unlocks the exits without waiting
for those `NotRequiredPickup` objects. The outgoing batch can therefore freeze
before the player acquires them. For a stable planner lifecycle, Narcissus
pickups belong to the post-outgoing Purchases and Pickups checkpoint and cannot
retroactively affect that already-generated batch.

The planner does not need to collapse production into acquisition. A supported
optional drop retains one acquired/not-acquired fact; presentation may label
that action “Picked up,” just as an immediate Shop labels the same concrete
participation choice “Purchased.” Only an acquired optional drop enters
settlement. This models the observable run choice without pretending that the
game's exit lock enforces it.

### Immediate Shop and Well purchases occur after current outgoing generation

Structural World Shops materialize inventory on entry. Wells of Charon are
room-local interactions that become usable after the encounter. In both
families, the current room's outgoing doors and previews already exist before
the player performs ordinary purchases.

`HandleStorePurchase` then applies the purchased option. A trait option is
added to the hero; a consumable option creates the concrete consumable from
the purchased data. Under the planner's sufficient-resource baseline, these
are immediate post-generation acquisitions.

The timing invariant is:

```text
generate current outgoing offers from pre-purchase state
  -> execute purchases in player order
  -> continue toward the selected next room with post-purchase state
```

Those acquisitions cannot retroactively change the already-generated current
doors. They can affect later lifecycle work.

The current game interaction does not imply that Shop acquisitions form an
isolated chronological lane. Other pickups already present in the room can be
acquired between Shop interactions. Future delivered items make that visible
to the planner: Shop purchases and room-local pickups may contribute to the
same post-generation history fold.

### A Shrine of Hermes purchase schedules delivery

`HandleSurfaceShopAction` does not grant a normally purchased Shrine item.
Instead it copies `StorePendingDeliveryItem`, sets `RemainingUses` from the
item's `RoomDelay`, and stores a copy of the purchased item in
`OnExpire.SpawnShopItem`.

The generated delay is an integer from `SurfaceShopData.DelayMin = 2` through
`DelayMax = 8`. It is the item's initial encounter-use countdown, not a physical
room address and not necessarily the final number of rooms traversed. Rooms
that ignore encounter uses do not reduce it, while forced completion can
deliver the item before the selected count naturally expires.

`StorePendingDeliveryItem` declares `UsesAsEncounters = true`. The game
decrements such traits when the main room encounter ends, unless the room or
encounter declares an exception. When the remaining-use count expires,
`TraitLogic.lua` spawns the stored Shop item into the current room and marks it
as a required object. Concrete acquisition still occurs from that spawned
item.

This decrement is qualifying encounter-instance behavior, not room-commit
behavior. A multi-encounter room can therefore expire a delivery between its
encounter instances. `EndEncounterEffects` excludes noncombat and explicitly
skipped encounters, applies the use decrement only to the current room
encounter or `MapState.EncounterOverride`, and honors room-owned
`IgnoreEncounterUses`. The game's condition is also not expressed as “counting
encounter depth.” A planner declaration must say which resolved encounter
completions advance pending-delivery uses; it must not infer the answer from
`countsEncounterDepth`, room depth, or one generic room-completed event.

The player may instead purchase rush delivery. The pending state is removed
and `CloseSurfaceShopScreen` spawns the item in the current room. A delivered
item cannot be abandoned: whether it arrives through rush, countdown expiry,
or forced completion, its concrete acquisition is mandatory. The physical
spawn and pickup remain distinct game events, but the planner needs no
picked-up/not-picked-up authoring fact for a delivery. Some encounter sets also
invoke `CompleteSurfaceShopItems`, which expires every pending Shop delivery
immediately and spawns the corresponding items.

A future authored Shrine offer therefore needs at least a purchased fact and a
delivery disposition. The natural player-facing choices are `Rush now` or an
initial delay from `2` through `8`. The engine derives the concrete delivery
site by advancing qualifying encounter uses and applying forced completion; the
authored dropdown must not persist a future room address as a second authority.
Once delivery becomes due, acquisition participates automatically.
Purchase and rush affordability remain collapsed under the planner's existing
sufficient-resource baseline; the delivery choice does not introduce gold
modeling.

The verified shape is therefore:

```text
Shrine purchase
  -> pending item + encounter-use countdown
  -> countdown expiry, rush, or forced completion
  -> item spawned in a concrete room
  -> concrete acquisition
```

The purchase source, pending state, delivery room, and acquisition event are
four distinct facts.

The countdown trigger and encounter-depth counter are also distinct facts.
`EndEncounterEffects` does not require `CountsForRoomEncounterDepth` before it
decrements `UsesAsEncounters`. `PreHubGeneratedN`, for example, declares
`CountsForRoomEncounterDepth = false` and still consumes encounter uses because
its room does not suppress them. Conversely, `GeneratedNSubRoom` also declares
the depth flag false, but Ephyra subrooms inherit `IgnoreEncounterUses = true`
and therefore do **not** consume delivery uses. Encounter depth cannot identify
either result.

This does not require a second general room-phase model. The smallest faithful
shape is to derive room-end and between-encounter acquisition points from the
resolved structural encounter envelope plus explicit post-interaction points.
Whether one of those points advances an existing pending-delivery countdown is
a separate declaration-owned fact. A point that does not advance the countdown
can still host a newly spawned Shrine and an immediate rush delivery. A later
implementation audit must identify which supported encounter slots consume
encounter uses; it must not infer that set from the existence of an acquisition
point or from the depth counter.

### Materialized items are no longer source-owned

The pending Shrine trait stores the copied Shop item only until expiration.
`RemoveTraitData` then calls `SpawnStoreItemInWorld`, which creates the normal
loot or consumable object and registers it as a room-required object. The
spawned object retains item facts such as `PendingShopItem`, but the audited
path does not preserve a durable link to the expired trait or originating
Shrine offer.

Narcissus follows the same boundary more directly: `GiveRandomConsumables`
creates ordinary consumable objects from the selected descriptor's declared
`LootOptions`. Once created, the concrete pickup is handled as that item, not
as an authored child of the Narcissus trait.

The planner should mirror that decoupling. A pending entry needs its payload
and delivery rule until materialization. Materialization then creates a
settlement-point-owned pickup with its own stable identity and acquisition
detail. Moving a future delivery to a different point after an upstream edit
does not rehome old pickup-owned authored detail merely because both pickups
came from the same producer.

### Ordinary reward selection and same-room delivery ordering

The standard encounter event sequence calls `SpawnRoomReward` as part of the
encounter, before `EndEncounterEffects` advances expiring traits. Ordinary
room and reward selection should therefore remain on their existing authoring
path.

The two Shrine paths sit on opposite sides of that ordinary acquisition:

```text
existing pending delivery expires after combat
  -> due delivery and ordinary room reward can both be acquired
  -> outgoing doors generate after the required acquisitions

ordinary room reward is acquired
  -> outgoing doors generate and room-end Shrine unlocks
  -> local Shrine purchase
  -> pending delivery, or a same-room pickup when rushed
```

The game permits a delivery purchased earlier to be acquired before the
ordinary room reward. It does not permit the room-local Shrine itself to be
used before that reward is resolved and the interaction unlocks. Consequently
all acquisitions cannot share one room-flat order. Due deliveries and the room
reward share a pre-outgoing settlement checkpoint; local Shrine purchases and
rush pickups belong to a later post-outgoing checkpoint.

A planner may deliberately collapse the pre-outgoing checkpoint to
reward-first, but that simplification changes trait-sensitive possibilities.
For example, a delivered Pom may or may not see the trait acquired from the
room reward, and an earlier delivered Boon may change the legal trait offer of
the later reward. The accurate model is therefore one checkpoint-owned order
containing the ordinary reward and every other acquisition available in that
interval.

That accuracy does not require moving room or reward selection. It requires
moving acquisition-owned children—trait offers, Pom targets, and comparable
details—from the direct reward control into the reward's canonical settlement
row. A simple room with no competing acquisition can render that row compactly;
the audit does not require an empty second card.

## Timing comparison

| Producer family                 | Source action                   | When an item/effect becomes due               | Acquisition form                          | Can affect current outgoing offers?           |
| ------------------------------- | ------------------------------- | --------------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| ordinary room reward            | reward pickup                   | at its declared producer point                | direct concrete acquisition               | yes, when pickup precedes outgoing generation |
| direct trait choice             | selected option                 | at the choice's declared lifecycle point      | equip or exact targeted mutation          | according to that lifecycle point             |
| Narcissus drop-producing choice | selected descriptor             | spawned during the NPC interaction            | optional post-outgoing pickup acquisition | no; outgoing generation does not wait for it  |
| World Shop purchase             | ordered purchase                | immediately after current outgoing generation | direct Shop acquisition                   | no                                            |
| Well of Charon purchase         | ordered post-encounter purchase | immediately after current outgoing generation | direct Well acquisition                   | no                                            |
| Shrine of Hermes purchase       | ordered purchase                | after encounter-use countdown                 | spawned delivered item, then acquisition  | no at purchase time                           |
| Shrine rush/forced completion   | rush or declared completion     | current room                                  | spawned delivered item, then acquisition  | current exits already exist                   |

The commonality is not that every source executes at the same time. The
commonality is that each source can authorize an acquisition whose delivery
timing is explicit, after which the existing reward and trait authorities can
apply the concrete result.

## Participation and chronological ordering

Availability, participation, and order are three separate facts:

```text
producer makes item available
  -> authored participation says whether it is acquired
  -> lifecycle assigns its settlement checkpoint
  -> one checkpoint-owned order folds all participating items sequentially
```

The producer-specific participation controls remain intentionally small:

- one optional concrete item exposes one acquired/not-acquired choice; an
  immediate Shop may label that choice "Purchased," while a spawned pickup may
  label it "Picked up";
- a required spawned pickup has no redundant checkbox and participates
  automatically; and
- a producer action that only schedules a delivery retains its own purchase
  fact, while the later concrete pickup has its own participation fact only if
  that pickup can be left behind.

Once participation is known, the settlement order is not partitioned by
producer. A purchased Shop item, a picked optional drop, and a due required
delivery at the same checkpoint all enter one room-owned ordered sequence and
update reward and trait history in that sequence. This is necessary because
an earlier acquisition may change the legality or concrete result of a later
one.

The sequence is scoped to one checkpoint, not to the whole room. It cannot
move a pre-outgoing room reward or due delivery behind a post-outgoing Shop
purchase or Narcissus pickup. The room settlement product composes the outputs
of its checkpoint orders in declared lifecycle order.

Under the planner's current sufficient-resource, no-restock baseline, a Shop
keeps its purchased state as the authoring source for immediate offers. Its
occurrence-owned acquisition-site order is the sole chronological authority:
membership records participation and the order folds participating entries.
That first-class settlement product normalizes Shop participation into the
same acquired/not-acquired fact later mixed-source sites can use. No
Shop-private acquisition order or replay remains alongside it.

Future Well or Shop behavior that changes inventory, prices, or other
non-acquisition state may still require a source-action order. That is a
separate producer concern and must not silently restore a second acquisition
order. One settlement entry may expand through its declaration-owned reward
lifecycle into several exact acquisition roles, such as a Blind Box and its
hidden source, without flattening those internal roles into UI-managed policy.

## Settlement-site ownership in composite rooms

Every supported room declaration owns an ordered envelope of one or more room
acquisition points. Materialization resolves the active point instances for
the entered occurrence. A reached point may contain no acquisition entries,
one ordinary pickup, or several mixed-source entries.

The currently supported non-Shrine room sets happen to place their
player-orderable pickups at the last applicable acquisition point in the room.
That is a declaration-level convergence, not an engine invariant. The engine
must not expose a `lastPoint`, `endOfRoom`, or similar fallback that silently
moves an item there. Each producer or delivery transition names the exact
declared point it enters.

One room occurrence may therefore contain several independently reached
settlement sites. The occurrence remains the persistence and navigation
container, but it does not own one flat order across them.

### O multi-encounter rooms

The game installs each active O encounter phase as `currentRoom.Encounter` and
executes the phases in order. The resolved O encounter envelope already
represents that sequence and its wheel acquisitions. Each active combat phase
that reaches normal end-encounter effects consumes a delivery use and can make
a delivery participate at its associated point. A delivery expiring after the
first combat is acquired there before the next encounter can proceed because
`WaitForNextEncounterReady` waits for room-required objects; it cannot be moved
into the later phase or into the room's post-outgoing point.

The exact site's order includes every player-orderable acquisition due at that
point, including its declared wheel or other pickup when those items can be
acquired in the same interval. Inactive authored phases do not consume uses or
publish sites.

### H Fields encounters

An entered Fields combat occurrence contains the active encounter/cage prefix
and its corresponding ordered acquisition-point prefix. Starting a cage sets
its encounter as `MapState.EncounterOverride`, so each completed active combat
cage reaches the game's encounter-use decrement. A delivery may therefore
become due between cages, and its required pickup blocks starting a later cage
until it is acquired.

The existing cage and local-reward addresses supply the required stable
neighborhood. The future delivery rule must preserve active-prefix behavior:
dormant third-cage state under a two-cage outcome cannot advance a countdown,
publish a settlement site, or acquire a delivery.

### N Hub visits and side rooms

The persistent Hub itself completes no qualifying encounter and owns no
delivery settlement site. Hub restores likewise do not replay encounter
completion and cannot decrement pending delivery.

Each entered combat main-room visit executes its combat lifecycle and
acquisition point envelope once. Its qualifying encounter completion can
populate the associated settlement site in that visit's UI. A noncombat Story
visit does not consume a Shrine delivery use. Restoring the same main
occurrence after a side room does not execute or create another point.

Ephyra side-room declarations inherit `IgnoreEncounterUses = true`. Entering
and clearing a side-room combat therefore does not advance an already-pending
Shrine delivery. It does **not** remove the side room's room-end acquisition
point. `BaseN_SubRooms` declares `SurfaceShopSpawnChance = 0.08`, and the
Surface Shop is unlocked with other room-end interactions after combat. The
player can purchase an item there and pay for rush delivery; when the Shop
screen closes, `CloseSurfaceShopScreen` spawns that concrete item in the same
side room.

An entered side room can therefore publish a settlement site for its local
Shrine purchase, mandatory immediate rush acquisition, or other explicitly
declared local pickup even though the same site contributes zero progress to an
older pending delivery. “Can host acquisition” and “advances pending delivery”
are separate capabilities.

This yields the semantic hierarchy:

```text
occurrence or Hub visit
  -> declared ordered acquisition-point envelope
       -> reached acquisition point / settlement site
            -> participating acquisition entries in authored order
```

The pending delivery retains the item payload until it materializes, but the
materialized pickup belongs to the reached settlement site. The game path does
not support treating the later pickup as a permanently nested child of the
originating Shrine offer.

## Authoring projection consequence

The coherent surface is broader than “Purchases and Pickups” once an ordinary
room reward can participate in the same order as a due delivery. A later plan
may call it **Acquisitions**. It remains outside Customize and is projected at
the nearest workbench that owns the exact settlement site:

- an ordinary single-encounter occurrence shows one compact pre-outgoing row
  for its room reward, expanding into an ordered section when another due item
  competes with it;
- a room-local Shrine or Well uses a distinct post-outgoing section even when
  both sections appear in one visual card;
- O and H show a separate ordered section for each qualifying encounter
  instance;
- an N main visit shows the main encounter's card inside the visited-room tab;
- an entered N side room shows its room-end card inside that side-room surface
  when a local Shrine purchase, mandatory rush acquisition, or other extra item
  exists; and
- a structural Shop shows its post-outgoing card below its exits.

Producer surfaces retain availability, room/reward selection, and any source
action that exists before a concrete item does. They do not retain a second
trait or Pom editor for an acquisition that has a canonical settlement row.
Immediate Shop inventory may keep its current purchased checkbox as the UI
label for the concrete item's single participation fact; optional spawned
pickups use the label picked up. A delayed Shrine purchase is different: its
purchase schedules pending state, and the later materialized pickup
participates at its delivery site. The settlement row owns acquisition order,
trait offers, Pom targets, and their acquisition findings.

A Shrine offer therefore needs two visible authoring controls when supported:
`Purchased` and `Delivery`. `Delivery` is dormant while unpurchased and offers
`Rush now` plus the declaration-backed delays `2` through `8`. The numeric
choice records the initial encounter-use countdown; the engine, not React,
resolves the reached delivery site. Every selected delivery disposition implies
mandatory acquisition when it becomes due; no third pickup checkbox is
published.

Offer-generation, producer-selection, and purchase-eligibility findings remain
with the producer. Acquisition and acquired-trait findings route to the exact
settlement row. React receives these destinations from the structured
workspace; it must not scan producer cards to reconstruct settlement sites or
move a row according to rendered position.

## Current planner representations

### Existing strengths

The reward kernel already distinguishes:

- resolved reward offers;
- producer lifecycle profiles and acquisition roles;
- concrete acquisition identity;
- reward-history projection;
- trait offers owned by exact acquisition roles; and
- level resolutions owned by exact acquisition roles.

`processOwnedRewardAcquisition` is already the shared chronological path that
resolves a producer role, applies the concrete acquisition, applies its
trait/level child, and emits the acquisition event. A delivery model should
feed this authority rather than duplicate reward, trait, Pom, or history
semantics.

The structural Shop lifecycle preserves the correct two snapshots:

- pre-purchase history owns current outgoing generation; and
- post-purchase history owns continuation into later rooms.

Its occurrence-owned `roomExit` settlement order is the chronological owner
for current Shop purchases. The same first-class settlement product can later
interleave purchased offers with delivered or spawned pickups without restoring
a Shop-private execution path.

### First-class incomplete Midshop settlement

When a Midshop's next decision is incomplete, canonical simulation stops at
the already-generated outgoing frontier, then reaches the declared `roomExit`
settlement point through the normal prefix lifecycle. Its public frontier
branches therefore retain the concrete purchases and post-settlement history
needed to assess and repair purchased leaves, without rewriting the already
generated outgoing offers. This is the same settlement product used once a
continuation is selected; no Shop-private or discarded replay exists.

### Historical Narcissus prototype: timing and ownership defect

The discarded, stashed Narcissus prototype stored `outcomeResolution` directly
on an `AuthoredTraitOption`. Its closed cases contained either:

- a random level resolution; or
- a `BlindBoxLoot` resolved reward plus its nested trait offer.

`processEncounterTraitOffer` then dispatched `processNarcissusOutcome`, which
constructed synthetic `NarcissusOutcome` reward owners and immediately invoked
reward acquisition processing. That prototype reuse of core reward/trait
history was useful evidence, but it coupled three separate facts into one
trait-option-specific path:

1. the selected Narcissus descriptor;
2. the declaration-owned pickups that descriptor creates; and
3. the authored resolution owned by a produced pickup.

This is why the prototype required a nested reward and nested trait offer
inside the outer trait editor. It also created a Narcissus-specific reward
dispatcher even though the produced `BlindBoxLoot`, Pom, Max Health, Max
Magick, and Last Stand pickups already have reward identities.

The dispatcher executed from the planner's `encounterCompleted` event, which
precedes its outgoing-generation checkpoint. That let an immediately processed
Narcissus outcome influence the current outgoing batch. The verified
`G_Story01` lifecycle does not wait for its optional drops before unlocking
those exits, so Gate D must correct this prototype's timing rather than restore
it. None of `outcomeResolution`, `processNarcissusOutcome`, or
`NarcissusOutcome` is live production behavior.

### Missing delayed-delivery state

The planner currently has no route-state product equivalent to
`StorePendingDeliveryItem`: an authorized concrete item plus a remaining
encounter count and later delivery behavior. Modeling Shrine purchases as
ordinary immediate Shop acquisitions would therefore be incorrect.

## Architectural pressure established by the evidence

The evidence supports one shared boundary:

```text
source-specific action
  -> zero or more ordered direct effects and/or scheduled acquisitions
  -> lifecycle reaches each declaration-owned settlement checkpoint
  -> acquisitions due at that checkpoint are applied through the reward kernel
  -> lifecycle advances retained delivery conditions
  -> post-settlement state continues to later room work
```

This does **not** imply a generic effect interpreter. The catalog still owns
the closed output of each producer, and each authored producer family still
owns its own selection, inventory, purchase, or condition state. The shared
product carries acquisition work; it does not replace producer policy.

The following was the pre-Gate-C implementation direction. Gate C delivered
the Shop-specific part: `roomExit` is an occurrence-owned acquisition site,
its order is first-class, and incomplete Midshop publication reaches that site
through the bounded lifecycle prefix without a private replay. The remaining
Narcissus, delivery, Well, and composite-room work should preserve the same
separation:

- a Narcissus declaration says which pickups a selected descriptor produces;
- pickup-owned details such as a random Pom target or Mystery Boon offer live
  with the materialized pickup, not the descriptor;
- declaration-owned settlement checkpoints preserve that ordinary room rewards
  and due deliveries occur before outgoing generation while Narcissus pickups
  and room-end purchases occur after it;
- an ordinary room reward participates in its pre-outgoing checkpoint order
  without moving room or reward selection out of the decision workbench;
- room declarations derive their post-encounter acquisition points from their
  resolved structural encounter envelopes and declare any additional
  post-interaction points explicitly;
- each optional concrete item has one participation fact while one
  checkpoint-owned settlement order determines cross-producer acquisition
  chronology;
- composite rooms and Hub visits publish one settlement site per exact reached
  checkpoint rather than one order per room occurrence;
- the room settlement product publishes post-generation purchases without
  requiring a selected continuation;
- a Shrine purchase creates retained pending-delivery state rather than a due
  current-room acquisition; and
- encounter completion advances pending-delivery counters and turns expired
  deliveries into due pickups at the declared room.

The product must be ordered. The current Shop `roomExit` acquisition-site order
is semantic, and future delivered or dropped items can interleave with Shop
entries at the same checkpoint. A set, unordered sidecar, or one order per
producer is insufficient.

Pending state must retain the payload and timing required to materialize the
item. After materialization, eligibility, findings, undo/redo, and UI repair
address the concrete pickup at its delivery point. Acquisition history records
that concrete item without pretending it was the ordinary reward of the
delivery room and without retaining an invented permanent parent link to its
producer.

The earlier Shop/Well audit deliberately postponed a shared interaction
frontier until a second concrete consumer existed. Schema 20 now uses the same
ordered-settlement seam for Shops, bounded incomplete Midshop publication, and
Narcissus pickups. Narcissus is not a consumer of Well inventory, spawn, or
purchase policy. The Well-specific interaction frontier remains part of the
first Well implementation, which should extend the existing seam rather than
introduce a parallel path.

### Echo reassessment after current settlement delivery

Echo confirms three distinct consumers of the delivered boundary rather than
one generic trait-outcome mechanism:

- Reward Reward Reward recreates the exact latest effective
  `LastRewardEligible` source. A consumable becomes a required Echo-room pickup;
  a loot source opens a fresh offer owned by that recreated acquisition. This
  requires canonical history to retain the exact replayable source identity,
  not merely the latest reward-history event. The recreated item settles before
  Echo's exits become usable.
- Boon Boon Boon first acquires its player-rarityless outer Echo identity, then
  directly equips one selected nested trait. It does not spawn a pickup and
  therefore remains in trait-offer authority. Because the real game reads the
  previous run's rarity cache, the planner may use an explicit cross-provider
  authored approximation without manufacturing prior-run state.
- Gold Gold Gold equips `EchoDoubleShop`, whose one remaining use is itself the
  pending state. During later World Shop settlement, the first eligible
  purchased entry consumes that equipped trait and creates a separate free
  world object. `SpellDrop` is skipped without consuming the use. Creating the
  object does not interact with it: the player may make other Shop purchases or
  pickups before taking the duplicate. A recreated loot source owns the offer
  generated when `CreateLoot` materializes it; a recreated consumable owns its
  later pickup behavior. `UseLoot` and `UseConsumableItem` call
  `RemoveStoreItem` before the purchased item's own acquisition effect settles,
  so Gold consumption and duplicate generation observe the pre-acquisition
  branch even though the paid source identity is already known. Pom loot is the
  closed exception to immutable generated options: `CreateBoonLootButtons`
  regenerates a `StackOnly` option set at interaction if any stored target is no
  longer equipped.

Gold therefore extends one reached Shop site with the stable
`echoDoubleShopReward` supplemental pickup; it does not justify a Shop-private
order or a separate Echo pending map. The equipped-trait history exposes
one-use consumption after the source purchase passes the Shop kernel but before
its acquisition roles, so later purchases and shops no longer observe the
effect. The materialized duplicate owns its exact child state independently of
participation and joins the existing site order only when picked up. A rejected
purchase leaves Gold armed, while invalid nested source detail after accepted
removal does not undo consumption or materialization.

Infernal Contract and Travel Deal use the same delivered settlement seam
without sharing Gold's timing policy. Contract contributes a fixed free pickup
only at a qualifying Shop destination and never becomes a paid trigger. Travel
contributes one paid refill derived from the first accepted paid purchase when
already equipped. Both may interleave with Gold and ordinary purchases through
the one room-exit order; their payloads and provenance remain independently
owned.

All eight selected Echo menu identities are themselves acquired
player-rarityless traits before these effect-specific contacts run.
Source-hidden Reward, Boon,
Survive, and Pom therefore remain in trait history even though their callbacks
produce a pickup, nested trait, collapsed Death Defiance restoration, or Pom
mutation. Boon leaves both the outer Echo identity and the selected nested
trait; Gold later removes only its exact one-use outer acquisition.

## Durable boundary invariants

1. Selecting a direct equipped trait does not manufacture a scheduled pickup.
2. Selecting a drop-producing benefit emits only its declared supported
   pickups. Whether its outer descriptor also enters equipped-trait history is
   source-owned: Narcissus choice descriptors do not, while every selected Echo
   identity does before its callback settles.
3. Pickup-owned trait offers and level resolutions are evaluated only when
   that pickup is due and acquired.
4. Current outgoing doors are generated from the correct pre-interaction
   history and are never regenerated from settlement results.
5. Each optional concrete item has one acquired/not-acquired participation
   fact. Presentation may label it purchased or picked up according to the
   interaction; payload authorship may precede participation, and neither label
   nor payload presence decides chronology.
6. Every participating item appears exactly once in its checkpoint's shared
   settlement order; every nonparticipating item appears zero times.
7. Immediate Shop and Well acquisitions affect the room settlement product
   even when the next decision is not yet authored.
8. An inactive, unselected, unpurchased, unpicked, undelivered, or not-yet-due
   child contributes no acquisition, trait, counter, or active finding.
9. Reward/purchase/drop/delivery order is preserved through one chronological
   fold per lifecycle checkpoint.
10. Every active O/H encounter site and entered N main/side room-end site is
    addressed independently; Hub, restore, inactive phase, and unentered
    side-room state cannot publish one. A site may host acquisitions without
    advancing a pending-delivery countdown.
11. Every item is assigned to an exact acquisition point derived from the
    resolved structural encounter envelope or declared explicitly for a
    post-interaction interval; current last-point convergence is never
    generalized into engine policy.
12. Pending-delivery counters advance only at their declaration-owned
    encounter-use event; they are not inferred from encounter-depth counting,
    room names, rendered decisions, final depth, or the mere existence of a
    settlement site.
13. Pending state retains its concrete item payload and delivery condition
    until materialization. The resulting pickup owns its own identity and
    authored acquisition detail at the reached delivery site and participates
    automatically; delivery has no optional picked-up state.
14. The reward kernel remains the sole authority for concrete reward history,
    source support, trait acquisition children, and Pom effects.
15. React renders producer and pickup controls from supported projections; it
    does not decide which descriptors drop which items or when they settle.
16. The active Midshop repair surface is the first-class room-local settlement
    product; no discarded replay duplicates it.
17. The Shop-private purchase order is absent. The shared settlement order is
    authoritative, and no parallel chronology may be introduced.
18. The implementation does not replace room/reward selection or duplicate the
    reward kernel. It adapts the existing reward acquisition into the shared
    checkpoint order where chronology is observable and removes the superseded
    direct trait/Pom editor in the same vertical slice.

## Explicit simplifications and remaining follow-up facts

The following remain open for focused follow-up work:

- default insertion for future acquisition families that have not yet declared
  an engine-owned complete site-order proposal;
- the exact encounter countdown for every Shrine item, including rooms that
  ignore encounter uses, multi-encounter rooms, boss exceptions, and forced
  completion rooms;
- ordering when several pending Shrine items expire together;
- temporary Well traits and their own use/expiry ledgers;
- dropped-item families outside the current Narcissus slice.

These gaps do not weaken the delivered conclusion: producer selection and
concrete acquisition are already separate in the game. The first-class ordered
settlement seam now owns Shop `roomExit` acquisition, Narcissus pickups, Echo's
mandatory last-reward recreation, and Gold Gold Gold's declaration-derived
supplemental Shop entry. Travel and Gold publish one shared complete proposal
product over their source dependencies, while payload edits use the same
derived-entry materialization command without changing order. Later Shrine
delivery must extend that seam while preserving
multiple lifecycle checkpoints; it must not move every acquisition to one
universal end-of-room phase.
