# Chaos trait-offer execution

## Status and scope

This audit fixes the Plan Executor boundary for a directly collected
`TrialUpgrade`. The planner already owns the complete consequential result:
three ordered visible curses, each curse's requirement, the selected option,
and the selected curse/blessing pair's exact processed values. No planner wire
or authored-project change is required.

The focused Chaos acquisition adapter owns this path beside the ordinary trait
adapter. It binds the exact object after native pickup acceptance, scopes its
state to that object, and prepares the selected blessing only after native row
sorting. No broad Timeline path participates.

This audit does not cover Chaos-gate topology, Transcendent Embryo, curse-clock
advancement, or the gameplay effects of a matured blessing. Those already have
separate room-feature, automatic-outcome, conformance, and simulation owners.

## Authorities

- `Scripts/LootData_Chaos.lua`: `TrialUpgrade`, its transforming pools, and
  inherited loot behavior.
- `Scripts/TraitLogic.lua`: `SetTraitsOnLoot`,
  `SetTransformingTraitsOnLoot`, and processed trait construction.
- `Scripts/InteractLogic.lua`: `UseLoot` and the accepted
  `HandleLootPickup` contact.
- `Scripts/UpgradeChoiceLogic.lua`: screen construction, row sorting,
  `CreateUpgradeChoiceButton`, selection, reroll, and Vow of Denial bans.
- [Chaos trait game data](../traits/CHAOS_TRAIT_GAME_DATA_AUDIT.md): the
  complete curse/blessing identity, operand, clock, and Denial authority.
- `packages/planner-engine/src/execution-plan/model.ts`: the closed
  `ExecutionTraitOffer` Chaos payload.

## The published product is already sufficient

The selected acquisition role carries `gameName: "TrialUpgrade"` and a Chaos
trait offer with this complete execution input:

| Published fact               | Native use                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Three ordered `curseOptions` | The three displayed curse identities after native row sorting                           |
| Each `requirementCount`      | The processed curse's `RemainingUses` for every displayed option                        |
| `selected`                   | The physical option whose blessing, rarity, and exact values are fixed                  |
| `selectedCurseValues`        | The selected curse's independently rolled gameplay operands                             |
| `blessingKey` and `rarity`   | The pending blessing nested under the selected curse                                    |
| `blessingValues`             | The selected blessing's independently rolled operands, including both Revelation values |

The two unselected blessing identities, rarities, and values are intentionally
absent. Native generation owns them because they have no planner-visible
consequence. The executor must preserve those generated peers rather than
inventing a second offer model.

## Native lifecycle and accepted entry

The native chain is:

```text
CreateLoot
  -> SetTraitsOnLoot
       -> SetTransformingTraitsOnLoot
            -> three generated blessing/curse rows

UseLoot
  -> HandleLootPickup                 accepted interaction
       -> OpenUpgradeChoiceMenu
            -> CreateBoonLootButtons
                 -> sort rows
                 -> CreateUpgradeChoiceButton × visible row
                      -> GetProcessedTraitData(blessing)
                      -> GetProcessedTraitData(curse)
                      -> curse.OnExpire.TraitData = blessing
            -> HandleUpgradeChoiceSelection
                 -> AddTraitToHero(processed curse)
```

`UseLoot` is not an accepted action. It can return without opening a screen
because enemies block interaction, the price cannot be paid, or another screen
is active. Execution therefore begins only at `HandleLootPickup`, matching the
ordinary trait acquisition contract.

The shared acquisition materialization hook must recognize an exact bound
`TrialUpgrade` loot table. Every later Chaos contact recovers the same opaque
transaction handle from that native table. The adapter must not select a
transaction from the next authored action, the loot name alone, or a mutable
screen-global pending value.

## Initial offer preparation happens after native sorting

`SetTransformingTraitsOnLoot` is native generation, not an execution contact
that the adapter needs to intercept. It runs before the accepted pickup and
also runs again during a reroll. Hooking it makes admission ambiguous and
reserves the selected blessing before `CreateBoonLootButtons` sorts the
generated rows.

Instead, the initial `CreateBoonLootButtons` call opens one bounded synchronous
scope for its exact screen and bound loot. On the first
`CreateUpgradeChoiceButton` call, native sorting is already complete. The
adapter then prepares all three physical rows atomically:

1. Require exactly three native transforming rows. If native runtime state
   cannot supply the three-row carrier the planner validated, report the
   mismatch and leave native behavior intact; do not fabricate unmodeled peer
   blessings.
2. If the authored selected blessing already occupies a different native row,
   swap it into the selected physical row and move the selected row's original
   blessing and rarity to the peer row. This preserves native blessing
   distinctness.
3. Otherwise replace only the selected row's blessing with the authored
   blessing.
4. Set the selected row's exact authored rarity.
5. Set every physical row's ordered authored curse identity and requirement.
   Preserve each unselected row's native blessing, rarity, and independently
   processed values.

