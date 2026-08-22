# O Game Rules

## Scope and evidence

This document is the game-rule authority for Thessaly (`O`) under the
progressed-save static baseline with supported Heracles and Icarus combat. Shared behavior is owned by
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); O
declarations own its fixed count, ShipCombat room template and Encounter
Envelope bindings, physical exits, and
completion rooms.

The rules were checked against `RoomSets.lua`, `RoomDataO.lua`, ship map data,
encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `O_Intro` is the fixed authored start.
- Six realized ordinary normal-door batches and six ordinary target occurrences
  are supported.
  Every supported normal source has one `ShipsExitDoor`, so selection is
  declaration-derived rather than an authored fork.
- ShipCombat occurrences own encounter count, both reward wheels, active offer
  counts, picked offers, and wheel stores. The ordinary outgoing store derives
  from the last active ShipCombat wheel.
- `O_PreBoss01` is a width-one atomic takeover Preboss. Its policy has no
  remaining free offer: its sole target is the selected World Shop occurrence.
- Selecting it begins the `O_Boss01`, `O_PostBoss01` completion tail.

The final ordinary source reaches the preboss frontier at the declared depth.
No second physical exit exists there, so no peer or synthetic free reward is
created.

After six realized ordinary one-door batches, O admits one terminal zero-target
normal decision envelope. Its only authorable result is the fixed width-one
`O_PreBoss01` takeover; a seventh ordinary Ship target is not structurally
authorable.

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

The final active wheel is the source-owned outgoing-store authority. A
two-phase ShipCombat source supplies `wheel1.storeKey`; a three-phase source
supplies `wheel2.storeKey`. Its outgoing batch persists the `sourceOfferPoint`
policy, not a duplicated store choice. Non-ShipCombat O sources retain the
ordinary authored base-store choice where their room-start selection is
otherwise observable.

### Candidate families and declaration-fixed completion

O combat declarations retain three game-data families: the ordinary recent
ShipCombat-phase family, early depth-limited maps that replace that inherited
requirement, and the late backup that becomes possible only after the recent
phase threshold. The planner uses those declaration predicates as support; it
does not incorrectly compose replaced parent requirements or score room-set
weights.

Miniboss, Story, Reprieve, Devotion, and Shop declarations retain their own
physical one-door shape, caps, force pressure, and producers. Wheel offer
count is not a second room exit. The sixth ordinary one-door target reaches
the declared Preboss frontier; the width-one O takeover creates the entered
WorldShop and then the derived `O_Boss01`, `O_PostBoss01` tail. Weighted replay,
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
the next ShipCombat phase. Latest Model may target one exact eligible equipped
Rank-I Hammer and upgrade it to Rank II through the shared targeted-acquisition
lifecycle.

Encounter end has the same meaning here as in an ordinary combat room: combat
has ended and the Icarus/wheel objects are available. The later
`WaitForNextEncounterReady` barrier belongs to starting the next Ship phase,
not to a different O-specific encounter-end meaning. No room feature or
physical exit is usable between phases; O has one room-level Cleanup after its
final active phase. The source evidence and relationship to wheel selection
and room-local ordering are owned by
[`ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`](../audits/ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md).

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
