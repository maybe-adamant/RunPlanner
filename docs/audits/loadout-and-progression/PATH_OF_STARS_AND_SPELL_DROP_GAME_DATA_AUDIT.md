# Path of Stars and Spell Drop Game-Data Audit

## Status and scope

Source audit completed on 2026-08-26 against installed Steam build `24556151`.
This document is the primary evidence authority for:

- the point values of `MinorTalentDrop`, `TalentDrop`, and `TalentBigDrop`;
- the game's `CurrentRun.NumTalentPoints` bank and its implicit first point at
  each writable Path of Stars screen;
- the ordered three-option initial `SpellDrop` offer and its position-owned
  zero/one/two-point bonuses;
- Aspect of Selene's starting spell, source-level starting allocation, and the
  semantic equivalence of its routed `SpellDrop` to a three-point Path screen;
- Moon Beam's point grants as contacts with the same point bank; and
- the planner boundary that permits point accounting without implementing Hex
  trees or authored Path-node selection.

Moon Beam reward priority remains owned by
[the Olympian keepsake and Moon Beam reward-pressure audit](OLYMPIAN_KEEPSAKE_AND_MOON_BEAM_REWARD_PRESSURE_AUDIT.md).
This audit does not map individual Hex talent trees, talent prerequisites,
duo/legendary nodes, rerolls, or damage and Magick effects.

## Sources

Primary evidence:

- `ConsumableData.lua`: `TalentDrop`, `MinorTalentDrop`, and `TalentBigDrop`;
- `TalentScreenLogic.lua`: `OpenTalentScreen`,
  `UpdateAdditionalTalentPointButton`, `TryCloseTalentTree`, and the point-bank
  mutation around a concrete Path pickup;
- `SpellData.lua`: `SpellTalentData.InitialBonuses`;
- `SpellLogic.lua`: `PregenerateSpells`;
- `SpellScreenLogic.lua`: `OpenSpellScreen`, `GetEligibleSpells`,
  `CreateSpellButtons`, and `AcceptAndCloseSpellScreen`;
- `LootData_Selene.lua`: `SpellDrop` and its ordinary spell-screen callback;
- `TraitData_Aspect.lua`: `SuitHexAspect`, its linked Moon Beam spell, and its
  `TalentPointCount = 2` declaration;
- `RunLogic.lua` and `DeathLoopLogic.lua`: initialization of
  `CurrentRun.NumTalentPoints` from equipped trait values;
- `TraitData_Keepsake.lua`, `KeepsakeLogic.lua`, and `PowersLogic.lua`: Moon
  Beam's 3/4/5/7 point rows, acquisition grant, and Cherished increment; and
- `StoreData.lua` and `RequirementsData.lua`: `SpellDrop`/`TalentDrop`
  eligibility and the Aspect-specific ordinary-store exclusion.

## The source has a bank, not one cumulative Path counter

`CurrentRun.NumTalentPoints` is the mutable bank of additional selections
available at the next writable talent screen. It is not the total number of
Path pickups, the total number of points ever awarded, or the complete set of
invested Hex nodes.

The actual invested nodes live under `CurrentRun.Hero.SlottedSpell.Talents`.
`CurrentRun.InvestedTalentPoints` is a separate aggregate selection count. A
faithful planner account must therefore avoid labeling `NumTalentPoints` as a
cumulative “number of Path of Stars” value.

At run initialization, the game assigns `CurrentRun.NumTalentPoints` from the
sum of active `TalentPointCount` trait values. Only two installed declarations
supply that property:

- Moon Beam (`SpellTalentKeepsake`), with its processed rank value; and
- Aspect of Selene (`SuitHexAspect`), with two points.

Later source callbacks and ordinary spell selection add directly to the same
bank.

## Path of Stars reward values

The three concrete Path consumables inherit the same `OpenTalentScreen`
callback and differ in declared `AddTalentPoints`:

| Reward name       | Display role           | Declared points |
| ----------------- | ---------------------- | --------------: |
| `MinorTalentDrop` | Minor Path of Stars    |               1 |
| `TalentDrop`      | ordinary Path of Stars |               3 |
| `TalentBigDrop`   | Big Path of Stars      |               5 |

These are exact values, not rarity levels and not variants of one runtime
amount.

### Why the raw bank increases by zero, two, or four

