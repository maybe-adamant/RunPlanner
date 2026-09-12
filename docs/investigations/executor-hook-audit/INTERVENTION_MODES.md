# Intervention classification

Each of the 168 expanded hook rows in [World](WORLD.md),
[Acquisitions](ACQUISITIONS.md), and [Effects](EFFECTS.md) now has a Mode column.
The classification describes what the current wrapper does, not what its
function name suggests or whether its implementation is correct. Consult the
row's payload/native trace and [thread disposition](THREAD_LIFETIMES.md)
together. A multi-role hook is not automatically bad decomposition.

## Categories

| Mode                           | Meaning                                                                                                                                                                   | What earns its place                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B — Scope/binding              | Identifies the native action, provider, phase, or exact planner owner and makes its payload available to the relevant contact.                                            | Needed correlation, with bounded lifetime; does not create gameplay conditions.                                                                                               |
| S — RNG steering               | Selects the authored result at a native random decision: yes/no, candidate selection, or shuffle order.                                                                   | Exact decision identity; native eligibility, clock, mutation, and consumption remain native. A broad “next RNG call” interception is still classified S but may be incorrect. |
| D — Direct outcome insertion   | Supplies a published answer or native forcing operand: offered rows, inventory, room declaration, target, magnitude, or final level count.                                | Native application remains native. Inserting a complete trait offer is not the same as implementing acquisition or rarity mechanics again.                                    |
| R — Native behavior recreation | Implements native rules or mechanics again: deriving eligibility, advancing clocks, reproducing consumption, or applying an effect in place of its native implementation. | Requires a concrete reason the native path cannot be retained. Mere planner modeling does not justify it.                                                                     |
| C — Coordination/checkpoint    | Opens/closes a lifecycle boundary, begins/completes a DAG owner, or reads/compares a completed checkpoint.                                                                | Runtime coordination rather than a second simulation. Callback diagnostics and local completion must not be mistaken for checkpoint proof of acquired state.                  |

**R?** flags a specific condition/policy intervention for adjudication. It is
not a confirmed implementation of an entire native algorithm. This matters
because replacing an eligibility result, repeating an eligibility check, and
reimplementing the eligibility calculation are three different things. The
matrix does not conceal them under S, but neither does it call all three
wholesale recreation.

The source review has not established a replacement native clock/payment/effect
engine in these wrappers. Its strongest concerns are narrower: manufacturing
a gate, repeating policy checks, and selecting the wrong native random call.
This is not an assertion that every helper transitively called by a wrapper
has been proven free of duplicated logic.

## Condition and policy interventions to discuss

| Exact matrix contact                                                                                    | What current code does                                                                                                                           | Classification / proposed disposition for discussion                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisitions: Sea Star `GetTotalHeroTraitValue`                                                         | Returns 1 for `DoubleRewardChance` whenever a published result is active; separately arms `RandomChance`. It does not preserve the native value. | **B + R?**, distinct from the following **S** roll. It can make a native chance path reachable rather than merely choose its outcome. No necessity has been established for overriding the gate instead of observing its actual read. Review against the user's “do not create the condition” rule. Native duplication itself remains native.                       |
| Effects: Hex `IsGameStateEligible`                                                                      | Returns false for the exact ServeDuo requirements when the published tree has no God Sent pair.                                                  | **R?**, not RNG steering: it suppresses eligibility to produce an authored absence. Decide whether this is an accepted complete-tree insertion technique or an unwanted condition override; it does not recalculate those requirements.                                                                                                                             |
| World: `IsSecretDoorEligible`, `IsSellTraitShopEligible`, `IsWellShopEligible`, `IsSurfaceShopEligible` | Substitutes published feature presence for native eligibility results.                                                                           | **D + R?**. These realize an already-validated room's explicit contents and retain native creation/consumption, rather than implementing spawn legality. Still, they bypass the gate, so the structural-realization exception must be explicit rather than described as a chance-only intervention. Do not remove them merely because their names contain Eligible. |
| World: `SpawnZagContract`                                                                               | Sets `ZagreusContractSuccess` from published additional-exit presence before native spawn.                                                       | **B + D + R?**: a native condition field is being used as the realization input. Establish that the field is limited to the intended spawn behavior before approving it as structural insertion. It is not itself a random draw.                                                                                                                                    |
| World: navigation and Fields `IsRoomRewardEligible`                                                     | Restricts the native result to the published reward type while allowing native reward construction.                                              | **D + R?**: exact reward-answer insertion through a filtering contact, not reimplementation of reward bags. Validate its scope and retained native side effects. Fields remains nonfunctional behind H01 until its context shape is corrected.                                                                                                                      |
| Acquisitions: six named NPC choice wrappers                                                             | Besides binding and supplying rows, calls `nativeRowsAvailable` / `IsGameStateEligible` before the shared menu later reapplies the rows.         | **B + D + R?**: redundant policy preflight candidate H08, not invented eligibility arithmetic. Explain why this extra check is needed when the planner supplied the offer and native code owns its normal preparation; otherwise remove in a later focused fix.                                                                                                     |
| Acquisitions: levels `GetTotalHeroTraitValue`                                                           | Masks `FatedPomLevelBonus` because the inserted level count is already the final planner count.                                                  | **D + R?**: prevents double application under the existing final-count contract. Not equivalent to Sea Star creating eligibility. Keep explicit until choosing whether the adapter should insert a base provider value instead; that choice is outside this audit.                                                                                                  |

