# Volatile Offer Eligibility Game-Data Audit

## Purpose

This audit records authored offer results whose live eligibility depends on
combat or graph-local state that the Run Planner deliberately does not model.
It owns the source predicates, the Gorgon Amulet exception, and the decision to
publish one exact result without a runtime substitute.

## Source basis

- `NPCData.lua:4366-4376` — Narcissus Life Savings requires
  `MissingLastStand`.
- `NPCData.lua:4442-4449` — Echo Survive Survive Survive requires
  `MissingLastStand`.
- `NPCData.lua:5072-5084` — Medea Malice in Kind instead requires at least one
  entry in `CurrentRun.Hero.LastStands`.
- `TraitData_Athena.lua:282-314` — Renewed Faith requires
  `MissingLastStand` and the pre-first-meeting state.
- `TraitData_Athena.lua:480-524` — Task Force requires at least one of the nine
  Olympian Hex talents to be equipped.
- `TraitData_Hades.lua:468-478`, `CombatLogic.lua:2204-2213`, and
  `PowersLogic.lua:4895-4907` — Last Gasp uses
  `CurrentRun.DeathDefianceDamageBoonEligible`, which a Last Stand or Jeweled
  Pom's preselection bridge may establish.
- `ConsumableData.lua:822-872` and `1235-1278` — the direct and Well Last Stand
  items require `MissingLastStand` at their applicable frontier.
- `NPCData.lua:5466-5482` — Nemesis's free-item pool includes a conditional
  `LastStandDrop`.
- `StoreLogic.lua:179-250` — Shop option requirements are filtered before
  weighted selection.
- `StoreLogic.lua:412-428`, `1165-1201`, and
  `SurfaceShopLogic.lua:351-425` — World Shop, Well, and Shrine refill contacts
  apply carrier-specific exclusions and purchase requirements.

The focused trait, keepsake, Nemesis, World Shop, Well, and Shrine audits own
the surrounding behavior. This audit owns only the shared volatile-eligibility
disposition.

## Volatile predicates are not authored inputs

| Result                                                  | Live source predicate                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Narcissus Life Savings                                  | a Last Stand is missing                                                    |
| Echo Survive Survive Survive                            | a Last Stand is missing                                                    |
| Athena Renewed Faith                                    | a Last Stand is missing and Athena's first-meeting state permits the trait |
| Medea Malice in Kind                                    | at least one Last Stand is held                                            |
| Hades Last Gasp                                         | `DeathDefianceDamageBoonEligible` is true                                  |
| Athena Task Force                                       | one of nine Olympian Hex talents is equipped                               |
| Shop, Shrine, Well, Twist, and Nemesis Last Stand items | a Last Stand is missing at the applicable generation or purchase frontier  |

A shared Death Defiance flag would collapse opposite and unrelated
predicates. A Task Force flag would ask the author to reproduce the unmodeled
Path of Stars graph and exact node-investment order. The planner instead
enforces only Task Force's necessary modeled prefix: a concrete Spell Drop must
have settled. Aspect of Selene's starting Sky Fall does not satisfy that prefix
before the Aspect's first concrete Spell Drop.

These predicates remain source evidence. They are not normalized catalog
capabilities, authored controls, simulator inputs, or executor-side eligibility
rules.

## Gorgon Amulet exception

Gorgon Amulet's missing-Last-Stand predicate decides whether Athena appears at
a particular encounter phase and whether the pending keepsake use advances.
When the predicate is false, no Athena interaction occurs and the use can reach
a later phase. That is modeled lifecycle timing rather than an offer-only
availability detail.

The exact Gorgon phase therefore retains one narrowly scoped authored trigger
fact. It must not become a general trait-offer, Shop, NPC, or route-level Death
Defiance input. If Athena appears, her offer follows the ordinary exact-result
contract.

## Exact-result disposition

The authored trait or item is the only result simulated and published. The
planner does not declare an alternative, resolve a pool-local replacement, or
model several later futures for an unobserved predicate. The executor attempts
to steer that exact carrier and never searches for a substitute or reconstructs
planner eligibility.

A local inability to install the intended steering is diagnostic. A standard
checkpoint or required obligation determines whether the resulting run can
remain synchronized, as defined by
[Game Integration Boundary](../../design/GAME_INTEGRATION_BOUNDARY.md).

Runtime fallback substitution is rejected because an alternative trait or
item may later gain levels, change rarity, enable offers, participate in
removal, or otherwise change chronology. Treating both states as conforming
would require multiple simulated futures, semantic repair in the executor, or
a false equivalence claim.

The resulting boundary is one authored result and no executor-selected
alternative. The planner does not add a Death Defiance capacity model,
alternate-result controls, recursive fallback traversal, affordability model,
or full Hero-state comparison to account for these volatile predicates.
