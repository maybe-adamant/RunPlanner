# Enemy Formation and Fear Vow Game-Data Audit

## Status and Scope

This document is the stable source-evidence authority for how Hades II forms
the enemies in a generated combat encounter and where Fear Vows intervene in
that process. It was read directly against the installed Steam build on
2026-08-29:

- application ID: `1145350`;
- build ID: `24556151`;
- routes: Underworld F/G/H/I and Surface N/O/P/Q.

Wave, highlight, type-selection and budget-allocation contacts were reread on
2026-09-18 against the same installed build. The local source snapshot's 125
encounter/enemy declaration, room declaration and supporting logic files were
byte-equal to the installed scripts. The companion
[Combat Encounter Composition Matrix](COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md)
owns the concrete encounter domains and enemy pools; this document owns the
shared generation algorithm and Vow interactions.

Budget/count inheritance, the 114 supported source identities, and Fangs
pool/filter declarations were rechecked on 2026-09-23. The supported-domain
censuses below include all 39 policies in the companion matrix, including NPC,
passive and fixed-template contacts. Native-source probes establish bounded
contact behavior with controlled scaffolding, not live combat or save restoration.

The primary scope is the generated encounter used by an ordinary main Combat
room and the generated `DevotionTest*` encounter used by a Devotion room. The
same lower-level functions may be reused elsewhere, but this audit does not by
itself claim a disposition for opening, NPC, challenge, passive Fields,
side-room, miniboss, or boss encounters. The companion matrix separately
identifies generated and scripted contacts inside supported Combat rooms.
Minibosses are deliberately excluded; Vow of Shadow and miniboss-specific
encounter selection are separate questions.

This audit distinguishes four different concepts that should not be collapsed:

1. **formation** chooses waves, enemy types, and total counts;
2. **spawn substitution** may replace a formed enemy as it enters the map;
3. **unit setup** adds attributes, shields, speed, and health to the spawned
   unit; and
4. **post-death extension** may add a respawn egg and another required enemy.

Unauthored RNG outcomes, combat success, damage taken, and elapsed combat time
are outside the Planner model. Customized encounters resolve complete generated
composition choices using these rules; this is not a final live-entity roster.

## Primary Sources

The primary evidence is the installed game scripts:

- `RunLogic.lua`, especially `SetupEncounter`, `GenerateEncounter`,
  `FillEnemyTypes`, `FillEnemyCounts`, `CalculateEnemyDifficultyRating`, and
  `IsEnemyEligible`;
- `EncounterLogic.lua`, especially `HandleNextSpawn` and
  `CalculateActiveEnemyCap`;
- `RoomLogic.lua`, especially room start, `SetupUnit`,
  `PickRoomEliteAttributes`, `PickEncounterEliteAttributes`, and
  `CalcTotalSpawns`;
- `ShrineLogic.lua`, especially `GetNumShrineUpgrades`,
  `GetShrineUpgradeChangeValue`, `CheckEggRespawn`, `RespawnEggCountdown`, and
  `PickEliteAttributes`;
- `MetaUpgradeData.lua` for all Fear ranks and effect values;
- `EncounterData.lua` and `EncounterData_Generated.lua` for the generated
  encounter declarations;
- `EncounterData_Devotion.lua` and `RewardLogic.lua` for Devotion replacement
  and generation;
- `EnemyData.lua` and the enemy-family data files for generator ratings,
  elite variants, requirement flags, and per-enemy Vow opt-outs;
- `RoomSets.lua` for `NextRoomSets`; and
- `EventLogic.lua` for Circe's run-local Vow suppression.

The Fear rank costs and Black Night suppression contract remain owned by
[Arcana and Fear](../loadout-and-progression/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md).
This audit owns only the downstream enemy-formation effects of the effective
Vow ranks.

## Generated Encounter Formation

### Setup and generation order

`SetupEncounter` deep-copies the selected encounter declaration, marks a
room-owned hard encounter when applicable, and applies Dream-biome overrides.
When the result has `Generated = true`, it calls `GenerateEncounter`, whose
first step applies any marked hard-encounter overrides before calculating the
roster.

`GenerateEncounter` performs these steps in order:

1. resolve the encounter difficulty rating from its base, selected depth,
   ramps, modifiers, and multipliers;
2. apply Vow of Hordes to that difficulty rating;
3. calculate the simultaneous active-enemy cap, including the separate Vow of
   Hordes cap addition;
4. choose the wave count and copy the applicable wave templates;
5. divide encounter difficulty among the waves through
   `WaveDifficultyPatterns`;
6. choose the highlight or family generation path;
7. determine each wave's type count from declaration values and depth;
8. filter the encounter's `EnemySet` through introduction, elite, blacklist,
   trait, grouping, duplication, and enemy-specific requirements;
9. choose distinct eligible enemy types; and
10. allocate a count to each generated type from its share of the wave
    difficulty and its `GeneratorData.DifficultyRating`, respecting any
    per-type maximum.

The generator guarantees at least one of each selected type. Count allocation
uses `ceil`, random difficulty slices for all but the final generated type,
and per-enemy maximums, so a percentage increase in difficulty does not imply
the same percentage increase in the final integer enemy count.

