# Reward Model

## Purpose

This document defines the reward vocabulary shared by catalog
declarations, authored room state, simulation, and the editor. It carries the
verified reward hierarchy forward without carrying the old Lib control or
storage implementation.

`CATALOG_MODEL.md` owns declaration normalization. This document owns what the
reward declaration kinds mean and how they compose. `ROOM_LIFECYCLE_MODEL.md`
owns when a room invokes offer and acquisition transitions.
`SIMULATION_AND_VALIDATION.md` owns transition evaluation, counted-bag mutation,
and legality.
`../audits/REWARD_GAME_DATA_AUDIT.md` records the underlying game evidence and the exact,
simplified, deferred, or excluded disposition of each audited mechanic.

## Cross-Biome Freeze Status

Possibility-only evaluation is locked. The generated-batch base-store and
resolved-offer-only leaf split described below is the globally frozen
F/G/P/Q/H/O/I/N contract. N confirms that one persistent heterogeneous board
can use `none` while every target resolves declaration-owned provenance. The
implemented F/G/H/I and N/O/P/Q product loops use this contract as their sole
connected reward authority. Declaration-owned biome state and fixed-entry
continuation ownership do not change this reward contract.

## Composition

Rewards compose bottom-up:

```text
payload domain
  -> reward type
      -> resolved reward offer

reward type
  -> counted store entry
      -> counted store and mutable bag
          -> concrete producer binding and filters
              -> authored resolved reward-offer leaf

biome store-selection policy
  -> authored, source-offer-derived, or absent generated-batch base store
      -> room forced/individual override
          -> resolved target store

resolved target store + authored resolved reward offer
  -> canonical counted offer
      -> room template or encounter offer point

resolved reward offer + offer point
  -> generic offer-history event
      -> optional reward-type offer projection

reward type
  -> shop option entry
      -> ordered shop group
          -> shop profile
          -> picked occurrence's authored shop state

resolved reward offer + reward-type acquisition roles + producer lifecycle
  -> zero or more concrete acquisition events at named lifecycle points
      -> concrete acquisition declaration
          -> typed game-history projection
```

Counted rewards and shops share reward types and concrete acquisition
declarations but are separate producer branches. A shop is not a counted bag
with different presentation.

## Four Distinct Reward Identities

The model keeps four close but non-interchangeable concepts separate:

`Store Entry`
: One concrete member of a counted bag. It owns multiplicity position,
requirements, `allowDuplicates`, and a reward type such as `Boon`. It is
consumed when the offer is generated, not when its reward is acquired.

`Resolved Reward Offer`
: The complete authored planner offer at its semantic resolution point. It
retains the reward type that explains store behavior and any complete payload,
such as `Boon` plus `ApolloUpgrade`. A payload may contain future planner intent
that is not yet game-visible, as for Blind Box. The offer is not itself a claim
that loot entered history.

`Concrete Acquisition`
: One most-concrete game identity acquired at a specific lifecycle point, such
as loot `ApolloUpgrade` or consumable `MaxHealthDrop`. One offer may emit zero,
one, or several acquisitions.

`History Projection`
: The declaration-owned closed profile applied when one concrete acquisition
occurs. It updates the exact loot/use ledgers for that acquisition kind and
belongs to the concrete acquisition identity, never to the store entry that
happened to produce it.

The core sequence is:

```text
StoreEntry(Boon)
  -> ResolvedRewardOffer(Boon, ApolloUpgrade)
  -> ConcreteAcquisition(loot, ApolloUpgrade)
  -> HistoryProjection(ApolloUpgrade)
```

`Boon` remains observable for bag depletion, room filters, reward-type
duplicates, and source selection. `ApolloUpgrade` is the concrete loot identity
observed by downstream loot-history requirements. Neither identity replaces
the other.

An illustrative normalized shape is:

```ts
interface RewardTypeDeclaration {
  gameName: RewardTypeGameName;
  label: string;
  payloadDomain?: PayloadDomainKey;
  defaultPayload?: RewardPayload;
  sourceSupport?: RewardSourceSupportKey;
  sourceResolution?: { kind: 'offer' } | { kind: 'acquisitionRole'; role: AcquisitionRoleKey };
  offerProjection?: OfferProjectionKey;
  acquisitionRoles: readonly AcquisitionRoleDeclaration[];
}

interface ResolvedRewardOffer {
  rewardType: RewardTypeGameName;
  payload?: RewardPayload;
}

interface ConcreteAcquisitionAddress {
  kind: 'loot' | 'consumable' | 'resource';
  gameName: AcquisitionGameName;
}

interface ConcreteAcquisitionEvent {
  role: AcquisitionRoleKey;
  lifecyclePoint: ProducerLifecyclePointKey;
  acquisition: ConcreteAcquisitionAddress;
}

interface ConcreteAcquisitionDeclaration extends ConcreteAcquisitionAddress {
  historyProjection: 'lootAndUse' | 'consumableAndUse';
}
```

The normalized acquisition-role resolution union is deliberately small:

