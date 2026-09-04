# Rewards and items

This inventory covers every normalized reward identity. Rows are grouped by
native carrier because the same planner outcome may need a different contact
when it comes from a room reward, a direct item, a purchase, or a generated
pickup.

## Source index

- Catalog inventory: `packages/hades2-catalog/src/declarations/rewards/`
- Execution wire: `packages/planner-engine/src/execution-plan/model.ts`
- Loot and consumables: `Scripts/InteractLogic.lua:621-1000`
- Trait levels: `Scripts/TraitLogic.lua:2482-2630`
- Reward creation: `Scripts/RewardLogic.lua:210-330`
- Shops and Mystery Boons: `Scripts/StoreLogic.lua:326-430` and
  `Scripts/StoreLogic.lua:1134-1360`
- Current adapters: `src/mods/hooks_timeline.lua` and
  `src/mods/hooks_features.lua` in the Plan Executor

## Native acquisition contacts

| Carrier                  | Game contacts                                                                                                       | Current disposition                                                                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trait or Pom loot screen | `UseLoot`, `CreateBoonLootButtons`, `CreateUpgradeChoiceButton`, `HandleUpgradeChoiceSelection`, `HandleLootPickup` | Covered for published ordinary trait offers and visible level resolutions.                                                                                                                             |
| Direct consumable        | `UseConsumableItem`, its declared use function, `ConsumableUsedPresentation`                                        | Covered for normal published direct acquisitions through exact-object binding, post-guard acceptance, and post-return completion. Specialized use functions retain their own owners.                   |
| Direct random level item | `UseStoreRewardRandomStack` -> `AddStackToTraits`                                                                   | Covered for a bound published level resolution, including native target steering and threaded terminal proof.                                                                                          |
| World Shop item          | `FillInShopOptions`, `SpawnStoreItemInWorld`, `RemoveStoreItem`; screen purchase uses `HandleStorePurchase`         | Covered for inventory identity, purchase binding, and published acquisition roles. Trait/level settlement occurs at the later native acquisition contact, not at payment.                              |
| Stygian Well item        | `FillInShopOptions`, `CreateStoreButtons`, `HandleStorePurchase`, `RestockWorldItem`                                | Covered for declared Well effects, Twist, Extended, Travel Deal refill, and runtime fallback binding.                                                                                                  |
| Generated pickup         | `CreateConsumableItem`, `CreateLoot`, `GiveLoot`, `SpawnRoomReward`                                                 | Adapter gap by producer family. C3 is the first trait-generated child closure and requires the engine-owned source relation to be published.                                                           |
| Mystery Boon             | `UnwrapRandomLoot`, `GiveLoot`, `CreateLoot`, then the ordinary trait screen                                        | Adapter gap. C3 closes the Narcissus carrier; purchase and Shrine delivery retain their owning later gates.                                                                                            |
| Resource pickup          | `UseConsumableItem` plus the resource's use function                                                                | Covered for ordinary direct-pickup settlement. Published level behavior remains with the level adapter; fixed element mutation stays native-authoritative and settles before direct-pickup completion. |

Choice construction additionally lives in `Scripts/UpgradeChoiceLogic.lua`.

## Closed reward identity inventory

### Trait and choice rewards

| Identities                                                                                                                                                                   | Planner result                                                                       | Status                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `AphroditeUpgrade`, `ApolloUpgrade`, `AresUpgrade`, `DemeterUpgrade`, `HephaestusUpgrade`, `HeraUpgrade`, `HestiaUpgrade`, `PoseidonUpgrade`, `ZeusUpgrade`, `HermesUpgrade` | Three-option trait offer and one selected trait                                      | Covered through the generic loot carrier.                                                                        |
| `StackUpgrade`, `StackUpgradeBig`, `StackUpgradeTriple`                                                                                                                      | Visible target choice plus level count                                               | Covered by the visible-Pom adapter specified in the level-acquisition audit.                                     |
| `WeaponUpgrade`                                                                                                                                                              | Hammer trait offer                                                                   | Covered through the generic trait carrier.                                                                       |
| `SpellDrop`                                                                                                                                                                  | Ordered Hex offer; later Path state belongs to the selected spell                    | Covered as a trait offer. Hex-tree realization is deferred beyond F/G where unavailable.                         |
| `TrialUpgrade`                                                                                                                                                               | Three Chaos curse choices, each paired with a blessing; the selected pair is applied | Covered by the Chaos pair adapter. `TrialUpgrade` is the native Chaos loot identity, not a blessing-only reward. |
| `InfernalContractBoon`                                                                                                                                                       | Automatic encounter-clear trait, not a pickup                                        | Native pass-through. It is an Overview logical acquisition and must not be expected as a spawned room reward.    |

