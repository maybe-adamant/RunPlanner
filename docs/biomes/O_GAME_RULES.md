# O Game Rules

## Scope and evidence

This document is the game-rule authority for Thessaly (`O`) under the
progressed-save, NPC-free baseline. Shared behavior is owned by
[`GAME_GENERATION_RULES.md`](../design/GAME_GENERATION_RULES.md); O
declarations own its fixed count, ShipCombat profile, physical exits, and
completion rooms.

The rules were checked against `RoomSets.lua`, `RoomDataO.lua`, ship map data,
encounter data, `RunLogic.lua`, and `RoomLogic.lua` on 2026-07-18.

## Authored shape

- `O_Intro` is the fixed authored start.
- Six generated normal-door batches and six target occurrences are supported.
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

## Reward and lifecycle facts

O ShipCombat state is room-local. Replacing one resolved wheel offer replaces
that offer value directly; it does not create a wrapper field or alter sibling
wheels. Encounter-count changes make the second wheel dormant or active
without discarding its retained authored state.

Room creation, entered acquisition, force pressure, and completion counters
remain distinct. The planner keeps possible/forced room support and the
declaration-defined reward timing, but deliberately omits weighted RNG,
unmodeled combat waves, NPC variants, Chaos, and optional player systems.

### ShipCombat phase and wheel contract

Every O combat occurrence uses the ordered ShipCombat profile: a non-counting
Intro phase, a counting Combat1 phase with `wheel1`, and an optional counting
Combat2 phase with `wheel2`. The optional third phase is prepared from the
pre-room encounter-depth history. The authored encounter count is therefore a
real room-local value: two means Intro plus Combat1; three includes Combat2.
It may be context-invalid and produce a finding, but it is not silently
coerced by the UI.

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

### Candidate families and direct completion

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
WorldShop and then the derived `O_Boss01`, `O_PostBoss01` tail. NPC encounter
variants, weighted replay, optional actions, and automatic boss drops remain
outside the canonical projection.

## Product boundary

The current product includes O catalog normalization, authored state,
validation, candidates, workspace projection, and React editing. Any profile
or persistent-progression rule requires a modeled project input before it can
enter production declarations.
