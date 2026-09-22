# O Game Rules

## Scope and evidence

This document is the game-rule authority for Thessaly (`O`) under the
progressed-save static baseline with supported Heracles and Icarus combat. Shared behavior is owned by
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); O
declarations own its eligibility-driven completion, ShipCombat room template and Encounter
Envelope bindings, physical exits, and
completion rooms.

The rules were checked against `RoomSets.lua`, `RoomDataO.lua`, ship map data,
encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `O_Intro` is the fixed authored start.
- Ordinary normal-door progression is eligibility-driven. On the standard
  route, six entered ordinary targets advance `BiomeDepthCache` from 1 to the
  Preboss force depth of 7.
  Every supported normal source has one `ShipsExitDoor`, so selection is
  declaration-derived rather than an authored fork.
- ShipCombat occurrences own encounter count, both reward wheels, active offer
  counts, picked offers, and wheel stores. The ordinary outgoing store derives
  from the last active ShipCombat wheel.
- `O_PreBoss01` is a width-one atomic takeover Preboss. Its policy has no
  remaining free offer: its sole target is the selected World Shop occurrence.
- Selecting it creates the ordinary `O_Boss01` and route-position
  `O_PostBoss01` occurrences through fixed links.

The final ordinary source reaches the preboss frontier when the evaluated
history makes `O_PreBoss01` eligible and required at `BiomeDepthCache = 7`.
The six-step standard route is therefore a consequence of entered-room counter
history, not a second structural batch bound. No second physical exit exists
there, so no peer or synthetic free reward is created.

## Reward and lifecycle facts

O ShipCombat state is room-local. Replacing one resolved wheel offer replaces
that offer value directly; it does not create a wrapper field or alter sibling
wheels. Encounter-count changes make the second wheel dormant or active
without discarding its retained authored state.

Room creation, entered acquisition, force pressure, and completion counters
remain distinct. The planner keeps possible/forced room support and the
declaration-defined reward timing, but deliberately omits weighted RNG,
unmodeled combat waves, NPC event/interactions beyond selected combat, Chaos,
and optional player systems.

### ShipCombat phase and wheel contract

Every O combat occurrence uses the ordered Ship Encounter Envelope: an Intro
slot, a Combat1 slot with `wheel1`, and an optional Combat2 slot with `wheel2`.
The selected concrete definition owns whether a slot counts. The optional third
phase is prepared from the pre-room encounter-depth history. The authored
encounter count is therefore a real room-local value: two means Intro plus
Combat1; three includes Combat2. It may be context-invalid and produce a
finding, but it is not silently coerced by the UI. A structurally supported
count remains authorable when activating Combat2 exposes an invalid retained
encounter or reward default; those leaf findings are retained so the newly
reachable controls can repair them.

Each active wheel owns one RunProgress or MetaProgress store, one or two
complete resolved offers, and one picked offer index. Unpicked wheel options
remain real offered values and consume their compatible support, while only
the picked option acquires. `wheel2` remains a dormant retained leaf when the
third phase is absent. Replacing a wheel offer replaces the resolved value at
that wheel key directly; it never wraps it in another offer object.

Authoring follows those lifecycle boundaries: the wheel's pre-offer history
determines its Run/Meta support, the declaration determines its active offer
count, the selected store and count constrain the complete simultaneous offer
cohort, and only then does the player select one generated offer. Unresolved or
incompatible retained offers remain explicit repair evidence; they do not make
a supported store or offer count unauthorable. A retained wheel store outside
its pre-offer support remains authored and receives a wheel-owned finding.

The final active wheel is the source-owned outgoing-store authority. A
two-phase ShipCombat source supplies `wheel1.storeKey`; a three-phase source
supplies `wheel2.storeKey`. Its outgoing batch persists the `sourceOfferPoint`
policy, not a duplicated store choice. Non-ShipCombat O sources retain the
ordinary authored base-store choice where their room-start selection is
otherwise observable.

### Ship intro counter and end-effect policy

A completed `GeneratedO_Intro01` is combat, not an empty-room encounter.
Its `CountsForRoomEncounterDepth = false` excludes it from encounter-depth
counters only. It does not suppress encounter-end effects. This also applies
to the native first-visit variant, `GeneratedO_Intro01_First`, which inherits
the same declaration. The fixed `O_Intro` room is a different owner and must
not be confused with a ShipCombat occurrence's Intro phase.

Source contacts:

- `EncounterData_Generated.lua:820,922,964`: `GeneratedO` and the two generated
  intro declarations. The intro inherits the Ship combat event sequence,
  overrides its reward to `Empty`, and skips wheel setup. It does not declare
  `SkipEndEncounterEffects` or a noncombat encounter type.
- `RoomLogic.lua:1900,1931`: encounter-depth increments are conditional on
  `CountsForRoomEncounterDepth`; the later `EndEncounterEffects` call is not.
- `RoomLogic.lua:2869,2928–3003`: end effects reject noncombat/skipped effects,
  then use independent boss, encounter-use, and room-upgrade guards. Each ship
  phase is the current main encounter at this contact.
