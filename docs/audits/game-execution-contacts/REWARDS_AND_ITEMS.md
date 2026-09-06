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
- Current adapters: focused `src/mods/room/timeline/` acquisition, commerce,
  interaction, and transformation modules in the Plan Executor

## Native acquisition contacts

| Carrier                  | Game contacts                                                                                                       | Current disposition                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trait or Pom loot screen | `UseLoot`, `CreateBoonLootButtons`, `CreateUpgradeChoiceButton`, `HandleUpgradeChoiceSelection`, `HandleLootPickup` | Covered for published ordinary trait offers and visible level resolutions.                                                                                                                                                            |
| Direct consumable        | `UseConsumableItem`, its declared use function, `ConsumableUsedPresentation`                                        | Covered for normal published direct acquisitions through an existing binding or compatible ready-action claim, post-guard acceptance, and post-return completion. Specialized use functions retain their own owners.                  |
| Direct random level item | `UseStoreRewardRandomStack` -> `AddStackToTraits`                                                                   | Covered for a bound published level resolution, including native target steering and the threaded native terminal.                                                                                                                    |
| World Shop item          | `FillInShopOptions`, `SpawnStoreItemInWorld`, `RemoveStoreItem`; screen purchase uses `HandleStorePurchase`         | Covered for inventory identity, purchase binding, and published acquisition roles. Trait/level settlement occurs at the later native acquisition contact, not at payment.                                                             |
| Stygian Well item        | `FillInShopOptions`, `CreateStoreButtons`, `HandleStorePurchase`, `RestockWorldItem`                                | Covered for exact declared Well effects, Twist, Extended, and Travel Deal refill binding.                                                                                                                                             |
| Generated pickup         | `CreateConsumableItem`, `CreateLoot`, `GiveLoot`, `SpawnRoomReward`                                                 | Covered for published trait-generated children through producer-independent ready-action claiming. Producer RNG and participation remain with their focused owning adapters.                                                          |
| Mystery Boon             | `UnwrapRandomLoot`, `GiveLoot`, `CreateLoot`, then the ordinary trait screen                                        | Covered for bound and compatible ready boxes, including Narcissus and purchased or delivered boxes. Payment and delayed delivery remain native-owned contacts; the resulting acquisition uses the same Mystery Boon adapter.          |
| Time Piece / Artificer   | `GoldifyPresentation`, `ConvertMetaRewardPresentation`, `ChooseRoomReward`, `SpawnRoomReward`                       | Time Piece is omitted at execution publication and proved in aggregate at room exit. The transformation audit closes Artificer's disposition, bounded native sequence, reward steering, and later producer-independent child handoff. |
| Resource pickup          | `UseConsumableItem` plus the resource's use function                                                                | Covered for ordinary direct-pickup settlement. Published level behavior remains with the level adapter; fixed element mutation stays native-authoritative and settles before direct-pickup completion.                                |

Choice construction additionally lives in `Scripts/UpgradeChoiceLogic.lua`.

## Closed reward identity inventory

### Trait and choice rewards

| Identities                                                                                                                                                                   | Planner result                                                                       | Status                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `AphroditeUpgrade`, `ApolloUpgrade`, `AresUpgrade`, `DemeterUpgrade`, `HephaestusUpgrade`, `HeraUpgrade`, `HestiaUpgrade`, `PoseidonUpgrade`, `ZeusUpgrade`, `HermesUpgrade` | Three-option trait offer and one selected trait                                      | Covered through the generic loot carrier.                                                                        |
| `StackUpgrade`, `StackUpgradeBig`, `StackUpgradeTriple`                                                                                                                      | Visible target choice plus level count                                               | Covered by the visible-Pom adapter specified in the level-acquisition audit.                                     |
| `WeaponUpgrade`                                                                                                                                                              | Hammer trait offer                                                                   | Covered through the generic trait carrier.                                                                       |
| `SpellDrop`                                                                                                                                                                  | Ordered Hex offer; later Path state belongs to the selected spell                    | Covered by the Spell/Hex adapter and product; route activation and live native probing remain deferred.          |
| `TrialUpgrade`                                                                                                                                                               | Three Chaos curse choices, each paired with a blessing; the selected pair is applied | Covered by the Chaos pair adapter. `TrialUpgrade` is the native Chaos loot identity, not a blessing-only reward. |
| `InfernalContractBoon`                                                                                                                                                       | Automatic encounter-clear trait, not a pickup                                        | Native pass-through. It is an Overview logical acquisition and must not be expected as a spawned room reward.    |

### Direct run-progress items

