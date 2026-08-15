# All Together and Shop Traits Game-Data Audit

## Status and scope

Source audit completed against the installed Hades II scripts on 2026-08-15.
This document records the game facts needed to reason about:

- Hera's Legendary `AllElementalBoon` (All Together);
- the later free reward enabled by `InfernalContractBoon`; and
- Hermes's `RestockBoon` (Travel Deal).

This is not an implementation plan. It does not prescribe a persisted shape,
simulation product, command, UI, delivery gate, file placement, or commit
sequence. It separates literal game chronology from bounded planner
abstractions so a later plan does not accidentally turn one into the other.

The existing contract-entry and automatic-return evidence remains owned by
`ROUTE_DETOUR_FINDINGS.md`. This audit begins with the trait awarded inside
`C_Boss01` and follows its later Shop consequence.

## Sources

Primary evidence:

- `TraitData_Hera.lua`: `AllElementalBoon` and its four `BoonSets`;
- `TraitLogic.lua`: `GrantBoons`, `AddTraitToHero`, and trait processing with
  no supplied rarity;
- `TraitData_Elementals.lua` and `TraitData.lua`: the eight granted Infusion
  declarations and `UnityTrait` inheritance;
- `LootData_Hera.lua`: Hera's offer pool;
- `TraitData_Hermes.lua`: `RestockBoon` and its rarity-scaled first-purchase
  discount;
- `StoreLogic.lua`: World Shop removal, first-purchase detection, physical-slot
  restocking, and Shop item registration;
- `SurfaceShopLogic.lua`: delayed Surface Shop purchase and expedited-delivery
  restock behavior;
- `InteractLogic.lua`: paid loot and consumable purchase contacts;
- `EventLogic.lua`: `AwardContractTrait` and `SpawnZagContractRewards`;
- `TraitData.lua`: `InfernalContractBoon`;
- `EncounterData_Boss.lua`: the contract-room award event;
- `EncounterSets.lua`: the Shop-room event sequence;
- `StoreData.lua`: `WorldShop`, `I_WorldShop`, `Q_WorldShop`, and
  `ZagPedestalOptions`; and
- `RoomDataF/G/H/I/N/O/P/Q.lua`: World Shop hosts and later contract-pedestal
  destinations.

The supported ordinary Shop matrices and their exact option requirements
remain owned by `REWARD_GAME_DATA_AUDIT.md`.

## All Together

### Outer trait

`AllElementalBoon` is a normal Hera Legendary. Its ordinary offer eligibility
is therefore the declaration-owned Hera Legendary prerequisite already recorded
in `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`. When acquired, the outer trait is
equipped normally and contributes one each of Aether, Earth, Air, Fire, and
Water.

Its acquisition callback is `GrantBoons`. The callback receives four ordered
source sets:

| Set   | First identity             | Second identity               |
| ----- | -------------------------- | ----------------------------- |
| Earth | `ElementalDamageBoon`      | `ElementalOlympianDamageBoon` |
| Fire  | `ElementalBaseDamageBoon`  | `ElementalRallyBoon`          |
| Air   | `ElementalDamageFloorBoon` | `ElementalDodgeBoon`          |
| Water | `ElementalHealthBoon`      | `ElementalDamageCapBoon`      |

These are four independent one-from-a-pair grants, not one four-option choice
and not four ordinary god offers.

### Per-set selection

For each set, `GrantBoons` constructs an eligible list from identities the hero
does not already own. It then chooses one eligible identity and directly calls
`AddTraitToHero`.

The resulting behavior is exact:

- neither identity owned: either member may be granted;
- exactly one identity owned: the other member is forced;
- both identities owned: that set grants nothing; and
- all four sets exhausted: All Together itself is still acquired, but the
  callback grants no child trait.

The callback does not call each child's ordinary `GameStateRequirements`.
Consequently the usual element threshold used to offer an Infusion does not
block the direct All Together grant.

There is one explicit additional acquisition requirement:
`ElementalOlympianDamageBoon` requires `AresFirstPickUp`. Under the planner's
fully progressed persistent baseline this fact is satisfied. It remains source
evidence rather than a run-history or element requirement.

### Rarity and provider history

The direct `AddTraitToHero` calls pass no rarity. `ProcessTraitData` sets a
trait's standard rarity only when a rarity argument is supplied, so these child
instances have no ordinary Common/Rare/Epic/Heroic rarity. Their inherited
`UnityTrait` presentation uses the custom Infusion frame and rarity name.