- `self` resolves to the reward type's own game name and one declared
  acquisition kind;
- `fixed` resolves to one declared concrete acquisition address;
- `payloadSource` resolves one semantically named field from the reward type's
  typed payload domain.

Reward-type declarations name those roles and define how each role resolves an
identity from the complete offer. Producer and encounter declarations bind the
roles to lifecycle points. Concrete acquisition declarations project history.
No generic `acquiredAs` alias or arbitrary payload-property path crosses those
layers.

Reusable producer timing is normalized separately from reward identity. A
producer-lifecycle profile enumerates the reward types it supports, supplies
one default point for their roles, and may explicitly override the complete
role binding for a supported reward type. The initial `RoomReward` profile
binds ordinary roles to `roomRewardPickup`, while its declaration binds
Devotion's `chosenSource` to `beforeCombat` and `spurnedSource` to
`afterCombat`. Catalog normalization expands that declaration into one exact
role-complete lifecycle per supported reward type. It does not invent timing
for reward types outside the profile or dispatch on reward names in core code.

The reward type owns what can be acquired, but not when. Having no roles
represents a structural offer such as Story or Shop. The producer lifecycle
owns when each role occurs. The same concrete loot must not encode whether it
came from a room reward, a cage, a shop purchase, or a multi-stage Devotion.

Offer payload authorship and game-visible resolution timing are also separate.
Most payloads are both authored and resolved at offer generation. Blind Box
still persists the intended eventual source as complete planner intent, but the
box remains the only game-visible offer and that source is validated and
resolved only after purchase. An unpurchased Blind Box never validates or emits
its dormant source.

Offer identity, acquisition identity, and semantic effect are separate. Big,
Triple, and self-consumed wrapper variants retain the exact ledger keys written
by the game even when they have a related base effect. Spawn wrappers such as
`WeaponUpgradeDrop` and `ShopHermesUpgrade` remain exact offer identities but
resolve fixed concrete loot identities. A future semantic-effect alias may
support deeper resource or trait simulation, but it cannot replace the ledger
identity consumed by requirements.

Labels need only be unambiguous inside one rendered option domain. Changing a
label does not migrate authored state.

## Payload Domains

A payload domain owns the shape and local validity of one resolved-offer
payload.
The initial domains are:

| Domain         | Value                                | Local rule                                   |
| -------------- | ------------------------------------ | -------------------------------------------- |
| `BoonSource`   | one source game name                 | source belongs to the declared source domain |
| `DevotionPair` | chosen and spurned source game names | both sources belong and are distinct         |

Payload domains do not know rooms, bags, topology, history, or UI widgets.
Every payload-bearing reward type declares a complete payload default.
`Boon`, `RandomLoot`, and `BlindBoxLoot` share the `BoonSource` value shape.
Their role and lifecycle declarations distinguish offer-time source resolution
from Blind Box's acquisition-time validation; a second payload domain would
duplicate shape without expressing that timing. The distinct
`BoostedRandomLoot` shop entry resolves an ordinary `RandomLoot` offer under the
rarity-deferred model.

Defaults therefore recurse to a terminating value:

```text
RunProgress default entry -> ResolvedRewardOffer(Boon, ApolloUpgrade)
BoonSource payload default -> ApolloUpgrade
Boon primary acquisition role -> ConcreteAcquisition(loot, ApolloUpgrade)
```

An active payload is never empty. Replacing a reward type installs that type's
complete resolved-offer default atomically.

## Source-Support Policies

A source-bearing reward type selects one normalized source-support policy and
one semantic resolution point. Payload shape alone is insufficient: the same
`BoonSource` value is supported differently for an ordinary door Boon, a shop
Boon, and a Blind Box. The initial policy vocabulary is closed:

`ordinaryBoonPeer`
: Resolve one ordinary source while its offer is generated. Apply the ordinary
four-source cap to the union of acquired sources and sources offered by
earlier Boon peers, exclude those peer sources from the resulting primary
pool, and use the game's weaker-exclusion and unrestricted fallbacks when
those exclusions exhaust support.

`ordinaryNoPeer`
: Resolve one ordinary source at the declared lifecycle point using current
ordinary-source eligibility and the four-source cap, with no generated-peer
exclusion. `RandomLoot` and `BoostedRandomLoot` use it during shop generation.
`BlindBoxLoot` uses the same support policy at its authored-source acquisition
role after purchase.

`devotionAcquiredPair`
: Resolve two distinct sources from ordinary god loot already acquired in the
current run. The game first constructs the unordered offered pair; the authored
`chosenSource` and `spurnedSource` order records the player's later selection.
Both ordered realizations of any supported pair are possible. Ordinary
generated-peer exclusion and the four-source offer cap do not re-filter this
already-acquired pair.

The fully progressed baseline treats every ordinary god as previously
interacted with outside the current run. This removes the external interaction
gate from shop `RandomLoot` support without weakening current-run source caps.
Hermes remains outside the ordinary source domain.

The normalized bindings are:

