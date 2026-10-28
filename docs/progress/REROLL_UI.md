# Reroll UI

Status: locked 2026-10-28. Base commit: `e75f00be4` plus the Hub later-visit
reroll commits. No schema change. Closes together with
[the schema bundle](SCHEMA_BUNDLE.md), whose model it edits.

## Objective

Make the rerolls modelled by the schema bundle authorable and visible, so the
owner can exercise them by hand before both plans close.

## Settled decisions

1. **One style for every reward-offering surface:** the first draws as today,
   followed by an ordered **Rerolls** list. A row names its target and the new
   reward; rows are appended at the end; every row has Remove, and later rows
   that a removal invalidates stay with their findings. One flat list per
   surface with a target picker per row (order across targets matters).
2. **Labels:** a rerolled target's reward line reads first draw → final.
3. **Normal rooms:** Room Doors keeps its layout; the Rerolls list sits below
   the doors (doors and Fields cage slots as targets).
4. **O rooms:** each active wheel encounter gets its own tab after the
   timeline tab it follows (e.g. Overview · Intro Timeline · Intro Wheels ·
   Combat 1 Timeline · Combat 1 Wheels · Room Doors) holding the pool, offers,
   the Rerolls list and the pick; the timeline keeps a read-only "Next phase"
   marker. The pick is the last authored thing before combat.
5. **Hub:** the map stays the Timeline tab's default. A **Details** button
   opens the Hub timeline: required visits pinned, the fountain as a movable
   row in any gap, a board recap after each visit (each door's current reward
   and whether it is entered), and a Rerolls list in each gap (unentered board
   doors only). Fountain edits from the map remain; both send the same command.
6. **Screen rerolls:** a count control on the supported trait, Chaos, Pom,
   Well and Pool screens.
7. **Visibility:** reroll lists and counts are hidden without the enabling
   card unless the plan already holds rerolls (then shown with findings).
8. **Pool:** a Run State row, and "N left" on each Rerolls list header.
9. Copy follows the UI copy, finding copy and hover rules.

## Gates

1. **Engine products** (planner-engine): a pre-check telling whether a pool
   spend at a position is allowed (adding past the pool must be disabled
   ahead, never thrown from the reducer); candidates for a reroll not yet
   inserted; rerollable targets at a position; settled current reward per
   owner at a point and a per-visit Hub board snapshot; pool remaining per
   Hub gap. Tests at the owning authority.
2. **Room Doors Rerolls list** (planner): projection, interactions, finding
   routing, labels; also renders imported reroll rows fully.
3. **Wheel tabs** (planner): relocation with tab ids, routing whitelist,
   marker destinations, Run State by tab, legend.
4. **Hub details timeline** (planner).
5. **Screen counts and Run State pool** (planner).
6. **Manual testing by the owner**, then the joint closure with the schema
   bundle.

Each UI gate iterates shape with screenshots on a separate Vite port and
cache; curated Doors, Hub map and ship layouts stay otherwise unchanged.
Lanes per gate from the diff (`test:engine`, `test:planner`, `test:ui`,
`test:contract` when capabilities change); equivalence only if simulation is
touched.

## Non-goals

- Moving doors into the timeline.
- Any authored-shape or wire change.