Wave count and type count are declaration/depth decisions. Vow of Hordes does
not directly increase either. It increases the budget used to populate the
already chosen waves and separately raises the simultaneous cap.

### Wave count, depth and highlight

`RunLogic.lua:GenerateEncounter` chooses `RandomInt(MinWaves, MaxWaves)` after
encounter overrides. It does not derive extra waves from depth. Depth may
instead change which encounter definition is eligible; P's ordinary and large
generators are an example. Encounter difficulty and type count have separate
depth inputs and must not be inferred from that wave count.

Highlight generation applies exactly when the encounter does not block it,
the resolved wave count exceeds one, and no pre-existing `SpawnWaves` entry
was counted during wave setup. A `ManualWaveTemplates` entry is not itself a
pre-existing wave: it is copied while constructing a missing wave.

The game chooses exactly one highlight type against a temporary first-wave
`TypeCount = 1`, so `BlockSolo` enemies are ineligible for that role. It applies
`BlockHighlightEliteTypes` to that first wave and inserts the chosen type first
in every wave. The highlight occupies a type slot; it is not an extra enemy
type beyond the quota. It receives no special difficulty-share multiplier.

The initial highlight type target for wave `i` is
`min(i, floor(MaxTypes + TypeCountDepthRamp * GetBiomeDepth(CurrentRun)))`.
`FillEnemyTypes` then applies the encounter's ordinary rules:

- `EscalateTypeCount`: replace that target with
  `floor(MaxTypes + TypeCountDepthRamp * typeDepth)`;
- otherwise: retain an already-set target, or draw between `wave.MinTypes`
  (falling back to `MinTypes`) and `wave.MaxTypes` (falling back to
  `floor(MaxTypes + TypeCountDepthRamp * typeDepth)`);
- clamp the result to `MaxTypesCap`.

Here `typeDepth` is `GetBiomeDepth(CurrentRun)` unless
`UseEncounterDepthForTypes` selects `CurrentRun.BiomeEncounterDepth` (with the
native missing-value fallback of one). `GetBiomeDepth` counts backward through
room history to the biome boundary. At ordinary target-entry preparation,
`RoomLogic.lua:4373–4387` commits the predecessor and updates the caches before
choosing target encounters; `UpdateRunHistoryCache` sets `BiomeDepthCache` from
`GetBiomeDepth` (`RunLogic.lua:1867–1869`). Those values therefore agree at this
contact, including repeated H/O/P preparation calls; no phase-local increment
is added. Devotion instead generates during outgoing `SetupRoomReward`
(`RoomLogic.lua:3960`, `RewardLogic.lua:259–264`), before that commit, and reads
the source-room generation state. Its type depth and enemy cached-depth gates
must not borrow the destination's later preparation counters.

Thus 1/2/3 highlight progression is not universal: escalating N/O generators
can request multiple types even in the first wave. Remaining types are selected
per wave, but shared exclusions can constrain later waves. The shared
highlight is not a shared complete composition.

### Wave budgets and type-budget slices

`EncounterData.lua:WaveDifficultyPatterns` supplies fixed shares of the
encounter's difficulty rating:

| Wave count | Shares in wave order    |
| ---------- | ----------------------- |
| 1          | 100%                    |
| 2          | 50%, 50%                |
| 3          | 30%, 15%, 55%           |
| 4          | 30%, 10%, 20%, 40%      |
| 5          | 25%, 10%, 15%, 15%, 35% |

Four-wave patterns matter for supported NPC combats. These shares are not
enemy-count percentages. `FillEnemyCounts` is a finite pass over formed types,
not repeated sampling of individual enemies until a meter is full:

1. Account for the cost of fixed pre-authored spawns and count generated entries.
2. For ordinary all-generated waves, each entry except the final one samples
   `RandomNormal(waveDifficulty / generatedCount, mean / 3)` and clamps that
   slice to remaining difficulty. The final entry receives the remainder.
3. Raise the slice to at least that type's `GeneratorData.DifficultyRating`,
   then use `ceil(slice / rating)` to obtain its count.
4. Apply `MaxCount`; the native capped-entry path can transfer spare difficulty
   to a previously encountered uncapped type.
5. Accumulate actual cost through `CalculateEnemyDifficultyRating` and continue.

Minimum-one and rounding can overspend the nominal wave budget. Type order
matters: the highlight is first and the last generated type ordinarily receives
the remainder. Mixed fixed/generated templates need separate attention: the
native final-slice test compares the full spawn-array index with the number of
generated entries, not a separate generated-entry ordinal.

`RandomLogic.lua:135` defines `RandomNormal` as mean plus a Gaussian sample
times standard deviation, without Lua-side truncation. Negative samples collapse
to the minimum-one result. Authored allocation requests use the nonnegative
pre-clamp domain, not percentages; they need not sum to the wave budget.
Zero allocation does not remove a selected type. Enemy-set entry multiplicity
weights type selection, not this later allocation.

The inherited 39-policy census (including hard/Dream overrides) has one variable
base: `GeneratedP_PreCombat`, integer 340–500. The other 38 have fixed bases,
though final budgets still depend on exact depth, modifiers and Hordes. The H
Treant/Screamer templates charge their fixed count-one seed at index 1; their
generated companion at index 2 samples rather than receiving the remainder,
because generated count is one.