| Reward type    | Source support         | Resolution point                 |
| -------------- | ---------------------- | -------------------------------- |
| `Boon`         | `ordinaryBoonPeer`     | offer generation                 |
| `Devotion`     | `devotionAcquiredPair` | offer generation                 |
| `RandomLoot`   | `ordinaryNoPeer`       | shop offer generation            |
| `BlindBoxLoot` | `ordinaryNoPeer`       | authored-source acquisition role |

Catalog normalization rejects a source-bearing payload without both fields, a
source policy on a payload-free reward type, or an acquisition-role resolution
point that does not reference a role declared by that reward type. Simulation
dispatches through the policy registry; it never switches on reward names to
reconstruct source support.

## Reward Types and Resolved Offers

A resolved offer is one reward type plus its complete offer payload:

```ts
type ResolvedRewardOffer =
  | { rewardType: 'MaxHealthDrop' }
  | {
      rewardType: 'Boon';
      payload: { source: 'ApolloUpgrade' };
    }
  | {
      rewardType: 'Devotion';
      payload: {
        chosenSource: 'ApolloUpgrade';
        spurnedSource: 'ZeusUpgrade';
      };
    };
```

Fixed reward types may have payloads. A forced Devotion still needs its authored
chosen/spurned pair even though it does not come from a counted bag. The chosen
source resolves to one concrete loot acquisition before combat and the spurned
source to another after combat. Both precede downstream room generation, but
their roles remain explicit for execution intent. Payload-free structural types
such as `Story` need no authored leaf state and emit no concrete acquisition.

## Offer Projections

Every generated offer emits the common canonical offer-history event. Counted
offers also consume one store entry, and batch-local source or duplicate rules
advance while peers are generated. Those are shared offer-point mechanics, not
reward-type history aliases.

A reward type declares an additional `offerProjection` only when merely
materializing that type changes a persistent current-run fact. In the supported
reward surface, Devotion is the only such type: its offer setup writes the
current `runDepthCache` to `lastDevotionDepth`, including when its target is
never entered. Later `minRoomsSinceEvent(Devotion)` requirements read that
offer-time marker. Neither chosen nor spurned acquisition owns it.

The normalized initial offer-projection vocabulary is therefore closed:

```text
none
devotionSpacing -> lastDevotionDepth = current runDepthCache
```

Encounter selection performed while setting up Devotion remains part of the
resolved offer and encounter profile. Presentation-only global encounter
records have no supported downstream consumer and are not projected.

## Concrete History Projection Profiles

Every supported concrete acquisition selects exactly one closed history
projection profile. The profile is independent of acquisition `kind`: kind
identifies the concrete game entity, while the profile identifies the ledgers
written by its actual pickup path.

`lootAndUse`
: Increment current-run use, biome-use, current-room use, loot-type history,
and loot-biome history under the exact concrete loot game name.

`consumableAndUse`
: Increment current-run use, biome-use, current-room use, and consumable history
under the exact concrete game name.

Most loot uses `lootAndUse`. `SpellDrop` is deliberately a `loot` acquisition
with `consumableAndUse`: its custom spell-screen path records use and
`CurrentRun.ConsumableRecord`, but does not write `LootTypeHistory` or
`LootBiomeRecord`. Ordinary consumables and resource pickups also use
`consumableAndUse`. Resource identity remains explicit through acquisition
`kind`; exact resource quantities and affordability remain deferred.

The planner does not project persistent `GameState.UseRecord`; save/profile
history is outside the project input boundary. It also does not collapse Big,
Triple, self-consumed wrapper, or random-Stack identities to a semantic base
name. Future trait/resource simulation may add typed semantic effects beside these
profiles without changing their exact ledger writes.

Ordinary god loot also folds into the acquired ordinary-source set. Under the
locked trait-free approximation, every acquired ordinary god source adds one to
`upgradableTraitCount`; Devotion's two acquired sources apply that rule
independently. Hermes is not an ordinary source. Other health, mana, armor,
resource, Stack, Talent, weapon-trait, and Last Stand effects remain governed by
their documented simplifications or deferrals rather than hidden projection
aliases.

## Counted Stores and Bags

A counted store declaration owns:

- a stable `storeKey` such as `RunProgress` or `MetaProgress`;
- the ordered game bag entries, including multiplicity;
- entry-level current-run requirements;
- entry-level `allowDuplicates`, defaulting to `false`;
- one explicit default reward type and complete offer payload for authoring.

The catalog exposes an immutable option domain from that declaration. The
simulator creates a mutable scratch bag for one route simulation. Exact store
provenance is resolved by the owning generated batch or fixed producer and is
carried by canonical offers. A counted room leaf authors only its complete
resolved offer; it is not a second store authority.

Repeated bag entries do not duplicate editor options. Their multiplicity and
requirements remain available to simulation. When several eligible entries can
produce one authored value, possibility simulation preserves every distinct
reachable post-consumption bag state. It must not invent a deterministic
declaration-order tie-breaker for a random game choice.

