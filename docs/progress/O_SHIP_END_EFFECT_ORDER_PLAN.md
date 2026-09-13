# O ship reward and end-effect ordering

Status: locked after bounded independent review; implementation not started.

Planner base: `60e5b720`. Executor base: `1d2ed13`.

## Objective

Make O ship combat simulate the native order: combat ends, required rewards
and interactions settle, automatic end effects apply, then the next phase or
room cleanup begins. Show Steady Growth and Embryo last inside the phase's
**End Encounter** section, not under the next phase or Cleanup.

## Evidence and current discrepancy

Native sources live in the local `1GameData/Scripts` checkout:

- `EncounterSets.lua`: `EncounterEventsShipsCombat`,
  `EncounterEventsIcarusShipsCombat`, and `EncounterEventsHeraclesCombatO`
  finish with reward spawning followed by `WaitForNextEncounterReady`.
- `RoomLogic.lua:WaitForNextEncounterReady` waits for required objects and
  UpgradeChoice/Dialog/Spell/Talent screens to clear.
- `RoomLogic.lua:StartEncounter` runs these events before marking completion
  and calling `EndEncounterEffects`.
- `RoomLogic.lua:EndEncounterEffects` calls `CheckChamberTraits` when allowed
  by the encounter and room declarations.
- `TraitLogic.lua:CheckChamberTraits` applies Steady Growth during its trait
  loop and Embryo transformation afterward. Their presentation is separate
  from the actual mutation.

Ordinary combat does not include this explicit post-reward wait. Opening
rewards and chosen Trial boons already have intentional precombat acquisition.
Do not generalize this correction to all rewards or all O rooms.

Current engine contacts:

- `simulation/lifecycle/execute.ts:recordEncounterCompletion` appends
  `encounterEndEffectsApplied` immediately after completion.
- `encounterSequenceOperationHandler` applies those effects before calling
  `afterEncounterPhase`, which settles the ship wheel reward.
- `simulation/room-actions/timeline.ts:appendAutomaticTimelineEffects`
  inserts automatic rows immediately after the End Encounter boundary.
- `simulation/rewards/biome/lifecycle-transitions/encounter-end-effects.ts`
  owns the existing expiry, automatic-result and maturation transitions.

This incorrectly lets the reward observe the refreshed Embryo and prevents
Steady Growth from targeting a boon acquired from that phase's wheel.

## Contract and ownership

1. For reward-bearing ShipCombat phases, retain a visible combat-end boundary
   and a required-acquisition interval before emitting end effects. Drain the
   existing required phase participants, including Icarus where applicable;
   do not hardcode a single wheel command as the entire interval.
2. Emit the existing end-effects event once after that interval. Preserve its
   existing consumer order and declaration guards. Do not create a second
   clock, duplicate effect pass, or Steady Growth/Embryo-only timing exception.
3. Keep `encounterCompleted` at physical combat completion, where it makes
   reward/interactions available. Defer only `encounterEndEffectsApplied`.
   This retains the planner's existing completion abstraction rather than
   moving counters merely to imitate a native field assignment.
4. The next wheel's generation, phase preparation and room cleanup observe
   post-effect state. The just-collected reward observes pre-effect state.
5. End-effect-created pickups become available only after that checkpoint.
   Keep their existing optional/required participation and authoring rules;
   they cannot become prerequisites for the checkpoint that creates them.
6. The engine owns event order, exact candidate context and timeline placement.
   React renders that product; it does not reorder effects independently.
   Keep the visible `encounterEnd` boundary before the post-combat interval.
   Place automatic rows after that phase's required pre-effect actions, before
   the next-phase/Cleanup boundary and any pickups created by those effects.
7. The compiler copies the corrected engine product. Keep current execution
   windows if they remain sufficient. Native executor callbacks already run
   at the later checkpoint; do not move effects into new hooks or add timing
   mismatch checks. Verify that its phase windows remain usable before the
   native end-effects callback.

No authored schema or wire-shape change is expected. Changed calculated
outcomes may expose legitimate findings in existing saves; preserve authorship
and repair controls rather than silently retargeting traits. If implementation
requires a schema change, pause and amend this contract first.

## Delivery

### A — Correct the lifecycle and its consumers

Implement one coherent engine slice through lifecycle execution, reward
settlement, exact automatic candidate contexts and engine-owned timeline
assembly. Use the existing ShipCombat profile/phase information, not room-name
lists or a new scheduler. Adjust application adapters only if the engine's
supported product requires it. Remove superseded early-emission/placement
paths in the same slice.

Primary verification belongs in `packages/planner-engine/test/simulation/`
alongside lifecycle and automatic-effect tests. Cover:

- A wheel-acquired ordinary boon is available as the same phase's Steady
  Growth target; the upgrade takes effect after acquisition.
- The wheel offer uses the pre-refresh Embryo state; the next phase observes
  its replacement. Use an actual modeled blessing with a relevant effect.
- Intermediate and final combat phases put automatic rows last within End
  Encounter, before next-phase/cleanup boundaries.
- Standard, Icarus and Heracles ship sequences retain their required actions;
  skipped/noncombat phases retain their declaration-owned advancement rules.
- Other room profiles preserve their existing reward/end-effect order.

Reuse `test/execution-plan/support/scheduled-lifecycle-fixture.ts` for a
representative real authored workflow: acquire the source, mature it in O,
resolve its target, edit the wheel reward upstream, repair and republish.
Check that incomplete automatic choices do not lock the earlier required
pickups or hide their controls. Do not duplicate the full clock-policy matrix.

### B — Independent review and closure

Review lifecycle ordering, repairability and executor contact compatibility
as one product. Use the repository's focused executor/reviewer routine with
packets pointing to the files above; reuse the executor for remediation.

Inspect the compiled representative plan and exercise existing Lua phase
contacts if any execution assumptions changed. Regenerate only semantically
affected fixtures through their builders; retain serialization and mirror
changed executor copies byte-for-byte. No protocol bump for changed values
within an unchanged contract.

After focused tests and review stabilize, run one full planner repository gate
(`npm run check`, which includes `npm run test`). Run the Lua lane only where executor or
mirrored products are affected. Live verification remains a separate test:
observe a due O ship effect after reward-menu closure and before continuation.
Do not claim that script/harness verification proves that live observation.

Update `docs/design/ROOM_LIFECYCLE_MODEL.md`, `docs/biomes/O_GAME_RULES.md`
and the relevant durable hook-map row to remove the incorrect timing claim.
Delete this plan at closure. Keep the earlier trial-binding fix separate.

## Scope checks

- No global automatic-effect relocation or new generalized scheduling layer.
- No rewrite of effect algorithms, clocks, acquisition settlement or the DAG.
- No new pickup-completion observer or per-action semantic validation.
- No visual-only fix that leaves simulation at the old checkpoint.
- No broad fixture formatting or historical migration work.
