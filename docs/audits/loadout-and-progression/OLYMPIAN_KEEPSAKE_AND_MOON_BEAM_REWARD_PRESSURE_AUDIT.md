# Olympian Keepsake and Moon Beam Reward-Pressure Audit

## Status and scope

Source audit completed on 2026-08-26 against installed Steam build `24556151`.
This document is the primary evidence authority for:

- the nine Olympian keepsakes that prioritize `Boon` and force one provider;
- their provider-specific one-use rarification;
- Moon Beam's immediate Path of Stars points and exact reward priority;
- ordinary equip, postboss unequip, Cherished Heirloom reconstruction, and
  Gift Gift Gift replay contacts;
- reward-priority lifetime and counted-store consumption;
- provider selection and use consumption across ordinary rewards, Devotion,
  Fields rewards, shops, and direct loot creation; and
- deterministic planner treatment when more than one priority or provider
  force is active.

This is an implementation-free source audit. It does not choose persisted
schema, module placement, editor layout, delivery gates, or commit boundaries.
General keepsake selection remains owned by
[the keepsake audit](KEEPSAKE_GAME_DATA_AUDIT.md), Cherished reconstruction by
[the Cherished Heirloom audit](CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md), Gift
replay by [the Gift Gift Gift audit](ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md),
and ordinary counted-store behavior by
[the reward audit](../rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md).

## Sources

Primary evidence:

- `TraitData_Keepsake.lua`: `BaseBoonUpgradeKeepsake`, the nine
  `Force*BoonKeepsake` declarations, `SpellTalentKeepsake`,
  `PersistentKeepsakeKeys`, rank profiles, uses, and acquisition callbacks;
- `RewardLogic.lua`: `RewardStoreAddPriority`, `ChooseRoomReward`,
  `SetupRoomReward`, `IsRoomRewardEligible`, and `SpawnRoomReward`;
- `RoomLogic.lua`: `GiveLoot`, generated exit ordering, Fields reward cages,
  and optional Fields rewards;
- `KeepsakeLogic.lua`: `EquipKeepsake`, `UnequipKeepsake`, `AdvanceKeepsake`,
  `KeepsakeAcquireSpellDrop`, rack swaps, and Gift-rack equip behavior;
- `UpgradeChoiceLogic.lua`: provider-specific rarification precedence,
  successful-use decrement, and unslotted-source removal;
- `TraitLogic.lua`: `AddTraitData`, `ReduceTraitUses`, and active-use checks;
- `EncounterLogic.lua`: Devotion's initial two-loot materialization;
- `StoreLogic.lua`: ordinary Shop/Mystery Boon `BoughtFromShop` arguments and
  Blind Box unwrap ordering;
- `RunLogic.lua`: `CurrentRun.RewardPriorities` initialization,
  `GetInteractedGodsThisRun`, and loot-history membership;
- `LootData.lua`: `RunProgress`, `HubRewards`, `TartarusRewards`, and
  `TyphonBossRewards`; and
- `ConsumableData.lua`: the distinct `TalentDrop`, `TalentBigDrop`, and
  `MinorTalentDrop` declarations.

## Three independent effects

An Olympian keepsake does not create one indivisible "force this god" state.
The declaration and runtime split it into three independently consumed effects:

| Effect                | Source state                                                                           | Created by                                        | Consumed by                                                    |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| reward-type priority  | one `Boon` name in `CurrentRun.RewardPriorities`                                       | ordinary `FromLoot` equip or Gift replay          | generation of a matching eligible counted reward               |
| provider force        | `ForceBoonName` plus top-level `Uses = 1` on the keepsake trait                        | equipped ordinary or unslotted Gift-created trait | creation of matching non-purchase god loot                     |
| provider rarification | nested `RarityUpgradeData` with provider `LootName`, one use, and a rank-processed cap | equipped ordinary or unslotted Gift-created trait | one successful explicit rarification on that provider's screen |

