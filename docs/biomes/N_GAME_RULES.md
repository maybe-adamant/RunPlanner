# N Game Rules

## Purpose and Status

This document is the concrete game-rule authority for Ephyra (`N`). It defines
the fixed authored entry rooms, persistent physical hub, ordered pylon visits,
room-local side rooms, repeated restores, and hub-wide reward effects now
represented by the N declarations and active authored Hub plan without
importing the previous Lua control shape.

Shared possibility, reward, occurrence, counted-bag, and fixed-completion
semantics are defined by `../design/GAME_GENERATION_RULES.md`, `../design/REWARD_MODEL.md`, and
`../design/SIMULATION_AND_VALIDATION.md`. N uses the same biome envelope as the linear
biomes: an ordered fixed entry chain, one traversal body, a terminal entry, and
an ordered completion tail. Its `HubBiome` discriminant describes only the
distinct persistent-Hub traversal body. It must not turn the Hub visits into
ordinary generated batches or synthetic authored cycles.

N declarations, the schema-version-5 authored Hub plan, semantic commands,
structural completeness, canonical Hub materialization, exact room lifecycle,
event-folded route history, reward simulation, selected validation, candidate
evaluation, and the Hub editor projection are ported. N is authorable,
simulatable, and editable as the first Surface biome; profiles, recovery,
findings navigation, and candidate projection consume the same normal project
evaluation used by the complete N/O/P/Q route.

## Evidence Status

