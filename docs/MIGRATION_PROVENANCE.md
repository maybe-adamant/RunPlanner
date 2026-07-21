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

## Feature Coverage Vocabulary

Concrete biome feature maps use a separate implementation vocabulary:

`documented`
: Verified game behavior and the intended planner projection are recorded.

`declared`
: Normalized catalog declarations and focused parity fixtures exist.

`authored`
: Persisted project state and semantic commands can represent the projection.

`simulated`
: Canonical history and validation consume the projection.

`presented`
: The editor exposes the authored projection through semantic commands and,
when simulation exists, semantic findings.

Migration status answers whether evidence has been ported. Feature coverage
answers what the app can currently do. Neither belongs in production catalog
records.

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

| Rule family                                | Status   | New authority                                              | Evidence and action                                                                                                                                 |
| ------------------------------------------ | -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global biome identity and route order      | ported   | `CATALOG_MODEL.md`                                         | Global `F/G/H/I/N/O/P/Q` declarations own identity and labels; routes own ordered references and layout completion no longer owns route transition. |
| Unique Room Declarations by `gameName`     | ported   | `CATALOG_MODEL.md`                                         | Catalog construction rejects duplicate concrete room game names.                                                                                    |
| Repeatable Room Occurrences                | ported   | `AUTHORED_PROJECT_MODEL.md`                                | Persisted occurrence IDs support repeated game names with round-trip fixtures.                                                                      |
| Injective combat canonicalization          | rejected | `GAME_GENERATION_RULES.md`                                 | Do not substitute unused compatible combat names.                                                                                                   |
| Static combat capacity proof               | rejected | `GAME_GENERATION_RULES.md`                                 | Its purpose was supporting injectivity; retain ordinary topology bounds only.                                                                       |
| Creation versus appearance caps            | ported   | `GAME_GENERATION_RULES.md`, `SIMULATION_AND_VALIDATION.md` | F validates creation and appearance from separate pre-target ledgers; extend the same contact contract biome by biome.                              |
| Offer versus acquisition history           | ready    | `REWARD_MODEL.md`, `SIMULATION_AND_VALIDATION.md`          | Add picked/unpicked peer bag fixtures.                                                                                                              |
| Possibility rather than probability        | ported   | `ARCHITECTURE.md`, `SIMULATION_AND_VALIDATION.md`          | F validates authored room outcomes by exact support membership and records no likelihood; reuse this rule for later biomes and rewards.             |
| Counter-axis separation                    | ported   | `SIMULATION_AND_VALIDATION.md`                             | F lifecycle history folds encounter-start and commit-time axes into exact preparation, outgoing, post-commit, and transition views.                 |
| Single-room lifecycle composition          | ported   | `ROOM_LIFECYCLE_MODEL.md`                                  | The picked F spine composes deterministic fragments while unpicked peers contribute creation only at their source checkpoint.                       |
| Layout-derived completion sequences        | ported   | `GAME_GENERATION_RULES.md`, concrete biome rule documents  | F history walks layout-owned Boss/PostBoss declarations and explicit biome-local resets without authored occurrences or room-name dispatch.         |
| Policy-selected batch-global state         | ready    | `AUTHORED_PROJECT_MODEL.md`, `biomes/H_GAME_RULES.md`      | Add typed layout-selected batch codecs and semantic commands; never use a generic extension property bag.                                           |
| Route-structural detour suppression        | ready    | `GAME_GENERATION_RULES.md`, `GAME_INTEGRATION_BOUNDARY.md` | Suppress natural Chaos and Anomaly replacement until layouts can represent detour entry and return.                                                 |
| Current-run requirement evaluators         | ported   | `CATALOG_MODEL.md`, `SIMULATION_AND_VALIDATION.md`         | Total pure registry covers every normalized F/G requirement kind.                                                                                   |
| External save/profile requirements         | ready    | `CATALOG_MODEL.md`                                         | Omit from production declarations; do not create zombie audit predicates.                                                                           |
| Lib controls, codecs, and commit lifecycle | rejected | `ARCHITECTURE.md`                                          | Do not port.                                                                                                                                        |

## Reward Migration

