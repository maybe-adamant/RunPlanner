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
Executable fixtures preserve Opening, PreHub, Hub entry, board generation,
visits, rewards, history, completion, and removal/undo behavior.

### Completed-Hub Preboss remains separate

`N_PreBoss01` does not participate in the post-PreHub terminal envelope. A Hub
that satisfies its open-set and six-visit predicate owns the existing
completed-Hub frontier:

```text
complete HubDecision
  -> completed-Hub exit `preboss`
  -> fixed width-one N_PreBoss01 takeover batch
  -> N_Boss01 -> N_PostBoss01 through fixed links
```

The handoff remains sourced by `{ kind: 'hubDecision', decisionKey: 'hub' }`.
An incomplete Hub exposes no Preboss handoff, while a complete Hub exposes
exactly that one fixed target. The Preboss batch does not replace the Hub node
or make `N_PreBoss01` an occurrence-sourced candidate.

## Authored shape

- `N_Opening01` is the fixed authored start. Its width-one normal decision owns
  the stable `prehub` exit and the selected `N_PreHub01` occurrence.
- The PreHub occurrence owns one exact zero-target terminal envelope. The
  required Hub candidate in the generic Door 1 room picker atomically replaces
  it with the persistent Hub decision identified by the semantic key `hub`;
  removing the Hub restores the exact envelope.
- The Hub decision records the PreHub occurrence as its source and owns its
  open slot membership and ordered visit list; it does not own room-local
  target state.
- Nine or ten declaration-fixed Hub slots may be open. Exactly six distinct
  open slots are visited in authored order. A target occurrence remains owned
  by its slot while its incoming reward belongs to that occurrence. Its local
  generation and visit order belong to a parent-sourced `LocalVisitDecision`;
  each generated side target is a distinct occurrence.
- Completing the six-visit predicate enables the declaration-fixed
  completed-Hub exit.
  Its persisted source is `{ kind: 'hubDecision', decisionKey: 'hub' }` and
  it creates the fixed width-one `N_PreBoss01` Shop occurrence.
- Selecting that Preboss creates the ordinary `N_Boss01` and route-position
  `N_PostBoss01` occurrences through fixed links.

This is a completed-Hub handoff, not the PreHub-owned terminal envelope or a
Door 1 room choice. The Hub's completion predicate remains the sole authority
for creating it.

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
topology owner.

The visit list is independent from board generation order. It contains six
distinct open slot keys and is the only authored traversal order. Fixed slot
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

Complete selected validation remains atomic across that board. For incremental
authoring, one changed reward is assessed after every other currently authored
peer that can contribute once from the board's pre-generation frontier. Thus a
singleton counted reward selected on one door is unavailable on the next door
immediately, without waiting for board completion. An independently invalid
peer remains a precise board finding but is omitted from this focused fold so
unrelated repair stays available. The current selected value retains its
complete-board finding, and visits remain withheld until the authored board as
a whole admits a supported hidden ordering.

All open Hub offers contribute to the Hub reward lookup before the final shop
is validated. This includes unvisited targets, because the game creates the
full board as one reward region. The Preboss Shop's lookup therefore cannot be
computed from only the six visited entries.

### Main targets, pylons, and side rooms

Combat slots resolve their declared `HubRewards` support; Story has its fixed
producer and miniboss declarations retain their own forced RunProgress facts.
Every visited main target spawns the pylon needed for its departure and for the
six-visit completion predicate. Main-room acquisition, pylon completion, and
the return to the persisted Hub are separate history events.

An entered combat target can expose zero to three declaration-fixed side slots.
Their generation is a parent-local unordered sibling region: all generated
side offers are prepared together, availability pressure follows the declared
rank, and the parent-sourced local-visit decision remains the generation/order
authority across restores. Side visits are not Hub visits and must not become
a second global topology or a graph-canvas edge set. Once entered, however,
each side occurrence owns its own lifecycle; restoring the parent or Hub does
not replay it.

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

The Hub visit list and each parent-local side-room entry list remain topology
between distinct room occurrences. Every entered main or side occurrence owns
its own local room chronology; restoration does not combine them into one
Hub-wide action order or replay already-settled parent actions.

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