These rules were verified against the Hades II script extraction and physical
map data on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataN.lua
../../../../1GameData/Scripts/ObstacleDataN.lua
../../../../1GameData/Scripts/EnemyData_Traps.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/EncounterData_Opening.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterData_MiniBoss.lua
../../../../1GameData/Scripts/EncounterData_Story.lua
../../../../1GameData/Scripts/LootData.lua
../../../../1GameData/Scripts/StoreData.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/CombatLogic.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Scripts/UtilityLogic.lua
../../../../1GameData/Maps/bin/
```

The previous Lua declarations and revamp audits are interpreted evidence only.
This audit confirms their hub-and-side-room direction while correcting five
inherited assumptions:

- the hub owns fixed physical room slots; users do not select arbitrary room
  names for hub doors;
- the game opens exactly nine or ten supported hub slots, but only six are
  entered;
- all open hub rewards are generated together and affect later shop support,
  including rewards behind never-entered doors;
- the pylon gate reads the spawn counter, while room completion independently
  requires the spawned pylon to be destroyed before exit;
- fixed entry and terminal rooms may own authored leaf state even though their
  topology and game identity are layout-owned.

Side-room availability ranks are not exposed by the Lua declarations. Runtime
evidence establishes the rank used by the forced-prefix rule for all nine
multi-slot maps. Side rewards resolve together before player entry and are
modeled as an unordered jointly validated batch. The observed ranks and their
model consequences are preserved in `../audits/N_SIDE_ROOM_FINDINGS.md`; the local
evidence gap is closed.

## Feature Projection Map

The disposition vocabulary is defined by `../design/CATALOG_MODEL.md`;
implementation provenance is recorded by
`../progress/MIGRATION_PROVENANCE.md`. N's supported projection is implemented
through the complete authored, simulation, candidate, Hub editor, profile, and
recovery product loop.

| Feature                       | Verified game behavior                                                                                                  | Disposition and planner projection                                                                                                      | Implementation status | Reconsider when                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------ |
| Fixed entry                   | Opening and PreHub are fixed rooms with independent incoming rewards before the hub                                     | **Exact:** fixed authored room slots followed by a derived hub room                                                                     | implemented           | --                                                     |
| Persistent hub                | One physical hub generates one stable offer board and restores it after every visited target                            | **Exact:** one persistent hub batch; returns are derived history events                                                                 | implemented           | --                                                     |
| Hub availability              | Nine or ten physical slots open; Story eligibility and one coin-disabled miniboss modify the candidate set              | **Exact:** author one supported 9/10-slot availability outcome under the canonical baseline                                             | implemented           | --                                                     |
| Pylon visits                  | Exactly six distinct open targets are entered in player-selected order                                                  | **Exact:** six unique visit ordinals over the open slot set                                                                             | implemented           | --                                                     |
| Pylon completion              | Every main target spawns a required pylon; boss-door availability reads six spawns                                      | **Exact:** preserve spawn-counter timing and require six completed visits                                                               | implemented           | --                                                     |
| Hub rewards                   | Every open target receives an incoming offer on initial hub generation; only visited targets acquire it                 | **Exact:** counted dead leaves consume bags; all offers contribute hub reward lookup                                                    | implemented           | --                                                     |
| Side-room offers              | Entered combat rooms own zero to three fixed side slots; generated peers receive offers together                        | **Exact:** bounded local child slots with generated state and entered order                                                             | implemented           | --                                                     |
| Side-room pressure            | A global generated-side-room counter forces a local prefix until half-per-pylon pressure is met, then rolls 30%         | **Exact:** stateful possibility rule over observed availability order                                                                   | implemented           | --                                                     |
| Side reward batch             | All generated siblings receive offers before entry and share duplicate/bag constraints while eligibility remains stable | **Exact:** jointly validate one unordered sibling reward assignment                                                                     | implemented           | --                                                     |
| Side-room restores            | A side room returns to the same persisted parent, which can then enter another generated side room                      | **Exact:** restore events reuse one parent occurrence; no authored cycle                                                                | implemented           | --                                                     |
| Reward-store ratio            | All N rooms ignore Run/Meta ratio counting; supported generated targets resolve declaration-owned stores                | **Exact:** no hub base-store field; keep concrete counted-bag effects                                                                   | implemented           | A supported target consumes an unoverridden base store |
| Preboss shop lookup           | Spell and Hammer shop support reads reward types offered anywhere on the initial hub board                              | **Exact:** derive `hubRewardLookup` from all open hub offers before terminal shop validation                                            | implemented           | --                                                     |
| Miniboss pair                 | One miniboss slot is coin-disabled before the 9/10 selection; the survivor is not guaranteed to open                    | **Exact:** at most one of the two fixed miniboss slots may be open                                                                      | implemented           | --                                                     |
| Story room                    | Medea owns a fixed physical slot, fixed Story producer, required pylon, persistent eligibility, and force pressure      | **Exact spine / deferred progression:** preserve the slot, reward, encounter, and pylon; omit save-profile predicates and NPC internals | implemented           | Persistent NPC state becomes a project input           |
| Midshop room                  | `N_Shop01` is concrete data, but its only physical hub assignment is commented out                                      | **Excluded:** unreachable from the canonical hub                                                                                        | documented boundary   | Game data assigns a live route to the room             |
| Save/profile variants         | Opening encounter, forced reward introductions, Medea force pressure, and boss variant depend on persistent state       | **Excluded:** progressed-save neutral-difficulty baseline                                                                               | documented boundary   | Save-profile state becomes a project input             |
| Boss and postboss             | Neutral Polyphemus follows the shop-only preboss and then `N_PostBoss01`                                                | **Exact:** fixed authored preboss leaf plus derived boss/postboss completion                                                            | implemented           | --                                                     |
| Boss automatic drop           | `MixerNBossDrop` has no modeled downstream ratio consumer                                                               | **Simplified:** no reward leaf, acquisition, or ledger entry                                                                            | implemented           | A downstream consumer makes the fact observable        |
| Persistent encounter variants | Artemis and Heracles can replace ordinary N encounters                                                                  | **Deferred:** suppress under the shared NPC-free baseline                                                                               | documented boundary   | Persistent NPC entities are implemented                |
| Optional interactions         | Natural Chaos, shops, wells, challenges, gathering, rerolls, and postboss interactions add optional state               | **Deferred:** use the shared no-detour/no-action canonical trace                                                                        | documented boundary   | The corresponding authored action enters product scope |

## Canonical Baseline

The supported N projection assumes:

- an ordinary non-dream Surface run beginning in Ephyra;
- a progressed save on which `OpeningGeneratedN` is the opening encounter;
- prior completion of the one-time Surface reward introductions, leaving the
  ordinary filtered RunProgress opening producer;
- neutral boss difficulty selecting `N_Boss01`;
- the eligible Medea hub slot without save-profile force pressure or authored NPC internals,
  and no Artemis or Heracles encounter replacement;
- no natural Chaos or other route-structural detour;
- no optional challenge, well, gathering, reroll, surface-shop, familiar, or
  other deferred action;
- no modeled automatic Polyphemus or weapon-dependent boss drop.

Persistent conditions explain this baseline. They are not production
`unsupported` requirements and do not become authored project fields.

## Layout and Authored Shape

The canonical layout has four segments:

```text
fixed entry chain -> Hub traversal body -> fixed terminal -> completion tail
```

Concretely:

```text
N_Opening01
  -> N_PreHub01
  -> N_Hub
      -> pylon target 1 -> optional side-room visits -> restored N_Hub
      -> pylon target 2 -> optional side-room visits -> restored N_Hub
      -> ...
      -> pylon target 6 -> optional side-room visits -> restored N_Hub
  -> N_PreBoss01
  -> N_Boss01
  -> N_PostBoss01
  -> O_Intro
