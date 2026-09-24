# Enemy budget and vow scope

Status: budget-slice and Fangs checkpoints delivered. Full-ownership blocker
investigation completed for the supported domain; production installation and
live acceptance remain pending. Deliver current features with Menace suppressed
first, then layer authored Menace onto the same owned product.
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

`RoomLogic.lua:3309` attempts that same type-level selection on each matching
elite, non-charmed unit, preferring its encounter map over the room map. Native
per-room application caps still apply; squad-to-child identity is a separate
realization caveat detailed in `FANGS_PERK_ELIGIBILITY.md`. Thus
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
- The focused `FANGS_PERK_ELIGIBILITY.md` follow-up now owns the complete perk
  pool/filter/combination matrix and its bounded application caveats for Gate B.

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

Per-type target count alone determines replacement identity for mapped types,
but not for the nine random Fields sources. The settled delivery first suppresses
all Menace for customized encounters; the following slice adds a concrete
per-source/per-wave replacement picker for those nine alongside conversion count.
Unit-group formation remains native: a mapped replacement can be a group (e.g.
Screamer -> FishSwarmerSquad), so this count is not necessarily final entity count.

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

Fixed budgets can remain labels and variable budgets a slider over supported
values. The engine maps displayed budget to a native integer base roll; Hordes
and other resolved modifiers still apply. Under the revised ownership decision,
customized encounters require a concrete roll; only an uncustomized encounter
retains native randomness. The committed adapter still steers RandomInt and is
a replacement target, not a constraint on the new installation design.

Supported Fangs census: no nondefault EliteTypeUpgradeCount or forced attribute
count in these 39 profiles; H passive and passive-small explicitly block perks.
Other supported profiles use the one-elite-type selection with one/two attributes
from effective Fangs rank, subject to available compatible options. Fixed elite
seeds participate just as native generation declares; no exclusion merely because
they are read-only composition entries.

### Why weights cannot silently become slices

The released schema-86 persistence stores positive relative weights and requires coverage of
all generated types. Engine generation normalizes them to shares; the executor
returns waveBudget * share for sampled allocation branches. Remainder branches
ignore their stored share, though it still affects normalization of other shares.

An old sample of budget * weight / sum(weights) can be previewed precisely when
budget is known. It cannot be converted permanently into an absolute number
without changing its response to future Hordes/depth/context edits. Incomplete
plans and P's random budget additionally prevent a unique load-time conversion.
The normalized positive-weight encoding also cannot express arbitrary independent
slice requests. Reusing that field would be a semantic break, not a UI change.

The delivered 86-to-87 migration removes weights while preserving wave count,
highlight and composition. Its old missing-slice meaning was native allocation.
Full ownership changes that meaning: incomplete customization must be repaired
before publication. The owner explicitly chose to preserve choices and repair
missing fields. Keep the existing migration's narrow deletion; neither load nor
opening the editor may fill or reset other choices. GitHub release inspection
on 2026-09-23 confirmed planner v0.10.0 still uses 86/44 and executor 0.9.2 uses 44. Thus amend the already-authorized unreleased 87/45 delivery, with no extra
bump. Existing partial local 87 saves remain loadable and repairable.

## Full-ownership installation boundary

Question: can the executor copy the complete resolved composition while leaving
native preparation and combat execution intact? Read-only source review found
the following concrete seams; a single final-wave-table overwrite is not yet a
proven implementation.

| Native source                                                                           | Fact                                                                                                                          | Required disposition before implementation                                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| RunLogic.lua:1150 GenerateEncounter                                                     | Performs hard overrides, passive/ambient setup, money, difficulty, active caps and custom-set construction before composition | Preserve preparation once; do not bypass the entire function                                      |
| RunLogic.lua:1230–1314                                                                  | Builds templates, handles preexisting waves and highlight/family branches                                                     | Prove insertion for fixed/manual templates, not just ordinary waves                               |
| RunLogic.lua:1317 FillEnemyTypes                                                        | Mutates run/encounter blacklists and ActiveEnemyCapBonus                                                                      | Do not run discarded random composition then overwrite its visible result                         |
| RunLogic.lua:1099 SetupEncounter                                                        | Can substitute an uncompleted intro encounter                                                                                 | Explicit binding/fallback when the prepared identity changes                                      |
| RunLogic.lua:1583 IsEnemyEligible                                                       | Reads current wave members, blacklist, live traits and external intro progression                                             | Validate at preselection context, never against a populated result; no second Lua legality engine |
| EncounterLogic.lua:1381 AddEncounterLayer; RoomLogic.lua:CalcTotalSpawns (body at 3759) | Generated counts can still receive depth/run ramps and hero SpawnMultiplier                                                   | Define generated versus effective count units; apply transforms exactly once                      |
| EncounterLogic.lua:784–813 HandleNextSpawn                                              | Menace carries provenance, RequiredSpawnPoint and mapped ActiveCapWeight; consults EncounterData when available               | Preserve metadata and prevent a second conversion without globally mutating declarations          |
| RoomLogic.lua:3296                                                                      | Menace provenance affects Dream scaling                                                                                       | Converted entries cannot be plain renamed enemies                                                 |
| EncounterLogic.lua:1011 SpawnUnitGroup                                                  | Expands a group and suppresses recursive shrine conversion                                                                    | Count source requests, preserve source identity and native child creation                         |
| RoomLogic.lua:1183,1913,5273                                                            | Normal room and forced encounter contacts can select Fangs                                                                    | Install once and prevent later selection overwrites at applicable contacts                        |
| RoomLogic.lua:3310 SetupUnit                                                            | Reads actual unit identity and room/encounter attribute maps                                                                  | Preserve native lookup, caps and fallback; no perk transfer to replacement/child keys             |