`EncounterLogic.lua:AddEncounterLayer` initializes counts through
`RoomLogic.lua:CalcTotalSpawns`. In this bounded domain generated count equals
effective source-request count: 37 profiles have no count transforms, the two
fixed H profiles have `EnemyCountDepthRamp = 0`, and none has run ramps,
randomized fixed counts, infinite spawns or `RequiredMiniBossShrine`. The current
trait declarations contain no `SpawnMultiplier`. This is a current-data census,
not a claim that native count transforms can never exist.

`CalculateEnemyDifficultyRating` prices configured attributes from
`room.EliteAttributes`; ordinary Fangs selection occurs later and writes
`encounter.EliteAttributes`. It does not feed back into generated quantities.

### Enemy eligibility is run dependent

`IsEnemyEligible` can remove an enemy type because:

- its required introduction has not been completed;
- the wave blocks elites;
- the encounter or current run blacklists it;
- a hero trait contributes it through `BlockedEnemyTypes`;
- a one-type wave rejects an enemy marked `BlockSolo`;
- the same type already exists in that wave;
- another chosen type blocks it;
- the encounter's elite-type cap has been reached; or
- the enemy's own game-state requirements fail.

Type selection can further remove related enemies, enforce per-group type
caps, and carry blacklists across waves. Consequently, encounter name, room
name, and biome depth are insufficient to derive one exact wave roster.

These are ordered selection rules, not only final-set predicates. Highlight
and template spawns are seeded before filling. Elite counts and type exclusions
inspect existing spawns during eligibility, but `MaxTypesPerGroup` removes
further candidates only after a new type is added in the ordinary fill loop.
Consequently a seeded group member can be followed by another member before
that group closes. The generated-placeholder loop also differs from ordinary
filling: it resolves unnamed template entries without running the ordinary
post-add exclusion/blacklist/cap-update block. A validator must preserve these
contacts rather than assume all declared limits are unconditional final-set
constraints. The concrete affected templates and pool restrictions belong to
the companion matrix.

Selection also owns bounded side effects (`RunLogic.lua:1317`): the highlight
enters the encounter blacklist; ordinary appended types may enter the run
first-appearance blacklist, add blocked successors when `BlockTypesAcrossWaves`
is declared, and contribute `ActiveEnemyCapBonus`. Fixed seeds and template
placeholders do not inherit that ordinary appended-type block. These effects
belong to admitted source selections, not discarded draws or replacement names.

### Introduction replacement occurs after initial generation

After generation and setup events, `SetupEncounter` scans the produced waves
for an eligible unseen introduction. It can discard the generated encounter
and deep-copy the introduction encounter; when that replacement declaration is
itself generated, the game runs generation again for the replacement.

Ordinary generated combat can therefore change concrete encounter identity
after its first roster was formed. Devotion sets `SkipIntroEncounterCheck =
true` and does not take this replacement path.

## Devotion Uses the Same Generator

When a room reward settles as `Devotion`, `SetupRoomReward` replaces the
room's ordinary encounter with one of its declared `DevotionEncounters` and
immediately calls `SetupEncounter`. Each `DevotionTest*` declaration inherits
from `BaseDevotion` and the corresponding biome-generated encounter, then
applies its own overrides.

The resulting encounter remains `Generated = true`. It therefore uses the
same difficulty, wave, enemy-set, type, count, active-cap, spawn, unit-setup,
and death paths described here. Devotion changes generator inputs rather than
introducing a separate enemy-composition algorithm. In particular,
`BaseDevotion` supplies its own base difficulty, wave range, type range, and
usually a fixed active cap, while the biome parent supplies the relevant enemy
set.

The supported main-room reward contacts expose Devotion in F, G, I and O.
`BaseN.DevotionEncounters` also declares `DevotionTestN`, but N Combat rooms
force `HubRewards`, whose Devotion entry is commented out
(`RoomDataN.lua:N_CombatData`, `LootData.lua:HubRewards`). That declaration is
not a viable ordinary hub reward. H and P retain commented Devotion contacts
while their ordinary room data blocks the reward, and Q has no declared
`DevotionTestQ` implementation. Declaration presence alone does not establish
room availability or change how an eligible Devotion encounter is formed.

## Fear Vow Intervention Matrix

