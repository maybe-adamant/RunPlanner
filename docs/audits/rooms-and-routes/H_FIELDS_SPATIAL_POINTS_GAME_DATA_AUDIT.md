# H Fields Spatial Points Game-Data Audit

## Status and scope

Source audit completed on 2026-09-06 against the installed Hades II scripts
and `H_Combat01` through `H_Combat15` map binaries. This document records the
game facts needed to reason about finite, room-scoped physical locations for:

- player entry;
- Fields reward cages; and
- optional Fields rewards.

It also records whether those source facts can support exact authored
assignments such as “Cage 1 uses physical location 4” and a later static-map
visualization. It does not define an authored schema, command vocabulary,
application projection, React layout, delivery gate, migration, module name,
or commit sequence. Those decisions belong to a later grounded plan.

The existing
[Fields optional rewards and Artificer audit](../rewards-and-acquisition/FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md)
remains the primary authority for optional reward chance trials, store
contents, acquisition, and Artificer behavior. The
[room-action order audit](ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md) remains the
primary authority for cage activation and mixed room chronology. This audit
owns the physical point identities, coordinates, runtime assignment contacts,
and spatial discrepancies.

## Evidence snapshot and method

Primary evidence:

- `RoomDataH.lua`: Fields entrance directions, cage limits, and
  `RewardCageSpawnPoints` mappings;
- `RoomLogic.lua`: target-wide cage count, room flipping, cage placement, and
  optional reward placement;
- `RoomPresentation.lua`: player start/end pairing and entry selection;
- `PresentationBiomeH.lua`: Fields use of the standard room entrance;
- `EncounterLogic.lua`: cage-position-to-enemy-spawn-group use; and
- `Maps/bin/H_Combat01.thing_bin` through
  `Maps/bin/H_Combat15.thing_bin`: concrete map objects, group memberships,
  object IDs, and world coordinates.

The installed game-data checkout was based on commit
`fd44f2c86e011c4610e8d50e000e964b8cebf5b9`. `RoomDataH.lua`,
`RoomLogic.lua`, and the audited map binaries were clean relative to that
commit. The checkout contained working-tree changes in `RoomPresentation.lua`
and `EncounterLogic.lua`; the former changed a file marker and an unrelated
death-presentation call, and the latter changed one Ship captain property.
Neither change touched the contacts audited here.

The map binaries were decoded with HadesMapper commit
`1b822578f656c1e6e2ac9ba9e6e054e0d98ce49f`. The decoder exposes each object's
`Id`, `Name`, `GroupNames`, and `Location`. This audit selected:

- objects named `HeroStart` and `HeroEnd`;
- objects named `LootPoint`; and
- objects whose `GroupNames` contain `BonusRewardSpawnPoints`.

Coordinates below are the decoded single-precision world coordinates rounded
to the nearest integer for readable evidence. Object IDs are exact. The map
binaries remain the authority for full-precision values.

## Terms

**Entry point**
: One `HeroStart` and its nearest `HeroEnd`. The start is the initial player
spawn position; the standard Fields entrance moves the player toward the
paired end.

**Cage location**
: One map object named `LootPoint` at which `SpawnRewardCages` may create a
`FieldsRewardCage` and its already-selected reward.

**Optional location**
: One map object belonging to `BonusRewardSpawnPoints` at which the optional
reward pass may create a nonrequired reward.

**Logical slot**
: A reward identity or encounter ordinal such as planner `cage1`, `cage2`,
`cage3`, or `optional1`. Logical slots are not physical map locations.

**Physical point identity**
: The room-scoped identity of one concrete map object. Object IDs are reused
across different maps, so an object ID alone is not a globally unique room
location.

## Verified runtime behavior

### Player entry is selected from a finite start/end set

`GatherRoomPresentationObjects` first honors an explicit
`CurrentRun.NextHeroStartPoint`/`NextHeroEndPoint` pair when one exists.
Otherwise it:

1. obtains and sorts every `HeroStart` and `HeroEnd` in the loaded map;
2. pairs each `HeroStart` with the closest `HeroEnd`;
3. derives an entrance direction from the angle between them;
4. retains pairs compatible with the previous room's `ExitDirection` when
   that direction is known;
