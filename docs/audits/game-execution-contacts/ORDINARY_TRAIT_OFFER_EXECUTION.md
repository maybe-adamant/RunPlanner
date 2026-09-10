# Ordinary trait-offer execution

This audit closes the native execution contact for ordinary Olympian Boons,
Hermes Boons, and Hammers. It distinguishes the planner's validated offer from
the native carrier that displays and acquires it. The executor steers the
smallest randomized result and then lets the game construct, equip, replace,
record, and present the trait normally.

This contract does not make every selected trait effect ordinary. Natural
Selection, Ransoms, All Together, Concave Stone, Sea Star, and other
consequential traits require their own result dispositions after the primary
trait has been acquired.

## Source index

- Olympian, Hermes, and Hammer loot construction:
  `Scripts/RoomLogic.lua:2059-2091`
- Native loot materialization: `Scripts/RoomLogic.lua:2240-2282`
- Offer generation and replacement selection:
  `Scripts/TraitLogic.lua:1760-1994`
- Valid loot interaction and pickup:
  `Scripts/InteractLogic.lua:621-735`
- Offer-screen construction, sorting, and selection:
  `Scripts/UpgradeChoiceLogic.lua:2-210` and
  `Scripts/UpgradeChoiceLogic.lua:280-1069`
- Calling Card action: `Scripts/UpgradeChoiceLogic.lua:1203-1256`
- Native trait equipment: `Scripts/TraitLogic.lua:471-960`
- Loot declarations: `Scripts/LootData.lua:1-230` and
  `Scripts/LootData_Hermes.lua:1-45`
- Planner offer state:
  `packages/planner-engine/src/authored-project/traits.ts`
- Execution transaction:
  `packages/planner-engine/src/execution-plan/model.ts`

## Included carriers

| Family    | Native loot identity | Native classification                                 | Ordinary execution disposition |
| --------- | -------------------- | ----------------------------------------------------- | ------------------------------ |
| Olympians | provider loot name   | `GodLoot = true`                                      | Included.                      |
| Hermes    | `HermesUpgrade`      | `TreatAsGodLootByShops = true`, not ordinary god loot | Included.                      |
| Hammer    | `WeaponUpgrade`      | `GodLoot = false`, `ForceCommon = true`               | Included.                      |

The execution product, rather than the native randomized offer, identifies
which exact trait rows belong to the current transaction. Native loot flags
remain authoritative for game behavior such as menu eligibility and rarity
processing; they are not a second source of planner membership.

Spell, Chaos, Pom, NPC-menu, Mystery Boon box, purchase, and direct-consumable
carriers are outside this contact. A transformed or generated child may reuse
this contact only after it becomes an ordinary Olympian, Hermes, or Hammer
loot carrier and its published normal acquisition is ready.

## Native carrier chain

The ordinary chain is:

```text
GiveLoot / CreateHermesLoot / CreateWeaponLoot
  -> CreateLoot
       -> SetTraitsOnLoot
       -> returned native loot table
  -> UseLoot
       -> HandleLootPickup
            -> OpenUpgradeChoiceMenu
                 -> CreateBoonLootButtons
                      -> CreateUpgradeChoiceButton (once per row)
                 -> HandleScreenInput
                      -> HandleUpgradeChoiceSelection
                           -> AddTraitToHero / RemoveWeaponTrait
```

`CreateLoot` attaches one exact native loot table to the spawned object after
`SetTraitsOnLoot` has populated `UpgradeOptions`. That table and its object
identity are the stable carrier once an owner has been selected. An ordinary
room reward or purchase can bind it during materialization. A natively
generated unbound child instead claims one compatible ready normal acquisition
at accepted pickup. `CreateLoot` alone also serves excluded carrier families
and cannot identify an owner from a loot name.

`UseLoot` is not the action entry. It can reject an interaction because enemies
remain, the price cannot be paid, or another screen is active. Beginning the
transaction there would turn a failed attempt into a started acquisition and
would mix purchase settlement into the ordinary trait adapter.

`HandleLootPickup` is the first contact after a valid interaction has committed
to the loot flow. It synchronously opens the offer menu and does not return
until that menu closes. An already-bound normal acquisition begins there; an
unbound native child may claim one compatible ready normal acquisition there.
Every later callback carries that same bound loot directly or transitively:
`CreateBoonLootButtons` receives `lootData`, a rarification callback receives
`screen.Source`, and selection receives `button.LootData`. A second screen
binding is unnecessary.

## Offer generation versus offer steering

`SetTraitsOnLoot` remains the native generator. It owns priority traits,
eligibility, rarity rolls, replacement rolls, shortage-driven replacement,
and native bookkeeping such as reroll availability. The planner has already
validated and resolved those random results, so the executor replaces only the
resulting randomized membership and values. It must not reproduce any of the
generation policy.