| Family                                    | Status | Primary evidence                                                                 | Port action                                                                                                                                                                   |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RunProgress and MetaProgress primitives   | ported | `LootData.lua`, `RewardData.lua`, legacy primitive declarations                  | Required counted-bag primitive identities, labels, and payload defaults normalize.                                                                                            |
| F/G required primitives                   | ported | game reward data and legacy primitive declarations                               | All primitives consumed by the current F/G declarations normalize.                                                                                                            |
| `BoonSource` and `DevotionPair` payloads  | ready  | `RewardLogic.lua`, `EncounterLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`             | Retain source membership/defaults and replace the generic pair with explicit chosen/spurned roles.                                                                            |
| RunProgress counted bag                   | ported | `LootData.lua`, `RequirementsData.lua`                                           | Game order and multiplicity are preserved; current-run predicates remain.                                                                                                     |
| MetaProgress counted bag                  | ready  | `LootData.lua`, `RequirementsData.lua`, `REWARD_GAME_DATA_AUDIT.md`              | Replace the Phase 1 raw 19-entry union with the exact 13-entry fully progressed projection.                                                                                   |
| Producer positive/negative filters        | ported | `REWARD_MODEL.md`, legacy consumer audit                                         | Concrete F/G producers embed normalized positive and negative filters.                                                                                                        |
| Generated-door store resolution           | ready  | `RoomLogic.lua`, `RewardLogic.lua`, 2026-07-18 game-data audit                   | Resolve authored, source-offer-derived, and absent base stores at batches; keep room overrides and add physical-order fixtures.                                               |
| F/G reward-store ratio support            | ready  | `RewardLogic.lua`, `RunLogic.lua`, 2026-07-18 game-data audit                    | Derive possible base stores from exact history; do not model relative likelihood.                                                                                             |
| Counted-entry duplicate and refill policy | ready  | `LootData.lua`, `RewardLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`                   | Add entry-owned duplicate flags, one complete refill with retained leftovers, latent bag branching, peer-depletion fixtures, and a still-empty invariant failure.             |
| Reward source-support policy registry     | ready  | `RewardLogic.lua`, `RunLogic.lua`, `StoreLogic.lua`, `REWARD_GAME_DATA_AUDIT.md` | Add `ordinaryBoonPeer`, `ordinaryNoPeer`, and `devotionAcquiredPair` with explicit offer- or acquisition-time resolution; keep dispatch independent of reward names.          |
| Offer and acquisition identity split      | ready  | reward/use history writes, `REWARD_GAME_DATA_AUDIT.md`                           | Replace `RewardPrimitive.acquiredAs` with resolved offers, reward-type acquisition roles, producer-timed concrete acquisitions, and concrete history projections.             |
| Reward offer projections                  | ready  | `RewardLogic.lua`, `RequirementsLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`          | Add the closed Devotion offer-time spacing projection; apply it to unpicked offers and never reconstruct it from source acquisition.                                          |
| Concrete acquisition registry             | ready  | `InteractLogic.lua`, loot/consumable declarations, `REWARD_GAME_DATA_AUDIT.md`   | Separate acquisition kind from the exact `lootAndUse` or `consumableAndUse` history projection selected by each supported identity.                                           |
| Blind Box authored result                 | ready  | `ConsumableData.lua`, `StoreLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`              | Persist the intended source, keep it dormant while unpurchased, and validate/emit it only in a supported purchase-order branch.                                               |
| World Shop profile                        | ready  | `StoreData.lua`, `StoreLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`                   | Replace the flat three-union prototype with ordered groups, offer counts, per-option requirements, and without-replacement rules.                                             |
| Shop entry lifecycle                      | ready  | `ROOM_LIFECYCLE_MODEL.md`, `REWARD_MODEL.md`, room-entry generation behavior     | Require typed state only on picked occurrences; generate outgoing doors from pre-purchase history, then apply purchases to the exit history.                                  |
| H reward structures                       | ported | `RoomDataH.lua`, `RoomLogic.lua`, `biomes/H_GAME_RULES.md`                       | Three complete room-owned cage values, declaration-owned RunProgress bindings, raw/effective capacities, and deferred optional Fields rewards normalize with parity fixtures. |
| I reward structures                       | ported | I game data, `biomes/I_GAME_RULES.md`                                            | `TartarusRewards`, derived Goal/NonGoal producers, folded counters, and `I_WorldShop` normalize with parity fixtures.                                                         |
| N reward structures                       | ported | N game data, `biomes/N_GAME_RULES.md`                                            | Persistent HubRewards offers, local ordinary/hard side-room bags, and the named hub-wide preboss shop lookup now normalize with parity fixtures.                              |
| O reward structures                       | ported | `RoomDataO.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md`    | Phase-owned wheels, ordered offers/acquisitions, and source-derived outgoing stores normalize without duplicating authority.                                                  |
| P reward structures                       | ported | `RoomDataP.lua`, `biomes/P_GAME_RULES.md`                                        | The NPC-free reward baseline normalizes while simulation remains dormant until N/O history exists.                                                                            |
| Q reward structures                       | ported | `RoomDataQ.lua`, `LootData.lua`, `StoreData.lua`, `biomes/Q_GAME_RULES.md`       | `TyphonBossRewards`, `Q_WorldShop`, explicit no-reward producers, and the no-generated-store policy are connected to Q declarations.                                          |

