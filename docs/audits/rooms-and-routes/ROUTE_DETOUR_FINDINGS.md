# Route Detour Game-Data Findings

## Status and scope

This is a source-backed game-data audit. It records how Chaos, Oceanus
Anomalies, and the Zagreus contract leave and resume a host route. It does not
own planner schema, implementation sequencing, or UI contracts; the owning
design and biome authorities own those decisions. Where the
discussion has settled a planner baseline against these facts, the disposition
is recorded separately from the source behavior.

The current planner supports Oceanus Anomaly replacement, the Zagreus contract,
and one unified Chaos additional exit. Chaos declarations independently identify
physical hosting (`canHost`) and ordinary authored spawning (`canSpawn`);
ordinary spawning remains limited to `N`, `F`, `G`, and `P`, while Ixion may use
host-only declarations in its source-backed F/G/H/I matrix.

Spark of Ixion uses the same game entry function but bypasses the natural
chance, spacing, and room-specific requirements. Its source-backed physical
host matrix is recorded below; in the planner it is pressure on the single
Chaos gate, not a second gate kind.

The route evidence was checked against the installed game scripts and map
assets on 2026-08-04. The Spark physical-host matrix was refreshed against the
same installed maps on 2026-08-24, and the Chaos return-door counts were
refreshed on 2026-08-31. Primary sources are:

- `RunLogic.lua`, especially `CreateRoom`, `ChooseNextRoomData`,
  `UpdateRunHistoryCache`, `GetRunDepth`, and `GetBiomeDepth`;
- `RoomLogic.lua`, especially `HandleSecretSpawns`,
  `IsSecretDoorEligible`, `AttemptUseAutoExitDoor`, and `LeaveRoom`;
- `RewardLogic.lua`, especially `ChooseRoomReward`, and
  `EncounterLogic.lua`, especially `EndCapturePointChallengeEncounter`;
- `RoomData.lua`, `RoomDataChaos.lua`, `RoomDataAnomaly.lua`,
  `RoomDataC.lua`, and biome room declarations;
- `EncounterData_Challenge.lua`, `EncounterData_Boss.lua`, `EventLogic.lua`,
  `RequirementsData.lua`, `StoreData.lua`, `TraitData.lua`,
  `TraitData_Store.lua`, `ObstacleData.lua`, and `EncounterSets.lua`;
- the concrete `.thing_bin` map assets for Chaos, Anomaly, Zagreus, and
  candidate source rooms.

Chance values below are evidence about game generation. They do not imply that
the planner should replay probability; the planner currently models possible
authored outcomes.

## Terms

- **Host source**: the current route room in which a detour offer or
  replacement is prepared.
- **Resume target**: the new host-room-set room generated after the detour.
- **Offered**: a room was created and attached to an exit. It need not have
  been entered.

These distinctions matter because Chaos spacing is based on an offered gate,
while route history and depth are based on entered rooms. Ixion consumption is
derived from the next reached host-capable room that already has that gate.

## Current planner boundary

The current authored topology has:

- one start occurrence;
- `ExitDecision` for linked exits and a normal lane, including a zero-target
  generated envelope before its first ordinary target or takeover resolves;
- `HubDecision` for Ephyra;
- one selection among the normal targets and declared additional exits of a
  realized `ExitDecision`;
- fixed-linked Boss/Postboss completion after a selected Preboss.

`ExitDecision.normal` owns normal exits, while declaration-owned additional
exits represent the unified Chaos gate and the Zagreus contract.
Anomaly remains a normal-target replacement; there is no detached room-set
node, automatic hidden resume outside the declared detour paths, or generic
route edge. A Room Declaration also has one route `biomeKey`, and current
topology decoding requires an occurrence's declaration to match its owning
authored biome.

Those are current-code facts, not the desired detour contract. This audit does
not resolve them by adding fake `Chaos`, `B`, or `C` route biomes.

## Natural Chaos

### Creation and entry form

`CreateRoom` rolls `SecretChanceSuccess` when the host source is created.
During setup, `HandleSecretSpawns` requires at least one physical
`SecretPoint` in that concrete map and calls `IsSecretDoorEligible`.

For natural Chaos, eligibility requires:

1. a successful room-specific Chaos chance roll;
2. the room's `SecretDoorRequirements`;
3. the physical `SecretPoint` capability.

