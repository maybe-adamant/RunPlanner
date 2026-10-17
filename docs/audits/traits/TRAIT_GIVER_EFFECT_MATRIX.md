# Trait Giver Effect Matrix

## Scope and evidence

This audit states which one-use and screen-wide run effects apply to each
native trait or level screen source. It owns the per-giver applicability
matrix only. Arithmetic, construction order and effect lifecycles stay with
[boon rarity](BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md),
[initial offers](TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md),
[Persephone levels](PERSEPHONE_PREMIUM_EFFECTIVE_LEVEL_AUDIT.md) and
[Chaos](CHAOS_TRAIT_GAME_DATA_AUDIT.md).

Installed scripts checked on 2026-10-16. Abbreviations: RL `RoomLogic.lua`,
TL `TraitLogic.lua`, UCL `UpgradeChoiceLogic.lua`, EvL `EventLogic.lua`.

Every applicability decision reads flags on the screen **source**: the loot
table, the field NPC unit, or the bespoke NPC that opened the menu. Trait
identity matters only for the level roll (`IsGodTrait`) and Rarify
(`BlockMenuRarify`, declared next rarity).

## Matrix

Cells are `buff / use spent` where both apply. Y = yes, N = no.

### Loot class and one-use effects

| Source                                   | 1. Loot class                                                        | 2. Yarn     | 3. Ordinary | 4. Hymn           | 5. Rejected | 6. Concave Stone |
| ---------------------------------------- | -------------------------------------------------------------------- | ----------- | ----------- | ----------------- | ----------- | ---------------- |
| Olympians (nine `GodLoot` gods)          | `GodLoot`; trait is `IsGodTrait` plain and `ForShop`                 | Y / Y       | Y / Y       | Y / Y when seeded | Y / Y       | Y                |
| Hermes                                   | `TreatAsGodLootByShops`; `ForShop` only                              | Y / Y       | Y / Y       | N / N (a)         | Y / Y       | Y                |
| Hammer (`WeaponUpgrade`)                 | neither                                                              | N / N (b)   | N / N (b)   | N / N (a)         | N / N       | N                |
| Pom (`StackUpgrade`, Big, Triple)        | neither; `StackOnly`                                                 | N / N (b)   | N / N (b)   | N / N (a)         | N / N       | N                |
| Chaos (`TrialUpgrade`)                   | neither; `IgnoreTempRarityBonus`                                     | N / N       | N / N       | N / N (c)         | N / N       | N                |
| Artemis                                  | `TreatAsGodLootByShops` (field)                                      | Y / Y       | Y / Y       | N / N (a)         | Y / Y       | Y                |
| Athena field (`BaseAthenaCombat`)        | `TreatAsGodLootByShops` (field)                                      | Y / Y       | Y / Y       | N / N (a)         | Y / Y       | Y                |
| Athena Gorgon rank I                     | as Athena field                                                      | Y / Y       | Y / Y (d)   | N / N (a)         | Y / Y       | Y                |
| Athena Gorgon ranks II–IV                | as Athena field; `IgnoreTempRarityBonus` set                         | N / N       | Y / Y (d)   | N / N (a)         | Y / Y       | Y                |
| Dionysus                                 | `TreatAsGodLootByShops` (field)                                      | Y / Y       | Y / Y       | N / N (a)         | Y / Y       | Y                |
| Hades                                    | `TreatAsGodLootByShops` (field); `ExcludeFromLastRunBoon`            | N / N       | N / N       | N / N (a)         | N / N       | N                |
| Arachne, Narcissus, Medea, Circe, Icarus | neither (bespoke menu)                                               | N / N (e)   | N / N (e)   | N / N (e)         | N / N       | N                |
| Echo menu (`EchoChoice`)                 | neither (bespoke menu)                                               | N / N (e)   | N / N (e)   | N / N (e)         | N / N       | N                |
| Echo last-run boon menu (BBB)            | neither; rows are `IsGodTrait` `ForShop`+`ForLastRunBoon` traits     | N / N (e)   | N / N (e)   | N / N (e)         | N / N       | N                |
| Echo `LastReward` copy                   | the recreated provider's own loot                                    | as provider | as provider | as provider       | as provider | as provider      |
| Shop boon, Shop Hermes, mystery box      | provider's own loot; `BoughtFromShop`                                | as provider | as provider | as provider       | as provider | as provider      |
| Devotion chosen and spurned              | Olympian `GodLoot`                                                   | Y / Y       | Y / Y       | Y / Y when seeded | Y / Y       | Y                |
| Selene SpellDrop, Path of Stars          | not an upgrade-choice screen (`OpenSpellScreen`, `OpenTalentScreen`) | N           | N           | N                 | N           | N                |
| Nemesis trade                            | not an upgrade-choice screen (`OpenTradeScreen`)                     | N           | N           | N                 | N           | N                |