The effects normally line up, but they do not share lifetime. In particular,
an unchosen forced-god door consumes the generic `Boon` priority while leaving
the provider force and rarification available.

## Olympian declaration family

All nine declarations inherit `BaseBoonUpgradeKeepsake`. That base has Common,
Rare, and Epic rows only. It has no Heroic row.

| Keepsake key                  | Label             | Provider loot name  |
| ----------------------------- | ----------------- | ------------------- |
| `ForceZeusBoonKeepsake`       | Cloud Bangle      | `ZeusUpgrade`       |
| `ForceHeraBoonKeepsake`       | Iridescent Fan    | `HeraUpgrade`       |
| `ForcePoseidonBoonKeepsake`   | Vivid Sea         | `PoseidonUpgrade`   |
| `ForceDemeterBoonKeepsake`    | Barley Sheaf      | `DemeterUpgrade`    |
| `ForceApolloBoonKeepsake`     | Harmonic Photon   | `ApolloUpgrade`     |
| `ForceAphroditeBoonKeepsake`  | Beautiful Mirror  | `AphroditeUpgrade`  |
| `ForceHephaestusBoonKeepsake` | Adamant Shard     | `HephaestusUpgrade` |
| `ForceHestiaBoonKeepsake`     | Everlasting Ember | `HestiaUpgrade`     |
| `ForceAresBoonKeepsake`       | Sword Hilt        | `AresUpgrade`       |

Every row declares the same structural behavior:

- `AcquireFunctionName = "RewardStoreAddPriority"` with `Name = "Boon"`;
- one provider-specific `ForceBoonName` and top-level `Uses = 1`; and
- one provider-specific `RarityUpgradeData.Uses = 1` whose `MaxRarity` is
  processed by the Common/Rare/Epic multiplier.

The provider identity is not stored in the reward-priority queue. It remains
on the trait that produced the priority.

## Generic reward-priority queue

### Addition and carousel contact

`RewardStoreAddPriority` always appends `args.Name` to
`CurrentRun.RewardPriorities`. It then inspects `args.RewardStoreName`, or
`RunProgress` when absent. If that mutable store carousel contains no remaining
entry with the exact requested name, it appends another complete base set to
that carousel without removing any leftovers.

The queue entry itself is global rather than store-scoped. The store argument
controls only the immediate refill side effect. A pending `Boon` may therefore
be consumed by any later counted store containing an eligible exact `Boon`,
including `RunProgress`, `HubRewards`, `TartarusRewards`, or
`TyphonBossRewards`.

The refill presence check ignores reward eligibility. Any remaining matching
entry prevents the immediate append even when that entry is currently
ineligible.

### Eligibility and consumption

`ChooseRoomReward` first computes the eligible concrete entries in the current
store. It then compares queued priority names to those entries by exact name.
A matching priority selects that concrete entry and removes one occurrence of
the priority name. The selected bag entry is still removed normally.

Consequently:

- priority is consumed at offer generation, not target entry or pickup;
- an unpicked door, wheel option, or cage still consumes its matching priority;
- a store without the exact priority name leaves the priority pending;
- an ineligible exact entry leaves the priority pending;
- a fixed reward path that returns before counted-store selection does not
  consume the queue; and
- shop and Shrine inventories do not call `ChooseRoomReward` and do not consume
  the queue.

### Unequip lifetime

`UnequipKeepsake` removes a nonpermanent Olympian keepsake trait, and therefore
removes its active provider-force and rarification fields. It has no contact
with `CurrentRun.RewardPriorities`. Across the installed scripts, the only
writes to that collection are run initialization, `RewardStoreAddPriority`,
and matching removal inside `ChooseRoomReward`.

An already-added `Boon` priority therefore survives unequipping its source
keepsake. A postboss swap can add another `Boon` priority before the earlier
one is consumed, even without Gift Gift Gift.

### Multiple-priority source quirk and planner disposition

