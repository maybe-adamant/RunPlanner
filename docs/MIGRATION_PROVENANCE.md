# Migration Provenance

## Purpose

This ledger tracks which legacy findings are accepted as migration evidence,
which decisions were replaced by the standalone app model, and which facts
still require direct game-data verification during implementation.

It is an evidence and migration-status document, not production catalog data.
No `unsupported`, `legacyStatus`, or provenance fields should be added to
runtime declarations merely to mirror this ledger.

## Status Vocabulary

`ready`
: The rule has coherent evidence and an app-native design authority. It still
requires implementation and focused tests.

`verify-on-port`
: The family is understood, but exact values or requirement trees must be
checked against the current game extraction while authoring declarations.

`deferred`
: The rule belongs to a later biome or integration slice.

`rejected`
: The old behavior was an implementation accommodation and must not be ported.

`ported`
: TypeScript authority and focused parity fixtures exist. Nothing is marked
ported during Phase 0.

## Evidence Roots

Primary game evidence:

```text
../../1GameData/Scripts/
../../1GameData/Maps/bin/
```

Interpreted legacy evidence:

```text
../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/docs/revamp/
../run-director-modpack/Submodules/adamantRunDirector-Run_Planner/src/mods/
```

Game scripts outrank legacy declarations when they disagree. A targeted
in-game probe outranks both when engine behavior is not fully expressed by the
scripts.

## Cross-Cutting Decisions

| Rule family                                | Status   | New authority                                       | Evidence and action                                                            |
| ------------------------------------------ | -------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Route order F/G/H/I and N/O/P/Q            | ported   | `CATALOG_MODEL.md`                                  | Explicit route declarations and normalized lookup now exist.                   |
| Unique Room Declarations by `gameName`     | ported   | `CATALOG_MODEL.md`                                  | Catalog construction rejects duplicate concrete room game names.               |
| Repeatable Room Occurrences                | ported   | `AUTHORED_PROJECT_MODEL.md`                         | Persisted occurrence IDs support repeated game names with round-trip fixtures. |
| Injective combat canonicalization          | rejected | `F_G_GAME_RULES.md`                                 | Do not substitute unused compatible combat names.                              |
| Static combat capacity proof               | rejected | `F_G_GAME_RULES.md`                                 | Its purpose was supporting injectivity; retain ordinary topology bounds only.  |
| Creation versus appearance caps            | ready    | `F_G_GAME_RULES.md`, `SIMULATION_AND_VALIDATION.md` | Verify every concrete cap while porting F/G rooms.                             |
| Offer versus acquisition history           | ready    | `REWARD_MODEL.md`, `SIMULATION_AND_VALIDATION.md`   | Add picked/unpicked peer bag fixtures.                                         |
| Counter-axis separation                    | ready    | `SIMULATION_AND_VALIDATION.md`                      | Preserve exact event phases and pre/post views.                                |
| Current-run requirement evaluators         | ported   | `CATALOG_MODEL.md`, `SIMULATION_AND_VALIDATION.md`  | Total pure registry covers every normalized F/G requirement kind.              |
| External save/profile requirements         | ready    | `CATALOG_MODEL.md`                                  | Omit from production declarations; do not create zombie audit predicates.      |
| Lib controls, codecs, and commit lifecycle | rejected | `ARCHITECTURE.md`                                   | Do not port.                                                                   |

## Reward Migration

| Family                                   | Status         | Primary evidence                                                | Port action                                                                                        |
| ---------------------------------------- | -------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| RunProgress and MetaProgress primitives  | ported         | `LootData.lua`, `RewardData.lua`, legacy primitive declarations | Required counted-bag primitives, labels, and acquisition aliases normalize.                        |
| F/G required primitives                  | ported         | game reward data and legacy primitive declarations              | All primitives consumed by the current F/G declarations normalize.                                 |
| `BoonSource` and `DevotionPair` payloads | ported         | game source names and legacy payload declarations               | Membership, distinctness, and recursive defaults pass catalog tests.                               |
| RunProgress counted bag                  | ported         | `LootData.lua`, `RequirementsData.lua`                          | Game order and multiplicity are preserved; current-run predicates remain.                          |
| MetaProgress counted bag                 | ported         | `LootData.lua`, `RequirementsData.lua`, legacy `bags.lua`       | Current game order and multiplicity are preserved; run predicates remain.                          |
| Producer positive/negative filters       | ported         | `REWARD_MODEL.md`, legacy consumer audit                        | Concrete F/G producers embed normalized positive and negative filters.                             |
| Generated-door store resolution          | verify-on-port | `RoomLogic.lua`, `RewardLogic.lua`, legacy consumer audit       | Add physical-order fixture before F simulation.                                                    |
| World Shop profile                       | ported         | game shop data, legacy `shops.lua`                              | Option sets, stable slots, labels, recursive defaults, and semantic offer/purchase commands exist. |
| H/I/N/O/P/Q reward structures            | deferred       | legacy reward hierarchy and consumer audit                      | Translate with each biome slice.                                                                   |

The RunProgress port follows `LootData.lua` entry order rather than the
legacy declaration's reordered table. Mixed game requirements retain their
current-run predicates while external unlock and prior-save predicates are
omitted under the catalog scope policy. The resulting declaration is an
explicit progressed-save planning baseline, not a transcription of external
`GameState` paths.