### Rarity, level, exchange, filters and reroll

| Source                     | 7. Rarify                    | 8. Other rarity inputs                                                              | 9. Level                                     | 10. Exchange (`ReplaceChance`)           | 11. Menu-time option filters                                                | 12. Reroll           |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | -------------------- |
| Olympians                  | Card + provider keepsake (f) | `BoonData` base; room else item override; all bonuses; default order; first run (g) | stack roll (h); Hymn +2 on exchange rows (i) | Y, plus vacancy rescue                   | `IsTraitEligible`, unheld, slot priority, linked priority                   | computed (j)         |
| Hermes                     | Card                         | `HermesData` base; default order                                                    | N (not `IsGodTrait`)                         | N (no priority list)                     | as Olympians                                                                | computed             |
| Hammer                     | N                            | forced Common                                                                       | N                                            | N                                        | `GetEligibleWeaponTraits`                                                   | allowed, Hammer cost |
| Pom                        | N                            | forced Common                                                                       | `StackNum` 1/2/3 (k)                         | N                                        | `GetAllUpgradeableGodTraits(StackNum)`, bans ignored                        | computed             |
| Chaos                      | N                            | `BoonData` base + item override; unlimited non-`GodLootOnly` bonuses; pair roll     | N                                            | N                                        | `GetEligibleTransformingTrait`                                              | never blocked (l)    |
| Artemis                    | Card                         | `BoonData` base; order C/R/E; NPC `RarityChances` unread                            | N                                            | N (`PriorityUpgrades = {}`)              | ordinary over its `Traits`                                                  | computed             |
| Athena field               | Card                         | order C/R/E/H                                                                       | N                                            | N                                        | ordinary                                                                    | computed             |
| Gorgon rank I              | Card                         | loot override Common = 1                                                            | N                                            | N                                        | ordinary                                                                    | computed             |
| Gorgon ranks II–IV         | Card                         | loot override Rare/Epic/Heroic = 1; temporary bonuses ignored                       | N                                            | N                                        | ordinary                                                                    | computed             |
| Dionysus                   | Card                         | default order; profile dialogue override Epic = 1 (m)                               | N                                            | N                                        | ordinary                                                                    | computed             |
| Hades                      | N (n)                        | `BoonData` base + permanent bonuses; order Common/Heroic                            | N                                            | N (`PriorityUpgrades = {}`)              | ordinary                                                                    | computed             |
| Arachne … Icarus           | N                            | option `Rarity` with one `PassRarityCheck` redraw (o); Dream ordinal (p)            | N                                            | N                                        | option `GameStateRequirements`; `PriorityRequirements` first                | blocked              |
| Echo menu                  | N                            | every option Epic; Dream ordinal (p)                                                | N (`IgnoreStackBoost`)                       | N                                        | as above, no `PassRarityCheck`                                              | blocked              |
| Echo last-run boon (BBB)   | N                            | previous run's cached rarity; active Proper floors Common to Rare; no Dream         | N (`IgnoreStackBoost`)                       | N                                        | `IsTraitEligible`, unheld, slot free, not `ExcludeTraitFromLastRunBoonPool` | blocked              |
| Echo `LastReward` copy     | as provider                  | as provider                                                                         | as provider, including stack roll            | as provider                              | as provider                                                                 | as provider          |
| Shop, Shop Hermes, mystery | as provider                  | Boosted item override; delayed Shrine reads host room (q)                           | as provider                                  | as provider                              | as provider                                                                 | as provider          |
| Devotion chosen, spurned   | Card + provider keepsake     | `BlockRarities` Duo writes Duo chance 0                                             | as Olympians                                 | Y; `ExchangeOnlyFromLootName` unread (r) | as Olympians                                                                | computed             |

## Notes

- **Classification.** `FieldLootData` registers each NPC with
  `TreatAsGodLootByShops` and traits (RunData.lua:555–569): Artemis, Athena,
  Dionysus, Hades. `IsGodTrait` without `ForShop` accepts only `GodLoot`
  sources (TL:1547). Arachne, Narcissus, Medea, Circe, Icarus and Echo carry
  neither flag.
- **Yarn.** `GetRarityChances` applies `GodLootOnly` bonuses to `GodLoot` or
  `TreatAsGodLootByShops` (RL:2160–2177). `SetTraitsOnLoot` sets
  `RarityBoosted` whenever the loot is not forced and not
  `IgnoreTempRarityBonus` (TL:1765–1779); closing spends the first limited
  `RarityBonus` trait unless `ForceCommonWithoutCurse` (UCL:1127–1129). Every
  held Yarn adds; one is spent per screen.
