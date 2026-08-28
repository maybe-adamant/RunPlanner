# Room Action Order Game-Data Audit

## Status and scope

Source audit completed on 2026-08-21 against the installed Hades II scripts,
with the room-action chronology originally checked on 2026-08-18. This document
records the game facts and planner disposition needed to replace
separate encounter-result, Fields-action, and acquisition-order surfaces with
one coherent chronology for an entered room.

The audit covers:

- post-combat room rewards and combat-NPC interactions;
- Gorgon Amulet's Death-Defiance-gated forced Athena encounter;
- Mourning Fields cage completion, cage rewards, optional rewards, and
  Artificer replacements;
- Thessaly ShipCombat wheel selection, repeated combat checkpoints, and
  phase-local reward/NPC settlement;
- Ephyra's persistent Hub, main-room visits, side-room entry, and restore
  boundaries as a control against conflating topology with room chronology;
- boss defeat, Judgment, effect-neutral boss rewards, and continuation;
- required fountains, persistent N Hub fountain state, nonfinal Postboss
  racks, and optional Cleanup contacts;
- the required-object barrier and outgoing-door generation;
- the relationship between action participation, action order, payload
  authorship, and fixed lifecycle checkpoints.

It does not define an authored schema, command vocabulary, React component,
delivery gate, or migration sequence. Those belong to the stable authored-
project, lifecycle, and editor authorities. Feature-specific inventory and
effect facts for Stygian Wells, Shrines of Hermes, and natural resources live in
[Room Features](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md); their supported contacts
enter this chronology at the source-backed checkpoints described below rather
than creating private orders. Unsupported NPC rewards remain out of scope.

## Primary sources

The source evidence comes from:

- `EncounterSets.lua`, especially the Artemis, Athena, Icarus, and Heracles
  combat event sequences;
- `EncounterData_Generated.lua`, `EncounterData_Icarus.lua`, and
  `EncounterData_Heracles.lua`, especially O Intro and ShipCombat setup;
- `EncounterLogic.lua`, especially field-NPC spawning, Athena spawning, and
  `StartFieldsEncounter`;
- `EnemyAILogic.lua`, especially the Artemis, Icarus, and Heracles post-combat
  transitions;
- `NPCData_Artemis.lua`, `NPCData_Athena.lua`, `NPCData_Icarus.lua`, and
  `NPCData_Heracles.lua`;
- `TraitData_Keepsake.lua`, especially `AthenaEncounterKeepsake`;
- `RoomLogic.lua`, especially `SpawnRewardCages`, `CheckRoomExitsReady`,
  `UnlockRoomExits`, `DoUnlockRoomExits`, `ShipsEncounterSetup`,
  `WaitForNextEncounterReady`, and persistent-room restoration;
- `RoomDataO.lua`, `RoomDataN.lua`, and `ObstacleDataN.lua`, especially O's
  multiple-encounter envelope and N's persistent Hub/side-room declarations;
- `RewardLogic.lua` and `InteractLogic.lua`, especially room-reward creation,
  `UseLoot`, `UseConsumableItem`, and `UseNPCPostTextLines`;
- `GiftLogic.lua`, especially the Artificer conversion path and
  `CanReceiveGift`;
- `ObstacleDataH.lua`, especially `FieldsRewardCage`;
- `CombatLogic.lua`, `EncounterSets.lua`, `DreamRunLogic.lua`, and
  `TraitData_Hermes.lua`, for boss completion, Judgment, effect-neutral boss
  rewards, and Quick Buck's optional post-acquisition drop;
- `EncounterData_Unique.lua`, `ObstacleData*.lua`, `InteractLogic.lua`,
  `KeepsakeLogic.lua`, `EventLogic.lua`, and the F/G/H/I/N/O/P/Q room
  declarations, for fountains, Postboss racks, persistent Hub state, and
  Cleanup contacts.

The exact Fields reward/store and Artificer matrices remain owned by
`../rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md`. Producer-versus-
pickup identity and multi-checkpoint acquisition facts remain owned by
`../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`. This audit owns the additional
cross-producer conclusion that those interactions need one room chronology,
including the boss and Postboss/fountain checkpoints. Feature-specific Well,
Shrine, and resource matrices remain owned by
`../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md`.

## Terms

**Room action**
: One player-significant transition inside an entered room. Examples include
completing a combat barrier, interacting with a combat NPC, acquiring or
transforming a concrete reward, and acquiring an Artificer replacement.
The action references its existing semantic owner; it does not copy the
reward, trait offer, or encounter payload into a generic action model.

**Room action roster**
: The declaration- and state-derived set of actions that physically exist in
one entered room. Structural actions are mandatory. Optional world objects
may be available without participating. Dormant or ungenerated objects are
not active roster members.

**Room action chronology**
: The authored order of participating room actions, constrained by declared
dependencies and fixed lifecycle checkpoints. It is one chronology for the
room, not one order per producer family.

