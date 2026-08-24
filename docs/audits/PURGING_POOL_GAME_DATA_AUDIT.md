# Purging Pool Game-Data Audit

## Status and scope

This is an implementation-free source audit for the Pool of Purging, called
the Sell Trait Shop by the game scripts. It records physical realization,
post-encounter availability, offer generation, sales, and the resulting
trait-removal fact. It does not define planner schema, commands, simulation
APIs, UI, delivery gates, or an implementation sequence.

The evidence was checked on 2026-08-24 against the installed Hades II scripts.
Primary sources are:

- `RoomDataF.lua:2561-2640`, `RoomDataG.lua:1053-1123`, and
  `RoomDataH.lua:1852-2012`;
- `RoomLogic.lua:4064-4069, 4891-4918` and `ObstacleData.lua:3312-3365`; and
- `SellTraitLogic.lua:1-53, 71-92, 327-386` and
  `TraitLogic.lua:1202-1210, 1547-1559`.

## Realized host scope

The supported physical Pool hosts are only `F_PostBoss01`, `G_PostBoss01`, and
`H_PostBoss01`. F and G declare `SellShopSpawnChance = 1.0`, require
`WorldUpgradePostBossSellTraitShops`, and expose their own physical
`ChallengeSwitchBase` slot; H declares chance `1.0` with no local requirement
and exposes its Postboss physical slot. `HandleSecretSpawns` creates the
Sell-Trait obstacle only if there is a remaining physical challenge-switch ID
and `IsSellTraitShopEligible` succeeds (`RoomLogic.lua:4891-4918`).

The surface marker `SellTraitShrineUpgrade = true` appears on the same
Postboss room declarations, but is not the realization rule: it neither
creates the object nor bypasses physical-slot and eligibility checks. In
particular, a textual marker in a declaration is not evidence of a Pool host
outside those three physically realized Postboss rooms.

The Pool remains locked during an encounter. At the room exit-unlock boundary,
after outgoing exits are generated, `DoUnlockRoomExits` makes the realized
object usable (`RoomLogic.lua:4064-4069`). Its interaction therefore belongs to
the room's post-encounter cleanup interval, before entry to the selected next
room; it cannot alter the already-generated exits.

## Offer and sale facts

`GenerateSellTraitValues` walks the hero's current traits and retains an entry
only when `IsGodTrait(name, { ForShop = true })` and `trait.Rarity` both hold.
It keys this source map by trait name, so repeated stacks of one name produce
one candidate identity. `GenerateSellTraitShop` then removes random candidates
without replacement until it has three entries or exhausts candidates
(`SellTraitLogic.lua:14-53`). Consequently the displayed result is up to three
random, distinct, currently eligible God-trait names.

Here “God trait” means the source's shop-aware predicate, not only an equipped
core-slot Olympian boon. `ForShop = true` also admits Hermes and eligible
field-loot sources marked `TreatAsGodLootByShops`; unslotted and Duo traits can
therefore be candidates when their source membership and rarity satisfy the
same predicate.

The player may sell any displayed entry or none. A sale removes that displayed
entry from the current Pool, records the sale counters, and grants its
calculated gold value (`SellTraitLogic.lua:327-339`). The gold amount depends
on rarity and stack count, but gold is sim-neutral for this scope.

The removal calls `RemoveWeaponTrait(name)`, which loops until the hero has no
remaining instance of that name (`TraitLogic.lua:1202-1210`). Selling a stacked
trait therefore removes all stacks of the selected name, rather than merely
one displayed level.

The Pool participates in the game's shared Store reroll system. On a reroll,
one randomly selected previous option is excluded from the regenerated list
while other previous options may reappear (`SellTraitLogic.lua:379-387`). That
exclusion behavior is not a Pool-owned rule. The planner does not currently
simulate Store rerolls, their currency, or their chronology; an authored final
realized set represents the outcome after any unmodeled rerolls.

## Current planner disposition

The planner does not yet model Pool presence or its realized list. Its
existing generic trait-removal consequences are the relevant semantic result:
removing the selected trait name removes every stack and must leave normal
history effects intact, including the previously-picked record that prevents a
removed trait from becoming eligible again where the game uses that predicate.
The Pool's gold grant, exact pricing, and permanent-upgrade requirements are
intentionally sim-neutral. Shared Store rerolls remain outside the modeled
scope. A future slice may author the realized up-to-three-name list and any
chosen sales without modeling the random generation or reroll process itself.