- **Ordinary.** `IsRarityForcedCommon` forces `StackUpgrade`/`WeaponUpgrade`
  before the curse check, then forces god/shop-aware loot lacking
  `BlockForceCommon` (RL:2093–2124). The use is spent only when the curse was
  the cause (UCL:1124–1126). Forcing skips `GetRarityChances`, so a Gorgon
  override is never read (d).
- **Hymn.** `ForceSwaps` seeds a swap from `PriorityUpgrades` ahead of the
  ordinary replacement roll (TL:1791–1802); `UseSwapTrait` spends it at close
  (UCL:1134–1143). (a) No priority list exists, so no row is seeded and the use
  is kept. (c) Transforming loot returns before the swap stage (TL:1787).
- **Rejected.** `CalcNumLootChoices` removes one row only on god/shop-aware
  loot without `IgnoreRestrictBoonChoices` (TL:1746–1753); a two-row screen has
  no locked row (UCL:153–162). Closing such a screen spends a use whether or
  not a row was locked (UCL:1131–1133).
- **Concave Stone.** Procs after a selection on god/shop-aware loot without
  `BlockDoubleBoon`; the residual is any other button except an exchange row
  (UCL:1002–1012). Locked Rejected buttons remain in `screen.UpgradeButtons`
  (UCL:441–446).
- (b) `StackUpgrade` and `WeaponUpgrade` set `ForceCommonWithoutCurse`; nothing
  is boosted or spent.
- (e) Bespoke menus preset `UpgradeOptions` (EvL:906–1250, 1580–1625), so
  `CreateBoonLootButtons` never calls `SetTraitsOnLoot` (UCL:117–121). No
  `RarityBoosted`, `ForceCommon` or `UseSwapTrait` is recorded, and the source
  flags fail every god/shop-aware check at close.
- (f) Rarify requires a god/shop-aware source (UCL:1209). Calling Card also
  requires Fated and a source without `ExcludeFromLastRunBoon`; a provider
  keepsake matches its loot name and takes precedence (UCL:1215–1230,
  `TraitData_Keepsake.lua:2338`). Rows need no `BlockMenuRarify` and a
  declared next rarity (UCL:1282).
- (g) `ForceLootTableFirstRun`/`ForceCommonLootFirstRun` on `F_Combat01` with
  zero completed runs (RL:2095, TL:1794).
- (h) A row rolls `MaxBonusBoonRankWeighted` (Aspect of Persephone,
  `TraitData_Aspect.lua:1997`) and adds Fated `FatedBoonLevelBonus`
  (Jeweled Pom, `TraitData_Keepsake.lua:2433`) when the trait is
  `IsGodTrait`, not `BlockStacking`, and the source lacks `IgnoreStackBoost`
  (UCL:295–310).
- (i) `ExchangeLevelBonus` is read for every `TraitToReplace` row while Hymn
  is held (UCL:324), not only for the seeded swap.
- (j) `BlockReroll` is true only when no candidate remains (TL:1994–2000);
  rerolls require `PanelRerollMetaUpgrade` (UCL:225).
- (k) `FatedPomLevelBonus` is read (UCL:142, TL:2621) but no installed trait
  declares it.
- (l) `SetTransformingTraitsOnLoot` never writes `BlockReroll`.
- (m) `DionysusAboutAmbrosia03` overwrites Dionysus with
  `BoonRaritiesOverride = { Epic = 1 }` (`NPCData_Dionysus.lua:1594–1618`);
  it requires prior-run gift records.
- (n) Hades declares `ExcludeFromLastRunBoon`, and its traits declare
  `BlockInRunRarify`.
- (o) An option declaring `Rarity` is redrawn once when
  `PassRarityCheck` fails and another option remains; the redraw is not
  rechecked (EvL:988, 1039, 1089, 1145, 1225; RL:2184). The check reads the room
  override and permanent, non-`GodLootOnly`
  bonuses only.
- (p) On Dream runs every row becomes `RarityUpgradeOrder[EnteredBiomes]`.
- (q) See the delayed Shrine section of the rarity audit.
- (r) `CreateLoot` stores `ExchangeOnlyFromLootName` (RL:2254) but nothing
  reads it; `GetReplacementTraits`' `onlyFromLootName` is never passed.

Closing any upgrade screen rebuilds every live loot without its creation
arguments (UCL:1144–1155). A `BlockRarities` argument is therefore lost if
another screen closes first.

## Planner disposition