The RunProgress port follows `LootData.lua` entry order rather than the
legacy declaration's reordered table. Mixed game requirements retain their
current-run predicates while external unlock and prior-save predicates are
omitted under the catalog scope policy. The resulting declaration is an
explicit progressed-save planning baseline, not a transcription of external
`GameState` paths.

Phase 1 initially ported all 19 raw `LootData.lua` entries while stripping
external gates. The reward audit rejected that union because the later ordinary
and Big resource entries describe mutually exclusive lifetime-resource tiers.
Phase 2.6 replaces it with the exact fully progressed projection: one Gift,
two early ordinary Bones, four early ordinary Ashes, two late Big Bones, and
four late Big Ashes. Only the current-run `EnteredBiomes` split remains.

The 2026-07-18 reward audit also established that fixed Story and Shop targets
receive resolved reward-store names used by future entered-room ratio
calculation. Their visible producers remain fixed/shop; store provenance is a
canonical simulation fact, not editable counted leaf state. No supported F/G
room currently requires `IndividualRewardStore`.

## F Migration

| Family                                   | Status | Primary evidence                                             | Port action                                                                                                                                     |
| ---------------------------------------- | ------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| F layout and terminal depth              | ported | `RoomDataF.lua`, legacy F biome rules                        | `LinearBiome`, all three opening alternatives, authored bounds, and the depth-10 terminal normalize.                                            |
| F opening production baseline            | ported | `RoomDataF.lua`, `EncounterData.lua`                         | Opening01..03 use counting `OpeningGeneratedF`; progression variants are omitted.                                                               |
| F physical exits                         | ported | `RoomDataF.lua`, extracted map topology                      | Every supported F declaration has exact ordered physical exits in parity fixtures.                                                              |
| F combat declarations                    | ported | `RoomSets.lua`, `RoomDataF.lua`, legacy exit audit           | All 22 are explicit and covered by one complete parity matrix.                                                                                  |
| F miniboss, story, fountain, and midshop | ported | `RoomDataF.lua`, legacy F declarations                       | Exact requirements, caps, labels, encounters, bindings, and force windows normalize.                                                            |
| F forked preboss declaration             | ported | `RoomLogic.lua`, `RewardLogic.lua`, `biomes/F_GAME_RULES.md` | WorldShop-first and one-free-reward policy normalize; physical occurrences and acquisition fixtures belong to later phases.                     |
| F fixed completion tail                  | ported | `RoomDataF.lua`, `RewardLogic.lua`, `biomes/F_GAME_RULES.md` | Neutral `F_Boss01` and `F_PostBoss01` are derived declarations ordered by the layout; the boss's ignored store-history policy remains explicit. |

## G Migration

| Family                           | Status    | Primary evidence                                                               | Port action                                                                                                                                                       |
| -------------------------------- | --------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G layout and terminal depth      | ported    | `RoomDataG.lua`, legacy G biome rules                                          | Fixed intro, authored bounds, ordinary continuation, and the depth-8 terminal normalize.                                                                          |
| G intro                          | ported    | `RoomDataG.lua`, encounter declarations                                        | Reward-free `FixedIntro`, its 0-1 force window, and empty encounter profile normalize; the legacy exact-depth predicate was rejected.                             |
| G physical exits                 | ported    | `RoomDataG.lua`, extracted map topology                                        | Every G room has exact ordered `OceanusExitDoor` fixtures, including all two/three-exit exceptions.                                                               |
| G locked-exit encounters         | deferred  | `RoomDataG.lua`, `ObstacleDataG.lua`, `RoomLogic.lua`                          | V1 conditions the canonical trace on taking an open picked exit immediately; optional per-exit unlock actions and counter effects are reserved for v2.            |
| G Anomaly replacement            | deferred  | `RoomDataG.lua`, `RunLogic.lua`                                                | Suppress the one-room detour in v1; do not reinterpret it as an ordinary G encounter or candidate.                                                                |
| G combat declarations            | ported    | `RoomSets.lua`, `RoomDataG.lua`, legacy `g_oceanus.lua`                        | All 20 rooms, exact counter ranges, and the four Devotion exclusions are covered by one parity matrix.                                                            |
| `G_MiniBoss03`                   | ported    | `RoomSets.lua`, `RoomDataG.lua`                                                | Production Hellifish resolves to counting `MiniBossJellyfish`; it is not treated as debug-only.                                                                   |
| G miniboss group requirements    | ported    | `RoomDataG.lua`, run requirements                                              | Entered-room mutual exclusion, force window, caps, concrete encounters, and Crawler's non-counting timing normalize.                                              |
| `G_Shop01` force and eligibility | ported    | `RoomDataG.lua`                                                                | Eligibility ends at depth 5 while the raw force maximum remains 6; minimum two-exit context is explicit.                                                          |
| G forked preboss declaration     | ported    | `RoomLogic.lua`, `RewardLogic.lua`, `biomes/G_GAME_RULES.md`                   | WorldShop-first and two-free-reward capacity normalize; physical occurrences and acquisition fixtures belong to later phases.                                     |
| G fixed completion tail          | ported    | `RoomDataG.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/G_GAME_RULES.md`  | Neutral `G_Boss01` and `G_PostBoss01` are derived declarations ordered by the layout; the boss retains resolved-offer store history.                              |
| G simulation and route carry     | simulated | shared linear simulator, `projectSimulation.test.ts`, `biomes/G_GAME_RULES.md` | Complete G plans consume validated F route state, apply G-local baselines and resets, and publish generation/reward findings through the common project contract. |

