# O Game Rules

## Purpose and Status

This document is the concrete game-rule authority for the Rift of Thessaly
(`O`). It defines the ordered
multi-encounter rooms, phase-owned reward wheels, source-derived generated
stores, and encounter-depth asymmetry can pressure-test the shared model
without importing the previous Lua control shape.

Shared picker, physical-door, cap, force, offer/acquisition, occurrence,
counted-bag, generated-store, direct-preboss, and fixed-completion semantics
are defined by `../GAME_GENERATION_RULES.md`, `../ROOM_LIFECYCLE_MODEL.md`, and
`../REWARD_MODEL.md`. O remains a `LinearBiome`. Its combat occurrences add
bounded phase-owned offer points to an ordered room lifecycle; they do not turn
the top-level biome into a graph or move outgoing topology into the room leaf.

O declarations and focused parity fixtures are ported. O intentionally remains
non-authorable, non-simulatable, and non-editable until its complete product
loop is implemented.

## Evidence Status

These rules were verified against the Hades II script extraction and physical
map data on 2026-07-18. Primary sources are:

```text
../../../../1GameData/Scripts/RoomSets.lua
../../../../1GameData/Scripts/RoomDataO.lua
../../../../1GameData/Scripts/EncounterSets.lua
../../../../1GameData/Scripts/EncounterData.lua
../../../../1GameData/Scripts/EncounterData_Generated.lua
../../../../1GameData/Scripts/EncounterData_MiniBoss.lua
../../../../1GameData/Scripts/EncounterData_Devotion.lua
../../../../1GameData/Scripts/EncounterData_Story.lua
../../../../1GameData/Scripts/EncounterData_Unique.lua
../../../../1GameData/Scripts/LootData.lua
../../../../1GameData/Scripts/RunData.lua
../../../../1GameData/Scripts/RunLogic.lua
../../../../1GameData/Scripts/RoomLogic.lua
../../../../1GameData/Scripts/RewardLogic.lua
../../../../1GameData/Maps/bin/
```

The previous Lua declarations and revamp audits are interpreted evidence only.
This audit retains their verified ShipCombat phase shape but corrects one
important eligibility error: a child `GameStateRequirements` table replaces
the inherited table unless it explicitly requests append/prepend behavior.
Consequently `O_Combat04`, `O_Combat07`, `O_Combat11`, and `O_Combat15` do not
inherit the common recent-ship-room requirement.

## Feature Projection Map

The disposition vocabulary is defined by `../CATALOG_MODEL.md`; implementation
coverage is defined by `../MIGRATION_PROVENANCE.md`. O currently has normalized
declaration coverage only.

| Feature                     | Verified game behavior                                                                                                        | Disposition and planner projection                                                           | Current coverage | Reconsider when                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| Linear entered spine        | Fixed intro, six entered preterminal rooms, then direct preboss                                                               | **Exact:** `LinearBiome` with one necessarily picked target per ordinary batch               | declared         | --                                                           |
| Room-set weights            | Every supported room occurs once except Story, which occurs twice                                                             | **Simplified:** preserve support and forced pools, never likelihood                          | documented       | Probability analysis or seeded replay becomes a product goal |
| Physical exits              | Every supported preterminal source has one `ShipsExitDoor`                                                                    | **Exact:** one ordered physical target and no top-level unpicked peer                        | declared         | --                                                           |
| Ship encounter sequence     | Intro plus one mandatory and one conditionally present counting combat are prepared before room entry                         | **Exact:** ordered `ShipCombat` profile with one optional phase                              | declared         | --                                                           |
| Ship wheels                 | Each counting combat independently offers one or two rewards from one selected Run/Meta store, then acquires one after combat | **Exact:** one bounded room-owned offer point per counting phase                             | declared         | --                                                           |
| Outgoing store provenance   | The final active wheel's selected store becomes the source room's outgoing generated-batch base store                         | **Exact:** batch reads a source-offer-point store and never persists a competing copy        | declared         | --                                                           |
| Combat streak restrictions  | Ordinary, early-only, and late-backup maps use three different eligibility families                                           | **Exact:** declaration-owned predicates after game inheritance                               | declared         | --                                                           |
| Special-room depth behavior | Shop, Story, Reprieve, Devotion, and minibosses depend on distinct BDC/BED and current-run histories                          | **Exact:** normalized current-run requirements and force pools                               | declared         | --                                                           |
| Miniboss encounter depth    | Charybdis is non-counting; Captain is counting                                                                                | **Exact:** separate encounter profiles                                                       | declared         | --                                                           |
| Direct preboss              | One forced shop-only preboss follows the sixth preterminal room                                                               | **Exact:** single-target terminal policy, not shop-then-fill                                 | declared         | --                                                           |
| Boss and postboss           | Neutral Eris links through `O_PostBoss01` to `P_Intro`                                                                        | **Exact:** declaration-driven derived completion sequence                                    | declared         | --                                                           |
| Boss store history          | Eris's Mixer drop is outside the reward surface, but the entered boss records the store resolved for its linked offer         | **Exact:** resolved-store ledger entry without a boss reward leaf or counted-bag acquisition | declared         | --                                                           |
| Save/profile variants       | Intro reward, first-time encounters, Story, fountain, miniboss, and boss variant availability depend on persistent state      | **Excluded:** progressed-save neutral-difficulty baseline                                    | documented       | Save-profile or difficulty state becomes a project input     |
| Persistent NPC replacements | Heracles or Icarus can replace phases, truncate the sequence, and change counters or rewards                                  | **Deferred:** omit and suppress under the shared NPC-free baseline                           | documented       | Persistent NPC entities are implemented                      |
| Optional interactions       | Natural Chaos, wells, challenges, gathering, shops, rerolls, and familiar events add optional structure or state              | **Deferred:** use the shared no-detour/no-action canonical trace                             | documented       | The corresponding authored action enters product scope       |

