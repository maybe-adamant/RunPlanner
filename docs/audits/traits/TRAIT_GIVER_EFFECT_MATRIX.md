# Trait Giver Effect Matrix

## Scope and evidence

This audit states which one-use and screen-wide run effects apply to each
native trait or level screen source, and where each effect is read, spent,
modelled, published and checked. Arithmetic and construction order stay with
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
| Echo last-run boon (BBB)  | Modelled as an authored one-row direct acquisition (`echoLastRunBoonOutcomes`, `applyEchoLastRunBoonForAcquisition`) whose screen source is Echo: no Rarify, Yarn, Hymn, Stone or Ordinary/Rejected use; stack boosts suppressed; the screen expectation publishes only `rarityFloor`.                                                                                                                                                                                                                |
| Echo `LastReward` copy    | Modelled as the provider's own screen, including the stack-boost level roll.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Shop and mystery box      | Modelled: `shopOffer` origin with the exact item override.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Devotion                  | Modelled through `devotionNoDuo`; the unread exchange restriction is correctly absent.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Selene, Path of Stars     | Modelled as a spell giver; the screen expectation omits Stone.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Nemesis trade             | Not a trait screen; its loot reset is owned by the initial-offer audit.                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Effect lifecycle

Read points: a loot built by `CreateLoot` rolls at spawn (RL:2266); a field
NPC rolls at first button build (UCL:117–121), which the module forces with
`ordinary.ensureRolled`. Every screen close re-rolls each live loot
(UCL:1144–1155). The roll sets `ForceCommon`, `ForceCommonWithoutCurse`,
`RarityBoosted` and `UseSwapTrait` but never clears them, so they are sticky
across re-rolls. The module's screen checks, steering and fences follow
[Game Integration Boundary](../../design/GAME_INTEGRATION_BOUNDARY.md#execution-ownership)
(trait screen dependencies and screen checks). "Exit" below means room-exit
conformance (`room/conformance/readers.lua`).

| Effect                             | 1. Native read                                                                                                      | 2. Native spend                                                                | 3. Gate                    | 4. Planner model                                                                                  | 5. Published                                      | 6. Module                                                                                                                                                           | 7. Order exposure                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Yarn                               | roll: every held Yarn adds (RL:2160); sets sticky `RarityBoosted` (TL:1777)                                         | close: one use if `RarityBoosted` and not `ForceCommonWithoutCurse` (UCL:1127) | column 2                   | `boonRarityFactsForOffer`; spend in `trait-settlement/coordinator.ts`                             | `yarnUses`, `consumesYarn`                        | open: `trait-screen-yarn`, `trait-screen-yarn-spend`; rows steered; exit `stygianWell`                                                                              | caught at open                                                                   |
| Ordinary curse                     | roll: `IsRarityForcedCommon` sets sticky `ForceCommon`/`ForceCommonWithoutCurse` (TL:1765)                          | close: one use if `ForceCommon` and not `ForceCommonWithoutCurse` (UCL:1124)   | column 3                   | `offerGenerationAdjustedGiverSource` (fresh Common, no replacement roll); `consumeChaosGodScreen` | `consumesOrdinary`                                | open: `trait-screen-ordinary-spend`; exit `chaos` remaining uses                                                                                                    | spend caught at open; remaining count at exit only                               |
| Sacrificial Hymn                   | roll: seeds a swap and sets sticky `UseSwapTrait` (TL:1796)                                                         | close: one use if `UseSwapTrait` (UCL:1134)                                    | column 4                   | replacement chance 1 in `offerGenerationAdjustedGiverSource`; spend in coordinator                | `hymnUses`, `consumesHymn`, row `replacement`     | open: `trait-screen-hymn`, `trait-screen-hymn-spend`; rows steered; exit `stygianWell`                                                                              | caught at open                                                                   |
| Rejected curse                     | button: `CalcNumLootChoices` (UCL:158) locks a random index                                                         | close: one use on every qualifying screen (UCL:1132)                           | column 5                   | `rejectedBlocksRow`; `consumeChaosGodScreen`                                                      | `rejected` row key only                           | open: `trait-offer-blocked-row` (native `CalcNumLootChoices`); locked index steered (`alignRejected`); exit `chaos` remaining uses                                  | three-row screens at open; two-row screens and the spend at exit only            |
| Concave Stone                      | pick: `Uses`, source flags, chance roll, non-exchange residual (UCL:1002–1012)                                      | pick: `ReduceTraitUses` on proc (UCL:1011)                                     | column 6                   | `concaveStoneProcGiver`; `concave-stone-secondary.ts`                                             | `concaveStone`; row `concaveStoneResult`          | open: `trait-screen-concave-stone`, `-giver`; pick: roll and residual steered (`keepsakes/concave_stone.lua`); missing roll is a diagnostic; exit `keepsakeEffects` | uses caught at open; Rack fence                                                  |
| Rarify / Calling Card              | button and hover: source precedence (UCL:1215, 1377)                                                                | click: one `RarityUpgradeData.Uses` (UCL:1249)                                 | column 7                   | `rarificationUsesForGiver`; `evaluateCallingCardOffer`                                            | `rarifyUses`; row `baseRarity` and final `rarity` | open: `trait-screen-rarify`; clicks are the player's; exit `traitInventory` rarity and `keepsakeEffects` charges                                                    | uses caught at open; Rack fence; clicks at exit only                             |
| Exchange level bonus               | button: held level plus `ExchangeLevelBonus` while Hymn is held (UCL:322–324)                                       | none; ends when Hymn is removed                                                | exchange rows              | `assessTraitOffer` level bonus; `resolveTraitOfferOptionLevel`                                    | row `effectiveLevel`, `replacement.levelBonus`    | open: `trait-screen-exchange-level`; native computes the installed row's level                                                                                      | caught at open                                                                   |
| Fated boon bonus / Jeweled Pom     | button: `FatedBoonLevelBonus + 1` inside the stack roll when Fated (UCL:307); only Jeweled Pom declares it          | none; Rack or Unfated ends it                                                  | column 9 (h)               | `offer-levels.ts` (`keepsakes.jeweledPom`)                                                        | row `effectiveLevel`                              | steered: row `StackNum` installed (`row_options.lua`); not compared with native                                                                                     | Rack fence; otherwise exit level only                                            |
| Fated Pom bonus                    | button: `FatedPomLevelBonus` added to `StackNum` once, not on reroll (UCL:142)                                      | none                                                                           | Pom                        | none; no trait declares it                                                                        | `levelCount`                                      | open: `trait-screen-pom-level`; masked to 0 during row build (`levels/hooks.lua`)                                                                                   | none possible                                                                    |
| Persephone `MaxBonusBoonRank` roll | button: weighted roll per row (UCL:299–306)                                                                         | none                                                                           | column 9 (h)               | `offer-levels.ts`; authored `persephoneLevelBonus`                                                | row `effectiveLevel`                              | steered as Jeweled Pom; not compared                                                                                                                                | Premium Service from another giver earlier in the room: nothing; exit level only |
| Proper Upbringing floor            | roll: Rare +1 while `Activated`; BBB build floors Common (EvL:1600–1609); Stone residual `UpgradeOnPick` (UCL:1020) | none; activation state                                                         | god rolls, BBB, Stone      | `boonRarityFactsForOffer`; history `properUpbringingActive`; `echoLastRunBoonOutcomes`            | `rarityFloor` (BBB only)                          | BBB open: `trait-screen-rarity-floor`; ordinary rows steered; exit rarity                                                                                           | BBB at open; ordinary screens at exit only                                       |
| Native legality filters            | roll or menu build: `IsTraitEligible`, held, slot, requirements; `ChanceToPlay` rolls in `IsGameStateEligible`      | n/a                                                                            | column 11                  | `assessTraitOffer`; `authoring/initial-composition.ts`                                            | rows                                              | open: `screen_checks.lua` row checks; NPC `npc-trait-requirements`; `ChanceToPlay` stripped                                                                         | caught at open                                                                   |
| `PassRarityCheck` re-pick          | NPC menu build: one redraw (EvL:988, 1039, 1089, 1145, 1225)                                                        | n/a                                                                            | bespoke NPC menus          | not modelled; NPC rarity is the biome ordinal                                                     | none                                              | steered: forced pass during a steered NPC menu (`npc/hooks.lua`)                                                                                                    | none possible                                                                    |
| Keepsake Rack change               | changes the keepsake read by Stone, Rarify, Jeweled Pom and Fated status (`KeepsakeLogic.lua:833, 1222–1235`)       | n/a                                                                            | none                       | keepsake state; fences in `execution-plan/assembly/timeline-dependencies.ts`                      | fence edges                                       | `transaction-prerequisite`; exit `keepsakeEffects`                                                                                                                  | fence                                                                            |
| Fountain / Phial                   | use: Phial promotes a Common boon (`InteractLogic.lua:741`), changing exchange `OldRarity` and rarity counts        | cooldown                                                                       | none                       | `keepsakes/trait-effects.ts`; fences as above                                                     | fence edges                                       | `transaction-prerequisite`; exchange rows at open; exit rarity                                                                                                      | fence                                                                            |
| Denial bans                        | pick: unpicked rows banned unless a Stone pick (UCL:974); roll: final rescue off                                    | n/a                                                                            | `BanUnpickedBoonsEligible` | `denialBannedTraitKeys`                                                                           | none                                              | later screen open: `IsTraitEligible`; `bannedTraits` is diagnostic only                                                                                             | caught only where a later screen offers a banned trait                           |

## Gaps

1. **Modelled but not published.** The Rejected spend (only the `rejected`
   row is published); Ordinary and Rejected remaining uses at screen open;
   Persephone, Jeweled Pom and Proper inputs on ordinary screens (only the
   resulting `effectiveLevel` and rarity); the Denial ban set; the other
   rarity-ledger inputs. Any expectation field on which reached branches
   disagree is dropped (`agreedScreenExpectation`).
2. **Published but not checked at the screen.** Final row `rarity` and Calling
   Card clicks (exit only); non-exchange `effectiveLevel`, which is installed as
   `StackNum` rather than compared; the Stone roll's presence (a missing roll is
   a diagnostic). Chaos screens publish no expectation.
