# Run-Impacting Trait Effects Game-Data Audit

## Status and scope

This is a source audit for seven trait identities. The source facts below remain
authoritative; the Planner now reproduces the bounded effects described here:

- Natural Selection (`GoodStuffBoon`);
- Queen's Ransom (`SuperSacrificeBoonHera`);
- King's Ransom (`SuperSacrificeBoonZeus`);
- Steady Growth (`BoonGrowthBoon`);
- Sea Star (`DoubleRewardBoon`);
- the bounded Buried Treasure (`RoomRewardBonusBoon`) contact needed to assess
  Artificer and Sea Star interaction; and
- the bounded Quick Buck (`MoneyMultiplierBoon`) generated-pickup contact.

The evidence was checked on 2026-08-23 against Steam content build `24556151`.
Primary sources are:

- `TraitData_Duo.lua`, `TraitData_Demeter.lua`, `TraitData_Hermes.lua`, and
  `TraitData_Poseidon.lua`;
- `TraitLogic.lua`, especially `DistributeLevels`, `SacrificeAllBoon`,
  `CheckChamberTraits`, and `AddRarityToTraits`;
- `RoomLogic.lua`, especially `EndEncounterEffects`, `CreateLoot`, and
  `GiveRandomConsumables`;
- `UpgradeChoiceLogic.lua` and `InteractLogic.lua`, which own Sea Star's loot
  and consumable branches;
- `GiftLogic.lua`, which owns Artificer replacement; and
- `LootData.lua`, `LootData_Apollo.lua`, `LootData_Hera.lua`,
  `LootData_Zeus.lua`, and `ConsumableData.lua`.

This audit records source behavior, current Planner coverage, bounded
uncertainties, and the intended semantic disposition. It does not define
authored schemas, commands, UI controls, delivery gates, or an implementation
sequence.

## Summary

| Trait             | Source-owned run effect                                                                                          | Random result that matters                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Natural Selection | distributes eight levels across eligible core-slot traits                                                        | one initial shuffled order, which determines the legal allocation    |
| Queen's Ransom    | removes every Zeus-indexed trait identity and gives every eligible Hera-indexed trait `4 x removed count` levels | none                                                                 |
| King's Ransom     | removes every Hera-indexed trait identity and gives every eligible Zeus-indexed trait `4 x removed count` levels | none                                                                 |
| Steady Growth     | after a rarity-dependent number of qualifying encounter-end effects, raises one eligible trait by one rarity     | the selected rarity target                                           |
| Sea Star          | may preserve or recreate one exact eligible reward for a second acquisition                                      | duplicate or no duplicate at each eligible pickup                    |
| Buried Treasure   | immediately spawns a fixed normally optional pickup set                                                          | no Artificer-eligible result; later pickup interactions still matter |
| Quick Buck        | immediately spawns one normally optional `RoomMoneyDrop`                                                         | no acquisition-time randomness                                       |

## Natural Selection

### Eligible traits

Natural Selection's declaration calls `DistributeLevels` with exactly five
slots:

- `Melee` (Attack);
- `Secondary` (Special);
- `Ranged` (Cast);
- `Rush` (Sprint); and
- `Mana` (Magick).

Only currently filled slots enter the distribution. Spell, passive traits,
Duos without one of those slots, keepsakes, and other non-slotted traits are
not targets.

The offer requirement uses the same five-slot family and requires at least one
slotted trait for which another stack changes an extracted value. A filled but
already saturated slot does not by itself make Natural Selection offerable.

### Distribution algorithm

`DistributeLevels` does not select eight independent random targets. It:

1. collects the currently filled eligible slots;
2. shuffles that list once with `FYShuffle`;
3. traverses the shuffled list in repeated round-robin passes;
4. gives one level to each still-effective trait in a pass; and
5. removes a saturated trait from later passes when its next stack would no
   longer change any extracted value.

The process stops after eight successful level increases or when no effective
target remains.

For five unsaturated core traits, the final allocation is therefore
`2/2/2/1/1`, with the initial shuffled order deciding which three receive the
second level. If only one trait is eligible, it can receive all eight. If a
trait saturates during the operation, later passes redistribute the remaining
levels among the surviving targets.