- `TraitLogic.lua:2881`: `CheckChamberTraits` advances `RoomsPerUpgrade`
  effects. Timed resource-drop suppression holds a due drop near maturity;
  it is not an encounter-depth rule.
- `TraitData.lua:998`: `StorePendingDeliveryItem` uses `UsesAsEncounters`,
  without `UsesRequireSpawnMultiplier`.
- `RoomLogic.lua:4264`: `UsesAsRooms` is consumed during room departure, not
  between ship phases.

The following matrix assumes a completed, non-skipped phase and an already
active effect. Per-effect holds and native suppression flags still apply.

| Product or effect                                                  | Generated ship Intro         | Ship Combat1/Combat2                                | Authority / distinction                                                                                                |
| ------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Room, biome and route encounter-depth counters                     | No                           | Yes                                                 | `CountsForRoomEncounterDepth`; Heracles Intro is a separate concrete encounter that does count.                        |
| Encounter occurrence/completion history                            | Yes                          | Yes                                                 | `EncountersOccurredCache` and completion caches are recorded independently of depth.                                   |
| Hermes delivery countdown                                          | Yes                          | Yes                                                 | `UsesAsEncounters`, guarded by the room's `IgnoreEncounterUses`, not encounter depth.                                  |
| Encounter-duration Chaos curses, Well items, Experimental Hammer   | Yes                          | Yes                                                 | The encounter-use expiry lane; retain any effect-specific holds or spawn-multiplier requirements.                      |
| Steady Growth and Transcendent Embryo                              | Yes                          | Yes                                                 | `CheckChamberTraits`, guarded by `SkipRoomsPerUpgrade`.                                                                |
| Supply Chain progress / due optional drops                         | Yes                          | Yes                                                 | Same room-upgrade call; `SkipTimedDropResources` separately governs actual drop maturity. Dropping is not acquisition. |
| Native room-upgrade keepsake decay/escalation                      | Yes                          | Yes                                                 | The loop guarded by `SkipRoomsPerUpgrade`; only modeled effects enter planner state.                                   |
| Persistent keepsake rank experience                                | Yes                          | Yes                                                 | `AdvanceKeepsake` is independent of those two suppressors; persistent rank progression remains outside the simulation. |
| Boss-use effects, Judgment and Crystal Figurine                    | No                           | No                                                  | Neither generated ship phase is a boss.                                                                                |
| Physical room entry/history and biome depth cache                  | Once for the room            | No additional entry                                 | Advancing an internal encounter does not enter another room or create another resource-history slot.                   |
| Room-departure effects, including Enshrouded `UsesAsRooms`         | No internal tick             | Only when the room is left                          | No synthetic room departure between phases.                                                                            |
| Wheel generation / selected room reward                            | No; native reward is `Empty` | One wheel and its selected reward per active combat | Intro skips `ShipsEncounterSetup`; it does not consume a reward merely by being combat.                                |
| Pending acquisition/generation effects such as Yarn, Hymn or Ixion | No generic clock tick        | No generic clock tick                               | Their own offer/acquisition/gate contacts remain authoritative.                                                        |

This is the same policy separation used for
[N side rooms](N_GAME_RULES.md): no global "counts as a room/encounter" switch.
N side rooms have explicit `IgnoreEncounterUses` and `SkipRoomsPerUpgrade`
suppressors; generated ship intros do not.

The planner preserves `countsEncounterDepth: false` for generated ship intros
while allowing their Hermes delivery ticks through the normal combat default.
All modeled end-effect lanes process this contact independently of encounter
depth. Boss rooms remain ordinary delivery hosts: a delivery whose countdown
reaches zero there must publish its required pickup, with no executor clock
compensation or boss-specific placement exception.

### Outgoing-store consequences

The source-owned outgoing store is not uniformly the target's visible reward.
The selected target declaration decides whether the inherited store is
consumed for an ordinary reward, overridden by a forced store, discarded, or
retained solely as entered-store provenance:

| Selected O target | Incoming reward and outgoing-store consequence                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ShipCombat        | No incoming reward; the inherited store is discarded.                                                                                              |
| Miniboss          | Fixed Boon from forced RunProgress; the inherited store is overridden.                                                                             |
| Devotion          | Fixed Devotion from forced RunProgress; the inherited store is overridden.                                                                         |
| Reprieve          | The ordinary reward is drawn from the inherited RunProgress or MetaProgress store.                                                                 |
| Story             | The reward is fixed Story; the inherited RunProgress or MetaProgress store is retained as entered-store provenance.                                |
| Midshop           | The reward is fixed Shop; the inherited RunProgress or MetaProgress store is retained as entered-store provenance.                                 |
| Preboss Shop      | The reward is fixed Shop; the inherited RunProgress or MetaProgress store is retained as entered-store provenance through the completion boundary. |

