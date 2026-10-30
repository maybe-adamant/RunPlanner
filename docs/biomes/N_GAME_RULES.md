# N Game Rules

## Scope and evidence

This document is the game-rule authority for Ephyra (`N`) under the
progressed-save static baseline with supported Artemis and Heracles combat. It distinguishes the game's literal route
mechanism from the current planner normalization. Shared
occurrence, reward, and completion rules are
defined by
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md). N
declarations own the fixed Opening and PreHub rooms, Hub slots, side-room
descriptors, visit predicate, and completion rooms.

The rules were checked against `RoomSets.lua`, `RoomDataN.lua`, `ObstacleDataN.lua`,
`RoomDataChaos.lua`, Ephyra map data, encounter data, `RunLogic.lua`,
`RoomLogic.lua`, and `RewardLogic.lua`; the entry/counter facts were rechecked
on 2026-08-02.

## Literal game entry model

The game uses fixed linked-room declarations for the normal N entry:

```text
N_Opening01.LinkedRoom -> N_PreHub01
N_PreHub01.LinkedRoom  -> N_Hub
```

Leaving a room inserts it into `RoomHistory` before
`UpdateRunHistoryCache` recomputes `BiomeDepthCache`. Opening establishes biome
depth 1. Leaving PreHub produces the history step `Opening, PreHub` and depth 2.
Entering `N_Hub` then creates the persistent Ephyra board used by the visit
loop.

`N_Opening01` declares `NextRoomSet`, and `GetBiomeDepth` returns 1 while the
current room has one. A Dream entry creates and enters the Opening at depth 1
(the Dream Postboss before it also has `NextRoomSet`) instead of the ordinary
run start's 0, but leaving it reaches depth 1 either way, so PreHub, the Hub
and every later room share the ordinary run's depths.

Natural Chaos is supported as one declared additional exit from `N_Opening01`.
The host policy admits `Chaos_03` or `Chaos_06` (default `Chaos_03`); selected
Chaos reaches the declaration-owned fresh depth-two `N_Hub` takeover while
skipping PreHub. N permits the natural additional Chaos gate from Opening; it
does not replace the normal PreHub exit. A Chaos room contributes its own
history ordinal and biome-depth step, uses the previous N room set on return,
and can therefore resume N at depth 2. Player-observed behavior reaches a fresh
Hub while skipping PreHub. Static source confirms the counter and resumed-room-
set facts but does not expose a literal `ForceNextRoom = N_Hub` assignment.

The game's fixed links are source evidence. They do not require the planner to
persist a distinct linked-exit family when another authored representation
preserves every supported lifecycle and structural outcome.

## Implemented planner normalization

The implemented model is:

```text
fixed N_Opening01
  -> width-one normal decision at biome depth 1
  -> selected N_PreHub01 occurrence and its RunProgress reward
  -> terminal Hub decision-entry envelope at biome depth 2
  -> source-bearing persistent HubDecision
```

The Opening decision owns the stable physical exit key `prehub` and a bounded
candidate stage containing only `N_PreHub01`. PreHub is structurally admitted
only through that N entry declaration; other `PreHub`, Hub-slot, side-room, or
N room declarations do not become ordinary targets.

After PreHub lifecycle advances the cache to depth 2, its source owns one
zero-target terminal envelope. That envelope is not another ordinary batch. Its
generic Door 1 room picker admits only the required Hub candidate, admits no
ordinary target or takeover Preboss, and atomically replaces the envelope with
a `HubDecision` carrying the exact PreHub occurrence source. The Hub's
semantic key continues to own its one derived room, persistent board, open
slots, visits, side rooms, restores, and reward lookup.

This normalization intentionally replaces the literal linked-room mechanism
with planner-observable depth, candidate, source, and lifecycle facts.
The entry and terminal eligibility declarations use depths 1 and 2 on every
route.
Executable fixtures preserve Opening, PreHub, Hub entry, board generation,
visits, rewards, history, completion, and removal/undo behavior.