## Possibility Contract

O uses the possibility-only picker and reward contracts from
`../GAME_GENERATION_RULES.md` and `../REWARD_MODEL.md`. The Story declaration's
second room-set entry changes random weight only. The second ship combat's
`0.6` chance and a wheel's `0.8` two-offer chance likewise make both outcomes
possible; the app does not score their likelihood.

Every supported O source has one physical exit. Every ordinary batch therefore
creates exactly one target occurrence and that target is necessarily picked.
There are no ordinary unpicked O peers, but occurrence identity remains the
shared cross-biome representation.

All O rooms inherit `MaxAppearancesThisBiome = 1`. Once the single target is
entered, that concrete map cannot appear again in O. Combat rooms have no
creation cap, but the one-exit structure means they cannot be created without
also being entered. Special rooms additionally use explicit one-creation caps
where declared.

## Canonical Baseline

The supported O projection assumes:

- an ordinary non-dream Surface run arriving from `N_PostBoss01`;
- a progressed save with normal room and encounter variants available;
- the neutral boss-difficulty setting;
- no Heracles or Icarus encounter replacement;
- no natural Chaos or other route-structural detour;
- no challenge, well, gathering, reroll, familiar-progression, or other
  deferred optional action;
- no modeled automatic Eris or weapon-dependent boss drop.

Persistent conditions explain the baseline. They are not production
`unsupported` requirements and do not become authored project fields.

## Layout and Entered Sequence

O has a fixed intro followed by exactly six selected preterminal rooms before
the terminal transition:

```text
O_Intro
  -> entered room 1
  -> entered room 2
  -> entered room 3
  -> entered room 4
  -> entered room 5
  -> entered room 6
  -> O_PreBoss01
  -> O_Boss01
  -> O_PostBoss01
  -> P_Intro
```

`O_PreBoss01` becomes eligible and reaches must-force pressure while the sixth
preterminal room is the current source at `biomeDepthCache == 7`. A valid
spine therefore terminates there. The authored ordinary bound is six
single-target batches and six ordinary target occurrences. The separately
bounded terminal transition then contributes the picked preboss occurrence.

The preboss map's own fixed boss exit and the boss's fixed postboss exit belong
to the layout's derived completion sequence, not authored continuation state.

## Physical Exits

Every supported editable O room has one `ShipsExitDoor`:

- `O_Intro`;
- `O_Combat01..15`;
- `O_MiniBoss01..02`;
- `O_Shop01`;
- `O_Reprieve01`;
- `O_Story01`;
- `O_Devotion01`;
- `O_PreBoss01`.

Wheel offer count is unrelated to physical exit count. One ship room can show
two wheel rewards while still owning one outgoing room target. The layout and
Room Declarations retain the one physical exit; the room occurrence owns its
internal wheels.

