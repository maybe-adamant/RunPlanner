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

| Rule family                                | Status   | New authority                                              | Evidence and action                                                                                                                                                   |
| ------------------------------------------ | -------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Global biome identity and route order      | ported   | `CATALOG_MODEL.md`                                         | Global `F/G/H/I/N/O/P/Q` declarations own identity and labels; routes own ordered references and layout completion no longer owns route transition.                   |
| Unique Room Declarations by `gameName`     | ported   | `CATALOG_MODEL.md`                                         | Catalog construction rejects duplicate concrete room game names.                                                                                                      |
| Repeatable Room Occurrences                | ported   | `AUTHORED_PROJECT_MODEL.md`                                | Persisted occurrence IDs support repeated game names with round-trip fixtures.                                                                                        |
| Injective combat canonicalization          | rejected | `GAME_GENERATION_RULES.md`                                 | Do not substitute unused compatible combat names.                                                                                                                     |
| Static combat capacity proof               | rejected | `GAME_GENERATION_RULES.md`                                 | Its purpose was supporting injectivity; retain ordinary topology bounds only.                                                                                         |
| Creation versus appearance caps            | ready    | `GAME_GENERATION_RULES.md`, `SIMULATION_AND_VALIDATION.md` | Verify every concrete cap while porting biome rooms.                                                                                                                  |
| Offer versus acquisition history           | ready    | `REWARD_MODEL.md`, `SIMULATION_AND_VALIDATION.md`          | Add picked/unpicked peer bag fixtures.                                                                                                                                |
| Possibility rather than probability        | ready    | `ARCHITECTURE.md`, `SIMULATION_AND_VALIDATION.md`          | Validate authored outcomes by support membership; never score likelihood.                                                                                             |
| Counter-axis separation                    | ready    | `SIMULATION_AND_VALIDATION.md`                             | Preserve exact event phases and pre/post views.                                                                                                                       |
| Single-room lifecycle composition          | ready    | `ROOM_LIFECYCLE_MODEL.md`                                  | Add reusable profiles, declaration-driven effects, typed events, and occurrence-addressed fragments; validate every decision from its exact operation-time state.     |
| Layout-derived completion sequences        | ready    | `GAME_GENERATION_RULES.md`, concrete biome rule documents  | Add concrete derived room declarations, ordered layout completion or route completion, and explicit store-history policies; never hard-code room names in simulation. |
| Policy-selected batch-global state         | ready    | `AUTHORED_PROJECT_MODEL.md`, `biomes/H_GAME_RULES.md`      | Add typed layout-selected batch codecs and semantic commands; never use a generic extension property bag.                                                             |
| Route-structural detour suppression        | ready    | `GAME_GENERATION_RULES.md`, `GAME_INTEGRATION_BOUNDARY.md` | Suppress natural Chaos and Anomaly replacement until layouts can represent detour entry and return.                                                                   |
| Current-run requirement evaluators         | ported   | `CATALOG_MODEL.md`, `SIMULATION_AND_VALIDATION.md`         | Total pure registry covers every normalized F/G requirement kind.                                                                                                     |
| External save/profile requirements         | ready    | `CATALOG_MODEL.md`                                         | Omit from production declarations; do not create zombie audit predicates.                                                                                             |
| Lib controls, codecs, and commit lifecycle | rejected | `ARCHITECTURE.md`                                          | Do not port.                                                                                                                                                          |

## Reward Migration

