# Fountain and Postboss Interaction Lifecycle Audit

## Status and scope

This is an implementation-free source audit for health fountains in ordinary
Reprieve rooms, the Ephyra Hub, and nonfinal Postboss rooms. It records which
interactions are required, when exits become usable, and how fountain use can
be ordered against reward pickup, keepsake replacement, Wells of Charon, and
Shrines of Hermes.

It does not define planner state, commands, UI, delivery gates, or an
implementation sequence. The focused keepsake, Well, and Shrine audits remain
the authorities for their complete inventories and effects.

The evidence was checked on 2026-08-21 against the installed Hades II scripts.
Primary sources are:

- `EncounterData_Unique.lua`, especially `HealthRestore`;
- `ObstacleData.lua`, `ObstacleDataN.lua`, and the biome obstacle files,
  especially `HealthFountain`, `HealthFountainN`, `GiftRack`, `WellShop`, and
  `SurfaceShop`;
- `InteractLogic.lua`, especially `UseHealthFountain`;
- `KeepsakeLogic.lua`, especially `UseKeepsakeRack`;
- `RoomLogic.lua`, especially `CreateLoot`, `CheckRoomExitsReady`,
  `DoUnlockRoomExits`, and the Well/Shrine setup paths;
- `EventLogic.lua`, especially `HealthFountainNExitCheck` and
  `HealthFountainNRestoreState`; and
- `RoomDataF/G/H/I/N/O/P/Q.lua`.

Related durable evidence lives in:

- [Keepsake game-data audit](KEEPSAKE_GAME_DATA_AUDIT.md);
- [Shop and Well interaction lifecycle](SHOP_AND_WELL_INTERACTION_LIFECYCLE.md);
- [Stygian Well game-data audit](STYGIAN_WELL_GAME_DATA_AUDIT.md); and
- [Shrine of Hermes delivery audit](HERMES_SHRINE_DELIVERY_GAME_DATA_AUDIT.md).

## Fountain use is a required interaction

`HealthFountain` declares `BlockExitUntilUsed = true`. The room setup path
therefore registers an active fountain in `MapState.RoomRequiredObjects`.
`CheckRoomExitsReady` rejects exit unlock while any required object remains.

`UseHealthFountain` is the exact semantic event that:

1. disables the fountain and removes it from `RoomRequiredObjects`;
2. applies fountain-owned trait effects;
3. heals Melinoe; and
4. asks `CheckRoomExitsReady` to unlock the exits.

The function does not merely acknowledge an already-complete room. Fountain
use can change modeled history. In particular, an active Aromatic Phial
(`FountainRarityKeepsake`) with a remaining use can consume that use and raise
an eligible trait's rarity at this exact interaction. Fountain-refresh and
fountain-damage traits also run here.

Consequently, a supported active fountain cannot be represented only by a
decorative lifecycle boundary or by generic room completion. It is one
required room interaction with an exact pre-state and post-state.

## Ordinary Reprieve rooms

`HealthRestore` inherits the noncombat encounter family. At room start it
activates the biome's preplaced fountain and independently calls
`SpawnRoomReward`. The spawned reward is also a room-required object unless its
producer explicitly opts out.

The installed ordinary Reprieve declarations are:

| Route | Room           | Encounter       | Required incoming reward | Declared cleanup contact |
| ----- | -------------- | --------------- | ------------------------ | ------------------------ |
| F     | `F_Reprieve01` | `HealthRestore` | yes                      | eligible Well            |
| G     | `G_Reprieve01` | `HealthRestore` | yes                      | eligible Well            |
| I     | `I_Reprieve01` | `HealthRestore` | yes                      | eligible Well            |
| O     | `O_Reprieve01` | `HealthRestore` | yes                      | Shrine chance `1.0`      |
| P     | `P_Reprieve01` | `HealthRestore` | yes                      | Shrine chance `1.0`      |

The fountain and spawned reward are parallel required objects. The source does
not impose an order between using the fountain and taking the reward. Either
may happen first. Exits become usable only after both have resolved.

The truthful common lifecycle is therefore:

```text
Room entered
  -> use fountain and take the incoming reward, in either order
  -> Cleanup · Doors open
  -> use any realized Well or Shrine, if desired
  -> enter the selected exit
```

The required fountain and reward belong before Cleanup, but their relative
order is authored player chronology rather than a derived fixed order.

The broad `H_Bridge01` start hook includes a `HealthFountainH` activation, but
that hook is not itself a realized-object guarantee across the bridge's room
variants. The only bridge realization the planner models is the Echo room, and
that realization does not expose a fountain. It is therefore not part of this
required-fountain set.

## Persistent Ephyra Hub

`HealthFountainN` normally overrides `BlockExitUntilUsed` to `false` because
the Ephyra Hub persists across local visits. Its object state records whether
it was previously used. Once the sixth Soul Pylon is present,
`HealthFountainNExitCheck` makes an unused fountain required before the Hub exit
can open; `HealthFountainNRestoreState` preserves the already-used state on
later Hub restoration.

This is not equivalent to a one-visit required Room Action:

- the fountain may be used during an earlier Hub visit;
- it becomes mandatory only at the completed-Hub exit frontier; and
- it must not replay after returning from a side room.

The persistent Hub therefore needs its own eventual chronology disposition. It
must not be silently folded into the ordinary Reprieve or Postboss rule.

## Nonfinal Postboss rooms