5. randomly chooses one eligible pair; and
6. falls back to the first sorted start and end when no eligible pair was
   selected.

The H combat declarations do not supply `NextHeroStartPoint`,
`NextHeroEndPoint`, or `HeroStartPointEndPointLinkIds` overrides. Their ordinary
entry surface is therefore the finite map set inventoried below. Start-room
presentation teleports the player to the chosen `HeroStart` and the standard
Fields entrance then moves the player toward its `HeroEnd`.

The game may horizontally flip a room before load. That changes the displayed
orientation but not the finite source-object membership or the relationships
visible in a complete room image. The intended planner use is identification
of points against an overall room shape, not directional replay, coordinate
arithmetic, travel distance, or pathfinding. Mirroring therefore does not need
to become authored state for this scope.

### Cage offers and cage locations are different facts

The outgoing H decision chooses one target-wide cage count. The ordinary
minimum is two and maximum is three, but the maximum is clamped to the smallest
`MaxCageRewards` value among the prepared target rooms. Each target's logical
cage offers are resolved before that target is entered.

On entry, `SpawnRewardCages` obtains and sorts every map object named
`LootPoint`. For each already-resolved logical cage reward, it removes one
random point from that list and spawns both the cage and reward at the selected
point. Assignment is therefore random without replacement:

- a logical first, second, or third cage has no declaration-fixed physical
  point;
- fewer cages than locations leaves unused cage locations; and
- changing cage activation order does not retroactively change the physical
  placement realized at room entry.

The `RewardCageSpawnPoints` table is a second relationship. It maps the chosen
`LootPoint` ID to an enemy spawn group such as `SpawnPointsA`. When the player
activates that cage, `StartFieldsEncounter` uses the mapping as the encounter's
eligible enemy spawn points. The group does not choose where the cage itself
is placed.

### Optional reward count and optional locations are different facts

After cage creation, `SpawnRewardCages` independently evaluates the four
optional chances `0.95`, `0.75`, `0.50`, and `0.25`. It obtains and sorts every
member of `BonusRewardSpawnPoints`, then removes one random unused point for
each realized optional reward. Assignment is random without replacement.

The number of physical optional locations can exceed the maximum number of
optional rewards:

- `H_Combat03` has five physical points but only four chance trials;
- `H_Combat04` and `H_Combat05` each have seven physical points but only four
  chance trials; and
- rooms with two or three physical points are bounded by those smaller map
  sets.

`BlockMaxBonusRewards` may reserve one physical optional point for a supported
encounter such as `NemesisRandomEvent`. That encounter-specific reduction does
not change the room's underlying point set.

Optional rewards are spawned with `NotRequiredPickup = true`. Physical
placement does not turn them into required interactions and does not alter the
existing room-action chronology.

## Room-level capacity summary

“Cage points” counts all `LootPoint` objects. “Declared cage maximum” is
`MaxCageRewards`, including the inherited value of two for `H_Combat09`.
“Effective optional maximum” is the lesser of four chance trials and the
physical point count before encounter-specific reservation.

| Room         | Entry points | Cage points | Declared cage maximum | Optional points | Effective optional maximum |
| ------------ | -----------: | ----------: | --------------------: | --------------: | -------------------------: |
| `H_Combat01` |            1 |           5 |                     5 |               4 |                          4 |
| `H_Combat02` |            2 |           3 |                     3 |               3 |                          3 |
| `H_Combat03` |            1 |           3 |                     3 |               5 |                          4 |
| `H_Combat04` |            4 |           4 |                     4 |               7 |                          4 |
| `H_Combat05` |            2 |           5 |                     5 |               7 |                          4 |
| `H_Combat06` |            4 |           5 |                     5 |               4 |                          4 |
| `H_Combat07` |            4 |           3 |                     3 |               3 |                          3 |
| `H_Combat08` |            2 |           3 |                     3 |               3 |                          3 |
| `H_Combat09` |            1 |           3 |                     2 |               2 |                          2 |
| `H_Combat10` |            3 |           5 |                     5 |               4 |                          4 |
| `H_Combat11` |            3 |           5 |                     5 |               2 |                          2 |
| `H_Combat12` |            2 |           3 |                     3 |               3 |                          3 |
| `H_Combat13` |            2 |           2 |                     2 |               2 |                          2 |
| `H_Combat14` |            2 |           2 |                     2 |               2 |                          2 |
| `H_Combat15` |            2 |           3 |                     3 |               2 |                          2 |