## ShipCombat Encounter Profile

All fifteen O combat maps use one ordered canonical profile:

```text
Intro    GeneratedO_Intro01  non-counting  no wheel
Combat1 GeneratedO          counting      wheel1
Combat2 GeneratedO          counting      wheel2, optional
```

The game prepares the complete sequence during transition into the room,
before the room becomes current and before any phase starts. It evaluates
Combat2 presence against the pre-room history view:

```text
Combat2 is possible when 2 <= preRoom.biomeEncounterDepth <= 5
Combat2 is absent outside that range
```

The planner persists one semantic occurrence value selecting two or three
total phases. Two means Intro plus Combat1; three means Intro plus Combat1 plus
Combat2. The value remains authored so a structurally complete but
context-invalid choice can receive a finding instead of being silently
coerced.

The raw game encounter sets are not planner domains:

- `OEncountersIntros` also contains progression-only
  `GeneratedO_Intro01_First` and Heracles variants;
- `OEncountersDefault` also contains progression-only `DeadSeaIntro` and
  Icarus variants.

The canonical NPC-free progressed-save profile selects
`GeneratedO_Intro01` and `GeneratedO`. Future persistent NPC composition must
replace an addressed phase before materialization rather than append an NPC
side channel after history is built.

### Encounter and Wheel Timing

The canonical event order for every active counting phase is:

```text
encounter.start
  -> biomeEncounterDepth += 1
  -> wheel store selected
  -> one or two resolved reward offers
  -> one wheel choice selected
  -> combat
  -> selected reward spawned and acquired
  -> next phase may start
```

The Intro phase starts but does not increment `biomeEncounterDepth` and skips
wheel setup. Combat1 always contributes one increment. Combat2 contributes a
second increment when active.

The phase list is recorded during room preparation, but target-room
eligibility has already been evaluated for that transition. No internal O
phase can make its own room newly eligible after entry.

### Wheel State and Reward Lifecycle

Each active wheel owns:

- one selected `RunProgress` or `MetaProgress` store;
- one or two complete resolved reward offers;
- one picked offer index.

All offers on one wheel share its selected store. They consume one shared
counted bag in physical wheel-option order. An unpicked wheel option remains a
real offer and consumes its compatible bag entry, while only the picked option
produces an acquisition event.

The room occurrence owns stable bounded `wheel1` and `wheel2` values. When
Combat2 is absent, `wheel2` remains complete dormant authored state and emits
no offer, acquisition, counter, or store-ledger event.

RunProgress Devotion is impossible on a ship wheel. Its counted-bag entry
requires at least two currently offered physical exits, while every supported
O room has one. This is a structural support rule, not an O room-declared
negative reward filter. The fixed `O_Devotion01` producer bypasses the
counted-bag entry requirement.

### Outgoing Generated-Store Authority

Room start initially selects the store that would seed its outgoing generated
batch. Every active wheel selects a new store and overwrites that value. The
final active wheel therefore supplies the actual initial store used when the
room's outgoing target is generated:

```text
two-phase room   -> wheel1.storeKey
three-phase room -> wheel2.storeKey
```

The outgoing generated batch does not author or persist a second copy. Its
normalized store policy is `sourceOfferPoint`, addressed to the source
occurrence's last active ShipCombat wheel. The batch still owns its target,
picked state, and any policy-specific batch state. Forced or individual target
store overrides then apply through the shared two-pass algorithm.

An outgoing batch from a non-ShipCombat O source uses the ordinary
`authoredBaseStore` policy because the source's room-start selection is not
otherwise represented by a local offer point. This source-sensitive policy is
selected from normalized layout and Room Declaration facts; persisted project
state never authors the policy kind.

## Combat Eligibility Families

Game inheritance is authoritative. A child requirements table replaces its
parent table unless append/prepend behavior is explicitly requested. The O
combat declarations consequently form three families.

### Ordinary Recent-Phase Family

These maps require fewer than three ShipCombat Intro phases among the current
source room and the previous two entered rooms:

```text
O_Combat01 O_Combat02 O_Combat03
O_Combat05 O_Combat06
O_Combat08 O_Combat09 O_Combat10
O_Combat12 O_Combat14
```

Every canonical entered ShipCombat room contributes exactly one such Intro
phase, independent of whether Combat2 is active.

### Early Family

These maps require only `biomeDepthCache <= 3`:

```text
O_Combat04 O_Combat07 O_Combat11 O_Combat15
```

They do not also carry the common recent-phase rule. The prior Lua planner's
composed `All` requirement was not faithful to the game's inheritance
semantics and must not be ported.

### Late Backup

`O_Combat13` is eligible only when:

- the current source plus previous two rooms contain at least three
  ShipCombat Intro phases; and
- `biomeDepthCache >= 6`.

Its own requirement table replaces the common `< 3` table. It is the late
fallback immediately before the forced preboss, not an ordinary combat member
with an extra condition.

## Minibosses

`O_MiniBoss01` and `O_MiniBoss02` are eligible from
`biomeDepthCache` 3 through 5 and reject the other miniboss after it has been
entered. Both force a RunProgress Boon, have one physical exit, and have one-
creation and one-appearance caps.

Their encounter-depth effects differ:

| Room           | Canonical encounter | BED effect |
| -------------- | ------------------- | ---------- |
| `O_MiniBoss01` | `MiniBossCharybdis` | zero       |
| `O_MiniBoss02` | `MiniBossCaptain`   | one        |

Charybdis's `AlwaysForceRequirements` applies only before that encounter has
ever occurred in the save. The progressed-save baseline omits this first-time
force rule rather than turning it into an unconditional depth-3 force.

Captain's raw eligibility requires Charybdis to have been completed on the
save. That gate is satisfied by the baseline and omitted from the production
predicate. Both miniboss declarations therefore remain possible candidates in
their current-run depth window.

## Shop and Story

`O_Shop01` and `O_Story01` both retain:

- `biomeEncounterDepth > 3`;
- `biomeDepthCache <= 5`;
- one creation per run;
- a shared depth-5 forced-pool condition when neither has been entered.

When both are eligible at BDC 5 and neither has been entered, both enter the
forced pool and either is possible. The force condition does not guarantee one
of them in every possible O history: if BED is still at most three, both fail
their ordinary eligibility before force selection.

`O_Shop01` is a `WorldShop`. `O_Story01` is the fixed Circe Story room. Its
prior-boss, repeat-visit, Icarus-first-meeting, and bounty predicates are
external progression or suppressed-NPC facts and are omitted under the
canonical baseline. Circe remains part of the room spine; detailed benefit and
trait selection inside the Story encounter remains deferred.

Both fixed Shop and Story targets retain the resolved incoming generated store
as entered-room ratio provenance even though their visible reward is not drawn
from that counted bag.

## Reprieve and Devotion

`O_Reprieve01` is eligible from BDC 3 through 5, has one creation, and owns an
ordinary RunProgress/MetaProgress counted reward with Devotion excluded. Its
world-upgrade requirement is treated as satisfied by the progressed-save
baseline. Its `HealthRestore` encounter does not increment BED.

`O_Devotion01` has one creation and owns fixed RunProgress Devotion. The
production eligibility predicate retains only current-run facts:

- at least two distinct acquired Olympian Boon sources;
- `biomeEncounterDepth >= 2`.

Prior dialogue and prior-save Devotion encounter requirements are treated as
satisfied baseline facts. The `DevotionTestO` encounter inherits `GeneratedO`
and increments BED once. Its fixed producer does not consume the ordinary
RunProgress Devotion bag entry.

## Direct Preboss and Completion

`O_PreBoss01` declares `ForceAtBiomeDepthMin = 7` and
`ForceAtBiomeDepthMax = 7`. It is ineligible before source BDC 7 and reaches
must-force pressure at BDC 7; the raw maximum is formula input, not an upper
eligibility boundary. Every supported predecessor has one exit, so the valid
terminal transition creates one necessarily picked preboss occurrence at that
first must-force decision.

The preboss is always the direct `WorldShop` realization. It has no free-reward
sibling and must not reuse the F/G/H/P shop-then-fill terminal policy. Its
resolved incoming generated store remains ratio provenance. The preboss's own
single fixed exit then creates the neutral boss.

The layout-owned completion sequence is:

```text
O_Boss01 -> O_PostBoss01 -> P_Intro
```

`O_Boss01` uses `BossEris01`. `O_Boss02` is the user-selected difficulty
variant and is excluded until difficulty becomes explicit project input.
`MixerOBossDrop` and the weapon-dependent boss reward are outside the modeled
reward surface, but the store resolved for the boss's linked offer remains an
entered-room ratio-ledger event.