### Planner disposition

Natural Selection is represented by one authored legal source distribution from
the acquisition frontier: the ordered successful allocation and its resulting
level changes. It is not eight unconstrained Pom choices. Existing trait level
history owns the settled mutations; no separate permanent Natural Selection
state remains after acquisition.

## Queen's Ransom and King's Ransom

### Direction

The two traits call the same `SacrificeAllBoon` function with opposite
arguments:

| Trait          | Removed provider index | Buffed provider index | Levels per removed identity |
| -------------- | ---------------------- | --------------------- | --------------------------: |
| Queen's Ransom | Zeus                   | Hera                  |                           4 |
| King's Ransom  | Hera                   | Zeus                  |                           4 |

### Provider membership, not acquisition origin

`SacrificeAllBoon` attributes a trait through `GetAllLootSourceNames`. That
function checks the trait's membership in each provider's runtime
`TraitIndex`. It does not inspect which provider actually presented or granted
the selected trait.

This resolves the Duo edge case. `ApolloSecondStageCastBoon`, for example, is
indexed by both Apollo and Zeus. Queen's Ransom removes it because it belongs
to Zeus's trait index even when the acquired copy came from an Apollo offer.
Acquisition origin does not protect it.

The two Ransom traits themselves are indexed by their buffing provider:
Queen's Ransom by Hera and King's Ransom by Zeus. They are therefore not in
their own removed-provider set.

### Removal and level gain

The source operation:

1. scans the current Hero trait list;
2. keeps distinct trait identities that are god/shop traits, have known trait
   data, and carry a rarity;
3. counts and removes every distinct identity indexed by the removed provider;
4. computes `totalLevels = 4 x removed identity count`; and
5. grants that full `totalLevels` amount to every current trait indexed by the
   buffing provider that does not block stacking.

The level amount is not divided among the buffed traits. If three Zeus-indexed
identities are removed by Queen's Ransom, each eligible Hera-indexed trait
receives twelve levels.

Most Duo traits block stacking. They can be removed because the removal path
does not require stackability, but they normally cannot receive the level
gain. The effect uses distinct identities rather than summing duplicate trait
instances.

`RemoveWeaponTrait` removes every current instance of the named trait and runs
the normal trait-removal path, including recalculation of active trait state.
It does not erase provider encounter history, loot-use history, or the past
acquisition record. The distinction is current equipped state versus
historical run facts.

### Planner disposition

Both Ransoms are deterministic transforms of the exact current trait frontier
at acquisition. The Planner derives the removed set from declaration provider
membership, not from acquisition origin, then applies ordinary trait removal
semantics and the resulting `4 x N` level increase to every eligible
buff-provider trait. No additional random authored result is persisted.

Trait removal is the material new history operation. Removal must preserve the
past acquisition/provider evidence while changing the current equipped trait
state, matching the game's distinction.

That preserved history also owns the source `BlockOfferIfPreviouslyPicked`
guard. Bridal Glow, Buried Treasure, and Cherished Heirloom cannot be offered
again after an earlier selection even if a Ransom later removes the equipped
trait; ordinary removed traits remain eligible under their other current
requirements.

## Steady Growth

### Rarity-dependent interval

Steady Growth starts with `CurrentRoom = 0`. Its `RoomsPerUpgrade` base is six
and its rarity multipliers produce these exact intervals:

| Steady Growth rarity | Qualifying end effects per upgrade |
| -------------------- | ---------------------------------: |
| Common               |                                  6 |
| Rare                 |                                  5 |
| Epic                 |                                  4 |
| Heroic               |                                  3 |

If Steady Growth itself changes rarity, `CreditAccumulatedTime` adjusts its
retained progress for the new interval rather than blindly restarting it.

### Clock seam

The counter advances through `CheckChamberTraits`, called by
`EndEncounterEffects` when the current room does not set
`SkipRoomsPerUpgrade`. It is therefore tied to qualifying encounter-end-effect
checkpoints, not room entry, biome depth, or a generic room-exit count.

Consequences include:

- noncombat and explicitly skipped encounter-end effects do not advance it;
- separate qualifying encounters in a multi-encounter room can advance it
  separately;
