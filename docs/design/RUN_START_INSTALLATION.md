# Run-Start Installation

The game module installs a plan's run-start state into a fresh native run:
the run modifiers, the starting loadout, an optional Practice mode start
point, and, during play, snap mode's corrections back to the plan. Every value
comes from engine products; the module translates them into native writes and
never reproduces planner policy. The surrounding wire and conformance contract
is the [Execution Protocol](EXECUTION_PROTOCOL.md).

## Run Modifiers

The optional top-level `runModifiers` execution product carries the complete
declared run-modifier record authored in Loadout: today the optional
`enemyGoldDropChance` and `encounterGoldRange` percentages, each present only
while enabled. It is separate from `startingLoadout` and native equipment
conformance. Native settings are omitted by the producer, preserving default
document fingerprints. The planner decoder validates a present record against
the declaration table; the module reads only the modifiers it implements,
validates those values, and ignores unknown keys, which remain part of the
fingerprinted contents. Fingerprint verification uses the record's actual
presence without inserting defaults. The authored Practice mode start point is
not part of this record; it publishes the separate
[`startState`](#practice-mode-start).

The module binds settings to the admitted plan and native `CurrentRun`
identity. They become active once the admitted run synchronizes at its first
room. Changing the selected slot does not change them. Only these run-wide
modifiers continue after `configured-prefix-complete`; ordinary room steering
remains passive. Rejection, mismatch, executor fault, death, Crossroads
presence, and a different native run prevent their application. Activation and
temporary scopes are process-local, never native-save-backed.

Enemy gold drop chance replaces only the positive chance input for capped
hostile-enemy death drops with the chosen percentage; native amounts,
`BlockMoney`, and encounter-store accounting remain authoritative. Reaction,
breakable and uncapped drops are outside this setting. Encounter gold range
narrows the native budget bounds to one value for the duration of each
`GenerateEncounter` call with numeric bounds, so native still makes its one
budget draw and applies its depth ramp and money multiplier; it composes with
the planner-owned base-difficulty narrowing in either wrap order and also
applies to native generations. Gold-urn generation is unchanged. The
[run-modifier source audit](../audits/loadout-and-progression/RUN_MODIFIERS_GAME_DATA_AUDIT.md)
owns exact native contacts and exclusions.

Temporary scopes are coroutine-local, nesting-safe, and restored on return or
error. Missing required native functions and escaping host errors fault
execution; recognized unsupported contacts pass through with bounded
diagnostics. Modifier diagnostics may continue after prefix completion without
enabling other adapters. There are no gold-total conformance obligations.

## Loadout Install

### Starting loadout on the wire

`startingLoadout` publishes, in native terms, the run-start configuration the
module installs. The planner assumes a mature file, so it publishes ranks
rather than reading the player's: the weapon; the Aspect with `aspectRarity`
(rank V, native `Legendary` in `WeaponRarityUpgradeOrder`); the Arcana cards
with their rarities; the configured Fear ranks; and the `familiar` with
`traitStacks`, the native `GetFamiliarTraitStacks` of each of its upgraded
traits when every FamiliarShopData level is owned. `startingKeepsake` carries
the keepsake's native equip `rarity` (rank III, `Epic`). Arcana `origin` and the
effective Fear ranks are status-panel presentation. A Fresh File route
publishes its fixed aspectless Staff with no familiar or keepsake, and the
module installs nothing for it.

The route-start keepsake is a pre-room realization, not a room Timeline step.
The wire carries its exact selected key and any already-authored immediate equip
result. A run that starts without a keepsake or aspect, as on a fresh profile,
omits `startingKeepsake.keepsakeKey` and `startingLoadout.aspectKey` (never JSON
null), and its Run State diagnostics omit the current keepsake. Inside
`StartNewRun`, the executor admits and freezes the plan before native
`CreateNewHero` construction, making the starting Hex available to aspect
construction. The nested `EquipKeepsake` contact arms its immediate result and
lets the matching native acquire callback consume it. Later rack changes use
the same callback adapter from their ordinary Timeline trace. Only the opening
presentation is delayed; Jeweled Pom, Experimental Hammer, and Transcendent
Embryo acquire their result when the keepsake is equipped.

### Install and restore

Every admitted run except a Fresh File route replaces the player's loadout with
the plan's `startingLoadout` for that run and restores the profile afterwards,
as a Chaos Trial holds its own loadout for its run. The installed loadout is an
input, not a checked fact: the run synchronizes when native `StartNewRun`
reaches its first room.

Admission and the install run in the `CreateNewHero` contact, before native
construction: native `StartNewRun` has already replaced `CurrentRun` and
extracted the profile's Vows, and `CreateNewHero` reads the EnemyDamage Vow.
The module saves the profile's values on the new run, then writes the GameState
fields native `StartNewRun` reads: the weapon's `LastWeaponUpgradeName`, every
card's `Equipped` (exactly the plan's cards, with adjacency bonuses cleared),
`ShrineUpgrades` at the configured ranks, `LastAwardTrait` and
`EquippedFamiliar`. It re-extracts every Vow and recomputes the Grasp and Fear
point caches. After native construction the hero holds the planned weapon and
its secondary instead of the profile's; `EquipPlayerWeapon` is not used because
it unlocks the weapon. The run-start keepsake equip takes the plan's rarity. A
Practice mode start's slotted keepsake is the run's keepsake.