| Vow            | Game key                        |                                                 Effect ranks | Stage                | Enemy-formation disposition                                                                                                                                                             |
| -------------- | ------------------------------- | -----------------------------------------------------------: | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vow of Hordes  | `EnemyCountShrineUpgrade`       | difficulty x1.2 / x1.4 / x1.6; active cap +0.4 / +0.8 / +1.2 | formation            | Directly changes generated total counts and may allow more concurrent enemies. Does not add waves or types directly.                                                                    |
| Vow of Menace  | `NextBiomeEnemyShrineUpgrade`   |                                 10% / 25% per source request | spawn substitution   | May replace a formed source request with a next-biome enemy immediately before unit creation. Does not recalculate the wave budget or count.                                            |
| Vow of Fangs   | `EnemyEliteShrineUpgrade`       |                                             1 / 2 attributes | room/unit setup      | Gives one selected elite enemy type in the formed encounter up to the effective rank's number of distinct legal elite attributes. It neither creates elites nor increases elite counts. |
| Vow of Return  | `EnemyRespawnShrineUpgrade`     |                  25% / 50% per eligible required-enemy death | post-death extension | May replace the cleared required enemy with a required respawn egg and then another unit of the dead enemy's final name. The respawn cannot recursively trigger Return.                 |
| Vow of Wards   | `EnemyShieldShrineUpgrade`      |                                            1 / 2 hit shields | unit setup           | Adds shields to spawned shrine-eligible units unless that enemy ignores Wards. It does not change formation.                                                                            |
| Vow of Frenzy  | `EnemySpeedShrineUpgrade`       |                                            x1.2 / x1.4 speed | unit setup           | Multiplies elapsed-time behavior for spawned shrine-eligible units unless that enemy ignores Frenzy. It does not change formation.                                                      |
| Vow of Grit    | `EnemyHealthShrineUpgrade`      |                                    x1.1 / x1.2 / x1.3 health | unit setup           | Increases maximum health and health buffers for spawned shrine-eligible units. It does not change formation.                                                                            |
| Vow of Pain    | `EnemyDamageShrineUpgrade`      |                  x1.2 / x1.6 / x2.0 non-trap damage received | hero setup           | Installs an incoming-damage modifier on Melinoe. It does not alter enemy identity, count, attributes, or unit data.                                                                     |
| Vow of Time    | `BiomeSpeedShrineUpgrade`       |                                                  biome timer | room/run             | Changes time pressure, not enemy formation.                                                                                                                                             |
| Vow of Scars   | `HealingReductionShrineUpgrade` |                                           healing multiplier | reward/hero          | No enemy-formation contact.                                                                                                                                                             |
| Vow of Debt    | `ShopPricesShrineUpgrade`       |                                        shop-price multiplier | shop                 | No enemy-formation contact.                                                                                                                                                             |
| Vow of Forfeit | `BoonSkipShrineUpgrade`         |                                       biome boon replacement | reward               | No enemy-formation contact.                                                                                                                                                             |
| Vow of Hubris  | `BoonManaReserveShrineUpgrade`  |                                      boon Magick reservation | trait acquisition    | No enemy-formation contact.                                                                                                                                                             |
| Vow of Denial  | `BanUnpickedBoonsShrineUpgrade` |                                       unpicked-boon blocking | trait offer          | No enemy-formation contact.                                                                                                                                                             |
| Vow of Void    | `LimitGraspShrineUpgrade`       |                                         starting Grasp limit | loadout              | No direct enemy-formation contact.                                                                                                                                                      |
| Vow of Shadow  | `MinibossCountShrineUpgrade`    |                                            miniboss-specific | miniboss             | Excluded from this audit. It does not modify ordinary Combat or Devotion generation merely because they are combat rooms.                                                               |
| Vow of Rivals  | `BossDifficultyShrineUpgrade`   |                                                boss-specific | boss                 | Excluded from this audit. It does not modify ordinary Combat or Devotion generation.                                                                                                    |

## Vow of Hordes

### Difficulty budget

The generated encounter first calculates:

```text
(baseDifficulty + depthDifficulty + difficultyModifier)
  * difficultyMultiplier
```

It then multiplies that result by Hordes' effective `ChangeValue`: 1.2, 1.4,
or 1.6. The minimum-difficulty clamp runs afterward. Wave difficulty is derived
from this increased encounter rating, and `FillEnemyCounts` spends that larger
budget on the already selected enemy types.

This is why Hordes means “more enemies” without owning a separate enemy-count
field. The concrete increase depends on enemy ratings, random budget slices,
minimum-one rules, and count caps. Fixed pre-authored counts are not rewritten;
the increased budget is consumed by generated entries where possible.

### Simultaneous active cap

`CalculateActiveEnemyCap` independently adds `0.4 * effective Hordes rank` to
the encounter cap before applying the encounter's maximum. Assist units and
spell summons are accounted for later, and the global cap is ten.

The source deliberately uses fractional cap values. The audit therefore does
not translate a rank into a guaranteed integer increase in enemies alive at
once. A declaration whose base cap already equals its maximum—common in
Devotion—also clamps away this cap increase even though its total generated
difficulty and enemy count still rise.

Hordes does not alter the probabilities of Menace or Return. It can create
more independent spawn and death trials only because it can create more enemy
units.

## Vow of Menace

Menace runs inside `HandleNextSpawn`, after generation has selected the
original enemy type and count but before `EnemyData` is copied into a live
unit. Unless the encounter, call site, or original enemy blocks the Vow, each
source spawn request independently rolls the effective chance. A request may
expand into a unit group; it is not necessarily one final entity.

On success:

1. the source records `IsFromNextBiomeEnemyShrineUpgrade`;
2. a named `SwapMap` entry replaces the original with its designed successor
   where one exists; otherwise
3. the replacement is chosen from the current biome's declared next-biome
   enemy set; and
4. spawn-point or active-cap-weight overrides from the mapping are applied.

