# Trait legality pipeline: native boon-offer construction versus the planner

## Question

Is the planner's ordinary trait (boon) legality model faithful to the game's
boon-offer pipeline end to end: queue formation, core-slot seeding, Duo and
Legendary entry, fallback and denial, reroll/exchange contacts, and the timing
at which legality is decided? Where it is not, which divergences admit offers
the game cannot produce, forbid offers it can, or only mis-describe the model?

Scope is the ordinary Olympian and Hermes screen (`SetTraitsOnLoot`). Chaos,
Selene, Echo, Hammer, Pom and field/Story NPC screens are mentioned only where
they share a contact with it. Baseline: progressed save (`CompletedRunsCache

> = 2`), non-bounty, non-Dream, as the existing audits assume.

## Established facts (native, 2026-09-24)

Scripts: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`. Every claim
below was read from source; repo documents were not trusted for native facts.

### 1. Queue formation

God choice precedes and is independent of trait availability.
`ChooseLoot` (`RewardLogic.lua:1-13`) draws a random god from
`GetEligibleLootNames` (`RewardLogic.lua:187-207`), which filters only on
`GodLoot`, the loot's own `GameStateRequirements` and the four-god cap
(`ReachedMaxGods`, `RunLogic.lua:1835-1846`; `HeroData.lua:168`). No step
asks whether the chosen god still has an eligible trait.

A loot's trait queue is built by `SetTraitsOnLoot` (`TraitLogic.lua:1760-2002`).
Its declared inputs are the loot's `PriorityUpgrades`, `WeaponUpgrades` and
`Traits` arrays (e.g. `LootData_Zeus.lua:38-73`); for the nine Olympians the
priority and weapon arrays are the same five core keys. Hermes declares both
empty (`LootData_Hermes.lua:57-58`). The stage order is fixed:

| #   | Stage                        | Source                                                       | Rule                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Rarity source                | `TraitLogic.lua:1765-1785`                                   | `IsRarityForcedCommon` (`RoomLogic.lua:2093-2124`) → `RarityChances = {}`; otherwise `GetRarityChances` (`RoomLogic.lua:2126-2185`), which writes a present zero for every `RarityValues` key (`:2140-2143`). `args.BlockRarities` then writes present zeros (`:1781-1785`).                                                   |
| 1   | Replacement seed             | `TraitLogic.lua:1791-1803`                                   | First-run table (excluded); else active `ForceSwaps` (Sacrificial Hymn, `TraitData_Store.lua:489-509`) calls `GetReplacementTraits`; else, if `BoonData.GameStateRequirements` pass (`HeroData.lua:172-178`), `RandomChance(ReplaceChance = 0.1)` (`HeroData.lua:188`) and not `ForceCommon`, the same helper.                 |
| 2   | Core seeds                   | `TraitLogic.lua:1805-1814`                                   | Only if stage 1 produced nothing: `GetPriorityTraits(PriorityUpgrades)`. Otherwise the seeded replacement is removed from `chosenPriorityTraits`.                                                                                                                                                                              |
| 3   | Linked-priority seeds        | `TraitLogic.lua:1816-1826`                                   | `GetPriorityDependentTraits` (`UpgradeChoiceLogic.lua:855-876`): unowned, `IsTraitEligible`, `HasTraitRequirements`, and a `TraitRequirements[...].PriorityChance` (only `BlindChanceBoon`, `MassiveKnockupBoon`, `PoseidonStatusBoon`, all 0.25, `TraitData.lua:143,178,223`). Inserted while fewer than three.               |
| —   | `PriorityRequirements` seeds | `TraitLogic.lua:1831-1844`                                   | Dead for traits: no `TraitData*` declaration sets `PriorityRequirements` (only `NPCData`/`EventLogic` options do).                                                                                                                                                                                                             |
| 4   | Eligible pool                | `TraitLogic.lua:1859-1862`; `UpgradeChoiceLogic.lua:899-938` | Computed only if seeds < 3. `WeaponUpgrades` minus any whose slot is occupied by any hero trait (`GetEligibleWeaponTraits`, `:824-853`), plus `Traits` whose `TraitRequirements` pass or which have none (`GetEligibleTraitUpgrades`, `:877-897`); then drop owned traits and `IsTraitEligible` failures.                      |
| 5   | Rarity buckets               | `TraitLogic.lua:1864-1890`                                   | Every seed and pool entry joins `rarityTable[r]` for each key present in its `RarityLevels` (missing table = Common only).                                                                                                                                                                                                     |
| 6   | Seed rarity                  | `TraitLogic.lua:1902-1918`                                   | Explicit `Rarity` (replacements) kept; otherwise start Common and, in `RarityRollOrder` (`Common, Rare, Epic, Duo, Legendary`, `TraitData.lua:715`), each supported check that passes `RandomChance` overwrites. Seeds leave every bucket.                                                                                     |
| 7   | Ordinary fill                | `TraitLogic.lua:1920-1947`                                   | Exactly `3 - #seeds` attempts. Each starts from a random Common-bucket entry (may be nil) and is overwritten by every later nonempty bucket whose check succeeds; the final identity leaves all buckets. A nil attempt adds nothing.                                                                                           |
| 8   | Replacement rescue           | `TraitLogic.lua:1949-1961`                                   | For each vacancy, one random `GetReplacementTraits(chosenPriorityTraits)` result; no chance roll and no `ForceCommon` guard.                                                                                                                                                                                                   |
| 9   | Rarity rescue                | `TraitLogic.lua:1963-1991`                                   | Only when `BanUnpickedBoonsShrineUpgrade.ChangeValue <= 0` (Denial off). Deterministic rarity: last roll-order bucket that is nonempty and whose chance key is **present** (Lua `0` is truthy); random identity. With an ordinary chance table this yields Epic for ordinary boons, or Duo/Legendary if one is still eligible. |
| 10  | Reroll block                 | `TraitLogic.lua:1993-2000`                                   | `BlockReroll` when no priority or bucket entries remain.                                                                                                                                                                                                                                                                       |

