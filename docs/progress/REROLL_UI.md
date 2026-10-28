# Reroll UI

Status: locked 2026-10-28. Base commit: `e75f00be4` plus the Hub later-visit
reroll commits. No schema change beyond the schema bundle. Closes together with
[the schema bundle](SCHEMA_BUNDLE.md), whose model it edits.

## Objective

Make the rerolls modelled by the schema bundle authorable and visible, so the
owner can exercise them by hand before both plans close.

## Settled decisions

1. **The list owns what, the timeline owns when.** Each reward-offering
   surface authors its rerolls in one ordered list (row = target + new
   reward; append at the end; every row has Remove, and later rows a removal
   invalidates stay with their findings). The same actions show as timeline
   rows with Move, the only place their position changes, so a reroll can sit
   before or after other post-unlock actions (a Mystery box, a Well purchase)
   and the engine settles them in that order. All other reroll findings route
   to the list row; an out-of-order finding routes to the timeline row.
2. **Labels:** a rerolled target's reward reads first draw → final, and the
   next room's header and the rail show the final reward.
3. **Normal rooms:** Room Doors keeps its layout; the Rerolls list sits below
   the doors (doors and Fields cage slots as targets).
4. **O rooms:** each active wheel encounter gets its own tab after the
   timeline tab it follows (e.g. Overview · Intro Timeline · Intro Wheels ·
   Combat 1 Timeline · Combat 1 Wheels · Room Doors) holding the pool, offers,
   the Rerolls list and the pick; the timeline keeps a read-only "Next phase"
   marker, and wheel rerolls also show as timeline rows.
5. **Hub:** the map stays the Timeline tab's default. A **Details** button
   opens the Hub timeline: required visits pinned, the fountain as a movable
   row in any gap, a board recap after each visit (each door's current reward
   and whether it is entered), and a Rerolls list in each gap (unentered board
   doors only). Fountain edits from the map remain; both send the same command.
6. **Stygian Well and Pool of Purging:** the Overview shows presence and the
   initial stock only; its slots are always editable and optional (no
   "Interact" gate). Interaction starts in the timeline: each present object
   has an entry at the top of the optional action section (e.g. "Stygian Well
   ▸") listing what can be done at the end of the current sequence (buy or
   sell each offered slot, Reroll with its cost, disabled when the pool cannot
   pay); one pick appends one action at the end of that window, which Move
   repositions. Reroll rows carry optional pickers for the restocked slots.
7. **Screen rerolls:** a count control on single-pick screens (trait, Chaos,
   Pom).
8. **Visibility:** reroll lists, counts and the Reroll entry are hidden
   without the enabling card unless the plan already holds rerolls (then
   shown with findings).
9. **Pool:** a Run State row, and "N left" on each Rerolls list header.
10. Copy follows the UI copy, finding copy and hover rules.

## Gates

1. **Engine products** (planner-engine): a pre-check telling whether a pool
   spend at a position is allowed (adding past the pool must be disabled
   ahead, never thrown from the reducer); candidates for a reroll not yet
   inserted; rerollable targets at a position; settled current reward per
   owner at a point and a per-visit Hub board snapshot; pool remaining per
   Hub gap. Tests at the owning authority.
2. **Room Doors Rerolls list** (planner): projection, interactions, finding
   routing, labels, timeline rows with Move (done: `8ba780169`, `33e2c4e68`).
3. **Wheel tabs** (planner): relocation with tab ids, routing whitelist,
   marker destinations, Run State by tab, legend.
4. **Hub details timeline** (planner).
5. **Well and Pool rolls** (engine, game module, planner): the schema-bundle
   reshape (initial stock, reroll actions with rolls, purchases and sales
   naming their roll, derived offered slots, per-feature cost counters,
   pre-check and candidates per roll, wire, game module installing each
   authored roll on its native reroll, import with an assumption note), then
   the panel and Interact picker.
6. **Screen counts and Run State pool** (planner).
7. **Manual testing by the owner**, then the joint closure with the schema
   bundle.

Each UI gate iterates shape with screenshots on a separate Vite port and
cache; curated Doors, Hub map and ship layouts stay otherwise unchanged.
Lanes per gate from the diff (`test:engine`, `test:planner`, `test:ui`,
`test:contract` when capabilities change); equivalence only if simulation is
touched.

## Non-goals

- Moving doors into the timeline.
- Authored-shape changes beyond the Well and Pool reshape, which lands under
  the schema bundle's unpushed version 100.