The G port follows the same progressed-save scope as F. `FishmanIntro`, the
early-run Eris event, `G_MiniBoss02`'s lifetime encounter-completion gates,
Narcissus prior-run force and progression/bounty gates, and the Fountain
world-upgrade gate remain omitted. Their current-run room, counter, cap,
force, and reward rules remain explicit. Narcissus's internal benefit choice
is separately deferred until concrete NPC gifts and trait state exist.

## H Migration

| Family                    | Status   | Primary evidence                                                              | Port action                                                                                                                                 |
| ------------------------- | -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| H layout and bounds       | ported   | `RoomDataH.lua`, physical maps, `biomes/H_GAME_RULES.md`                      | `LinearBiome` owns fixed intro, four ordinary batches/seven ordinary targets, a separately bounded forked terminal, and ordered completion. |
| H physical exits          | ported   | extracted map topology, `biomes/H_GAME_RULES.md`                              | One exit for intro, Combat01, Miniboss02, and preboss; two for every other supported generated H room.                                      |
| H combat declarations     | ported   | `RoomSets.lua`, `RoomDataH.lua`, `biomes/H_GAME_RULES.md`                     | All 15 concrete rooms preserve depth restrictions, raw cage capacities, no top-level reward, and three bounded local reward values.         |
| Fields cage batch state   | ported   | `RoomLogic.lua`, `EventLogic.lua`, `biomes/H_GAME_RULES.md`                   | Semantic Min/Max state, exact decoding, and the Min default exist; visible cage count and the hidden ceiling are not persisted.             |
| Fields ceiling derivation | ported   | `EventLogic.lua`, `biomes/H_GAME_RULES.md`                                    | Typed ordinary-batch events derive the Max counter, including capacity-two and no-combat outcomes.                                          |
| H encounter projection    | ported   | H generated encounters, `RoomLogic.lua`, `biomes/H_GAME_RULES.md`             | Two- and three-cage profiles declare a non-counting passive phase and one counting phase per effective cage.                                |
| H cage reward lifecycle   | ported   | `RoomLogic.lua`, `LootData.lua`, `RewardLogic.lua`, `biomes/H_GAME_RULES.md`  | Shared reward replay resolves every active picked/unpicked cage offer in physical order and acquires only the entered occurrence's cages.   |
| H generated-store policy  | ported   | `RoomDataH.lua`, `RoomLogic.lua`, `biomes/H_GAME_RULES.md`                    | `none` is normalized: supported targets are reward-free or declaration-owned RunProgress; no generic Run/Meta value is persisted.           |
| Fields optional rewards   | deferred | `RoomDataH.lua`, `RoomLogic.lua`, `LootData.lua`, `biomes/H_GAME_RULES.md`    | Canonical v1 trace acquires none; do not fold the isolated optional bag into cage slots or batch state.                                     |
| H minibosses              | ported   | `RoomDataH.lua`, miniboss encounters, `biomes/H_GAME_RULES.md`                | Exact exits, one-creation caps, entered mutual exclusion, force window, counting profiles, and forced RunProgress Boons normalize.          |
| H bridge                  | ported   | `RoomDataH.lua`, bridge encounters, `biomes/H_GAME_RULES.md`                  | Exact-two eligibility, always-forced pool membership, caps, two exits, and progressed-save Echo Story projection normalize.                 |
| H forked preboss          | ported   | `RoomDataH.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/H_GAME_RULES.md` | Shop-then-fill owns one free-reward capacity; the terminal-only unobservable cage roll has no field.                                        |
| H fixed completion tail   | ported   | `RoomDataH.lua`, `RewardLogic.lua`, `biomes/H_GAME_RULES.md`                  | Neutral `H_Boss01` and `H_PostBoss01` are ordered completion rooms with fixed RunProgress boss provenance.                                  |
| H selected validation     | ported   | `EventLogic.lua`, normalized H declarations, `biomes/H_GAME_RULES.md`         | Addressed findings cover Fields support, room legality/force pools, terminal timing, and cage reward support without editing authorship.    |
| H candidate evaluation    | ported   | selected H validation/reward authorities, `biomes/H_GAME_RULES.md`            | Rooms, Min/Max, cages, terminal rewards, shop offers, and purchases project support through the active selected-plan evaluator.             |
| H editor projection       | ported   | authored H topology, candidate authorities, `EDITOR_MODEL.md`                 | Shared linear controls project fixed-count Fields batches, bounded cage leaves, findings, and forked terminal state through H navigation.   |
| H persistent NPC variants | deferred | H encounter sets and NPC encounter data                                       | Suppress unconfigured Nemesis variants; later persistent entities compose before history.                                                   |
| H simulation activation   | ported   | `biomes/H_GAME_RULES.md`, F/G/H product-loop fixture                          | H is authorable, simulatable, editable, profile-safe, recoverable, and route-validated after a complete F/G prefix.                         |