`FromLoot = true` affects trait application and presentation; it does not run a
god-loot pickup. The child grant therefore:

- adds the selected child directly to the hero as an equipped trait;
- contributes the child's normal gameplay and activation facts;
- does not increment the child's provider in `LootTypeHistory`; and
- does not add that provider to the ordinary god pool.

This is materially different from selecting the same Infusion from an
Olympian offer, where the containing loot source has its own history event.

### Grant chronology

The game loops over the four sets, directly adds each selected child, and calls
`CheckActivatedTraits` after the grant loop. Lua `pairs` does not define a
portable ordering guarantee for the four numeric set keys. No child choice
depends on a child granted by an earlier set, because the callback checks only
exact ownership plus the one persistent Ares requirement.

The source-significant result is therefore the complete set of zero to four
direct child grants. A later model need not invent a player-visible ordering
among those grants merely to reproduce the resulting equipped state.

## Infernal Contract's later reward

### Trait acquisition

`C_Boss01` awards `InfernalContractBoon` through `AwardContractTrait`, separately
from its forced `GemPointsBigDrop`. `AwardContractTrait` supplies no rarity.
The declaration has a Common-looking frame but no standard rarity table; the
frame is presentation, not a Common-rarity gameplay fact.

The trait remains equipped after leaving `C_Boss01`. Its later effect is not a
one-use charge and the source does not remove it after a pedestal reward.

### Qualifying destinations

`SpawnZagContractRewards` requires both:

1. the hero currently owns `InfernalContractBoon`; and
2. the current room declares `ZagContractRewardDestinationId`.

The live destination declarations are:

| Route | Qualifying room declaration(s) | Ordinary Shop profile at that destination |
| ----- | ------------------------------ | ----------------------------------------- |
| F     | `F_PreBoss01`                  | `WorldShop`                               |
| G     | `G_PreBoss01`                  | `WorldShop`                               |
| H     | `H_PreBoss01`                  | `WorldShop`                               |
| I     | `I_PreBoss01`, `I_PreBoss02`   | `I_WorldShop`                             |
| N     | `N_PreBoss01`                  | `WorldShop`                               |
| O     | `O_PreBoss01`                  | `WorldShop`                               |
| P     | `P_PreBoss01`                  | `WorldShop`                               |
| Q     | `Q_PreBoss01`                  | `Q_WorldShop`                             |

Only the reached qualifying declaration runs the event.

Every qualifying declaration also hosts the route's ordinary World Shop
profile. The contract item is nevertheless a separately generated physical
object in that room: it is not inserted into the Shop profile's `GroupsOf`
array or its ordinary spawned-item inventory. The two I declarations are
alternative Preboss maps that share the same `I_WorldShop` profile, not two
contract or Shop opportunities in one ordinary run.

### Pedestal pool

`ZagPedestalOptions` contains one weighted group that produces exactly one
option:

| Identity          | Source weight |
| ----------------- | ------------: |
| `BlindBoxLoot`    |           1.0 |
| `StackUpgradeBig` |           2.0 |
| `StackUpgrade`    |           1.0 |
| `TalentBigDrop`   |           2.0 |
| `TalentDrop`      |           1.0 |

Eligibility and payload resolution still follow the selected option's normal
declaration. The weights affect probability only; all eligible identities are
possibilities.

The spawned item is marked `ZagContractItem`, receives `CostOverride = 0`, and
then receives `IgnorePurchase = true`. Acquiring it therefore follows the
selected loot or consumable's normal acquisition behavior without spending
Gold or entering the ordinary Shop purchase-removal path.

### Inventory count abstraction

The ordinary profiles expose these initial option counts:

| Profile       | Ordinary options | Plus reached contract pedestal | Total opportunities |
| ------------- | ---------------: | -----------------------------: | ------------------: |
| `WorldShop`   |                3 |                              1 |                   4 |
| `I_WorldShop` |                5 |                              1 |                   6 |
| `Q_WorldShop` |                6 |                              1 |                   7 |

For planner discussion, calling this an extra free Shop slot is a bounded
abstraction over the biome's acquisition opportunities. The literal source
fact remains that the contract pedestal is separately produced at the reached
qualifying destination and is not another ordinary weighted Shop slot.

## Travel Deal

### Trait facts

`RestockBoon` is an ordinary Hermes trait. Its rarity levels scale
`FirstPurchaseDiscount` as follows:

| Rarity | Discount |
| ------ | -------: |
| Common |       5% |
| Rare   |      10% |
| Epic   |      15% |
| Heroic |      20% |