| Source                    | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Olympians                 | Modelled. Rarity facts: `boonRarityFactsForOffer` (`simulation/traits/offers.ts`). Ordinary, Hymn and exchange chance: `offerGenerationAdjustedGiverSource`, `boonReplacementChance`. Rejected: `rejectedBlocksRow`. Yarn/Hymn spend and Ordinary/Rejected clocks: `trait-settlement/coordinator.ts`. Hymn +2: `assessTraitOffer` (`traits/authoring/assessment.ts`). Stone: `concaveStoneProcGiver`. Rarify: `rarificationUsesForGiver`. Levels: `traits/offer-levels.ts`. Rerolls are out of scope. |
| Hermes                    | Modelled through `providerKind: 'hermes'` and the Hermes base ledger.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Hammer                    | Modelled as a rarityless giver (`rarityPolicy: none`); no screen effects apply.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Pom                       | Modelled as a level resolution (`traits/level-effects.ts`). `FatedPomLevelBonus` has no declaration to model.                                                                                                                                                                                                                                                                                                                                                                                         |
| Chaos                     | Modelled as a Chaos offer (`chaosPairRarities`); no screen expectation.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Artemis, Athena, Dionysus | Modelled: `shopAwareGodTrait` with selectable rarity makes them ordinary-ledger, Ordinary, Rejected, Yarn and Stone screens; roll orders are declared.                                                                                                                                                                                                                                                                                                                                                |
| Gorgon                    | Modelled: lowest reachable rarity for all rows; `suppressTemporaryBoonRarity` above rank I (`gorgon-started.ts`).                                                                                                                                                                                                                                                                                                                                                                                     |
| Hades                     | Modelled exclusions: `rarityPolicy: none` removes Ordinary, Rejected and Yarn; `blocksConcaveStone`; no `callingCardMenu`. Hades rarity is intentionally out of scope.                                                                                                                                                                                                                                                                                                                                |
| Bespoke NPC menus         | Modelled as `acquisitionOrdinalMenu` givers with no screen effects. NPC rarity is the biome ordinal by design; `PassRarityCheck` weighting is out of scope.                                                                                                                                                                                                                                                                                                                                           |
| Echo last-run boon (BBB)  | Modelled as an authored one-row direct acquisition (`echoLastRunBoonOutcomes`, `applyEchoLastRunBoonForAcquisition`): no Rarify, no Yarn/Hymn spend, stack boosts suppressed. See discrepancy 3.                                                                                                                                                                                                                                                                                                      |
| Echo `LastReward` copy    | Modelled as the provider's screen except stack boosts. See discrepancy 2.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Shop and mystery box      | Modelled: `shopOffer` origin with the exact item override.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Devotion                  | Modelled through `devotionNoDuo`; the unread exchange restriction is correctly absent.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Selene, Path of Stars     | Modelled as a spell giver; the screen expectation omits Stone.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Nemesis trade             | Not a trait screen; its loot reset is owned by the initial-offer audit.                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Discrepancies

1. **Concave Stone excludes the Rejected row.** `concaveStoneResidualOptionKeys`
   (`simulation/keepsakes/trait-effects.ts`) drops `rejectedOptionKey`.
   Native residuals exclude only exchange rows (UCL:1002–1012), and the locked
   button remains in `screen.UpgradeButtons`, so Stone can grant it.
2. **Echo `LastReward` suppresses stack boosts.** The coordinator sets
   `stackBoostsSuppressed` for producer `EchoLastReward`
   (`trait-settlement/coordinator.ts`). Native `EchoLastReward` (EvL:1537–1560)
   recreates `LootData[LastReward.Name]`, which has no `IgnoreStackBoost`; that
   flag belongs to `NPC_Echo_01` (`NPCData_Echo.lua:25`) and reaches only
   Echo's own menus. The Persephone audit's "Echo-owned recreated screen"
   statement shares the error.
3. **BBB spends Chaos screen clocks.** The direct BBB settlement calls
   `consumeChaosGodScreen` with the row's Olympian or shop-aware giver, which
   advances Ordinary and Rejected. Native BBB's source is a copy of
   `NPC_Echo_01`, so neither use is spent (UCL:1124–1133). Its trace also
   reaches `traitScreenExpectation` with that giver, which can publish Yarn,
   Hymn and Stone expectations that a native Echo screen cannot have.

## Uncertainties

- Discrepancies 1 and 3 are established from source and planner code, not
  live play or a planner test.
- The lost `BlockRarities` on rebuild matters only if another upgrade screen
  closes in the room before a Devotion loot is opened. No such route was
  identified.
- No declared `RarityBonus` adds a Heroic chance, so Hades rows appear to roll
  Common except through rescue. This is unverified and outside the planner
  model.