| Family                                    | Status | Primary evidence                                                                 | Port action                                                                                                                                                          |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RunProgress and MetaProgress primitives   | ported | `LootData.lua`, `RewardData.lua`, legacy primitive declarations                  | Required counted-bag primitive identities, labels, and payload defaults normalize.                                                                                   |
| F/G required primitives                   | ported | game reward data and legacy primitive declarations                               | All primitives consumed by the current F/G declarations normalize.                                                                                                   |
| `BoonSource` and `DevotionPair` payloads  | ready  | `RewardLogic.lua`, `EncounterLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`             | Retain source membership/defaults and replace the generic pair with explicit chosen/spurned roles.                                                                   |
| RunProgress counted bag                   | ported | `LootData.lua`, `RequirementsData.lua`                                           | Game order and multiplicity are preserved; current-run predicates remain.                                                                                            |
| MetaProgress counted bag                  | ready  | `LootData.lua`, `RequirementsData.lua`, `REWARD_GAME_DATA_AUDIT.md`              | Replace the Phase 1 raw 19-entry union with the exact 13-entry fully progressed projection.                                                                          |
| Producer positive/negative filters        | ported | `REWARD_MODEL.md`, legacy consumer audit                                         | Concrete F/G producers embed normalized positive and negative filters.                                                                                               |
| Generated-door store resolution           | ready  | `RoomLogic.lua`, `RewardLogic.lua`, 2026-07-18 game-data audit                   | Resolve authored, source-offer-derived, and absent base stores at batches; keep room overrides and add physical-order fixtures.                                      |
| F/G reward-store ratio support            | ready  | `RewardLogic.lua`, `RunLogic.lua`, 2026-07-18 game-data audit                    | Derive possible base stores from exact history; do not model relative likelihood.                                                                                    |
| Counted-entry duplicate and refill policy | ready  | `LootData.lua`, `RewardLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`                   | Add entry-owned duplicate flags, one complete refill with retained leftovers, latent bag branching, peer-depletion fixtures, and a still-empty invariant failure.    |
| Reward source-support policy registry     | ready  | `RewardLogic.lua`, `RunLogic.lua`, `StoreLogic.lua`, `REWARD_GAME_DATA_AUDIT.md` | Add `ordinaryBoonPeer`, `ordinaryNoPeer`, and `devotionAcquiredPair` with explicit offer- or acquisition-time resolution; keep dispatch independent of reward names. |
| Offer and acquisition identity split      | ready  | reward/use history writes, `REWARD_GAME_DATA_AUDIT.md`                           | Replace `RewardPrimitive.acquiredAs` with resolved offers, reward-type acquisition roles, producer-timed concrete acquisitions, and concrete history projections.    |
| Reward offer projections                  | ready  | `RewardLogic.lua`, `RequirementsLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`          | Add the closed Devotion offer-time spacing projection; apply it to unpicked offers and never reconstruct it from source acquisition.                                 |
| Concrete acquisition registry             | ready  | `InteractLogic.lua`, loot/consumable declarations, `REWARD_GAME_DATA_AUDIT.md`   | Separate acquisition kind from the exact `lootAndUse` or `consumableAndUse` history projection selected by each supported identity.                                  |
| Blind Box authored result                 | ready  | `ConsumableData.lua`, `StoreLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`              | Persist the intended source, keep it dormant while unpurchased, and validate/emit it only in a supported purchase-order branch.                                      |
| World Shop profile                        | ready  | `StoreData.lua`, `StoreLogic.lua`, `REWARD_GAME_DATA_AUDIT.md`                   | Replace the flat three-union prototype with ordered groups, offer counts, per-option requirements, and without-replacement rules.                                    |
| Shop entry lifecycle                      | ready  | `ROOM_LIFECYCLE_MODEL.md`, `REWARD_MODEL.md`, room-entry generation behavior     | Require typed state only on picked occurrences; generate outgoing doors from pre-purchase history, then apply purchases to the exit history.                         |
| H reward structures                       | ready  | `RoomDataH.lua`, `RoomLogic.lua`, `biomes/H_GAME_RULES.md`                       | Add three room-owned cage slots, batch-derived activation, ordered RunProgress offers, and deferred optional Fields rewards.                                         |
| I reward structures                       | ready  | I game data, `biomes/I_GAME_RULES.md`                                            | Add `TartarusRewards`, derived Goal/NonGoal producers, folded counters, and `I_WorldShop`.                                                                           |
| N reward structures                       | ready  | N game data, `biomes/N_GAME_RULES.md`                                            | Add persistent HubRewards offers, local side-room bags, and hub-wide preboss shop lookup.                                                                            |
| O reward structures                       | ready  | `RoomDataO.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md`    | Add phase-owned wheels, ordered offers/acquisitions, and source-derived outgoing stores without duplicating authority.                                               |
| P reward structures                       | ready  | `RoomDataP.lua`, `biomes/P_GAME_RULES.md`                                        | Port the NPC-free baseline only; keep simulation dormant until N/O history exists.                                                                                   |
| Q reward structures                       | ready  | `RoomDataQ.lua`, `LootData.lua`, `StoreData.lua`, `biomes/Q_GAME_RULES.md`       | Add `TyphonBossRewards`, `Q_WorldShop`, explicit no-reward producers, and no generated base store.                                                                   |

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

