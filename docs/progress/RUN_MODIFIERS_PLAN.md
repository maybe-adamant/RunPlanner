# Optional run modifiers delivery plan

Status: locked delivery contract; independent pre-execution review found no
blocking conflicts. Gate A is next.

Base: `b8c1af9bef8e1c2fb3ebbc8d550dc267f2f399af`.

## Objective and scope

Add three optional settings across two contracts to Loadout: guarantee eligible
player critical-hit rolls, guarantee eligible player double-damage rolls, and
multiply enemy gold-drop chance. All settings start at native behavior. They apply to the admitted run, not just
customized encounters, and do not change encounter composition or planner
eligibility.

The planner owns the settings, their validation, history, persistence, and
export. The game module applies them at narrowly identified native contacts.
The game still owns damage restrictions, gold amounts, the encounter money
store, and native crit and double-damage prerequisites.

Excluded: new crit or double-damage sources, luck changes, arbitrary damage
multipliers, extra money stores, gold amount multipliers, reaction gold,
all gold-urn appearance and denomination modifiers, and additional breakables.
Do not add simulated combat or a gold-balance model to support these options. No module-global configuration checkbox duplicates the authored
settings.

## Governing authorities

Read these sections before work in their owning lane:

- `AGENTS.md`: ownership lanes, construction and data flow, schema approval,
  generated fixture discipline, and plan lifecycle.
- `docs/design/SIMULATION_AND_VALIDATION.md`, in full before engine work:
  engine ownership, explicit products, and extension boundaries.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: schema change approval and
  `RouteLoadout` ownership.
- `docs/design/ARCHITECTURE.md`: dependency direction and explicit construction.
- `docs/design/EDITOR_MODEL.md`: loadout presentation, semantic edits, and
  separation of authored history from UI drafts.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`: execution compatibility and build
  identity, execution ownership, mismatch classification, and session lifetime.

## Source facts and chosen limits

Source root for this audit is the local extracted Hades II snapshot at
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`. Function names below are
the source anchors; source-backed probes must verify the exact contacts against
the available snapshot during Gate C.

### Critical hits

`CombatLogic.lua:Damage` calculates crit chance, applies player luck and
`OutgoingUnmodifiedCritBonus`, then calls `RandomChance` for crit and separately
for double damage. Native projectile/effect `BlockCrit` rules still run after
the roll. `CalculateCritChance` also includes contextual prerequisites and
victim crit vulnerability. Other crit rolls exist outside this contact.

Chosen limit: affect only the native outgoing player-damage crit roll, with a
final effective chance greater than zero. A positive raw chance is not the
criterion: the final argument after bonuses is. A zero chance remains native
even though the native code calls `RandomChance` at zero.

Call the original RNG once with its original arguments, then override the
eligible crit result to success. Do not skip RNG consumption, change the
calculation, force `IsCrit` afterward, bypass `BlockCrit`, or affect the following
double-damage roll, incoming damage, unrelated hit effects, or other randomness.

### Double damage

`CombatLogic.lua:CalculateDoubleDamageChance` evaluates outgoing modifiers,
including weapon, trait, active-effect, and Omega prerequisites. The Ares
`AresStatusDoubleDamageBoon` requires the victim's `AresStatus` effect;
`MissingHealthCritBoon`, despite its name, contributes to double-damage chance
based on missing hero health. Both are declared in `TraitData_Ares.lua`.

`CombatLogic.lua:Damage` rolls `RandomChance(ddChance * luckMultiplier)`
immediately after the separate crit roll. Unlike crit, this roll does not add
`OutgoingUnmodifiedCritBonus`. Native effect `BlockDoubleDamage` is checked
before applying the double-damage multiplier; this contact does not check a
projectile `BlockDoubleDamage` field. Preserve the actual native restriction.

Chosen limit: an independent, default-off option guarantees only the outgoing
player-damage double-damage roll when its final effective chance is greater
than zero. Preserve contextual prerequisites and leave zero chance unchanged.
Call the original RNG once with its original arguments, then override only the
eligible double-damage result. Do not force `IsDoubleDamage` afterward or
change the crit roll. Both options may be enabled: native code independently
applies the crit multiplier of three and double-damage multiplier of two when
both succeed and their respective blockers permit them.