`IsTraitEligible` (`RunLogic.lua:99-133`) checks `MaxAmount`, the (empty)
legacy gate, the Unity/elemental progression gate (`TraitData.lua:725-733`),
`BlockOfferIfPreviouslyPicked` against `CurrentRun.PickedTraits`
(written on every selection, `UpgradeChoiceLogic.lua:993`),
`CurrentRun.BannedTraits`, and the trait's `GameStateRequirements`.
`HasTraitRequirements` (`RunLogic.lua:57-97`) accepts `OneOf`, `TwoOf` (no
declaration uses it) or `OneFromEachSet`. Weights: none — every random pick in
stages 1-9 is uniform (`GetRandomValue`/`RemoveRandomValue`); there is no
per-trait weight. The generator always targets `GetTotalLootChoices() = 3`
(`TraitLogic.lua:1756-1758`; `UpgradeChoiceData.lua:24`).

### 2. Core-slot logic

Slots are declared per trait (`Slot = "Melee" | "Secondary" | "Ranged" |
"Rush" | "Mana"`, e.g. `TraitData_Zeus.lua:6,795,1326,1417,1490`); Keepsake and
Spell slots exist but no priority trait uses them. Occupancy is "any hero trait
with that `Slot`".

`GetPriorityTraits` (`UpgradeChoiceLogic.lua:739-793`):

- a priority trait that passes `IsTraitEligible` and is unowned with a vacant
  slot joins U; an eligible one that is owned or slot-occupied sets H
  (`:758-771`); an ineligible one (e.g. Denial-banned) does neither;
- H → exactly one random member of U (none if U empty) (`:773-775`);
- not H → U trimmed at random to three (`:776-779`), and if none of the
  survivors is Melee/Secondary while U had one, option 1 is replaced by a
  random Melee/Secondary member (`:780-791`).

There is no per-god "first offer" flag, no `ForceCore`/`GuaranteedSlot` field
beyond this Attack/Special guarantee, and no keepsake contact with the queue.
Keepsakes act on god selection (`ForceBoonName`, `RewardLogic.lua:240-247`,
`RoomLogic.lua:2063-2068`), on rarity (`RarityBonus` contributions in
`GetRarityChances`) and on menu rarification (`RarityUpgradeData`,
`UpgradeChoiceLogic.lua:1217-1247`), never on identity eligibility.

Slot exclusion: stage 4 removes cores whose slot is taken by any god. The only
cross-god path into an occupied slot is replacement: `GetReplacementTraits`
(`UpgradeChoiceLogic.lua:795-822`) offers an eligible unowned priority trait
whose slot is occupied, at `GetUpgradedRarity(occupant max rarity)` over
`Common→Rare→Epic→Heroic` (`TraitData.lua:717`); a Heroic occupant has no
successor. Selection removes the occupant (`UpgradeChoiceLogic.lua:952-955`).
Hymn's `ExchangeLevelBonus` is read from the hero trait when each replacement
button is built (`:320-331`).

### 3. Duo and Legendary