| Family                           | Status   | Primary evidence                                                              | Port action                                                                                                                                            |
| -------------------------------- | -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G layout and terminal depth      | ported   | `RoomDataG.lua`, legacy G biome rules                                         | Fixed intro, authored bounds, ordinary continuation, and the depth-8 terminal normalize.                                                               |
| G intro                          | ported   | `RoomDataG.lua`, encounter declarations                                       | Reward-free `FixedIntro`, its 0-1 force window, and empty encounter profile normalize; the legacy exact-depth predicate was rejected.                  |
| G physical exits                 | ported   | `RoomDataG.lua`, extracted map topology                                       | Every G room has exact ordered `OceanusExitDoor` fixtures, including all two/three-exit exceptions.                                                    |
| G locked-exit encounters         | deferred | `RoomDataG.lua`, `ObstacleDataG.lua`, `RoomLogic.lua`                         | V1 conditions the canonical trace on taking an open picked exit immediately; optional per-exit unlock actions and counter effects are reserved for v2. |
| G Anomaly replacement            | deferred | `RoomDataG.lua`, `RunLogic.lua`                                               | Suppress the one-room detour in v1; do not reinterpret it as an ordinary G encounter or candidate.                                                     |
| G combat declarations            | ported   | `RoomSets.lua`, `RoomDataG.lua`, legacy `g_oceanus.lua`                       | All 20 rooms, exact counter ranges, and the four Devotion exclusions are covered by one parity matrix.                                                 |
| `G_MiniBoss03`                   | ported   | `RoomSets.lua`, `RoomDataG.lua`                                               | Production Hellifish resolves to counting `MiniBossJellyfish`; it is not treated as debug-only.                                                        |
| G miniboss group requirements    | ported   | `RoomDataG.lua`, run requirements                                             | Entered-room mutual exclusion, force window, caps, concrete encounters, and Crawler's non-counting timing normalize.                                   |
| `G_Shop01` force and eligibility | ported   | `RoomDataG.lua`                                                               | Eligibility ends at depth 5 while the raw force maximum remains 6; minimum two-exit context is explicit.                                               |
| G forked preboss declaration     | ported   | `RoomLogic.lua`, `RewardLogic.lua`, `biomes/G_GAME_RULES.md`                  | WorldShop-first and two-free-reward capacity normalize; physical occurrences and acquisition fixtures belong to later phases.                          |
| G fixed completion tail          | ported   | `RoomDataG.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/G_GAME_RULES.md` | Neutral `G_Boss01` and `G_PostBoss01` are derived declarations ordered by the layout; the boss retains resolved-offer store history.                   |

The G port follows the same progressed-save scope as F. `FishmanIntro`, the
early-run Eris event, `G_MiniBoss02`'s lifetime encounter-completion gates,
Narcissus prior-run force and progression/bounty gates, and the Fountain
world-upgrade gate remain omitted. Their current-run room, counter, cap,
force, and reward rules remain explicit. Narcissus's internal benefit choice
is separately deferred until concrete NPC gifts and trait state exist.

## H Migration