On success, `HandleSecretSpawns`:

1. sets `currentRoom.ForceSecretDoor = true` on the host source;
2. chooses a room from the `Chaos` room set;
3. creates a separate `SecretDoor` and concrete Chaos room;
4. assigns that room to the special door.

The normal exits are neither replaced nor consumed. A Chaos gate is an
additional continuation beside them. `ObstacleData.SecretDoor` hides its room
reward preview, so the gate does not reveal which Chaos reward was generated.

### Natural biome matrix in scope

| Host biome | Declared chance      | Additional source restrictions                                                                                                        |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `N`        | `N_Opening01 = 0.09` | `BaseN.SecretDoorRequirements` permits only `N_Opening01`; `N_PreHub01` also declares `0.09` but fails that source-name requirement   |
| `F`        | `BaseF = 0.10`       | inherited normal eligibility, the shared named-room exclusions, room-specific zero overrides, and physical map capability still apply |
| `G`        | `BaseG = 0.12`       | inherited normal eligibility, the shared named-room exclusions, room-specific zero overrides, and physical map capability still apply |
| `P`        | `BaseP = 0.05`       | requires `BiomeDepthCache <= 5`, rejects `P_PreBoss01` and `P_Boss01`, and carries Surface progression predicates                     |

The shared baseline excludes room sets `I`, `O`, and `Q`; `H` declares a zero
natural chance. `N` and `P` override the shared baseline with their own Surface
requirements. This leaves `N`, `F`, `G`, and `P` as the natural Chaos biome
set relevant to this audit.

Several gates are external save/profile progression facts: Chaos must be
unlocked, and Surface Chaos additionally depends on progressed-save flags.
They are real game requirements but are not automatically planner inputs.
Their eventual disposition is an implementation decision.

### Concrete supported-source inventory

The map assets and current catalog declarations close the physical capability
question for the natural sources presently relevant to the planner:

| Host biome | Currently supported declarations that can naturally offer Chaos                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `N`        | `N_Opening01` only                                                                                               |
| `F`        | `F_Opening01`–`F_Opening03`, `F_Combat01`–`F_Combat22`, `F_Story01`, `F_Reprieve01`, and `F_Shop01`              |
| `G`        | `G_Intro`, `G_Combat01`–`G_Combat20`, `G_MiniBoss01`–`G_MiniBoss03`, `G_Story01`, `G_Reprieve01`, and `G_Shop01` |
| `P`        | `P_Intro`, `P_Combat01`–`P_Combat19`, `P_Reprieve01`, and `P_Shop01`, subject to the depth-five ceiling          |

Every room listed above has a concrete `SecretPoint` in its `.thing_bin` map
asset and inherits a nonzero natural chance. The inventory deliberately does
not infer capability from room category:

- F minibosses override the chance to zero, while G minibosses retain the
  inherited `0.12` chance;
- P minibosses and `P_Story01` override the chance to zero;
- named Preboss and boss rooms are rejected or have a zero override;
- postboss rooms have zero natural chance and are route transitions;
- Story, Fountain/Reprieve, and Midshop are valid natural sources in the
  biomes where they appear in the table.

Normal-door generation eligibility can still make one of these declarations
unavailable at a particular authored point. This table answers the narrower
Chaos-source question: if that room is the entered host source and its natural
Chaos requirements pass, the declaration and map can offer the gate.

### The ten-room rule is offer spacing, not minimum depth

`NoRecentChaosEncounter` examines the previous ten room-history records for
`ForceSecretDoor = true` and requires zero matches. That flag is set on the
host source when a Chaos gate is successfully created.

Consequences:

- the rule suppresses another natural gate after an offered gate, even if the
  player did not enter Chaos;
- it is a sliding window over prior room records, not a
  `RunDepthCache >= 10`, `BiomeDepthCache >= 10`, or entered-Chaos predicate;
- a Chaos room itself is a room-history record, so the window is not limited
  to host-biome rooms;
- a forced gate also marks its host source and therefore restarts the later
  natural-offer window.

Spark of Ixion can bypass this check, as documented separately below.

### Chaos room, reward, encounter, and return

The `Chaos` room set contains `Chaos_01` through `Chaos_06`, each inheriting
`BaseChaos`. Their target requirements are:

| Chaos map  | Eligibility from an N source                     | Eligibility from F/G/P                           |
| ---------- | ------------------------------------------------ | ------------------------------------------------ |
| `Chaos_01` | never                                            | always eligible at the map-selection layer       |
| `Chaos_02` | never                                            | requires prior profile `RoomCountCache.Chaos_01` |
| `Chaos_03` | requires prior profile `RoomCountCache.Chaos_01` | requires prior profile `RoomCountCache.Chaos_01` |
| `Chaos_04` | never                                            | requires prior profile `RoomCountCache.Chaos_01` |
| `Chaos_05` | never                                            | requires prior profile `RoomCountCache.Chaos_01` |
| `Chaos_06` | requires prior profile `RoomCountCache.Chaos_01` | requires prior profile `RoomCountCache.Chaos_01` |

The first-ever eligible Chaos map outside N is therefore `Chaos_01`. Once that
profile fact exists, all six maps can participate outside N, while an N gate
can select only `Chaos_03` or `Chaos_06`. N's own natural availability already
requires progressed Surface state, so the absence of a first-visit N target is
intentional rather than an empty production pool.

`BaseChaos` declares:

- `ForcedRewardStore = "Secrets"`; the `Secrets` store contains
  `TrialUpgrade`;
- `LegalEncounters = { "Empty_Chaos" }`;
- `PauseBiomeState = true`;
- `UsePreviousRoomSet = true`.

`Empty_Chaos` inherits the ordinary `Empty` encounter. Its only additional
semantic content is an optional, progression-gated Nyx activation and
conversation. Under the current progressed-save baseline, its supported
behavior is equivalent to `Empty`, but the planner retains the exact
`Empty_Chaos` encounter identity as declaration data while collapsing the Nyx
behavior. That does not create a separate lifecycle path.

`UsePreviousRoomSet` makes the Chaos room generate fresh targets from the host
source's room set. The concrete map assets contain these return-door counts:

| Chaos map  | `SecretExitDoor` instances in the `ExitDoors` group |
| ---------- | --------------------------------------------------: |
| `Chaos_01` |                                                   2 |
| `Chaos_02` |                                                   2 |
| `Chaos_03` |                                                   1 |
| `Chaos_04` |                                                   2 |
| `Chaos_05` |                                                   3 |
| `Chaos_06` |                                                   1 |

Each count is established by paired `SecretExitDoor` and `ExitDoors` entries
in that map's `.thing_bin`; `Chaos_06` separately contains three start/end
placements, which do not add return doors. `RoomDataChaos.lua` does not prune
these doors with `UnavailableDoorIds` or another per-map exit override.

`SecretExitDoor` keeps its reward preview visible and uses the ordinary
player-selected exit path. `DoUnlockRoomExits` collapses every physical member
of `MapState.OfferedExitDoors`, calls `ChooseNextRoomData` for each door, and
then calls `ChooseRoomReward` separately for every generated target. The return
is therefore an ordinary one-to-three-offer batch, not one automatic or hidden
continuation. All offers use the batch's selected reward store unless a target
declares an override, and every generated offer withdraws its own reward-bag
entry. The player enters only the selected target; unselected targets do not
enter room history or grant their rewards.

A live `Chaos_01` probe independently observed two generated return offers,
matching its two physical doors. It also showed that an unentered host-room
offer had already withdrawn its individual bag entry but had not entered
reward-store ratio history; the Chaos return batch consequently selected its
store from entered history and generated both offers from that store.

The earlier focused Preboss probe also established:

- normal-door Preboss takeover and an additional Chaos gate can coexist;
- taking Chaos can leave an offered normal Preboss batch unentered;
- the resumed generation creates a fresh normal/Preboss target and fresh
  reward draw rather than reusing the earlier unentered occurrence.

### History, depth, and biome state

Chaos is not transparent history and does not pause counters.

On exit, generic `LeaveRoom` inserts the Chaos room into `RoomHistory` and
`UpdateRunHistoryCache` recomputes:

- run depth as `1 + #RoomHistory`;
- biome depth by counting prior room records back to the last biome
  transition, without excluding the Chaos room by room-set name.

The Chaos visit therefore contributes a real route ordinal, run-depth step,
and host-biome-depth step. `PauseBiomeState` has a narrower meaning: entering
Chaos removes biome-state traits, and leaving it restores the current biome
state trait. It does not suspend room history, depth, rewards, or encounters.