Duos inherit `SynergyTrait` (`TraitData.lua:866-888`: `IsDuoBoon`,
`RarityLevels = { Duo }`, and a `GameStateRequirements` excluding Devotion
rooms); Legendaries inherit `LegendaryTrait` (`:827-840`, `RarityLevels =
{ Legendary }`). Their prerequisites are ordinary `TraitRequirements`
(`OneFromEachSet` across the two gods' sets, `TraitData.lua:318-653`), and each
Duo is listed in both gods' `Traits`. They enter stage 4 like any trait; their
only buckets are Duo/Legendary, so they appear only by winning that check in
stages 6/7 or through stage-9 rescue. Base chances: Duo 0.12, Legendary 0.10
(`HeroData.lua:181-187`); Hermes Legendary 0.01, no Duo (`:190-199`). They take
an ordinary position — no extra choice. No "seen"/"once offered" gate exists
(`GameState.Flags.SeenUnityBoons` is presentation only,
`UpgradeChoiceLogic.lua:187-202`); `BlockOfferIfPreviouslyPicked` applies to
`KeepsakeLevelBoon` alone among Duos.

Five Duos replace the inherited Devotion exclusion with their own table
(`TraitData_Duo.lua:527,757,965,1004,1297`) because `DeepInheritData`
(`RunData.lua:1390-1419`) never merges a child table. Devotion loot passes
`BlockRarities = { Duo = true }` (`EncounterLogic.lua:1686,1692`;
`RewardLogic.lua:396`), a present zero that stage 9 still honors.

### 4. Fallback and denial

- Stages 8-9 are the only in-generator fallbacks. There is no Pom, heal or
  consumable substitution row and no `AlwaysOffer`/`IfFewerThan` data.
- A short nonempty list is shown short. Only an empty list becomes the single
  `FallbackGold` row, at interaction time (`UpgradeChoiceLogic.lua:149-151`).
- A god is never "denied": selection (§1) never inspects trait supply, and the
  loot is never replaced by another god or reward because its queue is empty.
  The per-biome Vow of Forfeit substitution (`ShrineLogic.lua:918-929`, called
  from `RewardLogic.lua:363,370`) is reward-level and trait-blind.
- Vow of Denial (`MetaUpgradeData.lua:2073-2083`, `ChangeValue = 2`) bans up to
  two displayed non-selected names (`UpgradeChoiceLogic.lua:974-990`) and
  disables stage 9.
- Chaos Rejected (`ChaosRestrictBoonCurse`, `TraitData_Chaos.lua:1096-1101`,
  `RestrictBoonChoices`) does not change generation. `CalcNumLootChoices`
  (`TraitLogic.lua:1746-1754`) returns 2 for god/shop-aware loot, and
  `CreateBoonLootButtons` removes that many random indexes from
  `{1..#options}` (`UpgradeChoiceLogic.lua:153-162`). **Only a three-option
  screen keeps a blocked index**; a one- or two-option screen blocks nothing.

### 5. Reroll, exchange and NPC contacts

- `RerollBoonLoot` (`UpgradeChoiceLogic.lua:707-719`) reruns `SetTraitsOnLoot`
  with the current chance table frozen, room/all bonuses ignored, and **one**
  random current option excluded (`ExclusionNames`); other options may recur.
- Exchange is the replacement mechanism of §2. `ExchangeOnlyFromLootName`,
  written for the spurned Devotion loot (`RoomLogic.lua:2254`), is never read;
  `GetReplacementTraits`' `onlyFromLootName` parameter is never passed.
- Field NPCs (Artemis, Athena, Dionysus, Hades) have no `CreateLoot`; their
  `UpgradeOptions` start nil, so `SetTraitsOnLoot` runs at interaction
  (`UpgradeChoiceLogic.lua:119-121`). Hades is registered in `FieldLootData`
  with `TreatAsGodLootByShops` but `BlockForceCommon` (`RunData.lua:556-569`;
  `NPCData_Hades.lua:17-21`), so Chaos Ordinary neither forces it Common nor
  spends a use at close (`RoomLogic.lua:2120`; `UpgradeChoiceLogic.lua:1124-1126`
  requires `ForceCommon`), and its `IgnoreRestrictBoonChoices` exempts it from
  Rejected (`:1131-1133`).
- Chaos uses `SetTransformingTraitsOnLoot` (`TraitLogic.lua:1710-1744`); Echo's
  last-run menu and Story menus write options directly (`EventLogic.lua:954-1624`).
  Neither shares stages 1-9.

### 6. Order of operations and timing

Legality is decided when the loot is **materialized**, not when it is opened.
`CreateLoot` (`RoomLogic.lua:2240-2300`) calls `RandomSynchronize()` (`:2242`)
and `SetTraitsOnLoot` (`:2266`) immediately; `CreateBoonLootButtons` reuses the
stored `UpgradeOptions` unless they are nil or a stored Pom target vanished
(`UpgradeChoiceLogic.lua:117-135`). Materialization points:

| Carrier                      | Materialized at                                                                                           | Source                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Ordinary room reward         | `SpawnRoomReward`, the last event of the encounter's `UnthreadedEvents`, **before** `EndEncounterEffects` | `EncounterSets.lua:446-452`; `RoomLogic.lua:1919,1931`; `RewardLogic.lua:368-389` |
| Fields cage rewards          | room setup, before any cage combat                                                                        | `RoomLogic.lua:5683-5701`                                                         |
| H miniboss reward            | before combat                                                                                             | `EncounterSets.lua:464-466`; `RoomLogic.lua:5758-5768`                            |
| Devotion pair / spurned loot | before combat / at the post-combat `SpawnRoomReward`                                                      | `EncounterLogic.lua:1682-1698`; `RewardLogic.lua:395-397`                         |
| World Shop boon, Blind Box   | purchase / unwrap                                                                                         | `StoreLogic.lua:367,656,1340`                                                     |
| Field NPC screen             | interaction                                                                                               | `UpgradeChoiceLogic.lua:119-121`                                                  |

Stored options are discarded or rebuilt only at these contacts:

| Contact                                                           | Effect                                                                                                                                                                      | Source                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Any upgrade screen closes (god, Hermes, Pom, Hammer)              | every other live loot re-rolled **now**, after the closing selection and its Yarn/Ordinary/Rejected/Hymn consumption; call has no args, so `BlockRarities` is not reapplied | `UpgradeChoiceLogic.lua:1124-1154` |
| `AddRarityToTraits` (Steady Growth, Bridal Glow, other rarifiers) | other live loots set nil → regenerated at open                                                                                                                              | `TraitLogic.lua:3044-3050`         |
| Chaos transform blessing in `CheckChamberTraits`                  | nil → regenerated at open                                                                                                                                                   | `TraitLogic.lua:2953-2962`         |
| Trade `SellTrait` option                                          | nil → regenerated at open                                                                                                                                                   | `TradeLogic.lua:188-194`           |

Nothing else invalidates. In particular Well purchases (`StoreLogic.lua`
touches `LootObjects` only to read, `:317,391`), Purging Pool sales
(`SellTraitLogic.lua:327-328`), keepsake swaps, random Pom/Nectar level grants,
Hex selection, and encounter-end effects other than the two above — including
Chaos curse maturation (`RoomLogic.lua:2941-2997`, `TraitLogic.lua:1304-1334`)
— leave an already-generated offer untouched.

Run state consumed at generation: equipped traits and their slots/levels/
rarities/elements, `PickedTraits`, `BannedTraits`, active rarity contributions
(Arcana, Favor, Yarn, Proper, room/item overrides), `ForceSwaps`, Ordinary, and
room context (`ChosenRewardType` for the Devotion Duo exclusion,
`BlockGiftBoons`). Loot-level side flags computed at generation and read at
close: `RarityBoosted` (Yarn consumption, `TraitLogic.lua:1777-1779` →
`UpgradeChoiceLogic.lua:1127-1129`), `ForceCommon` (Ordinary consumption,
`:1124-1126`), `UseSwapTrait` (Hymn consumption only when generation used the
swap, `TraitLogic.lua:1798-1800` → `UpgradeChoiceLogic.lua:1134-1142`),
`BlockReroll`.

RNG boundaries: `RandomSynchronize` at `CreateLoot` and before each close
re-roll (`UpgradeChoiceLogic.lua:1148`); every draw inside stages 1-9 and the
blocked-index choice; `RandomChance` is `rng:Random() <= chance`
(`RandomLogic.lua:120-126`). Possibility therefore depends on the generation
frontier; probability depends on the synchronized stream, which the planner
does not model.

## Established facts (planner, 7c39a536)

### Authorities

- `docs/audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`
  owns the construction sequence, Denial and Forfeit. Its cited script lines
  were rechecked and match (`TraitLogic.lua:1765-1784,1790-1806,1816-1825,
1858-1888,1898-1918,1920-1947,1949-1961,1963-1993`;
  `UpgradeChoiceLogic.lua:149-150,739-792,795-821,855-875,1134-1142`;
  `RunLogic.lua:57-96,98-134`; `RoomLogic.lua:2140-2143`;
  `TraitData.lua:143,178,223,869-875`; `TraitData_Duo.lua:527,757,965,1004,1297`;
  `RunData.lua:1390-1417`; `RandomLogic.lua:120-125`).
- `docs/audits/traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` owns pools,
  priority sets and the linked graph; its 75-group graph matches
  `TraitData.lua:121-658` on spot checks (Duo overrides, cast family, Zeus/Ares).
- `docs/audits/traits/BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md` owns chance
  arithmetic; `docs/audits/traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md` owns
  Ordinary/Rejected; `docs/design/REWARD_MODEL.md:1154-1238` summarizes the
  engine contract.

### Engine

- Staged generation: `packages/planner-engine/src/simulation/traits/authoring/initial-composition.ts`
  — `coreSeeds` `:42-71`, `preparePools` `:73-134` (ForceCommon `{}` and
  Devotion `Duo = 0` `:109-114`; Hymn/Ordinary replacement chance `:125-130`;
  rescue gate `:132`), `findOutcome` `:141-262` (rescue `:157-175`,
  replacement rescue `:177-189`, ordinary draw `:191-212`, seed rarity
  `:214-240`, linked seeds `:242-249`, seed order `:251-260`), finding
  `traitOfferGenerationUnavailable` `:264-287`, Gold terminal `:289-303`.
- Declaration eligibility (IsTraitEligible + TraitRequirements):
  `.../traits/authoring/assessment.ts:199-227`; row assessment, occupied slot
  and replacement promotion `:229-395`; generation input and replacement
  candidates `:694-724`; picker candidates `:609-691`.
- Source resolution: `.../traits/offers.ts` — Ordinary/Hymn adjustment
  `:72-98`, Denial disables rescue `:121-140`, rarity facts incl. Yarn
  `:237-279`, Rejected composition `:519-547`, Denial bans `:669-690`.
  Chance values `.../traits/rarity.ts:34-47` (present zeros for Rare, Epic,
  Heroic, Duo, Legendary).
- Settlement: `.../rewards/trait-settlement/coordinator.ts` — evaluation uses
  `branch.state` at the acquisition site `:285-303`; `godBoonScreens` clock
  `:119-121`; Yarn/Hymn consumption `:737-770`.
- Catalog constants: `packages/hades2-catalog/src/declarations/traits/index.ts:236-241`
  (bases, roll order, 0.1 replacement chance); Ordinary/Rejected
  `.../declarations/traits/chaos.ts:163-185`; the five Duo overrides carry no
  `devotionNoDuo` (`apollo.ts:293`, `demeter.ts:378`, `hera.ts:340`,
  `zeus.ts:301`, `ares.ts:278`) while ordinary Duos do (e.g. `apollo.ts:322`).
- Commands and findings: `ReplaceTraitOffer` is structural only
  (`authored-project/commands/trait-offer.ts:41-47,121-`); legality is
  simulation findings (`simulation/model.ts:93-139`);
  `chaosRejectedBlockMissing` is a required-missing-input finding
  (`simulation/model.ts:204`).
- Precedent for a materialization frontier: Echo Gold duplicates keep
  `sourceTraitHistory`, "deliberately not replaced by current state"
  (`simulation/state/model.ts:38-48`; `REWARD_MODEL.md:1018`); Poms keep
  `levelResolutionGenerationHistory` (`rewards/level-resolution-settlement.ts:81`).

### Application and executor

- `apps/planner/src/projections/rewards/traitDomainProjection.ts` adapts engine
  candidate availability into pickers (Heroic hidden unless selected, `:118-125`)
  and reproduces no legality rule.
- The executor overwrites `loot.UpgradeOptions` with the published rows inside
  a `CreateBoonLootButtons` wrap, i.e. at open
  (`run-planner-modpack/Submodules/adamantRunPlanner-Run_Planner/src/mods/room/timeline/acquisitions/traits/hooks.lua:426-452`;
  `ordinary.lua:157-185`), and forces `screen.BlockedIndexes` to the published
  Rejected row (`hooks.lua:454-463`; `ordinary.lua:194-201`). It never calls
  or reconstructs native eligibility. It does not rewrite the loot-level flags
  of §6 (`UseSwapTrait`, `RarityBoosted`, `ForceCommon`), and it compares
  retained Yarn/Hymn uses at conformance (`room/conformance/readers.lua:195-204`).

## Step mapping

| Native step                                                                     | Planner handling                                                  | Verdict                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| God choice ignores trait supply                                                 | Reward model owns god choice; Gold terminal covers empty queue    | exact                                                 |
| Rarity source, present zeros, `BlockRarities`                                   | `preparePools` `:103-114`; `rarity.ts:34-47`                      | exact                                                 |
| Replacement seed (Hymn precedence, 0.1 roll, Ordinary guard)                    | `:125-130,251-256`; `offers.ts:82-97`                             | exact                                                 |
| Core seeds, H/U/A cases                                                         | `coreSeeds` `:42-71`                                              | exact                                                 |
| Linked priority (0.25)                                                          | `linkedSeeds` optional both ways                                  | exact (possibility)                                   |
| `PriorityRequirements` seeds                                                    | absent                                                            | exact (dead in native)                                |
| Eligible pool: slot, ownership, `IsTraitEligible`, `TraitRequirements`          | `fresh` from `declarationEligible` + vacancy `:85-92`             | exact                                                 |
| Buckets by declared rarity membership                                           | `membership` from `freshOfferRarities`                            | exact (Heroic membership is never consulted natively) |
| Seed rarity / ordinary fill / nil attempts / depletion                          | `:191-240`                                                        | exact                                                 |
| Replacement rescue                                                              | `:177-189`                                                        | exact                                                 |
| Rarity rescue, Denial gate, present-zero Duo in Trials                          | `:157-175`; `offers.ts:132-134`                                   | exact                                                 |
| Denial bans                                                                     | `offers.ts:669-690`                                               | exact                                                 |
| Rejected blocked index                                                          | `offers.ts:522-540` requires a block on any trait screen          | **WRONG** for one- and two-option screens (D2)        |
| Ordinary clock consumption                                                      | `coordinator.ts:119-121`, only rarity-bearing givers              | correct (Hades is `BlockForceCommon`; D3 withdrawn)   |
| Weights                                                                         | none modeled                                                      | exact (native uniform)                                |
| Generation frontier = materialization, rebuilt at four contacts                 | evaluated at acquisition state (`coordinator.ts:297-303`)         | **MISSING / WRONG** (D1)                              |
| Field NPC generation at interaction                                             | acquisition state                                                 | exact                                                 |
| Reroll                                                                          | outside model; executor abandons plan on reroll (`hooks.lua:431`) | deferred (documented)                                 |
| First-run tables, bounty `ForcedUpgradeOptions`, `StripRequirements` test rooms | outside baseline                                                  | excluded (documented)                                 |
| `ExchangeOnlyFromLootName`                                                      | not modeled                                                       | exact (dead in native)                                |
| Menu rarify (`RarityUpgradeData`, Calling Card)                                 | separate rarification actions                                     | out of scope here                                     |

## Discrepancies

### Game-truth mismodeling

**D1 — The planner decides legality at acquisition; the game decides it at
generation.** Native: §6. A god loot's options are built by `SetTraitsOnLoot`
when the loot is created and thereafter change only through four contacts:
closing any upgrade screen rebuilds every unopened loot in the room
immediately (`UpgradeChoiceLogic.lua:1144-1153`); `AddRarityToTraits`
(`TraitLogic.lua:3044-3050`), a trade sale (`TradeLogic.lua:188-194`) and the
chamber-count Chaos transform (`CheckChamberTraits`, `TraitLogic.lua:2953-
2962`) set `UpgradeOptions = nil`, and the loot is regenerated when opened
(`UpgradeChoiceLogic.lua:118-121`). A full search for `UpgradeOptions = nil`
finds three further sites (`EventLogic.lua:650,657`, `InteractLogic.lua:722`)
that serve `SpawnAllLoot` and `RespawnAfterUse`, reached only from
`RoomDataTest.lua:213`. Every other state change between creation and open is
silent — including encounter-count curse expiry (`OnExpire`), the Dream
essences and `ElementalBoost`, consumables, level changes
(`AddStackToTraits` `:2482`, `IncreaseTraitLevel` `:2533` never touch
options) and trait removal (`RemoveTraitData` `:1221`, reached by the Anvil's
`ChaosHammerUpgrade` `:2573` and by `UseHeroTraitsWithValue` `:430` when
Echo's double-shop trait is consumed). Planner: the offer is assessed against
the settlement branch at
pickup (`coordinator.ts:285-303`), and the design states it
(`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md:776-777` "Pickup-owned trait
offers ... are evaluated only when that pickup is due and acquired";
`REWARD_MODEL.md:1164`). The planner therefore evaluates a state the game never
used whenever a silent change lands between generation and open. The
reachable cases are the census below: encounter-end effects of the reward
encounter (every route) and Dream shop essences before the shop boon.
Multi-encounter rooms add a third shape: an invalidation after one encounter
(Steady Growth in `CheckChamberTraits`) followed by a silent maturation after
a later encounter, where native regenerates at the open with both applied.

Consequence for authored plans: some legal game screens cannot be authored,
and some authored screens the game could never show are accepted. Executor
consequence: installation at open (`hooks.lua:426-452`) turns an
admitted-but-impossible screen into a fabricated one without any diagnostic.
The per-carrier exceptions the planner already models (Pom regeneration, Echo
Gold freezing) show the needed frontier concept exists.

**D2 — Rejected is modeled as always blocking one row.** Native: a block exists
only when three options were generated (`UpgradeChoiceLogic.lua:153-162`;
`TraitLogic.lua:1746-1754`). Planner: any `traits` screen under Rejected
requires `rejectedOptionKey` distinct from the selection
(`offers.ts:522-532`), and a test asserts this for a two-option Zeus screen
(`packages/planner-engine/test/simulation/chaos-traits.test.ts:1298-1325`).
Scenario: Rejected active, exhausted Hermes or Olympian pool. A one-option
screen can never be completed (`chaosRejectedBlockMissing` is a required input,
`model.ts:204`), and a two-option screen forces one row unselectable although
the game allows either. The executor then writes `BlockedIndexes` for a row
the game would leave selectable (`ordinary.lua:194-201`). Rare in practice,
but unambiguous.

**D3 — withdrawn.** First stated as "Hades screens consume an Ordinary use".
Hades is `TreatAsGodLootByShops` but also `BlockForceCommon`
(`NPCData_Hades.lua:21`), and `IsRarityForcedCommon` applies the Ordinary
curse only to `(GodLoot or TreatAsGodLootByShops) and not BlockForceCommon`
(`RoomLogic.lua:2120`), so `SetTraitsOnLoot` never sets `ForceCommon` on a
Hades screen and the close never spends a use
(`UpgradeChoiceLogic.lua:1124-1125`). `IgnoreRestrictBoonChoices` separately
exempts it from Rejected. The planner's `godBoonScreens` clock advances only
for givers with a boon rarity (`offers.ts:65`; `coordinator.ts:119-121`), and
Hades is the only shop-aware giver without one, so the engine already matches
and `chaos-traits.test.ts` pins it. No discrepancy.

### Undermodeling with user-visible consequence

- **U1 — Close-time re-roll drops Devotion's Duo block.** The close re-roll calls
  `SetTraitsOnLoot(item)` without args (`UpgradeChoiceLogic.lua:1152`), so a live
  spurned Devotion loot re-rolled after another screen in that room loses
  `BlockRarities.Duo`. The planner keeps `devotionNoDuo` for the whole reward.
  This only matters if another upgrade screen closes while the spurned loot is
  live. Needs a probe before it is treated as real.
- **U2 — Rerolls are unmodeled.** This is documented, and the executor abandons
  the offer on reroll (`hooks.lua:431`). The native semantics (one excluded
  identity, frozen chances, `BlockReroll`) are recorded in §5 in case a plan
  ever adds them.
- **U3 — Display order.** The game sorts the screen by slot
  (`UpgradeChoiceLogic.lua:164-186`), so authored row order is not display
  order. Denial (two bans out of two others) and the executor's name-based
  Rejected alignment are order-independent. No legality impact.

### Documentation-only

- `TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md:363-364` says
  `RestrictBoonChoices` "has no currently modeled supplier". Rejected is
  catalog-declared and engine-modeled.
- `CHAOS_TRAIT_GAME_DATA_AUDIT.md:279,308-326` describes the three-option case
  only and presents it as universal ("leaves one randomly chosen index
  blocked").
- `ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md:733-741` calls Pom "the closed
  exception to immutable generated options", and invariant 3 (`:776-777`)
  places trait-offer evaluation at pickup. Natively, god loot options are
  generated at materialization and are rebuilt by the four §6 contacts. The
  audit also misses that the close re-roll happens at close, not at open.
- `REWARD_MODEL.md:1164,1018` apply two different frontiers, pickup for
  ordinary rewards and materialization for Echo Gold, to the same native
  `CreateLoot` rule, and give no reason for the difference.
- Verified non-issues worth recording once: `ExchangeOnlyFromLootName` and
  trait `PriorityRequirements` are dead natively; `TwoOf` is unused; Heroic
  bucket membership is never consulted; `GoodStuffBoon`'s own
  `PommableSlottedTraitCountAtLeast` gate (`TraitData_Duo.lua:757-772`) is
  implied by its linked Poseidon/Demeter core requirement plus Natural
  Selection's target validation (`assessment.ts:78-84`).

## Disposition (recommended)

- **D1 — correct.** Give materialized ordinary loot (room reward, cage, H
  miniboss, Devotion spurned, World Shop boon, Blind Box contents) a
  generation frontier: the branch state at materialization. Rebuild it at the
  four native contacts (any later upgrade-screen close in the same room, which
  re-rolls at close; `AddRarityToTraits`; Chaos transform; trade sale), and
  keep acquisition-time settlement for the selected effects. Yarn/Ordinary/
  Rejected/Hymn consumption should come from the generation frontier's flags
  (e.g. consume Hymn only if Hymn was active at generation). This follows the
  existing Echo Gold and Pom precedents rather than adding a mechanism. It
  touches the engine (settlement coordinator, candidate capture) and possibly a
  catalog declaration of carrier materialization points. The app only
  relabels the candidate context. The executor needs no installation change,
  and its Hymn conformance becomes consistent. No authored schema change is
  expected, since this is derived state. Blast radius to measure before locking:
  authored fixtures whose room order puts a Well purchase, Pool sale or Chaos
  maturation before a same-room god-loot pickup, plus Fields cage fixtures.
  Expect `traitOfferGenerationUnavailable`/rarity findings to appear or clear
  there; 16 fixtures carry Yarn/Hymn retained-effect fields and 33 tests mention
  Yarn/Hymn. If rejected, D1 must instead become a documented simplification
  in `REWARD_MODEL.md` and the acquisition audit, with the Hymn conformance
  consequence stated.
- **D2 — correct.** Require and accept a Rejected block only on three-option
  screens; a stored block on a shorter screen becomes
  `chaosRejectedBlockUnavailable`. This touches the engine (composition rule,
  candidate `chaosOfferRules`) and inverts test `:1298`. The executor already
  omits the block when none is published. No schema change.
- **D3 — no change.** Withdrawn on source evidence (`BlockForceCommon`).
- **Docs — fix in the same closure** as the owning corrections. Promote the
  §6 materialization/invalidation table into the composition audit and delete
  this investigation.

## Open questions needing a live probe

1. Yarn after spawn: clear a room with a god-boon reward and a Well, buy Yarn,
   then open the boon. Expected from source: no Rare guarantee, and Yarn is
   consumed.
2. Hymn after spawn: same setup, buy Sacrificial Hymn before opening. Expected:
   an ordinary screen with no forced swap, and Hymn retained.
3. Pool sale before opening: sell a core at a Purging Pool, then open a boon
   that spawned earlier. Expected: the offer still reflects the sold trait's
   slot and prerequisites.
4. Chaos maturation in the reward encounter: a Creation or Favor curse
   maturing on the room's last encounter. Expected: that room's boon lacks the
   new elements or bonus, and the next boon has them.
5. Rejected with a two-option (exhausted) screen: are both rows selectable?
6. Resolved from source: a Hades field screen is `BlockForceCommon`, so it
   neither is forced Common nor spends an Ordinary use.
7. Fields: does a cage boon picked first reflect entry state rather than the
   cage encounter's end effects?
8. Devotion: can any upgrade screen close while the spurned loot is live, and
   does its re-roll then admit a Duo (U1)?
9. Ephyra restore (`RoomLogic.lua:1531-1536`) respawns `RewardsToRestore`
   through `SpawnRoomReward`, which regenerates offers. Can a god loot be
   among them?

## D1 reachability census (2026-09-24, source-checked)

The owner narrowed D1 to paths actually reachable in a run. Result: Well
purchases (Yarn, Sacrificial Hymn), Purging Pool sales and Narcissus never
fall between a god loot's generation and its open; two classes remain, one of
them on every route. Yarn is `TemporaryBoonRarityTrait` with a plain
`RarityBonus` (`TraitData_Store.lua:283-299`), consumed at screen close; it
never invalidates and is unreachable anyway.

Unreachable, with the gate that closes each:

- Well items (Hymn, Yarn): `WellShop` uses `AttemptUseChallengeSwitch`
  (`ObstacleData.lua:3267-3274`), which requires `ReadyToUse` (set only in
  `UnlockRoomExits`, `RoomLogic.lua:4056-4077`) and `CheckRoomExitsReady`
  (`RoomLogic.lua:3080-3108`), false while any required object remains.
  `CreateLoot` registers every god/Hermes/Chaos/Devotion loot as required
  unless `DoesNotBlockExit` (`RoomLogic.lua:2276-2279`), released only on
  selection (`UpgradeChoiceLogic.lua:940, 1039`). Surface biomes spawn no
  Wells at all (`WellShopSpawnChance = 0.0` in BaseN:21, BaseO:288,
  BaseP:339, BaseQ:42, BaseN_SubRooms:3811; Postbosses `ForceWellShop =
false`). The only optional god loot — World Shop `RandomLoot`/
  `BoostedRandomLoot`/`ShopHermesUpgrade` (`StoreLogic.lua:133-191`) and the
  Surface shrine speed-up delivery (`SurfaceShopLogic.lua:527-537`) — lives
  in rooms with no Well anchor.
- Purging Pool sales: Pools exist only in F/G/H Postboss, which carry no
  reward loot.
- Narcissus: his NarcissusA–I screen is built at talk time and offers no god
  boon; the mystery option drops a non-required `BlindBoxLoot` whose god loot
  is created and auto-opened in one state by `UnwrapRandomLoot`
  (`StoreLogic.lua:1334-1363`). `G_Story01` has no Well anchor.
- Story NPC screens (Artemis, Hades, Dionysus via `UseLoot`; Echo, Icarus,
  Arachne, Medea, Circe, Nemesis inside their choice functions) are built at
  open — exact. Keepsake racks sit in Postboss rooms with no god loot.
  Nectar gifted to a boon destroys it and spawns a fresh reward
  (`GiftLogic.lua:25-42`).

Reachable divergence set:

- (A) Encounter-end effects after reward spawn — every route. The default
  encounter events run `SpawnRoomReward` (`EncounterSets.lua:452`) inside
  `RunEvents` (`RoomLogic.lua:1919`); `EndEncounterEffects` runs after it
  (`:1931`) and expires `UsesAsEncounters` traits (`:2964-2974`). A Chaos
  curse (`ChaosCurseRemainingEncounters`, `TraitData_Chaos.lua:11-20`)
  expiring on that encounter adds its blessing through `OnExpire.TraitData`
  (`TraitLogic.lua:1314-1319`) with no loot invalidation. The boon on the
  floor was generated without the blessing; the game opens that pre-blessing
  offer; the planner, evaluating at pickup after end effects, applies the
  blessing — raising rarity (`ChaosRarityBlessing`, `RarityBonus`) or
  admitting Infusions (`ChaosElementalBlessing`, `AddAllElements`) the game
  cannot show. Cage encounters run as `MapState.EncounterOverride`
  (`EncounterLogic.lua:2924`) and tick curses (`RoomLogic.lua:2927`), so
  every Fields cage, the Fields miniboss, Devotion, Chaos trials and each
  ship encounter carry the same window.
- (B) Dream World Shop essence before the optional shop boon. Shop boons are
  generated at room entry (`SpawnStoreItemsInWorld`, `StoreLogic.lua:596-
615`) and opened without regeneration; the Fire/Air/Earth/Water essences
  (`StoreData.lua:265-268`) and `ElementalBoost` (`:446, :579`) add elements
  without a rebuild. Essence bought first, boon second: the game shows no new
  Infusion; the planner admits one. Dream-only; the catalog models the
  essences (`shops.ts:136-139, 190`).

Both classes cut the same way: the planner is ahead of the game by exactly the
encounter-end (or purchase) effects that land between generation and open.
Not verified in this census: the planner's own chronology of the ordinary
`rewardOffered` event versus the encounter-end-effects transition (taken from
the step mapping above; the plan's Gate B inventory confirms it), and Barren's
exact effect on generation. Executor note: because the module installs the
published offer at screen open, an admitted-but-impossible screen is legal for
the state at open and installs cleanly — the disagreement is with what
unassisted native would have shown, not a runtime failure.

## Settled model shape (owner rulings, 2026-09-24)

Anchor: every trait offer evaluates against the state at the lifecycle
position where native builds its options. An ordinary room reward
(`SpawnRoomReward`, `RoomLogic.lua:1919`) anchors at the producing phase's
`encounterCompleted` event, which the lifecycle appends immediately before
`encounterEndEffectsApplied` (`simulation/lifecycle/execute.ts`,
`recordEncounterCompletion`). Offers with their own offer point anchor at
their `offerPointMaterialized` event: Fields cages
(`offer-lifecycle/fields-optional-materialization.ts:104`, matching
`SpawnRewardCages` from `H` `StartUnthreadedEvents`, `RoomDataH.lua:2178`),
World Shop items (`offer-lifecycle/shop-offer-point-materialized.ts:219`,
matching `SpawnStoreItemsInWorld`, `StoreLogic.lua:596-615`) and ship wheels
(`offer-lifecycle/reward-wheel-offer-point-materialized.ts`; the ship
sequence is `recordPhaseOfferPoint` → start → completion, with end effects
deferred until after the phase, `declarations/lifecycles/ship.ts:14-17`,
`execute.ts:405`, so a wheel's point follows the previous phase's end
effects and no trait-relevant state separates it from native's spawn). Neither
existing reward-identity event is the anchor: an ordinary reward's
`rewardOffered` (`simulation/rewards/offer-generation.ts:348`) is emitted at
`roomCreated` (`generation/room-created.ts`, composed in
`history/compose.ts`) before the room is entered, and
`targetRewardGenerationCheckpoint`
(`simulation/encounters/generation-preparation.ts:22`) reads the previous
room's door-target generation. Both fix what the reward is, not what its
options were built from. No spawn-timing declaration beyond the existing
lifecycle events.

Refresh: an unopened offer's context changes only through three classes of
lifecycle event, each a property of the event kind, never of a room. Two
distinct effects exist because native has two:

1. Invalidate (deferred): native nils the options and regenerates at open
   (`SetTraitsOnLoot` recomputes rarity chances as well, `TraitLogic.lua:1776`),
   so the model marks the offer stale; its context becomes the state at the
   next rebuild in the room or at its open, whichever comes first. The
   invalidators are operations, not outcomes: `CheckChamberTraits`
   (`TraitLogic.lua:2881`) calls `AddRarityToTraits` whenever a
   `RoomsPerUpgrade.Rarity` interval hits (`:2919`; Demeter `BoonGrowthBoon`,
   `TraitData_Demeter.lua:1894`), and `AddRarityToTraits` nils every live
   loot unconditionally (`:3044-3050`) even when no trait is promotable; the
   Embryo interval nils under `transformBlessing`, outside `if oldBlessing`
   (`:2935-2962`), even with no blessing to transform. The fountain-rarity
   keepsake reaches `AddRarityToTraits` only behind `HasRarifiableTraits`
   (`InteractLogic.lua:769-773`). Hera's supercharge is a screen acquisition
   (class 2). The only invalidating sale is Nemesis's trade
   (`NemesisGiveTraitForItemChoices`, `NPCData.lua:5766`; `TradeDoExchange`
   `SellTrait`, `TradeLogic.lua:181-194`); the Purging Pool's
   `HandleSellChoiceSelection` (`SellTraitLogic.lua:327-329`) only removes the
   trait and pays gold. Level changes are excluded: `AddStackToTraits`
   (`:2482`) and `IncreaseTraitLevel` (`:2533`) never nil options; the
   non-screen level changes that exist (the World Shop random-stack consumable
   `UseStoreRewardRandomStack`, `ConsumableData.lua:788`; Hera's
   `CreditMissingStacks`, `TraitData_Hera.lua:2040`) are silent.
   `RoomsPerUpgrade.TraitStacks` has no shipped carrier. Additions of boons
   are always screens (class 2).
   Pool-eligible means sellable at a Purging Pool: `IsGodTrait(name,
{ForShop = true})` (`SellTraitLogic.lua:36`, `TraitLogic.lua:1547-1560`),
   i.e. `GodLoot` or `TreatAsGodLootByShops` givers. Chaos loot is
   `GodLoot = false` (`LootData_Chaos.lua:17`) and hammers are `GodLoot =
false` (`LootData.lua:217`).
2. Rebuild (immediate): any trait offer acquired — every upgrade screen
   (boon, hammer, Pom, Chaos pick, Arachne, Narcissus, Echo, Medea, Circe,
   NPC boons; Poms, Circe's pet multiplier and Echo's double-level are
   `AcquireFunctionName`s on screens; the Concave Stone's unpicked boon is
   granted inside the same selection, `HandleUpgradeChoiceSelection`
   `UpgradeChoiceLogic.lua:1002-1023`, so it is one screen and one close).
   Native rebuilds every unopened loot in the room on any upgrade-screen
   close — recompute rarity chances, nil, `SetTraitsOnLoot` at once
   (`UpgradeChoiceLogic.lua:1144-1153`);
   every NPC screen opens through `OpenUpgradeChoiceMenu` and closes through
   `CloseUpgradeChoiceScreen`. The rebuild re-anchors every unopened offer in
   the room to the post-close state and clears stale marks.
3. Declared custom transforms (Transcendent Embryo, `CheckChamberTraits`
   `TraitLogic.lua:2960`): invalidate, as class 1.

An offer generated after a rebuild starts from its own generation event.
Everything else is silent: encounter-count curse expiry (`OnExpire`), Dream
essences and `ElementalBoost`, consumables, Death Defiance uses, the Anvil of
Fates (`ChaosHammerUpgrade`: `RemoveWeaponTrait`, `AddTraitToHero`,
`InvalidateCheckpoint` — the save checkpoint, `RunLogic.lua:2698`) and the
consumption of Echo's double-shop trait (`UseHeroTraitsWithValue`,
`TraitLogic.lua:430`). The Echo duplicate loot is created inside
`RemoveStoreItem` from `UseLoot` (`InteractLogic.lua:649`,
`StoreLogic.lua:361-370`) before the source boon's screen opens and is
rebuilt at that close, so its options reflect the post-purchase state; the
engine's `materializeShopGold` (`shop/settlement.ts:403`) already anchors it
after the source settles. Nectar-gift respawns are meta-progression and
unmodeled.

Why deferred regeneration is required, not merely refresh-at-event:
`EndEncounterEffects` runs per encounter, including every cage encounter
(its guard accepts `MapState.EncounterOverride`, `RoomLogic.lua:2928`), and
`CheckChamberTraits` runs at each. In Fields with Steady Growth due on cage 1
and Creation maturing on cage 2, native nils the boon after cage 1, matures
Creation silently after cage 2, then regenerates at the open with the
elements. A refresh applied at the Steady Growth event would freeze the
pre-Creation state and forbid the Infusion the game shows. Deferred
regeneration reproduces native; a Pom screen between cage 2 and the open
rebuilds and clears the mark with the same result. Single-encounter rooms
cannot show the difference, because `CheckChamberTraits` follows the
curse-expiry loop (`:2965-2969`) and nothing silent follows before the open.
The Fields witnesses: magick cage then boon opens pre-blessing (no event);
hammer cage then boon opens post-blessing (class-2 rebuild); Steady Growth at
cage 1, Creation at cage 2, boon last opens with elements (deferred
regeneration). Dream shop essence before the shop boon: silent, no new
Infusion.

## Bounded unknowns for audit promotion

- **Loot flags persist across regeneration.** `SetTraitsOnLoot` only ever sets
  `ForceCommon`, `RarityBoosted` and `UseSwapTrait` (`TraitLogic.lua:1765-1779,
1797-1800`); a rebuild or open-time regeneration never clears them, and the
  close reads them to spend Ordinary, Yarn and Hymn (`UpgradeChoiceLogic.lua:
1124-1142`). An offer built under Ordinary and rebuilt after Ordinary expired
  would keep replacement disabled and try to spend Ordinary. The planner
  derives these from the context it evaluates; not modeled.
- **Delayed Hermes delivery versus curse maturation in one encounter end.**
  Both land in the same `traitsToRemove` loop in hero-trait order
  (`RoomLogic.lua:2994-2996`; delivery via `OnExpire.SpawnShopItem`,
  `TraitLogic.lua:1337-1347`), so which comes first depends on acquisition
  order. The planner advances the Chaos clock before marking deliveries due,
  so a delivery due with a maturing curse is built after the blessing.
  `IgnoreRoomRarityBonus` is also set only after the spawn (`TraitLogic.lua:
1342-1347`), so the first build and a rebuild differ in room rarity bonus.
- **Devotion's Duo block after a rebuild (U1).** The close rebuild calls
  `SetTraitsOnLoot(item)` without `BlockRarities`
  (`UpgradeChoiceLogic.lua:1144-1153`), so a spurned Devotion loot rebuilt by
  another screen in its room (for example a delayed Hermes delivery hosted at
  the same encounter end) would admit a Duo. The planner keeps `devotionNoDuo`
  for the whole reward.
- **Consumable-triggered Travel Deal restock.** `RestockWorldItem` waits only
  for a named screen (`StoreLogic.lua:404, 411-432`); a consumable passes its
  `ScreenNameOnUse` (`InteractLogic.lua:1016-1017`), usually none, so the
  restock thread may spawn before or after the consumable's own effects
  (`InteractLogic.lua:1098-1116`). The planner builds the refill after the
  triggering purchase settles.
- **Hermes Shrine Travel Deal refill contact.** The native shrine path for a
  first-purchase refill (`SurfaceShopLogic.lua:355-400`) was not traced to a
  spawn; the planner builds the refill when the rushed initial delivery is
  picked up.