| Family                    | Status   | Primary evidence                                                              | Port action                                                                                                                                  |
| ------------------------- | -------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| H layout and bounds       | ready    | `RoomDataH.lua`, physical maps, `biomes/H_GAME_RULES.md`                      | Keep `LinearBiome`; add fixed intro, four ordinary entered rooms, one forked terminal, and the exact five-continuation/nine-target bound.    |
| H physical exits          | ready    | extracted map topology, `biomes/H_GAME_RULES.md`                              | Port one exit for intro, Combat01, Miniboss02, and preboss; port two for other generated H rooms.                                            |
| H combat declarations     | ready    | `RoomSets.lua`, `RoomDataH.lua`, `biomes/H_GAME_RULES.md`                     | Port all 15 concrete rooms, depth restrictions, raw cage capacities, no top-level reward, and three bounded local reward slots.              |
| Fields cage batch state   | ready    | `RoomLogic.lua`, `EventLogic.lua`, `biomes/H_GAME_RULES.md`                   | Add semantic Min/Max authored state, shared capacity derivation, two-Max history ceiling, and no-combat ordinary-batch updates.              |
| H encounter projection    | ready    | H generated encounters, `RoomLogic.lua`, `biomes/H_GAME_RULES.md`             | Emit no count for the passive ambient phase and one counting encounter per active cage on the entered target.                                |
| H cage reward lifecycle   | ready    | `RoomLogic.lua`, `LootData.lua`, `RewardLogic.lua`, `biomes/H_GAME_RULES.md`  | Resolve every active picked/unpicked cage offer through one ordered RunProgress batch; acquire all active cages only on entry.               |
| H generated-store policy  | ready    | `RoomDataH.lua`, `RoomLogic.lua`, `biomes/H_GAME_RULES.md`                    | Use `none`: supported targets are reward-free or resolve declaration-owned RunProgress; do not persist the unobserved generic Run/Meta roll. |
| Fields optional rewards   | deferred | `RoomDataH.lua`, `RoomLogic.lua`, `LootData.lua`, `biomes/H_GAME_RULES.md`    | Canonical v1 trace acquires none; do not fold the isolated optional bag into cage slots or batch state.                                      |
| H minibosses              | ready    | `RoomDataH.lua`, miniboss encounters, `biomes/H_GAME_RULES.md`                | Port exact exits, one-creation caps, entered mutual exclusion, force window, counting profiles, and forced RunProgress Boons.                |
| H bridge                  | ready    | `RoomDataH.lua`, bridge encounters, `biomes/H_GAME_RULES.md`                  | Port exact-two eligibility, force-pool competition, caps, two exits, and progressed-save Echo Story projection.                              |
| H forked preboss          | ready    | `RoomDataH.lua`, `RoomLogic.lua`, `RewardLogic.lua`, `biomes/H_GAME_RULES.md` | Reuse shop-then-fill with one free-reward capacity; omit the terminal-only unobservable cage roll.                                           |
| H fixed completion tail   | ready    | `RoomDataH.lua`, `RewardLogic.lua`, `biomes/H_GAME_RULES.md`                  | Declare neutral `H_Boss01` and `H_PostBoss01`, order them before `I_Intro`, and record fixed RunProgress boss provenance.                    |
| H persistent NPC variants | deferred | H encounter sets and NPC encounter data                                       | Suppress unconfigured Nemesis variants; later persistent entities compose before history.                                                    |
| H simulation activation   | deferred | `biomes/H_GAME_RULES.md`                                                      | Keep dormant until the reconciled vocabulary and full H product loop are implemented.                                                        |

## O Migration

| Family                       | Status   | Primary evidence                                                                  | Port action                                                                                                                            |
| ---------------------------- | -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| O layout and bounds          | ready    | `RoomDataO.lua`, physical maps, `biomes/O_GAME_RULES.md`                          | Add fixed intro, six ordinary entered rooms, seven single-target continuations, direct terminal, and boss/postboss completion.         |
| O physical exits             | ready    | extracted map topology, `biomes/O_GAME_RULES.md`                                  | Port one `ShipsExitDoor` for every supported editable room; never infer exit count from wheel offers.                                  |
| O combat declarations        | ready    | `RoomSets.lua`, `RoomDataO.lua`, `RunData.lua`, `biomes/O_GAME_RULES.md`          | Port all 15 maps in ordinary, early-only, and late-backup families after real inheritance; do not compose replaced requirement tables. |
| ShipCombat encounter profile | ready    | O encounter sets, `RoomLogic.lua`, `biomes/O_GAME_RULES.md`                       | Add Intro, mandatory Combat1, and pre-room-condition Combat2 with exact per-phase BED timing.                                          |
| O wheel reward lifecycle     | ready    | `RoomLogic.lua`, `EncounterSets.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md` | Add two bounded room-owned offer points, one/two offers per active wheel, peer bag consumption, and picked acquisition after combat.   |
| Source-derived batch store   | ready    | `RoomLogic.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md`                      | Add `sourceOfferPoint`; resolve the final active wheel for ShipCombat sources and never persist an outgoing copy.                      |
| O special rooms              | ready    | `RoomDataO.lua`, unique/miniboss/devotion encounters, `biomes/O_GAME_RULES.md`    | Port exact caps, current-run requirements, force competition, producers, and Charybdis/Captain/Devotion BED effects.                   |
| O direct preboss             | ready    | `RoomDataO.lua`, `RoomLogic.lua`, `biomes/O_GAME_RULES.md`                        | Add the BDC-7 must-force single shop-only terminal; preserve raw force fields and do not reuse shop-then-fill.                         |
| O fixed completion tail      | ready    | `RoomDataO.lua`, `RewardLogic.lua`, `biomes/O_GAME_RULES.md`                      | Declare neutral `O_Boss01` and `O_PostBoss01`, order them before `P_Intro`, and retain resolved boss-offer store provenance.           |
| O progression/NPC variants   | deferred | O encounter sets and NPC encounter data                                           | Suppress first-time, Heracles, and Icarus variants; later persistent entities replace addressed phases before history.                 |
| O simulation activation      | deferred | `biomes/O_GAME_RULES.md`                                                          | Keep dormant until the reconciled vocabulary and full O product loop are implemented.                                                  |