## O Migration

| Family                       | Status   | Primary evidence                                                                  | Port action                                                                                                                        |
| ---------------------------- | -------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| O layout and bounds          | ported   | `RoomDataO.lua`, physical maps, `biomes/O_GAME_RULES.md`                          | Fixed intro, six ordinary single-target batches, separately bounded direct terminal, and boss/postboss completion normalize.       |
| O physical exits             | ported   | extracted map topology, `biomes/O_GAME_RULES.md`                                  | One `ShipsExitDoor` is declared for every supported editable room; wheel offer count never changes physical topology.              |
| O combat declarations        | ported   | `RoomSets.lua`, `RoomDataO.lua`, `RunData.lua`, `biomes/O_GAME_RULES.md`          | All 15 maps normalize in ordinary, early-only, and late-backup families after real inheritance.                                    |
| ShipCombat encounter profile | ported   | O encounter sets, `RoomLogic.lua`, `biomes/O_GAME_RULES.md`                       | Intro, mandatory Combat1, and pre-room-condition optional Combat2 own exact per-phase BED and offer-point declarations.            |
| O wheel reward lifecycle     | ported   | `RoomLogic.lua`, `EncounterSets.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md` | Two complete bounded occurrence-owned wheels retain one/two offers and exactly one active pick; Phase 3 will execute their events. |
| Source-derived batch store   | ported   | `RoomLogic.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md`                      | `sourceOfferPoint:lastActiveWheel` is normalized for ShipCombat sources without a persisted outgoing copy.                         |
| O special rooms              | ported   | `RoomDataO.lua`, unique/miniboss/devotion encounters, `biomes/O_GAME_RULES.md`    | Exact caps, current-run requirements, conditional force, producers, and Charybdis/Captain/Devotion BED effects normalize.          |
| O direct preboss             | ported   | `RoomDataO.lua`, `RoomLogic.lua`, `biomes/O_GAME_RULES.md`                        | The BDC-7 direct shop-only terminal is separate from forked shop-then-fill policy.                                                 |
| O fixed completion tail      | ported   | `RoomDataO.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md`                      | Neutral `O_Boss01` and `O_PostBoss01` are ordered before `P_Intro`, with resolved boss-offer store provenance.                     |
| O progression/NPC variants   | deferred | O encounter sets and NPC encounter data                                           | Suppress first-time, Heracles, and Icarus variants; later persistent entities replace addressed phases before history.             |
| O simulation activation      | deferred | `biomes/O_GAME_RULES.md`                                                          | Keep dormant until the reconciled vocabulary and full O product loop are implemented.                                              |

## I Migration

