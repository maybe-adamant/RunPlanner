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
the final value through the native `StackNum` input, then verifies the acquired
trait's level after selection.

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
selected trait is verified at its own terminal, while room-exit conformance
verifies the aggregate retained charge state. If an incorrect spend makes a
later native rarification unavailable, either that offer's selected result or
the final ledger fails its existing checkpoint.

## Selection and terminal proof

`HandleUpgradeChoiceSelection` is the native authority for all of the
following:

- replacing the old slotted trait;
- constructing and adding the selected trait;
- applying ordinary acquisition effects;
- recording Vow of Denial bans and choice history;
- destroying the reward object;
- closing the screen; and
- unlocking exits when appropriate.

The executor observes the selected button but calls the native function first.
After the exact selected-row callback returns, the acquisition completes from
that bounded structural terminal. It does not reconstruct the Hero's trait
inventory, rarity, levels, or replacement state as a second semantic proof.

This proof settles only the primary acquisition. `AddTraitData` launches a
trait's `AcquireFunctionName` on a thread, so the outer return does not prove a
consequential selected-trait effect has finished.

### Native eligibility mismatch

The selected identity remains the exact authored identity. If the native offer
contact rejects it, the adapter reports a mismatch and does not complete the
transaction. It does not substitute another provider member or infer the
source predicate. Native input and the base callback remain operational after
planner enforcement is disabled.

### Whole-offer Fallback Gold

When no native rows exist, the game inserts the hidden `FallbackGold` trait.
Selecting it calls native `AddTraitToHero`, whose acquisition function emits
optional currency. The planner models neither the gold amount nor a generated
pickup obligation.

`fallbackGold` therefore uses the same screen carrier but a distinct terminal:
the native selection/history has completed and the hidden trait has been
added. Its optional currency effect is native pass-through. It is not proven
by the ordinary visible-trait rarity/level checks and does not become a direct
consumable carrier.

## Bounded alternative paths

| Path                                                                | Disposition                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `UseLoot` rejects before pickup                                     | No acquisition begins. Native behavior continues.                                                                                  |
| Screen opens and authored selection occurs                          | Complete after native post-state proof.                                                                                            |
| Wrong option is selected                                            | Let native selection finish, record player divergence, and stop steering.                                                          |
| Bound screen is rerolled                                            | Let native reroll finish and do not reinstall the initial authored offer; final trait and room-exit state determine conformity.    |
| Calling Card or provider rarification                               | Let native behavior run without observing individual button presses; verify selected trait and aggregate charge state.             |
| Concave Stone recursively invokes selection with `DoubleBoonChance` | Preserve the primary handle; the nested residual is not a second primary terminal and remains deferred to its consequence contact. |
| Selection callback is observed again after completion               | Treat it as incidental native activity; never reuse the completed owner.                                                           |

The reroll disposition is deliberate. The planner does not model reroll
resources. Reapplying the initial authored rows would conceal the native reroll
and create a second offer-initialization path. A reroll that nevertheless ends
with the same selected trait and retained state is execution-equivalent; a
different result fails the ordinary terminal or room-exit conformance.

## Execution disposition

The current broad executor hook does not satisfy this contract. It starts at
`UseLoot`, carries one mutable pending trait, stores a handle on the native loot
table, reconstructs rows by matching generated identities, applies the offer
more than once, lacks the base-rarity fact, and can confuse Concave Stone's
recursive selection with the primary terminal.

The existing occurrence-local Timeline product is sufficient. The ordinary
adapter needs no global action cursor and no producer inference:

- ordinary room rewards and purchases may bind the exact returned loot during
  native materialization;
- an unbound generated or transformed loot claims one compatible ready normal
  acquisition only after native pickup acceptance;
- screen callbacks recover their transaction through that bound loot;
- owner completion remains shared across those handles.

The planner/execution product must add only the missing base-rarity fact. The
existing effective rarity, effective level, selected-trait terminal, and
room-exit keepsake conformance carry every other result. No rarification-action
wire shape or other planner semantic addition is justified by this audit.
