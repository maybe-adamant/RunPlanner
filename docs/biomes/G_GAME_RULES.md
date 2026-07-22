# G Game Rules

## Purpose and Scope

This document is the concrete game-rule authority for Oceanus (`G`). Shared
picker, physical-door, cap, force, offer/acquisition, generated-store, standard
linear, and forked-preboss semantics are defined by
`../design/GAME_GENERATION_RULES.md`.

Exact room-local exits, requirements, caps, labels, encounter-profile keys,
and reward bindings appear explicitly in catalog declarations. This document
owns how those facts form the G biome and how vanilla behavior projects into
the planner.

## Evidence Status

These rules were verified against the Hades II script extraction and map data
on 2026-07-16, with reward-store behavior and locked-exit encounters rechecked
on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataG.lua
../../../../1GameData/Scripts/ObstacleDataG.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Maps/bin/
```

## Feature Projection Map

The disposition vocabulary is defined by `../design/CATALOG_MODEL.md`; implementation
coverage is defined by `../progress/MIGRATION_PROVENANCE.md`.

| Feature                                | Verified game behavior                                                                                                    | Disposition and planner projection                                                                     | Implementation status | Reconsider when                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------- |
| Generated decisions                    | G uses sequential physical doors, forced pools, and repeatable unpicked room creations                                    | **Exact:** standard generated batches with distinct Room Occurrences                                   | implemented           | --                                                            |
| Fixed intro                            | `G_Intro` is reward-free and has no planner-relevant encounter choice                                                     | **Exact:** empty fixed intro projection                                                                | implemented           | --                                                            |
| Ordinary combat identity               | Maps choose internal enemy waves while each supported combat has its relevant room and counter effects                    | **Simplified:** preserve concrete room identity and encounter-depth effect, not enemy-wave composition | implemented           | Combat composition becomes an authored or validated output    |
| Locked extra exits                     | After ordinary target creation, later exits may require a counting, reward-free unlock encounter before traversal         | **Deferred:** v1 requires the picked exit to realize open and takes it immediately                     | documented boundary   | v2 models optional per-exit actions and their counter effects |
| Anomaly replacement                    | An eligible ordinary G target may be replaced by a one-room Anomaly detour that later returns to the prior room set       | **Deferred:** omit and suppress Anomaly replacement in the v1 detour-free baseline                     | documented boundary   | Route-structural detours are implemented                      |
| Room eligibility and force             | Concrete current-run counters, caps, predecessor-exit requirements, mutual exclusion, and force windows govern candidates | **Exact:** declaration-owned predicates evaluated from history                                         | implemented           | --                                                            |
| Reward-store selection                 | G targets MetaProgress ratio `0.35` with adjustment speed `10`                                                            | **Simplified:** preserve only possible and forced RunProgress/MetaProgress support                     | implemented           | Probability analysis or exact RNG replay is introduced        |
| Incoming rewards and shops             | Combat, miniboss, Story, Fountain, Midshop, and Preboss producers retain concrete filters and overrides                   | **Exact:** occurrence incoming-reward state plus declaration-owned overrides                           | implemented           | --                                                            |
| Miniboss variants                      | All three variants are production rooms; Crawler is non-counting                                                          | **Exact:** separate concrete room and encounter profiles                                               | implemented           | --                                                            |
| Forked preboss                         | Every predecessor exit creates `G_PreBoss01`; first is Shop and up to two additional exits are free rewards               | **Exact:** one to three terminal occurrences of the same declaration                                   | implemented           | --                                                            |
| Narcissus benefit choice               | Entering `G_Story01` presents three NPC benefits whose concrete effects can include run and meta resources or traits      | **Deferred:** retain the fixed Story offer but do not author or consume the internal benefit choice    | documented boundary   | Concrete NPC gifts and trait state are modeled                |
| Fixed boss and postboss tail           | `G_PreBoss01` leads through one mutually exclusive Scylla variant and then `G_PostBoss01`                                 | **Exact:** layout-derived `G_Boss01` then `G_PostBoss01` under the neutral difficulty baseline         | implemented           | User-selected difficulty becomes a project input              |
| Narcissus and special-room progression | Dialogue, bounty, lifetime, prior-run force, and world-upgrade gates alter availability                                   | **Excluded:** progressed-save baseline retains current-run rules only                                  | documented boundary   | Save-profile state becomes a project input                    |

## Layout

`G_Intro` is the fixed, reward-free start. G then uses standard generated
batches and terminates through `G_PreBoss01`, forced at
`biomeDepthCache = 8`.

The layout declares G's entry baseline as `biomeDepthCache = 1` and
`biomeEncounterDepth = 1`. Route-wide encounter depth and room-history ordinal
continue from validated F after F's biome-local transition resets.

The intro's reward-free empty profile, 0-to-1 force window, and current-run
counter behavior are exact catalog facts. The legacy exact-depth predicate is
rejected because it did not match the game.

## Physical Exits

- G combat rooms expose two or three exits according to their declarations;
- `G_Story01` has one exit;
- `G_Reprieve01` and `G_Shop01` have two exits;
- G miniboss rooms expose one or two exits according to their declarations.

The terminal predecessor may expose three exits, so G supports up to two free
preboss rewards. Exit indexes and physical generation order are semantic and
must not become primary/secondary presentation labels.

## Locked Extra Exits

Every ordinary G combat room has positive support for locking extra exits. The
game resolves this after the normal encounter and after it has created all
outgoing rooms and assigned their incoming rewards. The first physical exit is
guaranteed open; each later exit may remain locked.

Interacting with a locked exit starts one `GeneratedG_ExtraDoor` encounter.
That encounter grants no reward, increments `biomeEncounterDepth` and the
route-wide encounter depth once, and unlocks only that exit. A room can have
several locked exits, and the player may clear several of them without
necessarily taking any cleared exit. These increments happen too late to
change the already-created peer batch, but they can change downstream room
eligibility and force state.

The v1 planner deliberately selects one canonical supported trace:

- the authored picked target remains associated with its declared physical
  exit and physical generation order is not rewritten;
- that picked exit is assumed to realize open;
- the player takes it immediately and never interacts with another exit;
- no `GeneratedG_ExtraDoor` event or encounter-depth increment enters the v1
  canonical history;
- lock state on unpicked exits is not authored or simulated.

This baseline is possible for every physical exit because later exits have
positive support for remaining open. It is therefore a deliberate restriction
to one valid G traversal, not a claim that locked exits do not exist.

A richer v2 representation may add completed unlock encounters as optional
per-exit transition actions. That extension must preserve the current no-action
trace as its default, add counter events between peer-batch generation and
picked-target entry, and must not turn unlock encounters into Room
Occurrences.

## Anomaly Detour

Every ordinary G combat declaration permits Anomaly replacement in the game.
After the picker has selected an eligible G target, the game may replace that
target with an Anomaly room. The replacement owns a different room identity,
encounter, reward, and history contribution before returning to the prior room
set. It is therefore a route-structural detour, not a room-local feature or a
different enemy-wave composition for the selected G room.

The v1 planner omits Anomaly rooms and conditions canonical history on no
Anomaly replacement. Planned game execution must suppress the replacement,
just as it suppresses natural Chaos routing. Observing an Anomaly during a v1
execution is a conformance mismatch. Anomaly routing remains deferred until
layouts can represent leaving and returning to a biome spine.

## Room Families and Caps

- 20 ordinary combat declarations use the `StandardCombat` room template and
  shared `SingleCountedCombat` encounter profile;
- `G_MiniBoss01`, `G_MiniBoss02`, and `G_MiniBoss03` are production rooms;
- one Story room produces fixed `Story`;
- one Reprieve uses `Fountain`;
- one Midshop uses `Shop` and `WorldShop`;
- one terminal room uses the forked preboss policy.

Ordinary G combat rooms have `MaxAppearancesThisBiome = 1` and no
`MaxCreationsThisRun`, so an unentered combat can be offered again later when
eligible. Special rooms carry their exact creation caps.

`G_MiniBoss03` is not debug-only; it owns the counting Jellyfish encounter and
participates in the production miniboss family. The Crawler encounter is
non-counting. The three variants share a force window and become mutually
exclusive from entered-room history.

`G_Shop01` has a force window, a separate real upper eligibility bound, and a
minimum two-exit predecessor requirement. These remain separate declaration
facts.

The fixed `Story` producer describes the incoming door offer for
`G_Story01`. Entering that room also presents Narcissus's internal benefit
choice. The current product deliberately does not author those concrete gifts
or apply their trait and resource effects. That future NPC/trait-resolution
surface does not change the current Story producer or room eligibility model.

## Reward-Store Projection

G targets a MetaProgress entered-room ratio of `0.35` and uses adjustment speed
`10` under the neutral progressed-save baseline. It uses the support-only
formula from `../design/REWARD_MODEL.md` within the generated-door lifecycle defined by
`../design/GAME_GENERATION_RULES.md`.

`G_Combat04`, `G_Combat05`, `G_Combat07`, and `G_Combat08` exclude Devotion but
still permit both RunProgress and MetaProgress. Other ordinary G combats use the
unfiltered two-store domain. G minibosses force RunProgress and Boon. Fixed
Story and Shop producers retain resolved store provenance for future entered-
room ratio history.

## Terminal Preboss

`G_PreBoss01` uses the shared shop-then-fill policy:

```text
exit 1 -> G_PreBoss01 with Shop
exit 2 -> G_PreBoss01 with free RunProgress reward, when present
exit 3 -> G_PreBoss01 with another free RunProgress reward, when present
```

Free rewards exclude `Devotion` and `RoomMoneyDrop`. G's maximum free-reward
capacity is two. Each target is a distinct occurrence of the same concrete room
declaration.

## Fixed Boss and Postboss Tail

G completes through a layout-derived fixed sequence after the entered preboss
occurrence:

```text
G_PreBoss01
  -> G_Boss01
  -> G_PostBoss01
  -> H_Intro