The planner assumes a mature file. Rank overrides read the installed ranks from
the saved run: `GetWeaponUpgradeLevel` returns the planned Aspect rank,
`GetMetaUpgradeLevel` each planned card's rank and every other card's maximum
(for temporary draws), `GetKeepsakeLevel` sees the planned keepsake's chambers
at its planned rank and every other keepsake's full chambers (rank III, so a
keepsake swapped in at a rack equips at the planner's rank) for each call, with
native level bonuses on top, and `GetFamiliarTraitStacks` returns the installed
familiar's `traitStacks` for its traits. `AddRandomMetaUpgrades` sees every
card unlocked for the call only; holding `Unlocked` would complete the
unlock-all-cards quest. Unlocks and progression are never written: not
`WeaponsUnlocked`, card `Unlocked` or `Level`, `FamiliarUpgrades`, keepsake
chambers or the Grasp limit, and Grasp is not enforced.

The profile comes back once the ended run is recorded and before `KillHero`
saves. A death restores after `RecordRunStats`. A clear is recorded in the boss
room, where `RecordRunCleared` credits the cleared loadout after its own
`RecordRunStats`, but the run continues through linked rooms that re-equip from
the run, so a cleared run restores when `KillHero` ends it. The restore returns
the GameState fields, re-extracts the Vows and caches, gives the hero the
profile's weapon, clears the run's temporary Arcana and removes the backup. A
run that still carries a backup is restored again at the next `StartNewRun` and
at every hub load; a restore that fails refuses the next admission, so a
planned loadout is never backed up as the profile.

Install state is saved with the run, so the rank overrides and the restore hold
after Save & Quit, after a reload and while execution is passive. An install
that fails restores the backup and is an executor fault; the run continues
natively on the profile. A module removed mid-run leaves the planned values in
the profile. Run records (including the `ClearedWith*` records that feed the
Fated List), Shrine bounty completion and the chambers native `AdvanceKeepsake`
adds credit the installed content, and the unused-weapon bonus follows the
planned weapon.

A Fresh File route admits only when native `StartNewGame` starts the run, which
passes no previous run; on an existing save it is an admission rejection.
Admission is also rejected while a Chaos Trial is starting or holds its stored
loadout (`ActiveBounty`, `StoredGameState`).

## Practice Mode Start

### Engine start installation