```

`N_Opening01`, `N_PreHub01`, and `N_PreBoss01` have layout-fixed identities but
own authored reward or shop leaves. They are fixed authored room slots, not
editable topology and not stateless derived rooms. `N_Hub`, its restores, the
main-room restores after side visits, `N_Boss01`, and `N_PostBoss01` are
layout-derived structural history.

Only the body differs from an ordinary biome envelope. Entry, terminal, and
completion placement remain shared domain roles, while their concrete
materialization stays in the typed Hub variant. History orchestration,
single-room lifecycle execution, completion walking, counter folding, and route
transition are shared simulation concerns. The Hub body alone owns one
persistent board, open membership, six ordered target references, parent-local
side excursions, and restores.

`O_Intro` is the next biome's start. It is shown above only to make the route
transition explicit; N's completion sequence ends at `N_PostBoss01`.

One authored hub plan contains:

- exactly nine or ten open fixed hub slots;
- one Room Occurrence and complete incoming reward leaf per open slot;
- exactly six distinct visit ordinals, `1..6`, assigned to open slots;
- bounded side-room state under each open combat occurrence, dormant until
  that parent is visited;
- one fixed authored `N_PreBoss01` occurrence with shop state.

Closed physical slots have catalog declarations but no authored offer
occurrence. Open but unvisited slots are real offered dead leaves. The open-set
size is the authority; a separate persisted `hubDoorCount` would duplicate it.

## Fixed Entry

The progressed-save entry is:

```text
N_Opening01 -> N_PreHub01 -> N_Hub
```

PreHub is the layout-fixed second entry room. Its observed depth follows from
the preceding Opening and declared counter effects; it is not an ordinary room
candidate made selectable by a depth-2 eligibility rule. The fixed entry chain
therefore walks Opening and then PreHub without creating a generated decision
between them.

`N_Opening01` legally selects `OpeningEmpty` or `OpeningGeneratedN` in the raw
game. `OpeningEmpty` is forced only before Apollo has been used or in a dream
run. The canonical progressed-save baseline therefore selects
`OpeningGeneratedN`, which is a counting encounter and spawns the room reward
before its delayed combat.

`N_PreHub01` uses `PreHubGeneratedN`. It receives and acquires a separate
incoming reward, runs one combat, and explicitly does not increment
`biomeEncounterDepth`.

Both rooms use `RunProgress` and exclude Devotion, ordinary Money, ordinary Max
Health, and ordinary Max Mana. Their offers consume the RunProgress counted
bag. Because `BaseN.IgnoreForRewardStoreCount = true`, neither acquisition
updates the Run/Meta ratio ledger.

## Fixed Hub Slots

`N_Hub.PredeterminedDoorRooms` fixes one concrete game room to each physical
door. Under the canonical baseline the supported slot set is:

```text
N_Combat01 .. N_Combat23
N_MiniBoss01
N_MiniBoss02
N_Story01
```

The app must not expose room replacement within one of these slots. A
normalized hub-slot declaration owns a stable semantic slot key, concrete
`gameName`, physical-door evidence for future execution, reward producer, and
side-slot descriptors.

The live fixed mapping is:

| Room           | Physical door ID |
| -------------- | ---------------- |
| `N_Combat01`   | `617113`         |
| `N_Combat02`   | `560725`         |
| `N_Combat03`   | `560702`         |
| `N_Combat04`   | `560707`         |
| `N_Combat05`   | `561337`         |
| `N_Combat06`   | `560708`         |
| `N_Combat07`   | `617138`         |
| `N_Combat08`   | `560699`         |
| `N_Combat09`   | `617012`         |
| `N_Combat10`   | `617151`         |
| `N_Combat11`   | `561449`         |
| `N_Combat12`   | `561389`         |
| `N_Combat13`   | `616992`         |
| `N_Combat14`   | `561403`         |
| `N_Combat15`   | `560705`         |
| `N_Combat16`   | `561354`         |
| `N_Combat17`   | `561424`         |
| `N_Combat18`   | `561374`         |
| `N_Combat19`   | `560620`         |
| `N_Combat20`   | `561418`         |
| `N_Combat21`   | `560713`         |
| `N_Combat22`   | `560776`         |
| `N_Combat23`   | `561368`         |
| `N_MiniBoss01` | `617043`         |
| `N_MiniBoss02` | `560889`         |
| `N_Story01`    | `560848`         |

The commented `N_Shop01` mapping would use `561395`; it is evidence of an
unwired design, not an active canonical slot.

`N_Story01` remains a live authored candidate even though its persistent
requirements and force pressure are outside the canonical save-profile
baseline. The commented `N_Shop01` assignment does not create a live slot.

## Hub Availability

`ChooseAvailableN_HubDoors` runs only once for the persistent hub:

1. choose a total open count of nine or ten;
2. coin-disable exactly one of the two miniboss slots;
3. remove every ineligible room slot;
4. preserve eligible forced rooms and subtract them from the remaining count;
5. choose the rest randomly from the surviving slots;
6. mark every unchosen slot unavailable for the run.

The baseline does not reproduce Medea's save-profile force pressure, so there
are no supported forced hub slots. A valid canonical open set contains exactly
nine or ten combat, miniboss, or Story slots and at most one miniboss. It may
contain neither miniboss and need not contain Story; every surviving slot is an
eligible possibility for the random selection.

This is an authored possibility outcome, not a probability model. The app does
not weight or score one valid open set against another.

## Persistent Hub Reward Board

The hub is an empty, reward-free physical room with
`PersistentExitDoorRewards = true`. When its exits first unlock, the game walks
all open physical doors as one batch and creates every target and incoming
reward. The same `rewardsChosen` batch history is shared across all nine or ten
offers.

Consequences:

- open unvisited counted targets consume counted-bag entries, while the fixed
  Story target consumes no bag;
- open unvisited targets participate in duplicate and requirement checks;
- returning to the hub restores the same targets and rewards without consuming
  the bags again;
- the order in which the player visits targets is independent of reward
  generation order;
- a hub target's `gameName` and reward remain attached to its fixed physical
  slot for the run.

The utility sorter compares these door tables by their common `Name`; Ephyra
doors share that name, so the Lua scripts do not expose a semantic total order
among them. Exact runtime order must be probed before execution-plan
conformance. The authored model nevertheless retains a normalized physical
generation order because counted-bag validation cannot substitute visit order.

On every departure from `N_Hub`, `UpdateHubRewardLookup` records the reward
types present in the full hub offer board. The first departure therefore
records all nine or ten types, including unvisited targets. Later hub restores
do not add new offers.

## Main Target Rewards and Encounters

All 23 combat slots force the counted `HubRewards` store. It contains:

- Big Max Health;
- Big Max Mana;
- Hammer, subject to its current-run requirements;
- Hermes, subject to its current-run requirements;
- Hex, subject to its current-run requirements;
- five duplicate-capable Boon entries.

Those five entries make Ephyra the ordinary door-batch case where simultaneous
Boon offers may repeat a god. Earlier Hub Boon sources participate in both the
peer exclusion and the ordinary four-source cap. On a five-Boon board, the
fifth source can exhaust the cap-narrowed primary pool and trigger the game's
unrestricted fallback, allowing a second Zeus or another repeated source. This
is source-level behavior in addition to the entries' reward-type
`AllowDuplicates` flag.

`N_Combat12` and `N_Combat17` additionally exclude Hammer and Hermes from this
effective store. Their declared Devotion exclusion is inert because Devotion
is not in `HubRewards`; the declared `HephaestusUpgrade` value is a loot source,
not a reward-type member of the bag, and does not filter generic Boon support.

The two miniboss slots force `RunProgress` and admit only Boon. Their
`MaxCreationsThisRun = 1` and `MaxAppearancesThisBiome = 1` remain declaration
facts, although the fixed one-slot hub topology already prevents duplicate
creation in canonical N. `N_MiniBoss01` is the Satyr Crossbow and
`N_MiniBoss02` is the Boar.

`N_BaseMiniBoss.DebugOnly = true` is not picker evidence in this topology. The
hub does not select these rooms through `RoomSetData.N`; it assigns them
directly through live predetermined physical doors before coin-disabling one.
Both miniboss rooms are therefore supported production candidates.

`N_Story01` owns physical door `560848`, fixed reward type `Story`, encounter
`Story_Medea_01`, and the same required Soul Pylon as every other main target.
Its fixed offer participates in the initial board and `hubRewardLookup`, but it
consumes no counted reward bag and produces no concrete loot acquisition. The
Story encounter does not increment `biomeEncounterDepth`. Save-profile
eligibility and `ForceIfUnseenForRuns` remain excluded inputs; detailed Medea
interaction state remains a deferred persistent-NPC feature.

Combat encounter sets contain ordinary generated combat plus Artemis and
Heracles alternatives. The progressed NPC-free projection excludes the NPC
alternatives. GeneratedN, GeneratedN_Smaller, and GeneratedN_Bigger change
enemy composition or difficulty but not a currently modeled reward, counter,
or topology fact, so ordinary main rooms use the shared counting
`SingleCountedCombat` encounter profile without claiming a concrete generated
encounter identity. `EphyraCombat` remains the room template because Soul
Pylons, side rooms, and HubRewards are biome-specific. Both miniboss encounters
also count.

## Pylon Visits and Completion

Every supported main combat or miniboss target inherits `SpawnSoulPylon`.
Entering one increments `CurrentRun.SpawnRecord.SoulPylon` when the pylon unit
is created. The unit is a `RoomRequiredObject`; the room cannot unlock its
exits until that pylon has been destroyed.

The boss door in the restored hub becomes available at six spawned pylons, and
ordinary hub exits are removed at the same threshold. Since each visit must
destroy its pylon before returning, a complete canonical plan contains exactly
six distinct entered-and-cleared main targets. The simulator should preserve
the spawn event before combat completion while its biome-completeness rule
requires all six visits to be complete.

The hub doors close when used, so a main slot cannot be visited twice. Visit
order is authored as a permutation of six distinct members of the open set.
Open slots without a visit ordinal remain offered dead leaves.

## Side-Room Topology

Each combat map owns zero to three fixed local side-room slots in addition to
its return-to-hub exit:

| Parent          | Fixed physical door mappings                                  |
| --------------- | ------------------------------------------------------------- |
| `N_Combat01`    | none                                                          |
| `N_Combat02`    | `558353 -> N_Sub01`, `558352 -> N_Sub03`                      |
| `N_Combat03`    | `558353 -> N_Sub04`                                           |
| `N_Combat04`    | `558834 -> N_Sub02`, `558410 -> N_Sub06`                      |
| `N_Combat05`    | `558354 -> N_Sub02`, `558378 -> N_Sub07`, `558379 -> N_Sub03` |
| `N_Combat06`    | `558378 -> N_Sub10`, `560794 -> N_Sub05`                      |
| `N_Combat07/08` | none                                                          |
| `N_Combat09`    | `566392 -> N_Sub11`, `566536 -> N_Sub08`, `566394 -> N_Sub14` |
| `N_Combat10`    | `558352 -> N_Sub05`, `567015 -> N_Sub09`                      |
| `N_Combat11`    | `558352 -> N_Sub01`                                           |
| `N_Combat12`    | `558352 -> N_Sub09`, `566544 -> N_Sub10`, `566545 -> N_Sub07` |
| `N_Combat13/14` | none                                                          |
| `N_Combat15`    | `657623 -> N_Sub03`                                           |
| `N_Combat16`    | `558352 -> N_Sub04`                                           |
| `N_Combat17`    | `558352 -> N_Sub11`                                           |
| `N_Combat18`    | `658853 -> N_Sub12`                                           |
| `N_Combat19`    | none                                                          |
| `N_Combat20`    | `659508 -> N_Sub06`                                           |
| `N_Combat21`    | none                                                          |
| `N_Combat22`    | `558352 -> N_Sub14`, `661338 -> N_Sub02`                      |
| `N_Combat23`    | `755971 -> N_Sub12`, `755184 -> N_Sub13`, `755185 -> N_Sub15` |

The same `N_SubXX` Room Declaration may occur under several parents. Each
actual side-room identity is the parent main occurrence plus its declared
local slot key. It is not the global game name alone. `BaseN_SubRooms` permits
up to 999 biome appearances, so the same concrete side-room map may be entered
from several different parents in one N plan.

Side doors are evaluated only after an entered parent is resolved. Side state
under an unvisited hub target is dormant and creates no offer. Every local slot
retains a complete reward leaf and one generation state:

```ts
type SideRoomGeneration = 'generated' | 'notGenerated';
```

Generated slots receive their rewards together when the parent exits unlock,
before any side room can be entered. They may then be entered in any authored
order. Each generated slot has either one unique entered ordinal or no ordinal;
a generated unentered slot is an offered dead leaf. A not-generated slot
produces no offer and cannot be entered. Generated and entered counts are
derived from these per-slot facts.

Entering a side room closes that side door. Its return door restores the same
parent occurrence and remaining persistent side offers, allowing another side
room to be entered before returning to the hub. Neither the restored parent nor
the restored hub is a new authored occurrence.

## Side-Room Generation Pressure

The game tracks one route-local `NumSubRoomsSpawned` count for generated side
doors. At pylon visit `p`, each physical side door runs:

```text
minimum = p * 0.5