The source removes an entry from `CurrentRun.RewardPriorities` while iterating
that same array with `ipairs`. With three or more queued entries, array collapse
can skip a shifted entry and may inspect a later entry in the same generation.
This is mutation-order behavior, not a declared priority policy.

The planner disposition is **Simplified and deterministic**:

- preserve priority acquisition order and duplicate entries;
- at one counted generation, consume exactly the oldest pending entry whose
  exact reward type has eligible support in the current store; and
- consume at most one priority entry for that generated reward.

This matches the ordinary one-entry case, gives two identical `Boon`
priorities two qualifying generations, and does not encode a Lua iteration
accident as a durable rule.

## Provider pressure

### Ordinary Boon source selection

After `ChooseRoomReward` selects `Boon`, `SetupRoomReward` resolves its provider.
It scans `CurrentRun.Hero.Traits` in acquisition order. The first trait with an
active `ForceBoonName` whose provider is not excluded by an earlier sibling
Boon supplies the room's `ForceLootName`; the scan then stops.

This provider selection does not decrement top-level `Uses`. It only records
the provider on the generated target. Therefore:

- an unchosen forced-provider door leaves the provider force active;
- the provider can be forced again in a later target-generation batch;
- another Boon in the same batch excludes the provider already shown by the
  earlier sibling and cannot repeat it merely because the force is still
  active; and
- removing the keepsake before a later generation removes this pressure even
  though an unconsumed generic `Boon` priority can remain.

### Devotion provider selection

Devotion has a distinct source loop. `SetupRoomReward` begins from providers
already present in `CurrentRun.LootTypeHistory`. It considers a force only when
that exact provider has previously interacted this run. Unlike ordinary Boon
setup, the loop does not stop after a match. If several active provider forces
qualify, the last qualifying trait in hero acquisition order becomes
`LootAName`. `LootBName` is then chosen as a different provider.

The planner disposition is **Exact**: ordinary Boons use first-qualifying
provider order; Devotion uses last-qualifying provider order. Gift-created
unslotted traits retain their acquisition position, so coexistence remains
deterministic.

The planner's existing `DevotionPair` payload intentionally records the
player's later `chosenSource`/`spurnedSource` execution order, not the game's
generated Loot A/Loot B identity. The representation-equivalent disposition
therefore requires the last qualifying forced provider to be present in the
generated pair while accepting either later execution orientation. It does not
add a second generated-pair order solely for this keepsake effect.

## Provider-force consumption is loot materialization

`GiveLoot` first resolves the concrete loot provider. Unless the call already
has `BoughtFromShop = true`, it then scans all hero traits and calls
`ReduceTraitUses` for every trait whose `ForceBoonName` matches that concrete
provider. This occurs while the loot object is created, before trait-screen
selection and independently of whether the player later selects a trait row.

| Source                                                          | Provider steering                                                        | Matching force consumption                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ordinary Boon room reward                                       | forced during target setup                                               | when the entered room's loot object spawns after combat                                                                                                |
| unchosen Boon exit                                              | provider appears on the door                                             | none, because that room's loot object never spawns                                                                                                     |
| Nemesis-suppressed room reward                                  | the original door may show the provider                                  | none, because the room reward does not spawn                                                                                                           |
| Fields cage Boon                                                | forced while cage rewards are set up                                     | when the locked loot object is materialized, before cage pickup                                                                                        |
| Fields optional Boon                                            | provider is not supplied by the generic reward-type-only bonus selection | an independently selected matching provider can still consume the force when spawned                                                                   |
| Devotion                                                        | eligible force may set initial `LootAName`                               | both initial god loot objects call `GiveLoot` before the player chooses; a matching provider consumes the force then                                   |
| fixed free or direct god loot                                   | fixed source is not changed by the keepsake                              | a matching non-purchase `GiveLoot` consumes the force                                                                                                  |
| ordinary Shop Boon or Mystery Boon (`RandomLoot`)               | Shop generation chooses its own provider                                 | none because the spawn arguments already carry `BoughtFromShop = true`                                                                                 |
| Blind Box unwrap, whether the box came from Narcissus or a Shop | unwrap chooses a provider without consulting `ForceBoonName`             | a matching random result consumes the force because `BoughtFromShop` is absent during `GiveLoot`; Shop unwrap assigns it only after `GiveLoot` returns |