The already calculated `TotalCount` and wave difficulty are not recomputed
against the replacement's generator rating. Menace is therefore spawn
substitution, not an alternate formation pass.

The ordinary route mappings are F -> G, G -> H, H -> I, N -> O, O -> P, and
P -> Q. For those routes, the next biome must have been visited in the profile
before Menace is allowed to expose its enemies. The check is external
save/profile state. I and Q have no `NextRoomSets` or `BiomeEnemySets` entry;
although the chance path can be entered, the current declarations provide no
different next-biome identity to substitute there.

Several encounter and enemy declarations set
`BlockNextBiomeEnemyShrineUpgrade`. The relevant check is made against the
formed encounter and the original enemy before substitution. Ordinary main
generated Combat and eligible Devotion declarations do not globally block
Menace, but a particular selected enemy still can.

### Supported Menace inventory

Inventory of the 114 enemy identities in the 39 supported composition policies,
including fixed seeds. Compared normalized policy pools with inheritance-resolved
EnemyData, native MetaUpgradeData.NextBiomeEnemyShrineUpgrade.SwapMap and
BiomeEnemySets. Native source: MetaUpgradeData.lua:1829–1950,
EnemySets.lua:252, EncounterLogic.lua:784–813. A block takes precedence over a
declared mapping. Each paired row below includes base and `_Elite` source and
destination variants unless explicitly qualified.

#### Deterministic replacements

| Biome | Source -> replacement (both variants)                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F     | Guard -> Guard2; Brawler -> FishmanMelee; Radiator -> Radiator2; Screamer -> FishSwarmerSquad; Mage -> FishmanRanged; SiegeVine -> Turtle                                            |
| G     | FishmanMelee -> Mourner; FishmanRanged -> Lamia; FishSwarmerSquad -> LycanSwarmer; Turtle -> DespairElemental; Guard2 -> CorruptedShadeMedium; Radiator2 -> CorruptedShadeSmall      |
| H     | BrokenHearted -> SwarmerClockwork; Lovesick -> TimeElemental; Mourner -> ClockworkHeavyMelee; Lamia -> SatyrLancer                                                                   |
| N     | Carrion -> Scimiterror; Mudman -> Stickler; Zombie -> WaterElemental; ZombieSpawner -> Swab; ZombieHeavyRanged -> HarpyCutter; ZombieAssassin -> Drunk                               |
| O     | Stickler -> AutomatonBeamer; Swab -> Dragon; Drunk -> AutomatonEnforcer; Scimiterror -> SatyrSapper; HarpyCutter -> HarpyDropper; WaterElemental -> SentryBot; Mage2 -> SatyrLancer2 |
| P     | Dragon -> Brute; HarpyDropper -> Stalker; SatyrLancer2 -> Mati; SatyrCrossbow2 -> DragonBurrower; ZombieOlympus -> Simple                                                            |

#### Random replacements: Fields only in the supported inventory

Nine source identities lack a fixed mapping and are not enemy-blocked:

- DespairElemental_Elite (Bawlder).
- CorruptedShadeSmall and CorruptedShadeSmall_Elite (Blight-Shade).
- CorruptedShadeMedium and CorruptedShadeMedium_Elite (Blood-Shade).
- CorruptedShadeLarge and CorruptedShadeLarge_Elite (Bloat-Shade).
- Lycanthrope (normal Lycaon only).
- Treant2 (fixed Brush-Stalker seed).

Each samples the full BiomeI pool: GoldElemental, TimeElemental,
SwarmerClockwork, ClockworkHeavyMelee, SatyrLancer, SatyrRatCatcher, and each
one's `_Elite` variant (12 identities). The replacement branch uses GetRandomValue
directly, without calling IsEnemyEligible or preserving the original elite flag.
Normal-to-elite and elite-to-normal replacements are therefore possible here.
Do not apply composition eligibility filtering to this separate replacement pool.

#### Enemy-blocked identities

| Biome | Blocked sources                                                                            |
| ----- | ------------------------------------------------------------------------------------------ |
| G     | WaterUnit and WaterUnit_Elite (both have SwapMap rows, but the block wins)                 |
| H     | Lycanthrope_Elite, FogEmitter2, Screamer2                                                  |
| O     | ZombieCrewman and ZombieCrewman_Elite                                                      |
| P     | SentryBot, AutomatonBeamer, AutomatonEnforcer, SatyrSapper, and all four `_Elite` variants |

#### No replacement destination

All 12 supported I types and all 10 supported Q types have neither a SwapMap
entry nor a biome fallback pool. I: GoldElemental, TimeElemental,
SwarmerClockwork, ClockworkHeavyMelee, SatyrLancer, SatyrRatCatcher and elites.
Q: SimpleSquad, Stalker, Brute, Mati, DragonBurrower and elites.
Do not present these as real substitution targets. Native code can still mark
a successful chance branch with IsFromNextBiomeEnemyShrineUpgrade without
changing the name; lack of a destination is not the same as an explicit block.

Counts partition the 114 identities: 68 mapped, 9 random, 15 enemy-blocked,
22 without a destination. Encounter blocks additionally suppress all replacement
in GeneratedH_Passive, GeneratedH_PassiveSmall and GeneratedP_PreCombat.
These are biome-owned pools even in Dream routes, not itinerary-next-biome pools.

