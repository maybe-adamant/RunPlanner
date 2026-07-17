# F/G Game Rules

## Purpose and Scope

This document is the concrete game-rule authority for the first Erebus and
Oceanus implementation slice. It records cross-room structure and verified
generation semantics without duplicating every future TypeScript room
declaration.

Exact room-local exits, requirements, caps, labels, encounter-profile keys,
and reward bindings still appear explicitly in catalog declarations. This
document explains how those facts combine.

## Evidence Status

These rules were verified against the Hades II script extraction and map data
on 2026-07-16. The primary sources are:

```text
../../1GameData/Scripts/RoomSets.lua
../../1GameData/Scripts/RoomDataF.lua
../../1GameData/Scripts/RoomDataG.lua
../../1GameData/Scripts/RunLogic.lua
../../1GameData/Scripts/RoomLogic.lua
../../1GameData/Scripts/RewardLogic.lua
../../1GameData/Maps/bin/
```

The previous Lua declarations and revamp audits are interpreted evidence. Each
rule is rechecked against the current extraction while it is ported, as
tracked by `MIGRATION_PROVENANCE.md`.

## Shared Generation Rules

The room picker filters eligible room-set entries, prefers the forced pool
when non-empty, and otherwise selects from the eligible pool. Room-set
multiplicity represents random weight; the planner does not simulate those
probabilities.

Physical doors are processed sequentially. Every selected target is created
immediately, so later peers see earlier creation history. Ordinary eligibility
does not generally exclude a game room merely because another exit in the same
batch already selected it.

Consequently:

- peer exits may create the same concrete game room;
- an unentered room may be created again in a later batch;
- every creation has independent incoming reward state;
- unpicked peers still affect creation and reward-offer history.

The app represents each creation as a separate Room Occurrence with its own
persisted occurrence ID. It never substitutes another compatible combat name
to manufacture uniqueness.

## Caps

The game caps are separate predicates:

`MaxCreationsThisRun`
: Counts concrete room creations, including unpicked peers.

`MaxAppearancesThisBiome`
: Counts entered appearances in the current biome.

`MaxCreationsPerRoom`
: Restricts creation relative to the current predecessor. It is not a generic
same-batch uniqueness rule.

Supported ordinary F and G combat rooms use
`MaxAppearancesThisBiome = 1`. They do not use
`MaxCreationsThisRun`, so repeated unpicked offers remain structurally
representable and are judged from history. Special rooms commonly use creation
caps, but each concrete declaration must carry its exact rule.

## Force Semantics

`ForceAtBiomeDepth` is exact-depth eligibility and force on that counter.
`ForceAtBiomeDepthMin/Max` is a force window with a deadline; its maximum is
not automatically an eligibility ceiling. A separate current-run requirement
must express a real upper bound.

Force pressure applies across the complete peer batch. A forced target created
on an earlier physical exit can change what remains forced or eligible for a
later exit.

The simulator must therefore preserve physical generation order and evaluate
force and eligibility from the appropriate pre-creation history view.

## Offer and Entry Timing

While a source room is current, it generates every next-room occurrence and
offers every incoming reward. The picked occurrence is entered later.

```text
source.generate_next
  -> room.create for every physical exit
  -> reward.offer for every target

picked target entry
  -> room.appear
  -> reward.acquire
```

Unpicked targets never acquire their incoming rewards. This distinction is
essential for counted bags, creation caps, and repeated game names.

## Linear Biome Structure

F and G use `LinearBiome`:

```text
declared start
  -> generated batch
  -> picked target
  -> generated batch
  -> ...
  -> terminal transition
```

Every ordinary batch has one target occurrence per active physical exit and
exactly one picked target. Only the picked occurrence owns the downstream
continuation. Unpicked occurrences are dead leaves.

Physical exit count belongs to the selected source Room Declaration. Reward
count, encounter count, and UI row count never determine it.

## Terminal Preboss Generation

`F_PreBoss01` and `G_PreBoss01` combine a forced first Shop reward with no
per-predecessor creation cap. When a predecessor has several exits, the game
may create the same preboss room on every exit:

```text
exit 1 -> X_PreBoss01 with Shop
exit 2 -> X_PreBoss01 with free RunProgress reward
exit 3 -> X_PreBoss01 with another free RunProgress reward, G only
```

Free rewards exclude `Devotion` and `RoomMoneyDrop`. Every exit contributes a
real room creation and reward offer. Exactly one exit is picked and all exits
load the same concrete map identity.

The app models this without the old singleton preboss control:

- the terminal transition owns one terminal target occurrence per active
  predecessor exit;
- every target references the same terminal Room Declaration but has its own
  occurrence ID;
- the terminal policy derives the target's realization kind from physical
  generation order: first `shop`, then `freeReward`;