| Family                     | Status   | Primary evidence                                                                    | Port action                                                                                                                                           |
| -------------------------- | -------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| I layout and bounds        | ported   | `RoomDataI.lua`, physical maps, `biomes/I_GAME_RULES.md`                            | Derived fixed Intro/Story entry, twelve bounded continuations, exact 22-target bound, and conditional-terminal Clockwork batches normalize.           |
| I combat declarations      | ported   | `RoomSets.lua`, `RoomDataI.lua`, `biomes/I_GAME_RULES.md`                           | All 24 combat maps declare exact exits, one counting profile, Combat 24 BDC ceiling, and two-exit capacity requirements.                              |
| Clockwork global state     | ported   | `RewardLogic.lua`, `RoomDataI.lua`, `biomes/I_GAME_RULES.md`                        | Fixed five Goals, authored non-goal cap in `{3,4,5,6}`, and typed entered-producer requirement facts are represented for Phase 3.                     |
| I reward structures        | ported   | `LootData.lua`, `RewardData.lua`, `RewardLogic.lua`, `biomes/I_GAME_RULES.md`       | Batch-store `none` and declaration-owned `TartarusRewards` normalize; combat persists only the potential concrete NonGoal leaf.                       |
| I special rooms            | ported   | I room and encounter data, `biomes/I_GAME_RULES.md`                                 | Fixed progressed Story, Reprieve, and both supported minibosses normalize; concrete debug-only Shop and miniboss 03 remain absent.                    |
| Conditional preboss batch  | ported   | `RunLogic.lua`, `RoomLogic.lua`, `RoomDataI.lua`, `biomes/I_GAME_RULES.md`          | One generated-target policy admits terminal and ordinary peers; the picked declaration alone selects completion.                                      |
| I authored topology        | ported   | `AUTHORED_PROJECT_MODEL.md`, `biomes/I_GAME_RULES.md`                               | Schema v4 owns the bounded biome field, fixed-entry continuation, Clockwork batches, repeated preboss occurrences, and picked-only shop.              |
| I canonical/history        | ported   | `SIMULATION_AND_VALIDATION.md`, `ROOM_LIFECYCLE_MODEL.md`, `biomes/I_GAME_RULES.md` | Fixed entries, pre-generation Goal/NonGoal derivation, entered counter timing, repeated preboss offers, and the fixed completion tail materialize.    |
| I selected validation      | ported   | `SIMULATION_AND_VALIDATION.md`, normalized I declarations, `biomes/I_GAME_RULES.md` | Goal pressure, non-goal capacity, room force/caps, Tartarus offers, WorldShop, biome-field, leaf, and purchase candidates share selected authorities. |
| I preboss shop             | ported   | `RoomDataI.lua`, `StoreData.lua`, `biomes/I_GAME_RULES.md`                          | Shop-only `I_PreBoss02` materializes `I_WorldShop` only on entry; its Goal marker remains structural with no free-reward mode.                        |
| I fixed completion tail    | ported   | `RoomDataI.lua`, boss encounter data, `biomes/I_GAME_RULES.md`                      | Neutral `I_Boss01` and `I_PostBoss01` complete the route without automatic boss rewards or dead ledger state.                                         |
| I progression/NPC variants | deferred | I encounter sets and persistent requirements                                        | Suppress first-visit, dream, Nemesis, and restored-house variants under the documented progressed NPC-free baseline.                                  |
| I application activation   | ported   | `biomes/I_GAME_RULES.md`, F/G/H/I product-loop fixture                              | I is authorable, simulatable, editable, profile-safe, recoverable, and route-validated after a complete F/G/H prefix.                                 |

## N Migration

| Family                     | Status   | Primary evidence                                                                  | Port action                                                                                                                                                            |
| -------------------------- | -------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N fixed entry              | ported   | `RoomDataN.lua`, opening encounters, `biomes/N_GAME_RULES.md`                     | Fixed authored Opening and PreHub slots own separate RunProgress leaves and exact counting/non-counting encounter profiles.                                            |
| N persistent hub           | ported   | `RoomDataN.lua`, `RoomLogic.lua`, `biomes/N_GAME_RULES.md`                        | The 25 fixed physical slots, authored 9/10 open-set bounds, constraints, one persistent board, and restore identity normalize.                                         |
| N main targets and pylons  | ported   | N room/obstacle/enemy data, `biomes/N_GAME_RULES.md`                              | All 23 combats and two minibosses own required-pylon facts, exact forced stores, and six-visit layout pressure.                                                        |
| N side-room topology       | ported   | N room/obstacle logic, `biomes/N_GAME_RULES.md`, `biomes/N_SIDE_ROOM_FINDINGS.md` | Fixed bounded local slots own physical IDs, availability ranks, generated state, separate entered order, and unordered sibling semantics.                              |
| N side-room rewards        | ported   | `LootData.lua`, `RewardData.lua`, generated encounters, `biomes/N_GAME_RULES.md`  | Ordinary/hard counted bags, complete dormant leaves, and non-counting side encounter profiles normalize.                                                               |
| N hub shop lookup          | ported   | `RoomLogic.lua`, `StoreData.lua`, `biomes/N_GAME_RULES.md`                        | The initial open-board lookup has explicit producer ownership and typed WorldShop option consumers.                                                                    |
| N terminal and completion  | ported   | `RoomDataN.lua`, `ObstacleDataN.lua`, boss data, `biomes/N_GAME_RULES.md`         | The fixed authored shop-only preboss and derived neutral boss/postboss tail normalize without automatic boss drops.                                                    |
| N authored Hub plan        | ported   | `AUTHORED_PROJECT_MODEL.md`, `biomes/N_GAME_RULES.md`                             | Schema version 5 persists fixed authored leaves, an open fixed-slot set, six ordered visits, and parent-local side state behind dormant application capabilities.      |
| N canonical Hub snapshot   | ported   | `SIMULATION_AND_VALIDATION.md`, `biomes/N_GAME_RULES.md`                          | Fixed entries, one physical board, ordered visits, local slots, reference-only restores, the fixed terminal shop, and completion rooms materialize without activation. |
| N progression/NPC variants | deferred | N encounter sets, Story and persistent requirements                               | Suppress Medea, Artemis, Heracles, OpeningEmpty, and other save variants under the documented progressed NPC-free baseline.                                            |
| N optional interactions    | deferred | N room and obstacle data                                                          | Suppress Chaos detours, gathering, challenges, wells, rerolls, postboss shops, and other no-action surfaces.                                                           |
| N simulation activation    | deferred | `biomes/N_GAME_RULES.md`                                                          | Keep dormant until the reconciled vocabulary and full N product loop are implemented.                                                                                  |