## I Migration

| Family                     | Status   | Primary evidence                                                              | Port action                                                                                                                                          |
| -------------------------- | -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| I layout and bounds        | ready    | `RoomDataI.lua`, physical maps, `biomes/I_GAME_RULES.md`                      | Add derived fixed Intro/Story entry, twelve authored continuations, exact 22-target bound, and conditional-terminal Clockwork batches.               |
| I combat declarations      | ready    | `RoomSets.lua`, `RoomDataI.lua`, `biomes/I_GAME_RULES.md`                     | Port all 24 combat maps, exact exits, one counting profile, combat 24 BDC ceiling, and two-exit capacity requirements.                               |
| Clockwork global state     | ready    | `RewardLogic.lua`, `RoomDataI.lua`, `biomes/I_GAME_RULES.md`                  | Add fixed five Goals, authored non-goal cap in `{3,4,5,6}`, and exact entered-producer counter timing.                                               |
| I reward structures        | ready    | `LootData.lua`, `RewardData.lua`, `RewardLogic.lua`, `biomes/I_GAME_RULES.md` | Use batch-store `none` plus declaration-owned `TartarusRewards`; derive Goal/NonGoal and persist only the potential concrete non-goal leaf.          |
| I special rooms            | ready    | I room and encounter data, `biomes/I_GAME_RULES.md`                           | Add fixed progressed Story, Reprieve, and two supported minibosses; exclude concrete debug-only Shop and miniboss 03.                                |
| Conditional preboss batch  | ready    | `RunLogic.lua`, `RoomLogic.lua`, `RoomDataI.lua`, `biomes/I_GAME_RULES.md`    | Permit terminal plus ordinary targets in one batch; derive completion from the picked declaration and allow later preboss occurrences after decline. |
| I preboss shop             | ready    | `RoomDataI.lua`, `StoreData.lua`, `biomes/I_GAME_RULES.md`                    | Add shop-only `I_PreBoss02` with `I_WorldShop`; retain its Goal marker as structural and add no free-reward mode.                                    |
| I fixed completion tail    | ready    | `RoomDataI.lua`, boss encounter data, `biomes/I_GAME_RULES.md`                | Declare neutral `I_Boss01` and `I_PostBoss01`, then complete the route without automatic boss rewards or dead ledger state.                          |
| I progression/NPC variants | deferred | I encounter sets and persistent requirements                                  | Suppress first-visit, dream, Nemesis, and restored-house variants under the documented progressed NPC-free baseline.                                 |
| I simulation activation    | deferred | `biomes/I_GAME_RULES.md`                                                      | Keep dormant until the reconciled vocabulary and full I product loop are implemented.                                                                |

## N Migration