### Enemy gold

`CombatLogic.lua:Kill` calls `RoomLogic.lua:CheckMoneyDrop` with the victim's
`MoneyDropOnDeath`. Reactions also call `CheckMoneyDrop` with different data.
The function rolls `Chance`, honors `BlockMoney`, computes native parcels and
money bonuses, and debits `CurrentRun.CurrentRoom.Encounter.MoneyDropStore`.
`RunLogic.lua` initializes that store. Native parcel rounding can make its last
drop overshoot the remaining store; preserving the native cap does not mean
introducing a stricter last-parcel clamp.

Chosen limit: boost capped hostile-enemy death drops only. Require the exact
death-drop contact, a native encounter money store, and drop data that does not
ignore that store. Absent or nonpositive chances stay native. Urns, cocoons,
reaction drops, authored rewards, and uncapped drops are outside this setting.

For a positive native chance `p` and authored multiplier `m`, use
`min(1, p * m)`. Change only the chance supplied to the native drop function,
through a call-local data copy. Preserve every other field, native check, and
native store mutation. Do not mutate shared enemy declarations or add another
gold counter.

## Authored and execution contract

Keep authored schema **90**, execution format, and catalog version unchanged.
No migration is needed: old projects and execution documents omit the optional
group and retain native behavior. Save-breaking changes would require separate
owner approval.

Add `route.loadout.runModifiers?` with a complete group when present:

```ts
type RunModifiers = {
  guaranteeEligibleCrits: boolean;
  guaranteeEligibleDoubleDamage: boolean;
  enemyGoldDropChanceMultiplier: number;
};
```

The declaration-owned native values are `false`, `false`, and `1`. The enemy
gold-drop multiplier must be a finite number at least one; fractions are legal. Do not invent an arbitrary
upper bound or silently clamp authored values. Runtime probabilities saturate
at one without rewriting the multiplier. A present group must contain all
three fields and no unknown fields; absence, not a partially populated group,
represents the old default.

One engine semantic command, `ReplaceRunModifiers`, replaces the complete
group. It checks the route address and values, supports no-op identity, and
omits the group when reset to all-native values. Decoding does not rewrite
loaded projects just to insert defaults. Keep native equipment immutable in
Fresh File, but allow these execution options there: do not remove the existing
Fresh File guard from unrelated loadout commands.

Assembly exposes an optional top-level `runModifiers` product on the execution
plan, separate from `startingLoadout` and native equipment conformance. Export
the complete group only when non-native. The compiler remains a lossless
translator; it does not infer settings from a snapshot or trait state.

Both strict decoders and fingerprint construction must account for the optional
group. Default documents retain their existing wire and fingerprints. Changing
a non-native setting changes the plan fingerprint. The decoded wire must not
be mutated to add default fields before fingerprint verification.

Old binaries can reject new documents containing the group even though the
authored schema is unchanged; this is additive read compatibility for the new
app, not a guarantee that older apps read new fields. The current bundled-module
build identity handles the new wire consumer. Do not reintroduce a numeric
execution protocol version or bump the catalog solely for these options.

## Runtime lifetime and failure policy

Activate options only after successful admission and starting-loadout
verification, or successful supported pre-entry Postboss re-admission.
Already-entered room restoration does not add a new admission path. Bind activation
to the current native run identity and the admitted plan, not inbox previews.
Changing the selected slot mid-run does not change active options.

For a disabled crit/double-damage option or multiplier of one, call native code unchanged:
no copied arguments, temporary object writes, extra RNG calls, or reseeding.
Enabling one setting must not activate any other setting.

Current room hooks mark execution inactive after the configured prefix. These
run-wide options intentionally continue for that same admitted run after
`configured-prefix-complete`; ordinary room steering must remain passive.
Implement this narrow exception in the modifier owner without making other
adapters accept inactive sessions. This is not permission to continue after an
admission rejection, mismatch, executor fault, or run reset.

At death, return to the Crossroads, or a new native run, the old activation must
not modify damage rolls or enemy gold drops. Postboss re-admission starts a
fresh local activation from the admitted document. Native `StartNewRun` replaces
`CurrentRun`; run identity prevents carryover to the next run. Prove passivity
between death and that replacement through native call paths or explicit
eligibility guards; a dedicated death hook is not required. No activation state
or RNG override is persisted into native save data.