When no entry in the entire bag is eligible, the game appends a complete base
set without discarding ineligible leftovers. It can do this twice. If no entry
is eligible after the second refill, the offer falls back to
`RoomRewardHealDrop`. This is one global picker rule, not repeated store data.
The complete store-and-consumer proof in `../audits/REWARD_GAME_DATA_AUDIT.md` establishes
that every supported planner call has an eligible entry after the first refill.
The simulator therefore appends at most one complete set and treats a
still-empty supported call as an invariant failure. It does not reproduce the
redundant second append or synthesize the unreachable fallback. An explicit
`RoomRewardHealDrop` entry in a counted store remains an ordinary reward.

### Fully Progressed MetaProgress Projection

The normalized `MetaProgress` store is a coherent 13-entry projection of the
game's raw 19-entry store:

- one unconditional `GiftDrop` under the completed external unlock baseline;
- two ordinary Bones and four ordinary Ashes while `EnteredBiomes <= 1`;
- two Big Bones and four Big Ashes while `EnteredBiomes > 1`.

The raw later ordinary entries belong to a lower lifetime-resource tier and are
mutually exclusive with the retained Big variants on a fully progressed save.
They are omitted rather than made unconditional. This projection is exact for
the selected profile; production does not carry lifetime-resource predicates or
union mutually exclusive save tiers.

## Producer Bindings

A concrete producer embeds its complete binding:

```ts
interface CountedChoiceBinding {
  kind: 'countedChoice';
  storeKeys: readonly RewardStoreKey[];
  eligibleRewardTypes: readonly RewardTypeGameName[];
  ineligibleRewardTypes: readonly RewardTypeGameName[];
  defaultRewardTypesByStore?: Readonly<Record<RewardStoreKey, RewardTypeGameName>>;
}
```

The effective static domain is:

```text
union of referenced store members
intersect eligibleRewardTypes when non-empty
subtract ineligibleRewardTypes
```

Filters apply to reward type names, not Boon source names. Positive and
negative filters cannot overlap. Every referenced reward must exist and every
positive member must be produced by at least one referenced store.

Filtered bindings do not create named surface types. There is no
`RunProgressNoDevotion`, `TartarusBoonOnly`, or similar public taxonomy.
`countedChoice` is the behavior; stores and filters configure it.

History-dependent bag-entry requirements remain visible in the normalized
binding provenance but do not remove options from the static authored domain.
They are evaluated by the simulator.

The binding's `storeKeys` declare which resolved store contexts the producer
can accept. They do not select the active store and do not own a default store.
New generated batches receive their base-store default from the biome layout
policy. A target reward default normally comes from its currently resolved
store. When a room's positive or negative filter removes that store default,
`defaultRewardTypesByStore` must name an allowed member of the same store. This
is only a complete leaf-initialization default; it neither changes bag order
nor creates a second store-selection authority. Tartarus Boon-only minibosses
use this form while ordinary I combat retains the Tartarus store default.

## Producer Kinds

The initial semantic producer kinds are:

`none`
: Produces no modeled reward and owns no reward state.

`fixed`
: Produces one declared reward type. It authors only that type's offer payload,
when present.

`countedChoice`
: Authors one complete resolved reward offer from the store resolved at its
offer point.

`shop`
: Declares an entry-materialized shop profile. Its owning occurrence authors
complete offer and purchase state only when picked for entry; it does not
carry a counted `storeKey`.

## Entered-Room Store History

Reward production and entered-room reward-store history are related but
separate declaration facts. Every concrete Room Declaration selects exactly one
history policy:

`resolvedOffer`
: Record the store resolved by the owning generated offer point. This includes
fixed Story and Shop producers created from a generated batch.

`fixed`
: Record one declared store independently of generated-batch resolution. Fixed
producers use this only when the game explicitly assigns a store independently
of ordinary door generation.

`none`
: Record no store contribution even when the room has another fixed
acquisition, or because it produces no reward.

The simulator never infers this policy from room name or visible reward kind.
For the G neutral baseline, `G_Boss01` has no modeled reward surface but records
the store resolved for the linked boss offer, while `G_PostBoss01` records none.
The concrete F boss declaration independently selects `none` for the game's
`IgnoreForRewardStoreCount` behavior.

A resolved store is bookkeeping provenance, not a claim that a visible reward
was drawn from that store's bag. Linked G/P boss doors first receive a
RunProgress or MetaProgress store; automatic Mixer and weapon-dependent drops
then occur outside the modeled reward surface. The entered boss still counts
under the previously resolved store in the game's ratio ledger. Modeling that
ledger effect does not require boss reward types, leaf state, bag depletion,
concrete acquisitions, history projection, or editor controls.

Biome-specific slices add structural composition around these reward types:

- `localSlots` for verified H cages and N side rooms;
- a derived incoming realization for the I Goal/NonGoal branch;
- `offerPoint` for O encounter wheels.

Those wrappers coordinate bounded local children. They do not redefine bags,
reward types, concrete acquisitions, payloads, or peer/history validation.

### H Fields Cage Composition

