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

| Rule family                                | Status   | New authority                                       | Evidence and action                                                           |
| ------------------------------------------ | -------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Route order F/G/H/I and N/O/P/Q            | ready    | `CATALOG_MODEL.md`                                  | Recheck `RoomSets.lua` when route declarations are authored.                  |
| Unique Room Declarations by `gameName`     | ready    | `CATALOG_MODEL.md`                                  | Preserve one declaration per concrete game room.                              |
| Repeatable Room Occurrences                | ready    | `AUTHORED_PROJECT_MODEL.md`                         | Replaces legacy injective control identity; add repeated-offer fixtures.      |
| Injective combat canonicalization          | rejected | `F_G_GAME_RULES.md`                                 | Do not substitute unused compatible combat names.                             |
| Static combat capacity proof               | rejected | `F_G_GAME_RULES.md`                                 | Its purpose was supporting injectivity; retain ordinary topology bounds only. |
| Creation versus appearance caps            | ready    | `F_G_GAME_RULES.md`, `SIMULATION_AND_VALIDATION.md` | Verify every concrete cap while porting F/G rooms.                            |
| Offer versus acquisition history           | ready    | `REWARD_MODEL.md`, `SIMULATION_AND_VALIDATION.md`   | Add picked/unpicked peer bag fixtures.                                        |
| Counter-axis separation                    | ready    | `SIMULATION_AND_VALIDATION.md`                      | Preserve exact event phases and pre/post views.                               |
| External save/profile requirements         | ready    | `CATALOG_MODEL.md`                                  | Omit from production declarations; do not create zombie audit predicates.     |
| Lib controls, codecs, and commit lifecycle | rejected | `ARCHITECTURE.md`                                   | Do not port.                                                                  |

## Reward Migration

| Family                                                      | Status         | Primary evidence                                                               | Port action                                                                |
| ----------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Primitive identities, labels, and acquisition normalization | verify-on-port | `LootData.lua`, `RewardData.lua`, legacy `rewards/declarations/primitives.lua` | Author explicit TypeScript primitives and payload defaults.                |
| `BoonSource` and `DevotionPair` payloads                    | ready          | legacy reward hierarchy and declarations                                       | Recheck supported source membership; add local payload tests.              |
| RunProgress and MetaProgress counted bags                   | verify-on-port | `RewardData.lua`, `RewardLogic.lua`, legacy `bags.lua`                         | Preserve order, multiplicity, requirements, refill, and explicit defaults. |
| Producer positive/negative filters                          | ready          | `REWARD_MODEL.md`, legacy consumer audit                                       | Embed on concrete producers; reject named filtered surfaces.               |
| Generated-door store resolution                             | verify-on-port | `RoomLogic.lua`, `RewardLogic.lua`, legacy consumer audit                      | Add physical-order fixture before F simulation.                            |
| World Shop profile                                          | verify-on-port | game shop data, legacy `shops.lua`                                             | Port option sets, stable slots, defaults, labels, and purchase state.      |
| H/I/N/O/P/Q reward structures                               | deferred       | legacy reward hierarchy and consumer audit                                     | Translate with each biome slice.                                           |

## F Migration

| Family                                   | Status         | Primary evidence                                        | Port action                                                                               |
| ---------------------------------------- | -------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| F layout and terminal depth              | ready          | `RoomDataF.lua`, legacy F biome rules                   | Declare `LinearBiome`, opening alternatives, and depth-10 terminal.                       |
| F opening production baseline            | ready          | `RoomDataF.lua`, encounter declarations                 | Use `OpeningGeneratedF`; omit `OpeningEmpty` and tutorial variants.                       |
| F physical exits                         | verify-on-port | `RoomDataF.lua`, extracted map topology                 | Port every concrete exit count and fixture the one-exit exceptions.                       |
| F combat declarations                    | verify-on-port | `RoomSets.lua`, `RoomDataF.lua`, legacy `f_erebus.lua`  | Port all 22 explicitly; do not infer reward binding from kind.                            |
| F miniboss, story, fountain, and midshop | verify-on-port | `RoomDataF.lua`, legacy F declarations                  | Port exact requirements, caps, labels, encounters, and bindings.                          |
| F forked preboss offers                  | ready          | `RoomLogic.lua`, `RewardLogic.lua`, `F_G_GAME_RULES.md` | Represent one occurrence per physical terminal offer; add shop/free acquisition fixtures. |

## G Migration

| Family                           | Status         | Primary evidence                                        | Port action                                                                           |
| -------------------------------- | -------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| G layout and terminal depth      | ready          | `RoomDataG.lua`, legacy G biome rules                   | Declare fixed intro and depth-8 terminal.                                             |
| G intro                          | ready          | `RoomDataG.lua`, encounter declarations                 | Port as fixed reward-free intro.                                                      |
| G physical exits                 | verify-on-port | `RoomDataG.lua`, extracted map topology                 | Preserve concrete two/three-exit order and miniboss exceptions.                       |
| G combat declarations            | verify-on-port | `RoomSets.lua`, `RoomDataG.lua`, legacy `g_oceanus.lua` | Port all 20 and the four Devotion exclusions explicitly.                              |
| `G_MiniBoss03`                   | ready          | `RoomSets.lua`, `RoomDataG.lua`                         | Include as a normal production Jellyfish miniboss room.                               |
| G miniboss group requirements    | verify-on-port | `RoomDataG.lua`, run requirements                       | Preserve force window and entered-room mutual exclusion as origin-based requirements. |
| `G_Shop01` force and eligibility | verify-on-port | `RoomDataG.lua`                                         | Preserve force window, independent upper bound, and minimum-exit requirement.         |
| G forked preboss offers          | ready          | `RoomLogic.lua`, `RewardLogic.lua`, `F_G_GAME_RULES.md` | Support shop plus up to two free occurrences from predecessor exits.                  |

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