3. **Checked by copied native logic.**
   - The spend predicates copy the close-time checks (UCL:1124–1137) and add a
     held-effect check for sticky flags. Yarn's copy omits the
     first-limited-`RarityBonus` ordering, which is harmless while Yarn is the
     only limited `RarityBonus` trait.
   - Stone `giverProcs` copies only the source-flag half of UCL:1003, not the
     `Uses`, chance or residual set.
   - `rarifyUses` copies the UCL:1377 precedence and `RequireFated`, not
     `MaxRarity`, `BlockMenuRarify` or `MultiUse`.
   - The exchange level copies UCL:322–324; the Pom level copies UCL:135–143.
   - The BBB rows copy the EvL:1597–1611 filter through native helpers.
   - `withoutChance` copies the `ChanceToPlay` semantics of
     `RequirementsLogic.lua:35–40`; every module requirement check, the NPC
     check included, strips it.
4. **Order exposure caught by nothing or only at exit.**
   - Exit only: Rejected on two-row screens and its spend; Ordinary and
     Rejected remaining counts; Calling Card and keepsake rarify clicks;
     Proper activation order across givers on ordinary screens.
   - Nothing: Persephone and Jeweled Pom levels against Premium Service or
     another giver's earlier screen, because steering installs the planned
     level. Pool sales, Eris and Shrine purchases are untransacted and
     unenforced. Denial bans are caught only when a later screen offers a
     banned trait.

