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

| Carrier                  | Game contacts                                                                                                       | Current disposition                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trait or Pom loot screen | `UseLoot`, `CreateBoonLootButtons`, `CreateUpgradeChoiceButton`, `HandleUpgradeChoiceSelection`, `HandleLootPickup` | Covered for published ordinary trait offers. Visible level resolutions retain a legacy adapter pending the bounded replacement in the level-acquisition audit.            |
| Direct consumable        | `UseConsumableItem`, its declared use function, `ConsumableUsedPresentation`                                        | Covered for simple published acquisitions. Consequential use functions need their own rows below.                                                                         |
| Direct random level item | `UseStoreRewardRandomStack` -> `AddStackToTraits`                                                                   | Adapter gap. The wire is complete, but the legacy hook begins before consumable acceptance; the corrected contact is specified in the level-acquisition audit.            |
| World Shop item          | `FillInShopOptions`, `SpawnStoreItemInWorld`, `RemoveStoreItem`; screen purchase uses `HandleStorePurchase`         | Covered for inventory identity, purchase binding, and published acquisition roles. Trait/level settlement occurs at the later native acquisition contact, not at payment. |
| Stygian Well item        | `FillInShopOptions`, `CreateStoreButtons`, `HandleStorePurchase`, `RestockWorldItem`                                | Covered for declared Well effects, Twist, Extended, Travel Deal refill, and runtime fallback binding.                                                                     |
| Generated pickup         | `CreateConsumableItem`, `CreateLoot`, `GiveLoot`, `SpawnRoomReward`                                                 | Covered when the execution role publishes a producer relation.                                                                                                            |
| Mystery Boon             | `UnwrapRandomLoot`, `GiveLoot`, `CreateLoot`, then the ordinary trait screen                                        | Covered for published box and hidden-source roles.                                                                                                                        |
| Resource pickup          | `UseConsumableItem` plus the resource's use function                                                                | Native pass-through unless the declaration adds a modeled level or element result.                                                                                        |

Choice construction additionally lives in `Scripts/UpgradeChoiceLogic.lua`.

## Closed reward identity inventory

### Trait and choice rewards

| Identities                                                                                                                                                                   | Planner result                                                                       | Status                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `AphroditeUpgrade`, `ApolloUpgrade`, `AresUpgrade`, `DemeterUpgrade`, `HephaestusUpgrade`, `HeraUpgrade`, `HestiaUpgrade`, `PoseidonUpgrade`, `ZeusUpgrade`, `HermesUpgrade` | Three-option trait offer and one selected trait                                      | Covered through the generic loot carrier.                                                                        |
| `StackUpgrade`, `StackUpgradeBig`, `StackUpgradeTriple`                                                                                                                      | Visible target choice plus level count                                               | Adapter gap pending the visible-Pom replacement specified in the level-acquisition audit.                        |
| `WeaponUpgrade`                                                                                                                                                              | Hammer trait offer                                                                   | Covered through the generic trait carrier.                                                                       |
| `SpellDrop`                                                                                                                                                                  | Ordered Hex offer; later Path state belongs to the selected spell                    | Covered as a trait offer. Hex-tree realization is deferred beyond F/G where unavailable.                         |
| `TrialUpgrade`                                                                                                                                                               | Three Chaos curse choices, each paired with a blessing; the selected pair is applied | Covered by the Chaos pair adapter. `TrialUpgrade` is the native Chaos loot identity, not a blessing-only reward. |
| `InfernalContractBoon`                                                                                                                                                       | Automatic encounter-clear trait, not a pickup                                        | Native pass-through. It is an Overview logical acquisition and must not be expected as a spawned room reward.    |

### Direct run-progress items

| Identities                                                                                                 | Planner result                              | Status                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MaxHealthDrop`, `MaxHealthDropBig`, `MaxHealthDropSmall`, `EmptyMaxHealthSmallDrop`, `EmptyMaxHealthDrop` | Health-state change                         | Native pass-through; health amount is outside simulation. Identity may still be forced and used by runtime fallback.                                  |
| `MaxManaDrop`, `MaxManaDropBig`, `MaxManaDropSmall`                                                        | Magick-state change                         | Native pass-through.                                                                                                                                  |
| `Currency`, `RoomMoneyDrop`, `RoomMoneySmallDrop`, `RoomMoneyTripleDrop`, `RoomMoneyTinyDrop`              | Gold-state change                           | Native pass-through.                                                                                                                                  |
| `TalentDrop`, `TalentBigDrop`, `MinorTalentDrop`                                                           | 3, 5, or 1 Path points                      | Deferred route for current F/G execution; the planner models the exact point result.                                                                  |
| `RoomRewardHealDrop`, `HealDrop`, `HealDropMinor`, `HealBigDrop`                                           | Healing                                     | Native pass-through.                                                                                                                                  |
| `RoomRewardConsolationPrize`                                                                               | Vow of Forfeit onion and biome consumption  | Covered for reward identity; Forfeit retained-state conformance is separately published.                                                              |
| `ArmorBoost`, `ArmorBigBoost`                                                                              | Armor                                       | Native pass-through and available as runtime fallbacks.                                                                                               |
| `AirBoost`, `EarthBoost`, `FireBoost`, `WaterBoost`, `ElementalBoost`                                      | Element contribution                        | Covered when the plan publishes the element contribution; generic direct-item settlement alone is not the authority for the resulting element ledger. |
| `StoreRewardRandomStack`                                                                                   | One random eligible trait gains one level   | Adapter gap at the direct `AddStackToTraits` carrier; it is not a Pom screen.                                                                         |
| `LastStandDrop`                                                                                            | Death Defiance                              | Covered as an acquisition identity with declared runtime fallback where eligibility is volatile.                                                      |
| `ChaosWeaponUpgrade`                                                                                       | Anvil result                                | Deferred route in current F/G execution.                                                                                                              |
| `GiftDrop`                                                                                                 | Nectar plus one random eligible trait level | Adapter gap for source-eligible level acquisition; the Nectar resource itself is simulation-neutral.                                                  |

### Meta-progression items

`MetaCurrencyDrop`, `MetaCurrencyBigDrop`, `MetaCardPointsCommonDrop`,
`MetaCardPointsCommonBigDrop`, `MemPointsCommonDrop`, `WeaponPointsRareDrop`,
`CardUpgradePointsDrop`, and `CharonPointsDrop` are native pass-through. They
may be present as required boss drops, ordinary resource pickups, or generated
items, but their amounts do not alter the simulation. Their native appearance
must not create a mismatch merely because the planner groups required boss
drops under one effect-neutral result.

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