The discount is a real source effect. Gold totals, affordability, and numeric
prices remain outside the current planner baseline, but that simplification
must not erase the first-purchase state because the same trait value controls
restocking.

### Physical World Shop restock

For a normal world-spawned Shop item, `RemoveStoreItem`:

1. determines whether this is the room's first removed purchase;
2. removes the selected option from `StoreOptions`;
3. records `FirstPurchase = true`;
4. finds the purchased object's exact index and physical kit ID in
   `SpawnedStoreItems`; and
5. when Travel Deal was already equipped before that purchase, calls
   `RestockWorldItem` for that same index and kit ID.

`RestockWorldItem` regenerates the room's same `StoreDataName`, initially
excluding the purchased name and its `Drop` alias. If the same-index option is
not available under those exclusions, it retries the ordinary store without
them. The result replaces the purchased physical slot; it is not appended as a
new independent initial inventory slot.

Only the first qualifying normal purchase in that Shop triggers the refill.
Purchasing Travel Deal itself cannot retroactively trigger Travel Deal in the
same Shop because `wasFirstPurchase` and the trait check occur before the newly
selected Hermes trait is acquired.

The refill is a fresh declaration-owned Shop option. It is not a duplicate of
the purchased concrete payload, and its loot or Blind Box child state resolves
freshly through the normal selected option.

### Surface delivery path

The delayed Surface Shop path distinguishes an ordinary order from expedited
delivery:

- the first ordinary order applies the discount state but does not immediately
  replace the ordered screen slot; and
- the first expedited-delivery purchase with Travel Deal can regenerate the
  vacated Surface Shop slot from the same surface profile, with current names
  excluded before fallback.

Preboss `AutocompleteSurfaceShopDelivery` can later deliver pending purchases.
The current planner deliberately collapses Gold costs and delayed delivery into
the selected Shop acquisition. Treating the supported Travel Deal consequence
as one refill after the first modeled normal Shop purchase is therefore a
planner timing simplification, not a claim that the two source code paths are
literally identical.

### Well boundary

The same `FirstPurchaseDiscount` value also affects Wells of Charon. Their
purchase handler owns a separate first-purchase replacement path. Wells remain
outside the current supported planner product, so the World Shop facts above do
not silently activate Well inventory or Well purchases.

## Infernal Contract and Travel Deal interaction

The contract pedestal is deliberately outside the normal refill machinery:

- `SpawnStoreItemInWorld` does not add a `ZagContractItem` to
  `CurrentRoom.Store.SpawnedStoreItems`;
- loot with zero resource cost does not call `RemoveStoreItem`;
- contract consumables set `IgnorePurchase`, so their use also skips
  `RemoveStoreItem`; and
- `RestockWorldItem` requires the exact index and kit ID removed from the
  normal Shop's spawned inventory.

Therefore the contract pedestal:

- does not consume Travel Deal's first-purchase trigger;
- is not itself a Travel Deal refill target;
- does not supply the option pool used by a Travel Deal refill; and
- may still be acquired before or after normal purchases in the containing
  room chronology when both are physically present.

Ignoring Gold does not justify erasing the free-versus-normal provenance:
Travel Deal's trigger depends on that distinction.

## Locked source conclusions

- All Together grants zero to four direct rarityless Infusion children, one
  independently chosen from each declared pair.
- Those grants bypass ordinary Infusion offer thresholds, preserve exact
  ownership exhaustion, and do not add providers to god history.
- Infernal Contract is a persistent rarityless trait awarded separately from
  the contract room's forced resource.
- Every reached qualifying destination produces one free option from the exact
  five-entry pedestal pool; the trait is not consumed.
- The 4/6/7 opportunity counts are a truthful planner abstraction over ordinary
  Shop options plus the separately spawned pedestal.
- Travel Deal refills the exact first normal purchased slot from that Shop's
  ordinary profile and does so only when the trait was already equipped.
- The Infernal Contract pedestal neither triggers Travel Deal nor receives its
  refill.
- Surface delivery and Well behavior remain distinct source paths even where a
  bounded planner simplification presents a common first-purchase consequence.

## Remaining bounded questions

No game-rule probe is required for All Together's pair selection, the contract
pedestal pool, or the normal physical World Shop refill; all are explicit in
source.

Before a future scope includes Wells or exact Surface Shop delivery timing, it
must separately settle their inventory counts, expedited-delivery choices, and
room-local chronology. Those questions do not block a World-Shop-focused
model that explicitly retains the simplification above.