This matrix proves that neither existing cage capacity nor optional reward
capacity can stand in for physical location count. The source declares two
independent dimensions: how many logical rewards may exist and which physical
points may host them.

## Player entry inventory

Each row lists `HeroStart ID@(x, y) -> HeroEnd ID@(x, y)` and the unflipped
direction derived by the same left/right rule used by the game. Runtime
flipping may reverse the displayed direction.

| Room         | Finite entry pairs                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `H_Combat01` | `755455@(12342, 10759)` -> `755458@(11799, 10491)` (Left)                                                                                                                                                                                |
| `H_Combat02` | `565481@(11418, 11372)` -> `565479@(11885, 11121)` (Right)<br>`622320@(13369, 11664)` -> `622321@(12892, 11395)` (Left)                                                                                                                  |
| `H_Combat03` | `755842@(9890, 9991)` -> `755845@(9349, 9738)` (Left)                                                                                                                                                                                    |
| `H_Combat04` | `755846@(12915, 9437)` -> `755849@(12389, 9171)` (Left)<br>`755851@(1861, 8293)` -> `755853@(2402, 8026)` (Right)<br>`755855@(2476, 10785)` -> `755857@(3010, 10517)` (Right)<br>`755859@(9279, 9551)` -> `755861@(9802, 9288)` (Right)  |
| `H_Combat05` | `755863@(9368, 10536)` -> `755864@(9914, 10286)` (Right)<br>`755866@(18170, 11669)` -> `755869@(17651, 11417)` (Left)                                                                                                                    |
| `H_Combat06` | `755870@(13397, 9641)` -> `755873@(12879, 9372)` (Left)<br>`755874@(14113, 7961)` -> `755877@(13577, 7754)` (Left)<br>`755878@(11005, 9541)` -> `755880@(11508, 9237)` (Right)<br>`755882@(6959, 7708)` -> `755884@(7511, 7470)` (Right) |
| `H_Combat07` | `755813@(8452, 9565)` -> `755815@(8975, 9286)` (Right)<br>`755817@(7753, 8051)` -> `755819@(8280, 7794)` (Right)<br>`755826@(14355, 7778)` -> `755827@(14922, 7614)` (Right)<br>`755829@(16860, 8412)` -> `755832@(16330, 8133)` (Left)  |
| `H_Combat08` | `755829@(7709, 8565)` -> `755832@(8221, 8316)` (Right)<br>`755833@(15929, 7919)` -> `755836@(15379, 7647)` (Left)                                                                                                                        |
| `H_Combat09` | `755837@(15176, 11013)` -> `755840@(14686, 10747)` (Left)                                                                                                                                                                                |
| `H_Combat10` | `755837@(22321, 18442)` -> `755840@(21925, 18081)` (Left)<br>`755841@(24028, 17756)` -> `755844@(23526, 17471)` (Left)<br>`755846@(19145, 17825)` -> `755848@(19668, 17585)` (Right)                                                     |
| `H_Combat11` | `755850@(15143, 16951)` -> `755851@(15631, 16702)` (Right)<br>`755854@(13472, 16489)` -> `755855@(13954, 16232)` (Right)<br>`755857@(18660, 17619)` -> `755860@(18138, 17363)` (Left)                                                    |
| `H_Combat12` | `756049@(20052, 25307)` -> `756051@(19569, 25052)` (Left)<br>`756053@(18396, 26094)` -> `756055@(18809, 25686)` (Right)                                                                                                                  |
| `H_Combat13` | `760458@(13703, 10081)` -> `760464@(13180, 9819)` (Left)<br>`760461@(12726, 10135)` -> `760460@(13175, 9816)` (Right)                                                                                                                    |
| `H_Combat14` | `760468@(13647, 9613)` -> `760466@(14155, 9324)` (Right)<br>`760471@(14664, 9550)` -> `760466@(14155, 9324)` (Left)                                                                                                                      |
| `H_Combat15` | `760468@(11151, 9203)` -> `760466@(11661, 8993)` (Right)<br>`760471@(14675, 9338)` -> `760470@(14239, 9109)` (Left)                                                                                                                      |