## Vow of Fangs

Fangs does not convert normal enemies into elites. After room entry has the
formed `SpawnWaves`, `PickRoomEliteAttributes` inspects each encounter unless
it declares `BlockEliteAttributes`.

For each encounter it:

1. collects the elite enemy types already present in its waves;
2. selects at most `EliteTypeUpgradeCount` distinct types, defaulting to one;
3. filters that type's attribute options through encounter bans, enemy bans,
   run bans, and attribute-specific requirements; and
4. assigns up to the effective Fangs rank—one or two—distinct compatible
   attributes to the selected type.

`SetupUnit` attempts application for elite, non-charmed units using the actual
unit name, preferring its encounter entry and otherwise falling back to the room
entry. Per-room application caps still apply. An empty pool yields no perks but
does not exclude the type from native target selection. If no elite type formed
or the encounter blocks elite attributes, Fangs has no target. Ordinary main
generated Combat and eligible Devotion encounters do not inherit the
miniboss-wide `BlockEliteAttributes` rule.

Attribute assignment occurs after enemy counts are generated. Although the
count helper can price already-recorded room attributes, ordinary Fangs writes
the encounter map after `FillEnemyCounts` and does not rebalance that roster.

Native target sampling initially includes repeated wave entries, then removes
all copies of each chosen type. Supported profiles use one target type and the
effective rank's one/two perks, without nondefault type-count or forced-count
overrides. `GeneratedH_Passive` and `GeneratedH_PassiveSmall` block attributes.

### Complete eligible-type pool inventory

G denotes the generic pool (`EnemySets.lua:649`, `EnemyData.lua:262`):
Blink, ExtraDamage, Fog, Frenzy, HeavyArmor, ManaDrain, Massive, Miasma,
Molten, Orbit, Rooting, SpreadHitShields, StasisDeath, Unflinching, Vacuuming.

All names below carry `_Elite` unless explicitly stated otherwise. Apply the
following context and enemy filters after this declaration-level table.

| Declared pool                  | Supported identities                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G                              | Guard, Radiator, FishmanRanged, FishSwarmerSquad, Turtle, Guard2, Radiator2, CorruptedShadeMedium, BrokenHearted, Lovesick, Lamia, GoldElemental, TimeElemental, SwarmerClockwork, Zombie, Stickler, Scimiterror, WaterElemental, SatyrSapper, SatyrCrossbow2, SimpleSquad, Stalker, Mati, DragonBurrower; unsuffixed Treant2 and Screamer2 |
| G + Rifts                      | Carrion, Drunk, HarpyCutter, AutomatonEnforcer, HarpyDropper                                                                                                                                                                                                                                                                                |
| G + Metallic                   | Mourner, ZombieHeavyRanged, AutomatonBeamer                                                                                                                                                                                                                                                                                                 |
| G + Hex                        | Screamer, CorruptedShadeLarge, SatyrRatCatcher, Mudman                                                                                                                                                                                                                                                                                      |
| G + Homing                     | Mage, WaterUnit, CorruptedShadeSmall, SatyrLancer, Mage2, SentryBot, SatyrLancer2                                                                                                                                                                                                                                                           |
| G + Rifts + Metallic           | Brawler, ClockworkHeavyMelee                                                                                                                                                                                                                                                                                                                |
| G + Hex + Metallic             | FishmanMelee, Swab, Dragon, Brute                                                                                                                                                                                                                                                                                                           |
| G + Rifts + Hex                | Lycanthrope                                                                                                                                                                                                                                                                                                                                 |
| Fog, HeavyArmor, Orbit, Radial | SiegeVine, ZombieSpawner                                                                                                                                                                                                                                                                                                                    |
| Empty                          | DespairElemental                                                                                                                                                                                                                                                                                                                            |

Explicit pool sources: `EnemyData_Brawler.lua:87`, `EnemyData_Screamer.lua:110`,
`EnemyData_Mage.lua:103,199`, `EnemyData_SiegeVine.lua:104`,
`EnemyData_FishmanMelee.lua:82`, `EnemyData_WaterUnit.lua:130`,
`EnemyData_CorruptedShadeSmall.lua:69`, `EnemyData_CorruptedShadeLarge.lua:70`,
`EnemyData_Lycanthrope.lua:104`, `EnemyData_Mourner.lua:116`,
`EnemyData_ClockworkHeavyMelee.lua:85`, `EnemyData_SatyrLancer.lua:95,232`,
`EnemyData_SatyrRatCatcher.lua:105`, `EnemyData_Carrion.lua:148`,
`EnemyData_Mudman.lua:144`, `EnemyData_ZombieSpawner.lua:110`,
`EnemyData_ZombieHeavyRanged.lua:114`, `EnemyData_Swab.lua:99`,
`EnemyData_Drunk.lua:107`, `EnemyData_Harpy.lua:100,205`,
`EnemyData_SentryBot.lua:118`, `EnemyData_AutomatonBeamer.lua:120`,
`EnemyData_AutomatonEnforcer.lua:111`, `EnemyData_Dragon.lua:126`,
`EnemyData_Brute.lua:99`, `EnemyData_DespairElemental.lua:81`.
Inheritance (`RunData.lua:1363–1416`) takes own values before missing parent
values; ordinary option arrays replace, not union with, inherited arrays.

