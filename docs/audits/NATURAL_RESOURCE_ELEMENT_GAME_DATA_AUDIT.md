# Natural Resource Element Game-Data Audit

## Status and scope

This is an implementation-free source audit for elemental gains from upgraded
gathering tools. It records the four interaction families, chance and cap
semantics, manual and automatic collection paths, and the resulting hidden
element traits. Meta-resource yields, gathering probabilities, tool
progression costs, and presentation are outside the intended planner outcome
unless they change element support.

The evidence was checked on 2026-08-16 against the installed Hades II scripts.
Primary sources are:

- `WeaponShopData.lua`, especially the four level-two tools;
- `HarvestLogic.lua`, especially `GrantElementFromTool`, the four manual
  interaction paths, and `AutoHarvestOnExit`;
- `HarvestPresentation.lua`, for successful manual fishing;
- `RoomLogic.lua`, for the exit-time auto-harvest checkpoint;
- `RunLogic.lua`, for run-local `ToolElementsSpawned`; and
- `TraitData_Essence.lua`, for the resulting hidden traits.

## Exact tool-to-element matrix

Elemental gains belong to the upgraded gathering tools, not to every resource
pickup of a similar visual family.

| Player interaction            | Source tool        | Upgraded tool       | Base chance | Granted trait  | Element |
| ----------------------------- | ------------------ | ------------------- | ----------: | -------------- | ------- |
| fully mine a deposit          | `ToolPickaxe`      | `ToolPickaxe2`      |        0.50 | `FireEssence`  | Fire    |
| successfully exorcise a shade | `ToolExorcismBook` | `ToolExorcismBook2` |        0.50 | `AirEssence`   | Air     |
| dig a seed/resource spot      | `ToolShovel`       | `ToolShovel2`       |        0.50 | `EarthEssence` | Earth   |
| successfully catch a fish     | `ToolFishingRod`   | `ToolFishingRod2`   |        0.50 | `WaterEssence` | Water   |

The colloquial “Herbing grants Earth” is not exact. Ordinary hand-gathered
`HarvestPoint` flora does not call `GrantElementFromTool`. Earth belongs to the
upgraded Shovel's digging interaction.

## Eligibility and chance

`GrantElementFromTool` first requires the named upgraded tool to be unlocked.
It then rejects the attempt when that tool has already succeeded during the
current run or when the hero is dead.

For an eligible attempt, the actual roll is:

```text
tool ElementChance (0.50) * current LuckMultiplier
```

The 50% value is therefore the base chance, not an unconditional fixed chance
under every run modifier.

Most importantly, a failed roll does not mark the tool as spent. A later
successful interaction of the same tool family rolls again. Only a success
sets `CurrentRun.ToolElementsSpawned[toolName]`, after which all later attempts
for that exact upgraded tool return without another element.

The exact rule is:

```text
each eligible interaction rolls until that tool succeeds once
  -> after success, that tool grants no more elements this run
```

It is not one roll per domain per run. It is a per-interaction chance with a
per-tool one-success cap.

The four tool keys are independent. One run may therefore receive at most one
Fire, one Air, one Earth, and one Water from these mechanics, for a maximum of
four tool-derived elements.

## Successful interaction boundaries

The roll occurs only at the successful resource boundary:

- Shovel rolls after the digging reward is granted.
- Pickaxe rolls when the deposit is fully depleted, not on every swing.
- Exorcism rolls only after a successful sequence that grants its resources.
- Fishing rolls after a successful catch.

Cancelled, failed, partially completed, or unusable interactions do not grant
the element. Complex interactions also obey their ordinary combat/required
enemy/aggro blocking rules; this audit does not redefine when the base
resource point itself is usable.

## Manual and auto-harvest paths

The ordinary manual paths call `GrantElementFromTool` directly, with fishing's
successful call owned by its presentation completion.