## Spark of Ixion source facts

The player-facing Spark of Ixion is
`TemporaryForcedSecretDoorTrait`, a one-use `RoomShop`/Stygian Well item with
`ForceSecretDoor = true`. Its own availability requires prior Chaos
progression and a non-Dream run.

When the trait is held, `IsSecretDoorEligible` takes a force branch before
checking `SecretChanceSuccess` or the room's natural
`SecretDoorRequirements`. The force branch checks only
`ForceSecretDoorRequirements`:

- the current room is not one of the named Preboss, boss, or postboss
  exclusions;
- the current room set is not `Anomaly`.

A physical `SecretPoint` is still mandatory because `HandleSecretSpawns`
checks map capability before calling eligibility. Once an eligible gate is
created, the trait use is consumed and the gate's health cost is set to zero.

The installed map and declaration data expose this exact Ixion host matrix.
Counts are `SecretPoint` anchors in room-name order, taken from the concrete
`.thing_bin` maps; they are physical capability evidence rather than
probability or a generic room-feature count:

| Biome | Force-capable hosts and anchor counts                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F     | `F_Opening01`-`F_Opening03`: each 1; `F_Combat01`-`F_Combat22`: `1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,2,2,1,2,2`; `F_MiniBoss01`-`F_MiniBoss03`: each 1; `F_Story01`: 3; `F_Reprieve01`: 1; `F_Shop01`: 1 |
| G     | `G_Intro`: 1; `G_Combat01`-`G_Combat20`: `2,4,2,2,1,2,1,1,2,1,1,1,1,2,3,1,2,2,1,1`; `G_MiniBoss01`-`G_MiniBoss03`: `2,1,2`; `G_Story01`, `G_Reprieve01`, `G_Shop01`: each 1                            |
| H     | `H_Intro`: 2; `H_Combat01`-`H_Combat15`: `3,3,3,4,4,3,3,3,2,4,4,3,2,3,2`; `H_MiniBoss01`: 1; `H_MiniBoss02`: 2; `H_Bridge01`: 3                                                                        |
| I     | `I_Combat01`-`I_Combat23`: `1,3,1,1,1,4,3,2,1,1,2,1,2,1,2,2,4,2,4,3,3,2,3`; `I_MiniBoss01` and `I_MiniBoss02`: each 1                                                                                  |

`I_Combat24`, I Story, and I Reprieve have no force-capable point;
I Intro and I Preboss are explicit lifecycle exclusions. The catalog stores
physical capability on room declarations as `canHost`; ordinary authored
spawning is a separate `canSpawn` declaration and never follows from this
matrix alone.

This means Spark of Ixion can:

- bypass the natural ten-room offer spacing;
- bypass a room's zero natural chance;
- bypass natural biome, depth, and room-specific requirements;
- wait until the next map that has a `SecretPoint` and satisfies the narrower
  force exclusions.

That explains forced gates in `H` and other naturally disabled contexts. At the
first subsequently reached host-capable room, Ixion consumes exactly one
pending use if that room already has a Chaos gate. If it does not,
reconciliation inserts the single gate and records only the exact Ixion purchase
as its provenance. Multiple uses repeat at successive host-capable rooms; one
room never receives two gates. Every encountered gate participates in the same
offer-spacing reset. Removing or moving an Ixion purchase removes or relocates
only the gate whose persisted provenance names that purchase. A manually
authored gate can satisfy pending Ixion pressure but remains manual and survives
purchase removal; ordinary Chaos legality is then evaluated independently.
The public authoring surface remains the normal Chaos add/remove/map surface;
generated topology is reconciled internally. Well purchase and trait-use state
remain feature-owned, while route topology owns host/spawn capability, gate
identity, provenance, and the editable Chaos continuation.

## Oceanus Anomaly

### Trigger and replacement point

`CreateRoom` rolls `AnomalyDoorChanceSuccess` for a G host source. The shared
chance is `0.06`, or `0.33` before the profile has recorded an Anomaly visit.
At room setup, `HandleSecretSpawns` sets `currentRoom.DoAnomalies` when the
chance and `AnomalyDoorRequirements` pass.

The source-room requirements include:

- one Anomaly at most in the current run;
- a current G route at `BiomeDepthCache >= 3`;
- source-room exclusions for `G_Shop01`, `G_Story01`, `G_PreBoss01`, and
  `C_Boss01`;