`O_PostBoss01` is reward-free and contributes no store entry. Its optional
surface-shop interactions remain under the shared no-action deferral. The
postboss's `NextRoomSet = P` leads to the fixed `P_Intro` biome start.

## Counter and History Projection

Canonical O materialization must preserve these distinct facts:

- every editable room appearance increments `biomeDepthCache` once;
- `O_Intro`, Shop, Story, Reprieve, Charybdis, and preboss do not increment
  `biomeEncounterDepth`;
- every active `GeneratedO` ship combat increments BED before its wheel;
- Captain and `DevotionTestO` increment BED once;
- a ShipCombat occurrence contributes exactly one Intro marker to recent-room
  history, regardless of its active counting-phase count;
- all selected room phases are recorded during transition preparation, but
  they start and update BED sequentially inside the room;
- every active wheel contributes one resolved store to the entered-room ratio
  ledger;
- a ShipCombat room with two active wheels contributes two ledger entries and
  suppresses any top-level room-store contribution;
- fixed Shop, Story, preboss, and boss rooms retain their resolved incoming
  store provenance where declared;
- reward-free rooms and `O_PostBoss01` contribute no store entry.

The simulator must expose the appropriate pre-room, pre-phase, and post-phase
history views. It must not collapse O to one generic room-level BED increment
or one room-level reward store.

## Excluded and Deferred Systems

The canonical O trace excludes or defers:

- the dream/first-biome conditional `O_Intro` reward;
- `GeneratedO_Intro01_First` and `DeadSeaIntro` progression encounters;
- Charybdis's first-ever force and Captain's save unlock gate;
- Story, Reprieve, Devotion, familiar, bounty, and boss-difficulty save gates;
- Heracles and Icarus phase replacements;
- natural Chaos and other route-structural detours;
- challenge switches, wells, gathering, rerolls, and optional shop actions;
- exact room, phase-count, wheel-count, and store probabilities;
- concrete enemy-wave composition;
- Circe benefit details;
- automatic boss-specific and weapon-dependent reward payloads.

These are explicit product boundaries. They do not become generic
`unsupported` fields or partial production requirements.

## Declaration-Port Contract

The dormant O import delivers:

1. one `LinearBiome` layout with fixed `O_Intro`, six ordinary continuation
   slots, six ordinary target occurrences, a direct preboss, and an ordered boss/postboss
   completion;
2. explicit one-exit declarations for every supported editable O room;
3. all fifteen concrete combat declarations divided into the ordinary,
   early-only, and late-backup eligibility families after inheritance;
4. one `ShipCombat` encounter profile with stable Intro, Combat1, and Combat2
   phase keys and pre-room optional-presence timing;
5. two bounded room-owned wheel slots with one/two-offer and picked-index
   state;
6. exact per-phase BED, offer, acquisition, and store-ledger events;
7. an `authoredBaseStore` batch policy for non-ShipCombat sources and a
   `sourceOfferPoint` policy for ShipCombat sources;
8. exact special-room caps, current-run requirements, force rules, reward
   producers, and encounter-depth effects;
9. a must-force-at-BDC-7 direct shop-only `O_PreBoss01` terminal policy;
10. derived `O_Boss01` and `O_PostBoss01` declarations before `P_Intro`;
11. explicit baseline exclusions and suppression contracts without zombie
    save/profile predicates;
12. focused fixtures for encounter-count support, wheel timing, source-derived
    stores, recent-room eligibility, BED asymmetry, and depth-5 Shop/Story
    force competition.

The import must remain dormant. It does not add O editor panels, activate
Surface simulation, or implement persistent NPCs.

## Model Conclusions

O confirms the shared separation between layout-owned topology and room-owned
local children. Wheel state belongs to a concrete ShipCombat occurrence;
outgoing target identity and continuation remain batch-owned.

O also proves that a generated batch's base store is a policy-resolved value,
not universally an authored value. Most ordinary batches author it, Q omits it,
and a ShipCombat source derives it from the source occurrence's last active
offer point. Persisting both the wheel store and an outgoing copy would create
competing authorities.

Finally, O demonstrates why declaration normalization must follow the game's
actual inheritance semantics. Readable explicit TypeScript declarations should
contain the flattened true predicates, not mechanically compose every parent
and child source table.