An ordinary H batch uses base-store policy `none`. Although the game computes a
generic RunProgress/MetaProgress value, every supported target is reward-free
or resolves declaration-owned RunProgress provenance, so no canonical consumer
observes that generic value.

Every H combat occurrence owns three complete RunProgress counted reward
values with Devotion excluded. The surrounding generated batch owns one
semantic Min/Max outcome and derives whether the active prefix contains two or
three slots. A capacity-two peer can make both outcomes visibly activate two
slots, so the room state never stores active count as reward authority.

Offer resolution walks every generated occurrence in physical target order,
resolving its ordinary incoming producer before its active cage slots. Picked
and unpicked targets therefore share one counted-bag and Boon-source offer
history; an earlier miniboss Boon can constrain a later combat cage source.
Only the active slots of the entered combat target acquire their rewards.
Inactive third slots remain complete authored state but emit no canonical
offer or acquisition.

The automatically spawned `FieldsOptionalRewards` bag is a separate deferred
surface. The canonical v1 trace acquires none and does not fold those values
into the cage producer, RunProgress bag, or generated batch state.

### I Clockwork Composition

Every supported I target has the declaration-owned forced-store override
`TartarusRewards`. A Clockwork generated batch therefore uses batch-store
policy `none`: it does not author an otherwise-unrepresented Run/Meta outcome,
while each counted target still resolves concrete Tartarus provenance through
its Room Declaration.

Goal versus NonGoal is not authored state. `ClockworkDoorBatch` derives each
combat target's incoming realization from physical reward order, prior Goal
offers in that batch, and the non-goal cap.

Every combat occurrence owns one complete potential resolved reward offer from
`TartarusRewards`, with its declaration filters applied. When simulation
derives `Goal`, that value is dormant and emits no offer or bag mutation. When
simulation derives `NonGoal`, the same value becomes the target's concrete
counted offer. Upstream edits retain it rather than resetting the leaf when the
derived realization changes.

The first combat offer in physical reward order is forced Goal. A later combat
peer receives NonGoal while capacity remains and Goal after the cap. Resolving
an entered Goal decrements remaining goals; spawning an entered concrete non-
goal increments the folded non-goal acquisition counter. Its physical pickup
follows before continuation, so downstream generation cannot observe the
distinction. Unpicked offers affect neither counter, though a concrete non-goal
still consumes its counted-bag entry.

The entered `I_PreBoss02` owns `I_WorldShop`. An unpicked preboss occurrence
requires no shop state because the room was not entered. Its inherited Goal
marker is a structural countdown producer after the counter has already
reached zero, not a reward leaf or a free-reward realization.
`../biomes/I_GAME_RULES.md` owns the exact batch ordering and
selected-Preboss lifecycle.

### N Persistent Hub Composition

N resolves one persistent hub offer board. Every open fixed hub target emits
its incoming offer exactly once in physical generation order; open unvisited
targets consume counted-bag entries but never acquire. Hub restores reuse the
same offers without repeating bag mutation.

Combat targets force `HubRewards`, while miniboss targets force RunProgress
and filter it to Boon. Every supported target therefore resolves store
provenance from its Room Declaration, and the N hub batch uses base-store
policy `none`. The otherwise computed Run/Meta base outcome has no supported
offer or ledger consumer.

Visited combat occurrences own bounded fixed side-room slots. Generated slots
resolve together from either `SubRoomRewards` or `SubRoomRewardsHard`; generated
unentered slots consume their bag, while entered slots also acquire. A side
slot retains its complete authored offer when its generation state is
`notGenerated` or its parent Hub target is unvisited. It becomes an active
reward leaf only when the parent detail is active and the side slot is
generated.

All generated siblings receive offers before any side room can be entered.
They share one same-batch duplicate set and mutate their declared counted bags,
so they are jointly constrained rather than independent draws. Under the
supported side bags, eligibility is stable throughout that generation pass and
no reward setup changes a sibling's candidates. Possibility validation may
therefore validate the complete sibling assignment as an unordered batch;
engine reward iteration order and later player entry order do not change its
support.

The full initial hub offer board also derives `hubRewardLookup`. N's entered
`WorldShop` preboss validates Hex and Hammer option support against that lookup,
including reward types offered behind unvisited hub doors. This cross-room
consumer is separate from counted-bag depletion and acquisition history.
`../biomes/N_GAME_RULES.md` owns the concrete bags, room filters, local-slot topology,
and lifecycle order.

## Authored and Materialized Counted Offers

A counted room leaf authors one complete resolved offer:

```ts
type AuthoredCountedOffer = ResolvedRewardOffer;
```

Canonical materialization combines it with the store resolved by the owning
offer point:

```ts
interface MaterializedCountedOffer {
  storeKey: RewardStoreKey;
  offer: ResolvedRewardOffer;
}
```

Changing an authored generated-batch base store retains its target resolved
offers.
Changing a source-offer-point store likewise retains the outgoing batch and
target resolved offers. The next simulation may report a retained offer as
unavailable from its newly resolved store; it does not silently replace
authored intent.
Changing a reward installs the selected reward type's declared offer-payload
default.