Persistent NPC assignment and baseline encounter replacement remain shared
deferred composition features. The old I singleton-preboss workaround has
been replaced by the occurrence-based conditional-terminal contract in
`biomes/I_GAME_RULES.md`.

## P Migration

| Family                         | Status   | Primary evidence                                                              | Port action                                                                                                                |
| ------------------------------ | -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P layout and terminal depth    | ported   | `RoomDataP.lua`, `biomes/P_GAME_RULES.md`                                     | Fixed intro, nine-batch bound, exact-depth-9 forked terminal, and ordered completion normalize without activating P.       |
| P typed physical exits         | ported   | `ObstacleDataP.lua`, extracted map topology                                   | Source tags and source-sensitive Indoor/Outdoor target compatibility normalize without fake room-eligibility ranges.       |
| P intro baseline               | ported   | `RoomDataP.lua`, P intro encounters                                           | Optional non-counting, reward-free intro combat is projected as empty `FixedIntro`; dream-run behavior is excluded.        |
| P combat declarations          | ported   | `RoomSets.lua`, `RoomDataP.lua`                                               | All 19 rooms, exact tags/exits/real counter requirements, and one collapsed counting Olympus profile have parity fixtures. |
| P special rooms and minibosses | ported   | `RoomDataP.lua`, encounter declarations                                       | Exact caps, requirements, force windows, rewards, and Talos/Dragon encounter-depth asymmetry normalize.                    |
| P forked preboss               | ported   | `RoomDataP.lua`, `RoomLogic.lua`, `biomes/P_GAME_RULES.md`                    | Shop-then-fill normalizes with one free reward; predecessor exit count determines active terminal capacity.                |
| P fixed completion tail        | ported   | `RoomDataP.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/P_GAME_RULES.md` | `P_Boss01` and `P_PostBoss01` are ordered before Q entry and only the resolved boss-offer store ledger effect remains.     |
| P persistent NPC variants      | deferred | P encounter sets and NPC encounter data                                       | Suppress unconfigured Heracles/Athena/Icarus variants; later entities compose into the spine before history.               |
| P simulation activation        | deferred | `biomes/P_GAME_RULES.md`                                                      | Requires validated N/O Surface history for reward-store support and other carried state.                                   |

## Q Migration