Entered-store provenance is materially distinct from bag consumption. A fixed
Story or Shop that has both `ChosenRewardType` and `RewardStoreName` contributes
to `CalcRoomRewardStores` — it counts on the store it carried in, without ever
drawing from that bag. A discarded ShipCombat target store records nothing. The
planner therefore retains the declaration-owned producer and history semantics
rather than treating every outgoing store as a generated reward bag.

The pair relation reads in one direction. Inside a ship, the wheels decide:
each active wheel stamps its own store onto its own encounter, and a
three-phase ship therefore banks two counts while the ship room itself, being
`NoReward`, banks none at the room level. Outside the ship, the door decision
matters only where the room it opens actually banks a store — a Story, Midshop
or Preboss Shop counts on the carried store, a Reprieve counts on the store it
consumes, and a ShipCombat target counts nothing at all, so a store resolved
into a ship is a store that never reaches the ledger. The count that results is
run-wide, spanning every biome the route has entered rather than resetting at
O's border. On the Surface route that history is unusually thin: O's only
predecessor is the N hub, and the whole hub is excluded from the count, so O's
opening batch reads an empty ledger. The ratio is `nil` there, which makes
`chance = T = 0.30` exactly, and both stores are supported — O opens maximally
open rather than pre-committed. Every later O door reads O's own accumulating
entries, so it is O's earlier choices, not an inherited history, that narrow
its later ones. (Underworld biomes never precede O; only a Dream itinerary can
place one ahead of it.) `O_PreBoss01`'s outgoing boss link is a
genuine roll natively and therefore carries its own authored store decision,
like G's, P's and Q's.

### Candidate families and declaration-driven completion

O combat declarations retain three game-data families: the ordinary recent
ShipCombat-phase family, early depth-limited maps that replace that inherited
requirement, and the late backup that becomes possible only after the recent
phase threshold. The planner uses those declaration predicates as support; it
does not incorrectly compose replaced parent requirements or score room-set
weights.

Miniboss, Story, Reprieve, Devotion, and Shop declarations retain their own
physical one-door shape, caps, force pressure, and producers. Wheel offer
count is not a second room exit. Once entered-room history reaches the exact
Preboss depth, the width-one O takeover creates the entered
WorldShop and then the fixed-link `O_Boss01`, `O_PostBoss01` rooms. Weighted replay,
NPC random/interaction behavior, optional actions, and automatic boss drops
remain outside the canonical projection.

O miniboss declarations own their sparse boon-rarity room facts. The exact
offer-local ledger applies that room context to any eligible Olympian or Hermes
offer materialized there; it is not derived from the room's reward label.

### Concrete encounter selection

`OEncountersIntros` permits `HeraclesCombatO` only at Intro;
`OEncountersDefault` permits `IcarusCombatO` only at an active Combat1 or
Combat2 slot. A valid Heracles Intro counts for encounter depth but does not
terminate the later O slots. An Icarus record in an earlier active main slot
uses ordinary exact-key history and prevents an Icarus selection in a later
active main slot. Both identities leave the existing wheel ownership and
selected reward behavior on their exact Combat slots unchanged.

When `IcarusCombatO` is selected and entered, its exact phase owns Icarus's
three-choice player-rarityless trait offer. Source chronology makes the later
Icarus interaction and the selected wheel-reward interaction parallel required
objects after that combat; either may resolve first, and both must clear before
the next ShipCombat phase. Latest Model's ordered Rank-I Hammer targets use the
shared acquisition-ordinal profile (one at O's ordinary position) and Rank-II
targeted-acquisition lifecycle.

The visible End Encounter boundary marks combat completion and makes the
Icarus/wheel interactions available. Unlike ordinary combat, the native
`WaitForNextEncounterReady` barrier clears those required interactions before
`StartEncounter` calls `EndEncounterEffects`. The planner therefore applies
end effects after the required phase actions: the current wheel reward sees
the old Embryo blessing, while Steady Growth can target the newly acquired
boon. Automatic outcomes remain last inside End Encounter, before pickups
created by that checkpoint and before the next phase or Cleanup.
No room feature or
physical exit is usable between phases; O has one room-level Cleanup after its
final active phase. The source evidence and relationship to wheel selection
and room-local ordering are owned by
[`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/rooms-and-routes/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md).

The editor renders Room Overview, Intro Timeline, Combat 1 Timeline, optional
Combat 2 Timeline, and Room Doors. Overview owns encounter count and room
features. Wheel 1 is configured at Intro's next-phase boundary and Wheel 2 at
Combat 1's; choice and pickup actions remain at their engine timeline
positions. A retained inactive Combat 2 action appears once in the repair
surface. The phase tabs are views over one global `roomActions.order`, and only
the final active phase reaches room-level **Cleanup · Doors open**.

The remaining NPC event, interaction, reward, and external-profile paths are
not encounter candidates. The raw source composition remains documented in the
encounter audit rather than reproduced here.

## Product boundary

The current product includes O catalog normalization, authored state,
validation, candidates, workspace projection, and React editing. Any profile
or persistent-progression rule requires a modeled project input before it can
enter production declarations.