**Barrier action**
: A declaration-owned transition that makes later actions possible. Ordinary
combat completion and each Fields cage completion are barriers. A barrier is
not an acquired item and does not own reward or trait payload.

**Source interaction**
: An interaction with the original world object. Normal reward interaction
acquires it. Time Piece destroys it for Gold. Artificer destroys it and
creates a replacement. These outcomes cannot be inferred from the later
replacement pickup.

**Interaction intent**
: The mutually exclusive way the player intends to resolve one concrete source:
normal pickup, Time Piece conversion, or Artificer transformation. It chooses
the source transition only. It does not own the payload or acquisition detail
of a dependent object produced by that transition.

**Dependent action**
: An action that exists only after an earlier action produces it. Picking up
an Artificer replacement depends on transforming its exact source, but it is
a distinct later action.

**Lifecycle checkpoint**
: A nonauthorable semantic boundary such as outgoing-door generation. One
room chronology may span several checkpoints, but it must not make actions
freely reorderable across a boundary the game fixes.

## Verified game facts

### Encounter completion does not acquire a combat-NPC trait

The combat event sets for Artemis, Athena, Icarus, and Heracles run combat,
wait for all enemies to die, perform post-combat work, and spawn the ordinary
room reward. The NPC is a separate world object.

Artemis and Icarus are spawned unusable and explicitly added to
`MapState.RoomRequiredObjects`. Their post-combat AI transitions move them to a
loot point and call `UseableOn`. Their trait menu runs only when the player
later interacts with that object. Athena uses the same `UseLoot` boundary.
Heracles likewise remains a required post-combat interaction under his combat
variant, although his exact reward effects are source-specific.

Therefore encounter completion and NPC interaction are distinct events. The
selected trait is not automatically acquired at `encounterCompleted`.

### The ordinary room reward and combat NPC are parallel required objects

`SpawnRoomReward` creates the room reward after combat. Without
`NotRequiredPickup`, the resulting loot or consumable is a room-required
object. The combat NPC is independently room-required.

`UseLoot`, `UseConsumableItem`, and the NPC post-interaction path remove only
their own object and then ask `CheckRoomExitsReady` whether the room may
advance. That check requires both:

- no remaining room-required object; and
- every required encounter to be complete.

The scripts do not declare NPC-before-reward or reward-before-NPC ordering.
After combat, the player may interact with either first. The first result is
part of the history used to validate and resolve the second result.

A supported ordinary room can therefore have this shape:

```text
complete combat
  -> interact with Icarus
  -> interact with room reward
```

or:

```text
complete combat
  -> interact with room reward
  -> interact with Icarus
```

This is consequential whenever one acquisition changes the eligibility,
target domain, rarity, or effect of the other. The planner cannot settle the
NPC trait implicitly at encounter completion and still represent both paths.

### Outgoing generation observes the last required interaction

Each completed interaction checks the required-object barrier. The interaction
that clears the final required object calls `UnlockRoomExits`, which calls
`DoUnlockRoomExits`. That function creates the outgoing target rooms and
resolves their reward offers.

Consequently, every required room action precedes outgoing generation. Its
result may affect the outgoing batch. An optional interaction performed before
the final required action can also affect that batch. An optional interaction
performed after exits have unlocked cannot retroactively change it.

This is a fixed lifecycle rule, not a free user-authored action. A general room
chronology must preserve the exact generation boundary. It may present one
coherent room sequence, but it must not flatten every room action into one
unqualified pre-outgoing fold.

### Gorgon Amulet creates a Death-Defiance-gated forced encounter contact

`AthenaEncounterKeepsake` installs `HandleAthenaSpawn` on the qualifying
encounter. The function waits for the encounter's spawn sequence, consumes the
keepsake use, and creates Athena. Athena is a required room object and her
trait is selected through `AthenaUse`/`UseLoot`; merely spawning her does not
acquire the trait.

This is best modeled as a forced encounter contact, not as an ordinary trait
result of the hosted encounter. The effect is additive: it does not replace the
selected generated encounter with the selectable P `AthenaCombat` identity.
The exact hosted phase remains present, while Gorgon forces one additional
Athena appearance when all of these are true:

- the room and hosted encounter permit Gorgon;
- the hosted encounter is not skipped;
- the frontier is deep enough;
- Gorgon remains pending; and
- the source-local condition says the player has no remaining Death Defiance.

When the Death Defiance condition is false, no Athena contact is produced and
the pending keepsake use can advance to a later eligible encounter. When it is
true, the forced contact consumes the use and later requires the Athena
interaction. The condition belongs to this forced encounter activation; it is
not a property of the selected Athena trait.

Ordinary enemies inherit `BlocksLootInteraction = true`, so Athena's loot
interaction cannot complete while a blocking combat enemy remains. In Fields,
Athena additionally declares `BlockFieldsEncounterStart = true`, and
`StartFieldsEncounter` refuses to activate another cage while such a required
object remains.

The resulting dependencies are exact:

- Athena interaction follows the qualifying encounter phase;
- it may interleave with other unlocked post-phase rewards;
- in Fields it must precede the start/completion of a later cage; and
- it remains a separate action from both the phase completion and any room
  reward.

The forced contact belongs to the exact hosted phase, and its later interaction
inherits that provenance. A Gorgon activation on Fields `Passive` is therefore
not interchangeable with one produced by `Cage01` or `Cage02`.

For authoring, the hosted encounter and the forced effective contact are two
different facts. The hosted encounter remains exact simulation provenance.
When the Gorgon condition is satisfied at an eligible phase, the effective
encounter domain is forced to the Gorgon Athena contact; ordinary encounter
candidates are no longer valid alternatives for that phase. When the condition
is false, Athena is unavailable and the ordinary hosted encounter domain
remains. This forced Gorgon contact is distinct from the ordinary selectable P
Athena encounter.

### Fields creates one physical room with several interleavable actions

`SpawnRewardCages` creates every cage and its already-selected reward on room
entry. Cage rewards begin unusable. The same setup pass independently realizes
and creates all optional rewards with `NotRequiredPickup = true`.

Only one incomplete Fields encounter may be active. Activating a cage starts
its exact encounter. When that encounter completes, the cage is destroyed and
its reward becomes usable. Between active combats, the player may:

- activate another eligible cage;
- acquire an already-unlocked cage reward;
- acquire or transform a realized optional reward;
- acquire an earlier Artificer replacement; or
- interact with a phase-produced required NPC such as Athena, subject to its
  exact dependencies.

The source does not define a cage-only chronology, an optional-only
chronology, and an NPC chronology. Those are interactions in the same room.

The physical structure is nevertheless fixed. After room entry, the player
chooses one unresolved cage, runs that encounter to completion, chooses another
unresolved cage, and repeats until the active cage count is exhausted. Cage
identity order is fluid; the sequence of Start/End encounter pairs is not. A
cage reward may remain unpicked across a later cage start because
`StartFieldsEncounter` blocks only an incomplete required encounter or an
object with `BlockFieldsEncounterStart`. Ordinary cage rewards have no such
flag; Athena does.

The planner simplification that a cage encounter is one atomic barrier remains
source-compatible. The product need not model reward interaction during an
active wave so long as it represents every legal room-entry, between-wave, and
post-wave order. Dependencies between cycles must follow the authored cage
order rather than the declaration's cage-slot order.

### Artificer transformation and replacement pickup are different actions

On an eligible source object, Artificer immediately:

1. disables and marks the source ineligible;
2. consumes one Artificer use;
3. selects and consumes a `RunProgress` result from the current bag;
4. transfers required-object status when the source was required;
5. spawns the replacement at the source position; and
6. destroys the source.

The original source is never acquired. The new object is not automatically
acquired. Its reward history, trait offer, or Pom effect occurs only at its
later interaction.

Artificer legality and replacement generation therefore observe the history
at the source-interaction row. Replacement acquisition observes the later
history at its own row. One combined “converted and acquired” edit loses the
source timing.

This distinction proves the multiple-Hammer Fields sequence already recorded
in the Fields audit. With one acquired Hammer, three Artificer uses, three
eligible optionals, and sufficient late-Hammer bag entries, the player can:

```text
transform optional 1 -> Hammer A
transform optional 2 -> Hammer B
transform optional 3 -> Hammer C
...then acquire the cage Hammer and/or A, B, and C
```

Acquiring a Hammer before later transformations can make those later Hammer
outputs ineligible. The order of source transformations is therefore semantic
even before any replacement is picked up.

### O creates repeated action windows inside one physical room

An O ShipCombat room resolves one ordered multiple-encounter envelope before
execution. Its ordinary form contains:

1. an Intro phase;
2. Combat 1 with `wheel1`; and
3. when the declaration-owned third phase is active, Combat 2 with `wheel2`.

The generated Intro has `SkipShipsEncounterSetup = true`, so it creates no
wheel choice. Heracles O is likewise an Intro-family replacement with skipped
wheel setup. Ordinary and Icarus Combat phases run `ShipsEncounterSetup`.

For each wheel-bearing phase, the game first creates the wheel offer objects
and waits for `ShipsEncounterSelected`. `UseShipWheel` fixes the selected
reward/store on that exact encounter. Only then do encounter-start effects and
combat proceed. After combat, `SpawnRoomReward` creates the selected concrete
reward. The reward is not acquired by choosing the wheel.

Every wheel-bearing combat ends with `WaitForNextEncounterReady`. That wait
does not return while any room-required object or reward/dialog choice screen
remains. Consequently, the next combat phase cannot begin until the current
phase's required reward and required NPC interactions have resolved. Icarus's
ShipCombat sequence uses this same wait after spawning both its post-combat
interaction and the selected wheel reward.

O therefore has one physical room chronology partitioned into repeated fixed
phase windows:

```text
finish Intro
choose Wheel 1 reward
complete Combat 1
resolve Combat 1 reward/NPC actions in a legal order
cross the required-object barrier
choose Wheel 2 reward, when active
complete Combat 2
resolve Combat 2 reward/NPC actions in a legal order
cross the final required-object barrier
generate outgoing room
```

Wheel selection and later reward interaction are separate actions with a fixed
combat barrier between them. Within a post-combat window, the selected wheel
reward, Icarus interaction, Artificer source transformation/replacement, and
any other supported phase-produced object may interleave when their individual
dependencies allow it. They cannot be moved into the prior or next phase.

This makes O the repeated-checkpoint stress case for a general room chronology.
The model must support several fixed combat/checkpoint partitions inside one
entered room without falling back to one order per wheel or encounter.

### N is a topology boundary, not a multi-encounter room

N's apparent complexity comes from traversal across distinct room occurrences.
`N_Hub` is a persistent no-reward Hub whose board and door state are restored
after visits. Each selected main target is a separate entered room occurrence.
Its generated side rooms are also separate entered occurrences, and their
return doors restore the parent room from history.

`PersistentRoomForDoors` preserves the board/parent door state. A returning
door shallow-copies the earlier room and restores declaration fields; it does
not turn the child encounter into another phase of the parent room. N side
rooms also declare `IgnoreEncounterUses`, which affects qualifying
encounter-use counters but does not merge their local combat, reward, or
interaction lifecycle with the parent.

The authored Hub visit list therefore remains topology/traversal order:

```text
Hub -> enter main occurrence A -> enter side occurrence A1 -> restore A
    -> restore Hub -> enter main occurrence B
```

Each entered occurrence in that path owns its own room-action chronology. A
main room with Artemis and a room reward needs the ordinary post-combat ordering
described above. A side-room Shop or reward belongs to the side occurrence.
Returning to the parent or Hub must not replay already-completed parent actions.

There must not be one Hub-wide room-action chronology containing six main
visits and all side rooms. N is the control case proving that room chronology
is scoped by entered occurrence identity, while Hub visit order and side-room
entry order remain their existing topology authorities.

The three representative biome shapes are therefore:

| Biome | Chronology scope                    | Fixed boundaries                                                            | Freely ordered region                                                        | Boundary the model must preserve                                                       |
| ----- | ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| H     | one entered Fields room             | Passive entry plus an ordinal Start/End pair for each active chosen cage    | unlocked cage rewards, optionals, NPCs, source transformations, replacements | no interaction during a modeled wave; blocking contacts precede the next authored cage |
| O     | one entered ShipCombat room         | Intro, wheel choice, matching combat, required-object wait, then next phase | objects produced by the same completed phase                                 | no action crosses into an earlier/later ShipCombat window                              |
| N     | one entered main or side occurrence | that occurrence's own lifecycle                                             | its local reward/NPC/acquisition actions                                     | Hub visits, side entry, and restoration remain topology between chronologies           |

### Boss completion, Judgment, and effect-neutral rewards

The evidence was checked on 2026-08-21 against `CombatLogic.lua:3949-3975`
boss-death postboss effects and `MetaUpgradeLogic.lua:499-575`;
`EncounterSets.lua:446-452` and
`RoomLogic.lua:1919-1939, 3080-3129, 3778-3790` for encounter completion,
required-object barriers, and Dream continuation; `RewardLogic.lua:66-73` for
Dream reward selection; `InteractLogic.lua` for pickup use;
`DreamRunLogic.lua:63-83`; `TraitData_Hermes.lua:181-201` for Quick Buck;
`TraitLogic.lua:2871-2893` for the separate timed-resource path;
`RoomDataAnomaly.lua`, `RoomDataC.lua`, and the F/G/H/I/N/O/P/Q boss
declarations. The exact Judgment target domain
remains owned by [Arcana and Fear](../loadout-and-progression/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md), and
Shrine delivery remains owned by [Room Features](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md)
and [Acquisition Delivery and Room Settlement](../rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md).

The supported boss interval is:

1. the qualifying Boss dies;
2. while Judgment is active and `CurrentRun.EnteredBiomes <
GameData.FullRunBiomeCount`, boss-death handling calls
   `AddRandomMetaUpgrades`; the Arcana state changes synchronously and only
   presentation is delayed;
3. the encounter event list returns from its enemy-death wait, performs
   post-combat work, and calls `SpawnRoomReward`; and
4. `StartEncounter` marks the encounter complete and runs
   `EndEncounterEffects`, after which the required-object barrier must clear
   before continuation.

Judgment is therefore a boss-death effect guarded by the entered-biome ordinal
against the full-run terminal ordinal. It is not an I/Q special case and does
not use the length of a temporarily shortened authored prefix.

