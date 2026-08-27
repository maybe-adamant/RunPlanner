# Runtime Offer Fallback Audit

## Purpose

This is the durable source-and-disposition authority for offer results whose
live eligibility can differ from the deterministic state authored and
simulated by the Run Planner. It records:

- why Death Defiance-adjacent and graph-local Task Force offer requirements are
  runtime facts rather than useful authored inputs;
- the one phase-local exception owned by Gorgon Amulet;
- the declaration-owned trait and item fallback mappings; and
- the boundary between deterministic Planner intent and safe game-module
  execution.

This document does not prescribe a schema number, command name, React control,
module boundary, delivery gate, or migration sequence. Those belong to the
active implementation plan. The fallback mappings and semantic invariants here
remain authoritative after that temporary plan is removed.

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
runtime-fallback disposition.

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
still enforce the necessary prefix from canonical reward history: a concrete
Spell Drop must have settled. Selecting Task Force expresses the deeper
node-acquisition intent. Persisting another boolean adds no useful intent.

The Planner therefore authors and simulates the preferred result without a
general Death Defiance condition or an authored Olympian-node acquisition
fact. Task Force alone retains the settled-Spell-Drop prefix because that fact
is already modeled in reward history. Aspect of Selene's starting Sky Fall does
not satisfy it before the Aspect's first concrete Spell Drop. The catalog
retains each real source requirement as evidence and as runtime eligibility
information. A declared fallback absorbs a failed live predicate at the
execution boundary.

## Gorgon Amulet is the phase-local exception

Gorgon Amulet's missing-Last-Stand predicate decides whether Athena appears at
a particular encounter phase and whether the pending keepsake use advances.
When the predicate is false, no Athena interaction occurs and the use can reach
a later eligible phase. That is lifecycle timing, not merely offer
eligibility.

The exact Gorgon phase therefore retains one narrowly scoped authored trigger
fact. It must not be reused as a general trait-offer, Shop, NPC, or route-level
Death Defiance flag. If Athena appears, her resulting trait choice uses the
ordinary fallback policy below rather than persisting a second copy of the
phase predicate.

## Planner fallback contract

The fallback contract has three layers:

1. A declaration records the small ordered fallback domain appropriate to its
   source.
2. The Planner already knows the complete authored offer and simulated history,
   so plan materialization resolves one exact fallback for the selected result.
3. The game module tries the preferred result and, only when it is not currently
   available to offer, tries that one exported fallback.

The game module does not own a fallback search, reproduce a provider pool, or
interpret why an edge exists. It applies the same operation to every supported
result:

```text
try preferred X
  -> if X is unavailable, try exported fallback Y
```

Each acquisition performs at most one fallback step. A fallback identity may
itself declare a fallback for a separate later acquisition, but execution does
not recursively walk a graph for the current acquisition. If both the preferred
and exported fallback are unavailable because the live run escaped the
supported envelope, the module must not force an illegal result; it reports the
failed execution contact.

The actual granted identity should remain observable to the game-module audit,
but it does not rewrite the authored project or retrospectively re-simulate the
route.

## Trait fallback declarations

A trait offer can contain three visible traits. Each volatile preferred trait
therefore declares three ordered, distinct, requirement-free alternatives from
the same giver. During plan materialization, the other two authored screen
members and any trait unavailable in the simulated history are removed. The
first remaining declaration member becomes the one fallback exported in the
Planner JSON.

For a direct result such as Jeweled Pom, there are no companion screen members
to remove, but the same Hades declaration and one-result JSON contract apply.
The selected trait, its other two screen members, and its fallback never become
additional authoring controls.

The durable mappings are:

| Preferred trait                                     | Ordered declaration fallbacks                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `NarcissusH` — Life Savings                         | `NarcissusB`, `NarcissusC`, `NarcissusD`                                        |
| `EchoDeathDefianceRefill` — Survive Survive Survive | `DiminishingDodgeBoon`, `DiminishingHealthAndManaBoon`, `EchoDoubleLevelBoon`   |
| `DeathDefianceRetaliateCurse` — Malice in Kind      | `HealingOnDeathCurse`, `MoneyOnDeathCurse`, `ManaOverTimeCurse`                 |
| `DeathDefianceRefillBoon` — Renewed Faith           | `InvulnerabilityDashBoon`, `RetaliateInvulnerabilityBoon`, `FocusLastStandBoon` |
| `OlympianSpellCountBoon` — Task Force               | `InvulnerabilityDashBoon`, `RetaliateInvulnerabilityBoon`, `FocusLastStandBoon` |
| `HadesDeathDefianceDamageBoon` — Last Gasp          | `HadesLifestealBoon`, `HadesPreDamageBoon`, `HadesChronosDebuffBoon`            |