## Cage location inventory

The suffix `/A` through `/E` denotes the corresponding
`RewardCageSpawnPoints` enemy group. It does not number logical cages or imply
placement order.

| Room         | Finite `LootPoint` set                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `H_Combat01` | `40055@(6264, 5360)/D`<br>`568803@(7521, 7303)/C`<br>`568804@(7152, 9974)/B`<br>`568805@(9755, 5587)/E`<br>`568806@(10245, 9240)/A`           |
| `H_Combat02` | `621502@(12284, 10136)/A`<br>`622508@(14079, 8691)/B`<br>`622860@(15674, 7894)/C`                                                             |
| `H_Combat03` | `40055@(6837, 7646)/A`<br>`568938@(8722, 7862)/B`<br>`568943@(10960, 7759)/C`                                                                 |
| `H_Combat04` | `569103@(4895, 9546)/C`<br>`573087@(4322, 7008)/D`<br>`573088@(8507, 7279)/B`<br>`573089@(12216, 8751)/A`                                     |
| `H_Combat05` | `573087@(14758, 7466)/A`<br>`621494@(14329, 10395)/D`<br>`621539@(9453, 7763)/E`<br>`622143@(19197, 10553)/C`<br>`622144@(17385, 6390)/B`     |
| `H_Combat06` | `573087@(9187, 8192)/B`<br>`621502@(12339, 6981)/A`<br>`622316@(8544, 5870)/C`<br>`622317@(7983, 3503)/E`<br>`622318@(5177, 5700)/D`          |
| `H_Combat07` | `573087@(9298, 7371)/A`<br>`621494@(16392, 7190)/C`<br>`621503@(12834, 5484)/B`                                                               |
| `H_Combat08` | `573087@(10948, 5979)/C`<br>`621402@(13855, 8369)/A`<br>`621428@(10215, 8608)/B`                                                              |
| `H_Combat09` | `621502@(13504, 10048)/A`<br>`715348@(11988, 8423)/C`<br>`715375@(11397, 9313)/B`                                                             |
| `H_Combat10` | `624446@(19414, 14777)/B`<br>`624455@(22730, 16666)/C`<br>`624464@(21865, 14280)/E`<br>`624473@(24972, 14791)/D`<br>`624513@(19917, 16794)/A` |
| `H_Combat11` | `621502@(17633, 16745)/B`<br>`622748@(13988, 15451)/A`<br>`622753@(15358, 13803)/D`<br>`622758@(17840, 13311)/E`<br>`622768@(18717, 15035)/C` |
| `H_Combat12` | `627077@(20085, 23537)/C`<br>`627110@(17069, 23057)/B`<br>`627112@(16433, 25377)/A`                                                           |
| `H_Combat13` | `621502@(12447, 8763)/unmapped`<br>`715356@(11457, 6668)/B`                                                                                   |
| `H_Combat14` | `621502@(13345, 8364)/A`<br>`736882@(11490, 6938)/B`                                                                                          |
| `H_Combat15` | `621502@(13206, 8578)/C`<br>`737521@(12449, 8108)/B`<br>`737530@(12053, 8756)/A`                                                              |

### `H_Combat13` source discrepancy

`H_Combat13.RewardCageSpawnPoints` declares:

```text
[736880] = "SpawnPointsA"
[715356] = "SpawnPointsB"
```

The installed map instead contains:

- `621502`, a `LootPoint` at `(12447, 8763)` with no table entry;
- `715356`, the correctly mapped `LootPoint` at `(11457, 6668)`; and
- `736880`, an `EnemyPoint` at `(13101, 9991)` belonging to
  `SpawnPoints` and `SpawnPointsA`, not a `LootPoint`.

`SpawnRewardCages` can select `621502` but cannot select `736880` as a cage
location. When the cage at `621502` is activated, the exact
`RewardCageSpawnPoints[rewardCage.SpawnPointId]` lookup has no result, so the
encounter does not receive the declaration-specific `EligibleSpawnPoints`
override. The surrounding nearby-spawn calculation remains present. The
intent behind the mismatched Lua key is not established by the installed
source and must not be silently repaired as a planner fact.

