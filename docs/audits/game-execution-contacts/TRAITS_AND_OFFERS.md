# Traits and offers

The normalized catalog currently contains 23 providers: nine Olympians,
Hermes, the Hammer, Spell Drop, Chaos, and ten NPC/provider menus. Hundreds of
ordinary traits share one execution rule, so exhaustiveness is defined by the
catalog disposition rather than by copying every trait key into this audit.

## Source index

- Catalog inventory and dispositions:
  `packages/hades2-catalog/src/declarations/traits/`
- Execution offer shape:
  `packages/planner-engine/src/execution-plan/model.ts`
- Choice construction and selection: `Scripts/UpgradeChoiceLogic.lua:113-1000`
- Natural Selection, Ransoms, and All Together:
  `Scripts/TraitLogic.lua:2703-2790`
- Cherished Heirloom: `Scripts/PowersLogic.lua:4808-4810`
- Current offer adapters: `src/mods/hooks_timeline.lua` and
  `src/mods/native_timeline_adapters.lua` in the Plan Executor

## Provider contact matrix

| Provider family  | Providers                                                                             | Native contact                                                                                                  | Status                                                          |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Olympian         | Aphrodite, Apollo, Ares, Demeter, Hephaestus, Hera, Hestia, Poseidon, Zeus            | `UseLoot` -> `CreateBoonLootButtons` -> `HandleUpgradeChoiceSelection`                                          | Adapter gap; the exact contact is audited for C1.               |
| Hermes           | Hermes                                                                                | Same generic loot flow                                                                                          | Adapter gap; the exact contact is audited for C1.               |
| Hammer           | Weapon Upgrade                                                                        | Same generic choice flow with Hammer traits                                                                     | Adapter gap; the exact contact is audited for C1.               |
| Spell            | Spell Drop                                                                            | Same generic choice flow, followed by Hex state                                                                 | Covered for the spell offer; Hex progression is deferred route. |
| Chaos            | Chaos curse/blessing pairs                                                            | Generic loot shell plus `CreateUpgradeChoiceButton`, `GetProcessedTraitData`, and `SetTransformingTraitsOnLoot` | Covered for a published three-curse/selected-blessing result.   |
| Generic NPC loot | Artemis, Athena, Hades, Dionysus and other menus that ultimately create ordinary loot | Generic loot flow                                                                                               | Covered only where the native menu actually reaches `UseLoot`.  |
| Bespoke NPC menu | Arachne, Narcissus, Medea, Circe, Icarus, Echo                                        | Each NPC's named choice function in `Scripts/EventLogic.lua`                                                    | Covered by explicit provider adapters.                          |

## Exhaustive ordinary trait rule

Every normalized trait whose `selectedDisposition.kind` is `equip` is covered
by the provider contact above **if** the only authored result is the trait key,
rarity, effective level, replacement metadata, and ordinary equipment. This
set includes:

- all Arcana traits when granted as temporary traits;
- all eight Spell traits;
- ordinary Olympian, Hermes, NPC, and Infernal Contract traits;
- all 92 Hammer traits.

The executor may call the game's ordinary acquisition behavior after forcing
the selected option. It must not reproduce per-trait combat effects. This
predicate intentionally excludes every exceptional disposition below.

## Offer-level semantics

| Planner semantic             | Published form                                                         | Native contact                                                     | Status                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Selected option              | `ExecutionTraitOffer.selected`                                         | Choice-button construction and selection                           | Adapter gap pending exact loot/screen binding.                                                                         |
| Rejected Chaos-curse option  | `rejected`                                                             | Native blocked-index list                                          | Adapter gap; the identity must be reconciled after native sorting.                                                     |
| Rarity                       | option `rarity`                                                        | Choice data before button construction                             | Protocol gap only for base rarity; effective rarity and room-exit charge conformance are already present.              |
| Effective level              | option `effectiveLevel`                                                | Choice data before button construction                             | Adapter gap pending exact native input and post-state proof.                                                           |
| Replacement                  | option `replacement`                                                   | `TraitToReplace` / `OldRarity` on the native option                | Adapter gap; terminal proof must also establish removal of the replaced trait.                                         |
| Runtime fallback             | one-step preferred/fallback plus availability contact                  | Trait, inventory, purchase, or NPC-consumable availability contact | Covered for the four declared contacts. Taking the declared fallback completes the same owner and is not a divergence. |
| Chaos requirement and values | curse option, selected curse values, blessing, rarity, blessing values | Chaos option construction and processed-trait data                 | Covered.                                                                                                               |

## Exceptional selected dispositions

These families cannot inherit ordinary trait coverage merely because the
selected trait itself is equipped.