The MetaProgress port follows the current 19-entry `LootData.lua` bag rather
than the legacy prototype's older 13-entry shape. `GiftDrop` is unconditional
inside the progressed-save planning baseline. Bones and Ashes retain their
`EnteredBiomes` split; lifetime-resource gates and the `GiftDrop` unlock
requirement remain outside the modeled input surface.

## F Migration

| Family                                   | Status | Primary evidence                                        | Port action                                                                                                                 |
| ---------------------------------------- | ------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| F layout and terminal depth              | ported | `RoomDataF.lua`, legacy F biome rules                   | `LinearBiome`, all three opening alternatives, authored bounds, and the depth-10 terminal normalize.                        |
| F opening production baseline            | ported | `RoomDataF.lua`, `EncounterData.lua`                    | Opening01..03 use counting `OpeningGeneratedF`; progression variants are omitted.                                           |
| F physical exits                         | ported | `RoomDataF.lua`, extracted map topology                 | Every supported F declaration has exact ordered physical exits in parity fixtures.                                          |
| F combat declarations                    | ported | `RoomSets.lua`, `RoomDataF.lua`, legacy exit audit      | All 22 are explicit and covered by one complete parity matrix.                                                              |
| F miniboss, story, fountain, and midshop | ported | `RoomDataF.lua`, legacy F declarations                  | Exact requirements, caps, labels, encounters, bindings, and force windows normalize.                                        |
| F forked preboss declaration             | ported | `RoomLogic.lua`, `RewardLogic.lua`, `F_G_GAME_RULES.md` | WorldShop-first and one-free-reward policy normalize; physical occurrences and acquisition fixtures belong to later phases. |

## G Migration

| Family                           | Status | Primary evidence                                        | Port action                                                                                                                           |
| -------------------------------- | ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| G layout and terminal depth      | ported | `RoomDataG.lua`, legacy G biome rules                   | Fixed intro, authored bounds, ordinary continuation, and the depth-8 terminal normalize.                                              |
| G intro                          | ported | `RoomDataG.lua`, encounter declarations                 | Reward-free `FixedIntro`, its 0-1 force window, and empty encounter profile normalize; the legacy exact-depth predicate was rejected. |
| G physical exits                 | ported | `RoomDataG.lua`, extracted map topology                 | Every G room has exact ordered `OceanusExitDoor` fixtures, including all two/three-exit exceptions.                                   |
| G combat declarations            | ported | `RoomSets.lua`, `RoomDataG.lua`, legacy `g_oceanus.lua` | All 20 rooms, exact counter ranges, and the four Devotion exclusions are covered by one parity matrix.                                |
| `G_MiniBoss03`                   | ported | `RoomSets.lua`, `RoomDataG.lua`                         | Production Hellifish resolves to counting `MiniBossJellyfish`; it is not treated as debug-only.                                       |
| G miniboss group requirements    | ported | `RoomDataG.lua`, run requirements                       | Entered-room mutual exclusion, force window, caps, concrete encounters, and Crawler's non-counting timing normalize.                  |
| `G_Shop01` force and eligibility | ported | `RoomDataG.lua`                                         | Eligibility ends at depth 5 while force deadline remains 6; minimum two-exit context is explicit.                                     |
| G forked preboss declaration     | ported | `RoomLogic.lua`, `RewardLogic.lua`, `F_G_GAME_RULES.md` | WorldShop-first and two-free-reward capacity normalize; physical occurrences and acquisition fixtures belong to later phases.         |

The G port follows the same progressed-save scope as F. `G_MiniBoss02`'s
lifetime encounter-completion gates, Narcissus progression/bounty gates, and
the Fountain world-upgrade gate remain omitted. Their current-run room,
counter, cap, force, and reward rules remain explicit.

## Deferred Biome Evidence

The following old material remains useful but is not yet an app authority:

- H Fields cage batches, bridge rules, and encounter-depth behavior;
- I Clockwork Goal acquisition, Goal/NonGoal rewards, repeated preboss offers,
  and companions;
- N hub topology, pylon order, side rooms, and returns;
- O multi-encounter preparation and phase-owned reward wheels;
- P typed physical exits and internal encounter rules;
- Q deterministic forced miniboss pairs and Summit shop rules;
- persistent NPC assignment and baseline encounter replacement.

Each moves to a focused app-native document or an existing authority only when
its implementation slice begins. In particular, the old I singleton-preboss
workaround is evidence about game behavior, not a representation to port.

## Port Checklist

For each declaration family:

1. identify the current game source and legacy evidence;
2. resolve contradictions before coding;
3. author direct readable TypeScript declarations;
4. normalize them through strict catalog construction;
5. add focused success and contract-failure tests;
6. add a game-story fixture when lifecycle behavior is involved;
7. update this ledger from `ready` or `verify-on-port` to `ported` only after
   the TypeScript authority and tests exist;
8. stop treating the legacy Lua implementation as authority for that family.

## Reverification Triggers

Revisit affected rows when:

- the extracted game version changes;
- room sets, room data, reward data, or physical maps change;
- supported biome scope expands;
- occurrence or terminal representation changes;
- reward producer bindings or offer/acquisition timing changes;
- future runtime audits report a simulation mismatch.