On a writable pickup, `OpenTalentScreen` adds `AddTalentPoints - 1` to
`CurrentRun.NumTalentPoints`. The screen then guarantees one first legal node
selection even when the bank is zero. After that first selection, every
additional selection consumes one banked point.

Consequently:

| Pickup            | Immediate raw bank addition | Total new selections supplied by the pickup |
| ----------------- | --------------------------: | ------------------------------------------: |
| `MinorTalentDrop` |                           0 |                                           1 |
| `TalentDrop`      |                           2 |                                           3 |
| `TalentBigDrop`   |                           4 |                                           5 |

The subtraction is UI/lifecycle accounting, not evidence that the consumables
grant zero, two, and four points. Their player-visible and semantic grants are
one, three, and five.

Any points already banked before the pickup fund additional selections on the
same screen. This is how Moon Beam and the initial spell-choice bonus take
effect. If the Hex tree becomes fully invested before all banked points are
spent, the unused bank can remain; exact tree-capacity exhaustion cannot be
derived without modeling the tree.

Purchases and pickups use the same writable talent-screen callback once the
concrete consumable is acquired. Provenance changes purchase interactions, not
the declared point value.

## Ordinary initial Spell Drop

### Three distinct spells in an ordered offer

`PregenerateSpells` removes random eligible spell identities until it has
three distinct entries or exhausts the eligible set. `CreateSpellButtons`
creates positions one through three from that set. The installed ordinary
domain contains eight normal spell identities, so the planner's fully
progressed baseline has a complete three-option offer.

Offer order is semantically significant. `SpellTalentData.InitialBonuses` is
indexed by option position:

| Offer position | Bonus points |
| -------------- | -----------: |
| first          |            0 |
| second         |            1 |
| third          |            2 |

The bonus belongs to the position, not the spell identity. A spell appearing
first in one offer and third in another has zero in the first case and two in
the second. The offered identities are random, but once generated their order
must remain frozen through selection and simulation.

### Acquisition chronology

On selection, `AcceptAndCloseSpellScreen`:

1. installs the selected spell and its generated talent tree;
2. applies any other spell-acquisition contacts; and
3. immediately adds the selected button's zero/one/two bonus to
   `CurrentRun.NumTalentPoints`.

There is no separate pending “bonus on next TalentDrop” field and no later
callback that decides whether the bonus still applies. The points are already
in the ordinary bank. In the usual non-Aspect route, the initial `SpellDrop`
does not open the talent tree, so those banked points remain until a later Path
of Stars acquisition opens it.

Unselected spell positions grant nothing. Reordering an already-authored
offer changes which spell carries which bonus and is therefore a semantic
edit, not presentation state.

## Aspect of Selene

Aspect of Selene (`SuitHexAspect`) starts the run with the fixed
`SpellMoonBeamTrait`; it does not acquire that spell from an ordinary
three-option `SpellDrop` screen. Its declaration separately has
`TalentPointCount = 2`. Run initialization includes those two points in
`CurrentRun.NumTalentPoints`.

When a concrete `SpellDrop` is used while the Aspect trait is present,
`OpenSpellScreen` checks the Aspect before any spell-screen construction. It
calls `OpenTalentScreen` and immediately returns. Therefore:

- `CreateSpellButtons` never runs;
- no spell button receives `BonusTalentPoints`;
- `AcceptAndCloseSpellScreen` never runs;
- no position is selected; and
- the ordered zero/one/two bonus has no opportunity to apply.

The fixed Moon Beam talent tree receives Path investment directly. The
`SpellDrop` loot declaration itself has no `AddTalentPoints` field, but the
talent screen still supplies its implicit first selection. Together with the
Aspect's separate two-point starting allocation, this gives the
source-commented baseline of three investments on the first Selene pickup.

Aspect of Selene therefore receives **no initial Spell Drop offer bonus**. Its
two starting points are a declaration-owned aspect effect, not a hidden or
late application of the skipped second/third-position bonus.

Those raw two points are nevertheless not an independent planner outcome. The
source comment states their purpose directly: combine with the routed screen's
implicit first selection to make the first Aspect `SpellDrop` worth the normal
three Path selections. This reaches the same semantic state as an ordinary
zero-bonus spell acquisition followed by a normal three-point `TalentDrop`.
The planner can therefore fold the source's `2 + 1` accounting into one
three-point Aspect-routed `SpellDrop` without declaring an Aspect-owned bank at
route start.

