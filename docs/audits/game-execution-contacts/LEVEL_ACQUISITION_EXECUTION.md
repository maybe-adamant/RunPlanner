# Level-acquisition execution

This audit closes the native execution contacts for planner-authored single-
target level outcomes. It distinguishes two native carriers that produce the
same planner result:

- visible Pom of Power menus; and
- direct random-level consumables such as Pom Slices and source-eligible
  Nectar.

Both are acquisitions with one published target and level count. They do not,
however, share an interaction callback or termination sequence. The executor
may share acquisition ownership, target validation, and terminal level proof;
it must retain the native lifecycle of each carrier.

Natural Selection, Steady Growth, and other trait-owned level effects are not
acquisitions merely because they eventually call level-mutation code. Their
own audits remain authoritative for when they occur and what selects their
targets.

## Source index

The game evidence was checked on 2026-09-03 against the installed Hades II
scripts:

- visible Pom declarations: `Scripts/LootData.lua:89-210`;
- loot interaction and committed pickup:
  `Scripts/InteractLogic.lua:621-734`;
- visible target generation, button construction, reroll, and selection:
  `Scripts/UpgradeChoiceLogic.lua:113-376`, `707-717`, and `940-1071`;
- Pom Slice and Nectar declarations:
  `Scripts/ConsumableData.lua:776-797` and `1844-1870`;
- direct level application:
  `Scripts/TraitLogic.lua:2482-2543` and `2616-2627`;
- consumable interaction and effect dispatch:
  `Scripts/InteractLogic.lua:979-1158`;
- planner level-effect declarations:
  `packages/hades2-catalog/src/declarations/rewards/acquisitions.ts` and
  `packages/hades2-catalog/src/declarations/rewards/producer-lifecycles.ts`;
- planner evaluation:
  `packages/planner-engine/src/simulation/trait-level-effects.ts`; and
- execution transaction product:
  `packages/planner-engine/src/execution-plan/model.ts`.

## Planner semantic result

The execution role already publishes the complete level decision:

```text
offeredTargets  visible Pom rows; empty for a direct random result
selectedTarget  exact trait to receive levels, or null only when no target is legal
levelCount      exact number of levels applied by this acquisition
```

The planner evaluates eligibility against the trait state at the acquisition
point. A visible Pom requires the exact native-sized set of distinct eligible
rows, up to three, and a selected row. An ordinary Pom Slice requires one
eligible target. `randomTargetIfAvailable`, currently used by supported Nectar
sources, alone permits `selectedTarget = null`, and only when the pre-effect
state has no eligible target.

No new execution field is required. The role's acquisition owner, materialized
game name, and `levelResolution` distinguish the semantic result without
encoding native callback names in the plan.

## Common acquisition boundary

Visible Poms, Pom Slices, Nectar, and later direct pickups belong to one
planner-oriented acquisition family because they all pass through these
semantic stages:

```text
published producer or concrete acquisition owner
  -> one materialized native object
  -> accepted interaction
  -> bind its existing owner or claim one compatible ready normal action
  -> native effect sequence
  -> stable acquired-state proof
```

That common boundary is owner correlation, not a claim that every native item
uses the same function. A loot object and a consumable object have different
accepted-interaction contacts. Sharing a global pending action or guessing the
next acquisition from authored order would erase the distinction and recreate
the callback-cursor problem the room Timeline was designed to remove.

The exact materialized object remains the correlation carrier after its owner
has been selected. Ordinary room rewards and purchases may bind that owner at
materialization. An unbound native-produced Pom or direct-level item may claim
one compatible ready normal action only after its carrier-specific acceptance
contact. An unrelated call with no compatible ready action runs unchanged.

The level adapter is producer-neutral once that binding or claim exists. Room
rewards and purchases may arrive pre-bound. NPC drops and transformed children
may remain unbound until accepted use. Either way, the object then uses the
same applicable visible or direct level sequence. The level adapter must not
rediscover which producer created it.

## Visible Pom carrier

### Native sequence

`StackUpgrade`, `StackUpgradeBig`, and `StackUpgradeTriple` inherit the normal
loot flow with `StackOnly = true` and native level counts of one, two, and
three:

```text
CreateLoot
  -> UseLoot
       -> HandleLootPickup
            -> OpenUpgradeChoiceMenu
                 -> CreateBoonLootButtons
                      -> CreateUpgradeChoiceButton per target
                 -> HandleUpgradeChoiceSelection
                      -> IncreaseTraitLevel
```

`UseLoot` is not the transaction entry. It can return before pickup when
enemies block interaction, the player cannot pay a purchase cost, or another
screen is active. `HandleLootPickup` is the first contact after those guards;
it synchronously owns the offer menu until selection closes it. A failed
`UseLoot` attempt therefore leaves the acquisition unstarted.

The visible menu cannot be dismissed after exposing its choices. Native code
invalidates the checkpoint, keeps the screen open, and closes it through the
selection callback. A reroll is an intermediate action rather than a terminal.

