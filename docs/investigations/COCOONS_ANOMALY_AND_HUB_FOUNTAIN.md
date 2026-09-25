# Cocoons, anomaly composition, and the Hub fountain

Status: investigation; no implementation contract locked. 2026-09-25.

## Question and disposition

Investigate the remaining encounter customization and Hub interaction gaps
without assuming they fit ordinary generated waves or ordinary room actions.

| Feature                | Native shape                                                                 | Recommended bounded shape                                                               |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Arachne combat cocoons | 8–14 physical cocoons; one randomly chosen reward cocoon at setup            | Optional cocoon count; leave placement, contents, and reward location native            |
| Anomaly                | One infinite-spawn roster, not successive generated encounters               | Optional encounter-wide enemy roster; native replenishment and capture progress         |
| Ephyra fountain        | One persistent fountain, usable between visits and required before departure | One mandatory Hub action ordered among six room visits; reuse existing fountain effects |

Source references below are relative to the local Hades II `Scripts/` directory.
They identify inspected source, not an automated drift guarantee.

## 1. Arachne combat cocoons

### Confirmed source behavior

`EncounterData_Arachne.lua` declares `ArachneCombatF` and `ArachneCombatG`
through `BaseArachneCombat`. Setup requests 8–14 cocoons. The size list contains
three small, two medium, and one large entry; G uses corresponding G variants.
This encounter does not use the ordinary generated-wave model.

`EncounterLogic.lua:2722`, `SetupArachneCombatEncounter`, first spawns the
cocoons, then randomly selects one existing cocoon from `CoocoonIds`. It assigns
`SpawnRoomReward` to that object's death callback and records its object ID as
the room reward spawn location. It clears that cocoon's `SpawnUnitOnDeath`.
There is **no reward-after-N-breaks counter**. The reward already belongs to a
physical cocoon before the player starts breaking them.

`SpawnArachneCocoons` in the same file chooses spawn points through
`SelectSpawnPoint`, creates obstacles, and runs `SetupObstacle`. Placement is
Lua-orchestrated, but uses native room spawn-point selection. Setup can return
early when no usable spawn point is found; requested count is not proof of
successful physical placement.

`ObstacleData.lua` and `RunLogic.lua:2376`, `ProcessObjectValueOptions`, resolve
contents during obstacle setup. Ordered rolls try bomb, enemy, then money;
no successful roll leaves an empty cocoon. These are not mutually exclusive
probability weights to normalize. Enemy selection uses the biome enemy set and
`IsEnemyEligible`. Breaking the cocoon later spawns the previously selected
unit (`CombatLogic.lua:3998`). Reward assignment clears the unit outcome but
does not visibly clear an already-set money-drop field.

`EncounterSets.EncounterEventsArachneCombat` waits for `ArachneRewardFound`.
`SpawnRoomReward` emits that notification during reward spawning
(`RewardLogic.lua:303`). Finding the reward, not breaking every cocoon, releases
that encounter wait. This does not imply bypassing other native exit checks.

The existing source matrix owns the detailed content pools:
`docs/audits/rooms-and-routes/COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md`, Arachne
combat section.

### Current boundary and useful scope

Catalog declarations in `declarations/encounters/f.ts` and `g.ts` already model
the encounter identities, but expose no cocoon customization. The executor has
no dedicated cocoon setup adapter.

A count-only customization, Default or 8–14, has a narrow native contact:
scope the setup arguments to the requested count while retaining native
placement, size/content rolls, and reward-cocoon selection. It should not enter
the generated-wave count installer.

Do not offer “reward after X cocoons”: enforcing that would change the native
physical assignment contract. Selecting a physical reward cocoon is a different
feature requiring usable spatial identity and is excluded from this proposal.
Story-room decorative cocoons are also excluded.

Before locking implementation, confirm interception mechanics and test the
count extremes in both biomes, including placement shortfalls. No additional
content editor is necessary for this bounded feature.

## 2. Anomaly encounter

### Confirmed source behavior

