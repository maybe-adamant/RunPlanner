# Max health and max Magick

This audit owns the source formula for the hero's maximum health and maximum
Magick, every modeled source, and the planner disposition for each. Other
audits link here instead of repeating amounts.

Native scripts: `1GameData/Scripts`. Current health, healing, damage and Death
Defiance are outside the planner model.

## Formula

`ValidateMaxHealth` and `GetExpectedMaxMana` (`RoomLogic.lua:601-668`) rebuild
both maxima from the current trait list after every relevant change, so pickup
order does not matter:

```text
M = round((50 + flat Magick) × (1 + Σ(Magick multiplier − 1)))
H = round((30 + flat health + Σ conversion × ceil(M)) × (1 + Σ(health multiplier − 1)))
H = max(1, H); an active White Antler sets H = 30
```

- Base values are `HeroData.MaxHealth = 30` and `MaxMana = 50`
  (`HeroData.lua:6-8`).
- Flat values are the `ChangeValue` of every `PropertyChanges` entry on
  `MaxHealth`/`MaxMana` (and of `ActivatedPropertyChanges` while active); they
  keep fractions until the single final `round`, which is `floor(x + 0.5)`.
- Multipliers come from `GetTotalHeroTraitValue(..., { IsMultiplier = true })`
  (`TraitLogic.lua:372-395`): one plus each source's excess over one, so they
  sum and scale base plus every flat source.
- The arithmetic is Lua doubles. `1 + (1.15 − 1)` is `1.1499…`, so
  `50 × 1.15` rounds to 57, not 58. The planner builds multipliers the same
  way, so it reproduces this case; it groups flat values by source before
  summing, so a different summation order could differ in the last bit of a
  fractional total.
- Ramped trait values pass `ProcessValue` (`TraitLogic.lua:349-361`), which
  rounds to two decimals unless the value declares its own precision.
- Pickups and permanent grants go through `AddMaxHealth`/`AddMaxMana`
  (`RoomLogic.lua:2722-2766`), which round the amount and add a hidden
  `RoomRewardMaxHealthTrait`/`RoomRewardMaxManaTrait`. These traits outlive
  the source that created them.

## Sources

| Source                                          | Amount                                                             | Source contact                                    | Planner owner                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Centaur Heart small / normal / large            | +5 / +25 / +50 health                                              | `ConsumableData.lua` `MaxHealthDrop*`             | acquisition `maxStatGrant`, credited to reward history at collection            |
| Centaur Soul small / normal; Well Centaur Soul  | +10 / +25; +25 health (no healing)                                 | `EmptyMaxHealth*Drop`, `EmptyMaxHealthShopItem`   | same; the Well credits at purchase                                              |
| Soul Tonic small / normal / large               | +10 / +30 / +60 Magick                                             | `MaxManaDrop*`                                    | same                                                                            |
| Ashes / Bones (both sizes), run-progress spawns | +5 health / +5 Magick                                              | `RunProgress` overrides; `InteractLogic.lua:869`  | acquisition `runProgressMaxStatGrant` and producer `runProgressUpgradeEligible` |
| Silver Wheel                                    | one grant per loot equip, 50 / 75 / 100 / 150 Magick by rank       | `KeepsakeAddMaxMana`; `KeepsakeLogic.lua:148-161` | keepsake effect `maxManaGrant`; keepsake state `maxManaGrants`                  |
| Persistence                                     | 20 / 30 / 40 / 50 health and Magick                                | `HealthManaBonusMetaUpgrade`                      | Arcana `maxStatBonus`, read from active cards                                   |
| The Centaur                                     | recorded grants (see [Arcana](ARCANA_AND_FEAR_GAME_DATA_AUDIT.md)) | `RoomStatGrowth`                                  | Arcana `roomEntryGrowth` totals                                                 |
| Aspect of Melinoë (Staff)                       | 40 Magick at V, 50 at VI                                           | `BaseStaffAspect` 10 × Legendary 4 / Perfect 5    | aspect `maxStatBonus`; VI once Premium Service was picked                       |
| Aspect of Melinoë (Axe)                         | 50.1 health at V, 60 at VI                                         | `AxeRecoveryAspect` 30 × 1.67 / 2.00              | same                                                                            |
| Water Fitness                                   | 15 health × current Water                                          | `ElementalHealthBoon` `MultipliedByElement`       | trait `maxStatEffect` `perElement`                                              |
| Chaos Soul / Mind blessing                      | authored operand, once matured                                     | `ChaosHealthBlessing`, `ChaosManaBlessing`        | blessing `maxStatOperand`                                                       |
| Chaos Atrophic curse                            | authored negative operand, while active                            | `ChaosHealthCurse`                                | curse `maxStatOperand`                                                          |
| Traces of Spirit                                | each recorded grant                                                | `ManaOverTimeCurse` `RoomsPerUpgrade`             | trait-history `maxStatGrants`                                                   |
| Worry Free                                      | authored roll, 50–80 / 70–100 / 90–120 / 110–140                   | `GrantRandomMaxHealth`                            | trait-history `maxStatGrants`                                                   |
| Frinos / Hecuba                                 | +10 health / +15 Magick per stack                                  | `HealthFamiliar`, `DigFamiliar`                   | familiar `maxStatPerStack`; route equipment                                     |
| Fight Fight Fight                               | fraction × the maxima just before acquisition                      | `EchoIncreaseStats`; `RoomLogic.lua:4245-4262`    | trait `roomDecay.startMaxima`                                                   |