### Direct run-progress items

| Identities                                                                                                 | Planner result                              | Status                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MaxHealthDrop`, `MaxHealthDropBig`, `MaxHealthDropSmall`, `EmptyMaxHealthSmallDrop`, `EmptyMaxHealthDrop` | Health-state change                         | Covered for direct acquisition settlement; the native health effect is pass-through because its amount is outside simulation. Identity may still be forced or used by runtime fallback. |
| `MaxManaDrop`, `MaxManaDropBig`, `MaxManaDropSmall`                                                        | Magick-state change                         | Covered for direct acquisition settlement; native Magick mutation is pass-through.                                                                                                      |
| `Currency`, `RoomMoneyDrop`, `RoomMoneySmallDrop`, `RoomMoneyTripleDrop`, `RoomMoneyTinyDrop`              | Gold-state change                           | Covered for direct acquisition settlement; native Gold mutation is pass-through.                                                                                                        |
| `TalentDrop`, `TalentBigDrop`, `MinorTalentDrop`                                                           | 3, 5, or 1 Path points                      | Deferred route for current F/G execution. Their `OpenTalentScreen` sequence belongs to Spell/Path/Hex execution, not the generic direct-pickup carrier.                                 |
| `RoomRewardHealDrop`, `HealDrop`, `HealDropMinor`, `HealBigDrop`                                           | Healing                                     | Covered for direct acquisition settlement; native healing is pass-through.                                                                                                              |
| `RoomRewardConsolationPrize`                                                                               | Vow of Forfeit onion and biome consumption  | Covered for direct consumption; reward replacement and Forfeit retained-state conformance are separately published.                                                                     |
| `ArmorBoost`, `ArmorBigBoost`                                                                              | Armor                                       | Covered for direct acquisition settlement; native Armor mutation is pass-through and the identities remain available as runtime fallbacks.                                              |
| `AirBoost`, `EarthBoost`, `FireBoost`, `WaterBoost`, `ElementalBoost`                                      | Element contribution                        | Covered for direct settlement. Native fixed element mutation remains authoritative and settles before completion; the resulting element ledger remains a separate conformance fact.     |
| `StoreRewardRandomStack`                                                                                   | One random eligible trait gains one level   | Covered at the direct `AddStackToTraits` carrier; it is not a Pom screen.                                                                                                               |
| `LastStandDrop`                                                                                            | Death Defiance                              | Producer availability and fallback are covered; direct consumption uses the direct-pickup adapter after the realized object is bound.                                                   |
| `ChaosWeaponUpgrade`                                                                                       | Anvil result                                | Deferred route in current F/G execution.                                                                                                                                                |
| `GiftDrop`                                                                                                 | Nectar plus one random eligible trait level | Covered: ordinary Nectar uses direct-pickup settlement, while a source-eligible level result uses the direct-level adapter.                                                             |

### Meta-progression items

`MetaCurrencyDrop`, `MetaCurrencyBigDrop`, `MetaCardPointsCommonDrop`,
`MetaCardPointsCommonBigDrop`, `MemPointsCommonDrop`, `WeaponPointsRareDrop`,
`CardUpgradePointsDrop`, and `CharonPointsDrop` are covered when published as
normal direct acquisitions. Their native effects remain pass-through: amounts
do not alter simulation, and their appearance must not create a mismatch merely
because the planner groups required boss drops under one effect-neutral result.

## Composite reward identities

| Identity                         | Resolution                                                   | Status                                                                                     |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `Boon`                           | Resolves a provider, then a provider trait offer             | Covered when both the source and trait offer are published.                                |
| `Devotion`                       | Chosen source before combat and spurned source after combat  | Covered by separate acquisition roles; its two contacts must not collapse into one pickup. |
| `RandomLoot`                     | Provider resolved at offer creation                          | Covered through published source and trait offer.                                          |
| `BlindBoxLoot`                   | Box first, hidden provider after unwrap                      | Covered through box and hidden-source roles.                                               |
| `WeaponUpgradeDrop`              | Shop/pedestal wrapper for `WeaponUpgrade`                    | Covered through the later trait carrier.                                                   |
| `ShopHermesUpgrade`              | Shop/pedestal wrapper for `HermesUpgrade`                    | Covered through the later trait carrier.                                                   |
| `Story`, `Shop`, `ClockworkGoal` | Structural room reward identities with no direct acquisition | Native pass-through; their contents are audited at their actual interaction carrier.       |

## Shop and Shrine pools

The five declared profiles are `RoomShop`, `SurfaceShop`, `WorldShop`,
`I_WorldShop`, and `Q_WorldShop`. Only `RoomShop` and `WorldShop` occur in the
current F/G execution extent. Surface Shrine and I/Q World Shop rows are
deferred route, but their option identities are still covered above by the
same acquisition carriers.

World Shop has three base slots: one Boon, one major non-Boon, and one minor.
The special supplemental offers—Infernal Contract, Travel Deal, and Echo Gold
Gold Gold—are not new native reward kinds; they are additional declared shop
offers and dependencies.

## Complete Stygian Well item disposition

| Effect             | Item identities                                                                                                                                                                                                                                                                                                                                                                                                                              | Execution status                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Last Stand         | `LastStandShopItem`                                                                                                                                                                                                                                                                                                                                                                                                                          | Covered with store-purchase fallback.                                             |
| Spark              | `TemporaryForcedSecretDoorTrait`                                                                                                                                                                                                                                                                                                                                                                                                             | Covered; the retained Spark state and resulting Chaos gate are separate contacts. |
| Yarn               | `TemporaryBoonRarityTrait`                                                                                                                                                                                                                                                                                                                                                                                                                   | Covered as a retained use; consumption is checked through room-exit conformance.  |
| Hymn               | `LimitedSwapTraitDrop`                                                                                                                                                                                                                                                                                                                                                                                                                       | Covered as a retained use; the next eligible offer remains planner-owned.         |
| Discount           | `TemporaryDiscountTrait`                                                                                                                                                                                                                                                                                                                                                                                                                     | Covered, including Travel Deal purchase dependency.                               |
| Empty-slot damage  | `TemporaryEmptySlotDamageTrait`                                                                                                                                                                                                                                                                                                                                                                                                              | Covered as a retained use; damage is simulation-neutral.                          |
| Extended           | `ExtendedShopTrait`                                                                                                                                                                                                                                                                                                                                                                                                                          | Covered for the declared direct-purchase whitelist and refill relation.           |
| Twist              | `RandomStoreItem`                                                                                                                                                                                                                                                                                                                                                                                                                            | Covered for the selected nested item and its fallback.                            |
| Simulation-neutral | `ArmorBoostStore`, `DamageSelfDrop`, `HealDropRange`, `EmptyMaxHealthShopItem`, `FirstHitHealTrait`, `TemporaryDoorHealTrait`, `TemporaryHealExpirationTrait`, `TemporaryImprovedSecondaryTrait`, `TemporaryImprovedCastTrait`, `TemporaryMoveSpeedTrait`, `TemporaryImprovedExTrait`, `TemporaryImprovedDefenseTrait`, `MetaCurrencyRange`, `MetaCardPointsCommonRange`, `MemPointsCommonRange`, `SeedMysteryRange`, `LimitedManaRegenDrop` | Native pass-through after exact inventory and purchase realization.               |

An uninteracted Well, Shop, Shrine, or Pool is Overview content, not an implied
Timeline transaction. Present and interacted are distinct published facts.
