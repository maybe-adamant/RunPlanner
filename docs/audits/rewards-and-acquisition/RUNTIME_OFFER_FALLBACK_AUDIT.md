# Runtime Offer Eligibility Audit

## Purpose

This is the durable source-and-disposition authority for authored offer results
whose live eligibility can differ from the deterministic state simulated by the
Run Planner. It records:

- the volatile native predicates that the Planner deliberately does not model;
- the one phase-local exception owned by Gorgon Amulet;
- why runtime fallback substitution was rejected; and
- the boundary between exact Planner intent and safe game-module execution.

This document does not prescribe a schema number, command name, React control,
module boundary, delivery gate, or migration sequence. Those belong to the
active implementation plan.

## Source basis

The relevant installed game-data contacts are:

- `NPCData.lua:4366-4376` — Narcissus Life Savings requires
  `MissingLastStand`;
- `NPCData.lua:4442-4449` — Echo Survive Survive Survive requires
  `MissingLastStand`;
- `NPCData.lua:5072-5084` — Medea Malice in Kind instead requires at least one
  entry in `CurrentRun.Hero.LastStands`;
- `TraitData_Athena.lua:282-314` — Renewed Faith requires
  `MissingLastStand` and the pre-first-meeting state;
- `TraitData_Athena.lua:480-524` — Task Force requires at least one of the nine
  Olympian Hex talents to be currently equipped;
- `TraitData_Hades.lua:468-478`, `CombatLogic.lua:2204-2213`, and
  `PowersLogic.lua:4895-4907` — Last Gasp uses the separate
  `CurrentRun.DeathDefianceDamageBoonEligible` state, which is set by acquiring
  a Last Stand or by Jeweled Pom's preselection bridge when the Last Stand
  Arcana is equipped;
- `ConsumableData.lua:822-872` — `LastStandDrop` requires
  `MissingLastStand` at generation and purchase;
- `ConsumableData.lua:1235-1278` — the Well's `LastStandShopItem` uses the same
  named requirement at generation and purchase;
- `NPCData.lua:5466-5482` — Nemesis's ordinary free-item pool contains
  `EmptyMaxHealthDrop`, `HealDrop`, conditional `LastStandDrop`, and
  `ArmorBoost`;
- `StoreData.lua:14-88` — the Well healing group and remaining Well inventory;
- `StoreData.lua:120-184` — the Shrine of Hermes first and second groups;
- `StoreData.lua:291-390` and the corresponding Q profile — the phase-specific
  I/Q World Shop groups;
- `ConsumableData.lua:1490-1529` — the Twist nested Well pool;
- `StoreLogic.lua:179-250` — Shop option requirements are filtered before
  weighted selection;
- `StoreLogic.lua:412-428` — a World Shop Travel Deal refill excludes the
  purchased identity before regenerating that physical position;
- `StoreLogic.lua:1165-1201` — a Well Travel Deal refill excludes the current
  inventory names before regenerating its physical position; and
- `SurfaceShopLogic.lua:351-425` — Shrine purchase/rush eligibility and the
  first-purchase Travel Deal refill boundary.

The focused trait, keepsake, Nemesis, World Shop, Well, and Shrine audits retain
the complete surrounding source facts. This audit owns only their shared
runtime-eligibility disposition.

## Volatile predicates are not authored inputs

The source predicates include combat state and graph-local acquisition state
that the Planner deliberately does not simulate:

| Result                                                  | Live source predicate                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Narcissus Life Savings                                  | a Last Stand is missing                                                    |
| Echo Survive Survive Survive                            | a Last Stand is missing                                                    |
| Athena Renewed Faith                                    | a Last Stand is missing and Athena's first-meeting state permits the trait |
| Medea Malice in Kind                                    | at least one Last Stand is held                                            |
| Hades Last Gasp                                         | `DeathDefianceDamageBoonEligible` is true                                  |
| Athena Task Force                                       | one of nine Olympian Hex talents is equipped                               |
| Shop, Shrine, Well, Twist, and Nemesis Last Stand items | a Last Stand is missing at the applicable generation or purchase frontier  |

A shared Death Defiance boolean collapses opposite and unrelated combat
predicates. A separate Task Force boolean would ask the author to reproduce the
unmodeled Path of Stars graph and exact node-investment order. The Planner can
still enforce Task Force's necessary modeled prefix: a concrete Spell Drop
must have settled. Selecting Task Force expresses the deeper node-acquisition
intent. Aspect of Selene's starting Sky Fall does not satisfy that prefix
before the Aspect's first concrete Spell Drop.

These predicates remain source evidence only. They are not normalized catalog
capabilities, authored controls, simulator inputs, execution-plan availability
contacts, or game-module substitution instructions.

## Gorgon Amulet is the phase-local exception

Gorgon Amulet's missing-Last-Stand predicate decides whether Athena appears at
a particular encounter phase and whether the pending keepsake use advances.
When the predicate is false, no Athena interaction occurs and the use can reach
a later eligible phase. That is lifecycle timing, not merely offer
eligibility.

The exact Gorgon phase therefore retains one narrowly scoped authored trigger
fact. It must not be reused as a general trait-offer, Shop, NPC, or route-level
Death Defiance flag. If Athena appears, her resulting trait choice follows the
same exact-authored-result policy as every other trait choice.

## Exact-authored-result contract

The authored trait or item identity is the only result simulated and exported.
The Planner does not declare an alternative, resolve a pool-local replacement,
or model multiple downstream futures for an unobserved runtime predicate.

At execution:

1. the adapter reaches the exact native carrier for the authored result;
2. if native code accepts that identity, the ordinary native callback chain
   realizes it and completes the transaction;
3. if the identity is unavailable, the adapter reports the first mismatch;
4. no substitute is selected and the intended transaction remains incomplete;
   and
5. the native base function and player input remain operational after planner
   enforcement is disabled.

The game module must not search another provider member, walk a fallback graph,
infer why native eligibility failed, rewrite the authored route, or reconstruct
the simulator's later state. A native-unavailable result is a divergence from
the authored plan, not a conforming alternate outcome.

This contract applies uniformly to ordinary and NPC trait offers, direct
keepsake results such as Jeweled Pom, Task Force, Hades Last Gasp, Nemesis
items, World Shops, Shrines, Wells, Twist results, and Travel Deal refills.

## Why runtime fallback substitution is retired

The former policy exported a preferred identity plus one declaration-owned
alternative. That looked bounded at the acquisition contact but was not a
bounded execution contingency. The alternative can differ from the simulated
identity, then acquire levels, change rarity, enable or disable later offers,
participate in removal effects, or otherwise change chronology. Treating both
states as valid would require either:

- multiple simulated futures throughout the remaining route;
- executor-side semantic state repair; or
- a false claim that the fallback and authored result are equivalent.

All three conflict with the Planner's single validated chronology and the thin
compiler/executor boundary. The fallback declarations, availability contacts,
resolved fallback products, wire payloads, Lua substitution helpers, and
realized-alias verification are therefore retired together. The source
predicates above remain documented because they explain the possible live
mismatch.

## Scope

This disposition does not add:

- a Death Defiance count, capacity ledger, health model, or damage model;
- authored runtime-condition checkboxes outside Gorgon's encounter phase;
- alternate-result controls in the editor;
- recursive or one-step fallback traversal;
- price, affordability, or weighted-choice simulation;
- full Hero trait or Arcana equality checks; or
- a second planner inside the game module.

The stable outcome is one authored result, one execution result, and one honest
mismatch if the unmodeled native predicate prevents that result.