### Filters

| Enemy                     | Native blocks           | Source                               |
| ------------------------- | ----------------------- | ------------------------------------ |
| Mage_Elite, Mage2_Elite   | ExtraDamage             | EnemyData_Mage.lua:64                |
| GoldElemental_Elite       | Tracking, ExtraDamage   | EnemyData_GoldElemental.lua:65       |
| TimeElemental_Elite       | StasisDeath             | EnemyData_TimeElemental.lua:54       |
| SwarmerClockwork_Elite    | SpreadHitShields        | EnemyData_Swarmer.lua:20             |
| ClockworkHeavyMelee_Elite | Orbit, Vacuum           | EnemyData_ClockworkHeavyMelee.lua:47 |
| ZombieHeavyRanged_Elite   | Orbit, Vacuum           | EnemyData_ZombieHeavyRanged.lua:63   |
| AutomatonEnforcer_Elite   | Orbit, Vacuum           | EnemyData_AutomatonEnforcer.lua:66   |
| Dragon_Elite              | Orbit, Vacuum           | EnemyData_Dragon.lua:88              |
| Brute_Elite               | Orbit, Vacuum           | EnemyData_Brute.lua:78               |
| WaterElemental_Elite      | Metallic, Orbit, Vacuum | EnemyData_WaterElemental.lua:58      |
| Screamer_Elite            | Tracking                | EnemyData_Screamer.lua:61            |
| Screamer2                 | Tracking, Vacuuming     | EnemyData_Screamer.lua:161           |
| Treant2                   | Frenzy                  | EnemyData_Treant.lua:60              |

`Vacuum` is not `Vacuuming`: do not silently repair that native spelling.
Blocks of absent options do nothing. Rooting requires room set F/H;
StasisDeath requires N/N_SubRooms/O/P (`EnemyData.lua:436–471`). HeavyArmor
excludes SuperElite (`:313`); no supported identity inherits SuperElite.

The catalog sets `elite: false` for
ZombieAssassin_Elite, ZombieCrewman_Elite and ZombieOlympus_Elite. Their names and
armor do not make them Fangs candidates. Conversely Treant2/Screamer2 inherit
Elite and participate as fixed seeds.

Run bans have an initialized table (`RunLogic.lua:421`), but their ordinary
selection call is commented (`:503`). The only encounter-specific ban declaration
found is Challenge (`EncounterData_Challenge.lua:412`), outside scope. Preserve
native runtime guards; do not add hypothetical authored progression inputs.

### Legal combinations

Every pair of distinct, individually eligible options is possible except:

| Incompatible pair    | EnemyData.lua lines |
| -------------------- | ------------------- |
| Blink / Orbit        | 282, 411            |
| Frenzy / Homing      | 298, 372            |
| Frenzy / Vacuuming   | 298, 352            |
| ExtraDamage / Molten | 333, 359            |
| Fog / Metallic       | 494, 522            |

Native removal is ordered/directed; these current declarations happen to be
symmetric. Rank 1 chooses one perk and rank 2 two when available; selection
stops early only when no compatible option remains. Empty pools do not grant perks.

### Selection is not a promise about every spawned unit

Fog, Hex and Metallic each have `MaxPerRoom = 1`
(`EnemyData.lua:484,510,516`). `ApplyEliteAttribute` enforces that at application
(`ShrineLogic.lua:612–622`), not during selection. Thus repeated waves/cages can
legally select them, but not every copy will receive them. Selection and native
application are separate; the planner does not maintain an application ledger.

Squad application has a bounded live-game uncertainty: FishSwarmerSquad_Elite and
SimpleSquad_Elite inherit generic options, not their children's additions/blocks
(`EnemyData_FishSwarmer.lua:183`, `EnemyData_Simple.lua:147`). Selection records
the squad key. `SpawnUnitGroup` changes the identity to the child
(`EncounterLogic.lua:1011–1040`); `SetupUnit` looks up the final unit name
(`RoomLogic.lua:3309–3319`). No remapping was found. Source therefore indicates
the chosen squad perks may not reach members. Native-source probes exercise
actual-unit lookup, but do not establish live member effects. The planner retains
native selection semantics and does not insert child-key copies to change them.

## Vow of Return

Return is evaluated when a required-kill enemy dies, after that enemy has been
removed from the active and required-kill tables. It is blocked when:

- the death event asks to block respawns;
- the victim declares `BlockRespawnShrineUpgrade`;
- the encounter declares `BlockRespawnShrineUpgrade`;
- the map currently blocks respawns; or
- the death location is blocked.

On a successful 25% or 50% roll, the game creates a respawn egg at the death
location and makes the egg a required kill. If the egg survives its countdown,
it creates a fresh unit from `EnemyData[egg.SpawnedFromName]`, where
`SpawnedFromName` is the dead unit's final runtime name. A Menace replacement
therefore respawns as that replacement, not as its pre-Menace source.

