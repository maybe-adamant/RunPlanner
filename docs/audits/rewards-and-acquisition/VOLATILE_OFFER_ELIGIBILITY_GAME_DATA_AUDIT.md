# Volatile Offer Eligibility Game-Data Audit

## Purpose

This audit records authored offer results whose live eligibility depends on
Death Defiance or other combat state that the Run Planner deliberately does not
model.
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
| Shop, Shrine, Well, Twist, and Nemesis Last Stand items | a Last Stand is missing at the applicable generation or purchase frontier  |

A shared Death Defiance input would collapse opposite and unrelated
predicates. These predicates remain source evidence. They are not authored
controls, simulator inputs, or executor-side eligibility rules.

The five trait results above (Life Savings, Survive Survive Survive, Renewed
Faith, Malice in Kind, and Last Gasp) declare
`offerDependsOnDeathDefiance` in the catalog. That flag states only that the
native offer predicate reads Death Defiance state; it does not encode the
predicate. While any of them is listed on an offer screen, selected or not, the
trait offer editor shows a display-only note in its feedback area. The note is
not a finding: it does not affect validity, publishing, finding order, or
repair marks. The Shop, Shrine, Well, Twist, and Nemesis items carry no such
note.

## Gorgon Amulet exception

Gorgon Amulet's predicate, `TraitData_Keepsake.lua:2212-2221`, requires that no
Last Stand is held (`#LastStands <= 0`). It decides whether Athena appears at
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