if generatedSoFar < minimum:
    generate this slot
else:
    generate this slot with 30% chance
```

For a parent with `k` side slots and `S` previously generated slots, the number
forced in that parent is:

```text
min(k, max(0, ceil(p / 2) - S))
```

Every remaining local slot independently has positive support for either
generated or not-generated. If the visited parent lacks enough local capacity,
the global count may remain below `ceil(p / 2)` until a later parent; the
threshold is pressure, not a standalone end-of-visit minimum invariant.

The forced slots are a prefix of the engine's physical obstacle setup order.
That order is not declared by `PredeterminedDoorRooms`. The observed
availability order is:

| Parent       | Availability/setup order        |
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

The runtime-derived ranks and compact probe method are preserved in
`../audits/N_SIDE_ROOM_FINDINGS.md`. Only availability rank enters the catalog and
forced-prefix validator.

## Side-Room Rewards and Encounters

Every side room uses an individual counted store and ignores Run/Meta ratio
counting. The ordinary `SubRoomRewards` bag contains:

- Small Max Mana, Small Max Health, Empty Small Max Health, and Tiny Money;
- Air, Earth, Fire, and Water boosts under their progressed-save unlock;
- Nectar;
- two Bones entries and two Psyche entries;
- two each of ordinary Max Health, Max Mana, Pom, Money, and Minor Talent.

`N_Sub09`, `N_Sub10`, `N_Sub11`, and `N_Sub14` instead use
`SubRoomRewardsHard`, containing two each of ordinary Max Health, Max Mana,
Pom, and Money.

Generated sibling rewards are selected in one parent-exit pass. They share
`rewardsChosen`, so duplicate rules span the full sibling batch, and each draw
mutates its declared counted bag. No supported side reward setup changes game
state used by a later sibling's eligibility. Possibility validation therefore
checks one unordered assignment across the generated slots: each reward must
be supported by its slot's store and filters, the full assignment must satisfy
duplicate rules, and the required bag entries must exist.

All sibling offers are fixed before the first side entry and persistent returns
restore them. Entering A then B or B then A cannot change either offer. With the
same generated slots, entered slots, and rewards, every entry permutation has
the same modeled state at final parent exit. Distinct entered ordinals remain
authored solely for exact room/acquisition history and eventual execution
intent.

The ordinary generated side encounter rejects the normal-size reward family;
the Bigger encounter rejects the small/meta family. Heavy side rooms force the
Bigger encounter. `N_Sub02` may select `Empty`; this changes combat presentation
but not reward offer, acquisition, history, or modeled counter effects.

All supported side-room encounter profiles explicitly do not increment
`biomeEncounterDepth`. Generated unentered side offers consume their counted
bag but produce no acquisition or room-history event.

## Terminal and Completion

After the sixth completed pylon visit, the restored hub exposes the fixed
`N_PreBoss01` transition and removes ordinary hub exits. The preboss is a
shop-only room using `WorldShop`; it has no free-reward sibling or entry mode.
Its room state persists concrete shop offers, purchases, and purchase results.

Before validating the preboss shop, simulation derives `hubRewardLookup` from
the full initial hub offer board. `WorldShop` uses that lookup to suppress Hex
and Hammer options when those reward types appeared anywhere in the hub,
including behind an unvisited door. This is a real cross-room consumer and is
why unpicked hub leaves cannot be discarded.

Neutral difficulty fixes the completion rooms:

```text
N_PreBoss01 -> N_Boss01 -> N_PostBoss01
```

`N_Boss02` is the mutually exclusive boss-difficulty variant and is excluded.
`N_PostBoss01` is reward-free and links the route to `O_Intro`. Its forced
surface shop, fountain use, gathering, gift rack, and other interactions are
deferred under the no-action baseline.

## Canonical History and Counters

Room history must preserve physical restores:

```text
Opening
PreHub
Hub
main target
[side room -> restored main target]...
restored Hub
...
main target 6
[side room -> restored main target]...
restored Hub
PreBoss
Boss
PostBoss
```

This is a normal ordered biome history after structural expansion. The history
walker consumes the fixed entry chain, asks the Hub traversal body for its
ordered room and restore events, then resumes the shared fixed-terminal and
completion-tail walk. The event fold does not need a separate Hub-specific
ledger model.

One Room Occurrence can therefore appear in several history records. An
occurrence identifies one created room entity; it is not a synonym for one
history ordinal. Hub restores and parent restores advance room-history order
and biome-depth cache according to the game while reusing their existing room
state and offers.

Encounter-depth events are narrower:

- `OpeningGeneratedN` increments once;
- `PreHubGeneratedN` does not increment;
- every entered ordinary main combat or miniboss increments once;
- side rooms do not increment;
- restores do not restart or recount completed encounters;
- the fixed authored preboss and derived boss/postboss use their declaration-
  owned encounter semantics.

The simulator must emit the real room-history and encounter events rather than
deriving either counter from a UI row or from visit order alone.

The implemented canonical history composer now emits that exact structure. It
creates Opening, PreHub, the persistent Hub, every open picked or unpicked Hub
target, every generated picked or unpicked local child, the fixed Preboss, and
the derived Boss/Postboss exactly once. Entered main and side rooms execute
their declared lifecycle fragments; parent and Hub restores append appearance,
`biomeDepthCache`, and room-history-ordinal facts without replaying creation,
encounter, required-object, or producer events. One representative six-visit
fixture closes 26 appearances, six Soul Pylon spawn/completion pairs, six
generated side rooms, four parent restores, six Hub restores, and the ordered
biome transition resets.

The implemented shared-biome reconciliation preserves those facts through this
concrete N handoff:

```text
shared entry walk: Opening -> PreHub
  -> Hub body: create Hub/board -> visit/side/restore sequence
  -> return the final restored Hub as terminal predecessor
  -> shared terminal walk: fixed Preboss
  -> shared completion walk: Boss -> Postboss
  -> shared completion/reset/fold