The editor may retain inactive bounded state inside a later structural wrapper,
but every active counted choice is a complete resolved offer.

## Shops

Shops are assembled from reward types through option entries, ordered groups,
and profiles:

```text
reward type -> option entry -> ordered group -> stable emitted slot -> shop profile
```

A shop profile owns ordered groups. Each group declares its eligible option
entries, per-option current-run requirements, and `offerCount`. Selection is
without replacement inside one group. Positive option weights affect
probability only and do not enter possibility validation.

Every emitted offer owns a stable semantic slot key, presentation label, and
one explicit default. Its authored value is:

```ts
interface ShopOfferState {
  offer: ResolvedRewardOffer;
}

interface ShopState {
  profileKey: string;
  offers: Readonly<Record<string, ShopOfferState>>;
  purchaseOrder: readonly string[];
}
```

The normalized group shape is equivalent to:

```ts
interface ShopGroup {
  key: string;
  offerCount: number;
  options: readonly ShopOptionEntry[];
  rewardTypes: readonly RewardTypeGameName[]; // normalized stable UI projection
}

interface ShopOptionEntry {
  key: string;
  rewardType: RewardTypeGameName;
  requirement?: RequirementExpression;
}

interface ShopSlot {
  key: string;
  label: string;
  groupKey: string;
  defaultOptionKey: string;
  defaultOffer: ResolvedRewardOffer;
}
```

Slots are explicit declaration data rather than indexes synthesized from group
order. Their ordered `groupKey` sequence must exactly realize every group's
`offerCount`, and defaults in one multi-offer group must select distinct option
entries. The normalized slot retains the resolved default offer beside the
option key that authoritatively selected it.

Entry keys remain distinct when the same reward type appears with different
requirements. Authored state stores the complete resolved offer in each emitted
slot, not the randomly selected entry key; simulation validates that at least
one eligible without-replacement entry assignment explains the authored
offers.

`RandomLoot` and `BoostedRandomLoot` remain distinct shop-option entries. While
rarity and price are deferred, both resolve the same authored `RandomLoot` plus
source shape; the supporting entry stays in the derived assignment witness so
two-offer groups still enforce without-replacement selection exactly.

`purchaseOrder: []` is complete authored state. The list contains distinct
stable slot keys in the exact player-authored acquisition order; it controls
acquisition, not whether an inventory offer exists. The ordinary `WorldShop` has three one-offer
groups and therefore three stable slots whose current labels are `Offer 1`,
`Offer 2`, and `Offer 3`; internal slot keys may remain category-bearing without
leaking into presentation. `I_WorldShop` has five one-offer groups.
`Q_WorldShop` has six slots because its first of five groups emits two distinct
offers.

`WorldShop`, `I_WorldShop`, and `Q_WorldShop` are distinct profiles. N uses
`WorldShop` but adds the declaration-owned `hubRewardLookup` requirements
described above. Their specific later-biome rules move with the corresponding
implementation slice.

Shop state is entry-materialized rather than door-offer state. Every picked
shop occurrence must own a complete value for every slot in its declared
profile. An unpicked shop occurrence may omit that state entirely; if it was
previously picked, the authored project may retain its complete value
dormantly. Selecting an unconfigured shop occurrence as the picked target
atomically installs the profile's recursive defaults. Materialization ignores
shop state on every unpicked occurrence.

This differs from incoming and free-reward leaves. Those rewards materialize
on the physical door and therefore remain complete, offered facts even when
their target is unpicked.

Shop inventory materializes from entry history before the entered shop's
outgoing doors are generated. The outgoing batch is then generated before
ordinary player purchases. Hammer, Hermes, Spell, and Talent requirements that
inspect the current shop therefore see the complete generated shop inventory
at that checkpoint, not a post-purchase remainder. This query is not a
counted-store lookup.

The normalized requirement kind is `notInCurrentRoomShopOptions`; the legacy
prototype name `notInStore` is retired at the shared reward-kernel requirement
boundary.

Purchases remove options and update acquisition history after the outgoing
batch already exists. They cannot change that batch or the selected next room's
already-resolved reward. Their first effect on room generation occurs when that
selected room later generates its own outgoing batch. The exact operation order
is defined by `ROOM_LIFECYCLE_MODEL.md`.

Exact prices, money, health, last-stand inventory, discounts, and affordability
are deferred. The first complete model authors purchases under a
sufficient-resource and valid-use assumption. This deliberately admits some
purchases that one concrete resource state could not make; it does not weaken
offer-generation requirements or downstream acquisition effects.

Purchase order is authored Shop state, not a simulation witness. A Blind Box
offer persists its intended eventual `BoonSource`, but source support is not
validated while the box is merely offered. When the box is purchased, the
simulator applies the one authored order, evaluates each purchase against the
history from earlier authored purchases, and never retries another permutation.
It retains ordinary reward-source possibility branches within that fixed order.

