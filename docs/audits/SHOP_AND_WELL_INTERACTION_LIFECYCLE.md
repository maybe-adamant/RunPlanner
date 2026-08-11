# Shop and Well Interaction Lifecycle Audit

## Status and scope

This is a source-backed lifecycle audit for structural World Shops, Wells of
Charon, and Shrines of Hermes. It preserves the shared timing facts, records the
planner's current Shop model, and identifies the intended architectural seam
for future Well work.

This document does not define the complete item pools, prices, probability
weights, or UI. The existing
[`REWARD_GAME_DATA_AUDIT.md`](./REWARD_GAME_DATA_AUDIT.md) remains the authority
for the supported `WorldShop`, `I_WorldShop`, and `Q_WorldShop` offer matrices.
A future Well implementation plan must perform a focused pool and eligibility
audit before declaring Well support complete.

The game evidence was checked on 2026-08-11 against the installed Hades II
scripts. Primary sources are:

- `RunLogic.lua`, especially `CreateRoom`;
- `RoomLogic.lua`, especially `HandleSecretSpawns`, `UnlockRoomExits`,
  `DoUnlockRoomExits`, `IsWellShopEligible`, and `IsSurfaceShopEligible`;
- `StoreLogic.lua`, especially `FillInShopOptions`, `RunShopGeneration`,
  `UseWellShop`, and `HandleStorePurchase`;
- `SurfaceShopLogic.lua`, especially `ShowSurfaceShopScreen`,
  `HandleSurfaceShopAction`, and `CloseSurfaceShopScreen`;
- `StoreData.lua`, especially `RoomShop`, `SurfaceShop`, and the World Shop
  profiles;
- `ObstacleData.lua` and `ObstacleDataN.lua`, especially `WellShop` and
  `SurfaceShop`;
- `EncounterLogic.lua`, which locks and unlocks room-local interaction
  obstacles with encounter state; and
- `TraitData.lua` and `TraitLogic.lua`, especially
  `StorePendingDeliveryItem` and its expiration action.

In player-facing discussion, “Stygian Well” refers here to the game's Well of
Charon backed by `RoomShop`; “Hermes Well” refers to the Shrine of Hermes
backed by `SurfaceShop`.

## Terms

**Inventory materialization**
: Selection of the concrete options attached to a Shop or Well for the current
room.

**Outgoing generation**
: Creation of the current room's exit targets and reward previews.

**Post-encounter interaction**
: A room-local action available after the encounter and outgoing generation,
but before the player enters a selected exit.

**Interaction frontier**
: The proposed planner product that evaluates authored post-encounter actions
without moving those actions before outgoing generation.

**Acquisition**
: The point when an offered or purchased item actually changes run history.
Purchase and acquisition are not always the same event.

## Shared game lifecycle

Structural Shops and room-local Wells have different hosts, but they share the
same important ordering boundary:

```text
enter room and materialize available inventory
  -> resolve the room encounter and incoming reward, if any
  -> generate and reveal outgoing doors from pre-interaction state
  -> perform available Shop or Well interactions
  -> enter the selected next room with post-interaction state
```

`RunShopGeneration` runs for the next room during the transition into it. It
can materialize the room's structural World Shop, `RoomShop`, or `SurfaceShop`
inventory before the new map loads. Room setup separately installs eligible
Well or Shrine obstacles into a physical `ChallengeSwitchBase` slot.

For combat-bearing rooms, the Well and Shrine remain locked during the
encounter. `DoUnlockRoomExits` creates the exit rooms and their reward previews
before it marks `WellShop` and `SurfaceShop` usable. The player therefore uses
either interaction after the exits already exist and before choosing one.

This ordering has two consequences that the planner must preserve:

1. A post-encounter purchase cannot retroactively change the doors or rewards
   already generated in that room.
2. Its resulting state can affect later lifecycle work, beginning with the
   selected next room and its own outgoing generation.

## Structural World Shops

### Game form

A structural Shop is the room's primary noncombat product rather than an
optional obstacle in another room. `WorldShop`, `I_WorldShop`, and
`Q_WorldShop` use declared ordered groups and offer counts. Their inventories
materialize on entry. The Shop encounter initiates outgoing generation before
ordinary purchases, so requirements observing the current room's generated
Shop options see the complete inventory rather than a post-purchase remainder.