### Steering disposition

Native `SetTraitsOnLoot` remains free to construct its initial randomized Pom
rows. Before the first non-reroll button build, the executor replaces only the
random result with the published `offeredTargets` and supplies the published
final level count. Native code has an additional `FatedPomLevelBonus` input at
this boundary. The adapter must account for that native adjustment exactly
once so the count used to build the buttons and later mutate the trait equals
the published final count; it must not simply set `StackNum` early and allow
native code to add the bonus again. Native button construction, sorting,
presentation, choice logging, and `IncreaseTraitLevel` remain in control.

The adapter must correlate the selected button by trait identity. Physical
button index is presentation state and can change after native sorting.

A native reroll deliberately abandons the frozen first offer. The executor
does not reinstall the authored rows on a reroll. The final selected-target and
level proof determines whether the resulting state is still equivalent; the
runtime does not introduce a reroll cursor.

### Terminal proof

Immediately before native selection, the adapter records the selected trait's
current level as `StackNum or 1`, matching `IncreaseTraitLevel`'s treatment of
an unset stack. After `HandleUpgradeChoiceSelection` returns, completion
requires:

- the selected trait identity equals `selectedTarget`; and
- its stack number increased by exactly `levelCount`.

The native callback applies the mutation. The executor never calls
`IncreaseTraitLevel` directly.

## Direct random-level carrier

### Included native identities

`StoreRewardRandomStack` is the Pom Slice consumable. Its use function is
`UseStoreRewardRandomStack`, which dispatches `AddStackToTraits` on a thread.

Nectar (`GiftDrop`) uses the same function only when its declaration's
`RunProgress` property change is active. The planner already represents that
source distinction: eligible Room Reward and replay lifecycles publish a
`randomTargetIfAvailable` level resolution, while ordinary Shop Nectar does
not. The executor follows the published role rather than assigning level
behavior from the item name alone.

Other native systems can call `UseStoreRewardRandomStack` without representing
a planner acquisition. A call without an existing binding or compatible ready
normal action is native pass-through.

### Native sequence

```text
CreateConsumableItem
  -> UseConsumableItem
       -> native death, block, cost, requirement, and enemy guards
       -> presentation, removal, recording, and payment
       -> CallFunctionName(UseStoreRewardRandomStack)
            -> thread(AddStackToTraits)
                 -> AddStackToTraits with Thread = true
                      -> thread(AddStackToTraits with Thread = false)
                           -> IncreaseTraitLevel
```

`UseConsumableItem` is not the transaction entry because it can return through
several native guards. The exact consumable may carry its bound handle into a
copied `UseFunctionArgs`, but that transport must not begin the action.
`UseStoreRewardRandomStack` is the first carrier-specific contact reached only
after native acceptance. Once it runs, no later player cancellation exists;
the threaded non-`Thread` invocation of `AddStackToTraits` is the stable
terminal.

This distinction corrects the legacy broad hook, which began direct level
transactions before `UseConsumableItem` had accepted the interaction.

### Steering disposition

For a non-null target, the executor supplies the exact native `TraitName`, one
target, and the published `NumStacks` at `AddStackToTraits`, after
`UseStoreRewardRandomStack` has performed any native count adjustment. It then
lets `AddStackToTraits` perform the mutation and presentation. If the target is
absent or no longer upgradeable, the planner state and native state disagree.
The adapter reports the mismatch and allows the unmodified native call to
continue under the global stop-enforcement policy.

For a legal null target, the adapter first confirms that native state also has
no upgradeable target. It then supplies zero targets so the native effect is a
no-op. If native state has an eligible target, null is not treated as a license
to suppress that mutation; it is a mismatch, and native behavior continues.

The terminal proof uses the non-threaded `AddStackToTraits` return and the same
`StackNum or 1` normalization as native `IncreaseTraitLevel`:

- a non-null target must have gained exactly `levelCount`; or
- a legal null outcome must retain the no-eligible-target state without a
  level mutation.

The asynchronous presentation is not part of the proof. No executor-side
trait mutation is needed.

## Ownership disposition

The two carriers justify an acquisition-oriented executor boundary now that
ordinary traits and level outcomes are both concrete consumers. Ordinary
Olympian/Hermes/Hammer acquisition remains the trait specialization of that
family; visible and direct level effects are level specializations.
Bound-or-ready acquisition correlation is shared, while each specialization
owns its accepted entry, callback sequence, and terminal proof.

This boundary does not create generic future directories or a registry of
game callbacks. Dispatch remains explicit over the closed implemented
acquisition families.

Direct level realization belongs with level outcomes, not with a later generic
consumable pass. Source-eligible room-reward Nectar is the immediate concrete
consumer. A pre-bound purchase or an unbound native-produced Pom Slice uses the
same contact once its normal action is ready; the producer or purchase slice
owns creation and participation, not another random-level adapter.