## Discrepancies

None open. Resolved:

1. **Concave Stone and the Rejected row.** Native residuals exclude only
   exchange rows (UCL:1002–1012), and the locked button remains in
   `screen.UpgradeButtons`, so Stone can grant it.
   `concaveStoneResidualOptionKeys` now keeps the Rejected row.
2. **Echo `LastReward` stack boosts.** Native `EchoLastReward` (EvL:1537–1560)
   recreates `LootData[LastReward.Name]`, which has no `IgnoreStackBoost`; that
   flag belongs to `NPC_Echo_01` (`NPCData_Echo.lua:25`) and reaches only
   Echo's own menus. The copy no longer suppresses stack boosts.
3. **BBB Chaos screen uses.** Native BBB's source is a copy of `NPC_Echo_01`,
   so neither Ordinary nor Rejected is spent (UCL:1124–1133). The direct BBB
   settlement now reads Echo as its screen source for curse uses and Stone,
   and its nested trace is not published as a screen expectation.

## Uncertainties

- The resolved discrepancies 1 and 3 are established from source, not live
  play.
- The lost `BlockRarities` on rebuild matters only if another upgrade screen
  closes in the room before a Devotion loot is opened. No such route was
  identified.
- No declared `RarityBonus` adds a Heroic chance, so Hades rows appear to roll
  Common except through rescue. This is unverified and outside the planner
  model.