- N subrooms carrying `SkipRoomsPerUpgrade = true` do not advance it; and
- acquisition timing matters: only later qualifying end effects can advance a
  newly acquired copy.

The Planner already distinguishes `encounterCompleted` from the later
`encounterEndEffectsApplied` event. Steady Growth belongs to the latter seam.

### Upgrade target

At the threshold, the counter resets and `AddRarityToTraits` selects one random
eligible current trait. An eligible target must:

- be a god/shop trait with known trait data and a current rarity;
- not set `BlockInRunRarify`;
- declare the next rarity; and
- satisfy the exact Hephaestus cooldown exception when applicable.

When more than one target exists, Steady Growth removes itself from its own
candidate pool through `LowPriorityTraitName`. It may upgrade itself only when
it is the sole eligible target. If no eligible target exists at the threshold,
no rarity change occurs.

This is an automatic random result. The game does not present an optional
pickup or player choice at the threshold.

### Planner disposition

Steady Growth retains interval progress in derived trait history and advances
at qualifying encounter-end-effect checkpoints. At each threshold, the
selected eligible rarity target is the authored random outcome; applying that
result is forced and automatic. Existing rarity replacement semantics own the
actual Common-to-Rare, Rare-to-Epic, or Epic-to-Heroic change.

## Sea Star

### Exact eligibility

Sea Star's chance is `0.25` at Common, `0.30` at Rare, `0.35` at Epic, and
`0.40` at Heroic, before the run's `LuckMultiplier` is applied.

The duplication predicate is the concrete object's normalized
`CanDuplicate` flag. “Any non-boon and non-Hammer reward” is only an
approximation and is not safe as Planner policy.

Important examples are:

- ordinary Olympian loot does not declare `CanDuplicate` and is not a direct
  Sea Star target;
- `WeaponUpgrade` does not declare it and is not a target;
- `StackUpgrade` (Pom) explicitly sets it to true;
- `BaseConsumable` defaults it to true, so many money, health, magick,
  resource, and Talent pickups inherit eligibility; and
- specific declarations override it to false, including `HealDropMinor`,
  `BloodDrop`, `ManaDropMinor`, `RandomLoot`, `BoostedRandomLoot`, and
  `BlindBoxLoot`.

The supported reward catalog therefore needs exact declaration-owned
duplication facts rather than a broad category test.

### Consumable branch: reuse the same object

`UseConsumableItem` rolls Sea Star before destroying the consumed object. On
success it:

- applies the first normal pickup effect;
- leaves the same world object usable and visible;
- leaves its required-object membership unchanged; and
- sets that object's `CanDuplicate` to false.

The second pickup is therefore the same concrete reward identity, not a cloned
object. A required parent remains required; an optional parent remains
optional. Because `CanDuplicate` is cleared, the second pickup cannot trigger
Sea Star recursively.

Other exact object capabilities remain available until another interaction
changes or consumes the object. A Sea-Star-retained pickup may therefore be
used normally once and then converted with Time Piece or Artificer if that
exact declaration carries the corresponding conversion flag and the run has
capacity. Those conversion capabilities are independent of `CanDuplicate`.

Choosing Time Piece or Artificer before normal pickup does not also roll Sea
Star: those handlers destroy or replace the source instead of calling the
normal consumable-use branch.

Artificer does not preserve optional participation. Its ordinary replacement
producer creates a required Run Progress reward, even when the transformed
source was optional. It carries forward the source's `CanDuplicate` value only
when the generated replacement is itself duplication-capable. A
duplication-capable source converted into a compatible replacement can
consequently roll Sea Star when that replacement is later picked up; a
non-duplicable source cannot gain Sea Star eligibility merely by conversion.
If Sea Star already retained the source, that same instance has
`CanDuplicate = false`, so a later Artificer replacement cannot regain the
eligibility.

### Loot branch: create a fresh required object

Loot choice screens use a different path. When a duplicable loot object such
as a Pom succeeds, the first choice is resolved and the game creates a fresh
loot object of the same game name at the old location. The new object:

- is inserted as a required room object;
- receives freshly generated choice/context data;
- has `CanDuplicate = false`; and
- does not inherit the source object's price, shop status, generated options,
  rarity context, stack payload, or `DoesNotBlockExit` state.

The Sea Star call supplies no `DoesNotBlockExit` override, so this fresh Pom is
unconditionally required. A required source Pom therefore remains required,
while an optional free source Pom produces a fresh required second Pom.

Shop purchases do not enter this branch. `FillInShopOptions` represents a shop
Pom as a consumable store option, and `SpawnStoreItemInWorld` explicitly sets
the spawned store object's `CanDuplicate` to false (`StoreLogic.lua`, the
`itemData.Type == "Consumable"` branch). This is an instance override of the
Pom declaration's base `CanDuplicate = true`: purchases cannot trigger Sea
Star, including purchased Poms.

This second object also cannot recursively trigger Sea Star. It can still use
capabilities owned by its fresh declaration; for example, a fresh Pom remains
Time Piece eligible.

### Consequences for reward and provider history

Sea Star can produce a second acquisition of the same eligible consumable or
a new acquisition from freshly generated loot. Each acquisition must pass
through the ordinary semantics for that exact object. This can change money,
max-health, max-magick, resource, Talent, Pom, Echo-last-reward, and other
modeled histories.

Sea Star does not directly duplicate ordinary Olympian loot. It can still lead
to an additional god acquisition indirectly when a retained or recreated
reward is transformed by an existing mechanism such as Artificer. That later
god acquisition belongs to the conversion result, not to a fictional
god-boon duplication rule.

### Planner disposition

Each eligible pickup needs an explicit duplicate-or-not random result at its
normal acquisition point. A successful result must then follow the correct
source branch:

- consumables retain the same participation and exact object capabilities for
  one further interaction; or
- loot creates a fresh required object from declaration defaults.

In both branches the duplicate is marked ineligible for another Sea Star roll.
The Planner should not flatten these into a generic copied reward because
their participation, payload, option generation, and later conversion behavior
differ.

## Buried Treasure boundary

Buried Treasure immediately calls `GiveRandomConsumables` with
`NotRequiredPickup = true`. Its exact set is:

- one `RoomMoneySmallDrop`;
- two `RoomMoneyTinyDrop` objects;
- two `HealDropMinor` objects; and
- one `MetaCurrencyDrop` outside Story rooms.

These are normally optional room objects. `GiveRandomConsumables` has a narrow
Dream Run exception that makes them required when the current room explicitly
permits a Dream reward.

The producer is started after the trait has been inserted into the run and
waits `0.5` seconds before creating the objects in the declaration order above.
A future teleporting-room model must therefore be able to end the room before
these delayed pickups materialize. This audit does not add Dream Dive or
teleport-room state to the current Planner.

The Meta Currency entry explicitly overrides `MetaConversionEligible` to
false, and `GiveRandomConsumables` applies that override to the spawned
object. The money and minor-heal entries do not carry Artificer eligibility.
No immediate Buried Treasure pickup is therefore an Artificer candidate.

The exact supported capability matrix is:

| Generated pickup               | Count | Sea Star | Echo last reward | Time Piece | Artificer |
| ------------------------------ | ----: | -------- | ---------------- | ---------- | --------- |
| `RoomMoneySmallDrop`           |     1 | yes      | yes              | no         | no        |
| `RoomMoneyTinyDrop`            |     2 | yes      | no               | no         | no        |
| `HealDropMinor`                |     2 | no       | no               | no         | no        |
| conditional `MetaCurrencyDrop` |     1 | yes      | yes              | yes        | no        |

Like other run-progress `MetaCurrencyDrop` objects, the Buried Treasure Bones
can add Max Magick when the corresponding external World Upgrade is active.
This is not a Buried-specific producer effect. The Planner treats that numeric
Magick amount as simulation-neutral, so the generated pickup reuses ordinary
Bones history without adding a profile-progression input or Max-Magick ledger.

Buried Treasure also multiplies later Money, Ashes, Psyche, and Bones amounts.
Those numeric resource quantities are outside the current simulation, so this
ongoing multiplier remains recorded trait history without another run-state
ledger. It does not change the generated-pickup chronology above.