## Representative distinctions across the rest of the matrix

| Pattern                                                                                                             | Classification and boundary                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trait/Chaos/NPC offer rows and shop/pool inventory                                                                  | **D**: copy the planner's complete answer at construction. Native screen, purchase, selection, and effect application remain native. The presence of a candidate guard does not turn this into an RNG hook.          |
| `ForceUpgrade`, direct level target/count, Embryo processed magnitudes                                              | **D**: provide target/operands to native application. Do not call this recreation merely because no random helper is intercepted.                                                                                    |
| Experimental Hammer, Jeweled Pom, All Together, Natural Selection, Anvil, Twist, Circe/Icarus/Echo target selectors | **S**, with **B** at the named caller: steer the exact candidate/ordering and retain native additions/removals/level application. Missing or overbroad scope is a correctness issue within that classification.      |
| Fig Leaf `RandomChance`                                                                                             | **S**, but H03 identifies wrong-roll interception. It is not evidence that skipping encounters must be recreated; the action/roll binding needs scrutiny.                                                            |
| Resource node disposition versus element success                                                                    | Node setup is **D**, object/harvest correlation is **B**, final element chance is **S**. Native gathering and counters remain native; the departed resource's disposition is not an executor-owned collection clock. |
| Automatic Embryo, Steady Growth, Judgment, Figurine                                                                 | Due callback/phase is **B/C**; target is **S** or **D** depending on the native seam. No executor countdown is implied.                                                                                              |
| Boss/Circe low-priority arcana `RandomChance`                                                                       | **S**: select the published result of the native admission roll. Unlike Sea Star's trait-value substitution, this contact is the roll itself; exact scope still matters.                                             |
| Artificer replacement observation and `Destroy`; Nemesis `RemoveTrait`                                              | **B/C**, not native mutation: these wrappers observe/coordinate and still invoke native behavior. Whether that observation is necessary is a separate audit question, not solved by labeling it recreation.          |
| Unused level `UseLoot` marker                                                                                       | **B (unused)**: no discovered consumer. A scope classification does not justify retaining an unnecessary hook.                                                                                                       |

## How this changes the audit discussion

Use the [integration invariant](../../design/GAME_INTEGRATION_BOUNDARY.md)
and [per-outcome recommendations](OUTCOME_INTERVENTIONS.md) for implementation
direction. This legend describes current behavior; it does not rank hooks by
name or establish another policy.

Classifications are descriptive, not a second verdict column: an S hook can
steer the wrong roll; a D hook can use the wrong native field; a B hook can leak
across threads; a C hook can verify too early. The existing findings remain
applicable. R/R? contacts need the duplicated or bypassed behavior named and a
reason it cannot remain native before acceptance.

This pass changes documentation only. It does not settle the flagged policy
exceptions, remove hooks, change forcing behavior, or claim live-game proof.