### Completed-Hub Preboss remains separate

`N_PreBoss01` does not participate in the post-PreHub terminal envelope. Every
Hub owns the completed-Hub chain from the moment it is created:

```text
HubDecision
  -> completed-Hub exit `preboss`
  -> fixed width-one N_PreBoss01 batch
  -> N_Boss01 -> N_PostBoss01 through fixed links
```

The exit is sourced by `{ kind: 'hubDecision', decisionKey: 'hub' }`. While
the Hub fails its open-set and six-visit predicate the chain stays authored but
unreached; a complete Hub reaches exactly that one fixed target. The Preboss
batch does not replace the Hub node or make `N_PreBoss01` an
occurrence-sourced candidate.

## Authored shape

- `N_Opening01` is the fixed authored start. Its width-one normal decision owns
  the stable `prehub` exit and the selected `N_PreHub01` occurrence.
- The PreHub occurrence owns one exact zero-target terminal envelope. The
  required Hub candidate in the generic Door 1 room picker atomically replaces
  it with the persistent Hub decision identified by the semantic key `hub`;
  removing the Hub restores the exact envelope.
- The Hub decision records the PreHub occurrence as its source and owns its
  open slot membership, one ordered action list, and the fountain's Phial
  outcome; it does not own room-local target state.
- Nine or ten declaration-fixed Hub slots may be open. The action list holds
  exactly six distinct open-slot room visits and one fountain use in authored
  order. A target occurrence remains owned
  by its slot while its incoming reward belongs to that occurrence. Its local
  generation and visit order belong to a parent-sourced `LocalVisitDecision`;
  each generated side target is a distinct occurrence.
- Creating the Hub also creates its declaration-fixed completed-Hub exit,
  persisted as `{ kind: 'hubDecision', decisionKey: 'hub' }`, with the fixed
  width-one `N_PreBoss01` Shop occurrence, the ordinary `N_Boss01` and the
  route-position `N_PostBoss01` linked through fixed links. Only removing the
  Hub removes them; board, visit, fountain and slot edits keep them.
- Completing the six-visit predicate makes that chain reachable. Fountain
  placement does not gate reachability, but an unplanned fountain use stops
  assessment before departure.

This is a completed-Hub exit, not the PreHub-owned terminal envelope or a
Door 1 room choice. The Hub's completion predicate is the sole authority for
reaching it.

## Hub and side-room facts

The Hub restores the same board after every visit. All open main targets
receive their incoming offers when the board is created; only entered targets
acquire those rewards. The supported shop lookup reads the open-board reward
surface before validating the final Preboss shop.

Entered combat targets expose zero to three declaration-fixed side slots through
one parent-sourced `LocalVisitDecision`. It owns generation state and visit
order; generated side rewards resolve as one unordered sibling batch before
entry, and their availability order follows the declaration-backed rank used by
the pressure rule. Each generated side target is a normal `RoomOccurrence` with
its own encounter, reward payload, `roomActions.order`, and Room Timeline. The pylon gate observes
the declared spawn count, while leaving a target requires its spawned pylon to
be completed.

### Runtime-derived side-room availability ranks

The following rank order was observed in the Hades II `h2-dev` profile on
2026-07-18 by forcing every local side door to participate in generation and
recording the order in which physical door obstacles ran their availability
checks:

| Parent       | Ranked side rooms               |
| ------------ | ------------------------------- |
| `N_Combat02` | `N_Sub03`, `N_Sub01`            |
| `N_Combat04` | `N_Sub06`, `N_Sub02`            |
| `N_Combat05` | `N_Sub02`, `N_Sub07`, `N_Sub03` |
| `N_Combat06` | `N_Sub05`, `N_Sub10`            |
| `N_Combat09` | `N_Sub08`, `N_Sub11`, `N_Sub14` |
| `N_Combat10` | `N_Sub09`, `N_Sub05`            |
| `N_Combat12` | `N_Sub09`, `N_Sub10`, `N_Sub07` |
| `N_Combat22` | `N_Sub14`, `N_Sub02`            |
| `N_Combat23` | `N_Sub13`, `N_Sub15`, `N_Sub12` |

