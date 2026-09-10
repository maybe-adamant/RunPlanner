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
- Focused offer adapters beneath `src/mods/room/timeline/acquisitions/` in the
  Plan Executor

## Provider contact matrix

| Provider family  | Providers                                                                             | Native contact                                                                         | Status                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Olympian         | Aphrodite, Apollo, Ares, Demeter, Hephaestus, Hera, Hestia, Poseidon, Zeus            | `UseLoot` -> `CreateBoonLootButtons` -> `HandleUpgradeChoiceSelection`                 | Covered by the focused ordinary acquisition adapter.                                                       |
| Hermes           | Hermes                                                                                | Same generic loot flow                                                                 | Covered by the focused ordinary acquisition adapter.                                                       |
| Hammer           | Weapon Upgrade                                                                        | Same generic choice flow with Hammer traits                                            | Covered by the focused ordinary acquisition adapter.                                                       |
| Spell            | Spell Drop                                                                            | Same generic choice flow, followed by Hex state                                        | Covered by the Spell/Hex adapter and fixed-route product; complete live native probing remains pending.    |
| Chaos            | Chaos curse/blessing pairs                                                            | Generic loot shell plus `CreateUpgradeChoiceButton` and scoped `GetProcessedTraitData` | Covered by the focused Chaos acquisition adapter.                                                          |
| Generic NPC loot | Artemis, Athena, Hades, Dionysus and other menus that ultimately create ordinary loot | Generic loot flow                                                                      | Covered only where the native menu actually reaches `UseLoot`.                                             |
| Bespoke NPC menu | Arachne, Narcissus                                                                    | `ArachneCostumeChoice` and `NarcissusBenefitChoice` in `Scripts/EventLogic.lua`        | Covered by the focused NPC acquisition adapter.                                                            |
| Bespoke NPC menu | Circe                                                                                 | `CirceBlessingChoice` in `Scripts/EventLogic.lua`                                      | Menu and exact selected consequences are covered; this is not O route-navigation evidence.                 |
| Bespoke NPC menu | Medea, Icarus, Echo                                                                   | Each NPC's named choice function in `Scripts/EventLogic.lua`                           | Menus and modeled consequences are covered; this remains distinct from enabling their P/H route structure. |

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

| Planner semantic             | Published form                                                         | Native contact                                                         | Status                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected option              | `ExecutionTraitOffer.selected`                                         | Initial row construction; selected nested-effect steering when present | Covered for ordinary Olympian, Hermes, and Hammer loot. Later player choice is conformance-owned.                                           |
| Rejected Chaos-curse option  | `rejected`                                                             | Native blocked-index list                                              | Covered for ordinary offers by identity after native sorting.                                                                               |
| Rarity                       | option `baseRarity` and `rarity`                                       | Choice data before button construction; room-exit trait conformance    | Covered; native rarification remains native and room-exit conformance owns the acquired rarity and retained charge ledger.                  |
| Effective level              | option `effectiveLevel`                                                | Choice data before button construction; room-exit trait conformance    | Covered as the planner's indivisible final fresh-offer value.                                                                               |
| Replacement                  | option `replacement`                                                   | `TraitToReplace` / `OldRarity` on the native option                    | Covered, including terminal absence of the replaced trait.                                                                                  |
| Mechanical steering mismatch | exact authored identity only                                           | Owning native offer or nested-effect contact                           | A claimed contact that cannot accept the published input mismatches; adapters do not rerun planner eligibility or compare later selections. |
| Chaos requirement and values | curse option, selected curse values, blessing, rarity, blessing values | Post-sort Chaos row construction and scoped processed-trait data       | Covered by the focused Chaos adapter.                                                                                                       |

## Exceptional selected dispositions

These families cannot inherit ordinary trait coverage merely because the
selected trait itself is equipped.

