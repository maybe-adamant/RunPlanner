# Enemy budget and vow scope

Status: bounded source investigation; delivery choices settled, no production
implementation changed.
Source: installed Hades II scripts, inspected 2026-09-23.

## Question

Can encounter authoring replace relative weights with a difficulty meter and
perk selection? Establish cost, Hordes, Fangs, and Menace ownership first.
Scope is generated encounters, not every scripted spawn or summon.

## Budget and allocation

`RunLogic.lua:1151–1260` (`GenerateEncounter`) computes:

`(base + depth * depthRamp * depthMultiplier + modifier) * multiplier * Hordes`

It then applies the minimum difficulty. Base can be a random integer range;
depth can be biome depth, run depth, or biome encounter depth. Hard encounter
overrides apply before calculation. Wave count partitions the total through
`EncounterData.lua:3` (`WaveDifficultyPatterns`): one wave 100%; two 50/50%;
three 30/15/55%; four 30/10/20/40%. More waves do not create equal shares.

`RunLogic.lua:1485` (`FillEnemyCounts`) charges fixed template entries first,
using TotalCount or CountMax. Generated types receive sampled budget slices;
the remainder branch receives the remaining budget. Quantity is the ceiling
of slice divided by declared `GeneratorData.DifficultyRating`, at least one,
with per-type MaxCount and redistribution to an earlier uncapped type.
Consequently the budget is not a strict ceiling or exact fill target.

`RunLogic.lua:1468` (`CalculateEnemyDifficultyRating`) starts with that declared
cost. For elite enemies it can add each configured attribute multiplier's
excess above one, then multiply base cost by the resulting multiplier. This
helper reads **room.EliteAttributes**, not encounter.EliteAttributes. Initial
generated quantity division uses base cost; accumulated cost uses the helper.

## Vow matrix

| Vow    | Native change                                         | Scope and timing                                                                          | Budget implication                                                                         |
| ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hordes | Difficulty multiplier 1.2/1.4/1.6                     | Encounter generation, before wave partition                                               | Enlarges budget, not an exact percentage increase in headcount                             |
| Fangs  | One/two eligible attributes on selected elite type(s) | Encounter-owned selection after generation; default one distinct elite type per encounter | Ordinary Fangs does not recompute generated quantities or populate the room-level cost map |
| Menace | 10%/25% replacement chance                            | Each eligible `HandleNextSpawn` call                                                      | Substitutes after allocation; no budget recalculation                                      |

Hordes also adds 0.4 per rank to the active-enemy-cap calculation
(`EncounterLogic.lua:1339`); simultaneous pressure is separate from total count.
Rank declarations: `MetaUpgradeData.lua:1781`, `:1829`, `:2102`.

## Fangs detail

`RoomLogic.lua:1183` calls `PickRoomEliteAttributes` at room start.
`PickRoomEliteAttributes` / `PickEncounterEliteAttributes` (`:5273`, `:5297`)
inspect already-generated waves across room encounters, including cages.
Eligible elite spawn entries are collected, one type is randomly selected by
default (`EliteTypeUpgradeCount or 1`), and all copies of that name are removed
before selecting another type. A type present in several waves appears several
times in the initial selection list; the list is not initially deduplicated.

`ShrineLogic.lua:687` chooses attributes from the type's options, honoring bans,
native eligibility, and mutual exclusions. It records the result under
`encounter.EliteAttributes[enemyName]`. Rank specifies attribute count, not the
number of upgraded types. Explicit encounter overrides can alter these counts.

`RoomLogic.lua:3309` applies that same type-level selection to each matching
elite, non-charmed unit, preferring its encounter map over the room map. Thus
it is neither independent per entity nor independently chosen per wave.
Separate cage encounters can select different attributes for the same type.

Important correction to the earlier conversational explanation: the existence
of perk-aware cost calculation does not demonstrate ordinary Fangs increases
generation cost. Assignments occur later and use a different owner. The source
trace provides no ordinary Fangs-to-budget feedback path. A live probe can
confirm this before implementing any budget preview.