`WorldUpgradeAutoHarvestOnExit` adds a second execution path. During
`LeaveRoom`, before the next room transition, `AutoHarvestOnExit` finds still
usable Harvest, Shovel, Pickaxe, Exorcism, and Fishing points and invokes their
declared exit-use functions. The four tool-backed exit functions call the same
`GrantElementFromTool` authority with presentation delays suppressed.

Auto-harvest therefore does not grant a separate bonus roll after a point was
manually consumed. It consumes still-usable points and uses the same per-tool
success cap. A room containing more than one untouched tool family can grant
multiple distinct elements on exit; repeated points of one family stop
granting after the first success.

The exit-time path matters chronologically: its element is acquired after the
player has finished room-local interactions and selected an exit, but before
the next room is entered. It can affect eligibility and infusion state in the
next room, not earlier decisions already resolved in the room being left.

## Resulting run state

On success the game adds one hidden trait:

- `FireEssence` inherits `FireBoon`;
- `AirEssence` inherits `AirBoon`;
- `EarthEssence` inherits `EarthBoon`; and
- `WaterEssence` inherits `WaterBoon`.

Each trait represents one unit of its element and participates in ordinary
element-count and infusion logic. The accompanying meta resource is not the
modeled effect; the element trait is a real run-progress mutation even though
the gathering activity is primarily a meta-progression interaction.

## Resource-point spacing that can block a chosen success

The element roll happens only after the underlying resource point has spawned
and been completed. Point generation therefore has an earlier eligibility
boundary that matters even when meta-resource outcomes are ignored.

The default source requirements protect these lookback windows:

| Element | Resource point | Same-family lookback requirement          |
| ------- | -------------- | ----------------------------------------- |
| Earth   | Shovel         | no Shovel point in the previous 4 rooms   |
| Fire    | Pickaxe        | no Pickaxe point in the previous 4 rooms  |
| Air     | Exorcism       | no Exorcism point in the previous 6 rooms |
| Water   | Fishing        | no Fishing point in the previous 5 rooms  |

Exorcism additionally requires no Fishing point in the immediately previous
room, and Fishing requires no Exorcism point there. Each family normally has a
per-biome spawn limit of one; a matching familiar tool raises that limit by
one. Room declarations can force points or explicitly ignore the biome limit.

At room creation, ordinary rooms also resolve Shovel versus Pickaxe to at most
one simple tool point and Exorcism versus Fishing to at most one complex tool
point. Rooms with `AllowOnlyOneToolHarvestableResource` narrow that to one
tool-backed point across all four families.

These are resource-point constraints, not element-roll cooldowns. A point that
spawned and failed its 50% element roll still participates in the spacing and
biome-count facts that can prevent a later point.

## Chosen planner simplification

The planner only needs the placement of a successful element roll. It may
therefore represent each tool family as a protected zero-or-one successful
event for the run:

```text
choose one declaration-eligible room for the successful tool interaction
  -> reserve the source-required lookback and room-local capacity
  -> omit failed rolls and meta-only resource points
  -> acquire exactly one matching element at that interaction boundary
  -> publish no later success for that tool in the run
```

The protection means that omitted random resource points are treated as not
having spawned where they would consume the selected event's spacing or
per-biome capacity. A fixed or separately modeled point that cannot be
suppressed must still make an incompatible placement unavailable. This is an
explicit authored-outcome abstraction, not a claim that the game preselects
which point will win the 50% roll.

The four families remain independent, so the run may contain up to four such
singletons. Their placement must still obey the source's same-room simple,
complex, or all-tool capacity described above.

## Current planner disposition

The planner already has element-count and infusion evaluation, but it does not
yet model the protected successful singletons or their interaction chronology.
It will not model failed rolls, meta-only nodes, resource-point probabilities,
or the familiar's extra spawn capacity. The selected-success protection must
remain truthful against fixed modeled predecessors even though ordinary hidden
random points are omitted.

The abstraction must not attribute Earth to ordinary flora harvesting. It also
must not describe the game rule itself as one fixed roll per run: the singleton
is the planner's chosen successful outcome for a source process that actually
rerolls at every eligible interaction until its first success.