Every supported biome boss spawns a forced resource reward through the
ordinary encounter path. In a Dream Run, `CanSpawnDreamReward` replaces that
resource with `DreamPointsDrop`; collecting it records room use and, after the
required-object barrier clears, `UnlockRoomExits` calls
`CheckDreamBiomeCompletion` to enter the next Dream biome or end the run. Both
ordinary boss resources and Dream Points are real required pickups, but they
are effect-neutral to the current planner: they do not enter run state,
reward bags, god pools, trait, keepsake, Arcana, or route eligibility.

One source edge is worth retaining because it explains the boundary without
adding a special rule. Hermes's `MoneyMultiplierBoon` (Quick Buck), when
acquired in a room without `BlockGiftBoons`, schedules `GiveRandomConsumables`
and creates a nonrequired `RoomMoneyDrop`. `RoomDataAnomaly` and `RoomDataC`
set `BlockGiftBoons = true`, while Dream Dive boss rooms do not inherit that
broad flag. A Boss-room delivery can therefore create an optional money drop
that is lost if `DreamPointsDrop` transfers the player before collection.
Bosses also set `SkipTimedDropResourceInDream`, but that only affects the
separate periodic `RoomsPerUpgrade.DropResources` path; it does not make
Quick Buck's drop required. Money and this optional pickup remain outside the
supported simulation.

Schema 68 represents the selected completion chain as ordinary topology
occurrences connected by fixed links. Boss and the route-position Postboss
retain the normal occurrence lifecycle, fixed exits, room features, and one
room-action chronology. The `bossDefeated` Judgment seam precedes generic
encounter-end effects, so a due Shrine delivery can use the ordinary Boss
occurrence as a later host. Boss reward quantities, Dream continuation
commands, and special Quick Buck rules remain unmodeled because no supported
consumer observes them.

### Fountains, persistent Hub state, and Postboss Cleanup

The evidence was checked on 2026-08-21 against
`EncounterData_Unique.lua` (`HealthRestore`), `ObstacleData.lua`,
`ObstacleDataN.lua`, and biome obstacle files for `HealthFountain`,
`HealthFountainN`, `GiftRack`, `WellShop`, and `SurfaceShop`;
`InteractLogic.lua:UseHealthFountain`; `KeepsakeLogic.lua:UseKeepsakeRack`;
`RoomLogic.lua:CreateLoot, CheckRoomExitsReady, DoUnlockRoomExits`;
`EventLogic.lua:HealthFountainNExitCheck,
HealthFountainNRestoreState`; and F/G/H/I/N/O/P/Q room declarations.
Feature-specific Well/Shrine inventory and eligibility facts are retained in
[Room Features](../room-features/ROOM_FEATURES_GAME_DATA_AUDIT.md).

`HealthFountain` declares `BlockExitUntilUsed = true`. Room setup registers it
in `MapState.RoomRequiredObjects`; `UseHealthFountain` disables it, removes it
from that barrier, applies fountain-owned trait effects, heals Melinoe, and
asks `CheckRoomExitsReady` to unlock exits. An active Aromatic Phial
(`FountainRarityKeepsake`) can consume a remaining use and raise an eligible
trait's rarity at this exact interaction. Fountain-refresh and
fountain-damage traits also run here. Fountain use is thus a required room
interaction, not a decorative completion marker.

Ordinary Reprieve declarations expose this common required-object shape. F/G/I
inherit a Well chance, but their installed Reprieve maps have no
`ChallengeSwitchBase`, so no Well is physically realized there. O/P Reprieves
have Shrine anchors and their declaration-owned Shrine chance is `1.0`:

| Route | Room           | Encounter       | Required incoming reward | Cleanup contact              |
| ----- | -------------- | --------------- | ------------------------ | ---------------------------- |
| F     | `F_Reprieve01` | `HealthRestore` | yes                      | no realized Well (no anchor) |
| G     | `G_Reprieve01` | `HealthRestore` | yes                      | no realized Well (no anchor) |
| I     | `I_Reprieve01` | `HealthRestore` | yes                      | no realized Well (no anchor) |
| O     | `O_Reprieve01` | `HealthRestore` | yes                      | Shrine anchor, chance 1.0    |
| P     | `P_Reprieve01` | `HealthRestore` | yes                      | Shrine anchor, chance 1.0    |

The fountain and incoming reward are parallel required objects; neither is
source-ordered before the other. Both must resolve before Cleanup and outgoing
doors. `H_Bridge01` has a start hook for `HealthFountainH`, but the planner's
modeled Echo Bridge realization does not expose a fountain and is not part of
this required-fountain set.

`HealthFountainN` normally sets `BlockExitUntilUsed = false` because the
Ephyra Hub persists across visits. Once the sixth Soul Pylon is present,
`HealthFountainNExitCheck` makes an unused fountain required at the completed
Hub-exit frontier, and `HealthFountainNRestoreState` preserves its used state
on restoration. It may be used on an earlier visit, becomes mandatory only at
the completed-Hub boundary, and must not replay after a side-room return. N
Hub is therefore not an ordinary one-visit fountain chronology.

