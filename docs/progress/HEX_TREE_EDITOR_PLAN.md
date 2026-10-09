# Hex tree editor plan

Status: locked. Base commit: `7fdfd8833`. Schema bump 93 → 94 approved by the
owner.

## Objective

Model the Hex talent tree exactly: the talent on every node of the chosen
layout and the nodes invested at each writable Path of Stars screen. Edit both
on a visual board. The module realises the authored tree at creation and
highlights planned nodes on the talent screen.

Authoring stays light: the user pins only the nodes they care about; the engine
completes every other node, and every screen's activations, with a legal
deterministic fill.

## Source facts

Native scripts: `1GameData/Scripts`.

- **Creation.** `CreateTalentTree` builds the whole tree synchronously when a
  Spell Drop is accepted (`SpellScreenLogic.lua:361-363`) or Aspect of Selene
  is equipped (`WeaponUpgradeLogic.lua:459-460`). Path of Stars never builds
  it.
- **Layouts** (`SpellData.lua:38-241`): `Structure[depth][slot]` with `LinkTo`,
  `Pool`, `GridOffsetX/Y` and `Bidirectional`; backlinks are derived
  (`SpellLogic.lua:116-130`). Pyramid, Maze and Nacelle require a prior Path of
  Stars use.
- **Node kinds** (`SpellLogic.lua:51-115`): Keystone (Rare, from the spell's
  Rare pool without repeats), Legendary (Epic, likewise), OlympianSpell (the
  duo), OlympianCount, and Repeatable (Common, from a 4-talent pool that
  refills when empty, dropping talents at `MaxCount`). Repeatable counts per
  talent follow from the cycle; their order is unobservable.
- **God Sent** is inserted after the duo node once eligible; deterministic.
- **Activation** (`TalentScreenLogic.lua`): every node costs 1 and is invested
  once; a repeatable talent's level is its invested node count. A node is
  available when it is a root, linked from an invested or queued node, or
  bidirectional with an invested or queued neighbour. A writable screen
  spends every point (`min(bank + 1, remaining capacity)` selections); no
  refunds.
- **Points:** Path of Stars grants 1 / 3 / 5; Aspect of Selene and Moon Beam
  add starting points; Spell Drop rows add 0 / 1 / 2.
- **Legality:** Task Force requires an Olympian talent (`TraitData_Athena.lua`
  505-522); closure is count-based. No talent affects max health or magick.

## Decisions

- Repeatable legality is the per-talent count vector of a valid cycle; order
  is not authored or checked.
- Investments in game are highlighted, not enforced. Conformance stays
  legality-only: the existing Rare/Epic and point-count facts, plus the
  invested Olympian talent where Task Force depends on it.
- Task Force requires an invested Olympian talent before the Athena offer.
- One shared activation value per screen across surviving branches; a pin that
  does not fit a branch is a finding.

## Authored model (schema 94)

- Tree on the Spell Drop offer and the Aspect `aspectHexTree`:
  `{ layoutKey, pinnedNodes: Record<nodeKey, talentKey> }`, replacing the
  Rare/Epic sets. Unpinned nodes resolve to the engine's completion.
- Activations on each writable Path of Stars screen (and the Aspect-routed
  Spell Drop screen): `pinnedNodeKeys[]`; the remaining selections resolve to
  the engine's completion.
- Migration 93 → 94: existing Rare and Epic picks are pinned into their
  Keystone and Legendary slots in layout order; no activation pins.

## Ownership

- **Catalog:** per layout, nodes keyed `depth:slot` with kind, links,
  bidirectionality and grid offset; per spell, Rare/Epic/repeatable pools with
  `MaxCount`, and duo and God Sent positions.
- **Engine:** tree legality and completion around pins; activation legality,
  completion around pins and settlement; invested points derived from the node
  set; candidate domains for node talents and activatable nodes; Task Force
  tightened.
- **Execution plan:** the realised node map at creation; planned invested nodes
  per screen; the invested Olympian fact where Task Force needs it.
- **Game module:** overwrite node talents after native `CreateTalentTree`
  returns, keeping every native draw; highlight planned nodes on the talent
  screen; the reader publishes the facts conformance checks.
- **Planner:** a tree board (pin talents, see completed nodes) and an
  activation board per screen, reusing the `EditorDialog` draft model,
  draft feedback and finding marks.

## Gates

1. **Catalog graph.** Layout node graphs and per-spell pools; tree completion
   and legality in the engine as pure functions with tests.
2. **Authored tree.** Schema 94 with migration, pinned tree on Spell Drop and
   Aspect, completion in settlement, execution node map, module realisation,
   tree board. Fixtures regenerated.
3. **Activations.** Pins and completion per screen, settlement, Task Force,
   execution planned nodes, module highlight and reader, activation board.

Each gate is one commit and closes with `npm run check`; the plan closes by
deleting this document.

## Non-goals

- Enforcing investments on the talent screen.
- Talent combat effects.
- The start-from-room feature.
