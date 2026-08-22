# Boss Completion Reward Lifecycle Audit

## Status and scope

This is an implementation-free source audit of the interval from a supported
biome Boss's defeat through Judgment, boss-reward creation, encounter-end
effects, and continuation. It asks whether the current planner's effect-neutral
boss reward omission loses any state that the simulator presently owns.

The evidence was checked on 2026-08-21 against the installed Hades II scripts:

- `CombatLogic.lua`, especially the boss-death postboss effects;
- `EncounterSets.lua`, especially `EncounterEventsDefault`;
- `RoomLogic.lua`, especially `StartEncounter`, `EndEncounterEffects`,
  `CheckChamberTraits`, `CheckRoomExitsReady`, and `UnlockRoomExits`;
- `RewardLogic.lua`, especially `ChooseRoomReward` and `SpawnRoomReward`;
- `InteractLogic.lua`, especially `RecordUse` and `UseConsumableItem`;
- `DreamRunLogic.lua`, especially `CheckDreamBiomeCompletion`;
- `TraitData_Hermes.lua`, especially `MoneyMultiplierBoon`;
- `RoomDataAnomaly.lua` and `RoomDataC.lua`; and
- the F/G/H/I/N/O/P/Q boss Room declarations.

The complete Shrine purchase and pending-delivery rules remain owned by
[Shrine of Hermes delivery](HERMES_SHRINE_DELIVERY_GAME_DATA_AUDIT.md).
Judgment's target domain remains owned by
[Arcana and Fear](ARCANA_AND_FEAR_GAME_DATA_AUDIT.md).

## Supported boss order

The normal supported boss path has this fixed source order:

1. The qualifying boss dies.
2. When Judgment is active and
   `CurrentRun.EnteredBiomes < GameData.FullRunBiomeCount`, boss-death handling
   calls `AddRandomMetaUpgrades` (`CombatLogic.lua:3949-3975`). The Arcana state
   changes synchronously; only its presentation is delayed
   (`MetaUpgradeLogic.lua:499-575`).
3. The encounter event list returns from its enemy-death wait, runs
   post-combat audio, and calls `SpawnRoomReward`
   (`EncounterSets.lua:446-452`).
4. `StartEncounter` then marks the encounter complete and runs
   `EndEncounterEffects` (`RoomLogic.lua:1919-1939`).
5. The required-object barrier must clear before normal continuation becomes
   usable (`RoomLogic.lua:3080-3129`).

Judgment is therefore an automatic boss-death effect. Its source guard is
run-relative, not biome-relative. The installed full-run count is four, but the
semantic rule is the entered-biome ordinal compared with the full-run terminal
ordinal. It must not be expressed as a literal I/Q check or as the length of a
temporarily shortened authored prefix.

## Boss reward disposition

Every supported biome boss supplies a forced resource reward through the
ordinary encounter reward-spawn path. The spawned consumable is a required
room object, so it must be collected before ordinary linked continuation.

In a Dream Run, each supported boss's `CanSpawnDreamReward` causes
`ChooseRoomReward` to replace that resource with `DreamPointsDrop`
(`RewardLogic.lua:66-73`). Using the Dream drop records it in the room use
record. Once the room's current required-object barrier is clear,
`UnlockRoomExits` calls `CheckDreamBiomeCompletion`, which enters the next
Dream biome or ends the run (`RoomLogic.lua:3778-3790`,
`DreamRunLogic.lua:63-83`).

Neither the ordinary boss resource nor Dream Points participates in the
current planner's run-state, reward-bag, god-pool, trait, keepsake, Arcana, or
route-eligibility model. The boss pickup is consequently a real game lifecycle
barrier but an effect-neutral derived step for the supported simulator.

## The actual teleport-room pickup edge

The narrow observable edge is not an uncollected pending delivery. It is a
secondary optional pickup created by a newly acquired trait.

Hermes's `MoneyMultiplierBoon` (Quick Buck) is available only when the current
room does not set `BlockGiftBoons`. On acquisition it schedules
`GiveRandomConsumables` after `0.2` seconds and creates a nonrequired
`RoomMoneyDrop` (`TraitData_Hermes.lua:181-201`). `RoomDataAnomaly` and
`RoomDataC` set `BlockGiftBoons = true` specifically to exclude boons that drop
objects. Dream Dive boss rooms do not inherit that broad teleport-room flag.

Therefore a Hermes boon acquired from a boss-room delivery can select Quick
Buck and schedule its optional money pickup. Taking `DreamPointsDrop` may
transfer out of the room before that optional pickup is collected. This is a
real game-level ordering consequence.

Boss declarations also set `SkipTimedDropResourceInDream = true`, but that flag
belongs to the separate `CheckChamberTraits` path for periodic
`RoomsPerUpgrade.DropResources` (`TraitLogic.lua:2871-2893`). It does not turn
Quick Buck's acquisition-time `GiveRandomConsumables` result into a required
pickup.

The planner does not model Quick Buck's money drop, carried money, or any other
post-boss optional object whose loss changes a currently supported simulation
fact. Encoding this edge would therefore add chronology with no downstream
semantic consumer.

## Judgment seam

Judgment mutates the Arcana set during boss death, before reward spawning and
before `EndEncounterEffects` completes. The planner therefore records a fixed
derived `bossDefeated` history event between encounter start and generic
`encounterCompleted`; it applies Judgment at that event and renders the fixed
effect at the matching timeline checkpoint. End encounter remains the later
seam for post-encounter deliveries.

This does not add an authored Room Action, persisted ordering value, or a boss
reward payload. The full-run terminal boss remains excluded by entered-biome
count.

## Planner disposition

The narrow Gate A.1 correction is the derived Boss-defeated Judgment seam. The
planner otherwise retains its effect-neutral boss-reward omission and continues
to omit boss-resource quantities and optional post-boss money pickups. It does
not add a persisted Boss action order, a boss-reward payload, a Dream-specific
continuation command, or a special Quick Buck rule merely to reproduce an
effect that no supported consumer observes.

This disposition must be revisited if Dream Dive becomes an authored run mode,
money becomes simulated state, Quick Buck's dropped pickup enters scope, or
another post-boss pickup gains a modeled effect. At that point the source order
above—not the current grouped presentation—becomes the implementation
authority.
