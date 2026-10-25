# Fresh File Rules

## Scope and evidence

This appendix is the game-rule authority for the `FreshFile` route: the first
Underworld attempt on a brand-new profile, a fixed F → G → H → I route with the
pre-true-ending `I_PreBoss01`, the aspectless Staff as its fixed weapon and
`F_Opening01` as its one opening. The biome documents own the mature baseline;
this document owns only what differs on a fresh profile.

The [authored model](../design/AUTHORED_PROJECT_MODEL.md#route-loadout) owns the
route's empty loadout and start resolution. The catalog closes content a fresh
profile can never reach by
[route availability](../design/CATALOG_MODEL.md#save-profiles-and-route-availability);
the facts below are the content it does reach, expressed with the same
ordinary declarations. Profile-gate evidence is in the
[route-position audit](../audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md#fresh-profile-first-attempt)
and the
[composition matrix](../audits/rooms-and-routes/COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md).

## Catalog declarations

- `F_Combat01` is forced on `FreshFile` by a `routeKeyEquals` force: its
  native `ForceIfEncounterNotCompleted = "FIntroFight"` holds only before that
  encounter's first completion. It resolves `FIntroFight` through a
  first-position contextual encounter rule. Its counted producer declares the
  native `ForcedRewards` Apollo boon under a save-file Apollo use requirement,
  and its `firstRunOffer` names the `ForceLootTableFirstRun` table and
  `ForceCommonLootFirstRun` rarity on that route.
- The G and I combat choices name `FishmanIntro` and `ClockworkIntro` as their
  `FreshFile` first-biome identity (`firstBiomeEncounterDefinitionKeyByRoute`,
  beside I's mature `GeneratedIChronosIntro` default), so the route resolves
  the native `AlwaysForce` intros instead of the Chronos variant that needs
  `ClockworkIntro` completed.
- `H_Bridge01` declares a `FreshFile` route overlay: its native Story reward
  needs lifetime `RoomsEntered.H_Boss01`, so a fresh profile realizes the Shop
  fallback (Shop kind and template, WorldShop binding, `BridgeShop`, no
  lifecycle profile). A Fresh File `H_Bridge01` holds Shop state, and its Story
  state is rejected rather than converted.
- The GiftDrop producer bindings exclude `FreshFile` from their random boon
  level, which needs the `WorldUpgradeGiftDropRunProgress` upgrade.
- `G_Intro`, `H_Intro` and `I_Intro` declare a `FreshFile` `erisHost`: the
  curse trait (`ErisCurseTrait`, rarityless and offered by no giver), the gift
  reward type and its `ErisCursePickup` producer lifecycle. Normalization
  requires an Intro room, a declared route, a rarityless curse, and a
  payload-free gift the producer supports.
- A fresh profile's first entry has no run-start reward.

## F

A brand-new profile starts directly in `F_Opening01` with `OpeningEmpty`, no
reward and no Arcana, keepsake or aspect; the other openings are unreachable.
`F_Combat01` is the forced second room and resolves the fixed four-wave
`FIntroFight`, which does not count encounter depth, so later F encounter
depths are one lower than after `GeneratedF`. Its reward is the native
`ForcedRewards` Apollo boon, offered at room clear from the
`ForceLootTableFirstRun` table (Attack, Sprint and Magick boons) at the
`ForceCommonLootFirstRun` Common rarity
([trait offer audit](../audits/traits/TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md#first-run-forced-loot-table)).

Later F combats may resolve `RadiatorIntro` or `ScreamerIntro` where the
introduction's trigger enemy is admissible: a fixed first wave (Radiator ×5 or
Screamer ×2) and a generated second wave. An uncustomized F combat rolls
natively without the enemies whose introduction would replace it. No field-NPC
combat, cocoon or Nemesis event occurs. Root Stalker is the only miniboss;
Reprieve, Arachne's story room, Chaos, Zagreus Contract, Wells, the Postboss
Pool and keepsake rack are absent, while the Postboss fountain stays. Hecate's
interlude is Meteor Shower only.

## G

The first G combat resolves `FishmanIntro`: native `AlwaysForce` holds until
its first completion, and its three fixed waves (FishmanMelee ×1; ×2 plus
FishmanRanged ×1; ×3 each) neither count encounter depth nor skip. Later
combats may resolve `FishSwarmerIntro` (FishSwarmerSquad ×4, then a generated
wave) or `TurtleIntro` (Turtle ×2, then two generated waves). `TurtleIntro` is
reached only through `Turtle_Elite` at G depth 3 or more, because the ordinary
Turtle needs two lifetime `G_Intro` visits. WaterUnit is admissible only after
a completed `MiniBossWaterUnit` on the route. An uncustomized G combat rolls
natively without the enemies whose introduction would replace it.

`G_Intro` hosts Eris when the author observes her spawn: talking applies
`ErisCurseTrait` and drops a required 20-Ashes gift (see
[Eris at a biome intro](#eris-at-a-biome-intro)). Narcissus's story room, Uh
Oh, Chaos, the Anomaly, Zagreus Contract, Reprieve, field-NPC combats and
cocoons, Wells, the Postboss Pool and keepsake rack are absent; Hellifish and
Serpent remain. Scylla's featured performer is Jetty.

## Eris at a biome intro

Native `SpawnErisForCurse` places Eris in `G_Intro`, `H_Intro` and `I_Intro`
as a room-required object while completed runs are at most 1, 4 and 7, the
hero lacks `ErisCurseTrait`, and `ErisCurseHealthThreshold` (no Death Defiance
and health at most half) is false
([source audit](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md#eris-is-a-required-object-at-a-young-profiles-biome-intro)).
Only Fresh File declares the hosts; mature routes exclude the event.

Health is not simulated, so the spawn is the author's observation, persisted as
the intro's `eris` leaf
([authored model](../design/AUTHORED_PROJECT_MODEL.md#occurrence-state-and-replacement)).
When observed, the talk (`interactEris`) is a required action that applies
`ErisCurseTrait` as a fixed direct trait grant, and her gift is a required
pickup that depends on it. Both rank in the room's standard window before
outgoing generation: exits unlock only after both required objects clear and
`DoUnlockRoomExits` rolls the doors afterwards, so the gift's resources count
toward that batch. The gift's producer is described in the
[Reward Model](../design/REWARD_MODEL.md#generated-pickups); the curse's combat
effect is not modeled.

The curse grant is route trait history. Eris spawns on room entry, so the
observation is Overview content: an intro observed while the curse is already
equipped reports `erisSpawnUnavailable` on that observation at the room's
Overview, and its talk applies nothing and drops no gift; the observation stays
authored for repair. An intro without the observation derives no action and
reports nothing.

## H

`H_Bridge01` keeps its forced window and one-creation limit, but realizes the
`BridgeShop` WorldShop with no Echo action. Choosing another offered door still
consumes the bridge's creation.

A cage may resolve `MournerIntro`, `LamiaIntro`, `LovesickIntro` or
`LycanthropeIntro`, each three fixed waves with no authored composition. Each
requires that it has not occurred this run, and `LycanthropeIntro` also needs
the other three recorded on the route; `MinDepthBeforeIntros` is 0 in H. Cages
are prepared in order before entry, so a later cage sees an earlier cage's
recorded introduction, not its completion: a Mourner in cage 2 stays an
ordinary enemy once cage 1 recorded `MournerIntro`, and a prepared cage never
changes when an earlier cage completes. `GeneratedH_Screamer2` needs
`ScreamerIntro` completed on the route. An uncustomized cage rolls natively
without the enemies whose introduction would replace it at its preparation.

`H_Intro` hosts Eris when observed and not yet cursed on the route; her
required gift is 50 Psyche, which the planner does not track. The Postboss
Pool of Purging spawns but is locked by `BlockedByRequirements`, so the planner
has no Pool there; the Postboss Well and keepsake rack are absent and the
fountain stays.

## I

The route ends through the pre-true-ending `I_PreBoss01` and `BossChronos01`
at zero Fear: two phases and no Rival variant. The first I combat resolves the
fixed three-wave `ClockworkIntro` (native `AlwaysForce` until its first
completion; it counts encounter depth and cannot skip) instead of
`GeneratedIChronosIntro`, which needs `ClockworkIntro` completed, so the
Chronos intro variants never occur on this route. Ordinary I pools carry no
enemy introduction, so every other generated I combat may roll natively.

`I_Intro` hosts Eris when observed and not yet cursed on the route; her
required gift is 300 Bones. `I_WorldShop` keeps five stable slots: its
resource group has no eligible option (no lifetime Moondust, Nightmare or
Charon card gains), so that trailing slot is validly empty and the shop shows
four items
([reward audit](../audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md#empty-groups-and-bounded-unknowns)).
Its Armor, Death Defiance refill, Mystery Boon, Hermes, Hex and Path of Stars
options are unavailable. `I_Story01`, the Reprieve and `I_Combat24` are absent.