## Menace detail

`EncounterLogic.lua:784–813`, inside `HandleNextSpawn`, rolls independently for
each spawn request, shallow-copies its spawn info, then uses an explicit SwapMap
or the biome's configured replacement pool. It does not rewrite the generated
wave list or recalculate count. Encounter/enemy blocking flags, ignored shrine
overrides, and next-biome visit progression can suppress it. Pools are declared
by biome, not dynamically inferred from a Dream route's next selected biome.

Mixed original/replacement enemies can therefore appear from one generated
type. A spawn request can also represent a unit group: do not claim one roll
per individual entity in every case. Fangs application subsequently consults
the resulting unit's name, not the originally budgeted type.

## Decision implications and remaining bounds

- A budget preview is feasible as a **generation budget**, not a promise about
  final enemies, effective combat difficulty, or exact meter fill.
- Fangs authoring should select encounter-level eligible elite type(s) and
  attributes, not arbitrary perks for every type in every wave.
- Menace remains later per-spawn substitution; it cannot be represented by
  merely adjusting the cost of the generated type.
- An exact quantity editor would need allocation, fixed entries, random base
  ranges, ceilings, caps, and ordering modeled explicitly. Perk authoring alone
  does not solve those issues.
- No exhaustive perk-options matrix or executor intervention design is included.
  Those need a separate bounded follow-up only if this direction is selected.

## Menace replacement inventory

Inventory of the 114 enemy identities in the 39 supported composition policies,
including fixed seeds. Compared normalized policy pools with inheritance-resolved
EnemyData, native MetaUpgradeData.NextBiomeEnemyShrineUpgrade.SwapMap and
BiomeEnemySets. Native source: MetaUpgradeData.lua:1829–1950,
EnemySets.lua:252, EncounterLogic.lua:784–813. A block takes precedence over a
declared mapping. Each paired row below includes base and `_Elite` source and
destination variants unless explicitly qualified.

### Deterministic replacements

| Biome | Source -> replacement (both variants)                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F     | Guard -> Guard2; Brawler -> FishmanMelee; Radiator -> Radiator2; Screamer -> FishSwarmerSquad; Mage -> FishmanRanged; SiegeVine -> Turtle                                            |
| G     | FishmanMelee -> Mourner; FishmanRanged -> Lamia; FishSwarmerSquad -> LycanSwarmer; Turtle -> DespairElemental; Guard2 -> CorruptedShadeMedium; Radiator2 -> CorruptedShadeSmall      |
| H     | BrokenHearted -> SwarmerClockwork; Lovesick -> TimeElemental; Mourner -> ClockworkHeavyMelee; Lamia -> SatyrLancer                                                                   |
| N     | Carrion -> Scimiterror; Mudman -> Stickler; Zombie -> WaterElemental; ZombieSpawner -> Swab; ZombieHeavyRanged -> HarpyCutter; ZombieAssassin -> Drunk                               |
| O     | Stickler -> AutomatonBeamer; Swab -> Dragon; Drunk -> AutomatonEnforcer; Scimiterror -> SatyrSapper; HarpyCutter -> HarpyDropper; WaterElemental -> SentryBot; Mage2 -> SatyrLancer2 |
| P     | Dragon -> Brute; HarpyDropper -> Stalker; SatyrLancer2 -> Mati; SatyrCrossbow2 -> DragonBurrower; ZombieOlympus -> Simple                                                            |

### Random replacements: Fields only in the supported inventory

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

### Enemy-blocked identities

| Biome | Blocked sources                                                                            |
| ----- | ------------------------------------------------------------------------------------------ |
| G     | WaterUnit and WaterUnit_Elite (both have SwapMap rows, but the block wins)                 |
| H     | Lycanthrope_Elite, FogEmitter2, Screamer2                                                  |
| O     | ZombieCrewman and ZombieCrewman_Elite                                                      |
| P     | SentryBot, AutomatonBeamer, AutomatonEnforcer, SatyrSapper, and all four `_Elite` variants |

