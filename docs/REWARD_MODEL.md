# Reward Model

## Purpose

This document defines the concrete reward vocabulary shared by catalog
declarations, authored room state, simulation, and the editor. It carries the
verified reward hierarchy forward without carrying the old Lib control or
storage implementation.

`CATALOG_MODEL.md` owns declaration normalization. This document owns what the
reward declaration kinds mean and how they compose. `SIMULATION_AND_VALIDATION.md`
owns lifecycle evaluation, counted-bag mutation, and legality.

## Composition

Rewards compose bottom-up:

```text
payload domain
  -> reward primitive
      -> counted store and bag declaration
          -> concrete producer binding and filters
              -> authored reward value
                  -> room template or encounter offer point

reward primitive
  -> shop option set
      -> shop profile
          -> authored shop state
```

Counted rewards and shops share primitives but are separate producer branches.
A shop is not a counted bag with different presentation.

## Identity and Labels

Every primitive keeps three concepts separate:

```ts
interface RewardPrimitive {
  gameName: RewardGameName;
  label: string;
  acquiredAs: RewardGameName;
  payloadDomain?: PayloadDomainKey;
  defaultPayload?: RewardPayload;
}
```

- `gameName` is the canonical authored and game-translation identity.
- `label` is presentation-only and must be explicit.
- `acquiredAs` is the normalized identity folded into acquisition history.

For example, `RandomLoot` may carry a Boon-source payload while normalizing its
acquisition as `Boon`. The editor renders labels such as `Ares`; it never
derives them by trimming identifiers such as `AresUpgrade`.

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
- refill behavior;
- one explicit default primitive for authoring.

The catalog exposes an immutable option domain from that declaration. The
simulator creates a mutable scratch bag for one route simulation. Authored
values retain `storeKey` because exact bag provenance affects offer history,
entry requirements, and depletion.

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
  defaultStoreKey?: RewardStoreKey;
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

## Producer Kinds

The initial semantic producer kinds are:

`none`
: Produces no reward and owns no reward state.

`fixed`
: Produces one declared primitive. It authors only that primitive's payload,
when present.

`countedChoice`
: Authors one concrete store-tagged reward from a counted binding.

`shop`
: Authors a declared shop profile and purchase state. It does not carry a
counted `storeKey`.

Later biome slices may add structural composition around these primitives:

- `localSlots` for H cages and N side rooms;
- `incomingKind` for the I Goal/NonGoal branch;
- `offerPoint` for O encounter wheels.

Those wrappers coordinate bounded local children. They do not redefine bags,
primitives, payloads, or peer/history validation.

## Authored Counted Values

A counted choice is one tagged atom:

```ts
interface CountedRewardChoice {
  storeKey: RewardStoreKey;
  reward: ConcreteReward;
}
```

It is not a collection of dormant selections for every store. Changing the
store installs that store's declared default reward and complete payload.
Changing the reward installs the selected primitive's declared payload
default.

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

`WorldShop`, `I_WorldShop`, and `Q_WorldShop` are distinct profiles. Their
specific later-biome rules move with the corresponding implementation slice.

## Offer and Acquisition

Offer and acquisition are separate facts:

```text
source generates reward -> reward.offer
picked room enters       -> reward.acquire
purchased shop slot      -> reward.acquire
```

Every generated peer occurrence contributes its concrete incoming offer and
counted-bag consumption, including unpicked peers. Only the picked and entered
occurrence acquires its incoming reward. Shops acquire exactly the purchased
slots when their room is entered.

Fixed and forced producers do not borrow requirements from a same-named
counted bag entry. A forced Devotion is validated as a fixed Devotion producer,
not through `Devotion`'s `RunProgress` bag-entry requirements.

## Generated-Door Store Resolution

An ordinary generated-door batch has shared store context. The simulator
resolves it in physical door order:

1. begin from the source room's prepared default store;
2. scan targets and let each valid `ForcedRewardStore` replace the working
   batch default;
3. resolve each target using its `IndividualRewardStore`, otherwise its own
   valid `ForcedRewardStore`, otherwise the final working default.

Room occurrences own their concrete authored rewards. The batch materializer
owns this cross-target resolution and reports a finding when authored store
provenance disagrees with the resolved game context.

## F/G Producer Mapping

The first implementation slice uses these verified bindings:

| Producer                      | Kind    | Stores/profile or fixed reward | Eligible | Ineligible                                          |
| ----------------------------- | ------- | ------------------------------ | -------- | --------------------------------------------------- |
| `F_Opening01..03`             | counted | RunProgress                    | --       | Devotion, RoomMoneyDrop, MaxHealthDrop, MaxManaDrop |
| `F_Combat01`                  | counted | RunProgress                    | --       | Devotion                                            |
| `F_Combat02..22`              | counted | RunProgress, MetaProgress      | --       | --                                                  |
| `F_MiniBoss01..03`            | counted | RunProgress                    | Boon     | --                                                  |
| `F_Reprieve01`                | counted | RunProgress, MetaProgress      | --       | Devotion                                            |
| `F_Story01`                   | fixed   | Story                          | --       | --                                                  |
| `F_Shop01`                    | shop    | WorldShop                      | --       | --                                                  |
| free entry of `F_PreBoss01`   | counted | RunProgress                    | --       | Devotion, RoomMoneyDrop                             |
| shop entry of `F_PreBoss01`   | shop    | WorldShop                      | --       | --                                                  |
| `G_Intro`                     | none    | --                             | --       | --                                                  |
| `G_Combat04/05/07/08`         | counted | RunProgress, MetaProgress      | --       | Devotion                                            |
| other `G_Combat01..20`        | counted | RunProgress, MetaProgress      | --       | --                                                  |
| `G_MiniBoss01..03`            | counted | RunProgress                    | Boon     | --                                                  |
| `G_Reprieve01`                | counted | RunProgress, MetaProgress      | --       | Devotion                                            |
| `G_Story01`                   | fixed   | Story                          | --       | --                                                  |
| `G_Shop01`                    | shop    | WorldShop                      | --       | --                                                  |
| free entries of `G_PreBoss01` | counted | RunProgress                    | --       | Devotion, RoomMoneyDrop                             |
| shop entry of `G_PreBoss01`   | shop    | WorldShop                      | --       | --                                                  |

The source room declaration embeds the applicable binding. Template code does
not switch on room name or biome to reconstruct it.

## Validation Boundaries

Catalog construction validates declaration references, static filters,
defaults, and producer/template compatibility. Authored commands validate
complete replacement values. Simulation validates:

- current bag availability and refill;
- entry requirements at the offer point;
- shared generated-door store resolution;
- offer and acquisition timing;
- shop purchases;
- peer and biome constraints;
- acquisition normalization.

The editor only renders normalized domains and simulation results. It does not
recompute reward legality.

## Deferred Reward Structures

The old audits remain evidence for H cages, I Goal/NonGoal rewards, N side
rooms, O wheels, P filters, and Q stores/shops. Their exact contracts should be
translated when each biome becomes active rather than added now as dormant
production behavior.
