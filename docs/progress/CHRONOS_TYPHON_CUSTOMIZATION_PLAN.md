# Chronos and Typhon Summon Customization

## Status and objective

Locked following user approval. Gate A is next; implementation has not started.

- Planner base: `68f763ca71b0b637cb50447131773fc646e51191`.
- Game-module base: `a37e389e18c933155718ceb64c626b44f1ad1dbc`.
- Commit the approved plan before implementation.

Extend the existing Timeline **Customize encounter** dialog with optional native
summon choices for Chronos and Typhon. Untouched plans remain complete and native.
Select existing summon patterns; do not author quantities or simulate combat.

## Authorities

- `docs/design/AUTHORED_PROJECT_MODEL.md`, Encounter customization.
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`, Encounter phase products.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`, encounter customization publication.
- `docs/audits/game-execution-contacts/NPCS_ENCOUNTERS_AND_AUTOMATICS.md`, Boss decisions.
- Before engine changes, read `docs/design/SIMULATION_AND_VALIDATION.md` in full.

Native evidence below is relative to the local source root
`/home/ayyatma/wsl-projects/modding/1GameData/`. It establishes the new domains;
promote the accepted evidence into the existing Boss decisions audit at closure.

## Source-backed scope

| Concrete encounter | Decision              | Native choices                                                                                                                                                                                                                     |
| ------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BossChronos01`    | First-bar late summon | `ChronosEliteSpawn1`, `ChronosEliteSpawn2`, `ChronosEliteSpawn3`: pairs of elite Satyr Lancers, Gold Elementals, or Satyr Rat Catchers                                                                                             |
| `BossChronos02`    | First-bar late summon | `ChronosSuperEliteSpawn1.SpawnerOptions`: `Screamer2_SuperElite`, `Treant2_SuperElite`, `Octofish_SuperElite`, `Vampire_SuperElite`, `Lamia_SuperElite`, `ClockworkHeavyMelee_SuperElite`, `SatyrRatCatcher_SuperElite`; one enemy |
| `BossTyphonHead01` | First egg wave        | `TyphonHeadCastSummon01` (5 `Simple2` eggs) or `TyphonHeadCastSummon03` (3 `Mudman2` eggs)                                                                                                                                         |
| `BossTyphonHead01` | Second egg wave       | `TyphonHeadCastSummon02` (2 `Brute2` eggs) or `TyphonHeadCastSummon05` (4 `FishmanMelee2` eggs)                                                                                                                                    |
| `BossTyphonHead02` | Second egg wave       | `TyphonHeadCastSummonBoar` or `TyphonHeadCastSummonDragon`; 2 corresponding super-elite eggs                                                                                                                                       |

Chronos's late summon occurs at **25% remaining health in the first health bar**,
not 33%. His 75% summon is fixed Cultists. Typhon's Rival first egg wave is fixed
at two Captain eggs and receives no editable decision. Counts above describe
configured native patterns, not guaranteed surviving enemies or spawn locations.

Evidence:

- `Scripts/EnemyData_Chronos.lua`, first-bar `AIStages`: `ChronosDefense3` and
  its Rival replacement `ChronosDefense3_SuperElite`.
- `Scripts/WeaponData_Chronos.lua:80–105,204–304`: normal random summon weapons,
  pair counts, and the seven-member Rival spawner pool.
- `Scripts/EnemyData_TyphonHead.lua:333–440`: stage 2/4 `FireRandomWeapon` pools
  and `EMStageDataOverrides`; `:1923–2210`: complete summon attack patterns.
- `Game/Projectiles/Enemy_BiomeQ_Projectiles.sjson:2553–2635`: projectile-to-egg
  mapping; `Scripts/EnemyData_TyphonHead.lua:1360–1555`: egg hatch identities.
- `Scripts/EncounterLogic.lua:2056`: native stage attack selection.
- `Scripts/EnemyAILogic.lua:2267,4843`: random preattack weapon and spawner choice.

Prometheus is excluded: both variants use the same active phase-2 Sapper and
phase-3 Lancer selectors, each spawning three. Other declared summon attacks are
not active choices (`Scripts/WeaponData_Prometheus.lua:1919–2075`). Do not expose
commented-out alternatives. Typhon tail/eye encounters and all other boss moves
are also excluded.

## Chosen contract and ownership

1. Add only existing `single` decisions to the concrete encounter declarations
   in `packages/hades2-catalog/src/declarations/encounters/{i,q}.ts`. Reuse friendly
   enemy terminology; Typhon labels identify the complete pattern, including
   count. Keep native IDs in operands, not user-facing copy.
2. Chronos uses one stable late-summon decision key across variants, with
   variant-specific domains. Typhon uses separate first/second egg-wave keys.
   Existing retained-choice assessment handles upstream Rivals changes; do not
   silently translate, clear, or invent a valid replacement for an old choice.
3. Omission means Default independently for each decision. Default never requires
   opening the dialog. Existing immediate edits, Undo, reset, exact-phase
   findings, and launcher highlighting remain unchanged.
4. Reuse sparse `customizationByPhase`, existing assessment, and single-choice
   publication under the matching `overview.encounterPhases`. No room feature,
   timeline action, new simulation state, or application-side boss switch.
5. No authored schema or wire-shape bump is expected: these are declarations in
   an existing optional family. Verify catalog compatibility and consumer
   admission, including any closed supported-ID validation. Do not add migration
   or protocol churn merely because new declaration values exist; amend this
   plan if actual inspection reveals a necessary incompatible format change.
6. Game adapters belong in separate `chronos.lua` and `typhon.lua` beside the
   existing boss adapters under `src/mods/room/timeline/encounters/`. Bind through
   the current native encounter's existing exact-phase product. Do not infer
   Rivals again from room names, inspect future rooms, or modify shared data.
7. Failed optional enforcement is diagnostic-only. No transactions, completion
   checks, room conformance facts, or desynchronization for these settings.
   Unreached moves create no obligation. Required native-function faults retain
   existing infrastructure behavior; do not swallow arbitrary exceptions.

### Narrow native application

- Chronos normal: narrow the resolved `ChronosDefense3` weapon's
  `PreAttackRandomDumbFireWeapon` to the authored native summon weapon.
- Chronos Rival: narrow the resolved `ChronosSuperEliteSpawn1` weapon's
  `SpawnerOptions` to the authored enemy. Preserve the surrounding defense move.
- Typhon: narrow the reached egg stage's `FireRandomWeapon` before native
  `BossStageTransition` chooses it, using private inputs. Prove how Rival stage
  overrides are already applied at that contact; if the existing enemy-local
  stage-copy pattern is needed, update the correct normal/Rival source without
  adding another stage-selection policy.

Native code retains thresholds, attack presentation, timing, counts, locations,
egg health/hatching, and all subsequent enemy behavior. No global RNG wrapper,
thread-spanning override, manual spawn, or copied boss AI is needed.

## Delivery gates

### A — Catalog through publication

Add the five decision domains above and exercise the existing path through
authoring, UI, retained invalid states, and execution publication. Production
engine/application edits need a demonstrated missing generic contract, not
special cases to accompany every new declaration.

Primary catalog tests own the exact choice matrix. Engine tests retain focused
normal/Rival resolution, Default omission, and retained-choice repair witnesses.
One representative application/product witness proves select, reset, Undo and
publication through the existing dialog. Cover all four concrete encounters in
publication without duplicating the complete catalog matrix in every layer.

Acceptance: old untouched plans remain valid; Rival changes expose the correct
domains; incompatible retained choices are repairable; fixed Rival Captain eggs
and all P encounters gain no unnecessary editor. Commit after independent review.

### B — Game adapters

Wire the two boss-specific adapters into existing hook composition and extend
consumer admission only if required. Primary Lua tests cover each actual native
choice boundary, exact encounter scoping, Default passthrough, private-copy
isolation, variant isolation, and diagnostic-only rejection of unavailable
operands. Native-source probes verify the active pools and override ordering.

Retain one representative planner-generated execution fixture for cross-repository
contact if existing fixtures do not cover these decisions. Generate with the
owning builder, format with repository Prettier, mirror byte-for-byte, and avoid
unrelated fixture refreshes. Commit after independent review.

### C — Closure and live verification

Run one complete planner gate and the game module's established test/lint gate
after focused tests and review fixes stabilize. Check generated fixture parity.
Review the full feature for unnecessary abstractions, shared mutations, variant
leaks, new mismatch paths, and accidental changes to native counts or timing.

Live acceptance, performed by the user:

- Chronos normal: authored elite pair at the late first-bar transition.
- Chronos Rival: authored super-elite from its separate pool.
- Typhon normal: independently selected first and second egg patterns.
- Typhon Rival: fixed Captain wave preserved, selected Boar/Dragon second wave.
- Default remains native; restarting/changing variants does not retain runtime
  overrides from the previous fight. Never infer a live pass from unit tests.

Promote source facts and supported hook mappings into their existing owning
audit and game hook map. These extend the existing contract, so do not append
feature-history paragraphs throughout design documents. Delete this temporary
plan at completed closure; retain it only while concrete live acceptance remains.
This delivery neither depends on nor closes other plans' pending live checks.

## Scope guardrails

This is a declaration-and-adapter extension, not a boss customization redesign.
Use the existing generic dialog without layout changes. Keep exact matrices with
their primary test owner. Do not add a boss registry, dynamic script parser,
spawn ledger, generic selector framework, combat simulator, or percentage/count
authoring. Main-session oversight owns commits and final closure; focused
executors and fresh independent reviewers follow the repository gate routine.
