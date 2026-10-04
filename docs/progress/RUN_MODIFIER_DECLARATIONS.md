# Run modifier declarations

Status: locked 2026-10-04. Base: `53a872c0`. Schema stays 90; the execution
protocol's `runModifiers` record changes shape under the existing build-id gate.

## Objective

Run modifiers become a declared, tolerant bag so the owner can add, trial and
remove modifiers without schema bumps. The two guaranteed crit and double-damage
modifiers are removed as the first deletion; the enemy gold-drop chance
multiplier remains as the only released modifier.

## Scope

Included: one declaration table in the engine driving the authored type, codec,
execution-plan record and the Loadout UI; tolerant decoding for this record
only; removal of the two guarantee modifiers end to end; fixture and baseline
regeneration; module decoder tolerance and removal of the two executor wraps.
Excluded: new modifiers, the gold modifier's semantics, anything outside the
`runModifiers` record.

## Facts and chosen simplifications

- Run modifiers are planner policy, not game facts; the guarantees were never
  released, so no external save carries them.
- Decoding this one record drops unknown keys and replaces a malformed known
  value with its declared default. Every other authored record stays exact.
  `docs/design/AUTHORED_PROJECT_MODEL.md` records the exception beside the
  schema policy.
- The encoder writes only non-default values and omits an all-default block.
- A modifier declaration carries authoring shape and stage, never behaviour:
  `key`, `kind` (`boolean` | `number` with `min`, `max`, `step`), `default`,
  `label`, `description`, `stage` (`released` | `internal`). Behaviour stays
  with its owner (engine export, module hook).
- The module keeps its own list of modifiers it implements and ignores unknown
  wire keys, so an engine-side experiment the module lacks is inert in game.
- The Loadout UI renders `released` declarations generically; `internal` ones
  render only when the application runs in a dev build.

## Ownership

Engine (`packages/planner-engine`): `authored-project/run-modifiers.ts` owns the
declaration table, derived `RunModifiers` type, defaults, `decodeRunModifiers`,
`isNativeRunModifiers`; `authored-project/model.ts` and
`commands/project-state.ts` adapt; `execution-plan/model.ts` and `codec` derive
the wire record from the same table. Fixture
`test/execution-plan/fixtures/run-modifiers.execution.json` regenerates through
the owning builder; the equivalence baseline updates through its generator for
that entry's plan digest only.

Game module (`game-module`): `protocol/decoder.lua` decodes `runModifiers` as
known-keys-only, ignoring unknown; `run_modifiers/hooks.lua` drops the crit and
double-damage wraps (`Damage`, `RandomChance`, `GetTotalHeroTraitValue`, `Kill`
as applicable) and keeps `CheckMoneyDrop`. Lua tests follow.

Application (`apps/planner`): `projections/structured-workspace/interactions/run-modifiers.ts`
exposes one intent per declared modifier; `ui/shell/RouteOverview.tsx` renders
the modifiers section from the declarations (toggle or slider by kind, existing
slider commit behaviour retained for the gold multiplier); dev-build gate for
`internal`. Tests: interactions, `RunModifiers.interaction.test.tsx`, product
loop.

Docs: AUTHORED_PROJECT_MODEL (exception + declaration ownership),
GAME_INTEGRATION_BOUNDARY (module ignores unknown modifiers),
`docs/audits/loadout-and-progression/RUN_MODIFIERS_GAME_DATA_AUDIT.md`
disposition (facts kept, guarantees marked retired), and
`docs/testing/RUN_MODIFIERS_LIVE_ACCEPTANCE.md` loses the guarantee bullets.

## Gates

1. `feat(engine): declare run modifiers as a tolerant bag` with the protocol
   record, fixture, baseline and module changes in the same commit (shared
   fixture corpus keeps both lanes green together).
2. `feat(planner): render run modifiers from their declarations`, docs and
   checklist, then delete this plan in the same closure commit.

## Tests

Engine: codec drops unknown keys and heals malformed values; all-default omits
the block; a save carrying the two retired keys decodes to the gold-only shape;
plan record round-trips; declaration table has unique keys and valid domains.
Module: decoder ignores unknown modifier keys; gold path unchanged; removed
wraps absent. App: generic rendering per kind, `internal` hidden outside dev,
gold slider behaviour unchanged. Equivalence before and after gate 1; only the
run-modifiers fixture's plan digest may change.

## Non-goals

Modifier semantics in the declaration table, per-modifier JSX, migration code,
and a schema bump.