Purchases remove or consume offers and apply their effects in the player's
chosen order. The next room is entered with that post-purchase history. Exact
money, affordability, discounts, and rerolls are outside the planner's current
baseline; the authored purchase order assumes sufficient resources and a valid
use where the supported declaration permits that simplification.

### Current planner model

The planner currently models structural Shops as picked room occurrences with:

- declaration-owned complete inventory slots;
- one exact authored purchase order;
- entry-time inventory materialization;
- outgoing generation from pre-purchase acquisition history plus the complete
  `currentRoomShopOptionNames` set;
- purchase processing only after outgoing generation; and
- post-purchase history supplied to the selected continuation.

Unpurchased offer children remain authored but dormant. Purchased traits,
Boons, Poms, and other supported acquisitions resolve through their normal
engine authorities; React does not infer Shop effects.

### Active incomplete Midshop frontier

An editor can enter and author a Midshop before authoring its next decision.
Canonical simulation correctly stops at that Shop's outgoing-generation
checkpoint because the next authored topology does not yet exist. Waiting for
a completed next decision to assess purchased leaves, however, makes an
already-available Shop interaction impossible to repair in the editor.

The current focused correction therefore replays the exact purchase order into
a discarded room-local branch. That branch publishes purchase findings and
selected trait or Pom capabilities immediately, but it:

- does not join canonical public reward branches;
- does not alter the generated door state;
- does not advance later room history; and
- does not make unpurchased children active.

This is a truthful single-consumer bridge for current Shop authoring. It is not
the intended reusable representation for every future room-local interaction.

## Well of Charon (`RoomShop`)

### Game form

The base room declaration gives a Well of Charon a chance to appear after the
relevant permanent unlock, at biome depth three or later, with four rooms of
spacing from the previous Well event. Concrete rooms may override the chance,
requirements, or force state. Appearance also requires an available physical
`ChallengeSwitchBase` slot.

When eligible, room setup records `ForceWellShop`, installs a locked
`WellShop` obstacle, and records the current run depth as the latest Well
depth. Its `RoomShop` inventory contains up to three eligible options,
including healing or defensive consumables, temporary traits, run resources,
and other declared effects. Positive weights determine probability; they do
not change the possible option domain.

The obstacle becomes usable only after outgoing exits unlock. Purchases are
then applied immediately by `HandleStorePurchase`, subject in the game to
resource and purchase requirements. Some options are temporary traits whose
later expiration or remaining-use behavior is semantically relevant beyond the
purchase event.

### Planner disposition

Wells of Charon are not currently authored or simulated. Future support should
model them as optional occurrence-owned post-encounter interactions, not as
rooms, exits, incoming rewards, or counted reward bags.

The eventual implementation must separately settle:

- supported spawn requirements and physical-slot capability by room;
- the normalized `RoomShop` option catalog and offer count;
- purchase order and any supported restock behavior;
- immediate acquisitions versus temporary run effects;
- expiry or remaining-use history required by later eligibility; and
- the disposition of money, health costs, affordability, and Spark of Ixion.

Spark of Ixion and forced Chaos remain outside the current natural-Chaos
scope. Adding ordinary Well support must not silently introduce them.

## Shrine of Hermes (`SurfaceShop`)

### Game form

The Surface Shrine uses the same physical room-interaction family but a
different store and effect lifecycle. Base eligibility starts at biome depth
three after the relevant permanent unlock and rejects a Shrine in the previous
three rooms. Surface room declarations provide their own spawn chances and
may override or force the interaction. An available `ChallengeSwitchBase` slot
is still required.

`SurfaceShop` materializes three offers: one from its first group and two
distinct offers from its second group. It becomes usable after the encounter
and outgoing doors unlock.

A normal purchase does not immediately grant the item. It creates a
`StorePendingDeliveryItem` trait carrying the selected item and a room-delay
count. When that countdown expires, the item is spawned for acquisition in a
later room. The player may pay again to rush a purchased offer; that removes
the pending state and spawns the item in the current room when the screen
closes. Some declarations also mark rooms that automatically complete pending
delivery.

Purchase timing and acquisition timing are therefore distinct:

```text
post-encounter Shrine purchase
  -> pending delivery with a room countdown
  -> later delivery and concrete acquisition
```

