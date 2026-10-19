# Schema 97 Plan

Status: locked. Base commit: `a4ef4fc85`. Schema bump approved by
the owner (2026-10-18) for the draft section; the rack and Practice changes ride
along.

## Objective

One major authored bump, 96 → 97, with one migration, that:

1. saves the Draft spec in the project;
2. makes every Postboss keepsake rack a permanent, movable timeline row whose
   keepsake may be "unchanged" (a no-op);
3. moves the Practice start point out of run modifiers into its own route
   field.

## 1. Draft section

- **Shape:** `route.draft`, always present (declaration-owned default: empty).
  - `godKeys: string[]`
  - `storyNpcByBiome: Record<biomeKey, npcKey>`
  - `fieldNpcsByBiome: Record<biomeKey, npcKey[]>`
  - `basketTraitKeys: string[]`
  - `rackKeepsakeByBiome: Record<afterBiomeKey, keepsakeKey>` (missing = inherit)
  - `seed: number`

  The loadout and route are not duplicated: the draft reads them from the
  project, as today.

- **Codec:** strict on known keys and catalog references. Entries for biomes no
  longer on the itinerary are kept (representable), and pruned in the
  projection as today.
- **Commands:** one `ReplaceDraftSpec { draft }`. The app's draft session keeps only
  run state (idle, running, outcome). The spec lives in the project.
- **History:** draft-spec edits are ordinary authored commands, so each is an Undo
  step. No new non-history edit path.
- **ReplaceRoute:** replaces the loadout and biomes only, so `route.draft`
  survives a draft. The generator still takes the spec as an argument.

## 2. Postboss keepsake rack

- **Shape:** every occurrence of a room declaring `hasKeepsakeRack` has
  `keepsakeRack: { keepsakeKey: string | null, equipResults? }`, and its
  `interactKeepsakeRack` reference is always in `roomActions.order`.
  `keepsakeKey: null` means unchanged.
- **Unchanged is a no-op everywhere:**
  - no `keepsakeRackUsed` effect;
  - no lifecycle window;
  - no Phial order dependency;
  - no timeline fence;
  - no `keepsakeChange` transaction (today a missing key throws).

  The overview keeps emitting `keepsakeRack: {}`, which is what an unswapped rack
  already publishes, so the plan wire is unchanged apart from the schema pair.

- **Commands:**
  - `ReplacePostbossKeepsake { keepsakeKey: string | null }`: null clears the key
    and the equip results. A key change drops equip results whose owner no
    longer matches.
  - `RemovePostbossKeepsake` is retired. The row's position never changes on
    set or clear.
  - The existing Move keeps working for the rack.
- **Defaults:** room creation adds the rack (null) at the end of the order.
- **Draft walk:** `equipRack` sets the key; null stays null.
- **Editor:** one permanent row in the timeline that can be moved. It reads
  "<Keepsake> (Unchanged)" or the chosen keepsake plus its target. It has no
  trash can, and its dialog stays open across changes.

## 3. Practice start point

- **Shape:** `route.practiceStart?: RunStartPoint` (absent = full run), removed
  from `route.loadout.runModifiers`. The healing rules move with it.
- **Command:** `ReplacePracticeStart { startPoint | null }`. `ReplaceRunModifiers`
  no longer carries it. ReplaceRoute and the draft carry it over.
- **Execution:** the `startState` wire is unchanged.

## Migration 96 → 97

`apps/planner/src/persistence/project-96-to-97.js`, with its `.d.ts`, loader
entry, `schema/` CLI wrapper and npm script, following 95 → 96:

1. Add an empty `route.draft`.
2. For every rack-bearing occurrence without `keepsakeRack`, add
   `{ keepsakeKey: null }` and append `interactKeepsakeRack` to the order.
3. Move `loadout.runModifiers.startPoint` to `route.practiceStart`.

The fixtures for older schemas stay as they are.

## Wire and module

- **Schema pair:** the plan fingerprint carries the schema pair, so the game
  module's decoder (`SCHEMA_VERSION`, `SCHEMA_REVISION`) and
  `execution-compatibility.json` move to 97/0.
- **Execution fixtures:** a mechanical header edit only. No semantic regeneration
  is expected; any other diff is a defect.
- **Module behaviour:** none, because a rack with no swap was already emitted as
  `{}`.
- **Previously sent plans:** any plan sent before the bump must be re-sent after
  it. Announce this in the commit and release notes.

## Gates

1. **Engine and migration.**
   - Model, codecs, commands and defaults.
   - The rack no-op through simulation, candidates and the execution plan.
   - The migration and the loader.
   - Checkpoints via `fixtures:checkpoints:regenerate`.
   - Execution fixture headers.
   - Equivalence baseline rewritten (intended: schema pair, plus any rack
     ordering in the checkpoints).
   - Tests:
     - the migration;
     - the codec;
     - commands (set, clear, and the order staying stable);
     - a null rack producing no effect, transaction or fence;
     - an unswapped rack placed before a Fountain doesn't fence a Phial.
2. **Application.**
   - The permanent rack row.
   - The draft session reading and writing `route.draft` through `ReplaceDraftSpec`.
   - The Practice start UI on `ReplacePracticeStart`.
   - Tests updated; one product witness: draft settings survive save, load and
     Undo.
3. **Game module.** The decoder schema pair, the compatibility JSON, and
   `npm run test:game-module`.
4. **Closure.**
   - `AUTHORED_PROJECT_MODEL.md` (shape and migration).
   - Remove the bundled items from the pending tidy-up note.
   - Full `npm run check`.
   - A fresh independent reviewer, as for schema changes.

## Owner decisions

1. Draft-spec edits are Undo steps; no new non-history edit path.
2. The seed is persisted.
3. The draft section lives at `route.draft`.

## Non-goals

- Saving draft run outcomes or reports.
- Any change to the plan wire beyond the schema pair.