- topology owns the one picked terminal target;
- each free target owns its concrete counted reward;
- the shop target owns complete shop state, which is active for acquisition
  only when that target is entered;
- unpicked terminal targets contribute creation and door-offer history but no
  acquisition or entered-room shop purchases.

There is no authored preboss `entryMode`. Picking a physical terminal target
already expresses the entered realization. The same occurrence identity used
for simulation and findings resolves its editor state.

Changing the predecessor changes active terminal target capacity through the
same explicit downstream-retention and reconciliation policy used by ordinary
batches. It does not coerce the picked target or erase still-representable
offers silently.

## F: Erebus

### Layout

F has one selected start from:

```text
F_Opening01
F_Opening02
F_Opening03
```

Openings are start-only and cannot appear as ordinary later targets. The
supported progressed-save encounter profile uses counting
`OpeningGeneratedF`. Progression-controlled `OpeningEmpty` and
`FCastTutorialFight` are not production choices or production predicates.

F uses ordinary generated batches and terminates through `F_PreBoss01`, forced
at `biomeDepthCache = 10`.

### Physical Exits

- every F opening has one exit;
- `F_Combat01`, `F_Combat09`, and `F_Combat10` have one exit;
- other supported `F_Combat02..22` rooms have two exits;
- `F_Story01`, `F_Reprieve01`, and `F_Shop01` have two exits;
- `F_MiniBoss01..03` have one exit.

The terminal predecessor can therefore expose at most one free preboss reward.

### Room Families

- 22 ordinary combat declarations use `StandardCombat`;
- three miniboss declarations use `Miniboss` with concrete encounter-profile
  identity;
- one story room produces fixed `Story`;
- one reprieve uses `Fountain`;
- one midshop uses `Shop` and `WorldShop`;
- one terminal room uses the forked preboss policy.

`F_Combat01` fixes `RunProgress` and excludes Devotion. Other F combat rooms
use the ordinary `RunProgress`/`MetaProgress` binding. Exact bindings are in
`REWARD_MODEL.md`.

Shop and miniboss force windows, shop exit-count requirements, miniboss
exclusion, and creation caps remain explicit requirement trees in their Room
Declarations. The layout engine does not special-case their names.

## G: Oceanus

### Layout

`G_Intro` is the fixed, reward-free start. G uses ordinary generated batches
and terminates through `G_PreBoss01`, forced at
`biomeDepthCache = 8`.

### Physical Exits

- G combat rooms expose two or three exits according to their concrete
  declarations;
- `G_Story01` has one exit;
- `G_Reprieve01` and `G_Shop01` have two exits;
- G miniboss rooms expose one or two exits according to their concrete
  declarations.

The terminal predecessor may expose three exits, so G supports up to two free
preboss rewards. Exit indexes and generation order are semantic and must not
be normalized into primary/secondary UI rows.

### Room Families

- 20 ordinary combat declarations use `StandardCombat`;
- `G_MiniBoss01`, `G_MiniBoss02`, and `G_MiniBoss03` are supported production
  rooms;
- one story room produces fixed `Story`;
- one reprieve uses `Fountain`;
- one midshop uses `Shop` and `WorldShop`;
- one terminal room uses the forked preboss policy.

`G_Combat04`, `G_Combat05`, `G_Combat07`, and `G_Combat08` exclude Devotion but
still permit both `RunProgress` and `MetaProgress`. Other ordinary G combat
rooms use the unfiltered two-store binding.

`G_Shop01` has a force window, a separate real upper eligibility bound, and a
minimum two-exit predecessor requirement. The three miniboss variants share a
force window and become mutually exclusive from entered-room history.
`G_MiniBoss03` is not debug-only; it owns the Jellyfish miniboss encounter and
participates in the same production family.

## Completeness and Validation

F or G is complete only when its selected chain reaches a complete terminal
transition and every active ordinary or terminal target occurrence has
complete leaf state.

Completeness does not imply legality. A complete snapshot may still contain:

- an ineligible room;
- a violated creation or appearance cap;
- unsatisfied force pressure;
- an authored reward unavailable from current bag history;
- a terminal target inconsistent with current predecessor capacity;
- a repeated entered room rejected by its appearance cap.

Validation reports these facts without rewriting topology or substituting game
room identities.

## Explicitly Rejected Legacy Rules

The standalone app does not carry forward:

- injective top-level room references;
- compatible combat-room substitution;
- static combat-pool capacity proofs whose purpose was supporting that
  substitution;
- one global dormant Room Control per game room;
- a singleton forked-preboss control with an authored `entryMode`.

The actual creation, appearance, force, exit, reward, and encounter rules are
retained and applied to occurrence history.