```

Only the middle history handoff remains N-specific. The Hub history body receives
the already entered PreHub and the shared lifecycle/event writer. It returns
the exact room that precedes Preboss after all six visits; it does not emit
biome start, completion, transition resets, or a private folded history. The
shared envelope owns the calls that walk Opening/PreHub and Preboss around that
body, regardless of which source file contains the typed adapters.

Materialization remains variant-owned: the Hub materializer continues to
resolve its fixed authored entries, persistent body, fixed authored Preboss,
and `CanonicalHubBiome` assembly. Only the completion-room primitive is shared.
This is an implementation-ownership change, not a
gameplay, persistence, address, or canonical-snapshot change.

## Declaration and Authored-Model Contract

The N declaration and authored-model contract includes:

- `HubBiome` fixed entry, hub, terminal, and completion descriptors;
- fixed authored room-slot descriptors for layout-owned rooms with leaf state;
- fixed hub-slot declarations with concrete room identity and physical-door
  evidence;
- local side-slot descriptors with availability ranks on combat declarations;
- `HubRewards`, `SubRoomRewards`, and `SubRoomRewardsHard` counted bags;
- explicit hub reward-lookup production and shop-consumer requirements;
- pylon spawn/completion and generated-side-room counters.

The authored model exposes no arbitrary `CreateHubTarget(gameName)` or
`ReplaceOccurrenceRoom` command. It provides semantic replacements for:

- the open fixed-slot set;
- one complete reward leaf per open slot;
- six visit ordinals;
- generated state and entered order for each bounded side slot;
- fixed authored opening, PreHub, and preboss leaf values.

`ClearTopology` may remove the N topology as an explicit destructive action.
Ordinary upstream replacement retains complete leaf values and may temporarily
produce invalid state for the validator to report.

The canonical materializer resolves the fixed authored entry leaves, one
derived persistent Hub and physical offer board, ordered visits, complete
parent-local side slots, the fixed authored Preboss shop, and derived
completion. A visit reuses its board target; entered-side order reuses its
local-slot projections; parent and Hub restores reference those existing room
entities. Generated-but-unentered side slots retain canonical offers, while
not-generated slots retain authored state but produce no canonical offer.

Incomplete N authoring uses the same materializer, lifecycle fold, reward
kernel, and generation validator through the maximum truthful Hub prefix. A
partial open set stops after fixed entry and before board generation. A
complete open set materializes all nine or ten offers as one atomic
`hubOpenSet` region, after which complete authored visits extend coverage in
visit order with their local side state. An unsupported board, main-room
lifecycle, side generation, or entered side-room lifecycle stops derived
coverage at that semantic owner without deleting later authored visits. Only
the complete six-visit form adds fixed Preboss, Boss/Postboss completion,
biome completion, and the O route seed.

## Audit Conclusion

N validates the existing top-level architecture and sharpens its ownership
language. N is a shared biome envelope containing one specialized traversal
body, not a completely separate biome stack. A persistent hub is one authored
offer board with fixed catalog slots, while visit order and history order are
separate derived axes. Local side rooms remain bounded children, and repeated
physical restores do not require graph cycles or duplicate authored room
entities.

The local side-room availability-rank finding is complete. Local rewards are
an unordered joint batch, while player-selected entry order is retained only
for exact history and eventual execution intent. Eventual hub generation-order
conformance remains separate work before a runtime execution protocol is
compiled. It does not require changing the authored identity, reward, or
layout model established here.