The nonfinal Postboss interaction set is:

| Route | Room           | Required fountain                            | Optional rack | Door-open-only contact |
| ----- | -------------- | -------------------------------------------- | ------------- | ---------------------- |
| F     | `F_PostBoss01` | `HealthFountainF`                            | `GiftRack`    | forced Well            |
| G     | `G_PostBoss01` | `HealthFountainG`                            | `GiftRack`    | forced Well            |
| H     | `H_PostBoss01` | `HealthFountain`                             | `GiftRack`    | forced Well            |
| N     | `N_PostBoss01` | `HealthFountainN` (explicitly blocking here) | `GiftRack`    | forced Shrine          |
| O     | `O_PostBoss01` | `HealthFountainO`                            | `GiftRack`    | forced Shrine          |
| P     | `P_PostBoss01` | `HealthFountainP`                            | `GiftRack`    | forced Shrine          |

“Forced” describes a room declaration's feature spawn policy once the
corresponding upgrade is available; it does not make the feature inventory a
second source. In the source, the true terminal condition is
`GameData.FullRunBiomeCount`: the full-run terminal biome has no succeeding-
biome keepsake frontier and does not inherit the ordinary fountain/rack set
merely because its declaration kind is `PostBoss`. In the current four-biome
routes, final biome endings contain neither the ordinary fountain nor the
ordinary Postboss rack. The schema-68 planner preserves that terminal behavior
by modeling only the first three route-position Postboss occurrences; their
declared features remain active, while the physical I/Q ending rooms remain
outside supported topology.
`F_PostBoss01` uses `Story_Chronos_01`; this does not classify its optional
Chronos presentation as a required interaction.

The rack is optional and independent of exit readiness. It can retain the
current keepsake or replace it once. There is no source barrier ordering rack
and fountain: replacing before the fountain changes what Aromatic Phial sees,
while replacing after the fountain cannot affect that already-resolved use.
After the required fountain resolves, the Cleanup boundary opens exits and
optional Well/Shrine contacts can be ordered before the selected exit. A
truthful nonfinal Postboss sequence is therefore:

```text
enter with Boss keepsake
  -> optional keepsake replacement on either side of fountain use
  -> use the required fountain
  -> Cleanup · Doors open
  -> optional Well or Shrine contact
  -> enter the selected next biome
```

The exact chronology and required-object barrier are one room-action owner;
feature-specific purchase and delivery behavior remains in the room-features
and acquisition authorities.

Schema 68 carries this source order through one occurrence-owned
`roomActions.order`: ordinary Reprieves carry required reward and
`useFountain`, while reached Postboss occurrences carry required `useFountain`
and an optional `interactKeepsakeRack` when replacement is selected. The rack
may rank before or after the fountain. Route-position Postboss features stay
active wherever the route supplies a Postboss, and H
Echo Bridge plus persistent N Hub remain outside the ordinary one-visit
fountain set.

### Participation, payload, and order are independent

The game separately answers:

- whether an optional object is interacted with;
- what concrete object exists;
- whether the interaction acquires, removes, or transforms that source;
- what dependent object a transformation creates; and
- when each participating interaction occurs.

An optional reward can have a fully known identity while remaining untouched.
An Artificer replacement can have a fully authored trait offer while its pickup
occurs later. Adding or removing an optional participant does not require the
current chronology to be executable; only evaluation of a proposed order
depends on the ordered prefix.

This is the same invariant already established for Shops, Narcissus, and
Fields acquisitions. It applies to the broader room action roster, not only to
items currently rendered under Acquisitions.

## Planner disposition

### Completion-room topology

The first three positions of each standard route use the ordinary
biome-position Postboss occurrence after the selected Boss. These are regular
occurrences in the supported topology, with the same room-action chronology
and occurrence-owned features as other rooms. The fourth position has no
modeled recovery Postboss: the physical `I_PostBoss01` and `Q_PostBoss01`
rooms are terminal narrative/meta-progression endings outside the supported
planner topology. The planner therefore keeps the selected `I_Boss01` or
`Q_Boss01` occurrence and ends the modeled route there.

Dream runs are a separate future route input. Their Postboss identity follows
the entered-biome ordinal (`Dream_PostBoss01`, `Dream_PostBoss02`, then
`Dream_PostBoss03`), not the biome key that was just completed. The normalized
route-position table is the intended owner of this mapping when Dream runs are
added; no room-name or completion-tail special case is needed in room-action
simulation.

### One general chronology for every entered room

Every entered room projects one room-action chronology, including a room with
only one action. The roster is derived from its declaration, resolved encounter
envelope, produced objects, and retained authored participation. Unentered
targets, dormant phases, and ungenerated children publish no active actions.

The chronology absorbs the ordering responsibility previously split between
Fields `actionOrder` and acquisition-site `order`. It does not retain either as
a parallel semantic order.