Native eligibility and substitution are different domains: the random H Menace
pool is not filtered through IsEnemyEligible. A single replacement per source
type per wave is the newly accepted bounded authoring model; native rolls can
produce mixtures, which this editor intentionally does not express. All nine
random sources are now included rather than deferred.

### Settled source and probe results

Raw native function bodies were loaded from the installed scripts at execution
time, using the existing external-source probe loader or stdin Lua. No game source
was copied into the repository. The probes used synthetic scaffolding/stubs for
unrelated native dependencies; they prove contact behavior, not complete integration.

1. **Preparation and template seam.** Both approaches passed: preexisting fully
   prepared waves skip type/count filling, and BlockHighlightEncounter plus direct
   FillEnemyTypes/FillEnemyCounts installation leaves native template construction
   intact. The latter is recommended: native handles manual final templates,
   first-wave delay/override changes, money/passive/ambient setup, difficulty and
   caps. Pin wave count/base through copied encounter fields, not RNG interception.
   The probe verified no discarded type/count draws and preserved installed counts.
   Supported policies have no preexisting-wave source case; the located
   GeneratedO_Intro01_First case is Generated=false and outside this 39-policy set.

2. **Selected-type side effects.** Source confirms four bounded operations:
   highlight encounter blacklist, appended-type first-appearance run blacklist,
   appended-type blocked successors when BlockTypesAcrossWaves, and appended-type
   ActiveEnemyCapBonus. Fixed/highlight/template-placeholder entries do not receive
   all appended-type effects. Carry provenance with the resolved list. Preserve
   those operations rather than cloning eligibility or GenerateEncounter.

3. **Count completeness.** Reran the inheritance extractor against current sources
   and enumerated all 39 supported keys: 37 lack count transforms; the two fixed H
   profiles declare EnemyCountDepthRamp=0 and fixed TotalCount=1. None has run ramps,
   randomized fixed CountMin/Max, InfiniteSpawns or RequiredMiniBossShrine. Current
   trait declarations contain no SpawnMultiplier. Generated count therefore equals
   effective request count here. Retain this bounded source assertion in tests;
   do not invent new context or override CalcTotalSpawns for hypothetical effects.

4. **Fangs and restoration.** Intercept PickEncounterEliteAttributes to install
   the complete source-type assignment and skip selection for owned encounters.
   This covers both native callers; keep SetupUnit/ApplyEliteAttribute and room
   fallback unchanged. Existing phases.prove rebinds canonical encounter tables
   at room entry before StartRoom; use it on reload instead of relying only on
   generation-time weak-map identity. Do not regenerate saved composition.

5. **Pre-Menace suppression.** The owner selected zero conversions, even with an
   active vow. A raw HandleNextSpawn probe with copied IgnoreShrineOverrides=true
   skipped Menace RNG, spawned the original group and consumed the native source
   request. An unsuppressed control converted with provenance, required-spawn-point
   sentinel and ActiveCapWeight. Scope only the owned encounter; native stays native.

6. **Later Menace cannot flatten by target name.** Raw AddEncounterLayer probe
   confirmed its Spawns[name] table overwrites duplicate names: entries with counts
   3 and 2 under one name leave only 2. Two sources can convert to the same target,
   or a converted target can already exist. Keep source entries; resolve a concrete
   transformed request at HandleNextSpawn rather than making target-keyed buckets.
   A raw-function feasibility probe passed a copied transformed request with
   shrine overrides suppressed, reflected its successful remaining-count decrement
   to the source, and derived conversion progress from original count minus native
   RemainingSpawns. Failed attempts consumed nothing; a reconstructed source table
   did not repeat conversion; two distinct sources shared a target without aliasing.
   No RNG steering, alias enemies or independent progression ledger is required.
   Real recursive group/setup, metadata, error and reload integration witnesses
   remain acceptance tests for the Menace slice, not claimed completed by stubs.

7. **Legality and failure boundary.** Planner assessment remains the legality
   authority. Runtime preflight checks complete supported payload/declaration
   contacts before installation; existing native encounter diagnostics remain.
   Do not recheck installed members through IsEnemyEligible: duplicates/blacklists
   would reject the result itself. Preserve native SetupEncounter intro substitution
   and diagnose returned-identity changes without binding customization to the
   replacement. No progression overrides or transactional rollback of gameplay.

### Initializer and delivery disposition

The exact preparation capability already supplies resolved generation context.
Extend it with deterministic complete initialization; ordinary editing repairs
missing choices through the same assessor/candidate domains. Only Reset
Customization remains: no inner Default/reset or fill-missing preset. Choose supported inputs with
bounded prefix backtracking where an early choice blocks completion; do not add
a general constraint solver or pick invalid defaults. Equal allocation is a
planner convenience, not the native RandomNormal mean (fixed-cost treatment
differs). Unavailable context or no legal completion must return a truthful reason.

No remaining model blocker prevents the pre-Menace conversion. Its vertical gate
replaces sparse authorship/publication and RNG realization together, preserving
partial saved choices as findings. The later Menace gate adds the two rows and
resolved conversions; missing Menace settings keep the earlier explicit zero
behavior. Native-source contact probes and current-data census do not replace
production integration/reviewer checks or live-game acceptance.