These contacts mean the trait is not effectless:

- eligible money and Meta Currency objects can interact with Sea Star;
- eligible pickups can affect Echo's last-reward state;
- the Meta Currency entry can interact with the run-progress max-Magick
  upgrade; and
- all of the generated objects are normally optional pickups whose acquisition
  order can matter.

The bounded Planner disposition is to model Buried Treasure through the shared
optional generated-pickup chronology. Its lack of Artificer candidates is
settled and should not create a placeholder Artificer action.

## Quick Buck boundary

Quick Buck calls the same `GiveRandomConsumables` producer on acquisition. It
uses `NotRequiredPickup = true` and creates exactly one `RoomMoneyDrop` after a
`0.2`-second delay. The same narrow Dream Run required-object exception
described for Buried Treasure applies, as does the future teleport-before-spawn
boundary.

The generated money object is:

- `CanDuplicate = true`, so Sea Star may preserve it for a second normal use;
- `LastRewardEligible = true`, so collecting it can replace Echo's Reward
  Reward Reward source; and
- not Artificer- or Time-Piece-eligible under its own declaration.

Quick Buck also increases later money gains, but the Planner does not currently
simulate carried-money arithmetic. The immediate pickup still has a supported
Echo-history consequence, and its Sea Star result can create another such
pickup interaction.

The bounded Planner disposition models Quick Buck through the shared optional
generated-pickup chronology. Its eligible money pickup participates in the
same Sea Star and Echo-last-reward acquisition path rather than adding an
isolated Quick Buck action. The Dream Dive boss teleport edge remains recorded by
[Room Action Order](ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md).

## Current Planner boundary

The catalog declares all seven trait identities and their offer requirements,
and ordinary selected-trait history records their acquisition. The Planner
also owns reusable primitives for trait levels, rarity replacement, provider
membership, encounter-end-effect events, Artificer, Time Piece, and required
versus optional room actions.

The run-impacting trait delivery now reproduces the three implemented effects
in this audit: Natural Selection, the two Ransoms, and Steady Growth. Natural
Selection persists one legal ordered allocation and folds its
level mutations; Ransoms derive current provider-indexed removals and the
`4 x removedCount` level gain; and Steady Growth derives its acquisition-
identity clock from qualifying `encounterEndEffectsApplied` checkpoints and
settles one authored rarity target at each reached threshold. The three
declaration-owned `BlockOfferIfPreviouslyPicked` traits retain selected-offer
history after removal, matching the source guard without adding a mutable
picked ledger. The shared Hephaestus rarity/level limits are declaration facts
consumed by Pom-derived and in-run rarity-target paths, while Proper Upbringing
keeps its source-specific Common-to-Rare behavior.

Sea Star publishes one authored duplicate-or-not result only at an eligible
normal free acquisition frontier. A retained consumable/resource duplicate is
one more acquisition of the same object with its exact producer lifecycle
capabilities; a full-Pom loot duplicate is a fresh required RoomReward Pom
with fresh unresolved detail. Neither duplicate may recurse. Direct Shop
purchases are atomic paid instances and cannot expose Time Piece, Artificer,
or Sea Star, while a free generated acquisition-entry pickup in a Shop room
remains a pickup. Buried Treasure and Quick Buck use the shared generated-
pickup optional-acquisition path; their exact Artificer and Sea Star boundaries
are retained above. All Narcissus traits now enter equipped history normally;
their shared generated-pickup entries retain their existing source contacts.

## Bounded follow-up questions

The core source rules above are settled. A later implementation audit should
close these contact matrices without changing the model:

- attest Natural Selection allocations when a target saturates during a
  multi-pass distribution;
- verify current-trait removal contacts for every already-modeled effectful
  trait that may be removed by a Ransom; and
- revisit the Dream-required and teleport-before-delayed-spawn behavior when a
  future Dream Dive model adds the necessary room facts; and
- add newly supported acquisition identities to the closed duplication and
  conversion-capability declaration audit before exposing them to Sea Star.

These are declaration and consumer-coverage questions, not reasons to add a
generic reward-copy abstraction or a generic trait-effect language.