| Multiplier or conversion | Value                                        | Source                                            |
| ------------------------ | -------------------------------------------- | ------------------------------------------------- |
| Spiritual Affirmation    | ×1.15 / 1.20 / 1.25 / 1.30 health and Magick | `HealthRewardBonusBoon`, `SourceIsMultiplier`     |
| Word of Greater Girth    | ×1.15 health                                 | `CirceEnlargeTrait`                               |
| Uncanny Fortitude        | ceil(M) × 20 / 25 / 30 / 35% health          | `ManaToHealthBoon` `MaxManaToMaxHealthConversion` |

`HealthRewardBonus` scales `AddMaxHealth` pickups in
`ApplyConsumableItemResourceMultiplier`, but no trait declares it; the only
reader is the unused `MultiplySameRoomRewards`. It is not modeled.

## Source details

### Ashes and Bones run-progress spawns

Ashes (`MetaCardPointsCommonDrop`, `…BigDrop`) and Bones (`MetaCurrencyDrop`,
`…BigDrop`) carry `RunProgress` property overrides behind world upgrades. A
mature save owns the upgrades; a fresh profile does not, so the bonus reuses
the Nectar route gate. `CreateConsumableItem` applies the override only when
its caller passes `RunProgressUpgradeEligible`:

| Spawn path                                      | Eligible | Planner producer                        |
| ----------------------------------------------- | -------- | --------------------------------------- |
| `SpawnRoomReward` (room, cage, Fields optional) | yes      | `RoomReward`                            |
| `EchoLastReward`                                | yes      | `EchoLastReward`                        |
| Narcissus `GiveRandomConsumables`               | yes      | `NarcissusPickup`                       |
| Buried Treasure `GiveRandomConsumables`         | yes      | `GeneratedTraitPickup`                  |
| Nemesis trade (`TradeLogic.lua:214`)            | yes      | no Ashes or Bones in its domain         |
| `NPCRewardDrop` (Nemesis events, Eris gifts)    | no       | `NemesisEventPickup`, `ErisCursePickup` |
| Shop and Well purchases                         | no       | shop profile keys                       |

A Sea Star duplicate reuses the same object, so it repeats the bonus.

### Silver Wheel

Live evidence (owner, 2026-10): Silver Wheel at rank III gave +100 Magick;
Cherished Heirloom raised that grant to 150; after swapping the Wheel away,
Gift Gift Gift's rank-I copy at the next region added +50 more, for 200 in
grants; a later Soul Tonic left both grants intact.

The scripts are consistent with the observed totals. A loot equip
(`FromLoot`: run start, rack, randomizer, Gift Gift Gift copy) runs the
acquire function `KeepsakeAddMaxMana` from `AddTraitData`; its `AddMaxMana`
adds a `RoomRewardMaxManaTrait` with `Source` set to the keepsake, and adding
that trait validates max Magick at once. Cherished Heirloom re-equips without
`FromLoot`, so no new grant is made; `EquipKeepsake` instead rewrites the
source-marked grant's value to the rank-IV amount and validates
(`KeepsakeLogic.lua:288-294`). Unequipping keeps every grant; only death
reverses one.

The `EquipKeepsake` loop reads as if it rewrites every earlier source-marked
grant to the newest equip's amount, but in game an earlier grant keeps its
value: after the copy's +50, a later Soul Tonic did not lower max Magick
(owner, 2026-10). Each equipped instance is a separate grant, and Cherished
Heirloom adjusts only the instance currently equipped.

The planner keeps one grant per loot equip at that equip's amount; Cherished
Heirloom raises the equipped Wheel's latest grant. The keepsake no-return rule
(see the Keepsake audit) keeps a removed Wheel from being re-equipped.

### White Antler

`CapMaxHealth = 30` at every rank. While the keepsake is equipped and its one
use remains, max health is fixed at 30, which also raises a lower total. The
first Boss encounter end while active spends the use (`RoomLogic.lua:2950-2965`,
`EncounterLogic.lua:1662-1672`); the expired keepsake stays equipped with no
cap. Replacing the keepsake ends the window, and Gift Gift Gift's rank-I copy
opens a new one until its own Boss.

### Fight Fight Fight

`EchoIncreaseStats` records `CurrentRun.Hero.MaxHealth` and `MaxMana` at
acquisition and adds `StartFraction ×` each as flat property changes. The
first departure only clears the block; each later departure lowers the
fraction by 0.05 and rewrites both values, and the trait is removed once the
fraction is not positive. The planner snapshots the final maxima from the
pre-acquisition state.

### Worry Free

`GrantRandomMaxHealth` is the trait's `AcquireFunctionName`, which
`AddTraitData` calls only with `FromLoot`. It adds an unmarked
`RoomRewardMaxHealthTrait`, so:

- each loot acquisition (an offer, a Boon Boon Boon replay, a Concave Stone
  pickup) grants a fresh roll at its acquired rarity;
- rarity upgrades (`AddRarityToTraits`) and level changes re-add the trait
  without `FromLoot`, so they grant nothing more;
- the grant survives the trait's later removal, and a re-acquisition after
  removal rolls again.

### Familiars

`EquipFamiliar` runs at run start. A familiar's first trait gains one stack per
owned stat upgrade (`GetFamiliarTraitStacks`); a mature save owns all three, so
four stacks. Primal Psychic Connection is always offered at Common, whose
`CircePetMultiplier` adds the current stacks once, doubling them.

## Planner disposition

`deriveMaxStats` computes both maxima from folded state at every Run State
capture and publishes them with their flat sources. New folded facts live with
their settlement owners: pickup grants in reward history, permanent trait
grants and the Fight Fight Fight base in trait history, and the Silver Wheel
bonus and White Antler window in keepsake state. Conformance and the
execution protocol do not read the maxima.

Bounded approximations:

- Aspects are rank V, rising to VI when Premium Service has been picked.
- Familiars are assumed at the mature four stacks.
- At acquisition `EchoIncreaseStats` adds its values directly before the next
  validation; the planner applies the validation formula throughout.