The alternatives deliberately skip requirement-bearing neighbors such as
Narcissus Verdure Sampler and Hades Howling Soul. Echo uses the same
three-choice trait rule as Narcissus, Medea, Athena, and Hades; it does not own
a special fallback mechanism. A condition-bearing trait selected through a
nested or direct source still uses its own giver's declaration.

Task Force deliberately reuses Renewed Faith's three requirement-free Athena
alternatives. Its real prerequisite remains source evidence, but the Planner
does not infer an equipped Olympian talent from a generated Hex layout or from
aggregate invested points. It does require one concrete Spell Drop to have
settled. Aspect of Selene's starting Sky Fall alone is therefore insufficient;
the Aspect's later Spell Drop satisfies the prefix. The authored Task Force
selection expresses the remaining node-level intent; the one exported
fallback protects execution when the hidden graph path has not actually
acquired its required Olympian node.

Jeweled Pom illustrates the intended simulation boundary. If its authored
result is Last Gasp, simulation records Last Gasp as acquired, so a later Hades
menu cannot offer Last Gasp. If Last Gasp is unavailable in the live run, the
Pom action grants its exported Hades fallback instead. The later plan is not
rebuilt around that runtime contingency.

## Item fallback declarations

Item fallbacks belong to an item's membership in an exact source pool, not to
the global reward identity. `LastStandDrop` appears in World Shop, Shrine, and
Nemesis pools with different legal peers. `LastStandShopItem` appears in the
Well healing group and the narrower Twist nested pool. A single global fallback
would invent cross-pool outcomes.

One-choice item results need one fallback. Armor is preferred over healing, and
armor falls back to Max Health when that identity belongs to the same physical
pool. I/Q World Shop and Shrine Max Health entries occupy another slot group,
so they are not legal same-position fallbacks.

The durable pool-local edges are:

| Exact offer pool                     | General fallback edges                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| I/Q World Shop Survival, first half  | `LastStandDrop -> ArmorBoost`; `ArmorBoost -> RoomRewardHealDrop`                   |
| I/Q World Shop Survival, second half | `LastStandDrop -> ArmorBigBoost`; `ArmorBigBoost -> HealBigDrop`                    |
| Shrine of Hermes first group         | `LastStandDrop -> ArmorBoost`; `ArmorBoost -> ArmorBigBoost`                        |
| Well healing group                   | `LastStandShopItem -> ArmorBoostStore`; `ArmorBoostStore -> EmptyMaxHealthShopItem` |
| Well Twist nested pool               | `LastStandShopItem -> EmptyMaxHealthShopItem`                                       |
| Nemesis ordinary free-item pool      | `LastStandDrop -> ArmorBoost`; `ArmorBoost -> EmptyMaxHealthDrop`                   |

The second edge in a Travel Deal-capable pool protects a specific legal
sequence without encoding that sequence in production policy. For example, an
authored Last Stand purchase may have Armor as its Travel Deal refill. If the
live Last Stand predicate fails, the purchase produces Armor; Armor is then
unavailable as the refill because Travel Deal does not regenerate the purchased
identity, so that separate refill acquisition uses Armor's declared fallback.
Both actions still execute the same one-step generic rule.

Nemesis has no Travel Deal interaction, but its Armor-to-Max-Health edge keeps
the free-item result safe if Armor itself is unavailable. Twist has no Armor
member, so its Last Stand result falls directly to the Max Health member of its
nested pool.

## Determinism and scope

This policy deliberately does not reproduce the game's weighted replacement
selection. The authored result is the intended deterministic lane; the ordered
fallback is a deterministic safety result. Probability is irrelevant.

The policy also does not add:

- a Death Defiance count, capacity ledger, health model, or damage model;
- authored runtime-condition checkboxes outside Gorgon's encounter phase;
- fallback selection controls in the editor;
- a global fallback item independent of its source pool;
- recursive fallback traversal;
- price, affordability, or weighted-choice simulation; or
- a second planner inside the game module.

The stable outcome is that volatile live eligibility no longer shapes authored
state. Catalog declarations own the bounded contingency domain, Planner JSON
exports one resolved alternative, and the game module performs one safe,
generic availability substitution.
