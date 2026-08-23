# P Game Rules

## Scope and evidence

This document is the game-rule authority for Mount Olympus (`P`) under the
progressed-save static baseline with supported Heracles, Icarus, and Athena combat. Shared picker, door, cap, reward,
occurrence, and completion rules are defined in
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md). Concrete
declarations are the authority for the supported P room set.

The rules were checked against `RoomSets.lua`, `RoomDataP.lua`,
`ObstacleDataP.lua`, encounter data, `RunLogic.lua`, `RoomLogic.lua`, and the
P map data on 2026-07-18. The prior Lua prototype is evidence only.

## Authored shape

P uses the common generated biome envelope:

- `P_Intro` is the fixed authored start and exposes two physical exits.
- Generated batches use the P eligibility and force declarations, with at
  most eight realized ordinary batches and sixteen ordinary target occurrences.
- Each target is a distinct Room Occurrence and retains its declaration-owned
  incoming offer even when it is not selected.
- `P_PreBoss01` is an atomic takeover Preboss. It replaces every normal exit
  of its source in declaration order: the first occurrence owns the World
  Shop and later occurrences own complete free RunProgress offers.
- Selecting a P Preboss closes editable traversal and starts the fixed
  `P_Boss01`, `P_PostBoss01` completion tail.

`P_MiniBoss02` has one exit, so its takeover batch contains only the Shop
occurrence. Two-door predecessors create the Shop plus one free-reward peer.
The occurrence IDs and offer owners remain attached to their physical exit
keys through takeover reconciliation.

After P's eight realized ordinary batches, the declaration-admitted terminal
source may own one zero-target normal decision envelope. It resolves to the
required atomic `P_PreBoss01` takeover rather than a ninth ordinary batch or
target. Takeover support validates every normal exit and the aggregate cap
before it can become required.

## Physical and eligibility facts

P declarations retain the indoor/outdoor compatibility policies from the game
maps. An outdoor source can require an indoor target; this is a target-tag
rule, not a depth predicate. The planner represents possible and forced room
support, not weighted RNG. A positive-chance eligible room remains possible;
a non-empty forced set excludes ordinary candidates for that decision.

The `biomeDepthCache` and `biomeEncounterDepth` effects in the room
declarations are separate lifecycle facts. Creation caps, appearance caps,
and force windows use their own histories. No external profile or save gate
is included in production catalog data.

## Rewards and completion

Ordinary P batches own their declared RunProgress/MetaProgress store choice.
Preboss free offers use the Preboss declaration's counted binding. Shop
inventory is materialized only for the selected Shop occurrence; free offers
are complete at creation time. The Preboss's physical exit and the layout's
completion declarations then provide the derived boss and postboss sequence.

### Physical source and target semantics

P's indoor/outdoor tags are physical-door compatibility facts. The source
declaration supplies the actual numbered exits and target tags determine
whether a candidate can occupy that door. A two-door source creates distinct
occurrences in order; the later target observes earlier creation and cap
history, but only the selected target contributes entered rewards and depth
effects. An apparent indoor/outdoor mismatch is therefore a candidate finding,
not a reason for a UI to rewrite the topology.

The first P batch begins at the fixed two-door Intro. Ordinary combat,
miniboss, Story, Reprieve, and Shop declarations retain their individual
source families, caps, force windows, and concrete reward bindings. A
positive-support declaration is a possible candidate; a non-empty forced set
excludes ordinary peers for that decision. The planner deliberately does not
replay weighted room-set draws.

### Stores, specials, and baseline

Ordinary P batch store choice is authored only where the generated source
policy exposes RunProgress or MetaProgress. Room declarations can still force
their own individual store. A P Preboss free offer is always resolved through
its forced RunProgress binding, even when the source entered through a
MetaProgress batch; the first Preboss occurrence is the entry-time WorldShop.

The supported baseline includes the progressed-save Olympus map
set, physical indoor/outdoor doors, reward producers, force pressure, and the
fixed boss/postboss completion transition. Persistent NPC composition,
NPC events/interactions beyond selected combat, profile-gated variants, natural
Chaos, weighted RNG replay, combat-wave details, rerolls, and optional
interactions remain excluded until modeled explicitly.

P miniboss declarations own their sparse boon-rarity room facts. An eligible
Olympian or Hermes offer materialized in a reached miniboss consumes the room
context through the shared offer-local ledger, including P's higher Duo and
Legendary checks; the biome layer does not simulate a roll.

### Concrete encounter selection

Ordinary P room-local composition uses the game's ordered multiple-encounter
protocol. The declaration supplies an `Intro` first position and a `Combat`
terminal position; preparation chooses and records each active position in
order, and execution starts and completes the prepared prefix in that same
order. `GeneratedP_PreCombat` is a real first encounter phase. It is
non-counting and suppresses encounter-end effects, but it still starts and
completes before the terminal phase.

`HeraclesCombatP` is selectable only from the declaration-bound first-position
support and, when valid, counts for encounter depth and terminates the
remaining Combat suffix through the normalized source
`BlockMultipleEncounters` fact. The trimmed Combat selection remains dormant
and returns unchanged if the Intro selection changes.

`IcarusCombatP` and `AthenaCombatP` are Combat-slot definitions. Their normal
requirements retain the source indoor/outdoor and exact-history distinctions;
Icarus is therefore eligible only on its supported Outdoor Combat surface.
These definitions replace neither P Intro nor room reward ownership. All
requirements operate on exact concrete definition keys, not an NPC-family
ledger.

When either definition is selected and entered, its exact Combat phase owns the
corresponding three-choice trait offer and folds the selected trait at encounter
completion. Athena uses selectable Common/Rare/Epic rarity. Icarus is
player-rarityless, and Latest Model may target one exact eligible equipped
Rank-I Hammer for the shared Rank-II transition.

Encounter completion and encounter-end effects are distinct checkpoints. A
normal P room advances encounter depth once and runs end effects only after the
terminal Combat completes. A successful Fig Leaf result at the eligible Intro
suppresses enemy spawns across both prepared positions without removing either
start/completion identity or the terminal end-effect checkpoint. Heracles runs
one start/completion/end-effect sequence. Encounter-counted Chaos curses and
Experimental Hammer duration consume the end-effect checkpoint, not P phase
names, encounter depth, or completion alone.

The authored model retains the exact `Intro` and `Combat` phase selections,
while the editor presents one occurrence-owned P encounter dialog. The engine
evaluates terminal candidates only after the proposed first choice. Saving a
normal pair or a terminating Heracles choice is one atomic semantic command
and one Undo unit; Fig Leaf, Gorgon, and terminal trait offers remain attached
to their exact phase owners. This presentation adds no P variant or second
composition model.

## Product boundary

Natural Chaos is supported from the declared P source maps as an optional
additional exit beside normal doors. Its source-local biome-depth ceiling and
the host-wide preceding-ten offer spacing remain engine-evaluated; selected
Chaos returns through a fresh ordinary P continuation without changing
normal-door force or Preboss takeover ownership.

The supported product includes catalog normalization, authored topology,
concrete encounter selection, semantic commands, validation, candidates,
workspace projection, and React editing for this envelope. NPC events and
interactions beyond selected combat and other unsupported
detours, and optional player interactions remain outside the canonical P
baseline until they acquire explicit modeled inputs and ownership.