This table is runtime evidence rather than a second side-room design
authority. The declarations and the surrounding rules above own slot identity,
generation state, pressure, sibling rewards, and entry order; the observed
order is the evidence for the availability-rank input used by those rules.

### Persistent board generation

The Ephyra board is generated once when the Hub opens. The supported outcome
contains nine or ten open declaration-fixed slots, at most one of the two
miniboss slots, and any eligible Story slot under the canonical baseline.
Opening a slot creates a real occurrence and its complete incoming offer even
when that slot is never visited. Revisiting the physical Hub restores the same
board and offers; it does not consume reward bags again or create a second
topology owner. A board-door reroll, legal in any Hub stay for a door whose
room is not yet entered, is the exception: it draws again and its reward
replaces the persisted offer for later stays
([rerolls](../design/REWARD_MODEL.md#rerolls)).

The action list is independent from board generation order. Its room visits
are six distinct open slot keys and it is the only authored traversal order.
Visit ordinals count room visits only. Fixed slot
identity, physical-door evidence, target game name, incoming reward, pylon
requirements, and side-slot descriptors remain catalog facts. The UI must not
offer arbitrary room replacement for one of those slots.

The game's internal order for resolving the already-open board is not authored
state. Order-sensitive offer facts, including ordinary-god peer support, are
validated against the complete board by requiring one supported hidden
generation ordering. The engine then publishes offers in stable declaration
order. It must not substitute the six-room visit list for that hidden ordering:
all board offers exist before the first visit, while only visited targets add
their acquisitions in authored visit order.

The board may contain five `HubRewards` Boons plus the miniboss's forced
`RunProgress` Boon. Because source fallback is resolved while offers are
generated rather than when they are acquired, all six can carry distinct
ordinary sources and all six can subsequently be acquired through the visit
order. The ordinary four-source limit is therefore not a hard Ephyra-board or
post-Ephyra history cap.

Combat targets force `HubRewards`, PreHub and the miniboss targets force
`RunProgress` (the minibosses filtered to Boon), and Story has its fixed
producer, so every supported target resolves offer provenance from its Room
Declaration and the Hub batch uses base-store policy `none`. Those forced
stores are offer provenance only. Native `BaseN` and `BaseN_SubRooms` carry
`IgnoreForRewardStoreCount` ([reward
audit](../audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md#count-exclusions-and-their-inconsistency)),
so every N room declaration—Opening, PreHub, Hub, main targets including the
minibosses, side rooms and completion rooms—records entered-store history
`none`. No N door rolls a base store and no N room banks a store key, so Run
State reports neither a target nor a banked key for N.

Complete selected validation remains atomic across that board. For incremental
authoring, one changed reward is assessed after every other currently authored
peer that can contribute once from the board's pre-generation frontier, with
the proposed reward evaluated last against those identities as one unordered
prior-offer set. Thus a singleton counted reward selected on one door, and an
ordinary god-source peer exclusion, apply to the next door immediately, without
waiting for board completion. An independently invalid
peer remains a precise board finding but is omitted from this focused fold so
unrelated repair stays available. The current selected value retains its
complete-board finding, and visits remain withheld until the authored board as
a whole admits a supported hidden ordering.

All open Hub offers contribute to the
[Hub reward lookup](../design/REWARD_MODEL.md#offered-reward-lookups) before the
final shop is validated. This includes unvisited targets, because the game
creates the full board as one reward region. The Preboss Shop's lookup
therefore cannot be computed from only the six visited entries. The completed
board contributes at Hub departure: earlier checkpoints and the board's own
generation cannot see it, restores are idempotent, later biomes inherit it, and
rebuilding the simulation reconstructs it from authored state.

### Hub fountain

The Hub fountain must be used before leaving the Hub, but its position among
the visits is flexible; the
[room action audit](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md#fountains-persistent-hub-state-and-postboss-cleanup)
owns the source facts.

The planner models one Hub-owned fountain action in the same action list:
initially, after a completed visit and its Hub return, or after the sixth visit
before the Preboss handoff. Within that stay it is ordered among the stay's
board-door rerolls like any of them, before, between or after the presses. It
settles in the Hub at that position, before the next room's entry, reusing
ordinary fountain Phial assessment, consumption, rarity mutation and offer
invalidation. Side-room excursions stay inside their visit.

### Restoration and departures

Restoration returns to the persistent parent or Hub room and its door state
without replaying room entry, encounters or earlier local actions. The planner
therefore treats Hub/main/side traversal and restoration as topology between
distinct entered-occurrence fragments, not additional `roomEntered`,
`encounterStart` or `encounterEnd` events inside one room timeline.

The fountain use emits one `fountainUsed` event in the Hub at its authored
position, owned by the Hub fountain address rather than a room timeline; a
completed visit's return includes its side-room excursions. The next room's
entry therefore observes its rarity and Phial effects. The use replays no Hub
entry or board generation and advances no counter.

Every door use runs native `LeaveRoom`, so history records a `roomDeparted` for
each first exit and for each departure from a restored room: the main room
before each later side room and before the Hub return, and the Hub before each
later visit and after the handoff generation. The Hub's first departure follows
its fountain use rather than its `roomExited`. Each departure records its
`destination`: a first-visit room, a restore, the next biome's first room, or
the run end. A held Silken Sash gains its door armor only on a door into a room
not visited before, which the run's first room and restores are not. The
engine captures canonical Run State at every Hub departure, after any fountain
use in that interval and before its departure clocks. These snapshots are
execution conformance inputs, not additional Run State checkpoints, and exist
even without a trait mutation. Parent and Hub restoration replay no lifecycle
and therefore create no duplicate Run State checkpoint.

### Main targets, pylons, and side rooms

Every visited main target spawns the pylon needed for its departure and for the
six-visit completion predicate. Main-room acquisition, pylon completion, and
the return to the persisted Hub are separate history events.

An entered combat target can expose zero to three declaration-fixed side slots.
Their generation is a parent-local unordered sibling region: all generated
side offers are prepared together, availability pressure follows the declared
rank, and the parent-sourced local-visit decision remains the generation/order
authority across restores. A side door is forced to generate only while the
run's generated side rooms number fewer than half the Soul Pylons already
spawned. Door setup precedes the room's own pylon, so only earlier main visits
count and the first visit has no minimum; otherwise each door generates on a
30% roll. Side visits are not Hub visits and must not become a second global
topology or a graph-canvas edge set.

Every `N_Combat*`, `N_MiniBoss*` and `N_Sub*` room also has a hidden return
door (`EphyraExitDoorReturn`). Its first doors unlock creates a placeholder
room behind it and draws one reward for it before any side door, so later
side-door and RunProgress draws and HubRewards refill timing depend on it;
revisits do not draw. The placeholder and reward are authored on the visit,
and the [Reward Model](../design/REWARD_MODEL.md#hidden-return-door-draws) owns
the draw. `N_PreHub01`'s exit uses the same obstacle but is the real door into
the Hub, which carries no reward.

A side slot retains its complete authored offer when its generation state is
`notGenerated` or its parent target is unvisited; it becomes an active reward
leaf only when the parent detail is active and the slot is generated. Slots
resolve together from `SubRoomRewards` or `SubRoomRewardsHard`: generated
unentered slots consume their bag, while entered slots also acquire. All
generated siblings receive offers before any side room can be entered, share
one same-batch duplicate set and mutate their declared bags, so they are
jointly constrained rather than independent draws. Under the supported side
bags eligibility is stable throughout that pass and no reward setup changes a
sibling's candidates, so possibility validation checks the complete sibling
assignment as an unordered batch; engine iteration order and later entry order
do not change its support. Once entered, however,
each side occurrence owns its own lifecycle; restoring the parent or Hub does
not replay it.

### Native board and restore contacts

The Hub calls `ChooseAvailableN_HubDoors` once to choose its persistent open
board, ordinary exit generation assigns every open door its room and reward,
and `PersistentExitDoorRewards` preserves those offers across later Hub
returns. Visited main rooms use the same persistence for their local doors:
`CheckN_SubRoomDoorUnavailable` decides which declared side doors generate, and
ordinary exit generation assigns each generated side room and reward. The game
records the used door in `DoorRoomHistory`, restores the same parent after a
side visit and eventually the same Hub. These restores are native transitions,
not newly entered planner occurrences.

### Concrete encounter selection

Every N main and side-room occurrence binds its concrete encounter slots explicitly.
Pool-backed main combat phases use `NEncountersDefault`,
`NEncountersSmaller`, or `NEncountersBigger`, each of which supports
`ArtemisCombatN` and `HeraclesCombatN` beside its ordinary definition. Opening,
PreHub, Story, miniboss, Shop, Preboss, and completion bindings remain fixed
or empty and are not NPC candidate surfaces.

Ephyra side rooms own encounter selections on their distinct occurrence and
exact `EncounterPhaseAddress`. Their SubRoom/Light sets and heavy fixed binding
contain only their normalized ordinary or `Empty` identities; generation
exposes the occurrence and its reward, while authored entry activates its
room-local encounter and action workbench. The retained selection remains on
that occurrence if visit order changes. Artemis and Heracles requirements use
exact definition history, not a Hub-specific NPC ledger.

When `ArtemisCombatN` is the selected active main-room definition, its exact
phase owns Artemis's three-choice trait offer. Source chronology acquires that
trait only through the separate post-combat Artemis interaction, which shares
the main occurrence's local action window with its room reward. The current
planner still folds it at encounter completion; the correction is owned by
[`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md).
Heracles and the Ephyra side-room definitions do not declare a trait provider;
this does not create a Hub-wide trait surface.

### Side-room advancement audit

All fifteen `N_Sub01` through `N_Sub15` declarations inherit the same four
counter controls from `BaseN_SubRooms` in `RoomDataN.lua`:

```text
MaintainSpellCharge = true
IgnoreEncounterUses = true
SkipRoomsPerUpgrade = true
SkipGamePhaseTick = true
```

The flags suppress distinct native contacts. They do not make a side room an
unrecorded or non-occurring room.

| State or lifecycle                                                   | Side room advances it? | Source consequence                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoomsEntered`, `RoomHistory`, `RoomCountCache`, raw Run/Biome depth | Yes                    | `StartRoom` records the room name; `LeaveRoom` appends the occurrence and `UpdateRunHistoryCache` recomputes the depth caches. This does not make the side room one of the six Hub visits.                            |
| Encounter completion history                                         | Yes                    | `RunEncounter` completes and records `GeneratedNSubRoom` or `GeneratedNSubRoom_Bigger` normally.                                                                                                                      |
| Encounter-depth counters                                             | No                     | Both generated side-room encounters inherit `CountsForRoomEncounterDepth = false`.                                                                                                                                    |
| `UsesAsEncounters` traits                                            | No                     | `EndEncounterEffects` checks `IgnoreEncounterUses` before reducing them. This includes Chaos encounter curses, Experimental Hammer, pending Shrine deliveries, and encounter-duration Well traits.                    |
| `RoomsPerUpgrade` traits                                             | No                     | `EndEncounterEffects` skips `CheckChamberTraits` when `SkipRoomsPerUpgrade` is set. This includes Steady Growth, Transcendent Embryo, Supply Chain, and other room-upgrade effects.                                   |
| Keepsake rank experience                                             | Yes                    | `AdvanceKeepsake` is called outside both suppressor guards after the side-room encounter ends. This persistent rank progress is not part of the planner simulation.                                                   |
| Keepsake decay/escalation fields guarded with room upgrades          | No                     | The damage decay and escalation loop is inside the `SkipRoomsPerUpgrade` guard.                                                                                                                                       |
| `UsesAsRooms` traits                                                 | Yes                    | `LeaveRoom` reduces these at every door use, restored parent and Hub departures included, regardless of `IgnoreEncounterUses`; the hidden-room-reward Chaos curse and room-use Well effect follow it.                 |
| World `GamePhaseTick`                                                | No                     | First entry is suppressed by `SkipGamePhaseTick`; returning to the already-entered persistent parent is also not a first entry. Garden, cooking, and mailbox progression are outside the planner simulation.          |
| Grouped Hex precharge/reset at the room boundary                     | No                     | `MaintainSpellCharge` prevents the grouped-room charge adjustment.                                                                                                                                                    |
| Hub visit/pylon completion                                           | No                     | Side rooms are child occurrences. They neither consume one of the six authored main visits nor create another Soul Pylon. `HandlePylonObjective` only refreshes the existing objective display.                       |
| Side-room reward and room-end acquisition surface                    | Yes                    | The room keeps its own `SubRoomRewards` or `SubRoomRewardsHard` store and room-end settlement surface. `IgnoreForRewardStoreCount` excludes it from the global Run/Meta ratio; it does not suppress the local reward. |

The resulting planner rule is not a general `sideRoomDoesNotAdvance` switch.
Room/history recording, encounter completion, and local acquisition remain
active, while each clock follows the declaration-backed contact that owns it.
In particular, an immediate Shrine rush can be acquired inside the side room,
but an older pending Shrine delivery does not lose a use there.

Every N side room normalizes `ignoreEncounterUses`, `skipRoomsPerUpgrade` and
`advancesExperimentalHammerUses: false`, so Chaos encounter curses,
Experimental Hammer, encounter-clocked Well traits, pending Shrine deliveries
and `RoomsPerUpgrade` effects do not advance in N side rooms. The audit
deliberately does not turn persistent keepsake XP, world phases, or Hex charge
into new planner state.

The Hub visit list and each parent-local side-room entry list remain topology
between distinct room occurrences. Every entered main or side occurrence owns
its own local room chronology; restoration does not combine them into one
Hub-wide action order or replay already-settled parent actions. Each later
door use out of a restored parent or Hub is still a native `LeaveRoom`, and its
`roomDeparted` contact advances room-departure clocks without repeating room
exit.

### Canonical baseline and exclusions

N preserves the progressed-save, neutral-boss board behavior,
including the opening and PreHub producers, fixed Hub slots, full-board reward
lookup, pylon rules, side-room pressure, and WorldShop lifecycle. It excludes
the commented midshop assignment, other NPC random/interaction or Shop/Bridge
behavior, save/profile force predicates, optional actions, and
automatic boss-drop state until they have modeled inputs and owners.

N miniboss declarations own their sparse boon-rarity room fact. An eligible
Olympian or Hermes offer materialized in one of those rooms consumes the room override;
the model does not attach it only to the miniboss's incoming reward or infer it
from the N route.

## Product boundary

The product owns N catalog normalization, authored Hub decisions, concrete
encounter selection, semantic commands, validation, candidates, workspace
projection, and React editing. The board is not a graph-canvas authority and
no UI position or rendered visit index is persisted domain state. Weighted RNG,
unmodeled combat composition, NPC events/interactions beyond selected combat,
anomalies and optional player interactions remain outside the
baseline.