This does not turn the whole `RoomLifecycleProfile` into authored state. The
catalog still declares preparation, entry, combat barriers, outgoing
generation, commit, and exit. Authored state records only participation and
relative chronology for the declaration-derived room actions whose order the
player can affect.

The same owner union covers fixed-linked Postboss occurrences. A reached Postboss
receives required `useFountain` and, when replacement is selected, optional
`interactKeepsakeRack` under its exact ordinary occurrence action address. Its
roster uses the shared lifecycle structure, ordering assessment, repair rows,
and event fold; it does not create a second completion order. Route-position
Postboss features remain active, while H Echo Bridge and the persistent N Hub
remain outside this one-visit Postboss rule.

### Actions reference existing owners

The general chronology is not a generic effect language. Each row references
an existing semantic owner and invokes that owner's existing transition:

- encounter completion remains encounter/lifecycle authority;
- Gorgon's forced Athena encounter remains keepsake/encounter authority;
- a room reward remains reward-producer authority;
- an NPC trait remains encounter-trait authority;
- an acquisition entry retains its reward, trait, Pom, and disposition owner;
- Artificer source generation remains reward/Artificer authority; and
- an Artificer replacement remains a separate generated acquisition owner.

The room chronology owns only participation, dependency, and order. It must not
copy reward legality, trait composition, Artificer bag policy, or encounter
effects.

### Source intent and produced-object authorship stay separate

Normal pickup, Time Piece, and Artificer remain mutually exclusive outcomes of
one source interaction. The source action owns that intent, while a generated
Artificer replacement keeps its separate source-derived owner; the replacement
reward is not nested inside the source disposition.

For a normal pickup, the source action is also the concrete acquisition action
and owns its trait/Pom detail. Time Piece destroys the source and produces Gold
at that row, with no dependent pickup. Artificer destroys the source and
materializes a replacement; the replacement has a stable source-derived owner
and joins the chronology as a later dependent pickup. Its reward identity and
acquisition children may be retained while dormant, but they are not source
payload.

### Fixed barriers and generated dependencies remain explicit

The roster distinguishes fixed barriers from player interactions. An ordinary
room's combat completion precedes both its room reward and combat-NPC action.
Each Fields cage reward follows its matching cage completion. The Gorgon forced
contact follows its hosted phase, and its required Athena interaction blocks
the next Fields cage. An Artificer replacement follows its exact source
transformation.

Outgoing generation remains a lifecycle-owned checkpoint. The simulator
derives when the required-object barrier clears from the ordered prefix and
freezes the outgoing batch there. Optional actions before that boundary affect
the batch; later ones do not. The user does not add, remove, or arbitrarily
move the checkpoint.

O adds repeated fixed barriers to this rule. Wheel selection precedes its
matching combat; the resulting reward and phase NPC follow combat; every
required object must clear before the next phase begins. N adds the inverse
boundary: moving from Hub to a main room or from a main room to a side room is
topology between occurrence-local chronologies, not an authorable row within
one chronology.

### Participation does not depend on order validity

Mandatory actions must participate. Optional actions may be inserted or
removed independently of the current order's contextual validity. Reordering
evaluates the exact proposed prefix. A missing or invalid action blocks at that
row without erasing later retained authorship or hiding repair controls.

Generated dependent actions retain source identity even while dormant. They
join the active roster only when the earlier action actually produces them.

The planner now makes mandatory participation the default of the same semantic
command that structurally activates the action. One engine-owned scheduler
extends the occurrence's existing order at the latest source-compatible
lifecycle position; it does not infer required status in React or create a
parallel mandatory order. This command guarantee does not rewrite source
evidence or make missing-required documents malformed: an older or deliberately
incomplete authored document retains its omission and one explicit canonical
repair, while an unrelated edit leaves that repair state unchanged. The same
retained-invalid rule applies to the fixed Postboss occurrence owner.

### Authoring remains attached to the action's semantic owner

Acquisition-time authoring belongs to the action that executes it:

- a combat-NPC interaction owns its trait offer;
- a normal reward interaction owns its acquisition trait or Pom detail;
- a source interaction owns its normal, Time Piece, or Artificer disposition;
- an Artificer replacement owns its replacement reward/acquisition detail; and
- a fixed barrier owns no reward or trait payload.

Encounter identity and room reward identity remain on their structural source
owners. Associating acquisition-time authoring with the executing action does
not move topology or offer generation into the chronology. Exact editor layout
and interaction design belong to the structured workspace and editor ownership
authorities.

## Required modeling examples

### Ordinary combat NPC

```text
Complete combat
Interact with room reward
Interact with Icarus
```

and the reverse order of the last two actions are both structurally legal.
Each second interaction sees the first interaction's state.

### Fields without a phase-produced blocker

```text
Transform Optional 1 with Artificer
Transform Optional 2 with Artificer
Start and complete Cage 1 atomically
Interact with Cage 1 reward
Pick up Optional 1 replacement
Start and complete Cage 2 atomically
Interact with Cage 2 reward
Pick up Optional 2 replacement
```