### No replacement destination

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

### Authoring consequence

Per-type target count alone fully determines replacement identity for mapped
types. For the nine random Fields types it determines only how many spawn
requests are substituted, leaving their replacement identities native unless a
separate outcome editor is deliberately added. Unit-group formation remains
native: a mapped replacement can be a group (e.g. Screamer -> FishSwarmerSquad),
so this count is not guaranteed to equal the number of final enemy entities.

## Pre-plan resolution: slices, ordering and compatibility

The premature delivery-plan draft was removed. The following source conclusions
support the agreed replacement contract.

### Native slice domain and ordering

`RandomLogic.lua:135` defines RandomNormal as mean plus RandomGaussian times
standard deviation, with no Lua-side truncation. Earlier investigation failed
to locate this definition; that uncertainty is corrected here. Engine RNG
precision is not an authoring rule. FillEnemyCounts clamps samples above the
remaining budget and floors the resulting slice to one base enemy cost.
Negative samples therefore collapse to the same minimum-one outcome.

Recommended editor value: the nonnegative allocation request before native
clamps, accompanied by effective slice and derived count. There is no requirement
that requests sum to the wave budget. Large/stale requests can be visibly clamped
by native rules rather than inventing a new legality finding. Integer stepping
is presentation convenience, not a declaration that native budgets are integers.

Ordinary generated arrays are ordered highlight-first, then authored selected
types (native AddToSpawnTable appends). Their last generated entry uses the native
remainder branch. Single-generated-type waves have no editable allocation sample.

H Treant/Screamer templates instead contain fixed enemy at array index 1 and
one generated entry at index 2. Generated count is 1, so index 2 does not enter
the remainder branch: it samples against full wave budget, then clamps against
remaining budget after charging the fixed enemy. Expose one editable slice for
that companion, with the fixed enemy read-only. No fabricated remainder row.

### Supported budget census

Checked all 39 normalized generated policies against the native declarations
resolved with ProcessDataInheritance in the existing audit probe, including
hard overrides and Dream overrides. Exactly one has a base range:
GeneratedP_PreCombat, integer 340–500. The other 38 have fixed base values;
their final budgets still depend on exact depth, hard state, modifiers and Hordes.
No additional random range appeared in their hard/Dream overrides.

Owner decision: fixed wave budgets are labels; variable budgets have a slider
selecting a native-supported budget. Default retains native randomness until an
explicit edit. The engine maps the displayed final wave budget to the native
integer base roll; Hordes and other resolved modifiers still apply. Selecting a
roll steers the existing RandomInt contact, not an invented difficulty override.

Supported Fangs census: no nondefault EliteTypeUpgradeCount or forced attribute
count in these 39 profiles; H passive and passive-small explicitly block perks.
Other supported profiles use the one-elite-type selection with one/two attributes
from effective Fangs rank, subject to available compatible options. Fixed elite
seeds participate just as native generation declares; no exclusion merely because
they are read-only composition entries.

### Why weights cannot silently become slices

Current persistence stores positive relative weights and requires coverage of
all generated types. Engine generation normalizes them to shares; the executor
returns waveBudget * share for sampled allocation branches. Remainder branches
ignore their stored share, though it still affects normalization of other shares.

An old sample of budget * weight / sum(weights) can be previewed precisely when
budget is known. It cannot be converted permanently into an absolute number
without changing its response to future Hordes/depth/context edits. Incomplete
plans and P's random budget additionally prevent a unique load-time conversion.
The normalized positive-weight encoding also cannot express arbitrary independent
slice requests. Reusing that field would be a semantic break, not a UI change.

Owner decision: one authored schema bump is explicitly approved. Ship an explicit
migration script and register the same migration in the app. Remove old weights,
preserving wave count, highlight and composition; absent slices mean native
allocation, not required reauthoring. Explain the reset to users. Do not retain a
legacy weight interpreter or fabricate equivalent absolute slices. New execution
operands require coordinated protocol versioning and republishing.
