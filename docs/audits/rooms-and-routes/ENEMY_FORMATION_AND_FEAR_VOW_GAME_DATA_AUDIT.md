# Enemy Formation and Fear Vow Game-Data Audit

## Status and Scope

This document is the stable source-evidence authority for how Hades II forms
the enemies in a generated combat encounter and where Fear Vows intervene in
that process. It was read directly against the installed Steam build on
2026-08-29:

- application ID: `1145350`;
- build ID: `24556151`;
- routes: Underworld F/G/H/I and Surface N/O/P/Q.

The primary scope is the generated encounter used by an ordinary main Combat
room and the generated `DevotionTest*` encounter used by a Devotion room. The
same lower-level functions may be reused elsewhere, but this audit does not
claim a disposition for opening, NPC, challenge, passive Fields, side-room,
miniboss, or boss encounters. Minibosses are deliberately excluded; Vow of
Shadow and miniboss-specific encounter selection are separate questions.

This audit distinguishes four different concepts that should not be collapsed:

1. **formation** chooses waves, enemy types, and total counts;
2. **spawn substitution** may replace a formed enemy as it enters the map;
3. **unit setup** adds attributes, shields, speed, and health to the spawned
   unit; and
4. **post-death extension** may add a respawn egg and another required enemy.

Exact RNG outcomes, exact authored wave control, combat success, damage taken,
and elapsed combat time are outside the current Planner model. Static source
inspection establishes the order and eligibility rules below, not one
deterministic enemy roster for a room.

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

The installed main-room declarations expose Devotion encounters in F, G, I,
N, and O. H and P retain commented Devotion contacts while their ordinary room
data blocks the reward, and Q has no declared `DevotionTestQ` implementation.
This availability fact does not change how an eligible Devotion encounter is
formed.

## Fear Vow Intervention Matrix

| Vow            | Game key                        |                                                 Effect ranks | Stage                | Enemy-formation disposition                                                                                                                                                             |
| -------------- | ------------------------------- | -----------------------------------------------------------: | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vow of Hordes  | `EnemyCountShrineUpgrade`       | difficulty x1.2 / x1.4 / x1.6; active cap +0.4 / +0.8 / +1.2 | formation            | Directly changes generated total counts and may allow more concurrent enemies. Does not add waves or types directly.                                                                    |
| Vow of Menace  | `NextBiomeEnemyShrineUpgrade`   |                                   10% / 25% per spawned unit | spawn substitution   | May replace an individual formed enemy with a next-biome enemy immediately before unit creation. Does not recalculate the wave budget or count.                                         |
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
unit independently rolls the effective chance.

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

All spawned units of that keyed elite type receive the selected attributes
during `SetupUnit`. If no elite type formed, no legal attribute remains, or
the encounter blocks elite attributes, Fangs has no target. Ordinary main
generated Combat and eligible Devotion encounters do not inherit the
miniboss-wide `BlockEliteAttributes` rule.

Attribute assignment occurs after enemy counts are generated. Although the
count helper can price already-recorded elite attributes, the room-level Fangs
attributes do not exist during the earlier `FillEnemyCounts` pass and therefore
do not reduce or rebalance that generated roster.

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
| Hordes + Menace         | Hordes may generate more units; each final spawn gets its own Menace roll. Menace does not reprice the Hordes budget for the substituted identity.                                                                                                   |
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
- Menace's per-unit replacement and profile gate;
- Fangs' elite-type and attribute-selection cardinality;
- Return's block conditions and no-chain rule; and
- Devotion's reuse of generated encounter formation.

The following are not collapsed into deterministic Planner facts:

1. the exact wave, type, count, attribute, replacement, or respawn RNG result;
2. native-engine behavior around fractional active-cap comparisons beyond the
   visible Lua arithmetic;
3. one universally legal enemy roster independent of introduction and profile
   history; and
4. a safe runtime intervention seam for forcing an exact roster.

## Planner Disposition

The Planner currently persists configured Fear ranks and run-local suppression
but does not author enemy waves, types, counts, attributes, or respawn rolls.
Because health, damage, combat success, and combat duration are not modeled,
the combat consequences documented here remain simulation-neutral today.

That disposition must not be mistaken for “unmodeled Vows have no game
effect.” The effective Vow state remains meaningful run state, and this audit
preserves the exact formation contacts for a future encounter-execution or
combat-composition slice.

Any future slice should preserve the four stage boundaries in this audit. It
should not precompute a single combined Vow-adjusted roster, and it should not
extend miniboss or boss conclusions from ordinary Combat and Devotion without
a separate source audit.

### Bounded first composition slice for future reassessment

If the Planner later begins authoring generated combat composition, the
smallest source-shaped first slice is:

1. author the resolved wave count within the selected encounter declaration's
   `MinWaves` through `MaxWaves` domain; and
2. when that resolved encounter takes the highlight-generation path, author
   one eligible highlight enemy for the encounter.

The highlight is encounter-wide. `GenerateEncounter` selects it once and adds
that same enemy type to every generated wave; it does not select an independent
dominant type for each wave. All additional enemy types, difficulty slices,
counts, spawn substitutions, elite attributes, and respawn outcomes should
remain game-resolved in this first slice.

This boundary is independent of the Vow interventions: Hordes changes the
difficulty budget and active cap but not the declared wave-count domain, Fangs
enhances formed elite types, Menace substitutes individual spawns, and Return
acts after deaths. Planner possibility is source-backed by the declared wave
range and progressively derived enemy eligibility. A runtime adapter capable
of enforcing the chosen wave count and highlight without bypassing ordinary
encounter setup remains unproven and requires separate execution evidence
before implementation.