- source-encounter exclusions for `ArtemisCombatG` and
  `NemesisRandomEvent`;
- several profile/narrative progression predicates.

These are requirements on the entered host source, not a declaration that the
source itself can become an Anomaly room. The source side is not restricted to
ordinary G combat declarations: any current G room that reaches depth three,
passes the named room and encounter exclusions, and can generate an eligible
next target can prepare replacement. For example, a sufficiently deep G
miniboss or Reprieve is not source-excluded, while `G_Intro` cannot satisfy the
depth floor and Midshop, Story, and Preboss are explicitly excluded.

The trigger does not immediately create an extra exit. During ordinary target
generation, `ChooseNextRoomData` first chooses an otherwise-valid target from
the G room set. Only when that target has `AllowAnomalyReplacement` is it
replaced with a room from the `Anomaly` room set. In current declarations,
`AllowAnomalyReplacement` belongs to `BaseG_Combat`. Every ordinary combat
declaration from `G_Combat01` through `G_Combat20` inherits that capability;
no other G declaration does. The complete replacement-target class is
therefore those twenty declarations, subject to their ordinary eligibility.

This creates two independent gates:

1. the previously entered source must be allowed to prepare Anomaly;
2. the otherwise-selected next target must be one of `G_Combat01` through
   `G_Combat20`.

Calling the feature an Anomaly “offer” can hide that distinction. The source
prepares a forced replacement of an eligible normal target; Anomaly is not an
additional player-selectable door beside that target.

The discarded G candidate is never passed to `CreateRoom`. It has no room
occurrence, encounter, reward, or history identity. The physical normal exit
instead owns the created Anomaly room and shows that Anomaly room's generated
reward through the ordinary door-preview path.

The selected planner baseline deliberately differs at the authoring-command
boundary: switching an already-authored G target to Anomaly preserves that
target occurrence's current reward as the Anomaly reward. This is an editor
handoff, not a second game lifecycle. Canonical simulation must record and
consume the retained leaf only as the Anomaly offer; it must not emit a phantom
G creation, G reward offer, or second reward-store consumption. A retained
`Devotion` or `SpellDrop` remains editable but invalid until the author changes
it.

### Anomaly room and automatic hidden return

The `Anomaly` room set contains seven reused Asphodel maps:

- `B_Combat01`;
- `B_Combat05`;
- `B_Combat06`;
- `B_Combat07`;
- `B_Combat08`;
- `B_Combat10`;
- `B_Combat21`.

All inherit `BaseAnomaly`, use the single `GeneratedAnomalyB` encounter, and
choose their own ordinary room reward. `BaseAnomaly` excludes `Devotion` and
`SpellDrop` but does not force a special reward store.

`EncounterSets.AnomalyEncountersB` contains only `GeneratedAnomalyB`, which
inherits `GeneratedAnomalyBase` and uses the Biome B enemy set. Through the
ordinary `Generated` base it declares `CountsForRoomEncounterDepth = true`.
An Anomaly room therefore has a genuine encounter identity and advances biome
encounter depth, but it offers no encounter choice: all seven maps force the
same legal encounter. Map selection and challenge outcome are independent
authored facts; an encounter picker would invent a choice that the declarations
do not provide.

That reward is selected and removed from its reward store when the Anomaly
room is created for the host's ordinary exit. The capture-point result controls
acquisition, not selection:

- when `CapturePointProgress >= 100`, `EndCapturePointChallengeEncounter`
  calls `SpawnRoomReward`, making the selected reward available;
- otherwise it marks the objective failed and does not spawn the room reward;
- the failed reward is not put back into the reward store.

Anomaly therefore distinguishes a consumed offer from an acquired reward. A
loss advances the bag without adding that reward to the player's acquisition
history.

`BaseAnomaly.UsePreviousRoomSet = true`, so its outgoing target is freshly
generated from G. Every declared B map contains one
`AnomalyAutoExitDoor`. That door:

- has `HideRewardPreview = true`;
- calls `AttemptUseAutoExitDoor` as soon as it unlocks;
- enters the generated G target without presenting its reward beforehand.

There is one such physical exit. Its target room and reward are selected by the
ordinary next-room and reward-store machinery; only preview and player choice
are suppressed.