or, when rushed:

```text
post-encounter Shrine purchase
  -> rush interaction
  -> same-room delivery and concrete acquisition
```

### Planner disposition

Shrines of Hermes are not currently authored or simulated. They should reuse
the future post-encounter interaction frontier for offer and purchase
authoring, but must not be collapsed into immediate World Shop or Well of
Charon acquisition semantics.

Future support needs an explicit pending-delivery product carrying at least the
concrete item, remaining room uses, and eventual acquisition behavior. The
implementation must decide which game acceleration, auto-delivery, price, and
reroll behaviors are modeled, simplified, or deferred. A mere ordered list of
immediate purchases would be structurally incorrect.

## Intended planner architecture

The first implemented Well slice should introduce a first-class
post-encounter interaction frontier and migrate the active-incomplete Midshop
bridge onto it in the same vertical slice. Do not wait until several Well
families have copied the discarded-branch mechanism.

The intended engine separation is:

```text
room-entry state
  -> materialized interaction inventory
  -> encounter and incoming acquisition
  -> pre-interaction outgoing-generation state
       -> generated exits and reward previews
       -> post-encounter interaction evaluation
            -> findings and authoring capabilities
            -> post-interaction continuation state
                 -> selected next room
```

The frontier must make both snapshots explicit:

- **pre-interaction generation state**, which owns already-generated exits and
  their rewards; and
- **post-interaction continuation state**, which owns purchases, immediate
  effects, or pending-delivery state carried into the next room.

It must support an active room even when the next decision is incomplete. In
that state it may publish exact room-local interaction findings and repair
capabilities, but it cannot invent a continuation, advance canonical route
history, or regenerate the exits from post-interaction facts.

Ownership remains aligned with the repository lanes:

- the Hades II catalog owns spawn declarations, option sets, requirements,
  payloads, and normalized effect facts;
- the planner engine owns materialization, lifecycle chronology, authored
  interaction commands, history, candidates, and findings;
- application projection binds supported engine interactions to their exact
  occurrence owners; and
- React presents those interactions without reconstructing eligibility,
  inventory, purchase, delivery, or timing policy.

The shared frontier is deliberately not a generic callback registry or
catch-all room context. Each supported interaction family retains its own
closed authored state and semantic processing. Their common contract is the
lifecycle boundary at which those products are evaluated.

## Implementation trigger and acceptance invariants

Do not extract the frontier merely to rename the current Shop bridge. Extract
it as Gate A of the first concrete Well implementation, when a second consumer
can prove the contract.

That gate should satisfy these invariants before later Well expansion:

1. Structural Shop behavior remains equivalent, including the active Midshop
   ability to repair purchased trait and Pom leaves before a next decision.
2. The first Well is authorable only on an entered occurrence where its exact
   declaration, history, chance disposition, and physical capability permit
   it.
3. Generated exits are identical whether or not a post-encounter interaction
   is purchased.
4. Immediate interaction effects appear in the history entering the selected
   next room, but never in the history that generated the current exits.
5. A Shrine purchase, when later supported, creates pending delivery rather
   than an immediate acquisition unless the authored rush path is selected.
6. An incomplete next decision still exposes exact local findings and repair
   controls without producing a fabricated public continuation branch.
7. Dormant, absent, or unpurchased interaction leaves do not contribute
   acquisitions, traits, counters, or findings requiring active use.
8. UI and application tests witness projection and interaction contact; the
   complete lifecycle and item-policy matrices remain owned by catalog and
   engine tests.

## Deferred research checklist

Before locking a Well implementation plan, refresh the installed scripts and
close these evidence gaps:

- exact eligible host declarations and concrete `ChallengeSwitchBase`
  capability for each supported biome;
- current `RoomShop` and `SurfaceShop` pools, offer counts, per-item
  requirements, and without-replacement behavior;
- room-count decrement timing for every pending Hermes delivery;
- forced postboss Wells and Shrines versus naturally spawned interactions;
- restock, reroll, first-purchase discount, and rush semantics;
- temporary-trait expiry and the subset that affects modeled history;
- interaction coexistence when a map has multiple physical challenge slots;
  and
- explicit dispositions for affordability, health costs, resources, and
  profile-progression predicates.