```

`G_Boss01` is the canonical neutral-difficulty Scylla room. `G_Boss02` is the
mutually exclusive user-difficulty variant and is excluded until difficulty
becomes a project input. The automatic Mixer and weapon-dependent boss drops
do not participate in authored reward choice or any currently modeled
acquisition rule, so the planner deliberately gives the derived boss no
modeled reward surface. `G_PostBoss01` has the empty encounter, no modeled
reward, and transitions to H.

The boss and postboss are concrete derived Room Declarations referenced by the
G layout completion sequence. They are never generated candidates or authored
editor topology. Their declarations own their encounters, counters, modeled
reward surfaces, and reward-store history effects. `G_Boss01` records a
contribution from the store resolved for the preboss's outgoing boss offer even
though its automatic drops are outside the reward model; `G_PostBoss01` records
no store contribution.

## Progressed-Save Boundary

`FishmanIntro`'s first-completion force, the early-run Eris event in `G_Intro`,
`G_MiniBoss02` lifetime encounter-completion gates, Narcissus prior-run force,
progression and bounty gates, and the Fountain world-upgrade gate are excluded.
Their current-run room, counter, cap, force, and reward rules remain exact.

## Current Product Boundary

G completeness, canonical linear materialization, lifecycle/history folding,
room-generation legality, reward legality, finding composition, and validated
F-to-G route continuation are live. The fixed rewardless intro uses the shared
rewardless lifecycle; the canonical v1 history emits no locked-door encounter.
The layout-derived boss/postboss tail is materialized, and `G_Boss01` records
the RunProgress store resolved for its outgoing boss offer without inventing a
boss reward.

G editor activation and candidate presentation are live through the shared
linear-biome editor. The application simulation horizon includes F and G;
upstream-invalid or incomplete F leaves configured G visible and editable but
context-unavailable, without inventing G-local findings. Direct core and
application interaction fixtures cover complete, incomplete, and blocked G
plans. G-specific fixtures also cover Crawler timing and post-entry miniboss
mutual exclusion, plus the maximum three-exit preboss fork through simulation
and shared-editor selection.