| Identities                                                                                                 | Planner result                              | Status                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MaxHealthDrop`, `MaxHealthDropBig`, `MaxHealthDropSmall`, `EmptyMaxHealthSmallDrop`, `EmptyMaxHealthDrop` | Health-state change                         | Covered for direct acquisition settlement; the native health effect is pass-through because its amount is outside simulation. Exact identity may still be forced.                   |
| `MaxManaDrop`, `MaxManaDropBig`, `MaxManaDropSmall`                                                        | Magick-state change                         | Covered for direct acquisition settlement; native Magick mutation is pass-through.                                                                                                  |
| `Currency`, `RoomMoneyDrop`, `RoomMoneySmallDrop`, `RoomMoneyTripleDrop`, `RoomMoneyTinyDrop`              | Gold-state change                           | Covered for direct acquisition settlement; native Gold mutation is pass-through.                                                                                                    |
| `TalentDrop`, `TalentBigDrop`, `MinorTalentDrop`                                                           | 3, 5, or 1 Path points                      | Covered by the specialized Path carrier and `OpenTalentScreen`; route activation and live native probing remain deferred, and they stay outside the generic direct-pickup carrier.  |
| `RoomRewardHealDrop`, `HealDrop`, `HealDropMinor`, `HealBigDrop`                                           | Healing                                     | Covered for direct acquisition settlement; native healing is pass-through.                                                                                                          |
| `RoomRewardConsolationPrize`                                                                               | Vow of Forfeit onion and biome consumption  | Covered for direct consumption; reward replacement and Forfeit retained-state conformance are separately published.                                                                 |
| `ArmorBoost`, `ArmorBigBoost`                                                                              | Armor                                       | Covered for direct acquisition settlement; native Armor mutation is pass-through.                                                                                                   |
| `AirBoost`, `EarthBoost`, `FireBoost`, `WaterBoost`, `ElementalBoost`                                      | Element contribution                        | Covered for direct settlement. Native fixed element mutation remains authoritative and settles before completion; the resulting element ledger remains a separate conformance fact. |
| `StoreRewardRandomStack`                                                                                   | One random eligible trait gains one level   | Covered at the direct `AddStackToTraits` carrier; it is not a Pom screen.                                                                                                           |
| `LastStandDrop`                                                                                            | Death Defiance                              | Exact producer identity is enforced; native ineligibility is a mismatch. Direct consumption uses the direct-pickup adapter after the object is bound.                               |
| `ChaosWeaponUpgrade`                                                                                       | Anvil result                                | Covered as a purchased World Shop transformation with one removed and two added Hammer identities.                                                                                  |
| `GiftDrop`                                                                                                 | Nectar plus one random eligible trait level | Covered: ordinary Nectar uses direct-pickup settlement, while a source-eligible level result uses the direct-level adapter.                                                         |

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
current F/G execution extent. Their inventory, purchase, supplemental-offer,
and Anvil contacts are covered. Surface Shrine and I/Q World Shop navigation is
deferred route; their already-published inventories and purchases reuse the
same strict commerce and acquisition boundaries when those routes are enabled.

World Shop has three base slots: one Boon, one major non-Boon, and one minor.
The special supplemental offers—Infernal Contract, Travel Deal, and Echo Gold
Gold Gold—are not new native reward kinds; they are additional declared shop
offers and dependencies.

## Complete Stygian Well item disposition

| Effect             | Item identities                                                                                                                                                                                                                                                                                                                                                                                                                              | Execution status                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Last Stand         | `LastStandShopItem`                                                                                                                                                                                                                                                                                                                                                                                                                          | Covered with exact store-purchase admission; native unavailability reports a mismatch. |
| Spark              | `TemporaryForcedSecretDoorTrait`                                                                                                                                                                                                                                                                                                                                                                                                             | Covered; the retained Spark state and resulting Chaos gate are separate contacts.      |
| Yarn               | `TemporaryBoonRarityTrait`                                                                                                                                                                                                                                                                                                                                                                                                                   | Covered as a retained use; consumption is checked through room-exit conformance.       |
| Hymn               | `LimitedSwapTraitDrop`                                                                                                                                                                                                                                                                                                                                                                                                                       | Covered as a retained use; the next eligible offer remains planner-owned.              |
| Discount           | `TemporaryDiscountTrait`                                                                                                                                                                                                                                                                                                                                                                                                                     | Covered, including Travel Deal purchase dependency.                                    |
| Empty-slot damage  | `TemporaryEmptySlotDamageTrait`                                                                                                                                                                                                                                                                                                                                                                                                              | Covered as a retained use; damage is simulation-neutral.                               |
| Extended           | `ExtendedShopTrait`                                                                                                                                                                                                                                                                                                                                                                                                                          | Covered for the declared direct-purchase whitelist and refill relation.                |
| Twist              | `RandomStoreItem`                                                                                                                                                                                                                                                                                                                                                                                                                            | Covered for the selected nested item; native unavailability reports a mismatch.        |
| Simulation-neutral | `ArmorBoostStore`, `DamageSelfDrop`, `HealDropRange`, `EmptyMaxHealthShopItem`, `FirstHitHealTrait`, `TemporaryDoorHealTrait`, `TemporaryHealExpirationTrait`, `TemporaryImprovedSecondaryTrait`, `TemporaryImprovedCastTrait`, `TemporaryMoveSpeedTrait`, `TemporaryImprovedExTrait`, `TemporaryImprovedDefenseTrait`, `MetaCurrencyRange`, `MetaCardPointsCommonRange`, `MemPointsCommonRange`, `SeedMysteryRange`, `LimitedManaRegenDrop` | Native pass-through after exact inventory and purchase realization.                    |

An uninteracted Well, Shop, Shrine, or Pool is Overview content, not an implied
Timeline transaction. Present and interacted are distinct published facts.
