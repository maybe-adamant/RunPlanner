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

## Resource-point spacing and placement capacity

The element roll happens only after the underlying resource point has spawned
and been completed. Point generation therefore has an earlier eligibility
boundary that matters even when meta-resource outcomes are ignored.

The default source requirements protect these lookback windows:

| Element | Successful point | Same-family lookback requirement          |
| ------- | ---------------- | ----------------------------------------- |
| Earth   | Shovel           | no Shovel point in the previous 4 rooms   |
| Fire    | Pickaxe          | no Pickaxe point in the previous 4 rooms  |
| Air     | Exorcism         | no Exorcism point in the previous 6 rooms |
| Water   | Fishing          | no Fishing point in the previous 5 rooms  |

Every family additionally excludes every other tool-point family in the
immediately previous room. N expands every off-diagonal window to three rooms;
H uses a two-room same-family window, while N uses same-family windows 12
(Shovel/Pickaxe), 16 (Exorcism), and 14 (Fishing). Each family normally has a
per-biome spawn limit of one; a matching familiar tool raises that limit by
one. Room declarations can force points or explicitly ignore the biome limit.

The room-family defaults yield this availability matrix before the spacing,
capacity, and per-biome checks above are applied:

| Tool-point family | Default ordinary room families | Chaos declaration |
| ----------------- | ------------------------------ | ----------------- |
| Pickaxe / Mine    | F, G, H, I, N, O, P, Q         | Yes               |
| Exorcism / Spirit | F, G, H, I, N, O, P, Q         | No                |
| Shovel / Dig      | F, G, H, I, N, O, P, Q         | Yes               |
| Fishing / Fish    | F, G, H, I, P, Q               | Yes               |

Individual room declarations can override those family defaults in either
direction. In particular, N and O default Fishing to false but each contains
specific rooms with `HasFishingPoint = true`; those rooms remain legal Water
success hosts. Many rooms in otherwise enabled families explicitly disable
one or all point kinds. Chaos explicitly disables Exorcism but can declare the
other three families.

The placement matrix is a point-generation rule, before manual completion or
auto-harvest and before an element roll:

| Room kind                                                | Tool-point families declared by source                                                             | Capacity after point generation                                                                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary room                                            | Shovel, Pickaxe, Exorcism, and Fishing when the room declaration and their requirements allow them | At most one simple point (Shovel or Pickaxe, except that two forced simple points may coexist) and at most one complex point (Exorcism or Fishing); one simple and one complex point may coexist. |
| Ordinary room with `AllowOnlyOneToolHarvestableResource` | Any of the same four that succeeds its own requirements                                            | At most one tool-backed point across all four families.                                                                                                                                           |
| Chaos                                                    | Shovel, Pickaxe, and Fishing; its base declaration disables Exorcism                               | At most one tool-backed point across the declared Chaos families. Chaos ignores the ordinary biome-resource limits, but still applies this all-tool capacity.                                     |

### Enumerated declaration evidence

The default source tables enable all four families in F/G/H/I/P/Q, Shovel,
Pickaxe, and Exorcism in N/O, and Shovel/Pickaxe/Fishing in Chaos. The exact
overrides are: F disables Fishing in MiniBoss01/02, Combat02/03/09/22, Boss01,
and PostBoss01; G Boss01 disables every family; H disables Fishing in
MiniBoss01, Combat05/09/13, Boss01 and disables every family in PostBoss01; I
disables Fishing in Combat02/03/04/05/08/09/15/16/18/20/21/22, MiniBoss01/03,
and Story01 (MiniBoss02 explicitly enables Fishing); N enables Fishing only in
Opening01, Shop01, PreBoss01, Combat16, and Story01, disables all Hub points,
disables Fishing in Sub01–15, and
disables Exorcism in Combat08; O enables Fishing only in Intro, Boss01,
Devotion01, Reprieve01, and Story01 and disables all PostBoss01 points; P
disables Fishing in Combat02/04/08/09/12/18/19, MiniBoss01/02, and Boss01 and
disables Exorcism in Combat09; Q disables Fishing in Combat03/08 and every
family in Boss01. Chaos_01–06 inherit the Chaos base table.

The source additionally has conditional `*PointForceRequirements` at F Opening
and Boss; G/H/I/P/Q PreBoss; I Boss; N PreHub and Boss; and O Boss. Those
predicates depend on unmodeled profile, familiar, or meta-resource state, so
the selected-success abstraction records them as source evidence only and does
not synthesize guaranteed physical points. F/G Reprieve
and Story, N Story, and O Reprieve/Story ignore the biome limit. This evidence
comes from `RoomDataF.lua` through `RoomDataQ.lua` and `RoomDataChaos.lua`;
the ordinary one-simple/one-complex and Chaos all-tool arbitration comes from
`RunLogic.lua`, while exit collection uses the same tool success authority in
`HarvestLogic.lua`.

These are resource-point constraints, not element-roll cooldowns. A point that
spawned and failed its 50% element roll still participates in the spacing and
biome-count facts that can prevent a later point.

## Planner alternatives

The later planner can name the source object a Room Feature and describe its
automatic collection as a room-exit timeline effect. That vocabulary clarifies
where the consequence is presented and when it takes effect; it does not
change the source abstraction that an element comes only from a successfully
completed point.

Two possible outcome representations follow from the source facts.

### A. Protected selected-success singleton

For each tool family, author at most one successful interaction for the run:

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

### B. Physical point Room Features plus an element-granted choice

This alternative would represent every physical Mine, Exorcism, Dig, or Fish
point as a Room Feature, then distinguish the point that grants the element.
It preserves visible resource presence, but it is a larger source abstraction:
no-element points still consume same-family spacing, per-biome limits, and the
ordinary simple, complex, or Chaos all-tool capacity. It also has to settle
whether each point was completed manually or remains for automatic harvest at
room exit before knowing whether its roll occurred. Omitting those no-element
points while keeping their per-point representation would make later selected
placements falsely available.

Accordingly, a free global element checkbox is not faithful, nor is a free
checkbox on every independently added physical point. Four `Add` controls may
be useful application wording only when each means “add the selected successful
Mine, Exorcism, Dig, or Fish interaction” and is subject to the protected
placement rules of alternative A.

## Chosen planner disposition

The planner chooses alternative A: one protected zero-or-one successful
singleton per upgraded tool family. The four families remain independent, so a
run may contain up to one Fire, Air, Earth, and Water singleton. Selected
placements obey the matrix above and gain their element during auto-harvest's
room-exit chronology: after room-local Cleanup interactions and exit selection,
but before the next room starts. The planner assumes the automatic-collection
upgrade for this representation; it does not model manual completion timing.

The catalog owns the exact normalized support matrix. Every raw room
declaration explicitly names its supported families (including an empty list),
while shared normal/H/N/Chaos profile constructors own the repeated
trait-to-element mapping, lookback matrix, and capacity shape. The planner
consumes that normalized matrix; it does not infer support from biome letters,
room labels, room-name sets, or editor presentation.

The planner models these selected-success placements and their room-exit
chronology through the existing element-count and infusion history. It does not
model failed rolls, meta-only points, resource-point probabilities, the
familiar's extra spawn capacity, or manual-versus-auto interaction choice.
An authored selected placement that later becomes impossible through an edit or
a fixed modeled predecessor is retained as invalid and reported for repair; it
is not silently removed, moved, or converted into a no-element point.

The abstraction must not attribute Earth to ordinary flora harvesting. It also
must not describe the game rule itself as one fixed roll per run: the singleton
is the planner's chosen successful outcome for a source process that actually
rerolls at every eligible interaction until its first success.