| Disposition              | Trait identities                                                                                                                                                                          | Authored consequence                                                                 | Current execution disposition                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `steadyGrowth`           | `BoonGrowthBoon`                                                                                                                                                                          | Forced rarity upgrade at each reached interval                                       | Covered by an `automatic:steadyGrowth` transaction and `AddRarityToTraits`.                                                                                                                                                                      |
| `naturalSelection`       | `GoodStuffBoon`                                                                                                                                                                           | Eight random eligible core-trait levels through `DistributeLevels`                   | Covered by the exact ordered target result and focused nested distribution adapter.                                                                                                                                                              |
| `ransom`                 | `SuperSacrificeBoonHera`, `SuperSacrificeBoonZeus`                                                                                                                                        | Remove opposing-provider traits and add levels through `SacrificeAllBoon`            | Native-authoritative pass-through; no removal/level replay or second proof is published.                                                                                                                                                         |
| `directTraitSets`        | `AllElementalBoon`                                                                                                                                                                        | Add the declaration-owned direct trait set through `GrantBoons`                      | Covered by the exact four-set result and focused nested grant adapter.                                                                                                                                                                           |
| `advanceCurrentKeepsake` | `KeepsakeLevelBoon`                                                                                                                                                                       | Advance the current keepsake through `AttemptAdvanceKeepsake`                        | Native-authoritative pass-through; room-exit keepsake conformance owns the retained change.                                                                                                                                                      |
| `worldShopRestock`       | `RestockBoon`                                                                                                                                                                             | Add the Travel Deal refill relation                                                  | Covered by the exact dynamic refill transaction; payment and the trait acquire function remain native-authoritative rather than becoming a second semantic authority.                                                                            |
| `producePickups`         | `RoomRewardBonusBoon`, `MoneyMultiplierBoon`, `NarcissusA`, `NarcissusB`, `NarcissusC`, `NarcissusD`, `NarcissusE`, `NarcissusG`, `NarcissusH`, `NarcissusI`                              | Create one or more acquisition sites                                                 | Native production remains trait-owned. Each participating pickup is a separate planner transaction and claims a compatible ready action at accepted acquisition; executor-side source-trait provenance is neither required nor inferred.         |
| `seaStar`                | `DoubleRewardBoon`                                                                                                                                                                        | Optional duplicate of an eligible pickup                                             | Covered: the current product retains explicit proc/no-proc for eligible closed carriers and scopes the native duplicate chance without binding the child object.                                                                                 |
| `circe`                  | `ArcanaRarityTrait`, `RemoveShrineTrait`, `RandomArcanaTrait`                                                                                                                             | Promote Arcana, disable a Vow, or activate Arcana                                    | Covered: the current product publishes the selected option's exact result and the focused Circe adapter constrains only native target selection. Room-exit Arcana/Fear conformance proves mutation; complete Surface live proof remains pending. |
| `echo`                   | `EchoLastReward`, `EchoDeathDefianceRefill`, `DiminishingDodgeBoon`, `DiminishingHealthAndManaBoon`, `EchoLastRunBoon`, `EchoDoubleLevelBoon`, `EchoDoubleShop`, `EchoRepeatKeepsakeBoon` | Last reward, survival, level, last-run boon, Shop duplicate, or keepsake replay      | Covered at the Echo contact: Boon and Pom publish exact volatile results; the other choices remain native-authoritative or hand later objects to their ordinary acquisition, purchase, or keepsake consumer.                                     |
| `noOp`                   | all 17 Chaos curses and 16 Chaos blessings                                                                                                                                                | The pair is applied by the Chaos offer contract, not by a post-selection disposition | Covered by the focused Chaos pair contact.                                                                                                                                                                                                       |

The primary source evidence for these effects remains in
[Run-impacting trait effects](../traits/RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md),
[Chaos traits](../traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md), and
[All Together and Shop traits](../traits/ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md).

## Level-result carrier matrix

| Source                                 | Planner result                                                          | Native carrier                                             | Status                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Pom of Power variants                  | explicit offered targets, selected target, count                        | Loot choice screen                                         | Covered by the visible-Pom adapter.                                                                    |
| Nectar                                 | one random eligible target, one level                                   | `UseStoreRewardRandomStack` -> `AddStackToTraits`          | Covered by the direct-level adapter.                                                                   |
| Pom Slice                              | one random eligible target, one level                                   | `UseStoreRewardRandomStack` -> `AddStackToTraits`          | Covered by the direct-level adapter.                                                                   |
| Echo Double Up                         | exact greatest-level target, including the no-target outcome            | `EchoDoubleLevelBoon` native target selection              | Covered; native `IncreaseTraitLevel` applies the mutation and room-exit trait conformance observes it. |
| Jeweled Pom                            | selected Hades trait on equip; later eligible boons gain levels         | keepsake equip contact plus ordinary offer effective level | Covered for the equip result and later offer data.                                                     |
| Sacrificial Hymn replacement           | replacement option level bonus                                          | ordinary trait option replacement metadata                 | Covered.                                                                                               |
| Aspect of Persephone / Premium Service | additive effective-level contribution fixed when the offer is generated | ordinary trait option `effectiveLevel`                     | Covered; execution consumes the final value and does not recompute its sources.                        |
| Natural Selection / Ransoms            | multiple level mutations                                                | trait-specific acquire functions                           | Natural Selection is covered by its exact nested target result; Ransoms remain native-authoritative.   |

## Trait removal contacts

Purging Pool sales and Nemesis trait trades publish exact trait keys and use
their own transaction types. Ransoms are not equivalent: their removals are a
consequence of acquiring a trait and can remove several traits. Native
`SacrificeAllBoon` remains authoritative for that deterministic removal/level
sequence; the executor neither publishes nor replays it.