The six current nonfinal transitions in the installed four-biome routes have
this physical interaction set:

| Route | Room           | Required fountain   | Optional rack | Door-open-only contact |
| ----- | -------------- | ------------------- | ------------- | ---------------------- |
| F     | `F_PostBoss01` | `HealthFountainF`   | `GiftRack`    | forced Well            |
| G     | `G_PostBoss01` | `HealthFountainG`   | `GiftRack`    | forced Well            |
| H     | `H_PostBoss01` | `HealthFountain`    | `GiftRack`    | forced Well            |
| N     | `N_PostBoss01` | `HealthFountainN`\* | `GiftRack`    | forced Shrine          |
| O     | `O_PostBoss01` | `HealthFountainO`   | `GiftRack`    | forced Shrine          |
| P     | `P_PostBoss01` | `HealthFountainP`   | `GiftRack`    | forced Shrine          |

\* `HealthFountainN` is normally nonblocking, but `N_PostBoss01` explicitly
overrides `BlockExitUntilUsed = true`.

The Well, Shrine, and rack still depend on their respective profile/world
upgrade requirements. “Forced” in the table describes the room declaration's
spawn policy once the corresponding feature is available.

The last configured biome has no succeeding-biome keepsake frontier and must
not inherit the ordinary fountain/rack interaction set merely because its
completion declaration has kind `PostBoss`. The game expresses the general
boundary through `GameData.FullRunBiomeCount`; the planner can derive the same
fact from the configured route's biome count and the reached biome ordinal.
It must not switch on literal biome keys. In the current four-biome routes, the
installed final completion tails also contain neither the ordinary fountain
nor the ordinary Postboss rack.

`F_PostBoss01` uses `Story_Chronos_01` rather than the ordinary `Empty`
encounter. This audit does not classify its optional Chronos presentation as a
required room interaction; it does not change the fountain/rack/Well ordering
established here.

## Postboss ordering

The `GiftRack` is usable independently of exit readiness. It does not enter
`RoomRequiredObjects`. The player can retain the current keepsake by doing
nothing (or by opening and closing the rack without a change), or can replace
it once through the rack.

There is no source barrier ordering the rack against the fountain. Therefore:

- replacing the current keepsake before fountain use changes which keepsake
  and immediate equip effects the fountain observes;
- using the fountain first makes it observe the keepsake carried through the
  Boss; and
- the rack remains optional after the fountain has opened the exits.

Aromatic Phial makes this difference concrete. Equipping it before the
fountain can consume its use and upgrade a trait in the Postboss room. Equipping
it after the fountain cannot affect that already-resolved fountain. Replacing
an active Aromatic Phial before using the fountain removes it before the
fountain effect is evaluated.

The truthful nonfinal Postboss chronology is:

```text
Room entered with the Boss keepsake
  -> optionally replace the keepsake
  -> use the required fountain
  -> Cleanup · Doors open
  -> optionally replace the keepsake if it was not replaced earlier
  -> use any realized Well or Shrine, if desired
  -> enter the next biome
```

The optional rack action may occur on either side of fountain use. Once Cleanup
begins, no source rule orders the rack relative to a Well or Shrine either.
Those later contacts must use their exact chronological prefix.

## Cleanup contacts

Eligible Wells and Shrines are installed during room setup but remain locked.
`DoUnlockRoomExits` first generates and reveals the exits, then marks the
room's `WellShop` and `SurfaceShop` usable. Because an unused required fountain
blocks that unlock path, a Well or Shrine cannot be used before fountain use in
these rooms.

This supports one general player-facing meaning for **Cleanup · Doors open**:
the required fountain and rewards have resolved, exits are already available,
and optional room contacts may still change the history carried through the
selected exit. Well and Shrine purchases do not belong in the pre-fountain
room-entry interval.

## Planner disposition after schema 59 implementation

The planner now represents the source-backed order through the existing Room
Action machinery. Ordinary Reprieve occurrences carry the required incoming
reward and required `useFountain` references in their one
`roomActions.order`; either order remains legal and Cleanup begins after both.
Reached Postboss automatic occurrences carry the same occurrence-owned order:
`useFountain` is required, while an active keepsake replacement atomically
adds optional `interactKeepsakeRack`. The rack may be ranked before or after
the fountain, so the exact prefix seen by Aromatic Phial and later contacts is
preserved. Retain removes the rack participant; a configured final-biome
Postboss remains fully active at the configured route tail; route extension
changes only its declaration-fixed exit target.

The automatic occurrence and roster preserve the source distinction between
the noncombat entry sequence and ranked player actions. The player-facing
Postboss timeline omits those internal encounter boundaries but shows the
required fountain, optional rack, and Cleanup · Doors open seam. The modeled H
Echo Bridge and persistent N Hub remain outside this one-visit fountain set.
Eligible Pool, Well, and Shrine contacts are active later Cleanup actions with
their exact room-feature ownership.

## Bounded uncertainties and exclusions

This audit intentionally does not settle:

- whether opening and closing a rack without replacement needs a distinct
  authored event when it has no modeled effect; the planner currently treats
  Retain as absence of a rack action;
- the persistent N Hub fountain's eventual editor surface;
- inspection interactions and any feature family not declared by the current
  room-feature catalog;
- profile progression for unlocking fountains, racks, Wells, or Shrines; or
- healing amount, health state, and other combat-resource simulation.

Those are implementation-plan or feature-specific decisions. They do not
weaken the closed ordering facts above.