This preparation is positional by the final displayed order. It must not rely
on Lua sort stability for unslotted Chaos blessings.

## Processed values are a bounded nested contact

For each `CreateUpgradeChoiceButton`, the adapter scopes only that row's Chaos
processing context around the native call. Its `GetProcessedTraitData` contact
then applies:

- `RemainingUses` to every authored curse;
- the selected curse operands only when processing the selected curse; and
- the selected blessing rarity and operands only when processing the selected
  blessing.

All declaration structure remains native. The executor changes the processed
leaf fields already enumerated by the existing closed Chaos value mapper; it
does not reconstruct trait declarations, tooltip data, clocks, or blessing
effects. The exhaustive operand-field matrix remains owned by the existing
`chaos.lua` tests and is not copied into the lifecycle suite.

The bounded processing scope must be restored on native errors and must not
affect Transcendent Embryo or an unrelated `GetProcessedTraitData` call.

## Selection, Denial, and native ownership

For transforming rows, native `CreateUpgradeChoiceButton` stores the processed
curse in `button.Data` and nests the processed blessing at
`button.Data.OnExpire.TraitData`. Native `HandleUpgradeChoiceSelection` then
equips that curse.

Vow of Denial remains fully native-authoritative. `TrialUpgrade` inherits
`BanUnpickedBoonsEligible = true`; after selection, native code records the
other buttons' `button.Data.Name` values. Because execution installs all three
curse identities before button construction, those names are the
planner-authored unselected curses. Blessings are never Denial bans. Repeated
curse identities retain native name-equality behavior and the planner already
derives the same distinct ban set.

Rejected does not block a Chaos option. `TrialUpgrade` is not `GodLoot` and is
not `TreatAsGodLootByShops`, so the active Rejected curse does not reduce or
block its own Chaos screen. Rejected continues to affect later qualifying
Olympian and Hermes screens through their ordinary acquisition adapter.

The executor does not implement Denial, curse activation, use consumption,
maturation, element grants, rarity effects, or any combat/stat effect. It only
steers the random offer result that the planner authored.

## Reroll and alternative paths

The planner does not model boon rerolls. Chaos permits the native reroll
button, whose `RerollBoonLoot` calls `SetTraitsOnLoot` before rebuilding the
screen with `reroll = true`.

The adapter applies the authored offer only to the initial screen. A reroll
remains native and is not silently replaced with the original three rows. If
the player then selects a different pair, the exact terminal proof records the
divergence. A reroll that happens to produce and select the same exact pair may
still satisfy the terminal, matching the ordinary offer policy.

Other bounded paths are:

| Path                                                      | Disposition                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `UseLoot` is rejected before `HandleLootPickup`           | No transaction begins; native behavior continues.                                                |
| The bound role was omitted because Time Piece consumed it | No Chaos acquisition is enforced; retained Time Piece conformance owns the intended destruction. |
| The native screen has fewer than three transforming rows  | Record mismatch and stop steering; do not invent peer blessings.                                 |
| The player selects the wrong curse position               | Let native selection finish, fail the exact pair proof, and stop steering.                       |
| A later processed-trait call occurs outside the row scope | Native pass-through.                                                                             |

## Terminal proof and later conformance

After native `HandleUpgradeChoiceSelection` returns, the exact selected-row
callback completes the acquisition. The executor does not reconstruct the
equipped curse/blessing as a second terminal proof. The room-exit `chaos`
conformance fact owns active versus matured state and the remaining clock.
Diagnostic Run State retains the native banned-trait set for investigation
without turning Denial into a second blocking action.

## Execution disposition

Direct Chaos acquisition is one focused adapter contract. It binds the exact
`TrialUpgrade` object at materialization, admits the transaction at
`HandleLootPickup`, scopes initial post-sort row preparation and processed-value
overrides to that object, and completes at the exact selected-row callback.

Native code remains authoritative for transforming-row generation, rerolls,
Denial, trait equipment, curse clocks, and blessing maturation. The closed
Chaos value mapping remains shared because direct offers, loadout Embryo,
encounter-driven Embryo replacement, and conformance all consume the same game
fields. Broad mutable pending-screen state is not an acceptable parallel path.

No protocol bump, compatibility decoder, new transaction kind, or planner
change is justified.

Closure evidence requires:

1. exact `TrialUpgrade` materialization and accepted-pickup admission;
2. failed `UseLoot` does not begin a transaction;
3. three displayed curse positions, including a repeated curse identity;
4. the selected blessing in each of the three positions, including a peer-row
   swap that preserves blessing distinctness;
5. requirements on all rows and representative selected curse/blessing
   operands, including Revelation's two blessing values;
6. native Denial sees authored curse names while blessings remain nested;
7. reroll leaves the regenerated offer native;
8. exact selected-row terminal and wrong-selection divergence; and
9. no Chaos acquisition state or transforming-generation hook remains in the
   broad legacy Timeline module.