The native `UpgradeOptions` table and row tables remain the input carriers for
button construction. A native roll is not required to have happened to include
the authored identity: the executor may reuse a positional native row or create
the minimal native input row when the generated table is short. It then writes
the exact authored offer fields and clears incompatible stale fields. Requiring
a matching native row would make execution depend on the RNG result that it is
supposed to steer.

The row fields owned by this contact are:

- trait identity;
- base rarity before any explicit Calling Card action;
- the planner's final effective-level input for a fresh level-bearing trait;
- replacement trait identity and old rarity; and
- the exact authored number of rows.

All other processed trait data is reconstructed by
`CreateUpgradeChoiceButton` from the native `TraitData` declaration. Hammer and
other non-level traits must not receive an invented stack value.

### Effective level

Jeweled Pom, Aspect of Persephone, Premium Service, and their eligibility rules
are planner-side sources of one indivisible `effectiveLevel`. The executor does
not identify or recompute those sources. For a fresh eligible row it supplies
the final value through the native `StackNum` input. If the level is part of
modeled durable state, the planner-selected room-exit `traitInventory` fact
checks it later; the acquisition adapter does not read it back.

This deliberately does not mutate Persephone's native provider distribution.
The source combines Persephone's internal stack encoding with
`FatedBoonLevelBonus + 1`, while the planner has already normalized Persephone
and Jeweled Pom into one additive result. Reconstructing that arithmetic in Lua
would duplicate planner policy. A replacement row does not receive this fresh
level input; native replacement logic derives its level from the replaced
trait and replacement bonus, and the executor verifies the resulting level.

### Native order

Before constructing buttons, the game sorts ordinary rows by native slot in
this order: `Melee`, `Secondary`, `Ranged`, `Rush`, `Mana`, then unslotted
traits. The source comment lists a different order, but the implementation is
authoritative.

The planner already presents ordinary slot traits in native order. The
executor therefore installs the authored rows, lets native slot sorting run,
and correlates the authored selected and rejected rows by trait identity after
sorting. It must not assume that authored row index is still the physical
button index. Equal-priority unslotted rows, including Hammers, have no stable
Lua sort order; selection and rejection remain identity-based even when their
physical order is incidental.

## Rejected versus Vow of Denial

The execution offer's `rejected` row represents the active Rejected Chaos
curse (`RestrictBoonChoices`). The game still displays every generated row but
places the excess row in `screen.BlockedIndexes`, making it unselectable. This
applies to ordinary Olympian and Hermes screens. It does not apply to Hammers.

Vow of Denial is different. After the player selects a trait, native
`HandleUpgradeChoiceSelection` adds unpicked traits to
`CurrentRun.BannedTraits` for future offers. The executor publishes the
currently rejected row but must leave this post-selection ban behavior to the
native callback. Calling the visible blocked row a Vow of Denial result is
incorrect.

Because native blocked indices are chosen before the native sort, the executor
must reconcile the blocked identity after sorting and before the first button
is built. The rejected row remains visible, disabled, and ineligible for
Calling Card.

## Rarification state equivalence

Calling Card and provider-keepsake rarification are player actions on an
already generated offer. They are not part of the base rarity roll. A player
may rarify an unselected row, may rarify the same row repeatedly while legal,
and consumes a charge on every successful action.

The executor does not observe or replay individual Rarify button presses. It
installs each row's base authored rarity when the offer is first built, then
lets native `UpgradeMouseOverUpgradeChoice` choose the applicable source,
invoke `TryUpgradeBoon`, consume the charge, and rebuild the row normally.

The authored `rarificationActions` sequence remains planner-side guidance and
the source from which simulation derives the effective offer and retained
keepsake state. It does not enter the execution protocol. Execution needs only
the missing base rarity beside the already-published effective rarity.

Conformance is state-based:

- after selection, the acquired trait must have the published effective
  rarity; and
- at `beforeRoomExit`, the existing `keepsakeEffects` conformance fact verifies
  Calling Card's remaining charges and each provider source's
  `remainingRarificationUses`.

This deliberately treats different clicks on unselected rows as equivalent
when they produce the same acquired trait and final charge ledger. Unselected
row rarity has no later simulated effect. The native `LootChoiceHistory`
records it for save/history purposes, but game source does not consume that
history elsewhere during the run.

Several offers may occur in one room without a per-offer charge cursor. Each
offer installs its exact authored rows, while room-exit conformance remains the
authority for the acquired trait and aggregate retained charge state. If an
incorrect spend makes a later authored surface mechanically impossible, that
later steering contact reports the mismatch and native behavior remains
operational.

## Selection and steering completion

`HandleUpgradeChoiceSelection` is the native authority for all of the
following:

- replacing the old slotted trait;
- constructing and adding the selected trait;
- applying ordinary acquisition effects;
- recording Vow of Denial bans and choice history;
- destroying the reward object;
- closing the screen; and
- unlocking exits when appropriate.

For a plain acquisition, the executor has finished its intervention after the
initial `CreateBoonLootButtons` call returns with the authored rows installed.
It may complete the steering owner there and release local DAG dependents. The
later selected button, trait equipment, inventory, rarity, level, replacement,
and screen closure remain native behavior and are not adapter-local semantic
proof.

