# Execution mismatch policy

## Purpose

This document defines when the Plan Executor may stop realizing an admitted
plan. It applies to the fixed Underworld and Surface executor boundary. It does
not add planner eligibility rules, compare complete Run State, or require the
native game to reproduce an exact callback trace.

## Core invariant

The executor reports a gameplay mismatch only when a standard checkpoint, or
the consumption of an exact action before its published prerequisites, proves
that the remaining simulated prefix is no longer trustworthy.

Between checkpoints, adapters are actuators. They bind an exact published
transaction, steer the native result, and report when the native action reaches
its declared terminal. They do not independently decide whether the resulting
run state is semantically correct.

```text
exact native contact
  -> bind published owner
  -> begin only when published prerequisites are complete
  -> steer the randomized surface
  -> call native behavior
  -> complete at the declared terminal
  -> verify planner-visible state at the owning checkpoint
```

This separates three facts that must not be conflated:

- transaction completion means the native action reached its terminal;
- diagnostic evidence says whether steering worked as expected; and
- conformance says whether the resulting planner-visible state is truthful.

## Runtime outcomes

| Outcome             | Meaning                                                                                             | Runtime disposition                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Admission rejection | The selected slot is absent, malformed, incompatible, or not a complete execution plan.             | Do not create a synchronized session; report the admission error.                                            |
| Executor fault      | A required host function is missing or throws, or an internal decoded-plan/session invariant fails. | Restore temporary forcing scope, report or propagate the fault, and do not describe it as player divergence. |
| Incidental contact  | Native code reaches a supported hook but no compatible published owner claims it.                   | Pass through unchanged without completing a transaction or desynchronizing.                                  |
| Diagnostic          | A bounded actuator could not install or apply its intended steering.                                | Record bounded evidence and continue native behavior without changing synchronization.                       |
| Execution mismatch  | A closed checkpoint proves the remaining simulated prefix is unsafe.                                | Preserve the first mismatch, stop later planner realization, and let the native game continue.               |

The first mismatch is immutable. Later hooks become passive and may not replace
its cause. Desynchronization must never block input, suppress a native action,
prevent room creation, or prevent traversal.

## Closed mismatch surface

Only the following boundaries may create the first gameplay mismatch:

| Boundary            | Compared fact                                                                                                     | Example                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Start of run        | The aggregate post-`StartNewRun` loadout projection.                                                              | Weapon, aspect, Arcana, Fear, or starting keepsake state differs after native initialization finishes.        |
| Postboss admission  | The expected Postboss occurrence and its published recovery state.                                                | A loaded run is at the wrong Postboss or does not match the state required for recovery.                      |
| Room entered        | Current room identity and declaration-owned structural content.                                                   | The wrong room was entered, or a required room feature could not be realized.                                 |
| Doors ready         | Complete normal/additional exit structure and reward identities.                                                  | A door has the wrong target room or reward.                                                                   |
| Exact prerequisite  | One exact irreversible native action is consumed before its published DAG prerequisites complete.                 | The player buys the boosted copy of a same-god boon before the transaction that makes that exact offer ready. |
| Obligation deadline | A published required non-acquisition transaction did not reach its terminal by its declared lifecycle checkpoint. | An authored encounter interaction or transformation never completes before room close.                        |
| Room exit           | Only the sparse named conformance facts published for that occurrence.                                            | `traitInventory`, Arcana, keepsake effects, Path of Stars, or another named retained effect differs.          |

Adding another mismatch boundary requires source evidence and a concrete case
that cannot be contained by exact binding, DAG readiness, an obligation, or an
existing named conformance fact.

## Actuator policy between checkpoints

When steering cannot be applied, the default behavior is:

1. record one bounded diagnostic at the narrow actuator boundary;
2. invoke native behavior exactly once;
3. complete the transaction if its declared native terminal is reached; and
4. let the next owning checkpoint decide whether the resulting state remains
   truthful.

A diagnostic does not itself unlock a dependency. A transaction completion at
the native terminal does. If the terminal is never reached, the transaction
remains incomplete and a published obligation may fail at its deadline.

Acquisition transactions are not generic room-close obligations. Their handles
still express local DAG readiness, while durable results are proved by named
room-exit conformance. Simulation-neutral acquisitions intentionally have no
blocking result proof.

Native clocks and deterministic side effects remain native. The executor
steers only planner-authored randomized outcomes; it does not implement another
copy of game logic.