`EncounterData_Challenge.lua:92–192` declares `GeneratedAnomalyBase` and
`GeneratedAnomalyB`: one wave, `InfiniteSpawns = true`, two to three enemy types,
at most one elite type, and a declared active cap of five. The B pool is in
`EnemySets.lua:599`. Actual candidates still pass native eligibility rules.

`RunLogic.lua`, `GenerateEncounter`, creates the roster once.
`FillEnemyCounts` at line 1485 marks entries infinite and returns **before**
ordinary difficulty-to-count allocation. The finite-wave budget/count model
therefore does not describe anomaly spawning.

`EncounterLogic.lua`, `HandleEnemySpawns`, repeatedly selects from that roster.
`GetNextSpawn` continues admitting infinite entries; `HandleNextSpawn` does not
decrement their remaining spawn count. Clearing the currently spawned enemies
does not call `GenerateEncounter` again or choose another composition.

The declaration contains time-limit/template fields, but the inspected Lua
uses `AddAtTime` only when constructing templates, not as a repeated generation
trigger. The active completion path is capture progress:
`TrackCapturePointChallengeProgressReal` starts at 15, raises progress inside
the capture area and lowers it outside. Reaching 100 or 0 stops the encounter.
`EndCapturePointChallengeEncounter` grants the challenge reward on success.
The native encounter event sequence owns cleanup and presentation.

### Current boundary and useful scope

`declarations/encounters/anomaly.ts` and `declarations/rooms/anomaly.ts` already
represent the encounter and rooms. The existing planner also owns the authored
challenge outcome. None of that requires a four-encounter approximation.

The executor's `room/timeline/encounters/generated.lua` explicitly declines
infinite-spawn encounters. That is a valid boundary for its finite installer,
not a flag to remove without a separate contract.

Recommended first feature: choose the encounter's two-to-three-type roster,
leaving spawn pacing, active caps, positions, replenishment, capture progress,
and cleanup native. One roster governs the entire challenge. No wave-count,
enemy-budget, finite-count, or finite Menace conversion-count controls apply.
An uncustomized encounter remains entirely native.

### Completed B-pool eligibility audit

The pool contains 15 native identities. The table groups normal/elite pairs;
`_Elite` means the corresponding suffixed identity, not an additional alias.

| Native family           | Available variants   | Eligibility and combination facts                                                                |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------ |
| `Swarmer`               | `Swarmer_Elite` only | Own empty requirements override Elite's depth gate; blocks `Swarmer`, which is outside this pool |
| `SpreadShotUnit`        | Normal and `_Elite`  | Elite inherits depth >= 3; asymmetric exclusion, described below                                 |
| `BloodlessNaked`        | Normal and `_Elite`  | Elite inherits depth >= 3; variants mutually exclude each other                                  |
| `BloodlessWaveFist`     | Normal and `_Elite`  | Elite inherits depth >= 3; variants mutually exclude each other                                  |
| `BloodlessBerserker`    | Normal and `_Elite`  | Elite inherits depth >= 3; variants mutually exclude each other                                  |
| `BloodlessGrenadier`    | Normal and `_Elite`  | Elite inherits depth >= 3; variants mutually exclude each other                                  |
| `BloodlessSelfDestruct` | Normal and `_Elite`  | Elite inherits depth >= 3; variants mutually exclude each other                                  |
| `BloodlessPitcher`      | Normal and `_Elite`  | Elite inherits depth >= 3; variants mutually exclude each other                                  |

Sources: `EnemySets.lua:599`; `EnemyData_Swarmer.lua:3–96`,
`EnemyData_LightRanged.lua:112–164`, `EnemyData_BloodlessNaked.lua`, and
`EnemyData_BloodlessGrenadier.lua`. Followed their ancestry through
`BaseGEnemy`, `BaseFEnemy`, `BaseVulnerableEnemy`, and `Elite` in `EnemyData.lua`.
`Elite.GameStateRequirements` uses `CurrentRun.BiomeDepthCache >= 3`.
`Swarmer_Elite` explicitly declares an empty table (its old depth check is a
comment), so it does not inherit that gate. `RunData.lua:1363–1425` preserves
child-defined tables unless deep inheritance is requested. Use the actual
biome-depth context, not a new B-local depth counter: `GetBiomeDepth` walks
history back to `NextRoomSet`; anomaly uses the previous room set.