The Blind Box order is a source quirk rather than a general purchase rule. The
box acquisition does not consume the force; its later unwrapped loot can. This
is distinct from a Shop Mystery Boon, whose direct `GiveLoot` call already has
purchase provenance and therefore does not consume the force.

The current normalized planner store `FieldsOptionalRewards` excludes `Boon`,
so the source-audited Fields optional row is dormant in the executable model.
No synthetic catalog path is added for it. If Fields optional Boons become a
modeled reward later, that feature must add the matching spawn-time force
contact and its own lifecycle witness.

The planner disposition is **Exact within modeled producers**. Provider-force
use belongs to the producer's loot-materialization lifecycle, not its optional
pickup disposition. Purchases are excluded by provenance. No new player-facing
choice is implied by this automatic effect.

## Provider-specific rarification

On a god offer, `UpgradeChoiceLogic` scans active `RarityUpgradeData`. A
provider-specific entry whose `LootName` matches the current source takes
precedence over a general entry such as Calling Card. A successful explicit
rarification:

1. upgrades one legal row by one rarity step;
2. decrements the selected provider-specific use; and
3. when that nested use reaches zero, removes an unslotted source or expires
   the slotted keepsake effect as appropriate.

The rarification use is separate from top-level provider-force `Uses` and from
the generic reward-priority queue. Spending any one of the three does not
implicitly spend the others.

The planner disposition is **Exact**: retain the existing authored row-level
rarification action, resolve provider-specific sources before general sources,
and apply the declaration/rank-owned maximum **source** rarity. A source cap of
Common/Rare/Epic permits an action from that current rarity to the next one;
only a source already above its cap is rejected. No second offer or keepsake-only
authoring control is required.

## Ordinary swap, Cherished Heirloom, and Gift Gift Gift

### Ordinary swap

When a normal postboss rack replaces an Olympian keepsake:

- the nonpermanent slotted trait is removed;
- remaining provider force and provider-specific rarification disappear; and
- any generic `Boon` priority already added remains until counted generation
  consumes it.

The replacement keepsake creates its own declaration effects through ordinary
`FromLoot` equip.

### Cherished Heirloom

`AdvanceKeepsake(true)` preserves top-level `Uses` through
`PersistentKeepsakeKeys`, so an unspent provider force stays unspent and a
spent provider force stays spent. The reconstruction does not pass `FromLoot`,
so it does not call `RewardStoreAddPriority` again.

Nested `RarityUpgradeData.Uses` is not generally preserved. The nine Olympian
keepsakes have no special preservation branch, so reconstruction creates the
declaration default of one provider-specific rarification use. Because their
base has no Heroic row, the reconstructed current keepsake remains Epic.

Cherished therefore:

- adds no generic `Boon` priority;
- does not reactivate a spent provider force;
- preserves an unspent provider force; and
- refills provider-specific rarification to exactly one rather than adding one.

### Gift Gift Gift

Gift replay equips the captured keepsake with `FromLoot = true` at Common. An
Olympian replay therefore creates:

- another generic `Boon` priority;
- one Common active provider-force use; and
- one Common-source-cap provider-specific rarification use (which can upgrade
  a Common row to Rare).

The replayed trait is unslotted. It remains present after provider-force use is
spent and blocks another replay of the same keepsake until its nested
rarification use is spent and `UpgradeChoiceLogic` removes it. A different
ordinary Olympian keepsake may be slotted at the same time, giving two active
provider forces. Their acquisition order governs the ordinary and Devotion
selection rules above.

## Moon Beam

### Immediate point grant