The Anomaly room and the hidden resumed G room are therefore two distinct
created and entered occurrences. The replacement does not mean “run a B map
inside a G occurrence,” and the resumed G target is not the original discarded
candidate.

Anomaly has no `PauseBiomeState`. It remains a real room-history entry and
advances run and biome depth through the same generic cache path as Chaos.
`CurrentRun.BiomesReached.Anomaly` is established by entering the Anomaly room.
Preparing a replacement or creating an unentered Anomaly target does not set
that history fact. The run-level appearance requirement is consequently
consumed on entry, not on preparation or offer.

## Zagreus contract

### Midshop-only additional entry

Only four room declarations contain `ZagContractDestinationId`:

| Host route | Source room |
| ---------- | ----------- |
| `F`        | `F_Shop01`  |
| `G`        | `G_Shop01`  |
| `O`        | `O_Shop01`  |
| `P`        | `P_Shop01`  |

This confirms that the contract always starts from a declared Midshop source.
`CreateRoom` marks the Midshop when `ZagreusContractRequirement` passes: the
contract is unlocked, no standard-package bounty blocks it, `C_Boss01` has not
already occurred this run, and the `0.4` chance succeeds.

`SpawnZagContract` creates a separate contract exit with the fixed target
`C_Boss01`. The Midshop's ordinary exit flow remains available.
`ObstacleData.ZagContract` hides the target reward preview.

The contract's special behavior ends at the door. It is outside the ordinary
normal-door batch, so normal-door force pressure and Preboss takeover do not
replace or own it. That distinction has no practical Preboss collision at the
four supported Midshops. Once entered, `C_Boss01` uses the shared room
encounter, reward, counter, history, and exit processing.

`ZagreusContractRequirement` tests the current run's entered-room count for
`C_Boss01`. `SpawnZagContract` creates the room and exit but does not add that
room to the entered-room history. A contract door that is offered and skipped
therefore does not consume the run allowance and does not prevent a later
eligible Midshop from preparing another offer. Entering `C_Boss01` does consume
the allowance, making this another once-per-run-on-entry rule rather than a
once-per-offer rule.

### Contract room and automatic hidden return

`C_Boss01` owns:

- the `BossZagreus01` encounter;
- forced reward `GemPointsBigDrop`;
- `PauseBiomeState = true`;
- `UsePreviousRoomSet = true`.

`BossZagreus01` inherits `BossEncounter` and does not declare
`CountsForRoomEncounterDepth`. The room advances the normal room-history,
run-depth, and biome-depth effects, but its encounter does not advance biome
encounter depth.

After `BossZagreus01` resolves, its encounter event sequence calls
`AwardContractTrait` and then `SpawnRoomReward`. These are two distinct room
outputs:

- `AwardContractTrait` adds `InfernalContractBoon` to the hero;
- `SpawnRoomReward` materializes the room's forced `GemPointsBigDrop`.

The boon is not decorative state. `SpawnZagContractRewards` later requires
`InfernalContractBoon` and a room-specific `ZagContractRewardDestinationId`
before it creates one free option from `StoreData.ZagPedestalOptions`.

The `C_Boss01` map contains an `AnomalyAutoExitDoor`. As with Anomaly, the
outgoing host target is freshly generated, its reward preview is hidden, and
the door is used automatically after it unlocks. The player therefore returns
directly to a new room in the Midshop's host room set without seeing that
room's reward beforehand. There is one physical automatic exit, and its target
room and reward use the ordinary host-room-set generation rules.

`C_Boss01` is inserted into room history and advances run and biome depth.
`PauseBiomeState` suspends and restores the biome-state trait but does not
pause those counters.

Entry and commit are distinct source checkpoints. `StartRoom` records the
entered-room fact for `C_Boss01`; `LeaveRoom` later appends it to
`RoomHistory` and refreshes `RoomCountCache`, `RunDepthCache`, and
`BiomeDepthCache`. Its automatic target is generated before that later commit,
so it can observe entry-time facts and completed room-local effects, including
encounter and acquisition effects, but not `C_Boss01`'s own history/cache
contribution.

`ZagContractRewardDestinationId` is therefore a separate later-room placement
contract for the free post-fight benefit enabled by the awarded trait. It is
not another route edge, not the resume target, and not part of contract-entry
availability.