An authored selected-trait consequence retains the same owner through its last
executor-owned nested steering contact. `AddTraitData` may launch the trait's
`AcquireFunctionName` on a thread, so All Together, Natural Selection, Bridal
Glow, Concave Stone, or Sea Star completes only after its own published random
input has been supplied. This is still steering completion, not a readback of
the resulting Hero state.

### Mechanical steering mismatch

The planner has already established eligibility. The adapter installs the
published rows without calling `IsTraitEligible` or reconstructing provider
policy. It reports an immediate mismatch only if a claimed native surface
cannot accept that published input or a selected nested effect cannot receive
its required random steering value. It does not substitute another provider
member. Native input and the base callback remain operational after planner
enforcement is disabled.

### Whole-offer Fallback Gold

When no native rows exist, the game inserts the hidden `FallbackGold` trait.
Selecting it calls native `AddTraitToHero`, whose acquisition function emits
optional currency. The planner models neither the gold amount nor a generated
pickup obligation.

`fallbackGold` therefore uses the same screen carrier and completes steering
after its one authored row is installed. Its later selection, history, hidden
trait, and optional currency effect are native pass-through. It is not proven
by ordinary visible-trait rarity/level checks and does not become a direct
consumable carrier.

## Selected-trait consequence inventory

Only three ordinary selected traits carry a volatile outcome that must be
authored before their native acquire function runs. All three use the same
option-owned result on every acquisition path; the executor changes only the
native contact that consumes it.

| Trait             | Authored consequence                                                  | Native steering contact                                                              | Direct offer | Concave Stone residual          | Echo Boon Boon Boon                    |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ | ------------------------------- | -------------------------------------- |
| Bridal Glow       | One equipped trait key                                                | `AddRarityToTraits.ForceUpgrade` inside `HeraSuperchargeBoon`                        | Same result  | Same result on the residual row | Same result on the selected nested row |
| All Together      | One grant or exhausted `null` for each of Earth, Fire, Air, and Water | Four selections made by `GrantBoons`                                                 | Same result  | Same result on the residual row | Same result on the selected nested row |
| Natural Selection | Ordered sequence of one to eight successful core-slot level targets   | Initial `FYShuffle` inside `DistributeLevels`; native mutation remains authoritative | Same result  | Same result on the residual row | Same result on the selected nested row |

The remaining selected-trait dispositions are not missing instances of this
carrier contract. Circe and Icarus already own dedicated option results and
native contacts. Echo Pom owns its dedicated greatest-level target. Produced
pickups become independent acquisitions once native code creates them. Ransom,
Proper Upbringing, keepsake activation, and similar deterministic effects stay
native-authoritative and are checked through later state rather than copied
into another selected-option result.

## Bounded alternative paths

| Path                                                                | Disposition                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UseLoot` rejects before pickup                                     | No acquisition begins. Native behavior continues.                                                                                                                                                                  |
| Initial screen installs the authored rows                           | Complete the plain acquisition's steering owner after native screen construction returns.                                                                                                                          |
| Wrong option is selected                                            | Let native selection finish. The adapter does not compare it; a published named conformance fact may later report the durable difference.                                                                          |
| Bound screen is rerolled                                            | Let native reroll finish and do not reinstall the initial authored offer; room-exit conformance reports a modeled durable divergence when one exists.                                                              |
| Calling Card or provider rarification                               | Let native behavior run without observing individual button presses; room-exit conformance owns the retained charge state.                                                                                         |
| Concave Stone recursively invokes selection with `DoubleBoonChance` | Preserve the primary handle while the focused nested residual contact resolves; the residual row carries its own Bridal Glow, Natural Selection, or All Together consequence and is not a second primary terminal. |
| Selection callback is observed again after completion               | Treat it as incidental native activity; never reuse the completed owner.                                                                                                                                           |

The reroll disposition is deliberate. The planner does not model reroll
resources. Reapplying the initial authored rows would conceal the native reroll
and create a second offer-initialization path. A reroll that changes the
authored result reports a mismatch; the native reroll remains playable.

## Execution disposition

The focused ordinary adapter satisfies this contract. It begins at
`HandleLootPickup`, keeps its state on the bound native loot, installs the
published base rarity once, completes plain steering after the initial screen
is constructed, and retains the outer scope only for a published nested effect
such as Concave Stone.

The occurrence-local Timeline product is sufficient and uses no global action
cursor or producer inference:

- ordinary room rewards and purchases may bind the exact returned loot during
  native materialization;
- an unbound generated or transformed loot claims one compatible ready normal
  acquisition only after native pickup acceptance;
- screen callbacks recover their transaction through that bound loot;
- owner completion remains shared across those handles.

The execution product carries base rarity alongside effective rarity,
effective level, selected nested-effect inputs, and room-exit conformance. No
rarification-action wire shape or other planner semantic addition is justified
by this audit.