## Optional location inventory

Every listed map object is an `InvisibleTarget` belonging to
`BonusRewardSpawnPoints`.

| Room         | Finite optional-location set                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `H_Combat01` | `685784@(6194, 11353)`<br>`685785@(11609, 7239)`<br>`685786@(8350, 4468)`<br>`685787@(5374, 6725)`                                                                                |
| `H_Combat02` | `572849@(11495, 9521)`<br>`622840@(15634, 8774)`<br>`736792@(12583, 8785)`                                                                                                        |
| `H_Combat03` | `686839@(8229, 9586)`<br>`686840@(6474, 8857)`<br>`686841@(9797, 8151)`<br>`686910@(8107, 6421)`<br>`686939@(11971, 6892)`                                                        |
| `H_Combat04` | `572848@(4143, 11140)`<br>`572849@(7441, 8977)`<br>`572851@(2997, 8451)`<br>`572886@(9333, 7621)`<br>`572888@(10654, 6508)`<br>`572890@(6131, 5965)`<br>`633100@(11143, 9727)`    |
| `H_Combat05` | `572849@(16734, 7578)`<br>`621492@(11710, 6854)`<br>`622138@(11453, 10400)`<br>`622142@(19937, 8067)`<br>`623602@(9758, 6082)`<br>`623964@(14334, 9009)`<br>`623973@(8630, 9136)` |
| `H_Combat06` | `572849@(10931, 7796)`<br>`622428@(10920, 5740)`<br>`622432@(4950, 7086)`<br>`622511@(7979, 6953)`                                                                                |
| `H_Combat07` | `621561@(11000, 7863)`<br>`621563@(14683, 8250)`<br>`621565@(10899, 9929)`                                                                                                        |
| `H_Combat08` | `572849@(8568, 7202)`<br>`621572@(13422, 5824)`<br>`621574@(11809, 7437)`                                                                                                         |
| `H_Combat09` | `572849@(11957, 10228)`<br>`715349@(12947, 8101)`                                                                                                                                 |
| `H_Combat10` | `624525@(20240, 13269)`<br>`624527@(25081, 16278)`<br>`624721@(22390, 12723)`<br>`625847@(17495, 14793)`                                                                          |
| `H_Combat11` | `625917@(15888, 14912)`<br>`627263@(20218, 14225)`                                                                                                                                |
| `H_Combat12` | `627062@(19601, 21935)`<br>`627063@(22222, 24563)`<br>`627093@(14851, 24214)`                                                                                                     |
| `H_Combat13` | `572849@(12945, 6899)`<br>`736822@(11276, 8316)`                                                                                                                                  |
| `H_Combat14` | `572849@(12458, 7878)`<br>`737000@(10101, 6137)`                                                                                                                                  |
| `H_Combat15` | `572849@(14412, 8188)`<br>`737955@(12944, 9627)`                                                                                                                                  |

## Identity and assignment consequences

The source proves three separate finite sets for every H combat map. It does
not prove a fixed relationship between logical reward ordinals and physical
locations. A faithful authored exact outcome must therefore preserve the
difference between:

- a room declaration and its finite physical point sets;
- a repeatable room occurrence;
- a logical cage or optional reward slot owned by that occurrence; and
- the physical point selected for that logical slot in that occurrence.

Within one realized room:

- one player entry pair is selected;
- each realized cage uses a distinct cage location;
- each realized optional reward uses a distinct optional location;
- cage and optional uniqueness are independent because they use different
  source sets; and
- inactive cage slots and unrealized optional slots occupy no physical point.

The source object ID is suitable provenance but not a globally unique key.
For example, `621502` is a `LootPoint` in several H maps and has a different
world coordinate in each one. Any durable physical identity must remain scoped
to its room declaration. Human-facing ordinal names such as “Spawn 1” or
“Location 4” may describe a stable declared ordering, but the ordinal itself
is not a game object identity.

The source coordinates are useful for verifying marker placement, but the
intended product does not need coordinate math. A complete room image makes
the relative shape and point relationships directly visible. Screenshot pixel
positions are properties of a replaceable visual asset and crop, not facts to
persist as part of a run outcome.

## Non-authoritative visual captures