Temporary scopes must be coroutine-local, nesting-safe, and restored on both
normal return and errors. A recognizable unsupported contact passes through
and reports bounded diagnostic evidence once. A missing required native hook
or throwing host function follows the existing executor-fault policy. These
settings do not create crit-count, double-damage-count, or gold-total conformance checks;
random outcomes are not player-divergence evidence.

## Ownership and change neighborhood

| Owner                   | Starting neighborhood                                                                                                          | Product and primary tests                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Engine authored model   | `packages/planner-engine/src/authored-project/{model,codec,loadout}.ts`, `commands/{types,dispatch,contract,project-state}.ts` | Complete optional settings and semantic edit; authored codec/default/command tests in the matching engine test neighborhoods. |
| Engine export           | `packages/planner-engine/src/execution-plan/{assembler,model,compiler,codec}.ts`                                               | Explicit optional execution product and fingerprint; producer/decoder tests and one generated non-native fixture witness.     |
| Application             | `apps/planner/src/projections/structured-workspace/`, `apps/planner/src/ui/shell/RouteOverview.tsx`, route-shell styles        | Bound complete edit and presentation; projection, UI, history/persistence, and representative product tests.                  |
| Game module decoding    | `game-module/src/mods/protocol/decoder.lua` and a focused settings decoder if warranted                                        | Strict wire acceptance and fingerprint parity; Lua protocol tests reading the real engine fixture.                            |
| Game module realization | `game-module/src/mods/runtime/{composition,session}.lua`, new focused run-modifier adapter, existing native bindings           | Exact native contacts and lifetime; focused Lua tests plus probes under `game-module/tests/probes/`.                          |

Catalog declarations and simulation state do not change. No new generic
modifier framework, service registry, sidecar semantic map, or mirrored
eligibility model is needed. If an adapter needs a new module, identify its
explicit inputs, owned scope, consumers, and tests before creating it.

## Gate A Engine settings and bilateral wire support

Deliver the authored group, native defaults, complete semantic command, strict
project decoding, execution assembly, strict TS/Lua decoding, and fingerprint
handling together. This gate must remain testable on both sides; do not emit a
field the module cannot decode.

Primary acceptance:

- Old schema-90 projects load and encode without default-field churn. Existing
  native execution documents still decode with their original fingerprints.
- Complete non-native settings survive command, encode/decode, export, and Lua
  decode. Unknown, partial, wrong-type, nonfinite, and below-one values fail at
  their structural owner. Fractional multipliers are accepted.
- Reset, no-op, wrong-route, and Fresh File option edits behave correctly while
  Fresh File equipment commands remain prohibited.
- Use one real producer-to-consumer fixture built through the existing engine
  execution fixture builder and `encodeExecutionPlan`. Format with repository
  Prettier settings. Do not add a full authored checkpoint or regenerate the
  existing default corpus merely to exercise three scalar settings.

Run the affected engine tests and `npm run test:game-module`. Inspect fixture
numstat and a representative diff. Gate A publishes data but does not claim
runtime enforcement; no release until Gate C and closure.

Intended commit: `feat(engine): author and export optional run modifiers`.

## Gate B Loadout authoring

Add a compact **Run modifiers** section to Loadout, after starting equipment
and reward controls. It remains available in Fresh File without exposing its
fixed equipment as editable. Reuse existing gold checkbox and numeric-input
styling, spacing, wrapping, and accessible labeling.

Use these labels:

- **Guarantee eligible crits** — checkbox, initially unchecked.
- **Guarantee eligible double damage** — checkbox, initially unchecked.
- **Enemy gold-drop chance** — multiplier input, initially `1`, with `×`.

Brief contextual help explains that crits and double damage each still require
a positive native chance and retain their own prerequisites and blockers,
and enemy drops retain the native money store.

Keep partially typed numbers in UI draft state. Commit a complete semantic edit
on blur or Enter, not every keystroke. Invalid drafts need a readable local
error and must not silently become one or clamp to another value. Projection
reads engine defaults; React does not introduce another domain validator.
Unrelated edits must not overwrite a pending numeric draft or its sibling
setting when the complete semantic command is committed.