The persisted order remains available to a later plan compiler without the
compiler or simulator choosing a different witness order. The editor derives
per-row membership and ordinal controls from the one occurrence-owned list.

## Offer and Acquisition

Offer and acquisition are separate facts:

```text
source generates incoming reward  -> resolved_reward_offer.emit
producer reaches lifecycle point  -> concrete_acquisition.emit
picked shop room enters           -> resolved shop offers become active
purchased shop slot               -> purchase-time concrete acquisition(s)
```

The lifecycle point is producer-specific. A normal room reward emits its
concrete acquisition on pickup, a Devotion emits its chosen and spurned source
at distinct points, and a purchased Blind Box first emits its box use and then
validates and emits its authored hidden source. The concrete acquisition
declaration then projects the typed history writes. Store-entry identity never
enters history through an implicit alias.

Every generated peer occurrence contributes its complete resolved incoming
offer and
counted-bag consumption, including unpicked peers. Only the picked and entered
occurrence advances its producer's acquisition lifecycle. That lifecycle may
resolve zero concrete acquisitions, as for Story and Shop, or several at
different points, as for Devotion. A shop exposes its resolved offers only on
entry and advances exactly its purchased slots through purchase-time
acquisition.

Fixed and forced producers do not borrow requirements from a same-named
counted bag entry. A forced Devotion is validated as a fixed Devotion producer,
not through `Devotion`'s `RunProgress` bag-entry requirements.

## Possibility Contract

Reward simulation models possible outcomes, not their probability.

For a store-selection ratio or chance value `p`:

- `p <= 0` makes the corresponding outcome impossible and its alternative
  forced;
- `0 < p < 1` keeps both outcomes possible;
- `p >= 1` forces the corresponding outcome.

The authored project selects one concrete outcome from the resulting support
set. Validation rejects non-membership; it does not grade possible outcomes by
likelihood. Store-entry multiplicity still matters because offers consume bag
entries and change later support, not because the app computes a probability.

## Generated-Door Store Resolution

`GAME_GENERATION_RULES.md` owns when physical target creation and reward
assignment occur. This section owns the reward-store algorithm applied at that
lifecycle point.

An ordinary generated-door batch owns one authored `baseRewardStoreKey` only
when its biome layout reward policy exposes an otherwise-unrepresented
observable generated store. The layout policy derives the possible base-store
set from current history, and validation proves that the authored base store
belongs to that support set.

An O ShipCombat batch instead uses `sourceOfferPoint`. Its final active wheel
already owns the concrete RunProgress/MetaProgress store that the game reuses
for outgoing door generation. Materialization resolves the batch base store
from that addressed wheel and rejects a missing or inactive source. The batch
does not author a duplicate value.

O's selected Preboss batch is also a physical generated-door decision, so it
carries the same reward-store authority as an ordinary O batch. A ShipCombat
predecessor resolves it from the final active wheel; another O predecessor
uses the authored Run/Meta base store. The entered Preboss and completion tail
retain that resolved store provenance.

A reward-free generated batch such as Q's combat spine has no authored base
store. Forced or individual target stores remain declaration-owned and still
produce resolved offers, so Q miniboss targets can use `TyphonBossRewards`
without inventing a RunProgress or MetaProgress batch value.

The game then resolves actual target stores in two physical-order passes:

1. resolve the initial base store from the authored batch value or addressed
   source offer point when the policy exposes one;
2. scan targets and let each valid `ForcedRewardStore` replace the working
   shared store, so a later forced target can affect earlier ordinary targets;
3. resolve every target using its `IndividualRewardStore`, otherwise its own
   valid `ForcedRewardStore`, otherwise the final shared store.

The Room Declaration owns forced or individual overrides. A generated batch
owns the base store only under the authored-base-store policy; a
source-offer-point policy reads the room-owned store without moving its
authority. Each room occurrence owns only its concrete authored reward.
Canonical materialization
publishes the final shared store on the batch and records the resolved
`{ storeKey, reward }` offer for every rewarding target,
including fixed producers whose resolved store still contributes to later
entered-room store-ratio history. A target with no producer and no resolved
store emits no reward offer.

No supported F/G room currently uses `IndividualRewardStore`; the normalized
field is added only when a supported declaration needs it. The verified
two-pass rule remains the semantic target.

## Same-Batch Bag and Source Rules

Counted bag consumption occurs when an offer is generated, including unpicked
targets. `allowDuplicates` belongs to each store entry and defaults to false.
RunProgress Boon entries allow duplicate reward types; ordinary non-Boon Run
entries and MetaProgress entries do not. A bag refills only when it has no
eligible entry at all.