| Family                          | Status   | Primary evidence                                                           | Port action                                                                                                                        |
| ------------------------------- | -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Q layout and staged pools       | ported   | `RoomDataQ.lua`, physical maps, `biomes/Q_GAME_RULES.md`                   | `LinearBiome` now declares foyer, forced fork, miniboss, ordinary, second fork, and direct-terminal stages.                        |
| Q intro and foyer baseline      | ported   | `RoomDataQ.lua`, Q intro encounters, `biomes/Q_GAME_RULES.md`              | Reward-free `Q_Intro` and both real foyer maps normalize while first-time and lifetime progression gates remain omitted.           |
| Q combat declarations           | ported   | `RoomSets.lua`, `RoomDataQ.lua`, extracted map topology                    | All supported combat maps retain exact one/two-exit topology, no-reward leaves, requirements, forces, caps, and counters.          |
| Q paired miniboss generation    | ported   | `RunLogic.lua`, `RoomLogic.lua`, `RoomDataQ.lua`, `biomes/Q_GAME_RULES.md` | Stage pools let each physical exit reference either peer independently; concrete debug-only `Q_MiniBoss01` stays excluded.         |
| Q miniboss counters and rewards | ported   | Q miniboss encounters, `LootData.lua`, `biomes/Q_GAME_RULES.md`            | Brute/Stalker/Tail count, Eye does not, and every supported miniboss resolves through concrete `TyphonBossRewards`.                |
| Q direct preboss shop           | ported   | `RoomDataQ.lua`, `StoreData.lua`, `biomes/Q_GAME_RULES.md`                 | Exact-depth-7 `Q_PreBoss01` owns one direct `Q_WorldShop`; no shop-then-fill policy is present.                                    |
| Q reward-free batch policy      | ported   | `RoomDataQ.lua`, `RewardLogic.lua`, `biomes/Q_GAME_RULES.md`               | Q continuation batches use explicit no-store policy while miniboss declarations own their forced store.                            |
| Q completion and exclusions     | ported   | `RoomDataQ.lua`, boss encounters, `biomes/Q_GAME_RULES.md`                 | Neutral `Q_Boss01` completes the route; `Q_Boss02`, Palace postboss/story, debug miniboss, and automatic boss drops stay excluded. |
| Q simulation activation         | deferred | `biomes/Q_GAME_RULES.md`                                                   | Keep dormant until the full Surface prefix and shared cross-biome vocabulary are implemented.                                      |

## Phase 2.8 Cross-Biome Closure

The normalized catalog closes the following route-owned matrix. Completion
rooms belong to each biome layout; `Next` is derived only from route order.

| Route      | Biome | Layout        | Rooms (authored) | Progression / batch     | Generated store                      | Terminal            | Completion                 | Next |
| ---------- | ----- | ------------- | ---------------- | ----------------------- | ------------------------------------ | ------------------- | -------------------------- | ---- |
| Underworld | F     | `LinearBiome` | 34 (32)          | eligibility / standard  | authored Run/Meta                    | forked              | `F_Boss01`, `F_PostBoss01` | G    |
| Underworld | G     | `LinearBiome` | 30 (28)          | eligibility / standard  | authored Run/Meta                    | forked              | `G_Boss01`, `G_PostBoss01` | H    |
| Underworld | H     | `LinearBiome` | 22 (20)          | fixed count / Fields    | none                                 | forked              | `H_Boss01`, `H_PostBoss01` | I    |
| Underworld | I     | `LinearBiome` | 32 (28)          | eligibility / Clockwork | none                                 | generated target    | `I_Boss01`, `I_PostBoss01` | --   |
| Surface    | N     | `HubBiome`    | 46 (43)          | persistent fixed hub    | none                                 | fixed authored slot | `N_Boss01`, `N_PostBoss01` | O    |
| Surface    | O     | `LinearBiome` | 25 (23)          | fixed count / standard  | authored, ShipCombat source override | direct              | `O_Boss01`, `O_PostBoss01` | P    |
| Surface    | P     | `LinearBiome` | 28 (26)          | eligibility / standard  | authored Run/Meta                    | forked              | `P_Boss01`, `P_PostBoss01` | Q    |
| Surface    | Q     | `LinearBiome` | 23 (22)          | staged / standard       | none                                 | direct              | `Q_Boss01`                 | --   |

The core simulation matrix and application capability matrix now include F, G,
H, and I as authorable, simulatable, and editable through one shared linear-
biome editor. Complete F/G/H/I prefixes enter profiles, recovery, simulator
dispatch, candidate scope, and editor navigation together. P/Q/O remain
declaration-only. N additionally owns a dormant authored Hub plan,
completeness gate, and canonical materializer but remains outside every
application capability and simulator dispatch.

The following remaining dispositions are deliberate and exhaustive at this
boundary; each biome rule document owns its exact room-level instances:

- **Simplified:** simulation proves possibility rather than probability; the
  catalog uses a progressed-save, neutral-difficulty, NPC-free baseline; combat
  encounter variants collapse only when they have no modeled topology,
  counter, reward, or history distinction.
- **Deferred:** persistent NPC entities, Chaos and other structural detours,
  optional interactions, concrete boon/trait identities, affordability, and
  the remaining P/Q/O/N history, candidate, validation, and feedback
  consumers remain additive future work.
- **Excluded:** external save/profile predicates, inaccessible or debug-only
  rooms, noncanonical difficulty variants, and automatic boss drops without a
  modeled downstream consumer do not enter production declarations.
- **Dormant:** P/Q/O have complete declarations but no connected authored
  topology. N has complete declarations plus dormant authored topology,
  completeness, and canonical materialization. None has active simulator
  dispatch, selected validation, candidate surface, or an editor panel.

No generic `unsupported` field, compatibility scaffold, placeholder
materializer, or route-qualified duplicate biome authority remains.

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
