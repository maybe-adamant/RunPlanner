# Noncombat Encounter Identity Audit

## Status and scope

This audit settles how native Hades II noncombat encounters map to planner
Encounter Envelopes and to the game executor's room-entry proof. It focuses on
the room families whose presentation can make them look as though they have no
encounter: fixed biome intros, fountains, Story rooms, Shops, Preboss rooms,
Postboss rooms, and the Ephyra Hub.

The evidence was checked on 2026-09-06 against installed Hades II build
`24556151` in:

- `RoomLogic.lua`, especially `StartRoom`, `StartEncounter`,
  `EndEncounterEffects`, `SetupRoomMultipleEncountersData`, and
  `RecordEncounter`;
- `RunLogic.lua`, especially `ChooseEncounter`;
- `EncounterData.lua`, `EncounterData_Unique.lua`, and
  `EncounterData_Story.lua`;
- `RoomDataF.lua` through `RoomDataQ.lua` and `RoomDataChaos.lua`; and
- the current catalog room, encounter, and lifecycle declarations.

This is an encounter-identity and lifecycle audit. It does not redefine room
rewards, Shop inventory, room features, NPC interactions, route topology, or
the player-facing Timeline.

## Native lifecycle facts

`ChooseEncounter` selects and copies a concrete Encounter whenever a room has
a legal encounter. `StartRoom` then calls `StartEncounter` for that object.
For a `NonCombat` encounter, `StartEncounter` omits ordinary combat-start
effects, but the concrete Encounter identity still exists in native room state.

`Empty`, `Shop`, and `TyphonShop` do not set
`CountsForRoomEncounterDepth`. None advances room, biome, or run Encounter
Depth. `BiomeDepthCache` is derived from Room History and is likewise
independent of these keys. Their native differences are setup behavior and
identity caches: `Shop` supplies its timer, package, and shopping-event fields;
`TyphonShop` changes the speaker set; and `Empty` omits those Shop fields.

Shop construction remains separate from Encounter identity. The I Preboss
rooms demonstrate this directly: they use `StoreDataName = "I_WorldShop"` and
`ShopRoomEvents` while their legal native Encounter is `Empty`, not `Shop`. Q
uses `TyphonShop`, whose declaration-local addition over `Shop` is its Hermes
and Selene speaker set. These are not player-facing encounter choices, but they
are concrete native Encounter objects.

## Supported room-family matrix

| Room family            | Native encounter identity                     | Planner disposition                                                     |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| fixed G/H/I/O/Q intros | `Empty`                                       | zero planner phases plus one declaration-owned unmodeled native carrier |
| Ephyra Hub             | `Empty` on actual entry                       | zero planner phases plus one declaration-owned unmodeled native carrier |
| P intro                | selected from combat variants and `Empty`     | retain the selected concrete identity                                   |
| Reprieve / fountain    | `HealthRestore`                               | retain exact identity                                                   |
| Story                  | exact `Story_*` identity                      | retain exact identity                                                   |
| ordinary Midshop       | `Shop`                                        | retain exact identity                                                   |
| F/G/H/N/O/P Preboss    | `Shop`                                        | retain exact identity                                                   |
| I Preboss              | `Empty`                                       | retain exact identity while the room separately owns `I_WorldShop`      |
| Q Preboss              | `TyphonShop`                                  | retain exact identity while the room separately owns `Q_WorldShop`      |
| ordinary Postboss      | `Empty`                                       | retain exact identity                                                   |
| F Postboss             | source `Story_Chronos_01`, inheriting `Empty` | deliberate progressed-save normalization to retained `Empty`            |

I and Q do not expose a supported standard-route Postboss occurrence. Their
source-only ending or progression rooms do not expand the current route
catalog.

## Other noncombat identities

- `Chaos_01..06` select `Empty_Chaos`, a distinct carrier that owns the Chaos
  acquisition lifecycle.
- `N_Sub02` may select `Empty` from `NEncountersSubRoomLight`; that selected
  side-room outcome remains a concrete encounter.
- `NemesisRandomEvent` has its own required interaction and reward-suppression
  behavior.
- `OpeningEmpty` in F/N and `PIntroDreamRunEmpty` remain outside current
  progressed-save or non-Dream authoring support.
- Encounter identity and encounter-depth behavior are independent. Non-counting
  combat, noncombat, Story, and Boss identities must not be erased merely
  because they do not advance Encounter Depth.

## Planner-to-executor contract

The catalog may declare `unmodeledEncounterKeys` only for an envelope with no
modeled slots. Materialization carries that declaration-owned list without
turning it into a simulated phase. The two inputs cannot coexist. This leaves
persisted encounter authorship and simulation history unchanged.

The execution plan publishes modeled phases in `overview.encounterPhases` and
only publishes `overview.unmodeledEncounterKeys` when native carriers were
deliberately omitted from that phase list. The executor compares exactly one of
those two lists to native state by order, cardinality, and concrete encounter
key. It has no room-name aliases, inherited Encounter aliases, or special
`Empty` normalization. Timeline hooks continue to bind only the modeled phase
list, so an unmodeled carrier cannot create a fake lifecycle window or
transaction.

## Settled disposition

Native encounter identity is declaration data. Simulation relevance is
lifecycle data. Keeping the execution carrier list distinct from modeled
phases lets the planner publish exact `Empty`, `Shop`, `TyphonShop`,
`HealthRestore`, Story, and other identities without inventing timeline effects
for sim-neutral native work. The executor remains a literal parser and exact
comparer rather than owning a normalization table.