The exact order remains constrained by live reward and bag eligibility; the
structure alone does not assert every authored payload is valid.

### Fields with a Gorgon forced encounter

```text
Start and complete the chosen cage that produces Athena
Interact with an already-unlocked reward or optional
Interact with Athena
Start and complete the next chosen cage
```

Athena may move relative to other already-available interactions, but not
before her producing phase or after the next cage begins.

### Several Artificer sources before pickups

```text
Transform source A
Transform source B
Transform source C
Pick up replacement A
Pick up replacement B
Pick up replacement C
```

Every transformation consumes a charge and the current `RunProgress` bag at
its own row. None reads Hammer/boon history from a replacement that has not yet
been acquired.

The first three rows execute the source intents and activate three produced-
object owners. Those owners carry the materialized reward identities; the last
three pickup rows own the corresponding trait, Pom, or other acquisition-time
resolutions. Editing one replacement does not rewrite the source action that
created its owner.

### O with two wheel-bearing combats

```text
Complete Intro
Choose Wheel 1 offer
Complete Combat 1
Transform Wheel 1 reward with Artificer
Interact with Icarus
Pick up Wheel 1 replacement
Choose Wheel 2 offer
Complete Combat 2
Interact with Wheel 2 reward
```

The exact post-Combat-1 order is context-dependent, but all of its required
objects must settle before Wheel 2/Combat 2 can begin. Wheel 2 actions cannot
be pulled into the first action window.

### N main and side occurrences

```text
Hub visit order selects Main A
  Main A room order: complete combat -> interact with reward -> interact with Artemis
Side-entry order selects Side A1
  Side A1 room order: complete local encounter -> interact with local reward
restore Main A
restore Hub
Hub visit order selects Main B
```

The indentation represents occurrence ownership, not nested rows in one room
order. Restoring Main A or the Hub does not repeat their settled actions.

## Ownership consequences of the completed model

| Concern                                                                | Authority                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| Which actions a room/phase can physically expose                       | catalog room, encounter, reward, and lifecycle declarations |
| Persisted participation and chronology                                 | authored occurrence state                                   |
| Dependency and proposed-order validity                                 | planner engine                                              |
| Sequential history, required-object barrier, and outgoing checkpoint   | room lifecycle simulation                                   |
| Reward, trait, Pom, Time Piece, Artificer, and forced Gorgon semantics | their existing engine owners                                |
| Row labels, ranked interaction, dialogs, focus, and navigation         | planner application and React                               |

The completed model must not preserve the superseded private ordering paths
behind a third coordinator or translate between several simultaneous orders.

## Explicit simplifications and exclusions

- The planner may keep one active combat wave atomic. It need not model pathing,
  elapsed time, or interaction during a wave.
- Physical Fields map positions and travel distance remain unmodeled.
- O's active encounter prefix remains declaration/topology output. The player
  orders supported actions inside its fixed phase windows; the chronology does
  not invent, remove, or reorder combat phases.
- N Hub visit order, side-room generation/entry order, and restore behavior
  remain topology. They are not competing room-action orders because they rank
  different entered occurrences rather than actions inside one occurrence.
- The audit does not claim that every action can cross every fixed lifecycle
  checkpoint. Dependency and checkpoint constraints are part of the room
  chronology.
- Optional post-outgoing interaction is source-real and must not be silently
  treated as pre-outgoing when its modeled effect can influence later state.
- Story, Shop, delayed-delivery, Well, and resource actions retain their
  source-backed checkpoint distinctions. “One room chronology” does not mean
  “one universal end-of-room settlement point.”
- Effect-neutral NPC rewards and other unsupported world objects need not be
  restored merely to make the roster exhaustive. The roster is complete for
  the planner's supported consequential interactions.

## Audit conclusion

The source supports one general room-action chronology, not automatic NPC
settlement plus separate Fields and Acquisitions orders. Combat completion,
source transformation, concrete pickup, and outgoing generation are distinct
events. A correct planner must fold them in source order, preserve fixed
dependencies, and let every action observe the history produced by earlier
actions.

The planner now implements this disposition through one occurrence/completion-
owned `roomActions.order`, one engine structural action domain/default
scheduler, one roster, and one lifecycle timeline. Semantic commands close only the newly
required membership delta before publishing a decoded document; simulation
consumes the same structural contributions. Active required rows are move-only,
while explicit malformed omissions remain repairable and optional Shop,
Fields-minor, Narcissus, Travel, Gold, Contract, and optional Artificer
participation retain their prior owners.
Ordinary combat-NPC, Gorgon Fields, optional participation, multiple-Artificer,
O repeated-checkpoint, and N occurrence-boundary chronologies remain the
representative witnesses. H tests broad interleaving among already-present
objects and sequential cage barriers; O tests repeated pre-combat choices and
required post-combat windows; N proves that traversal is not flattened into
room-local ordering. The stable audit remains the source authority rather than
an open implementation checklist.