Repeated Boon reward types are separate from source selection. Within one door
batch, ordinary Boon source choices exclude sources already offered by earlier
peers. The cap check counts the union of acquired sources and those earlier peer
sources. Once that union reaches four, the primary pool narrows to acquired
sources before peer exclusions are applied. Unpicked sources therefore affect
the cap and exclusion while remaining absent from acquisition history. If peer
exclusions empty the primary pool, game setup retries with weaker exclusions
and finally no exclusions; the unrestricted retry recomputes support without
the peer set. Source uniqueness is strict only while the primary pool remains
nonempty. These are the `ordinaryBoonPeer` rules. Devotion instead uses
`devotionAcquiredPair`: its two distinct sources must already be present in
current-run ordinary god-loot history at offer generation, and the authored
chosen/spurned order records which member is acquired before and after combat.

## F/G Producer Mapping

The first implementation slice uses these verified bindings:

| Producer                      | Kind    | Domain/profile or fixed reward | Forced store | Eligible | Ineligible                                          |
| ----------------------------- | ------- | ------------------------------ | ------------ | -------- | --------------------------------------------------- |
| `F_Opening01..03`             | counted | RunProgress                    | RunProgress  | --       | Devotion, RoomMoneyDrop, MaxHealthDrop, MaxManaDrop |
| `F_Combat01`                  | counted | RunProgress                    | RunProgress  | --       | Devotion                                            |
| `F_Combat02..22`              | counted | RunProgress, MetaProgress      | --           | --       | --                                                  |
| `F_MiniBoss01..03`            | counted | RunProgress                    | RunProgress  | Boon     | --                                                  |
| `F_Reprieve01`                | counted | RunProgress, MetaProgress      | --           | --       | Devotion                                            |
| `F_Story01`                   | fixed   | Story                          | --           | --       | --                                                  |
| `F_Shop01`                    | shop    | WorldShop                      | --           | --       | --                                                  |
| free entry of `F_PreBoss01`   | counted | RunProgress                    | RunProgress  | --       | Devotion, RoomMoneyDrop                             |
| shop entry of `F_PreBoss01`   | shop    | WorldShop                      | RunProgress  | --       | --                                                  |
| `G_Intro`                     | none    | --                             | --           | --       | --                                                  |
| `G_Combat04/05/07/08`         | counted | RunProgress, MetaProgress      | --           | --       | Devotion                                            |
| other `G_Combat01..20`        | counted | RunProgress, MetaProgress      | --           | --       | --                                                  |
| `G_MiniBoss01..03`            | counted | RunProgress                    | RunProgress  | Boon     | --                                                  |
| `G_Reprieve01`                | counted | RunProgress, MetaProgress      | --           | --       | Devotion                                            |
| `G_Story01`                   | fixed   | Story                          | --           | --       | --                                                  |
| `G_Shop01`                    | shop    | WorldShop                      | --           | --       | --                                                  |
| free entries of `G_PreBoss01` | counted | RunProgress                    | RunProgress  | --       | Devotion, RoomMoneyDrop                             |
| shop entry of `G_PreBoss01`   | shop    | WorldShop                      | RunProgress  | --       | --                                                  |

The target Room Declaration embeds the applicable producer binding and forced
store override. Template code does not switch on room name or biome to
reconstruct either fact.

## Validation Boundaries

Catalog construction validates declaration references, static filters,
defaults, and producer/template compatibility. Authored commands validate
complete replacement values. Simulation validates:

- current bag availability and refill;
- alternative latent bag states when one offer can consume different entries;
- entry requirements at the offer point;
- authored base-store support or source-offer-point resolution from the biome
  policy;
- shared generated-door store resolution;
- same-batch duplicate and Boon-source rules;
- source-support policy and resolution-point membership;
- generic offer history, Devotion's offer-time spacing projection, acquisition
  timing, and room-lifecycle placement relative to outgoing generation;
- shop purchases;
- shop group cardinality, without-replacement support, and option requirements;
- peer and biome constraints;
- reward-type acquisition-role resolution, producer timing, and the closed
  history projections selected independently from loot/consumable/resource
  acquisition kind.

The current canonical reward model uses one global bounded approximation for
the game's `UpgradableTraitCount`: every acquired ordinary Boon contributes one
upgradeable trait. Concrete boon selection, replacement, and trait inventory
are unavailable until the project models trait state explicitly. NPC benefit
choices such as Narcissus do not contribute while their internal gift surface
is deferred. This approximation must be replaced by resolved trait state when
that future surface is introduced; it is not a generic unsupported state or
permissive fallback.

The same trait-free boundary fixes `allSpellInvested` to false after Spell is
acquired, allowing later Talent offers whenever their other exact requirements
hold. `pendingSpellDrop` remains false because the separate Surface Shop
delivery system is not part of the canonical trace. Both facts must move to
concrete Hex/Talent and delivery state if those deferred features are added.

The editor only renders normalized domains and simulation results. It does not
recompute reward legality.

## Biome-Owned Reward Structures

`../biomes/H_GAME_RULES.md`, `../biomes/O_GAME_RULES.md`, `../biomes/I_GAME_RULES.md`, and
`../biomes/N_GAME_RULES.md` are the authorities for cages, wheels, derived
Goal/NonGoal realizations, and persistent hub/side-room rewards. All four are
implemented through their active biome product loops; their biome-specific
rules remain outside this shared reward authority.