The fresh unit runs through `SetupUnit`, so ordinary shrine-eligible health,
speed, and shield effects apply again. It is explicitly marked
`BlockRespawnShrineUpgrade = true`, preventing a Return chain. Destroying or
otherwise resolving the egg removes the extension without spawning the unit.

## Unit-Modifying Vows

The common enemy base sets `UseShrineUpgrades = true`; neutral and special
units can opt out. During `SetupUnit`:

- Fangs attributes are applied first when the unit is elite and its final name
  has an attribute entry;
- Wards sets `HitShields` from the effective rank unless
  `IgnoreShieldShrine` is true;
- Frenzy adds the effective speed increase unless `IgnoreSpeedShrine` is
  true; and
- Grit scales maximum health and health buffers when the unit uses shrine
  upgrades.

These rules apply to ordinary formed enemies, eligible Menace replacements,
and Return-spawned units according to the final enemy declaration and its
opt-out flags.

Pain is deliberately different. `CreateNewHero` installs the Vow's non-trap
incoming-damage multiplier on Melinoe. Black Night removes that modifier when
it suppresses Pain. No enemy roster or unit-stat calculation consumes Pain.

## Cross-Vow Ordering Conclusions

The source order establishes these interactions:

| Combination             | Result                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hordes + Menace         | Hordes may generate more source requests; each eligible request gets its own Menace roll. Menace does not reprice the Hordes budget for the substituted identity.                                                                                    |
| Hordes + Fangs          | Hordes changes counts, while Fangs selects from elite types already present. More copies of a selected elite type share the same chosen attributes.                                                                                                  |
| Hordes + Return         | Hordes may create more eligible deaths, each with an independent Return roll. Return does not feed units back into the formation budget.                                                                                                             |
| Fangs + Menace          | Fangs entries are keyed by the formed elite type before spawn substitution. A Menace replacement with a different final name does not inherit the original type's keyed attributes. This is a direct sequencing inference from the two lookup paths. |
| Menace + unit modifiers | The replacement is copied from its final `EnemyData` and then runs through ordinary setup, so Grit, Frenzy, and Wards apply unless that replacement opts out.                                                                                        |
| Menace + Return         | Return records and respawns the final substituted name. The respawn is not rolled through Menace again because it bypasses `HandleNextSpawn`.                                                                                                        |
| Fangs + Return          | A respawn of an elite final name receives Fangs only when that same final name has an attribute entry in the room or encounter table.                                                                                                                |

All of these paths read the effective Vow state. Black Night suppression makes
`GetNumShrineUpgrades` return zero and `GetShrineUpgradeChangeValue` return the
inactive value. `CirceRemoveShrineUpgrades` also refreshes the extracted
`ChangeValue` used by older direct readers such as Hordes, Grit, and Frenzy.
Suppression therefore affects subsequent generation and unit setup without
changing the configured starting Fear ranks.

## Confirmed Boundaries and Unknowns

The following are established by static source:

- exact formation/spawn/setup/death ordering;
- each Vow's declared rank values and intervention point;
- Hordes' two distinct modifications;
- Menace's per-source-request replacement and profile gate;
- Fangs' elite-type and attribute-selection cardinality;
- Return's block conditions and no-chain rule; and
- Devotion's reuse of generated encounter formation.

The following are not collapsed into deterministic Planner facts:

1. unauthored wave/type/count/attribute/replacement draws and all respawn RNG results;
2. native-engine behavior around fractional active-cap comparisons beyond the
   visible Lua arithmetic;
3. one universally legal enemy roster independent of introduction and profile
   history.

## Planner Disposition

Generated encounters are native or fully customized. The planner resolves
concrete budget/wave/type/allocation choices into ordered source counts, plus
applicable Fangs assignments and Menace conversions. Incomplete active choices
remain editable but do not publish; unauthored encounters retain native draws.
Health, damage, combat success, duration, summons and Return rolls are not modeled.

Fangs selects a native elite source type from the complete composition, including
fixed seeds, with the effective rank's ordered distinct perks unless the pool is
exhausted. Actual-unit lookup, application caps and room fallback remain native;
source perks are not copied to differently named replacements or squad children.

Menace accepts zero through all effective source requests at either enabled rank.
Mapped sources have fixed destinations; the nine random sources select one
destination per source per wave from the full native pool. This deliberately
expresses a subset of possible native mixtures. Missing settings resolve to zero,
not native rolls. Converted entries preserve source identity/order, required spawn
point, active-cap override and Dream-scaling provenance. Native AddEncounterLayer
keys spawns by name and overwrites duplicate names, so different sources must not
be flattened into a shared replacement bucket. Progress follows successful native
source-request consumption; retries and groups remain native.

Runtime contact ownership and all-wave native admission are documented in
[the encounter contact audit](../game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md#native-encounter-and-phase-identity)
and [the integration boundary](../../design/GAME_INTEGRATION_BOUNDARY.md).
Profile/introduction assumptions and known-history legality remain distinct.
Earlier native compositions are unknown to the planner; selected first-appearance
types carry that warning. Native-source probes do not establish live combat,
squad perk effects or full save-graph restoration. These remain bounded runtime
acceptance questions, not reasons to invent a combat ledger or bypass progression.