The routed `SpellDrop` still records ordinary `SpellDrop` use, so later
`TalentDrop` eligibility and Moon Beam's “Hex already acquired” priority branch
see that acquisition.

### Q first-acquisition edge

Q can source `TalentBigDrop`, but that concrete reward retains the shared
`TalentLegal` requirement. `TalentLegal` requires a prior run-local
`CurrentRun.UseRecord.SpellDrop`; merely starting with Sky Fall from
`SuitHexAspect` does not satisfy it. The Aspect branch records `SpellDrop` use
only when the concrete `SpellDrop` is interacted with, immediately before it
opens the Path screen.

Therefore a Q Selene reward cannot be `TalentBigDrop` when it is the run's
first concrete Selene acquisition, even with Aspect of Selene. That first
acquisition remains `SpellDrop` and reaches the semantic three-point routed
screen. A later Q `TalentBigDrop`, after that use has been recorded, is a
distinct legal five-point acquisition.

## Moon Beam contacts with the bank

Moon Beam writes to the same `CurrentRun.NumTalentPoints` bank:

| Contact                                 | Point mutation |
| --------------------------------------- | -------------: |
| Common ordinary/Gift equip              |             +3 |
| Rare ordinary equip                     |             +4 |
| Epic ordinary equip                     |             +5 |
| Heroic ordinary equip                   |             +7 |
| Cherished Epic-to-Heroic reconstruction |             +2 |

Ordinary equip and Gift replay run the acquisition callback and also add the
separate exact reward priority documented by the reward-pressure audit.
Cherished adds only the two-point delta; it does not replay that callback or
priority.

Without Aspect of Selene, Moon Beam points remain banked through the initial
spell-selection screen and combine with its selected zero/one/two positional
bonus. With Aspect of Selene, the first `SpellDrop` is already the semantically
three-point Path screen described above. Any independently banked Moon Beam
points combine with that screen; the skipped spell offer still grants no
positional bonus.

## Planner disposition

The source facts support a narrow Path-accounting slice without a Hex-tree
model:

- retain the existing ordered three-row `SpellDrop` offer; option keys/row
  order are semantic because they own zero/one/two bonus points;
- add the selected ordinary spell row's bonus to the shared point account at
  spell acquisition, not at a later reward generation or pickup;
- declare `MinorTalentDrop`, `TalentDrop`, and `TalentBigDrop` as exact
  one/three/five-point sources;
- route Aspect of Selene `SpellDrop` directly through the shared three-point
  Path settlement while preserving its `SpellDrop` acquisition identity, and
  omit both the three-row spell offer and any positional bonus;
- apply Moon Beam ordinary, Cherished, and Gift grants to the same account; and
- keep reward-priority selection in the separate exact-name priority product.

The audit does **not** require authored Hex nodes. A future implementation must
name its projected counts truthfully—at minimum distinguishing awarded or
banked points from invested nodes—and must not claim exact remaining tree
capacity without a tree model. The simplest Moon Beam-capable slice may account
for point grants and Path acquisitions while leaving node identities and their
gameplay effects sim-neutral.

## Current planner coverage

The catalog declares the concrete one/three/five Path grants, the ordered
`SpellDrop` bonuses `[0, 1, 2]`, and Moon Beam's Common/Rare/Epic/Heroic
three/four/five/seven grants and exact priority targets. The compiler keeps
those closed declaration contracts local to their owning reward, trait-giver,
and keepsake declarations.

The simulation carries only `bankedPathPoints` and `investedPathPoints` on the
chronological branch. Concrete Minor/ordinary/Big Talent acquisition settles
the shared bank, an ordinary successful SpellDrop install banks its selected
row's zero/one/two bonus, and Aspect of Selene preserves SpellDrop acquisition
history while routing that child directly through the three-point settlement
without a trait offer. Moon Beam ordinary and Gift contacts bank their declared
points and insert the existing exact-name priority; the H-to-I and P-to-Q Gift
frontiers choose `TalentBigDrop`. Cherished only banks its Epic-to-Heroic
two-point delta.

Run State projects those two counts and the equipped spell identity. The scope
remains deliberately below Hex-node, capacity, and effect modeling: no authored
Hex tree, node identity, or claimed remaining capacity exists in the planner.