| Family                     | Status   | Primary evidence                                                                  | Port action                                                                                                                                |
| -------------------------- | -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| N fixed entry              | ready    | `RoomDataN.lua`, opening encounters, `biomes/N_GAME_RULES.md`                     | Add fixed authored Opening and PreHub slots, their RunProgress leaves, and exact counting/non-counting encounter timing.                   |
| N persistent hub           | ready    | `RoomDataN.lua`, `RoomLogic.lua`, `biomes/N_GAME_RULES.md`                        | Add fixed physical slot mapping, authored 9/10 open set, one persistent offer board, and no duplicate door-count authority.                |
| N main targets and pylons  | ready    | N room/obstacle/enemy data, `biomes/N_GAME_RULES.md`                              | Port all 23 combats and two minibosses, six distinct visit ordinals, spawn timing, required-pylon completion, and exact forced stores.     |
| N side-room topology       | ready    | N room/obstacle logic, `biomes/N_GAME_RULES.md`, `biomes/N_SIDE_ROOM_FINDINGS.md` | Add fixed bounded local slots, availability ranks, generated state, entered order, parent restores, and unordered joint reward validation. |
| N side-room rewards        | ready    | `LootData.lua`, `RewardData.lua`, generated encounters, `biomes/N_GAME_RULES.md`  | Add ordinary/hard counted bags, encounter-compatible filters, dormant leaves, and non-counting entered acquisition events.                 |
| N hub shop lookup          | ready    | `RoomLogic.lua`, `StoreData.lua`, `biomes/N_GAME_RULES.md`                        | Derive reward-type lookup from every initial open hub offer and consume it while validating the fixed preboss WorldShop.                   |
| N terminal and completion  | ready    | `RoomDataN.lua`, `ObstacleDataN.lua`, boss data, `biomes/N_GAME_RULES.md`         | Add fixed authored shop-only preboss, neutral boss, postboss, and transition to O without modeled automatic boss drops.                    |
| N progression/NPC variants | deferred | N encounter sets, Story and persistent requirements                               | Suppress Medea, Artemis, Heracles, OpeningEmpty, and other save variants under the documented progressed NPC-free baseline.                |
| N optional interactions    | deferred | N room and obstacle data                                                          | Suppress Chaos detours, gathering, challenges, wells, rerolls, postboss shops, and other no-action surfaces.                               |
| N simulation activation    | deferred | `biomes/N_GAME_RULES.md`                                                          | Keep dormant until the reconciled vocabulary and full N product loop are implemented.                                                      |

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

| Family                          | Status   | Primary evidence                                                           | Port action                                                                                                                       |
| ------------------------------- | -------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Q layout and staged pools       | ready    | `RoomDataQ.lua`, physical maps, `biomes/Q_GAME_RULES.md`                   | Keep `LinearBiome`; add declaration-driven foyer, forced fork, miniboss, ordinary, second fork, and direct-terminal stages.       |
| Q intro and foyer baseline      | ready    | `RoomDataQ.lua`, Q intro encounters, `biomes/Q_GAME_RULES.md`              | Port reward-free `Q_Intro` and both real foyer maps; omit first-time and lifetime progression gates.                              |
| Q combat declarations           | ready    | `RoomSets.lua`, `RoomDataQ.lua`, extracted map topology                    | Port all supported concrete combat rooms, exact one/two-exit fixtures, no-reward producers, and stage requirements.               |
| Q paired miniboss generation    | ready    | `RunLogic.lua`, `RoomLogic.lua`, `RoomDataQ.lua`, `biomes/Q_GAME_RULES.md` | Generate each physical exit independently; allow repeated peer room names and exclude concrete debug-only `Q_MiniBoss01`.         |
| Q miniboss counters and rewards | ready    | Q miniboss encounters, `LootData.lua`, `biomes/Q_GAME_RULES.md`            | Preserve counting Brute/Stalker/Tail versus non-counting Eye and add concrete `TyphonBossRewards`.                                |
| Q direct preboss shop           | ready    | `RoomDataQ.lua`, `StoreData.lua`, `biomes/Q_GAME_RULES.md`                 | Add one exact-depth-7 `Q_PreBoss01` terminal with `Q_WorldShop`; do not reuse shop-then-fill.                                     |
| Q reward-free batch policy      | ready    | `RoomDataQ.lua`, `RewardLogic.lua`, `biomes/Q_GAME_RULES.md`               | Use an explicit no-base-store batch policy while retaining declaration-owned forced miniboss stores.                              |
| Q completion and exclusions     | ready    | `RoomDataQ.lua`, boss encounters, `biomes/Q_GAME_RULES.md`                 | Derive neutral `Q_Boss01` then route completion; exclude `Q_Boss02`, Palace postboss/story progression, and automatic boss drops. |
| Q simulation activation         | deferred | `biomes/Q_GAME_RULES.md`                                                   | Keep dormant until the full Surface prefix and shared cross-biome vocabulary are implemented.                                     |

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
