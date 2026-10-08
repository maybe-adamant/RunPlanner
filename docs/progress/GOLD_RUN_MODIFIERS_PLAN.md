# Gold run modifiers plan

Status: locked. Base commit: `9cc737381`.

## Objective

Replace the enemy gold-drop chance multiplier with two switchable percentage
modifiers in Loadout. Each row is a checkbox plus a 0–100% slider; an unchecked
row leaves the game native.

- **Enemy gold drop chance**: every eligible enemy rolls its gold drop at
  exactly the chosen percentage.
- **Encounter gold range**: each rolled encounter gold budget is fixed at
  `min + percent × (max − min)` of its native range, rounded to an integer.

## Source facts

- `GenerateEncounter` rolls the budget once:
  `RandomInt(MoneyDropCapMin, MoneyDropCapMax)`, then adds
  `RunDepthCache × MoneyDropCapDepthRamp` and applies the hero
  `MoneyMultiplier` (`RunLogic.lua:1188-1190`). It is the only rolled budget;
  one story encounter declares a fixed `MoneyDropStore = 25`
  (`EncounterData_Story.lua:1924`).
- The budget roll precedes the difficulty and wave rolls the module already
  steers, so the modifier must keep exactly one native draw. Narrowing the range
  to one value before the call is the existing pattern
  (`game-module/src/mods/room/timeline/encounters/generated.lua` base roll).
- A drop is allowed while the store is above zero and the full rolled amount is
  then deducted (`RoomLogic.lua:2340-2376`), so the final kill can overshoot.
  Kill order stays the player's.
- Eligibility for the chance modifier is unchanged from today: capped
  hostile-enemy death drops with a positive native chance
  (`RUN_MODIFIERS_GAME_DATA_AUDIT.md` "Capped hostile-enemy gold").

## Planner simplifications

- A percentage below the native chance is allowed; the game can always roll no
  drop.
- The budget range ignores the depth ramp and money multiplier; both still apply
  natively after the fixed roll.
- The fixed story budget is unaffected.

## Saved data

Approved by the owner: `enemyGoldDropChanceMultiplier` is retired outright.
The tolerant `runModifiers` decoder drops it on load like any unknown key; no
migration and no schema bump. New keys:

- `enemyGoldDropChance`
- `encounterGoldRange`

An absent key means off. A present key is an enabled percentage in `0..100`.

## Ownership

- **Engine** (`authored-project/run-modifiers.ts`): add one declaration kind,
  an optional percentage (absent = native), and replace the declaration table.
  Decode heals out-of-range values by clamping as today; encode writes only
  enabled values. `ReplaceRunModifiers` stays the one history command.
- **Execution plan** (`execution-plan/codec.ts`, `model.ts`): carry the new
  record; producer omits native settings as today. Regenerate
  `fixtures/run-modifiers.execution.json` only.
- **Planner UI** (`RouteOverview.tsx`, `interactions/run-modifiers.ts`):
  render the optional-percentage kind as a checkbox plus slider from the table.
  The slider is disabled while unchecked and keeps its last value in UI state
  only.
- **Game module** (`protocol/decoder.lua`, `run_modifiers/hooks.lua`): read
  the two new keys, validate `0..100`, delete the multiplier path. The chance
  hook replaces an eligible `data.Chance` with `percent / 100`. The budget hook
  wraps `GenerateEncounter` for every encounter with numeric cap bounds,
  narrows `MoneyDropCapMin`/`MoneyDropCapMax` to the fixed value for the call
  and restores both on return or error. It composes with the planner-owned
  generation wrap.
- **Docs**: `GAME_INTEGRATION_BOUNDARY.md` "Run modifiers", the
  `AUTHORED_PROJECT_MODEL.md` runModifiers paragraph, and the run-modifier
  audit gain the budget contact; revise in place.

## Gates

1. **Engine, execution plan and planner UI.** One commit. The module ignores
   the new wire keys until gate 2 and treats the missing multiplier as native.
   Tests: `npm run test:engine`, `npm run test:planner`,
   `npm run test:equivalence` (unchanged unless a listed builder sets
   modifiers; report before rewriting).
2. **Game module and docs.** One commit. Tests: `npm run test:game-module`,
   including one witness that a budget roll makes exactly one `RandomInt` call
   and restores both bounds on error.

Closure: `npm run check`, delete this plan, add live checks to the
`docs/testing/` run-modifier checklist (or a new one if none exists).

## Primary test owners

- Declaration, decode heal and encode: engine run-modifier tests.
- Wire validation: execution-plan codec tests plus the fixture.
- Checkbox and slider: one UI test for the row.
- Chance replacement, budget narrowing, draw count, restoration: module
  run-modifier tests.

## Non-goals

- Controlling kill order, drop amounts, or the depth ramp.
- Reaction, breakable, uncapped or urn gold.
- Migrating saved multiplier values.