A non-versioned working capture set was observed at
`C:\Users\Mohammed Ayyat\Desktop\Hades\Maps\Field`. It contains all 15 H
combat rooms plus Boss, Bridge, Miniboss, and Preboss captures. Every file is a
2560 by 1440 WebP; the complete set is approximately 5.9 MiB.

`H_Combat01` currently has top and bottom captures, and `H_Combat05` has left
and right captures. The remaining H combat rooms have one capture each. These
images establish that a static whole-room visual is practical, but they are
not game-data authority. Their crops, stitching, incidental actors, and marker
pixel positions may be replaced without changing the source point inventory
or an authored assignment.

## Current planner contact

The current H catalog declares logical cage capacities, three cage slots, and
effective optional reward capacities. The authored Fields occurrence retains
logical cage reward values, a complete optional reward inventory, the active
optional count, and the mixed room-action chronology. It does not declare
entry points, cage locations, optional locations, or occurrence-specific
physical assignments.

This omission is currently explicit in the H and room-action authorities:
physical map positions and travel distance remain outside the implemented
baseline. No existing logical slot can be reinterpreted as a physical
location:

- planner `cage1` through `cage3` identify reward/encounter ownership and
  chronology;
- planner `optional1` through the room capacity identify possible reward
  instances; and
- existing capacity values bound logical reward count, not the number of
  physical host points.

## Planner disposition for a later plan

The installed data is sufficient to support exact authored physical outcomes
without changing reward generation, encounter selection, acquisition, or room
chronology. The durable semantic facts are:

- each room declaration owns finite, room-scoped entry, cage, and optional
  point sets;
- each entered occurrence may select one entry and map each active logical
  cage or optional reward to one distinct point in the matching set;
- physical assignment is orthogonal to reward identity and action order;
- missing or conflicting assignment remains a representable incomplete or
  invalid authored outcome rather than a reason to discard reward state;
- dormant logical values do not consume locations;
- a visual asset may associate the same stable point identities with
  replaceable image-relative marker positions; and
- numeric point labels are presentation vocabulary rather than persisted game
  identity.

The agreed product boundary does not require authored mirroring, distance
values, distance calculation, pathfinding, or automatic route optimization.
The purpose of the later visual is to let the player understand the whole-room
shape and the selected point assignments directly.

## Remaining bounded questions

- The `H_Combat13` `736880`/`621502` mismatch remains unresolved source
  evidence. A later plan must choose whether to expose the observed map point
  with an unmapped enemy group, omit group presentation for that point, or
  wait for corrected game data; it must not invent a corrected source mapping.
- Static capture-to-point marker positions have not been audited. They are
  replaceable visual calibration data rather than game-script facts.
- The current scope does not establish physical points for noncombat H rooms,
  doors, room features, NPCs, resource points, or generated Artificer
  replacements. An Artificer replacement inherits its source object's
  position at runtime, but that fact does not add another independent map
  point.
- The audit does not claim that authored physical assignments can force the
  native game's RNG. It establishes representable exact outcomes for planning
  and later runtime comparison.

## Locked source conclusions

- All 15 H combat maps provide a finite nonempty `HeroStart` set, `LootPoint`
  set, and `BonusRewardSpawnPoints` set.
- Ordinary H combat entry selects one finite start/end pair after directional
  filtering, with a sorted fallback.
- Logical cage offers are prepared before room entry and randomly assigned
  without replacement to `LootPoint` locations on entry.
- The cage point's optional A-E mapping selects enemy spawn groups, not cage
  placement.
- Optional reward count and optional physical placement are separate: up to
  four chance successes are randomly assigned without replacement to the
  map's optional point set.
- Physical point count cannot be inferred from logical reward capacity.
- `H_Combat09` has three cage locations despite a declared maximum of two
  cage rewards.
- `H_Combat03`, `H_Combat04`, and `H_Combat05` have more optional locations
  than their effective maximum optional reward count.
- `H_Combat13` contains a concrete Lua/map mismatch for its A cage enemy group.
- Room-scoped map object identities can support exact occurrence assignments
  and static visual markers without conflating physical position with logical
  reward or encounter ownership.
- Mirroring and distance modeling are unnecessary for the agreed whole-room
  point-visualization scope.