`SpellTalentKeepsake` calls `KeepsakeAcquireSpellDrop` on ordinary `FromLoot`
equip and Gift replay. The callback first grants processed Path of Stars points
immediately. The declared rank values are Common 3, Rare 4, Epic 5, and Heroic 7. These points are not attached to a later Path pickup.

Cherished Heirloom does not replay this acquisition callback. Its explicit
rank-III to rank-IV special case adds two points, the difference between Epic
5 and Heroic 7, without adding another reward priority.

### Exact priority selection

After granting points, `KeepsakeAcquireSpellDrop` selects exactly one priority:

| State at ordinary equip or Gift replay                                         | Exact queued reward name |
| ------------------------------------------------------------------------------ | ------------------------ |
| `CurrentRun.UseRecord.SpellDrop` is zero or absent                             | `SpellDrop`              |
| a `SpellDrop` was acquired and `CurrentRun.CurrentRoom.Name` is `H_PostBoss01` | `TalentBigDrop`          |
| a `SpellDrop` was acquired and `CurrentRun.CurrentRoom.Name` is `P_PostBoss01` | `TalentBigDrop`          |
| a `SpellDrop` was acquired in any other room                                   | `TalentDrop`             |

The condition uses acquisition history. Merely offering Selene without
acquiring `SpellDrop` does not select a Path priority on a later Moon Beam
equip or replay.

`RewardStoreAddPriority` and `ChooseRoomReward` use exact names. There is no
genus or Path-family match:

- `TalentDrop` does not match `TalentBigDrop`;
- `TalentDrop` does not match `MinorTalentDrop`;
- `TalentBigDrop` waits for a counted store containing that exact reward; and
- Moon Beam never queues `MinorTalentDrop`.

The shared point bank, exact one/three/five Path values, ordered initial
`SpellDrop` bonuses, and Aspect of Selene routing are owned by the focused
[Path of Stars and Spell Drop audit](PATH_OF_STARS_AND_SPELL_DROP_GAME_DATA_AUDIT.md).

The `TalentBigDrop` special case still calls `RewardStoreAddPriority` without a
`RewardStoreName`, so its refill contact is the default `RunProgress` carousel.
Because `RunProgress` contains no `TalentBigDrop`, the callback appends a full
`RunProgress` set while separately queuing the global `TalentBigDrop` name.
That queued priority can later match `TartarusRewards` or another counted store
that actually contains `TalentBigDrop`.

Shop and Shrine inventories do not consume Moon Beam priority. Gift replay
reevaluates both `UseRecord.SpellDrop` and the current room when the replay
occurs; it does not reuse the target selected by the original equip.

## Planner disposition summary

| Behavior                                                                          | Disposition                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| exact reward name, duplicate queue entries, and priority survival after unequip   | Exact                                                               |
| immediate store-set append when the refill store lacks the exact name             | Exact                                                               |
| matching priority consumed at counted offer generation, including unpicked offers | Exact                                                               |
| three-or-more priority mutation while iterating the Lua array                     | Simplified to oldest eligible, one consumption per generated reward |
| ordinary first-qualifying provider and Devotion last-qualifying provider          | Exact                                                               |
| provider-force use at non-purchase loot materialization                           | Exact within modeled producers                                      |
| Blind Box's post-`GiveLoot` shop marker                                           | Exact for Shop and Narcissus Blind Box unwrap                       |
| provider-specific rarification precedence and one-use lifetime                    | Exact                                                               |
| Moon Beam `SpellDrop`/`TalentDrop`/`TalentBigDrop` selection                      | Exact                                                               |
| treating all Path drop sizes as one priority family                               | Rejected; source uses exact names                                   |

Production now covers the nine Olympian keepsakes, their exact `Boon` priority,
provider force, provider rarification, ordinary/Cherished/Gift lifetimes, and
all currently reachable producer contacts in this audit. The Fields optional
row remains dormant for the normalized-store reason above. Moon Beam and its
Path-point/priority behavior remain pending until the dedicated Hex slice.