## Reward-store behavior of automatic continuations

The automatic exit used by Anomaly and `C_Boss01` does not bypass the reward
bag. When either occurrence unlocks its exit, `DoUnlockRoomExits` follows the
normal sequence:

1. choose a fresh target with `ChooseNextRoomData`;
2. create that target and identify its reward store;
3. call `ChooseRoomReward` for the target;
4. remove the selected entry from `CurrentRun.RewardStores`;
5. configure the room reward;
6. hide the preview because the obstacle is `AnomalyAutoExitDoor`;
7. automatically enter that already-created target.

`HideRewardPreview` is presentation state. It does not defer reward selection,
preserve the selected bag entry, or make the continuation rewardless. Each
automatic continuation consumes the reward for exactly one freshly generated
normal target before the player is teleported into it.

### Depth-five O contract trace

At the latest supported `O_Shop01` depth, the ordinary Shop exit still creates
its ordinary O target and consumes that target's reward-store entry even when
the Zagreus door is taken. `C_Boss01` is a separate room created at Midshop
start. Its automatic exit then creates a fresh second O target from the
previous room set before `C_Boss01` commits. The return therefore remains a
distinct target rather than a reuse of the unpicked Shop target.

At that automatic-generation checkpoint, the host depth is still six, below
`O_PreBoss01`'s exact depth-seven force. After `C_Boss01` commits, the returned
O target starts at depth seven; its own later ordinary exit reaches the
Preboss. This is ordinary host progression, not a special O return rule.

The complete reward-store distinction is:

- Anomaly entry consumes its visible conditional reward when the Anomaly room
  is offered; success acquires it and failure does not;
- Anomaly return consumes another reward for its one hidden G target;
- `C_Boss01` uses a forced meta reward and therefore does not remove an entry
  from the ordinary host reward store for its own payout;
- Zagreus return consumes one ordinary reward for its one hidden host target.

Thus Anomaly and Zagreus share a real one-exit-room return shape: one ordinary
target and reward are generated, the reward is hidden, and traversal is
automatic. They do not share the reward lifecycle of their entry rooms.

## Comparative fact matrix

| Feature          | Entry form                                           | Room output                                                        | Resume form                                           | Resume reward behavior            | Pauses biome-state trait? |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------- | ------------------------- |
| Chaos gate       | additional secret exit (authored or Ixion-generated) | `TrialUpgrade` through the `Secrets` store; empty encounter        | 1–3 ordinary exits to fresh previous-room-set targets | ordinarily previewed and consumed | yes                       |
| G Anomaly        | replacement on the existing normal exit              | ordinary reward consumed on offer, acquired only on success        | one automatic exit to a fresh G target                | consumed normally, preview hidden | no                        |
| Zagreus contract | additional Midshop contract exit                     | `InfernalContractBoon` plus forced `GemPointsBigDrop` in game data | one automatic exit to a fresh previous-set target     | consumed normally, preview hidden | yes                       |

All three supported detour families create real entered room occurrences,
record their own reward and encounter lifecycle, contribute history and depth,
and generate a fresh host-room-set target on return. That is their meaningful
common boundary.

They do not share entry eligibility, target selection, incoming preview,
outgoing interaction, outgoing preview, biome-state treatment, or reward and
encounter declarations. A future model that reduces them to an undifferentiated
`special` edge would erase player-visible and history-visible facts.

## Facts any later model must account for

Without choosing a schema yet, the live evidence creates these constraints:

- A room's game room-set identity is declaration data. The containing topology
  supplies route context; neither fact creates a second room class or
  lifecycle.
- Additional-exit entry and normal-target replacement are observably distinct.
- Offered special doors and rooms entered through them are different lifecycle
  events. Natural Chaos spacing consumes the former; room history consumes the
  latter.
- `UsePreviousRoomSet` is a generation rule for a fresh return target, not a
  pointer to a previously authored or discarded occurrence.
- The return continuation has at least two player-visible forms: a map-sized
  ordinary reward-bearing batch after Chaos and one-target automatic
  hidden-reward entry after Anomaly/Zagreus.
- Hidden automatic continuation still performs ordinary target and reward
  selection and consumes the selected reward-store entry before traversal.
- Anomaly reward selection and reward acquisition are different events; a
  failed challenge consumes but does not award its visible reward.