| Disposition              | Trait identities                                                                                                                                                                          | Authored consequence                                                                 | Current execution disposition                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steadyGrowth`           | `BoonGrowthBoon`                                                                                                                                                                          | Forced rarity upgrade at each reached interval                                       | Covered by an `automatic:steadyGrowth` transaction and `AddRarityToTraits`.                                                                                                                                                 |
| `naturalSelection`       | `GoodStuffBoon`                                                                                                                                                                           | Eight random eligible core-trait levels through `DistributeLevels`                   | Protocol gap unless the resulting targets are separately materialized as acquisition/level transactions; the selected trait key alone is insufficient.                                                                      |
| `ransom`                 | `SuperSacrificeBoonHera`, `SuperSacrificeBoonZeus`                                                                                                                                        | Remove opposing-provider traits and add levels through `SacrificeAllBoon`            | Protocol gap unless the exact removal and level result is published. Generic trait selection cannot prove the planner-authored result.                                                                                      |
| `directTraitSets`        | `AllElementalBoon`                                                                                                                                                                        | Add the declaration-owned direct trait set through `GrantBoons`                      | Protocol gap unless the exact granted set is published; the game may execute it naturally, but the executor currently has no result contract.                                                                               |
| `advanceCurrentKeepsake` | `KeepsakeLevelBoon`                                                                                                                                                                       | Advance the current keepsake through `AttemptAdvanceKeepsake`                        | Adapter gap: the trait selection is covered, but its consequential keepsake mutation needs a concrete settlement contact or declared pass-through policy.                                                                   |
| `worldShopRestock`       | `RestockBoon`                                                                                                                                                                             | Add the Travel Deal refill/purchase relation                                         | Covered when the planner emits the Well refill and purchase transactions; the trait acquire function itself is not a second semantic authority.                                                                             |
| `producePickups`         | `RoomRewardBonusBoon`, `MoneyMultiplierBoon`, `NarcissusA`, `NarcissusB`, `NarcissusC`, `NarcissusD`, `NarcissusE`, `NarcissusG`, `NarcissusH`, `NarcissusI`                              | Create one or more acquisition sites                                                 | Covered when every generated pickup has a producer relation; otherwise protocol gap.                                                                                                                                        |
| `seaStar`                | `DoubleRewardBoon`                                                                                                                                                                        | Optional duplicate of an eligible pickup                                             | Partial: the positive child is published and forced for `UseLoot`, but v10 does not explicitly publish the negative result and the executor does not arm direct-consumable sources. Both outcomes and carriers remain open. |
| `circe`                  | `ArcanaRarityTrait`, `RemoveShrineTrait`, `RandomArcanaTrait`                                                                                                                             | Promote Arcana, disable a Vow, or activate Arcana                                    | Deferred route; exact selected result must be published before Circe execution can be covered.                                                                                                                              |
| `echo`                   | `EchoLastReward`, `EchoDeathDefianceRefill`, `DiminishingDodgeBoon`, `DiminishingHealthAndManaBoon`, `EchoLastRunBoon`, `EchoDoubleLevelBoon`, `EchoDoubleShop`, `EchoRepeatKeepsakeBoon` | Last reward, survival, level, last-run boon, Shop duplicate, or keepsake replay      | Deferred route. Each choice must map to its resulting acquisition, level, retained effect, or equip result; `EchoChoice` alone is only the menu carrier.                                                                    |
| `noOp`                   | all 17 Chaos curses and 16 Chaos blessings                                                                                                                                                | The pair is applied by the Chaos offer contract, not by a post-selection disposition | Covered by the Chaos pair adapter.                                                                                                                                                                                          |

The primary source evidence for these effects remains in
[Run-impacting trait effects](../traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md),
[Chaos traits](../traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md), and
[All Together and Shop traits](../traits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md).

## Level-result carrier matrix

| Source                                 | Planner result                                                          | Native carrier                                             | Status                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pom of Power variants                  | explicit offered targets, selected target, count                        | Loot choice screen                                         | Covered.                                                                            |
| Nectar                                 | one random eligible target, one level                                   | `UseStoreRewardRandomStack` -> `AddStackToTraits`          | Covered.                                                                            |
| Pom Slice                              | one random eligible target, one level                                   | `UseStoreRewardRandomStack` -> `AddStackToTraits`          | Covered.                                                                            |
| Echo Double Up                         | selected prior level outcome                                            | Echo choice/acquire function                               | Deferred route; requires an emitted level transaction, not only the Echo trait key. |
| Jeweled Pom                            | selected Hades trait on equip; later eligible boons gain levels         | keepsake equip contact plus ordinary offer effective level | Covered for the equip result and later offer data.                                  |
| Sacrificial Hymn replacement           | replacement option level bonus                                          | ordinary trait option replacement metadata                 | Covered.                                                                            |
| Aspect of Persephone / Premium Service | additive effective-level contribution fixed when the offer is generated | ordinary trait option `effectiveLevel`                     | Covered; execution consumes the final value and does not recompute its sources.     |
| Natural Selection / Ransoms            | multiple level mutations                                                | trait-specific acquire functions                           | Protocol gap until exact results are published.                                     |

## Trait removal contacts

Purging Pool sales and Nemesis trait trades publish exact trait keys and use
their own transaction types. Ransoms are not equivalent: their removals are a
consequence of acquiring a trait and can remove several traits. They require a
published exact result rather than reuse of Pool or Nemesis semantic policy.