None of these resolved families declares an intro encounter, a once-per-run
appearance blacklist, or an additional enemy-specific eligibility requirement
beyond the elite gate above. No relevant allegiance type cap is declared by
`GeneratedAnomalyB`, its anomaly base, or `Generated`. There is no forced elite:
zero or one is valid. Normal types have no additional depth gate here.

**Asymmetric SpreadShot rule:** normal `SpreadShotUnit` blocks its elite.
The elite has no own `GeneratorData`, so it inherits that same table and blocks
itself, not the normal type. Native `FillEnemyTypes` first collects candidates,
then removes exclusions after each draw. Consequently **elite then normal is
possible; normal then elite is not**. Do not normalize this into a symmetric
family ban. Preserve a native-realizable selection order in the authored roster
and installation. A staged picker can follow that order, with findings for
context-invalid retained selections. This uses existing possibility semantics;
it does not require probability modeling.

`RunLogic.lua:1317–1457` owns distinct-type selection, elite cap, and directional
exclusions. `IsEnemyEligible` at 1576 additionally checks live encounter/run
blacklists and hero `BlockedEnemyTypes`. Those remain live admission contacts;
the inspected trait declarations supply no `BlockedEnemyTypes` producer. The
intro and solo checks in the generic function add no restriction for this pool
and its two-to-three-type roster. Candidate shortages can reduce native draws,
but the supported mature-state pool has ample normal choices; do not invent a
one-type authoring option for hypothetical external blacklist exhaustion.

### Spawn accounting and shared hook ownership

The declared cap of five is **active-cap weight**, not necessarily five enemy
entities. `Swarmer_Elite` inherits `ActiveCapWeight = 0.35` and contributes
`GeneratorData.ActiveEnemyCapBonus = 2`. Most listed elites use weight 1.5;
`BloodlessNaked_Elite` has no such override. Preserve this native accounting.
The extra cap bonus remains subject to `CalculateActiveEnemyCap`'s maximum;
do not translate it into a promised extra two enemies. No new budget UI follows.

The executor already owns `GenerateEncounter`, `CalculateActiveEnemyCap`, and
`FillEnemyTypes` contacts in `room/timeline/encounters/generated.lua`.
Use that single hook owner with variant-specific admission/installation, not
another module independently wrapping those functions. At the existing
pre-wave cap contact, validate the roster against the effective native pool,
live eligibility, and ordered composition before mutation. No `expectedBudget`
or finite-count verification belongs to this variant.

At the fill contact install ordered `{ Name, Generated = true }` entries and
type count, preserving native exclusion/cap-bonus side effects. Leave native
`FillEnemyCounts` to mark the entries infinite. Do not set finite `TotalCount`
or attach the finite-owned marker consumed by the Menace suppression hook.
Finite Fangs/converted-count overrides must likewise not claim this variant;
native Fangs/Menace behavior remains untouched. Existing finite installation's
infinite-spawn rejection remains specific to its own variant.

The source audit is complete for this roster-only scope. Runtime acceptance
still needs to demonstrate replenishment, native vow behavior, and success/
failure cleanup. This was static inspection, not a game-script execution probe.

## 3. Ephyra Hub fountain

### Confirmed source behavior

`RoomDataN.lua:1605` installs object 664734 as `HealthFountainN` with persistent
object-state recording. `ObstacleDataN.lua:849` initially sets
`BlockExitUntilUsed = false` and installs two setup events:

- `HealthFountainNExitCheck` applies once six Soul Pylons have spawned.
- `HealthFountainNRestoreState` restores the used fountain presentation.