- `C_Boss01` awards `InfernalContractBoon` separately from its forced meta
  reward, and that trait gates a later free contract benefit.
- Normal-door force pressure and Preboss takeover own only normal doors. They
  do not own or erase an additional Chaos or Zagreus door.
- Once a special door is selected, its target is a room occurrence processed
  by the shared lifecycle; depth and history include it even when biome-state
  traits are temporarily suspended.
- Concrete map capability matters. Neither a nonzero chance nor a forced trait
  can produce a Chaos gate without a `SecretPoint`.
- Concrete Chaos return-door count also matters. It controls the number of
  independently generated targets and reward-bag withdrawals available in the
  entered Chaos room.

These are source constraints consumed by the implemented unified Chaos
additional-exit contract, not a commitment to a generic topology type or
command surface.

## Deliberate planner disposition

| System                               | Audit disposition                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Chaos gate in `N`, `F`, `G`, and `P` | one authored additional exit with `canSpawn` and `canHost` declaration facts                                             |
| Ixion pressure in F/G/H/I            | consume one pending use at the next reached `canHost` room; insert a provenance-tagged gate only when that room has none |
| Oceanus Anomaly                      | implemented as normal-target replacement with one automatic hidden continuation                                          |
| Zagreus contract                     | implemented as Midshop additional exit with one automatic hidden continuation                                            |

### Implemented planner disposition

The app models possible Anomaly replacement, the declared Midshop Zagreus
contract, and Ixion pressure on the unified Chaos gate while assuming their ordinary progression and
profile predicates are met; it does not replay chance. The game-only
`GemPointsBigDrop`, `PauseBiomeState`, and dual Zagreus output remain outside
the modeled reward and trait lifecycle.
Stable catalog, authored-project, lifecycle, simulation, editor, G-biome, and
integration-boundary contracts own the implementation details; this audit
retains only their source evidence and disposition.

### Settled Chaos planner baseline

The unified Chaos plan may treat these product choices as closed:

- collapse profile-gated targets to the progressed-save pools:
  `Chaos_03`/`Chaos_06` from N and `Chaos_01`–`Chaos_06` from F/G/P;
- default N to `Chaos_03` and F/G/P to `Chaos_01`;
- normalize the game `Secrets` forced store, whose supported entry is
  `TrialUpgrade`, to one direct fixed planner reward presented as **Chaos
  Blessing**;
- preserve fixed `Empty_Chaos`, the source-level offer marker, the
  prior-ten-room spacing window, and each Chaos map's ordinary visible fresh
  return batch;
- omit `BaseChaos.PauseBiomeState` from production modeling because the planner
  has no biome-state trait lifecycle input or consumer;
- keep ordinary `canSpawn` eligibility separate from Ixion host pressure; a
  manual gate remains manually owned even when it satisfies Ixion, while only
  reconciler-inserted gates record exact purchase provenance. Chance replay,
  save/profile inputs, and Chaos trait payloads remain outside scope.

The direct reward is a deliberate one-entry-store normalization, not evidence
that the game bypasses `Secrets`.

### Planner return-count disposition

The catalog retains the semantic `ChaosReturnExitDoor` type while declaring
the concrete per-map counts above. An authored Chaos occurrence therefore owns
the same one-, two-, or three-offer ordinary batch the game generates. This
does not change the separate rule that the host room has at most one Chaos
entrance gate.

## Required fixture ownership

Focused lifecycle fixtures cover Anomaly replacement, a Zagreus Midshop, and
Ixion's first capable-host consumption; representative browser workflows cover
Anomaly failure and selected Zagreus return. The source establishes the expected
history/depth and return behavior; fixtures should protect each selected
planner interpretation rather than stand in for missing production semantics.

The automatic hidden continuation editor policy is also closed: its exact
authored target and reward remain visible through an ordinary width-one
decision. The derived selection needs no special return control or explanatory
label; the catalog retains the game's hidden-preview and automatic-traversal
facts. Simulation still selects and consumes the reward before automatic entry.

The Anomaly target inventory, forced encounter, source/target eligibility
split, and Anomaly/Zagreus entry-consumed run caps are closed. They are not
remaining audit questions.

Runtime adapter control is intentionally not an audit completion gate. The
standalone app must first settle a declarative plan and simulation contract;
game-module forcing and conformance belong to the later integration boundary.
