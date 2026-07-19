# Reward Model

## Purpose

This document defines the concrete reward vocabulary shared by catalog
declarations, authored room state, simulation, and the editor. It carries the
verified reward hierarchy forward without carrying the old Lib control or
storage implementation.

`CATALOG_MODEL.md` owns declaration normalization. This document owns what the
reward declaration kinds mean and how they compose. `SIMULATION_AND_VALIDATION.md`
owns lifecycle evaluation, counted-bag mutation, and legality.

## Cross-Biome Freeze Status

Possibility-only evaluation is locked. The generated-batch base-store and
concrete-only leaf split described below is the globally frozen
F/G/P/Q/H/O/I/N contract. N confirms that one persistent heterogeneous board
can use `none` while every target resolves declaration-owned provenance.
Production remains on the prior schema until the version 2 authority switch is
implemented atomically.

## Composition

Rewards compose bottom-up:

```text
payload domain
  -> reward primitive
      -> counted store and bag declaration
          -> concrete producer binding and filters
              -> authored concrete reward leaf

biome store-selection policy
  -> authored, source-offer-derived, or absent generated-batch base store
      -> room forced/individual override
          -> resolved target store

resolved target store + authored concrete reward leaf
  -> canonical counted offer
      -> room template or encounter offer point

reward primitive
  -> shop option set
      -> shop profile
          -> picked occurrence's authored shop state
```

Counted rewards and shops share primitives but are separate producer branches.
A shop is not a counted bag with different presentation.

## Identity and Labels

Every primitive keeps three concepts separate:

```ts
interface RewardPrimitive {
  gameName: RewardGameName;
  label: string;
  acquisition: AcquisitionProjection;
  payloadDomain?: PayloadDomainKey;
  defaultPayload?: RewardPayload;
}

type AcquisitionProjection =
  | { kind: 'primitive'; gameName: RewardGameName }
  | { kind: 'payloadSource' }
  | { kind: 'payloadSources' };
```

- `gameName` is the canonical authored and game-translation identity.
- `label` is presentation-only and must be explicit.
- `acquisition` declares exactly what is folded into acquisition history.

For example, a Boon offer carries a source payload and projects that concrete
source, such as `ApolloUpgrade`, into loot history. A payload-free reward may
project a fixed primitive identity. The simulator does not switch on reward
names to reconstruct this behavior. The editor renders labels such as `Ares`;
it never derives them by trimming identifiers such as `AresUpgrade`.

Labels need only be unambiguous inside one rendered option domain. Changing a
label does not migrate authored state.

## Payload Domains

A payload domain owns the shape and local validity of one primitive payload.
The initial domains are:

| Domain         | Value                 | Local rule                                   |
| -------------- | --------------------- | -------------------------------------------- |
| `BoonSource`   | one source game name  | source belongs to the declared source domain |
| `DevotionPair` | two source game names | both sources belong and are distinct         |

Payload domains do not know rooms, bags, topology, history, or UI widgets.
Every payload-bearing primitive declares a complete payload default.

Defaults therefore recurse to a terminating value:

```text
RunProgress default -> Boon
Boon default -> ApolloUpgrade
ApolloUpgrade -> no payload
```

An active payload is never empty. Replacing a primitive installs that
primitive's complete payload default atomically.

## Reward Primitives

A primitive is one concrete reward kind plus optional payload:

```ts
type ConcreteReward =
  | { rewardType: 'MaxHealthDrop' }
  | {
      rewardType: 'Boon';
      payload: { source: 'ApolloUpgrade' };
    }
  | {
      rewardType: 'Devotion';
      payload: { sources: ['ApolloUpgrade', 'ZeusUpgrade'] };
    };
```

Fixed primitives may have payloads. A forced Devotion still needs its authored
pair even though it does not come from a counted bag. Payload-free fixed facts
such as `Story` need no authored leaf state.

## Counted Stores and Bags

A counted store declaration owns:

- a stable `storeKey` such as `RunProgress` or `MetaProgress`;
- the ordered game bag entries, including multiplicity;
- entry-level current-run requirements;
- entry-level `allowDuplicates`, defaulting to `false`;
- refill behavior;
- one explicit default primitive for authoring.

The catalog exposes an immutable option domain from that declaration. The
simulator creates a mutable scratch bag for one route simulation. Exact store
provenance is resolved by the owning generated batch or fixed producer and is
carried by canonical offers. A counted room leaf authors only its concrete
reward; it is not a second store authority.

Repeated bag entries do not duplicate editor options. Their multiplicity and
requirements remain available to simulation. When several compatible entries
could produce one authored value, the declaration owns deterministic match
order.

## Producer Bindings

A concrete producer embeds its complete binding:

```ts
interface CountedChoiceBinding {
  kind: 'countedChoice';
  storeKeys: readonly RewardStoreKey[];
  eligibleRewardTypes: readonly RewardGameName[];
  ineligibleRewardTypes: readonly RewardGameName[];
}
```

The effective static domain is:

```text
union of referenced store members
intersect eligibleRewardTypes when non-empty
subtract ineligibleRewardTypes
```

Filters apply to reward primitive names, not Boon source names. Positive and
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
policy; a target reward default comes from its currently resolved store and
binding filters.

## Producer Kinds

The initial semantic producer kinds are:

`none`
: Produces no modeled reward and owns no reward state.

`fixed`
: Produces one declared primitive. It authors only that primitive's payload,
when present.

`countedChoice`
: Authors one concrete reward from the store resolved at its offer point.

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
ledger effect does not require boss reward primitives, leaf state, bag
depletion, acquisition history, or editor controls.

Biome-specific slices add structural composition around these primitives:

- `localSlots` for verified H cages and N side rooms;
- a derived incoming realization for the I Goal/NonGoal branch;
- `offerPoint` for O encounter wheels.

Those wrappers coordinate bounded local children. They do not redefine bags,
primitives, payloads, or peer/history validation.

### H Fields Cage Composition

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

Every combat occurrence owns one complete potential concrete reward from
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
`biomes/I_GAME_RULES.md` owns the exact batch ordering and
conditional-terminal lifecycle.

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
slot's complete dormant leaf is retained when its generation state is
`notGenerated` or its parent hub target is unvisited.

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
`biomes/N_GAME_RULES.md` owns the concrete bags, room filters, local-slot topology,
and lifecycle order.

## Authored and Resolved Counted Values

A counted room leaf authors one complete reward atom:

```ts
type AuthoredCountedReward = ConcreteReward;
```

Canonical materialization combines it with the store resolved by the owning
offer point:

```ts
interface ResolvedCountedReward {
  storeKey: RewardStoreKey;
  reward: ConcreteReward;
}
```

Changing an authored generated-batch base store retains its target rewards.
Changing a source-offer-point store likewise retains the outgoing batch and
target rewards. The next simulation may report a retained reward as unavailable
from its newly resolved store; it does not silently replace authored intent.
Changing a reward installs the selected primitive's declared payload default.

The editor may retain inactive bounded state inside a later structural wrapper,
but every active counted choice is concrete and complete.

## Shops

Shops are assembled from primitives through option sets and profiles:

```text
primitive -> option set -> stable shop slot -> shop profile
```

A slot owns a stable semantic key, presentation label, allowed primitives, and
one explicit default. Its authored value is:

```ts
interface ShopOfferState {
  reward: ConcreteReward;
  purchased: boolean;
}
```

`purchased: false` is complete authored state. Purchase controls acquisition,
not whether the offer exists. The ordinary `WorldShop` has three stable slots
whose current labels are `Offer 1`, `Offer 2`, and `Offer 3`; internal slot keys
may remain category-bearing without leaking into presentation.

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

## Offer and Acquisition

Offer and acquisition are separate facts:

```text
source generates incoming reward -> reward.offer
picked room enters              -> reward.acquire
picked shop room enters         -> shop reward.offer
purchased shop slot             -> reward.acquire
```

Every generated peer occurrence contributes its concrete incoming offer and
counted-bag consumption, including unpicked peers. Only the picked and entered
occurrence acquires its incoming reward. A shop exposes its concrete offers
only on entry and acquires exactly its purchased slots.

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

A reward-free generated batch such as Q's combat spine has no authored base
store. Forced or individual target stores remain declaration-owned and still
produce concrete offers, so Q miniboss targets can use `TyphonBossRewards`
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
records the resolved `{ storeKey, reward }` offer for every rewarding target,
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
peers. After the route reaches the ordinary four-source cap, later choices are
restricted to already acquired sources. Unpicked sources participate in the
same-batch exclusion but do not enter acquisition history. Devotion keeps a
distinct two-source payload and uses its own declared selection behavior.

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
- entry requirements at the offer point;
- authored base-store support or source-offer-point resolution from the biome
  policy;
- shared generated-door store resolution;
- same-batch duplicate and Boon-source rules;
- offer and acquisition timing;
- shop purchases;
- peer and biome constraints;
- declaration-owned acquisition projection.

The current canonical reward model uses one global bounded approximation for
the game's `UpgradableTraitCount`: every acquired ordinary Boon contributes one
upgradeable trait. Concrete boon selection, replacement, and trait inventory
are unavailable until the project models trait state explicitly. NPC benefit
choices such as Narcissus do not contribute while their internal gift surface
is deferred. This approximation must be replaced by resolved trait state when
that future surface is introduced; it is not a generic unsupported state or
permissive fallback.

The editor only renders normalized domains and simulation results. It does not
recompute reward legality.

## Documented Later Reward Structures

`biomes/H_GAME_RULES.md`, `biomes/O_GAME_RULES.md`, `biomes/I_GAME_RULES.md`, and
`biomes/N_GAME_RULES.md` are the authorities for cages, wheels, derived Goal/NonGoal
realizations, and persistent hub/side-room rewards. Those contracts remain
documentation-only until their dormant declaration and later activation
slices.