Primary acceptance: both checkboxes independently and together, enemy gold multiplier
edits, invalid numeric drafts, Undo/Redo, save/reload, export, narrow-layout wrapping, and Fresh File separation.
Use focused projection and UI tests plus one representative history/persistence
workflow, not a duplicate value matrix in every lane. Run affected planner/UI
tests and the applicable contract or product witness.

Intended commit: `feat(planner): edit run modifiers in loadout`.

## Gate C Native adapters and delivery closure

Start each adapter with a source-backed probe of the native function and actual
argument order. These probes are an explicit verification lane when game
scripts are available; they are not automatic CI drift detection. The ordinary
Lua suite must retain representative contract witnesses without copying the
native algorithm into test helpers.

1. **Crit and double damage:** scope native `Damage` to player outgoing damage. Verify the
   `CalculateCritChance` / final player-bonus / `RandomChance` sequence before
   using it to identify the one crit roll. Never identify a roll merely because
   its numeric chance matches another roll. Prove original RNG consumption,
   final zero/positive chance handling, native blockers, separate double damage,
   nesting, and error cleanup. Identify the separate double-damage roll from
   the verified sequence, with its final `ddChance * luckMultiplier` argument;
   never identify either roll by numeric equality. Prove both options off,
   each enabled independently, and both enabled, including equal roll chances,
   zero/positive final chances, `BlockDoubleDamage`, combined native multipliers,
   Ares active-effect eligibility, and zero versus positive missing-health
   contribution. Preserve one original RNG call per native roll and leave
   non-player damage and other RNG contacts unchanged.
2. **Enemy gold:** establish the native death-drop contact and hostile-enemy
   classification, capturing any required allegiance facts before native `Kill`
   clears effects and resets allegiance. Supply a chance-only copy to `CheckMoneyDrop`. Prove reaction
   and breakable exclusion, zero/no chance, `BlockMoney`, exhausted store,
   native parcel amounts and last-parcel overshoot, and unchanged declarations.

Compose the adapters through the existing runtime composition root. Prove
activation before eligible first-room damage and death-drop contacts,
transparent Hub/side-room returns, continuation beyond the configured prefix, mismatch/fault passivity,
death/Crossroads reset, new-run reset, and Postboss re-admission. Do not make
modifier lifetime depend on a current customized encounter or room owner.

Completed adapter slices may be committed separately, with focused tests, under
this gate. Stabilize the implementation before independent review; remediate
bounded findings rather than adding unrelated work. Expected deletions are
temporary probes/scaffolding that no longer answer a question and any replaced
experimental adapter path. There is no existing production modifier path to
retain alongside the delivered implementation.

Run `npm run test:game-module` during adapter development. At closure, run one
complete `npm run check` after review fixes are stable; it includes `npm run test`. Do not
duplicate the full gate at each sub-slice.

Intended commits: focused `feat(game-module): ...` adapter commits, followed by
`docs: close optional run modifiers delivery`.

## Live acceptance and documentation retirement

In-game acceptance must check native defaults first, then each enabled option:

- Crit: no crit source versus a positive contextual source, plus a native
  non-crittable attack and ordinary double-damage behavior.
- Double damage: no source versus an eligible Ares source, active-effect and
  missing-health prerequisites, a native blocking effect, and independent versus
  combined crit/double-damage settings.
- Enemy gold: visibly faster drops without additional store replenishment;
  exhausted encounters and unrelated urn/reaction gold remain native.
- Lifetime: a short configured prefix followed by native rooms, mismatch or
  fault, death/new run, and supported fresh-process Postboss admission.

At implementation closure, integrate accepted source facts into one focused
durable audit under `docs/audits/loadout-and-progression/`. Update the authored
model, editor, and integration authorities only for the new supported contract,
especially the modifier-only prefix-completion exception. Do not scatter
per-hook implementation narratives across unrelated audits.

Move genuinely pending live checks to a focused checklist under `docs/testing/`
and its index, with setup and expected observations only. Then delete this plan;
do not retain it as an in-game tracker or link it from the root README. Record
automated closure results in the closure commit, not in durable design prose.
