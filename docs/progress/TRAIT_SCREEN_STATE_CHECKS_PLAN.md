# Trait Screen State Checks Plan

Status: locked. Base commit: `8c719c9b1`.

## Objective

Taking trait screens from different givers in another order no longer desyncs a
run by itself. A misorder fails only when it actually changes a screen, and it
fails at that screen.

The planner stops publishing order between screens from different givers. Each
published trait screen instead carries the order-sensitive state the planner
expected when it opened. The module compares that state with native when the
screen opens, and checks row legality with native helpers. Nothing is
recomputed in the module, and no planner rule is duplicated there.

## Current state

- Every trait screen depends on the most recent earlier trait mutation in its
  room, whatever its source. This is `priorTraitMutations` in
  `trait-settlement/coordinator.ts` (~1094-1110), published through
  `recordTimelineDependency` (`chronology-accumulator.ts` ~515-523). A misorder
  is a `transaction-prerequisite` mismatch, raised at pickup.
- Planned rows are forced over the native offer
  (`traits/ordinary.lua:157-188`) with no legality check on god, Hermes,
  Hammer, Spell or Echo last-run rows.
- `8c719c9b1` already makes the module raise mismatches for these cases:
  - NPC requirement failures;
  - unheld Pom targets;
  - fewer-choices curse disagreement;
  - unplanned Concave Stone procs.

  It also steers the NPC `PassRarityCheck`.

- The plan already publishes expected state snapshots at `roomEntered` and
  `beforeRoomExit` (`execution-plan/model.ts` ~991-994).
- An alternative that computed relaxed order in the engine by room-local
  commutation is parked on the local branch `trait-order-b`.

## Principle

A misorder can only change state that an earlier screen in the same room
changes. Base rarity tables, keepsake bonuses and aspect distributions are
identical in every order, so they are never checked. The planner already holds
the order-sensitive state at each screen (the offer's generation state). It
publishes that state, and the module checks native agrees.

## Design

- **Published per screen** (ordinary loot, Pom, Chaos, NPC and Gorgon offers,
  Echo last-run), an expectation block of remaining uses or live state when the
  screen opens:
  - Sacrificial Hymn uses (`ForceSwaps`);
  - Yarn uses (`RarityBonus`) and whether this loot is rarity-boosted;
  - whether the Ordinary curse forces Common;
  - the fewer-choices curse (already carried by `rejected`);
  - Concave Stone uses, and whether this giver can proc;
  - rarify charges.

  Each field is present only where the screen can read it. The exact native
  field for each is pinned during implementation.

- **Module comparisons at screen open**, after the native roll and before rows
  are forced:
  - each published field against the native value: loot flags (`UseSwapTrait`,
    `ForceCommon`, `ForceCommonWithoutCurse`, `RarityBoosted`) and trait uses;
  - an exchange row's planned `effectiveLevel` against native `newNum`;
  - a Pom's `levelCount` against the held level plus the loot `StackNum`.
- **Row legality, through native helpers:**
  - `IsTraitEligible`, `HasTraitRequirements`, `HeroHasTrait` and
    `HeroSlotFilled`;
  - an exchange target held, with `GetUpgradedRarity`;
  - Spell and Echo last-run rows through their native eligibility filters.
- **Order kept on the wire:**
  - structural roster edges;
  - producer and source edges;
  - same-giver chains;
  - Travel Deal refill;
  - Well purchase;
  - Keepsake Rack and Fountain;
  - Figurine after Judgment.

  Every other link between trait screens is dropped.

- **Planner model errors** that are not order-sensitive, such as a wrong base
  rarity table, stay outside these checks, as they are today.

## Gates

The direction is judged on merit in live play; if it fails, it is cheap to
remove. There is no shadow phase and no debug tooling.

1. **Implementation.**
   - Planner:
     - publish the expectation block, with spend facts from the coordinator's
       own consumption rules and uses as of when the screen opens;
     - a trait screen chains only to earlier mutations from the same giver;
     - the Fountain and Rack fences and the explicit classification stay.
   - Module: the comparisons and legality checks raise mismatches. A native
     call error is a `native-api` fault.
   - Fixtures and the equivalence baseline are regenerated, under
     `schemaRevision` 1.
2. **Closure.**
   - Docs are promoted (`GAME_INTEGRATION_BOUNDARY.md`,
     `SIMULATION_AND_VALIDATION.md`).
   - A live checklist is added, and this plan is retired.
   - `trait-order-b` is deleted.

## Tests

- **Engine:** an expectation-block matrix per effect at the assembly owner,
  covering present, absent and spent; codec round-trips.
- **Module:** each comparison's agreeing and disagreeing cases, legality per
  helper.
- **Fixtures:** the new shapes decode in Lua.

## Residual exposure

- Order effects that change only the end state, not any screen (for example
  acquisition triggers that read held traits), are caught at room-exit
  conformance, not at the pickup.
- Echo's last reward read by a later room is caught at that room or at room
  exit.
- Pool sales, Eris and Shrine purchases have no transaction, as today.

## Non-goals

- Recomputing native rarity or level in the module.
- Relaxing same-giver or native window order.
- Modelling Echo's last reward as a published fact.
