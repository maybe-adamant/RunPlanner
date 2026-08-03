# N Game Rules

## Scope and evidence

This document is the game-rule authority for Ephyra (`N`) under the
progressed-save, NPC-free baseline. It distinguishes the game's literal route
mechanism from the implemented schema-10 planner normalization. Shared
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

Natural Chaos is outside the supported planner baseline, but its source facts
remain relevant evidence. N permits the natural additional Chaos gate from
Opening; it does not replace the normal PreHub exit. A Chaos room contributes
its own history ordinal and biome-depth step, uses the previous N room set on
return, and can therefore resume N at depth 2. Player-observed behavior reaches
a fresh Hub while skipping PreHub. Static source confirms the counter and
resumed-room-set facts but does not expose a literal `ForceNextRoom = N_Hub`
assignment. Future Chaos support must re-establish its complete runtime and
planner contract from the data present at that time.

The game's fixed links are source evidence. They do not require the planner to
persist a distinct linked-exit family when another authored representation
preserves every supported lifecycle and structural outcome.

## Implemented planner normalization

The implemented model is:

```text
fixed N_Opening01
  -> width-one normal decision at biome depth 1
  -> selected N_PreHub01 occurrence and its RunProgress reward
  -> terminal Hub takeover envelope at biome depth 2
  -> source-bearing persistent HubDecision
```

The Opening decision owns the stable physical exit key `prehub` and a bounded
candidate stage containing only `N_PreHub01`. PreHub is structurally admitted
only through that N entry declaration; other `PreHub`, Hub-slot, side-room, or
N room declarations do not become ordinary targets.

After PreHub lifecycle advances the cache to depth 2, its source owns one
zero-target terminal envelope. That envelope is not another ordinary batch. It
admits only the required Hub takeover, admits no ordinary target or takeover
Preboss, and is atomically replaced by a `HubDecision` carrying the exact
PreHub occurrence source. The Hub's semantic key continues to own its one
derived room, persistent board, open slots, visits, side rooms, restores, and
reward lookup.

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
  -> N_Boss01 -> N_PostBoss01
```

The handoff remains sourced by `{ kind: 'hubDecision', decisionKey: 'hub' }`.
An incomplete Hub exposes no Preboss handoff, while a complete Hub exposes
exactly that one fixed target. The Preboss batch does not replace the Hub node
or make `N_PreBoss01` an occurrence-sourced candidate.

## Authored shape

- `N_Opening01` is the fixed authored start. Its width-one normal decision owns
  the stable `prehub` exit and the selected `N_PreHub01` occurrence.
- The PreHub occurrence owns one exact zero-target terminal envelope. The
  required Hub action atomically replaces it with the persistent Hub decision
  identified by the semantic key `hub`; removing the Hub restores the exact
  envelope.
- The Hub decision records the PreHub occurrence as its source and owns its
  open slot membership and ordered visit list; it does not own room-local
  target state.
- Nine or ten declaration-fixed Hub slots may be open. Exactly six distinct
  open slots are visited in authored order. A target occurrence remains owned
  by its slot while its incoming reward, side rooms, and local entry order
  remain occurrence-owned leaves.
- Completing the six-visit predicate enables the declaration-fixed
  completed-Hub exit.
  Its persisted source is `{ kind: 'hubDecision', decisionKey: 'hub' }` and
  it creates the fixed width-one `N_PreBoss01` Shop occurrence.
- Selecting that Preboss starts the `N_Boss01`, `N_PostBoss01` completion tail.

This is a completed-Hub handoff, not the PreHub-owned terminal envelope or a
Door 1 room choice. The Hub's completion predicate remains the sole authority
for creating it.

## Hub and side-room facts

The Hub restores the same board after every visit. All open main targets
receive their incoming offers when the board is created; only entered targets
acquire those rewards. The supported shop lookup reads the open-board reward
surface before validating the final Preboss shop.

Entered combat targets own zero to three declaration-fixed side slots. Side
generation and entry order are explicit room-local authored state. Generated
side rewards resolve as one unordered sibling batch before entry; their
availability order follows the declaration-backed rank used by the pressure
rule. The pylon gate observes the declared spawn count, while leaving a target
requires its spawned pylon to be completed.

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
rank, and one parent occurrence remains the authority across side-room
restores. Side visits are not Hub visits and must not become a second global
topology or a graph-canvas edge set.

### Canonical baseline and exclusions

N preserves the progressed-save, neutral-boss, NPC-free board behavior,
including the opening and PreHub producers, fixed Hub slots, full-board reward
lookup, pylon rules, side-room pressure, and WorldShop lifecycle. It excludes
the commented midshop assignment, persistent encounter replacements,
save/profile force predicates, natural Chaos, optional actions, and automatic
boss-drop state until they have modeled inputs and owners.

## Product boundary

The product owns N catalog normalization, authored Hub decisions, semantic
commands, validation, candidates, workspace projection, and React editing.
The board is not a graph-canvas authority and no UI position or rendered visit
index is persisted domain state. Weighted RNG, unmodeled combat composition,
NPC variants, natural Chaos, anomalies, and optional player interactions
remain outside the baseline.