## Exact owner correlation

Similarity is never ownership. A god, reward kind, item name, or authored order
cannot substitute for the exact published transaction owner.

World Shop offers preserve their transaction owner through materialization and
onto the native object. This is required when normal and boosted offers share a
provider. Either legal purchase order may occur, but each native object can
claim only its own transaction. An exact object consumed too early produces the
generic prerequisite mismatch and still invokes the native purchase.

Mystery Boons, ordinary pickups, shop purchases, and generated objects use the
same producer-independent acquisition semantics after an exact owner is bound.
The executor does not infer purchase legality, prices, affordability, or shop
order.

## Concrete examples

### Trait and level screens

The adapter installs the authored rows and completes the acquisition at its
native screen terminal. A missing candidate or failed installation is a
diagnostic, not an immediate mismatch. If the player selects or receives the
wrong durable result, `traitInventory` or another named room-exit fact detects
it before the next occurrence relies on that state.

This applies to ordinary offers, Chaos, NPC offers, Spell/Hex screens, level
effects, Sea Star, All Together, Natural Selection, and targeted acquisition
effects.

### Travel Deal

Travel Deal is the only dynamic inventory refill. The planner publishes its DAG
dependency and exact carrier, generation, and slot. An unrelated restock is an
incidental contact. A restock at the wrong published slot is diagnosed but does
not claim or complete the refill. The exact refill terminal completes the
transaction; otherwise its obligation fails at the normal deadline.

### Artificer

Artificer has a narrower two-part terminal than a simple callback: the expected
concrete replacement must be observed and the source must be destroyed. A wrong
or missing replacement is diagnostic evidence, but the source transaction
remains incomplete because its declared terminal was not reached. The separately
acquired replacement remains producer-independent.

### Keepsakes and automatic outcomes

Starting Hex and keepsake-result callbacks diagnose local steering failures;
the aggregate post-start loadout check owns start conformance. Mid-run Aromatic
Phial, Concave Stone, Transcendent Embryo, Steady Growth, and boss Arcana actions
complete at their declared native terminal. Their durable effect is verified by
the published room-exit facts or required obligation.

### Encounters and transformations

Nemesis outcomes, O wheels, Anvil, and Well Twist use exact transaction binding
and native terminal completion. Their callback-local result comparisons are
diagnostic. An unowned encounter or transformation contact passes through. A
required authored action that never reaches its terminal remains incomplete and
fails only at its published lifecycle deadline.

## Fault boundary

The following are executor faults, not mismatches or diagnostics:

- an unknown or foreign Timeline handle;
- conflicting or duplicate native bindings;
- a missing decoded transaction owner or Timeline-index capability;
- an unsupported lifecycle checkpoint;
- use of a closed room session;
- malformed decoded payload structure after strict admission; and
- a missing or throwing required native host function.

Protected native calls exist only to restore temporary forcing scope before
rethrowing. They are not fallback behavior.

## Ownership and implementation contacts

| Owner                                  | Responsibility                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Planner engine                         | Legality, simulation, exact owners, DAG dependencies, obligations, named conformance, and execution-plan assembly. |
| Route, room, and Timeline coordinators | Admission, exact binding, readiness, lifecycle deadlines, structural checkpoints, and the first mismatch.          |
| Peripheral adapters                    | Native contact binding, narrow steering, terminal completion, and bounded diagnostics.                             |
| Native game                            | Clocks, deterministic side effects, payment, mutation, presentation, and continued play after desynchronization.   |

Primary executor contacts are `src/mods/runtime/session.lua`,
`src/mods/route/session.lua`, `src/mods/room/coordinator.lua`,
`src/mods/room/session.lua`, `src/mods/room/timeline/session.lua`,
`src/mods/navigation/`, `src/mods/room/features/`,
`src/mods/room/timeline/`, `src/mods/keepsakes/`, and
`src/mods/spells/`.

Related stable authorities are
[`GAME_INTEGRATION_BOUNDARY.md`](../../design/GAME_INTEGRATION_BOUNDARY.md),
[`GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md`](../rooms-and-routes/GAME_EXECUTION_TIMELINE_RECONCILIATION_AUDIT.md),
and [`NATIVE_CONFORMANCE_CONTACTS.md`](NATIVE_CONFORMANCE_CONTACTS.md).