`EventLogic.lua:1832` makes the unused fountain a required room object at that
departure stage. It is available earlier, and its used state survives Hub
returns. Thus use is **mandatory before leaving the Hub**, not optional, but
its position relative to the six visits is flexible.

`InteractLogic.lua:741`, `UseHealthFountain`, records use, removes the required
object, applies fountain-related traits, heals, and checks exit readiness.
Aromatic Phial consumes its use and invokes rarity upgrading here when eligible
targets exist. Other native effects include fountain damage bonuses and spell
refresh; this investigation does not propose expanding the planner's health or
damage model. Reuse its existing modeled fountain semantics.

### Current planner gap

The Hub is a decision-owned persistent room, not an ordinary authored room
occurrence. `HubDecision.visitOrder` contains six room-slot identities only.
`CanonicalHubRoom` has no authored fountain outcome. Materialization and
`simulation/history/compose.ts`, `appendHubDecision`, already distinguish
initial Hub entry, each visit, side-room returns, Hub restores, and final
handoff. Those are the correct boundaries for an intervening Hub action.

Ordinary fountain support already exists:

- Required `useFountain` room actions and `fountainUsed` lifecycle events.
- `ReplaceFountainRarityTarget` and exact acquisition-time target candidates.
- `simulation/rewards/biome/lifecycle-transitions/fountain-used.ts`, which
  consumes Phial, settles rarity changes, and invalidates affected offers.

However, its command/address and outcome lookup currently require an authored
room occurrence. Merely marking the Hub declaration as having a fountain does
not supply a semantic owner, chronology, editable outcome, or finding location.
Extend that existing authority to the Hub action; do not duplicate Phial rules.

### Recommended ownership and presentation

Represent one required fountain interaction ordered among six room visits.
It is a seventh **action**, not a seventh visit: room visit ordinals and the
six-pylon contract remain unchanged. Initial use precedes the first visit;
intermediate use follows a complete visit and Hub return; final use precedes
the outgoing handoff and next-room entry.

The proposed next-room timeline prefix is a reasonable presentation, but the
action must remain Hub-owned. Its effects must be available before that next
room's generation and entry context. In particular, final use cannot be
simulated after Preboss shop generation. It must not replay Hub board generation
or advance an encounter/room counter of its own.

Before planning, choose defaults and specify how visit removal, reordering,
and Reset Visits affect the retained fountain position and target. These are
semantic edits, not React-only ordering. Findings need a stable Hub action
address even when rendered beside the next room. Save compatibility and any
migration require a separate explicit decision; this investigation authorizes
neither a schema bump nor a guessed historical fountain position.

### Executor gap

`execution-plan/assembly/hub.ts` exports the Hub board through the source
occurrence's `overview.hub`, rather than a standalone Hub occurrence timeline.
`navigation/ephyra.lua` and route session handling recognize Hub returns.
The current fountain adapter, however, resolves a transaction from the active
room session; `keepsakes/aromatic_phial.lua` binds its rarity interception to
that fountain scope.

Publishing the action only as the next room's transaction would miss the real
interaction: the player is still in the Hub and that next room is not active.
The bridge needs an explicit Hub-bound fountain contact and appropriate scope
lifetime. Reuse the Phial installer after that binding, and preserve native
fountain use. Guidance and subsequent conformance must consume the same ordering.

## Suggested next decisions

1. Cocoons: approve count-only customization or defer it if count alone adds
   little practical value. The proposed break-count reward control is not native.
2. Anomaly: approve a distinct infinite-roster feature, then finish the B-pool
   and adapter audit before a plan. There is no need for a bounded wave prefix.
3. Hub: settle fountain positioning/default/edit behavior, then write a
   cross-lane lifecycle plan. This is the largest correctness gap of the three,
   especially for Aromatic Phial, rather than merely encounter customization.

Verification here is static source and producer/consumer inspection. No
production edits, runtime probes, or test execution were performed for this
investigation. Native placement extremes, anomaly roster installation, and Hub
fountain guidance/Phial timing remain in-game acceptance work after implementation.