A start installation is the pure projection of a Practice mode start point from
folded states; it adds no simulation. An Opening installs its predecessor
biome's terminal branches in post-reset biome form, since the native Intro
resets the biome records before anything reads them; it requires a complete,
valid predecessor. A Preboss or Boss installs the states its start room's
preparation received, captured for every Preboss and completion Boss (the
Rivals map where Rivals applies) in every simulation, so they already include
the room's own creation effects; a Boss's follow its Preboss's departure. Biome
records are installed in current form for both, and I's Clockwork counters only
at the Preboss. Every installed family must agree across the reached branches,
or the start point is unavailable and names the disagreeing families. Reward
stores are the one exception: a store exact across branches is installed, and
one that differs by branch is left native-fresh. The stub room history has one
record per room-history ordinal advance, carrying its room's declared
`NextRoomSet`; execution assembly adds a Dream route's `Dream_Intro` prologue,
and the visited biomes are the itinerary prefix before the start (including its
own biome for a Preboss or Boss). Availability and its reasons are
[authored-model policy](AUTHORED_PROJECT_MODEL.md#route-loadout).

The same projection owns the held-keepsake rows and exact store contents that
every [Run State snapshot](SIMULATION_AND_VALIDATION.md#run-state-snapshots),
and so every execution frame, carries. The engine also owns the room-exit fact
kinds conformance reads from those snapshots and the traits snap mode
restores, from which the module's modeled-traits table is generated.

### Published `startState`

An authored start point either blocks publication with `startPointIneligible`
and the engine's reason, or publishes the optional top-level `startState`. A
plan without one omits the section, so ordinary fingerprints are unchanged. A
Fresh File route may carry a start point too. Its practice run skips the
earlier biomes' first-time story and introductions, so later story-gated
content may diverge from the plan.

`startState` is the engine's start installation in the native terms the module
writes, not a dump of planner state. Every fact comes from the engine's folded
state; assembly translates it, selecting and renaming fields. It carries:

- the start: `point` (`opening`, `preboss` or `boss`), `biomeKey`, the selected
  start `occurrenceId`, its native `roomName`, and the authored `gold` added to
  `GameState.Resources.Money` on top of the game's own starting gold (0 when
  absent);
- route position: `biomeVisitOrder` (native `BiomeVisitOrder`, whose length is
  `EnteredBiomes`; `IsDreamRun` follows from the route), one stub `RoomHistory`
  record per departed room (`name`, `nextRoomSet` where RoomData declares or
  inherits it, so native run and biome depth derive from it), `encounterDepth`
  and `lastDevotionDepth`. A Dream route's history starts with the native
  `Dream_Intro` prologue, whose `SelectNextDreamBiome` sets its `NextRoomSet`;
  native run depth counts it, so assembly adds it to `lastDevotionDepth`. Its
  encounter is non-combat, so encounter depth does not count it;
- for a Preboss or Boss only, `biome`: `BiomeDepthCache`, `BiomeEncounterDepth`,
  `BiomeUseRecord`, the Forfeit and Fig Leaf biome flags, and, exactly for an I
  Preboss, `RemainingClockworkGoals` and `MaxClockworkNonGoalRewards`. An
  Opening omits it because the native Intro resets those records;
- equipment results beyond `startingLoadout`: `aspectPerfect` (Premium
  Service) and the familiar's stack multiplier;
- `traits` to install without `FromLoot`, each with its native rarity
  (`Legendary` for a Rank II Hammer), `stackNum` and only the per-instance
  fields its skipped acquire would have written: `BlockInRunRarify`,
  `UpgradedTraitName`, `SelectedTrait`, `GrantedTrait`, `RepeatedKeepsake`,
  `CurrentRoom`, the `EchoIncreaseStats` fields, and an Experimental Hammer's
  remaining uses. A trait picked from the Echo, Arachne, Narcissus, Medea,
  Circe or Icarus menu carries its biome `acquisitionOrdinal` (1-4) instead of
  a rarity; the module installs it at `RarityUpgradeOrder[acquisitionOrdinal]`,
  as those menus set it on Dream runs, so native setup derives its
  `RoomsPerUpgrade` values. Standard menus install at Common, whose values equal
  the mapped rarity's at every standard position. Traits native `StartNewRun`
  installs from the loadout are omitted, and so is the Spell, which `hex`
  carries;
- `elementEssences`: collected Essence pickups and resource points per base
  element, which the module installs as that many hidden `<Element>Essence`
  traits; an `ElementalEssence` counts the same as one of each. Creation's
  elements come from its installed blessing;
- active Chaos curses with their remaining uses and blessing (`OnExpire`), and
  matured blessings with `FromChaosKeepsake`;
- the keepsake: `KeepsakeCache`, `BlockedKeepsakes`, Fig Leaf's
  `PersistentDionysusSkipKeepsake` uses, and `traits`, exactly the keepsake
  traits the hero holds, each with its native rarity and counters
  (`RarityUpgradeData.Uses`, `BoonConversionUses`, `Uses`, `RemainingUses`, the
  Bell and Fang multipliers, the Embryo's `CurrentRoom`, the Silken Sash's
  `CurrentArmor`, which includes the start room's door gain because Practice
  enters it without `LeaveRoom`). At most one row is `slotted`: the equipped
  keepsake, which the module equips natively with `ForceRarity` and without
  `FromLoot`. The others are held unslotted: a Permanent keepsake a swap kept
  (Discordant Bell, Jeweled Pom, and a Calling Card or Time Piece that left
  with uses), and Echo's Common copy. A replaced or spent keepsake that native
  removed has no row;
- active Arcana at their current rarity, with `TemporaryMetaUpgrades`, Centaur
  `CurrentRoom` and Artificer `MetaConversionUses`, each card Barren holds
  unequipped, and the vows Circe disabled (`ShrineUpgradesDisabled`);
- `maxStats`: the expected maxima for the self-check, and `hiddenGrants`, the
  recorded amounts no installed trait re-creates, each tagged with its source:
  lumped pickups, trait acquisition rolls and `RoomsPerUpgrade` grants (Traces
  of Spirit), Centaur room growth, and each keepsake max-Magick grant. The
  module installs each as a plain hidden `RoomRewardMaxHealthTrait` or
  `RoomRewardMaxManaTrait` without a `Source`. Aspect, familiar, Arcana card,
  per-element, Chaos and Fight Fight Fight terms are re-derived from the
  installed traits. The expected maxima include every grant;
- `itemArmor`: armor from armor items and from Silken Sash armor moved out by an
  unequip or a Cherished Heirloom advance, which the module installs as one
  hidden `MinorArmorBoon` with that `BaseAmount`, none at 0;
- Well holdings and `WellShopPurchases`, pending Hermes deliveries, and the
  Spell (`hex.spellTraitName`) with its realised tree, invested nodes, talent
  points and closure. The module adds the Spell unless native `StartNewRun`
  already installed it from the aspect;
- `RewardPriorities`, `UseRecord`, `LootTypeHistory`, `ConsumableRecord`,
  Denial's `BannedTraits`, and the `RewardStores` drawn from and exact across
  every planned branch, as counts aligned with `RewardStoreData`.

The decoders check that the start occurrence is selected and matches the point,
its biome and room name: an Opening's occurrence is its biome's first selected
room in a configured biome after the route start, and a Preboss's or Boss's is
a later one. That a Preboss or Boss start names the biome's Preboss or
completion Boss room (the Rivals map where Rivals applies) is assembly's
guarantee, carried by the fingerprint, since occurrences do not publish room
kinds. `biomeVisitOrder` must be the configured biomes entered before the
start, `biome` is present exactly for a Preboss or Boss, and its Clockwork
counters exactly for an I Preboss. Execution's route cursor starts at the start
occurrence's index in `selectedOccurrenceIds`; earlier occurrences are never
realized.

### Native install

Every Silver Wheel max-Magick grant is a hidden grant except the slotted
Wheel's own, which is created natively: the module equips the current keepsake
without `FromLoot` at the planner's rank (`ForceRarity`), and `EquipKeepsake`'s
Silver Wheel branch finds no `Source`-tagged `RoomRewardMaxManaTrait` and calls
`KeepsakeAddMaxMana` at that rank. The grant arrives on a thread, so the
self-check reads the maxima after it lands. Hidden grants carry no `Source`, so
that branch never rewrites them, even when a later Gift Gift Gift replay equips
a Wheel; each grant stays independent. Without a slotted Wheel, every grant is
hidden.

Run-wide records are written at different points for an Opening and a
mid-biome start (Preboss or Boss). An Opening's are its predecessor's terminal
values, before the start room exists: the module writes them before native
`CreateRoom`, the stores after `InitializeRewardStores`, so the Intro's own
reward draw, priorities and encounter choice read and update them natively. A
mid-biome start's captured state already includes its room's creation, so the
module writes the run-wide records and `biome` after native `CreateRoom`
returns and before `StartRoom`, replacing whatever creation wrote. Creation
draws no store entry for a Preboss
([room contacts](../audits/game-execution-contacts/ROOM_FEATURES_AND_ACTIONS.md#published-presence-as-a-native-construction-input))
or a Boss, whose `ForcedReward` returns first, and depths advance only in
`StartEncounter`.

The `biome` section maps onto native fields: `BiomeEncounterDepth` (absent
while native leaves it unset) and `BiomeUseRecord` directly; Forfeit's consumed
use as `BiomeBoonSkipCount` 1, its single rank's allowance; the Fig Leaf flag
as `ActivatedThisBiome` on the held `PersistentDionysusSkipKeepsake`; and an I
Preboss's counters as `RemainingClockworkGoals` and
`MaxClockworkNonGoalRewards`, which `InitClockworkGoalReward` would have set at
the Intro. `BiomeDepthCache` is not written: the map load before `StartRoom`
derives it from the stub history
([route-position audit](../audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md#later-biome-run-start)),
and the self-check compares it with the published value. Neither a Preboss nor
a Boss inherits `BiomeStartRoom`, so its `StartRoom` grants no Tight Deadline
time; while the vow is active and not disabled, the module adds the vow's
allowance to `BiomeTime`. For a Preboss the module then generates its shop with
`RunShopGeneration`, as native `LeaveRoom` would for every next room, binding
the global `roomData` to the start room's data for the call. A Boss spawns no
shop; its Postboss's is generated on the Boss's own `LeaveRoom`. Weather in F
and N is absent on a Preboss or Boss start.

Unknown state is not published and starts as a fresh install leaves it: timers,
including the Expiring timer and Evade Evade Evade; trait armor, which installed
armor traits set full at their installed rarity; the Ghost Onion, Silver Wheel,
Mist Veil and Hades lifesteal pools; spell charges, refilled including
`BonusSpellUses`; rerolls; Personal Loan gold; Last Gasp eligibility; and the
last Challenge depth. Under the Boon Mana Reserve vow, installed boons hold no
reserved Magick. Current health is set to the maximum. An Opening's weather is
whatever the native Intro produces. An I Opening leaves Clockwork to the native
Intro; the plan's door rewards are forced as in a full run.

Death Defiance comes from its native sources: run start adds the keepsake,
familiar and Arcana charges, and installed Chaos blessings add theirs. The
module adds the charges that only acquire functions add, Athena's
`FocusLastStandBoon` and the Circe familiar multiplier's. Every charge starts
unused. Dropping `FromLoot` is the only suppressed acquisition effect, and the
install undoes only its own `TraitsTaken` entries and max-stat presentation;
`GameState` writes made during play and achievements are real play. The
[trait audit](../audits/game-execution-contacts/TRAITS_AND_OFFERS.md#re-creating-held-traits)
owns the re-creation facts.

The module installs inside native `StartNewRun`, on top of the
[installed loadout](#loadout-install): the slotted keepsake at its
`EquipKeepsake`; the hero's state when `EquipMetaUpgrades` returns; when
`InitializeRewardStores` returns, an Opening's records and, at either point,
Barren's removal of each card it holds, after native Death Defiance and rerolls
and before native starting gold; and, after `StartNewRun` returns with the
start room created, a Preboss's or Boss's records, `biome` section and Tight
Deadline allowance, a Preboss's shop, then the gold. `CreateRoom` only prepares
the start room for execution. A Dream Preboss or Boss is not a biome entry: it
enters without the Dream biome entrance, and `PrevDreamBiome` is the biome
before its own. The start room's `SetupHeroObject` repeats native first-room
hero setup, which a non-empty `RoomHistory` skips; the run records its start
room and history length, so the setup also repeats after Save & Quit and while
execution is passive. The published maxima, and a mid-biome start's biome
depth, are checked right after that setup, before the Intro's own room-start
effects (a Centaur threshold, an Echo replay) change the maxima; the entry
conformance families are checked at `StartRoomPresentation` against the start
room's `roomEntered` frame, after an Opening's biome-start effects or a
Preboss's or Boss's ordinary room-start effects. A mismatch makes execution
passive, an install or self-check error is an executor fault, and the run
continues natively either way. Conformance stays legality-only: the installed
values are inputs, not new room-exit facts. The run's lifecycle is native
except that the module removes the run from `RunHistory` before native `EndRun`
strips the history by each run's distance from the end, and sets `PrevRun` to
the last recorded run as a reload would; clear-time and depth records still
write.

## Snap Mode

The ModpackLib option **Snap back to the plan** (`SnapMode`, off by default,
persisted and hashed like the other gameplay options) returns a run to its plan
at each room exit. Off, a desynchronized run is unchanged.

- **Correct at the exit.** Every `LeaveRoom` first runs the room's ordinary
  checks: its exit conformance, the Hub departure conformance in the Hub, and
  the [`exit-door`](EXECUTION_PROTOCOL.md#exit-door) check of a synchronized
  exit. An exit that passes them writes nothing. After a mismatch, the module
  compares the live hero with the plan's hero state for the room being left
  over every admission family. That state is the occurrence's `beforeRoomExit`
  frame, or in Ephyra's Hub the visit's `departures[i].beforeRoomExit`, found
  by its completed main-room visits. Differences are written through the
  Practice writers before native `LeaveRoom` runs, and the hero is verified
  against the same frame. Native `LeaveRoom` and `StartRoom` then replay what
  follows the frame: room-counted traits, Echo, Silken Sash, shop completions,
  the Well spark and the Hub board draws. Health is clamped, Death Defiance and
  armor stay live, and only the engine's modeled traits are restored. A room
  that is not the occurrence being left, a restored main room, and a Hub
  without a departure frame are not corrected; the next room's exit corrects
  the hero.
- **Disagreement.** A synchronized exit that passes its checks still reads the
  frame's differences without writing them. Any difference means conformance
  and the frame disagree, a design issue: the module logs a
  `[RunPlanner] conformance/snap disagreement` line naming the room, families
  and differing paths, and counts nothing.
- **Force the planned door.** After a mismatch, the same exit leaves the route
  cursor and resumes at the planned next occurrence (a fresh cursor and room
  coordinator, as a Practice start resumes, keeping the room just left so
  native Hub and parent re-entries stay transparent) before native `LeaveRoom`
  runs, so the next room's encounter and reward are steered. Outside Ephyra's
  board, including a biome edge, the chosen door's room is kept only when it
  was prepared for that occurrence; otherwise the module builds the room the
  planned door would have offered, with its reward, cages and Zagreus Contract
  presence, and `CreateRoom` replaces `door.Room`. A side room's native return
  already re-enters its parent, so only the hero is corrected. A biome edge,
  including Dream's, is steered only from a Postboss the route entered in sync
  while the plan continues past it. Dream picks the next biome
  (`SelectNextDreamBiome`) and its opening (`ChooseStartingRoom`) before
  `LeaveRoom`; neither reads the hero, so with snap on both are steered to the
  planned occurrence even out of sync, and the exit then corrects and resumes as
  for any room.
- **Ephyra's board.** The Hub and its main rooms are never rebuilt, because
  `CreateRoom` + `StartRoom` would respawn their Soul Pylons, which gate the Hub
  exit. Native `LeaveRoom` is instead given the offered planned door: the Hub
  slot door, the main room's side door, or its `EphyraExitDoorReturn` back to
  the Hub. Native bookkeeping then records that door (the Hub also closes it
  for the run; main rooms record `DoorRoomHistory` but keep their doors open)
  and sets the next room's `Flipped` and entrance from it. The module undoes
  what `AttemptUseDoor` recorded for the taken door (`OnUseSetRunData` keys and
  `CloseDoorOnReturn`) and records the planned door. For the Hub return, it
  builds the room from `RoomHistory` as `AttemptUseDoor` does. Presentation
  follows the taken door: the exit presentation `LeaveRoom` dispatches for the
  planned door (`HubCombatRoomEntrance`, `FastExitPresentation` or
  `LeaveRoomPresentation`) receives the taken door, so the walk-out plays there
  while `ExitDirection`, `Flipped`, the next entrance and the closed and
  recorded door all stay the planned door's. For a planned side door, the
  parent's return entrance that `HandleSubRoomData` stored at the taken door
  (`HeroStartPoint`/`HeroEndPoint`) is moved to the points nearest the planned
  door. A synchronized board exit through any other door is an `exit-door`
  mismatch, so a wrong turn is forced in one step. An exit from the Hub carrier
  enters the Hub and resumes at the first Hub visit; any other exit from the
  carrier, such as a Chaos gate, leaves through the offered Hub door instead.
  Every board visit, in or out of sync, stamps the offered doors whose native
  room is their slot's planned room. Out of sync, a Hub slot is entered only
  through a door stamped for it, never an unsteered native one. A planned side
  room is never skipped: its offered side door is used, and rebuilt with the
  planned room when unstamped, because side rooms are fresh rooms without
  pylons. The Hub return needs no stamp, and a Hub skip-ahead corrects to the
  departure frame of the visit it reaches.
- **Room starts only check.** Nothing is written at `StartRoom`; the entry
  proofs report as in any synchronized room.
- **Stop.** Snapping stops for the run only when an exit correction fails in
  its own room: the writers fault (the session faults) or the verify fails
  (`snap-loop`). Any later mismatch is corrected at the next exit.
- **Declined.** A reloaded run, a planned door that is not offered, and a
  biome edge from a room entered out of sync or where the plan ends are
  declined, and native chooses. A declined run does not wait on the same
  target. From a board room, the next planned occurrence with an offered door
  is the target. Elsewhere, the cursor's occurrence is tried first unless it is
  the room being left. Otherwise the room being left is found at or after the
  cursor by name, and its next occurrence is the target.
- **Integrity.** Each exit that returns a desynchronized run to the plan counts
  one snap. The status window and the victory summary show the count on every
  slot.
